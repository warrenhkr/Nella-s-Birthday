// ============================================================
// server/lib/media-resolution.ts — Résolution + cache des liens
// pCloud directs, partagés par les proxys média.
//
// POURQUOI CE FICHIER EXISTE :
// pCloud ne fournit que des liens de téléchargement DIRECTS liés à
// l'adresse IP qui les a demandés. Les stocker en base garantit qu'ils
// casseront (HTTP 410 « This link was generated for another IP address »).
// On stocke donc le publink (stable) + le nom du fichier, et le serveur
// re-résout le publink au moment de l'affichage.
//
// PROBLÈME MESURÉ (c'est la cause de la lenteur des vidéos) :
//   1. Une résolution pCloud coûte ~4 s : 1,18 s pour la page du publink
//      + 2,87 s pour les 8 appels api.pcloud.com, faits SÉQUENTIELLEMENT.
//   2. Ce coût était repayé pour CHAQUE FICHIER, car le cache était
//      indexé sur « publink#f=nom ». La galerie sert 30 vidéos issues du
//      MÊME publink : 30 résolutions identiques, 240 appels HTTP pCloud.
//
// CORRECTIF :
//   - le cache est indexé par le publink de BASE (sans « #f=nom ») et
//     conserve la LISTE complète des fichiers résolus → la première vidéo
//     du dossier paie la résolution, les 29 suivantes sont instantanées ;
//   - un lien déjà direct n'est PLUS re-résolu : avant, un lien direct
//     *.pcloud.com était rechargé ENTIER en mémoire (21 Mo) puis analysé
//     comme du texte pour finalement être renvoyé tel quel. On le sert
//     maintenant sans aucune requête superflue.
// ============================================================

import { discoverPublicImageUrls, estHotePcloud, estHoteTerabox, nomFichierPcloud, resolvePublicVideoUrls } from '../utils/import-media'

export type TypeMedia = 'IMAGE' | 'VIDEO'

/** Seules les URL pCloud et Terabox sont acceptées par le proxy serveur.
 *  Les hôtes viennent de shared/media-providers.ts : plus de copie locale, donc
 *  plus de risque que le proxy et l'import ne soient pas d'accord sur « pCloud ». */
export function estUrlPcloud(value: string) {
  return estHotePcloud(value)
}

export function estUrlTerabox(value: string) {
  // Même allow-list STRICTE que partout ailleurs (shared/media-providers.ts,
  // HOTES_TERABOX) : égalité d'hôte ou sous-domaine, jamais `includes` — sans
  // quoi https://terabox.com.attaquant.tld/ ou
  // https://terabox.com.169.254.169.254.nip.io/ transformait /api/media/proxy
  // en proxy ouvert + SSRF.
  return estHoteTerabox(value)
}

export function estUrlMediaProxyable(value: string) {
  return estUrlPcloud(value) || estUrlTerabox(value)
}

/**
 * Un publink doit être résolu ; un lien de téléchargement direct (*.pcloud.com
 * du type pnyc1.pcloud.com/…) est déjà le fichier final.
 *
 * C'est le test qui évite de télécharger une vidéo entière en mémoire pour
 * rien : sans lui, `resolvePublicVideoUrls` ouvre le lien direct sans Range,
 * lit tout le fichier avec `response.text()` puis le renvoie inchangé.
 */
export function estPublinkAResoudre(value: string) {
  try {
    const url = new URL(value)
    const host = url.hostname.replace(/^www\./, '').toLowerCase()
    if (host === 'u.pcloud.link') return true
    // Un publink porte toujours un « code » ; un lien direct n'en a pas.
    return url.searchParams.has('code')
  } catch {
    return false
  }
}

/** Type MIME déduit de l'extension (pCloud renvoie souvent octet-stream). */
export function typeMime(url: string, amont: string) {
  if (amont && amont !== 'application/octet-stream') return amont
  const ext = ((url.split('?')[0] ?? '').match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase()
  const table: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    bmp: 'image/bmp',
    avif: 'image/avif',
    mp4: 'video/mp4',
    m4v: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime'
  }
  return table[ext] || 'application/octet-stream'
}

/**
 * TTL du cache de résolution : 10 min.
 * Le lien direct reste lié à l'IP de l'instance qui l'a obtenu ; il demeure
 * donc valide tant que l'instance serverless vit. En cas de 410/403 on purge
 * l'entrée (voir `oublierResolution`) et on re-résout depuis la même machine.
 */
const RESOLUTION_TTL_MS = 10 * 60 * 1000
const MAX_ENTREES = 500

const cacheResolutions = new Map<string, { urls: string[], expiration: number }>()

/** Sépare le publink du nom de fichier visé (« publink#f=nom.jpg »). */
export function decouperCible(brut: string) {
  const [base = '', fragment = ''] = brut.split('#')
  const nom = (new URLSearchParams(fragment).get('f') || '').trim()
  return { base, nom }
}

/**
 * Résout un publink pCloud en liste d'URL directes, AVEC cache.
 * La clé est le publink de BASE : tous les fichiers d'un même dossier
 * partagent donc une seule résolution.
 */
export async function resoudreUrls(base: string, type: TypeMedia): Promise<string[]> {
  const cle = `${type}:${base}`
  const entree = cacheResolutions.get(cle)
  if (entree) {
    if (Date.now() <= entree.expiration) return entree.urls
    cacheResolutions.delete(cle)
  }

  // Lien déjà direct : aucune résolution (ni téléchargement) nécessaire.
  if (!estPublinkAResoudre(base)) return [base]

  const urls = type === 'VIDEO'
    ? await resolvePublicVideoUrls(base)
    : await discoverPublicImageUrls(base)

  if (!urls.length) return [base]

  // On ne met en cache que les résolutions réellement abouties : un échec
  // transitoire de pCloud doit pouvoir être retenté à la requête suivante.
  if (urls.some(url => url !== base)) {
    if (cacheResolutions.size >= MAX_ENTREES) {
      const plusAncienne = cacheResolutions.keys().next().value
      if (plusAncienne !== undefined) cacheResolutions.delete(plusAncienne)
    }
    cacheResolutions.set(cle, { urls, expiration: Date.now() + RESOLUTION_TTL_MS })
  }
  return urls
}

/** Purge l'entrée d'un publink (lien périmé / généré pour une autre IP). */
export function oublierResolution(base: string, type: TypeMedia) {
  cacheResolutions.delete(`${type}:${base}`)
}

/**
 * Choisit LE fichier visé parmi les URL résolues : par nom si le publink
 * en contient plusieurs (« #f=nom.jpg »), sinon le premier.
 */
export function choisirUrl(urls: string[], nom: string, base: string): string {
  if (!urls.length) return base
  if (!nom) return urls[0] || base
  const recherche = nom.toLowerCase()
  return urls.find(url => nomFichierPcloud(url).toLowerCase() === recherche) || urls[0] || base
}
