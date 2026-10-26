#!/usr/bin/env node
// ============================================================
// scripts/test-import-providers.mjs
//
// MATRICE DES SOURCES DE L'IMPORT EN MASSE — test SANS base de données.
//
// Matrice officielle :  IMAGES <- pCloud + Terabox
//                       VIDÉOS <- pCloud + YouTube + Terabox
//
// Le script charge le VRAI code du dépôt (server/utils/import-media.ts,
// shared/media-providers.ts) et EXÉCUTE les fonctions réellement utilisées par
// les trois imports en masse ; pour les composants Vue, il extrait leur propre
// liste blanche / leur propre fonction isPublicFolderUrl du fichier .vue et les
// exécute telles quelles — c'est ce qui permet de prouver une DIVERGENCE entre
// le client et le serveur au lieu de la supposer.
//
// Le jeu d'URLs est RÉEL : liens pCloud de test.xlsx (colonnes Image_url /
// vidéo_url), liens Terabox réellement présents dans gallery_images, liens du
// placeholder de /dashboard-moderation et des scripts de recette.
//
// Usage :
//   node scripts/test-import-providers.mjs              (tests + section réseau)
//   node scripts/test-import-providers.mjs --sans-reseau (classification seule)
// Sortie : tableau ligne à ligne, code 1 dès qu'une attente n'est pas tenue.
// ============================================================

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

const RACINE = path.resolve(import.meta.dirname, '..')
const AVEC_RESEAU = !process.argv.includes('--sans-reseau')
const fichier = (...parties) => path.join(RACINE, ...parties)

// Node exige l'extension d'un import relatif ESM ; les sources du projet
// l'omettent (convention Nuxt/Vite). On installe donc, dans le dossier
// TEMPORAIRE (jamais dans le dépôt), un résolveur qui réessaie avec « .ts ».
const RESOLVEUR = path.join(os.tmpdir(), 'otaku-resolveur-ts.mjs')
fs.writeFileSync(RESOLVEUR, [
  'export async function resolve(specifier, context, nextResolve) {',
  '  if (specifier.startsWith(\'.\') && !/\\.[a-z]+$/.test(specifier)) {',
  '    try { return await nextResolve(specifier + \'.ts\', context) } catch { /* on retente tel quel */ }',
  '  }',
  '  return nextResolve(specifier, context)',
  '}',
  ''
].join('\n'))
register(pathToFileURL(RESOLVEUR).href)

// ------------------------------------------------------------
// URLs RÉELLES (provenance indiquée pour chaque groupe)
// ------------------------------------------------------------
const LIENS = {
  /** test.xlsx colonne Image_url (23 publinks, on en garde 2). */
  pcloudImages: [
    'https://u.pcloud.link/publink/show?code=VZuYsHJZzSU3rJJz7dz8tU1UFfUkSSrEXDoy',
    'https://u.pcloud.link/publink/show?code=XZgQsHJZfDwdhSUcj65G2kVBNqaPap5zMVAV'
  ],
  /** gallery_images (base de dev/prod) : publinks vidéo déjà importés. */
  pcloudVideos: [
    'https://u.pcloud.link/publink/show?code=VZV2sHJZ9TSUcHgYVz0e3ql1atKDOyesFXi7',
    'https://u.pcloud.link/publink/show?code=VZRDsHJZjO07cQ4kl0uDS9A8gGYJuVTrJ0jk'
  ],
  /** gallery_images : pages de partage Terabox stockées À TORT comme IMAGE. */
  teraboxPartage: [
    'https://1024terabox.com/s/1Gos5U_4mEpThLjWffO1tPg',
    'https://1024terabox.com/s/1nBesAPNXXVJWYpRKpacPZg'
  ],
  /** Placeholder de /dashboard-moderation (partage éteint aujourd'hui). */
  teraboxPartageEteint: 'https://1024terabox.com/s/1UTBOwOd7_Rl2eXXPgqmlAg',
  /** Forme courte /d/ et bouton « copier le lien » de Terabox. */
  teraboxAutresFormes: [
    'https://terabox.com/d/1Gos5U_4mEpThLjWffO1tPg',
    'https://www.1024terabox.com/sharing/link?surl=1Gos5U_4mEpThLjWffO1tPg'
  ],
  youtube: [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ'
  ],
  vimeoDailymotionTwitchDrive: [
    'https://vimeo.com/76979871',
    'https://www.dailymotion.com/video/x8abcde',
    'https://www.twitch.tv/videos/123456789',
    'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/preview'
  ],
  imagesDirectes: [
    'https://res.cloudinary.com/demo/image/upload/c_fill,w_200,q_auto/sample.jpg',
    'https://exemple-club-otaku.test/photo.webp'
  ]
}

