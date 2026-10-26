// ------------------------------------------------------------
// MATRICE DES SOURCES — voir shared/media-providers.ts (source de vérité
// unique : hôtes pCloud / Terabox / YouTube / plateformes historiques,
// nature d'un lien, dossier public, publink + nom de fichier).
//
// Import RELATIF AVEC extension « .ts » : ce fichier est chargé aussi bien par
// Nuxt/Vite que DIRECTEMENT par Node (scripts/test-media-pipeline.mjs,
// scripts/test-import-providers.mjs) ; les deux résolvent cette forme
// (vérifié : pluginContainer.resolveId → shared/media-providers.ts).
// ------------------------------------------------------------
import {
  MOTIF_EXTENSION_IMAGE,
  estDossierPublic,
  estHotePcloud,
  estHoteTerabox,
  natureLienMedia,
  urlSourcePcloud
} from '../../shared/media-providers.ts'

export {
  EXTENSIONS_FICHIER_IMAGE,
  EXTENSIONS_FICHIER_VIDEO,
  EXTENSIONS_IMAGE,
  EXTENSIONS_VIDEO,
  HOTES_IMAGE_SANS_EXTENSION,
  HOTES_TERABOX,
  HOTES_VIDEO_LECTEUR,
  MATRICE_SOURCES,
  estDossierPublic,
  estLienPcloudDirectLieAIp,
  estHotePcloud,
  estHoteTerabox,
  estHoteVideoAccepte,
  estHoteVideoLecteur,
  hoteDe,
  libelleMatriceSources,
  nomFichierPcloud,
  urlImageDepuisDossier,
  urlSourcePcloud
} from '../../shared/media-providers.ts'

/** Alias historiques (noms utilisés par les routes et les tests existants) :
 *  même implémentation PARTAGÉE, donc plus aucune divergence client/serveur. */
export const isPublicFolderUrl = estDossierPublic
export const classifierLienImage = natureLienMedia

export type VideoProvider = 'youtube' | 'vimeo' | 'dailymotion' | 'twitch' | 'google_drive' | 'pcloud' | 'terabox'

export type ParsedVideo = {
  provider: VideoProvider
  id: string
  url: string
}

export function parseVideoUrl(value: string): ParsedVideo | null {
  try {
    const url = new URL(value.trim())
    const host = url.hostname.replace(/^www\./, '').toLowerCase()

    if (host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com')) {
      const id = host === 'youtu.be'
        ? url.pathname.slice(1).split('/')[0]
        : url.pathname.startsWith('/embed/') || url.pathname.startsWith('/shorts/')
          ? url.pathname.split('/')[2]
          : url.searchParams.get('v')
      return id ? { provider: 'youtube', id, url: `https://www.youtube.com/watch?v=${id}` } : null
    }

    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const id = url.pathname.split('/').filter(Boolean).pop()
      return id && /^\d+$/.test(id) ? { provider: 'vimeo', id, url: `https://vimeo.com/${id}` } : null
    }

    if (host === 'dailymotion.com' || host === 'dai.ly') {
      const id = host === 'dai.ly'
        ? url.pathname.slice(1).split('/')[0]
        : url.pathname.match(/\/video\/([a-z0-9]+)/i)?.[1]
      return id ? { provider: 'dailymotion', id, url: `https://www.dailymotion.com/video/${id}` } : null
    }

    if (host === 'twitch.tv' || host === 'clips.twitch.tv') {
      const id = host === 'clips.twitch.tv'
        ? url.pathname.slice(1).split('/')[0]
        : url.pathname.match(/\/videos\/([0-9]+)/)?.[1]
      return id ? { provider: 'twitch', id, url: `https://www.twitch.tv/videos/${id}` } : null
    }

    if (host === 'drive.google.com' || host === 'docs.google.com') {
      const id = url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || url.searchParams.get('id')
      return id ? { provider: 'google_drive', id, url: `https://drive.google.com/file/d/${id}/preview` } : null
    }

    // pCloud : le publink est stable, c'est le proxy média qui le résout en
    // lien direct au moment de l'affichage (un lien direct pCloud est lié à
    // l'IP du demandeur et casse en production — HTTP 410).
    // NE PAS SUPPRIMER : cette branche a été perdue lors du passage à Terabox
    // (commit 49654f7), ce qui faisait refuser tout import de vidéo pCloud
    // (« plateforme ou URL non supportée ») alors que la clientèle stocke ses
    // vidéos sur pCloud.
    if (host === 'pcloud.com' || host.endsWith('.pcloud.com') || host === 'u.pcloud.link') {
      return { provider: 'pcloud', id: url.toString(), url: url.toString() }
    }

    if (estHoteTerabox(host)) {
      return { provider: 'terabox', id: url.toString(), url: url.toString() }
    }
  } catch {
    return null
  }

  return null
}

