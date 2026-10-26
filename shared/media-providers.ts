/**
 * SOURCE DE VÉRITÉ UNIQUE — matrice des sources médias du Club Otaku.
 * ---------------------------------------------------------------------------
 * MATRICE OFFICIELLE DE L'IMPORT EN MASSE
 *   IMAGES : pCloud + Terabox
 *   VIDÉOS : pCloud + YouTube + Terabox
 *   (les plateformes vidéo historiques — Vimeo, Dailymotion, Twitch, Google
 *    Drive — restent acceptées : les liens déjà en base doivent continuer à
 *    s'afficher, mais elles ne font pas partie de la matrice annoncée.)
 *
 * POURQUOI CE FICHIER
 * Les mêmes listes d'hôtes étaient recopiées à QUATRE endroits (composant
 * d'import d'événements, import-média serveur, import galerie, route boutique)
 * et avaient donc divergé : Terabox était connu du serveur mais absent de la
 * liste blanche vidéo du composant (H1) et de sa copie locale de
 * `isPublicFolderUrl` (H2), et le filtre « dossier » de l'import d'événements
 * ignorait purement Terabox (H3) — un partage Terabox y devenait un média IMAGE
 * dont l'URL est une PAGE HTML (vignette morte, sans message d'erreur).
 *
 * CE FICHIER EST PUR (aucun accès réseau, aucune dépendance) : il est importé
 * tel quel par le client (`#shared/media-providers`) et par le serveur
 * (chemin relatif), donc la classification d'un lien est IDENTIQUE des deux
 * côtés. Toute évolution de la matrice se fait ICI, et nulle part ailleurs.
 */

/** Nature d'un lien collé dans une zone d'import média. */
export type NatureLienMedia = 'DOSSIER' | 'IMAGE' | 'VIDEO' | 'INCONNU'

/**
 * Hôtes Terabox légitimes. Allow-list STRICTE (jamais `includes`) : sans ça,
 * « terabox.com.attaquant.tld » passerait et ouvrirait un SSRF.
 */
export const HOTES_TERABOX: readonly string[] = [
  'terabox.com', '1024terabox.com', '1024tera.com', 'terabox.app', 'teraboxcdn.com'
]