// Forme RÉELLE d'un aperçu Terabox (data.1024terabox.com/thumbnail/…) : la
// valeur exacte est récupérée au runtime par l'API de liste quand le réseau est
// disponible (voir section réseau) ; celle-ci ne sert qu'à la classification.
const APERCU_TERABOX_FORME = 'https://data.1024terabox.com/thumbnail/f7e13a81a276ecd8d8121046fcf0080e?fid=4401951911398&size=c850_u580&ft=image'
/** Aperçu pCloud (getpubthumb) : servi sans extension de fichier. */
const APERCU_PCLOUD = 'https://apilux3.pcloud.com/getpubthumb?code=kZ0QO75ZbPTNSPHTS0ZHTS0ZHTS0ZHTS0ZHTS0&fileid=123456789&size=1600x1200&type=jpg'

// ------------------------------------------------------------
// Harnais
// ------------------------------------------------------------
const resultats = []
function attente(section, hypothese, nom, condition, detail = '') {
  resultats.push({ section, hypothese, nom, ok: Boolean(condition), detail: String(detail) })
  const marque = condition ? 'OK  ' : 'ECHEC'
  console.log(`  [${marque}] ${hypothese ? `${hypothese} ` : ''}${nom}${detail ? ` — ${detail}` : ''}`)
}

async function charger(chemin) {
  try {
    return await import(pathToFileURL(fichier(chemin)).href + `?t=${Date.now()}`)
  } catch (erreur) {
    return { __erreur: erreur.message }
  }
}

/** Corps d'une fonction déclarée « function nom(params) { … } » (accolades équilibrées).
 *  Renvoie { params, corps } — les annotations TS sont retirées des paramètres. */
function extraireFonction(source, nom) {
  const m = new RegExp(`function\\s+${nom}\\s*\\(([^)]*)\\)\\s*\\{`).exec(source)
  if (!m) return null
  const debut = m.index + m[0].length - 1
  let profondeur = 0
  for (let i = debut; i < source.length; i += 1) {
    if (source[i] === '{') profondeur += 1
    else if (source[i] === '}') {
      profondeur -= 1
      if (profondeur === 0) {
        return { params: m[1].replace(/:\s*[^,)=]+/g, '').trim(), corps: source.slice(debut, i + 1) }
      }
    }
  }
  return null
}

/** Compile un fragment du dépôt (annotations TS simples retirées) et l'exécute. */
function evaluer(fragment) {
  const js = fragment.replace(/:\s*string\b/g, '').replace(/\(\)\s*:\s*[A-Za-z<>|[\]]+/g, '()')
  return new Function(`return (${js})`)()
}