export async function resolvePublicVideoUrl(value: string) {
  const resolved = await resolvePublicVideoUrls(value)
  return resolved[0] || value
}

async function resolvePcloudDirectUrls(value: string, allowedExtensions: RegExp): Promise<string[]> {
  try {
    const original = value.trim()
    const url = new URL(original)
    const host = url.hostname.replace(/^www\./, '').toLowerCase()
    if (host !== 'u.pcloud.link' && !host.endsWith('.pcloud.com')) return [original]

    const code = url.searchParams.get('code')
    const sanitizedQuery = new URLSearchParams(url.search)
    sanitizedQuery.delete('download')
    const lookupUrl = code
      ? `${url.origin}${url.pathname}${sanitizedQuery.size ? `?${sanitizedQuery.toString()}` : ''}`
      : original
    const response = await fetch(lookupUrl, { redirect: 'follow', signal: AbortSignal.timeout(15000) })
    if (!response.ok) return [original]

    const html = await response.text()
    const directMatches = [...new Set(
      [...html.matchAll(/https?:\\?\/\\?\/[^\s"'<>]+\.(?:jpe?g|png|webp|gif|bmp|avif|mp4|webm|mov|m4v)(?:\?[^\s"'<>]*)?/gi)]
        .map(match => match[0].replaceAll('\\/', '/'))
        .filter(candidate => allowedExtensions.test(candidate))
    )]

    if (!code) {
      if (directMatches.length) return directMatches
      return [original]
    }

    const fileIds = [...new Set(
      [...html.matchAll(/"fileid"\s*:\s*"?(\d+)"?/gi)].map(match => match[1])
    )]
    const resolved = [] as string[]
    for (const fileId of fileIds) {
      const apiResponse = await fetch(`https://api.pcloud.com/getpublinkdownload?code=${encodeURIComponent(code)}&fileid=${fileId}`, {
        signal: AbortSignal.timeout(8000)
      })
      const data = await apiResponse.json() as { hosts?: string[], path?: string }
      const downloadHost = data.hosts?.[0]
      if (!downloadHost || !data.path) continue
      const downloadUrl = `https://${downloadHost}${data.path.replaceAll('\\/', '/')}`
      if (allowedExtensions.test(downloadUrl)) resolved.push(downloadUrl)
    }

    const downloadLinks = [...new Set(
      [...html.matchAll(/"downloadlink"\s*:\s*"(https?:\\?\/\\?\/[^"\s]+)"/gi)]
        .map(match => (match[1] ?? '').replaceAll('\\/', '/'))
        .filter(candidate => allowedExtensions.test(candidate))
    )]

    const finalMatches = [...new Set([...directMatches, ...resolved, ...downloadLinks])]
    if (finalMatches.length) return finalMatches

    const finalUrl = response.url
    if (allowedExtensions.test(finalUrl)) return [finalUrl]

    return [original]
  } catch {
    return [value]
  }
}

// ------------------------------------------------------------
// TERABOX — liste des fichiers d'un partage public.
//
// L'ANCIENNE APPROCHE ÉTAIT CASSÉE. Elle devinait un « shareid » dans le HTML
// puis interrogeait https://www.terabox.app/share/list et /api/list. Mesuré le
// 14/09/2026 sur les liens réellement en base :
//   - la page de partage (1024terabox.com → 1024tera.com/sharing/link) est une
//     application JS : AUCUN média dans le HTML (0 .jpg, 0 .mp4) ;
//   - ces endpoints répondent {"errno":2} ou {"errno":105} → dossier vu vide ;
//   - l'API officielle sans session répond
//     {"errno":400210,"errmsg":"need verify_v2"}.
//
// LE FLUX QUI FONCTIONNE (mesuré : errno 0 + liste complète des fichiers) :
//   1. GET de la page de partage → cookies csrfToken / browserid ;
//   2. GET /api/shorturlinfo?shorturl=<jeton>&root=1 AVEC ces cookies.
// Le jeton doit conserver son « 1 » initial : la page redirigée expose
// ?surl= sans ce « 1 » et l'API répond alors errno 2 (paramètre invalide).
//
// Les aperçus renvoyés (data.1024terabox.com/thumbnail/…) sont PUBLICS :
// vérifié sans cookie et avec un Referer de notre domaine → HTTP 200
// image/jpeg. En revanche le fichier ORIGINAL n'est pas téléchargeable
// (« share/download » → need verify_v2), donc un partage Terabox ne peut pas
// alimenter un LECTEUR vidéo : seules les images sont exploitables.
// ------------------------------------------------------------
const UA_NAVIGATEUR = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

export type FichierTerabox = {
  nom: string
  taille: number
  estImage: boolean
  estVideo: boolean
  /** URL d'aperçu publique (image), vide si Terabox n'en fournit pas. */
  apercu: string
}

const cacheListingTerabox = new Map<string, { fichiers: FichierTerabox[], expiration: number }>()
const TTL_LISTING_TERABOX = 5 * 60 * 1000

/** Jeton de partage : segment /s/<jeton> ou /d/<jeton>, sinon paramètre surl/pwd. */
function jetonPartageTerabox(url: URL) {
  const depuisChemin = url.pathname.match(/\/(?:s|d)\/([A-Za-z0-9_-]{5,})/)?.[1]
  const depuisParametre = url.searchParams.get('surl') || url.searchParams.get('pwd') || ''
  return (depuisChemin || depuisParametre).trim()
}

function extraireApercuTerabox(thumbs: unknown) {
  if (!thumbs || typeof thumbs !== 'object') return ''
  const source = thumbs as Record<string, string>
  for (const cle of ['url3', 'url2', 'url1', 'icon']) {
    const brut = source[cle]
    if (typeof brut !== 'string') continue
    const candidat = brut.replace(/&amp;/g, '&').trim()
    try {
      const url = new URL(candidat)
      if (!['http:', 'https:'].includes(url.protocol)) continue
      if (!estHoteTerabox(url.hostname.replace(/^www\./, '').toLowerCase())) continue
      return candidat
    } catch {
      continue
    }
  }
  return ''
}

export async function listerPartageTerabox(value: string): Promise<FichierTerabox[]> {
  try {
    const url = new URL(value.trim())
    const host = url.hostname.replace(/^www\./, '').toLowerCase()
    if (!estHoteTerabox(host)) return []

    const jeton = jetonPartageTerabox(url)
    if (!jeton) return []

    const enCache = cacheListingTerabox.get(jeton)
    if (enCache && Date.now() <= enCache.expiration) return enCache.fichiers

    const page = await fetch(url.toString(), {
      redirect: 'follow',
      headers: { 'user-agent': UA_NAVIGATEUR },
      signal: AbortSignal.timeout(15000)
    })
    if (!page.ok) return []

    // Sans ces cookies, /api/shorturlinfo répond « need verify_v2 ».
    const cookies = typeof page.headers.getSetCookie === 'function'
      ? page.headers.getSetCookie().map(entete => entete.split(';')[0]).join('; ')
      : ''
    const html = await page.text()
    const jetonPage = (new URL(page.url).searchParams.get('surl') || html.match(/"shorturl"\s*:\s*"([A-Za-z0-9_-]+)"/)?.[1] || '').trim()
    // Le jeton du chemin porte déjà son « 1 » ; celui exposé par la page
    // redirigée en est privé → on retente avec le « 1 » rétabli.
    const jetons = [...new Set([jeton, jetonPage, `1${jeton}`, jetonPage ? `1${jetonPage}` : ''].filter(Boolean))]

    for (const candidat of jetons) {
      for (const hote of ['www.1024terabox.com', 'www.terabox.com']) {
        try {
          const reponse = await fetch(`https://${hote}/api/shorturlinfo?shorturl=${encodeURIComponent(candidat)}&root=1`, {
            headers: { 'cookie': cookies, 'referer': page.url, 'user-agent': UA_NAVIGATEUR },
            signal: AbortSignal.timeout(12000)
          })
          if (!reponse.ok) continue
          const donnees = await reponse.json() as { errno?: number, list?: Array<Record<string, unknown>> }
          if (donnees.errno !== 0 || !Array.isArray(donnees.list)) continue

          const fichiers: FichierTerabox[] = []
          for (const brut of donnees.list) {
            if (String(brut.isdir) === '1') continue
            const nom = String(brut.server_filename || brut.filename || '').trim()
            if (!nom) continue
            fichiers.push({
              nom,
              taille: Number(brut.size) || 0,
              estImage: /\.(?:jpe?g|png|webp|gif|bmp|avif|heic)$/i.test(nom) || String(brut.category) === '3',
              estVideo: /\.(?:mp4|webm|mov|m4v|mkv|avi)$/i.test(nom),
              apercu: extraireApercuTerabox(brut.thumbs)
            })
          }

          if (cacheListingTerabox.size >= 200) {
            const plusAncien = cacheListingTerabox.keys().next().value
            if (plusAncien !== undefined) cacheListingTerabox.delete(plusAncien)
          }
          cacheListingTerabox.set(jeton, { fichiers, expiration: Date.now() + TTL_LISTING_TERABOX })
          return fichiers
        } catch {
          continue
        }
      }
    }

    return []
  } catch {
    return []
  }
}

/**
 * Un partage Terabox ne donne jamais d'URL de fichier exploitable côté
 * serveur (téléchargement protégé par « verify_v2 »). On renvoie donc la
 * valeur telle quelle : le lecteur propose un lien sortant plutôt qu'un flux
 * cassé (voir VideoEmbed.vue).
 */
async function resolveTeraboxDirectUrls(value: string): Promise<string[]> {
  // Terabox protège le téléchargement par une vérification anti-robot
  // (« share/download » → {"errno":400310,"errmsg":"need verify_v2"}, mesuré).
  // Aucune URL de fichier n'est donc exploitable côté serveur : renvoyer un
  // flux inexistant serait pire qu'un lien sortant. On rend la valeur telle
  // quelle ; VideoEmbed.vue propose alors « Ouvrir sur Terabox ».
  return [value]
}

export async function resolvePublicVideoUrls(value: string) {
  try {
    const url = new URL(value.trim())
    const host = url.hostname.replace(/^www\./, '').toLowerCase()
    if (host === 'pcloud.com' || host.endsWith('.pcloud.com') || host === 'u.pcloud.link') {
      return resolvePcloudDirectUrls(value, /\.(?:mp4|webm|mov|m4v)(?:\?|$)/i)
    }
    if (estHoteTerabox(host)) {
      return resolveTeraboxDirectUrls(value)
    }
  } catch {
    return [value]
  }

  return [value]
}

/** Média vidéo prêt à être enregistré dans la galerie. */
export type MediaVideoImporte = {
  url: string
  sourceUrl: string | null
  mediaType: 'VIDEO' | 'YOUTUBE_VIDEO'
  youtubeId: string | null
}

/**
 * Transforme des liens vidéo collés (ou lus dans un tableur) en médias de
 * galerie. Centralisé ici pour que l'import d'événements, l'import en masse et
 * la réparation d'import se comportent TOUS pareil.
 *
 * RÈGLE pCloud : un publink pCloud peut désigner un DOSSIER contenant
 * plusieurs vidéos. On crée donc un média PAR FICHIER et on stocke le publink
 * (stable) + le nom du fichier (« …#f=nom.mp4 »), jamais le lien direct
 * (lié à l'IP du demandeur → HTTP 410 en production). Le proxy re-résout le
 * publink à l'affichage et sert le fichier correspondant au nom.
 *
 * RÈGLE Terabox : le partage ne donne AUCUNE URL de fichier exploitable
 * (téléchargement protégé par « verify_v2 »), donc on enregistre le lien tel
 * quel et VideoEmbed propose « Ouvrir sur Terabox ».
 *
 * Retourne aussi les erreurs, pour que l'appelant les remonte à l'écran au
 * lieu d'insérer un média mort en silence.
 */
export async function preparerMediasVideo(valeurs: string[]) {
  const medias: MediaVideoImporte[] = []
  const erreurs: string[] = []

  for (const valeur of [...new Set(valeurs.map(v => v.trim()).filter(Boolean))]) {
    const video = parseVideoUrl(valeur)
    if (!video) {
      erreurs.push(`Vidéo non supportée : ${valeur}`)
      continue
    }

    if (video.provider !== 'pcloud') {
      medias.push({
        url: video.url,
        sourceUrl: null,
        mediaType: video.provider === 'youtube' ? 'YOUTUBE_VIDEO' : 'VIDEO',
        youtubeId: video.provider === 'youtube' ? video.id : null
      })
      continue
    }

    // Lien de téléchargement direct pCloud (déjà un fichier) : rien à résoudre.
    if (!/[?&]code=/.test(valeur) && /\.(?:mp4|webm|mov|m4v)(?:\?|$)/i.test(valeur)) {
      medias.push({ url: valeur, sourceUrl: null, mediaType: 'VIDEO', youtubeId: null })
      continue
    }

    const directes = (await resolvePublicVideoUrls(valeur)).filter(url => url !== valeur)
    if (!directes.length) {
      erreurs.push(`Aucune vidéo trouvée dans le dossier pCloud : ${valeur}`)
      continue
    }
    for (const directe of directes) {
      medias.push({
        url: urlSourcePcloud(valeur, directe),
        sourceUrl: valeur,
        mediaType: 'VIDEO',
        youtubeId: null
      })
    }
  }

  return { medias, erreurs }
}

// Un import en masse résout plusieurs dossiers pCloud en parallèle, et
// pCloud limite alors temporairement le débit : un dossier valide peut
// revenir vide. Mesuré sur test.xlsx : 1 dossier vide sur 15 la première
// fois, 4 sur 15 la seconde. On retente donc une fois avant d'abandonner,
// au lieu de signaler à tort « aucune image récupérée ».
export async function discoverPublicImageUrls(value: string) {
  const premierEssai = await discoverPublicImageUrlsOnce(value)
  if (premierEssai.length) return premierEssai
  await new Promise(resolve => setTimeout(resolve, 900))
  return discoverPublicImageUrlsOnce(value)
}

async function discoverPublicImageUrlsOnce(value: string) {
  try {
    const normalized = normalizePublicMediaUrl(value)
    if (!normalized) return []

    const url = new URL(normalized)
    const host = url.hostname.replace(/^www\./, '').toLowerCase()

    // Terabox : le HTML de la page de partage ne contient AUCUN média, on
    // passe donc par l'API de liste (voir listerPartageTerabox). Les aperçus
    // renvoyés n'ont pas d'extension de fichier : ils ne doivent pas être
    // filtrés par la vérification d'extension faite plus bas.
    if (estHoteTerabox(host)) {
      const fichiers = await listerPartageTerabox(normalized)
      return [...new Set(
        fichiers
          .filter(fichier => fichier.estImage && fichier.apercu)
          .map(fichier => fichier.apercu)
      )].slice(0, 500)
    }

    if (!estDossierPublic(normalized) && !estHotePcloud(normalized)) return []

    const seen = new Set<string>()
    for (const candidate of getPublicFolderCandidates(url)) {
      try {
        const response = await fetch(candidate, { redirect: 'follow', signal: AbortSignal.timeout(10000) })
        if (!response.ok) continue
        const html = await response.text()
        const directImageUrls = await resolvePcloudDirectUrls(candidate, /\.(?:jpe?g|png|webp|gif|bmp|avif)(?:\?|$)/i)
        for (const directImageUrl of directImageUrls) seen.add(directImageUrl)
        const matches = [...new Set([
          ...extractImageUrlsFromHtml(html),
          ...(html.match(imageUrlPattern) || [])
        ])].filter(candidate => !isIgnorableHtmlImageUrl(candidate))
        for (const match of matches) seen.add(match)
        if (seen.size >= 500) break
      } catch {
        continue
      }
    }

    return [...seen]
      .filter(url => !isIgnorableHtmlImageUrl(url))
      .filter(url => /\.(?:jpe?g|png|webp|gif|bmp|avif)(?:\?|$)/i.test(url))
      .slice(0, 500)
  } catch {
    return []
  }
}

/** Noms canoniques des mois (sans accent, sans point). */
const MOIS_FR = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre']

/**
 * Index (0-11) d'un mois écrit en français. Insensible à la casse, aux
 * accents et aux points : « Février », « fevrier » et « févr. » donnent
 * tous 1 ; « août » et « aout » donnent tous 7.
 * Renvoie -1 si le nom n'est pas un mois reconnu.
 */
export function indexMoisFr(nom: string | undefined | null): number {
  if (!nom) return -1
  const cle = nom
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, '')
  return MOIS_FR.indexOf(cle)
}

function parseDateString(value: string): Date | null {
  const normalized = value.trim()
  if (!normalized) return null

  const direct = new Date(normalized)
  if (!Number.isNaN(direct.getTime())) return direct

  // Numéro de série Excel (« 45751 » = jours depuis le 30/12/1899).
  // Beaucoup de feuilles exportent les dates ainsi. On borne à une
  // plage plausible (1990-2100) pour ne pas confondre avec une année.
  if (/^\d{5,6}$/.test(normalized)) {
    const serial = Number(normalized)
    const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000)
    const annee = date.getUTCFullYear()
    if (!Number.isNaN(date.getTime()) && annee >= 1990 && annee <= 2100) return date
  }

  const european = normalized.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
  if (european) {
    const [, day, month, year, hour = '0', minute = '0', second = '0'] = european
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)))
    return date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day) ? date : null
  }

  const textMonth = normalized.match(/^(\d{1,2})\s+(?:au\s+)?(\d{1,2})?\s*([a-zA-ZÀ-ÿ]+)\s+(\d{4})$/i)
  if (textMonth) {
    const [, firstDay, , monthName, year] = textMonth
    const monthIndex = indexMoisFr(monthName)
    if (monthIndex >= 0) {
      const start = new Date(Date.UTC(Number(year), monthIndex, Number(firstDay)))
      return Number.isNaN(start.getTime()) ? null : start
    }
  }

  return null
}