/** Hôte normalisé (sans « www. », en minuscules) d'une URL, sinon chaîne vide. */
export function hoteDe(valeur: string): string {
  try {
    return new URL(String(valeur).trim()).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

/** Un hôte appartient-il à une liste d'hôtes (égalité ou sous-domaine) ? */
export function hoteDansListe(host: string, liste: readonly string[]): boolean {
  const h = String(host || '').replace(/^www\./, '').toLowerCase()
  return liste.some(hote => h === hote || h.endsWith(`.${hote}`))
}

export function estHoteTerabox(hoteOuUrl: string): boolean {
  const brut = String(hoteOuUrl || '')
  const host = brut.includes('/') ? hoteDe(brut) : brut.replace(/^www\./, '').toLowerCase()
  return hoteDansListe(host, HOTES_TERABOX)
}

/** pCloud : publinks `u.pcloud.link/publink/show` et hôtes `*.pcloud.com`. */
export function estHotePcloud(hoteOuUrl: string): boolean {
  const brut = String(hoteOuUrl || '')
  const host = brut.includes('/') ? hoteDe(brut) : brut.replace(/^www\./, '').toLowerCase()
  return host === 'pcloud.com' || host.endsWith('.pcloud.com') || host === 'u.pcloud.link'
}

/**
 * Plateformes vidéo à LECTEUR embarqué (historique de la plateforme : les liens
 * déjà en base doivent continuer à s'afficher).
 */
export const HOTES_VIDEO_LECTEUR: readonly string[] = [
  'youtube.com', 'youtu.be', 'vimeo.com', 'player.vimeo.com', 'dailymotion.com',
  'dai.ly', 'twitch.tv', 'clips.twitch.tv', 'drive.google.com', 'docs.google.com'
]

/** Hôtes qui servent des images sans extension de fichier (CDN, aperçus). */
export const HOTES_IMAGE_SANS_EXTENSION: readonly string[] = [
  'res.cloudinary.com', 'i.ytimg.com', 'images.unsplash.com', 'lh3.googleusercontent.com',
  'drive.google.com', 'docs.google.com'
]

export function estHoteVideoLecteur(hoteOuUrl: string): boolean {
  const brut = String(hoteOuUrl || '')
  const host = brut.includes('/') ? hoteDe(brut) : brut.replace(/^www\./, '').toLowerCase()
  return hoteDansListe(host, HOTES_VIDEO_LECTEUR)
}

/** Hôtes que la validation CLIENT doit accepter comme vidéo (matrice réelle). */
export function estHoteVideoAccepte(hoteOuUrl: string): boolean {
  return estHoteVideoLecteur(hoteOuUrl) || estHotePcloud(hoteOuUrl) || estHoteTerabox(hoteOuUrl)
}

export const MOTIF_EXTENSION_IMAGE = '(?:jpe?g|png|webp|gif|bmp|avif)'
export const EXTENSIONS_IMAGE = /\.(?:jpe?g|png|webp|gif|bmp|avif|heic)(?:[?#]|$)/i
export const EXTENSIONS_VIDEO = /\.(?:mp4|webm|mov|m4v|mkv|avi)(?:[?#]|$)/i
/** Extensions de VIDÉO exploitable par le lecteur (mp4/webm servis par le proxy). */
export const EXTENSIONS_FICHIER_VIDEO = /\.(?:mp4|webm|mov|m4v)(?:[?#]|$)/i
/** Extensions d'IMAGE qui peuvent alimenter la galerie. */
export const EXTENSIONS_FICHIER_IMAGE = /\.(?:jpe?g|png|webp|gif|bmp|avif)(?:[?#]|$)/i

/**
 * DOSSIER PUBLIC à parcourir ?
 *   - Google Drive / Docs : /folders/…
 *   - pCloud : /publink/show?code=…
 *   - Terabox : /s/<jeton>, /d/<jeton>, /folder/… et la forme produite par le
 *     bouton « copier le lien » : /sharing/link?surl=<jeton>.
 *
 * Terabox était le trou de cette fonction côté composant (H2) et côté filtre
 * « dossier » de l'import d'événements (H3) : une page de partage y était
 * enregistrée comme une image (URL d'une page HTML).
 */
export function estDossierPublic(valeur: string): boolean {
  try {
    const url = new URL(String(valeur).trim())
    const host = hoteDe(url.toString())
    if (host === 'drive.google.com' || host === 'docs.google.com') return /\/folders\//i.test(url.pathname)
    if (estHotePcloud(url.toString())) return /\/publink\//i.test(url.pathname)
    if (estHoteTerabox(url.toString())) {
      return /\/s\/|\/d\/|\/folder\//i.test(url.pathname) || (url.pathname.includes('/sharing/link') && url.searchParams.has('surl'))
    }
  } catch {
    return false
  }
  return false
}

/** Google Drive : seuls les liens de FICHIER (/file/d/…) sont des vidéos ; un
 *  /folders/ est un dossier (traité avant, par estDossierPublic). */
export function estLienFichierGoogleDrive(valeur: string): boolean {
  try {
    const url = new URL(String(valeur).trim())
    const host = hoteDe(url.toString())
    return (host === 'drive.google.com' || host === 'docs.google.com') && /\/file\/d\//.test(url.pathname)
  } catch {
    return false
  }
}

/**
 * Ce que la zone « Images » doit faire d'un lien collé : dossier à parcourir,
 * image à publier, vidéo à rediriger vers le pipeline vidéo, ou refus.
 * Utilisé par le serveur (import d'événements, galerie, produits) ET par le
 * client (prévisualisation de l'import) : une seule règle, donc plus de
 * divergence entre l'aperçu et l'import réel.
 */
export function natureLienMedia(valeur: string): NatureLienMedia {
  const brut = String(valeur || '').trim()
  if (!brut) return 'INCONNU'
  if (estDossierPublic(brut)) return 'DOSSIER'
  try {
    const url = new URL(brut)
    if (!['http:', 'https:'].includes(url.protocol)) return 'INCONNU'
    if (estHoteVideoLecteur(brut) || estLienFichierGoogleDrive(brut)) return 'VIDEO'
    if (EXTENSIONS_VIDEO.test(brut)) return 'VIDEO'
    if (EXTENSIONS_IMAGE.test(brut)) return 'IMAGE'
    if (hoteDansListe(hoteDe(brut), HOTES_IMAGE_SANS_EXTENSION)) return 'IMAGE'
    // Aperçus pCloud (getpubthumb, sans extension de chemin) et vignettes Terabox.
    if (estHotePcloud(brut)) return 'IMAGE'
    if (estHoteTerabox(brut) && /thumbnail|\/getpubthumb|\.(?:jpe?g|png|webp)/i.test(brut)) return 'IMAGE'
  } catch {
    return 'INCONNU'
  }
  return 'INCONNU'
}

/**
 * Lien pCloud DIRECT (…pcloud.com/cget/…, /download, /file) : il est lié à
 * l'adresse IP qui l'a généré et répond HTTP 410 dès que l'IP change (voir
 * server/lib/media-resolution.ts). L'enregistrer garantit une image morte en
 * production. Sont EXCLUS : les publinks (/publink/show?code=…) et les aperçus
 * `getpubthumb`, publics et stables.
 *
 * Règle PARTAGÉE : la route produits la refuse avec un message français, et
 * l'aperçu du composant la signale AVANT l'import — même verdict des deux côtés.
 */
export function estLienPcloudDirectLieAIp(valeur: string): boolean {
  const brut = String(valeur || '')
  return estHotePcloud(brut) && !/getpubthumb/i.test(brut) && !/\/publink\//i.test(brut)
}

/** Nom du fichier final d'une URL de téléchargement pCloud. */
export function nomFichierPcloud(url: string): string {
  try {
    const segments = new URL(url).pathname.split('/').filter(Boolean)
    return decodeURIComponent(segments.pop() || '')
  } catch {
    return ''
  }
}

/**
 * Relie un média à SON fichier précis dans un publink pCloud.
 *
 * pCloud ne fournit que des liens de téléchargement DIRECTS, valables
 * uniquement pour l'IP qui les a demandés : les stocker en base garantit
 * qu'ils casseront (HTTP 410 « generated for another IP address »).
 *
 * On stocke donc le publink (stable) + le nom du fichier, sous la forme
 *   https://u.pcloud.link/publink/show?code=XXXX#f=nom.jpg
 * Le proxy média re-résout le publink au moment de l'affichage et sert le
 * fichier correspondant au nom — la résolution et le téléchargement ont
 * alors lieu depuis la même machine, donc ça fonctionne.
 *
 * ATTENTION : cette fonction ne vaut QUE pour pCloud. L'appliquer à un dossier
 * Terabox produisait « https://1024terabox.com/s/<jeton>#f=<vignette> » (H4),
 * URL que plus rien ne sait re-résoudre. Utiliser `urlImageDepuisDossier`, qui
 * décide selon le type de dossier.
 */
export function urlSourcePcloud(publink: string, fichierResolu: string): string {
  const nom = nomFichierPcloud(fichierResolu)
  if (!nom) return publink
  return `${publink}#f=${encodeURIComponent(nom)}`
}

/**
 * URL à ENREGISTRER pour un fichier découvert dans un dossier public :
 *   - dossier pCloud : publink stable + nom du fichier (« …#f=nom.jpg ») ;
 *   - tout autre dossier (Terabox, Google Drive) : l'URL découverte telle
 *     quelle — un aperçu Terabox (data.1024terabox.com/thumbnail/…) est public
 *     et stable, et ne doit surtout PAS être préfixé d'un publink.
 */
export function urlImageDepuisDossier(dossier: string, fichierResolu: string): string {
  return estHotePcloud(dossier) ? urlSourcePcloud(dossier, fichierResolu) : fichierResolu
}

/** Matrice de support, telle qu'annoncée à l'utilisateur. */
export const MATRICE_SOURCES = {
  images: ['pCloud', 'Terabox'],
  videos: ['pCloud', 'YouTube', 'Terabox']
} as const

/** Version texte pour les aides/placeholders de l'interface. */
export function libelleMatriceSources(): string {
  return `Images : ${MATRICE_SOURCES.images.join(', ')} — Vidéos : ${MATRICE_SOURCES.videos.join(', ')}`
}