const hoteDe = (valeur) => {
  try {
    return new URL(String(valeur).trim()).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

console.log('\n=== Club Otaku — matrice des sources de l\'import en masse ===')
console.log(`racine : ${RACINE}`)
console.log(`réseau : ${AVEC_RESEAU ? 'activé' : 'désactivé (--sans-reseau)'}\n`)

// ------------------------------------------------------------
// A. Serveur — classification pure
// ------------------------------------------------------------
console.log('A. serveur : classifierLienImage / isPublicFolderUrl / parseVideoUrl')
const SERVEUR = await charger('server/utils/import-media.ts')
if (SERVEUR.__erreur) {
  attente('A', '', 'server/utils/import-media.ts se charge', false, SERVEUR.__erreur)
} else {
  const { classifierLienImage, isPublicFolderUrl, parseVideoUrl, preparerMediasVideo } = SERVEUR
  attente('A', '', 'server/utils/import-media.ts se charge', true, `classifierLienImage=${typeof classifierLienImage}`)
  attente('A', '', 'isPublicFolderUrl existe', typeof isPublicFolderUrl === 'function')

  for (const lien of LIENS.pcloudImages) {
    attente('A', 'H3', `publink pCloud reconnu comme DOSSIER — ${lien.slice(0, 62)}…`,
      classifierLienImage(lien) === 'DOSSIER' && isPublicFolderUrl(lien) === true,
      `classe=${classifierLienImage(lien)} dossier=${isPublicFolderUrl(lien)}`)
  }
  for (const lien of LIENS.teraboxPartage) {
    attente('A', 'H3', `partage Terabox reconnu comme DOSSIER — ${lien}`,
      classifierLienImage(lien) === 'DOSSIER' && isPublicFolderUrl(lien) === true,
      `classe=${classifierLienImage(lien)} dossier=${isPublicFolderUrl(lien)}`)
  }
  for (const lien of LIENS.teraboxAutresFormes) {
    attente('A', 'H3', `forme Terabox alternative reconnue comme DOSSIER — ${lien}`,
      isPublicFolderUrl(lien) === true, `dossier=${isPublicFolderUrl(lien)}`)
  }
  attente('A', '', 'aperçu Terabox (data.1024terabox.com/thumbnail/…) = IMAGE',
    classifierLienImage(APERCU_TERABOX_FORME) === 'IMAGE', `classe=${classifierLienImage(APERCU_TERABOX_FORME)}`)
  attente('A', '', 'aperçu pCloud (getpubthumb) = IMAGE',
    classifierLienImage(APERCU_PCLOUD) === 'IMAGE', `classe=${classifierLienImage(APERCU_PCLOUD)}`)
  for (const lien of LIENS.imagesDirectes) {
    attente('A', '', `image directe = IMAGE — ${lien.slice(0, 58)}…`,
      classifierLienImage(lien) === 'IMAGE', `classe=${classifierLienImage(lien)}`)
  }
  for (const lien of LIENS.youtube) {
    attente('A', '', `YouTube = VIDEO — ${lien}`,
      classifierLienImage(lien) === 'VIDEO' && Boolean(parseVideoUrl(lien)), `classe=${classifierLienImage(lien)}`)
  }
  for (const lien of LIENS.vimeoDailymotionTwitchDrive) {
    attente('A', '', `plateforme vidéo historique = VIDEO — ${lien.slice(0, 58)}…`,
      classifierLienImage(lien) === 'VIDEO' && Boolean(parseVideoUrl(lien)), `classe=${classifierLienImage(lien)}`)
  }

  // --- Matrice VIDÉOS : pCloud + YouTube + Terabox ---
  for (const lien of [...LIENS.pcloudVideos, ...LIENS.teraboxPartage, ...LIENS.youtube]) {
    attente('A', '', `matrice vidéo acceptée par parseVideoUrl — ${lien.slice(0, 62)}…`,
      Boolean(parseVideoUrl(lien)), `provider=${parseVideoUrl(lien)?.provider ?? 'null'}`)
  }
  const { medias, erreurs } = await preparerMediasVideo([...LIENS.youtube.slice(0, 1), ...LIENS.teraboxPartage.slice(0, 1)])
  attente('A', '', 'preparerMediasVideo : YouTube -> YOUTUBE_VIDEO identifié',
    medias.some(m => m.mediaType === 'YOUTUBE_VIDEO' && m.youtubeId), JSON.stringify(medias.map(m => m.mediaType)))
  attente('A', '', 'preparerMediasVideo : partage Terabox -> média VIDEO (lien sortant)',
    medias.some(m => m.mediaType === 'VIDEO' && LIENS.teraboxPartage.includes(m.url)), `${medias.length} média(s), erreurs=${JSON.stringify(erreurs)}`)

  // --- H4 : le publink pCloud ne doit se transformer en « …#f=nom » QUE pour pCloud ---
  const dossierTerabox = LIENS.teraboxPartage[0]
  const apercuTerabox = APERCU_TERABOX_FORME
  const dossierPcloud = LIENS.pcloudImages[0]
  const fichierPcloud = 'https://fivet.pcloud.com/cget/x/photo%20club.jpg'
  attente('A', 'H4', 'urlImageDepuisDossier : dossier Terabox -> aperçu Terabox INCHANGÉ (aucun « #f= » ajouté)',
    typeof SERVEUR.urlImageDepuisDossier === 'function' && SERVEUR.urlImageDepuisDossier(dossierTerabox, apercuTerabox) === apercuTerabox,
    typeof SERVEUR.urlImageDepuisDossier === 'function'
      ? `terabox -> ${SERVEUR.urlImageDepuisDossier(dossierTerabox, apercuTerabox).slice(0, 80)}`
      : 'urlImageDepuisDossier ABSENTE de server/utils/import-media.ts')
  attente('A', 'H4', 'urlImageDepuisDossier : dossier pCloud -> publink stable + nom du fichier',
    typeof SERVEUR.urlImageDepuisDossier === 'function'
    && SERVEUR.urlImageDepuisDossier(dossierPcloud, fichierPcloud) === `${dossierPcloud}#f=photo%20club.jpg`,
    typeof SERVEUR.urlImageDepuisDossier === 'function'
      ? `pcloud -> ${SERVEUR.urlImageDepuisDossier(dossierPcloud, fichierPcloud).slice(0, 110)}`
      : 'urlImageDepuisDossier ABSENTE de server/utils/import-media.ts')

  // --- H5 : les produits doivent dérouler le même pipeline que la galerie ---
  const sourceProduits = fs.readFileSync(fichier('server/api/boutique/catalog/bulk.post.ts'), 'utf8')
  attente('A', 'H5', 'import produits : les dossiers publics sont parcourus (discoverPublicImageUrls)',
    /discoverPublicImageUrls/.test(sourceProduits), 'voir server/api/boutique/catalog/bulk.post.ts')
  attente('A', 'H5', 'import produits : les liens stockés passent par le pipeline média (urlImageDepuisDossier / urlSourcePcloud)',
    /urlImageDepuisDossier|urlSourcePcloud/.test(sourceProduits), 'aucun appel au pipeline média trouvé')
  attente('A', 'H5', 'import produits : les vidéos et liens non média sont refusés en français',
    /vidéo|video/i.test(sourceProduits) && /(non reconnu|non supporté)/i.test(sourceProduits),
    'aucun message de refus explicite trouvé')
}

// ------------------------------------------------------------
// A2. Routes bulk — filtres « dossier » réellement appliqués
// ------------------------------------------------------------
const VUES = [
  { nom: 'EventBulkImport', chemin: 'app/components/EventBulkImport.vue' },
  { nom: 'ProductBulkImport', chemin: 'app/components/ProductBulkImport.vue' },
  { nom: 'dashboard-moderation', chemin: 'app/pages/dashboard-moderation.vue' }
]
const SOURCES = Object.fromEntries(VUES.map(v => [v.nom, fs.readFileSync(fichier(v.chemin), 'utf8')]))
const ROUTES = {
  evenements: fs.readFileSync(fichier('server/api/events/bulk.post.ts'), 'utf8'),
  galerie: fs.readFileSync(fichier('server/api/admin/gallery/bulk.post.ts'), 'utf8'),
  produits: fs.readFileSync(fichier('server/api/boutique/catalog/bulk.post.ts'), 'utf8')
}

console.log('\nA2. routes bulk : filtre « dossier » appliqué aux liens collés')
const motifHerite = /\/drive[^/\n]*\.link\/i/.exec(ROUTES.evenements)
if (motifHerite) {
  const regex = new Function(`return ${motifHerite[0]}`)()
  const teraboxVuCommeDossier = regex.test(LIENS.teraboxPartage[0]) === true
  attente('A2', 'H3', 'filtre dossier des événements : une page de partage Terabox est un DOSSIER (jamais une photo directe)',
    teraboxVuCommeDossier,
    `regex héritée ${regex.source} -> test(${LIENS.teraboxPartage[0]}) = ${regex.test(LIENS.teraboxPartage[0])} : le lien reste dans photoUrls, donc un média IMAGE dont l'URL est une page HTML`)
} else {
  attente('A2', 'H3', 'filtre dossier des événements délégué à isPublicFolderUrl (couvre Terabox)',
    !SERVEUR.__erreur && SERVEUR.isPublicFolderUrl(LIENS.teraboxPartage[0]) === true,
    `isPublicFolderUrl(terabox)=${SERVEUR.__erreur ? 'n/a' : SERVEUR.isPublicFolderUrl(LIENS.teraboxPartage[0])}`)
}
attente('A2', 'H4', 'événements : l’URL d’un média découvert passe par urlImageDepuisDossier (plus de « #f= » Terabox)',
  /urlImageDepuisDossier/.test(ROUTES.evenements), 'aucun appel trouvé dans server/api/events/bulk.post.ts')
attente('A2', '', 'galerie : plus de copie locale de la détection « dossier pCloud » (déléguée au partagé)',
  !/host === 'pcloud\.com' \|\| host\.endsWith\('\.pcloud\.com'\)/.test(ROUTES.galerie),
  'copie locale détectée dans server/api/admin/gallery/bulk.post.ts')

// ------------------------------------------------------------
// B. Composants — H1 (liste blanche vidéo) et H2 (isPublicFolderUrl locale)
// ------------------------------------------------------------
// B.1 — source de vérité partagée
const PARTAGE = await charger('shared/media-providers.ts')
const partageDisponible = !PARTAGE.__erreur
console.log('\nB. client : source de vérité partagée, listes blanches des composants')
attente('B', '', 'shared/media-providers.ts existe et se charge', partageDisponible,
  partageDisponible ? 'source unique des hôtes plateformes' : PARTAGE.__erreur)

// B.2 — H1 : acceptation d'un lien vidéo par la validation du composant
const sourceEvenements = SOURCES.EventBulkImport
const importPartageEvenements = /from '#shared\/media-providers'/.test(sourceEvenements)
// (a) API cible : fonction partagée.  (b) état actuel : tableau littéral du composant.
const listeBlancheExtraite = (() => {
  const m = /\[([^\]]{20,}?)\]\.some\(domain =>/.exec(sourceEvenements)
  if (!m) return null
  try {
    return evaluer(`[${m[1]}]`)
  } catch {
    return null
  }
})()
function videoAccepteeParLeComposant(url) {
  if (importPartageEvenements && partageDisponible) return PARTAGE.estHoteVideoAccepte(url)
  if (!listeBlancheExtraite) return null
  const host = hoteDe(url)
  return listeBlancheExtraite.some(domaine => host === domaine || host.endsWith(`.${domaine}`))
}
const candidatesVideo = [...LIENS.youtube.slice(0, 1), ...LIENS.pcloudVideos.slice(0, 1), ...LIENS.teraboxPartage.slice(0, 1)]
attente('B', 'H1', 'EventBulkImport.vue consomme shared/media-providers.ts (plus de copie locale)',
  importPartageEvenements, importPartageEvenements ? 'import #shared/media-providers OK' : `${listeBlancheExtraite ? listeBlancheExtraite.length : 0} domaine(s) en dur dans le composant`)
for (const lien of candidatesVideo) {
  const verdict = videoAccepteeParLeComposant(lien)
  const matrice = /terabox/i.test(lien) ? 'Terabox' : /pcloud/i.test(lien) ? 'pCloud' : 'YouTube'
  attente('B', 'H1', `validation vidéo du composant accepte ${matrice} — ${lien.slice(0, 58)}…`,
    verdict === true, `verdict=${verdict === null ? 'liste blanche illisible' : verdict}`)
}

// B.3 — H2 : isPublicFolderUrl locale du composant vs version serveur
const fonctionLocale = extraireFonction(sourceEvenements, 'isPublicFolderUrl')
let composantEstDossierPublic
if (fonctionLocale) {
  const locale = new Function(fonctionLocale.params, fonctionLocale.corps)
  composantEstDossierPublic = url => Boolean(locale(url))
} else if (partageDisponible) {
  composantEstDossierPublic = url => PARTAGE.estDossierPublic(url) === true
}
attente('B', 'H2', 'EventBulkImport.vue n\'a plus de copie locale de isPublicFolderUrl',
  !fonctionLocale, fonctionLocale ? 'copie locale détectée dans le composant' : 'délégué à shared/media-providers.ts')
for (const lien of [...LIENS.teraboxPartage, ...LIENS.teraboxAutresFormes]) {
  const verdict = composantEstDossierPublic ? composantEstDossierPublic(lien) : null
  attente('B', 'H2', `dossier Terabox reconnu par la fonction du composant — ${lien.slice(0, 62)}…`,
    verdict === true, `verdict=${verdict === null ? 'fonction absente' : verdict}`)
}
for (const lien of LIENS.pcloudImages.slice(0, 1)) {
  const verdict = composantEstDossierPublic ? composantEstDossierPublic(lien) : null
  attente('B', '', `publink pCloud reconnu par la fonction du composant — ${lien.slice(0, 62)}…`,
    verdict === true, `verdict=${verdict === null ? 'fonction absente' : verdict}`)
}

// ------------------------------------------------------------
// C. H6 — aides affichées dans /dashboard-moderation
// ------------------------------------------------------------
console.log('\nC. dashboard-moderation : aides de la zone d\'import média')
const zoneImages = /Images et dossiers[\s\S]{0,900}?id="gallery-image-links"/.exec(SOURCES['dashboard-moderation'])?.[0] || ''
const zoneVideos = /Vidéos par liens[\s\S]{0,900}?id="gallery-video-links"/.exec(SOURCES['dashboard-moderation'])?.[0] || ''
const placeholderVideos = /placeholder="([^"]*)"[\s\S]{0,160}?id="gallery-video-links"|id="gallery-video-links"[\s\S]{0,400}?placeholder="([^"]*)"/.exec(SOURCES['dashboard-moderation'])
const texteVideos = `${zoneVideos} ${placeholderVideos?.[1] || placeholderVideos?.[2] || ''}`
attente('C', 'H6', 'aide zone Images : mentionne pCloud ET Terabox',
  /pCloud/i.test(zoneImages) && /Terabox/i.test(zoneImages),
  zoneImages ? `bloc détecté (${zoneImages.length} car.)` : 'bloc « Images et dossiers » introuvable')
attente('C', 'H6', 'aide zone Vidéos : mentionne pCloud, YouTube ET Terabox',
  /pCloud/i.test(texteVideos) && /YouTube/i.test(texteVideos) && /Terabox/i.test(texteVideos),
  texteVideos ? `bloc détecté (${texteVideos.length} car.)` : 'bloc « Vidéos par liens » introuvable')

// ------------------------------------------------------------
// D. Réseau — résolution réelle (aucune écriture)
// ------------------------------------------------------------
if (AVEC_RESEAU && !SERVEUR.__erreur) {
  console.log('\nD. réseau : résolution réelle des partages (aucune écriture en base)')
  const { discoverPublicImageUrls, listerPartageTerabox } = SERVEUR
  for (const lien of LIENS.teraboxPartage) {
    const apercus = await discoverPublicImageUrls(lien).catch(() => [])
    const premier = apercus[0] || ''
    let statut = null
    let typeContenu = ''
    if (premier) {
      const reponse = await fetch(premier, { signal: AbortSignal.timeout(15000) }).catch(() => null)
      statut = reponse?.status ?? null
      typeContenu = reponse?.headers.get('content-type') || ''
    }
    attente('D', '', `partage Terabox -> aperçus publics — ${lien}`,
      apercus.length > 0 && statut === 200 && typeContenu.startsWith('image/'),
      `${apercus.length} aperçu(s), 1er = HTTP ${statut} ${typeContenu} ${premier.slice(0, 70)}…`)
  }
  const eteint = await listerPartageTerabox(LIENS.teraboxPartageEteint).catch(() => [])
  console.log(`  [INFO ] partage Terabox éteint (placeholder du dashboard) -> ${eteint.length} fichier(s) : ${LIENS.teraboxPartageEteint}`)
  for (const lien of LIENS.pcloudImages) {
    const images = await discoverPublicImageUrls(lien).catch(() => [])
    // pCloud limite le débit quand plusieurs dossiers sont résolus en parallèle :
    // ce contrôle est INFORMATIF (test-media-pipeline.mjs en fait un test dédié).
    console.log(`  [INFO ] publink pCloud images -> ${images.length} image(s) : ${images[0]?.slice(0, 100) ?? '(aucune)'}`)
  }
  const dossierVideo = LIENS.pcloudVideos[0]
  const { medias: mediasVideo } = await SERVEUR.preparerMediasVideo([dossierVideo])
  attente('D', '', 'publink pCloud vidéo -> un média PAR FICHIER (publink#f=nom)',
    mediasVideo.length > 0 && mediasVideo.every(m => m.url.includes('#f=') && m.url.startsWith(dossierVideo)),
    `${mediasVideo.length} média(s) — 1er = ${(mediasVideo[0]?.url || '(aucun)').slice(0, 110)}`)
} else if (!AVEC_RESEAU) {
  console.log('\nD. réseau : section ignorée (--sans-reseau)')
}

// ------------------------------------------------------------
// Bilan
// ------------------------------------------------------------
const echecs = resultats.filter(r => !r.ok)
console.log(`\n${resultats.length - echecs.length}/${resultats.length} attentes tenues`)
if (echecs.length) {
  for (const e of echecs) console.log(`  - ${e.hypothese || '—'} ${e.section} : ${e.nom} (${e.detail})`)
  console.log('MATRICE DES SOURCES : ÉCHEC')
  process.exit(1)
}
console.log('MATRICE DES SOURCES : OK (IMAGES <- pCloud + Terabox ; VIDÉOS <- pCloud + YouTube + Terabox)')