export function parseImportDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000)
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (typeof value !== 'string' || !value.trim()) return null
  const normalized = value.trim()

  const dateRange = normalized.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})\s*[-–—/]\s*(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)
  if (dateRange) {
    const [, startDay, startMonth, startYear] = dateRange
    return parseDateString(`${startDay}/${startMonth}/${startYear}`)
  }

  const textRange = normalized.match(/^(\d{1,2})\s+au\s+(\d{1,2})\s+([a-zA-ZÀ-ÿ]+)\s+(\d{4})$/i)
  if (textRange) {
    const [, firstDay, , monthName, year] = textRange
    return parseDateString(`${firstDay} ${monthName} ${year}`)
  }

  return parseDateString(normalized)
}

export function importEventStatus(status: string, startDate: Date, endDate: Date) {
  const editorialStatus = status.toLowerCase()
  if (editorialStatus === 'cancelled' || editorialStatus === 'postponed') return editorialStatus
  const now = Date.now()
  if (endDate.getTime() <= now) return 'completed'
  if (startDate.getTime() <= now) return 'ongoing'
  return 'upcoming'
}

const imageExtensions = MOTIF_EXTENSION_IMAGE
const imageUrlPattern = new RegExp(`https?:\\/\\/[^\\s"'<>]+\\.${imageExtensions}(?:\\?[^\\s"'<>]*)?`, 'gi')

// ------------------------------------------------------------
// NATURE D'UN LIEN COLLÉ DANS LA ZONE « IMAGES »
//
// POURQUOI : l'import en masse collait TOUT ce qui était dans la zone Images
// en `mediaType='IMAGE'`, sans jamais regarder le lien. Mesuré le 17/09/2026 :
// une vidéo (.mp4 ou une URL YouTube) collée dans la zone Images créait un
// média `IMAGE` dont l'URL n'est pas une image → vignette cassée dans la page
// de modération, sans le moindre message. Inversement un lien manifestement
// non média (PDF, archive…) créait un média mort. Le type est donc déterminé
// par le LIEN, pas par la zone où il a été collé.
//
// La règle elle-même vit désormais dans shared/media-providers.ts
// (`natureLienMedia`), pour que l'aperçu CLIENT et l'import SERVEUR appliquent
// exactement la même liste d'hôtes — c'était le défaut H1/H2 : le composant
// gardait sa propre copie, sans Terabox.
// ------------------------------------------------------------
export type NatureLienImage = 'DOSSIER' | 'IMAGE' | 'VIDEO' | 'INCONNU'

/**
 * Le lien direct répond-il vraiment ?
 *
 * RÈGLE PRUDENTE : on ne refuse que les échecs FRANCS (DNS/refus de connexion,
 * 404, 410, 5xx). Un 401/403/405/429 est accepté : beaucoup de CDN refusent les
 * requêtes automatisées tout en servant l'image au navigateur. Sans cette
 * vérification, un lien mort créait une vignette cassée en silence (mesuré :
 * les 19 liens directs pCloud déjà en base répondent HTTP 410).
 */
export async function lienImageAccessible(value: string): Promise<{ accessible: boolean, statut: number | null }> {
  try {
    const response = await fetch(value, {
      method: 'GET',
      headers: { 'range': 'bytes=0-1', 'user-agent': UA_NAVIGATEUR },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000)
    })
    // On ne consomme pas le corps (certains serveurs ignorent le Range).
    await response.body?.cancel().catch(() => {})
    const statut = response.status
    if (statut === 404 || statut === 410 || statut >= 500) return { accessible: false, statut }
    return { accessible: true, statut }
  } catch {
    return { accessible: false, statut: null }
  }
}

function normalizePublicMediaUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

function getPublicFolderCandidates(value: URL) {
  const host = value.hostname.replace(/^www\./, '').toLowerCase()
  const candidates = [value.toString()]

  if (host === 'drive.google.com' || host === 'docs.google.com') {
    const folderId = value.pathname.match(/\/folders\/([^/?]+)/)?.[1] || value.searchParams.get('id') || value.pathname.match(/\/file\/d\/([^/?]+)/)?.[1]
    if (folderId) {
      candidates.push(`https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}#list`)
      candidates.push(`https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}?usp=sharing`)
    }
  }

  if (host === 'pcloud.com' || host.endsWith('.pcloud.com') || host === 'u.pcloud.link') {
    const sanitized = new URL(value.toString())
    sanitized.searchParams.delete('download')
    candidates.push(sanitized.toString())
  }

  // Terabox n'a pas de variante d'URL : la liste vient de l'API
  // (voir listerPartageTerabox), donc aucun candidat supplémentaire ici.

  return [...new Set(candidates)]
}

function isIgnorableHtmlImageUrl(url: string) {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase()
    const pathname = parsed.pathname.toLowerCase()
    if (host.includes('teraboxcdn.com') || host.includes('teraboxapp.com')) return true
    if (pathname.includes('og-default.png') || pathname.includes('favicon.ico')) return true
    if (host.includes('1024tera.com') || host.includes('1024terabox.com') || host.includes('terabox.com')) {
      return pathname.includes('favicon.ico') || pathname.includes('og-default.png')
    }
  } catch {
    return false
  }
  return false
}

function extractImageUrlsFromHtml(html: string) {
  const discovered = new Set<string>()
  for (const match of html.matchAll(/<img\b[^>]*\bsrc\s*=\s*["'](https?:\/\/[^"']+)["']/gi)) {
    const imageUrl = match[1]
    if (imageUrl && !isIgnorableHtmlImageUrl(imageUrl)) discovered.add(imageUrl.replace(/&amp;/g, '&'))
  }
  for (const match of html.matchAll(/https?:\/\/[^\s"'<>]+/gi)) {
    const candidate = match[0].replace(/&amp;/g, '&')
    if (!isIgnorableHtmlImageUrl(candidate) && new RegExp(`\\.${imageExtensions}(?:\\?|$)`, 'i').test(candidate)) {
      discovered.add(candidate)
    }
  }
  const thumbTemplate = html.match(/https?:\\?\/\\?\/[^"'<>\s]+\/getpubthumb\?code=[^"'<>\s]+/i)?.[0]
  const code = thumbTemplate?.match(/[?&]code=([^&"'<>\s]+)/i)?.[1]
  if (code) {
    const thumbnailHost = thumbTemplate?.match(/^(https?:\\?\/\\?\/[^/]+)/i)?.[1]?.replaceAll('\\/', '/')
    const fileIds = [...html.matchAll(/fileid["'=:\s]+(\d+)/gi)].map(match => match[1]).filter(Boolean)
    for (const fileId of [...new Set(fileIds)]) {
      discovered.add(`${thumbnailHost || 'https://apilux3.pcloud.com'}/getpubthumb?code=${code}&fileid=${fileId}&size=1600x1200&crop=0&type=jpg`)
    }
  }
  return [...discovered].slice(0, 500)
}

// ------------------------------------------------------------
// Les liens pCloud sont liés à l'IP qui les a générés : renvoyer un lien
// direct au navigateur donne une erreur 410 « This link was generated for
// another IP address » → galerie vide en production (alors qu'elle
// fonctionnait en local, où serveur et navigateur partagent l'IP).
// On renvoie donc l'URL de NOTRE proxy : c'est le serveur qui résout et
// télécharge, et le navigateur ne parle jamais à pCloud.
// Bénéfice secondaire : plus aucun appel réseau au moment de la réponse,
// /api/galerie devient instantané.
// ------------------------------------------------------------
export function normalizePublicMediaForResponse(url: string, mediaType: 'IMAGE' | 'VIDEO') {
  if (!url) return url
  try {
    const normalizedUrl = new URL(url)
    const host = normalizedUrl.hostname.replace(/^www\./, '').toLowerCase()
    if (host === 'u.pcloud.link' || host.endsWith('.pcloud.com')) {
      return `/api/media/proxy?url=${encodeURIComponent(url)}&type=${mediaType}`
    }
    if (estHoteTerabox(host)) {
      // Deux cas très différents :
      //  - URL d'APERÇU (data.1024terabox.com/thumbnail/…) : publique, vérifiée
      //    sans cookie et avec le Referer du site → on la sert telle quelle, le
      //    navigateur la charge directement (aucun coût serveur).
      //  - lien de PARTAGE (…/s/<jeton>) : c'est une page HTML, pas un média.
      //    On ne peut pas le résoudre côté serveur (Terabox exige « verify_v2 »),
      //    donc on le renvoie tel quel : VideoEmbed affiche alors un lien
      //    sortant « Ouvrir sur Terabox » au lieu d'un lecteur cassé.
      return url
    }
    return url
  } catch {
    return url
  }
}
