import { z } from 'zod'
import prisma from '../../utils/prisma'
import { requireEventManager } from '../../utils/auth'
import { normalizeEventTypes } from '../../utils/event-types'
import { enforceRateLimit } from '../../utils/rate-limit'
import { classifierLienImage, discoverPublicImageUrls, importEventStatus, indexMoisFr, isPublicFolderUrl, parseImportDate, parseVideoUrl, preparerMediasVideo, urlImageDepuisDossier } from '../../utils/import-media'

const rowSchema = z.object({
  // Messages EN FRANÇAIS : ils sont remontés tels quels dans le rapport d'import
  // (reportCsv + rows[].message) affiché à l'utilisateur et téléchargeable.
  // Avant, le texte par défaut de zod (« Too small: expected string to have >=10
  // characters ») s'y affichait en anglais.
  title: z.string().trim()
    .min(3, 'Le titre doit contenir au moins 3 caractères.')
    .max(100, 'Le titre ne doit pas dépasser 100 caractères.'),
  description: z.string().trim()
    .min(10, 'La description doit contenir au moins 10 caractères.')
    .max(12000, 'La description ne doit pas dépasser 12 000 caractères.'),
  location: z.string().trim().max(255, 'Le lieu ne doit pas dépasser 255 caractères.').default('À préciser'),
  type: z.string().trim()
    .min(1, 'Le type d’événement est obligatoire.')
    .max(255, 'Le type d’événement ne doit pas dépasser 255 caractères.'),
  start_date: z.string().min(1, 'La date de début est obligatoire.'),
  end_date: z.string().min(1, 'La date de fin est obligatoire.'),
  status: z.enum(['upcoming', 'cancelled', 'postponed'], { message: 'Statut inconnu (attendu : upcoming, cancelled ou postponed).' }).default('upcoming'),
  capacity: z.string().regex(/^\d+$/, 'La capacité doit être un nombre entier.').optional().or(z.literal('')),
  price: z.string().regex(/^\d+(\.\d+)?$/, 'Le prix doit être un nombre (ex. 1500 ou 1500.50).').optional().or(z.literal('')),
  is_free: z.enum(['true', 'false'], { message: 'La gratuité doit valoir true ou false.' }).default('true'),
  payment_instructions: z.string().max(5000, 'Les instructions de paiement ne doivent pas dépasser 5 000 caractères.').optional().or(z.literal('')),
  image_url: z.string().url('L’adresse de l’image doit être une URL valide (https://…).').optional().or(z.literal('')),
  photo_urls: z.string().optional().or(z.literal('')),
  youtube_urls: z.string().optional().or(z.literal('')),
  video_urls: z.string().optional().or(z.literal('')),
  folder_urls: z.string().optional().or(z.literal(''))
}).superRefine((value, context) => {
  const startDate = parseImportDate(value.start_date)
  const endDate = parseImportDate(value.end_date)
  if (!startDate) context.addIssue({ code: 'custom', path: ['start_date'], message: 'Date de début illisible : utilisez une date Excel ou JJ/MM/AAAA.' })
  if (!endDate) context.addIssue({ code: 'custom', path: ['end_date'], message: 'Date de fin illisible : utilisez une date Excel ou JJ/MM/AAAA.' })
  if (startDate && endDate && endDate <= startDate) context.addIssue({ code: 'custom', path: ['end_date'], message: 'La fin doit suivre le début.' })
  if (value.is_free === 'false' && (!value.price || Number(value.price) <= 0)) context.addIssue({ code: 'custom', path: ['price'], message: 'Prix obligatoire pour un événement payant.' })
})

function sanitizePrice(value: string | undefined) {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  const digits = trimmed.match(/\d+(?:[.,]\d+)?/)
  if (!digits) return ''
  return digits[0].replace(',', '.')
}

function sanitizeCapacity(value: string | undefined) {
  if (!value) return ''
  const digits = value.trim().match(/\d+/)
  return digits ? digits[0] : ''
}

function parseFlexibleDateRange(rawValue: string | undefined): { start: string, end: string } | null {
  const value = (rawValue ?? '').trim()
  if (!value) return null

  const rangePatterns = [
    /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})\s*[-–—/]\s*(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/,
    /^(\d{1,2})\s+au\s+(\d{1,2})\s+([a-zA-ZÀ-ÿ]+)\s+(\d{4})$/i,
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/
  ]

  for (const pattern of rangePatterns) {
    const match = value.match(pattern)
    if (!match) continue
    if (pattern.source.includes('au')) {
      const [, firstDay, secondDay, monthName, year] = match as RegExpMatchArray
      const monthIndex = indexMoisFr(monthName)
      if (monthIndex >= 0) {
        const start = new Date(Date.UTC(Number(year), monthIndex, Number(firstDay))).toISOString()
        const end = new Date(Date.UTC(Number(year), monthIndex, Number(secondDay || firstDay), 23, 59, 59)).toISOString()
        return { start, end }
      }
    }
    // PIÈGE CORRIGÉ (17/09/2026) : le test était `pattern.source.includes('\d{4}-')`
    // — l'échappement `\d` ayant été perdu, la chaîne valait « d{4}- », ne
    // correspondait JAMAIS, et une date ISO (`2026-09-20`) tombait dans la branche
    // « plage JJ/MM/AAAA/JJ/MM/AAAA » : 3 groupes lus au lieu de 6 → `Date.UTC(NaN)`
    // → `.toISOString()` levait « Invalid time value » et rejetait tout le lot.
    // On identifie désormais le motif par son INDEX : aucune ambiguïté.
    if (pattern === rangePatterns[2]) {
      const [, year, month, day] = match as RegExpMatchArray
      const start = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).toISOString()
      return { start, end: new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 23, 59, 59)).toISOString() }
    }
    const [, firstDay, firstMonth, firstYear, secondDay, secondMonth, secondYear] = match as RegExpMatchArray
    const start = new Date(Date.UTC(Number(firstYear), Number(firstMonth) - 1, Number(firstDay))).toISOString()
    const end = new Date(Date.UTC(Number(secondYear), Number(secondMonth) - 1, Number(secondDay), 23, 59, 59)).toISOString()
    return { start, end }
  }

  const single = parseImportDate(value)
  if (single) {
    const end = new Date(Date.UTC(single.getUTCFullYear(), single.getUTCMonth(), single.getUTCDate(), 23, 59, 59)).toISOString()
    return { start: single.toISOString(), end }
  }

  return null
}

function normalizeIncomingEventRow(row: Record<string, unknown>): Record<string, string> {
  const normalized: Record<string, string> = {}
  for (const [key, value] of Object.entries(row)) {
    const stringValue = typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim()
    normalized[key] = stringValue
  }

  const dateRaw = [normalized.start_date, normalized.startDate, normalized.date, normalized.Date, normalized.eventdate, normalized['Date'], normalized['Date début'], normalized['date debut'], normalized['Date de début'], normalized['date de début']].find(Boolean) || ''
  const range = parseFlexibleDateRange(dateRaw)
  if (range) {
    normalized.start_date = range.start
    normalized.end_date = range.end
  } else {
    normalized.start_date = normalized.start_date || normalized.startDate || normalized.date || normalized.Date || normalized.eventdate || ''
    normalized.end_date = normalized.end_date || normalized.endDate || normalized.start_date || ''
  }

  normalized.location = normalized.location || normalized.lieu || normalized.place || 'À préciser'
  normalized.title = normalized.title || normalized.titre || normalized.name || ''
  normalized.description = normalized.description || normalized.details || normalized['Description'] || ''
  normalized.type = normalized.type || normalized.categorie || normalized.category || 'Divers'
  normalized.price = sanitizePrice(normalized.price || normalized.prix || normalized.Prix) || ''
  normalized.is_free = ['true', 'false'].includes(normalized.is_free || '')
    ? normalized.is_free || 'true'
    : /gratuit|free/i.test(normalized.price || normalized.prix || '') || !normalized.price ? 'true' : 'false'

  if (!normalized.capacity) normalized.capacity = sanitizeCapacity(normalized.capacity || normalized.Participants || normalized.participants || normalized['Participants']) || ''
  if (!normalized.is_free || !['true', 'false'].includes(normalized.is_free)) normalized.is_free = 'true'

  return normalized
}

/** Découpe une saisie multi-liens.
 *
 *  PIÈGE CORRIGÉ (17/09/2026) : la virgule servait de séparateur inconditionnel.
 *  Une URL qui en contient (transformations Cloudinary `…/c_fill,w_800/…`,
 *  paramètres YouTube `…?v=…&list=…`) était donc découpée et rejetée comme
 *  « URL invalide ». La virgule ne coupe plus que si un nouveau lien commence
 *  juste après. */
/** Découpe une saisie multi-liens.
 *
 *  PIÈGE CORRIGÉ (17/09/2026) : la virgule servait de séparateur INCONDITIONNEL.
 *  Une URL qui en contient (transformations Cloudinary `.../c_fill,w_800/...`,
 *  paramètres YouTube) était donc découpée puis rejetée comme « URL invalide ».
 *  Séparateurs retenus : espaces/retours à la ligne, point-virgule, barre
 *  verticale ; la virgule ne coupe QUE si un nouveau lien commence juste après. */
function splitUrls(value: string) {
  return value
    .split(/\s+|;+|\|+/)
    .flatMap(part => part.split(/,\s*(?=https?:\/\/)/i))
    .map(item => item.trim().replace(/[,;|]+$/, ''))
    .filter(Boolean)
}

function mediaErrors(row: z.infer<typeof rowSchema>) {
  const errors: string[] = []
  const imageUrls = [...(row.image_url ? [row.image_url] : []), ...splitUrls(row.photo_urls || '')]
  imageUrls.forEach((url, index) => {
    try {
      const parsed = new URL(url)
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error()
    } catch {
      errors.push(`image ${index + 1}: URL invalide (${url})`)
    }
  })
  const videoUrls = [...splitUrls(row.youtube_urls || ''), ...splitUrls(row.video_urls || '')]
  videoUrls.forEach((url, index) => {
    if (!parseVideoUrl(url)) errors.push(`vidéo ${index + 1}: plateforme ou URL non supportée (${url})`)
  })
  return errors
}

function keyForEventRow(row: { title: string, location: string, start_date: string }) {
  return `${(row.title || '').trim().toLowerCase()}|${(row.location || '').trim().toLowerCase()}|${(row.start_date || '').trim()}`
}

export default defineEventHandler(async (event) => {
  const { user } = await requireEventManager(event, ['evenementiel'])
  enforceRateLimit(event, 'event-bulk-import', 10, 60 * 1000, 'Trop de demandes d’import d’événements. Réessayez plus tard.')

  const body = await readBody<{ events?: Array<Record<string, string>>, sourceFileName?: string, sourceFormat?: string }>(event)
  if (!Array.isArray(body.events) || body.events.length < 1 || body.events.length > 200) {
    throw createError({ statusCode: 400, statusMessage: 'Import invalide : 1 à 200 lignes attendues.' })
  }

  const rows = body.events.map((row, index) => ({ line: index + 2, row: normalizeIncomingEventRow(row) }))
  let batchId: string | null = null
  try {
    const batch = await prisma.importBatch.create({
      data: {
        kind: 'EVENTS',
        filename: body.sourceFileName?.trim().slice(0, 255) || 'import-sans-nom',
        format: body.sourceFormat?.trim().slice(0, 20) || 'unknown',
        status: 'PROCESSING',
        rows: body.events,
        createdById: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    })
    batchId = batch.id
  } catch (error) {
    console.error('[events/bulk] import history unavailable; continuing:', error)
  }
  const invalid: Array<{ line: number, message: string }> = []
  const duplicates: Array<{ line: number, message: string }> = []
  const validRows: Array<{ line: number, parsed: z.infer<typeof rowSchema> }> = []
  const seenInBatch = new Set<string>()
  const safeFailures = new Map<number, string>()

  for (const item of rows) {
    const parsed = rowSchema.safeParse(item.row)
    if (!parsed.success) {
      invalid.push({ line: item.line, message: parsed.error.issues.map(issue => issue.message).join(', ') })
      continue
    }

    const rowMediaErrors = mediaErrors(parsed.data)
    if (rowMediaErrors.length) {
      invalid.push({ line: item.line, message: rowMediaErrors.join(', ') })
      continue
    }

    const key = keyForEventRow(parsed.data)
    if (seenInBatch.has(key)) {
      duplicates.push({ line: item.line, message: `Doublon intra-import sur ${parsed.data.title}` })
      continue
    }

    seenInBatch.add(key)
    validRows.push({ line: item.line, parsed: parsed.data })
  }

  if (!validRows.length) {
    const reportCsv = ['line,status,message', ...rows.map(r => `${r.line},invalid,"${(invalid.find(i => i.line === r.line)?.message || 'Ligne invalide').replace(/"/g, '""')}"`)].join('\n')
    const result = {
      status: 200,
      created: 0,
      duplicates: duplicates.length,
      invalid: invalid.length,
      ignored: invalid.length + duplicates.length,
      total: rows.length,
      reportCsv,
      rows: [
        ...invalid.map(item => ({ line: item.line, status: 'invalid' as const, message: item.message })),
        ...duplicates.map(item => ({ line: item.line, status: 'duplicate' as const, message: item.message }))
      ]
    }
    if (batchId) {
      try {
        await prisma.importBatch.update({ where: { id: batchId }, data: { status: 'REVIEW', report: result } })
      } catch (error) {
        console.error('[events/bulk] unable to save review report:', error)
      }
    }
    return { ...result, batchId }
  }

  const created = await prisma.$transaction(async (transaction) => {
    const result: Array<{ line: number, status: 'created', message: string, eventId: string, row: z.infer<typeof rowSchema> }> = []
    let mediaCreated = 0

    for (const item of validRows) {
      try {
        const row = item.parsed
        const startDate = parseImportDate(row.start_date)
        const endDate = parseImportDate(row.end_date)
        if (!startDate || !endDate) {
          safeFailures.set(item.line, 'Dates de début ou de fin invalides.')
          continue
        }

        const existing = await transaction.event.findFirst({
          where: {
            title: row.title,
            place: row.location,
            date: startDate
          }
        })

        const createdEvent = existing || await transaction.event.create({ data: {
          title: row.title,
          description: row.description,
          place: row.location,
          pole: normalizeEventTypes(row.type),
          date: startDate,
          endDate,
          status: importEventStatus(row.status, startDate, endDate),
          capacity: row.capacity ? Number(row.capacity) : null,
          price: row.is_free === 'true' ? 0 : Number(row.price || 0),
          isFree: row.is_free === 'true',
          paymentInstructions: row.payment_instructions || null,
          imageUrl: row.image_url && !isPublicFolderUrl(row.image_url) ? row.image_url : undefined,
          organizerId: user.id
        } })

        if (existing && row.image_url && !isPublicFolderUrl(row.image_url) && existing.imageUrl !== row.image_url) {
          await transaction.event.update({ where: { id: existing.id }, data: { imageUrl: row.image_url } })
        }

        const directPhotoUrls = [...(row.image_url ? [row.image_url] : []), ...splitUrls(row.photo_urls || '')]
        // Doublons possibles : le client place déjà les dossiers déduits de
        // image_url dans folder_urls, et on rajoute image_url ici → la même
        // URL de dossier pouvait être résolue DEUX FOIS dans le même import,
        // ce qui créait chaque photo en double. On déduplique à la source.
        const folderUrls = [...new Set([
          ...splitUrls(row.folder_urls || ''),
          // PIÈGE CORRIGÉ (17/09/2026) : ce filtre était une regex locale
          // /drive|docs|pcloud|pcloud.link/ — Terabox en était ABSENT, donc un
          // partage Terabox collé dans photo_urls/image_url restait dans
          // photoUrls et créait un média IMAGE dont l'URL est une PAGE HTML
          // (vignette morte, aucun message). Preuve en base avant correction :
          // 2 lignes de gallery_images (mediaType IMAGE, isPublished true,
          // eventId cmtz025d4000104kxcqveh788) portaient
          // https://1024terabox.com/s/1Gos5U_4mEpThLjWffO1tPg et
          // .../s/1nBesAPNXXVJWYpRKpacPZg.
          // On délègue à la règle PARTAGÉE (shared/media-providers.ts), qui
          // couvre Google Drive, pCloud ET Terabox : une seule vérité.
          ...directPhotoUrls.filter(url => isPublicFolderUrl(url))
        ])]
        const folderCandidates = new Set(folderUrls)
        const photosRestantes = directPhotoUrls.filter(url => !folderCandidates.has(url))
        // MÊME RÈGLE QUE LA GALERIE : la nature du lien décide, pas la colonne.
        // Une vidéo (YouTube, pCloud, Terabox…) collée dans image_url/photo_urls
        // part dans le pipeline vidéo au lieu de créer un média IMAGE dont
        // l'URL n'est pas une image (vignette cassée, aucun message).
        const photoUrls = photosRestantes.filter(url => classifierLienImage(url) !== 'VIDEO')
        const videosDepuisColonnesImages = photosRestantes.filter(url => classifierLienImage(url) === 'VIDEO')
        const videoUrls = [
          ...splitUrls(row.youtube_urls || ''),
          ...splitUrls(row.video_urls || ''),
          ...videosDepuisColonnesImages
        ]
        // Un publink pCloud peut désigner un DOSSIER de vidéos :
        // preparerMediasVideo en fait un média par fichier (publink + nom), et
        // n'insère rien pour un lien inexploitable au lieu de créer un média mort.
        const { medias: videosImportees } = await preparerMediasVideo(videoUrls)

        const media = [
          ...photoUrls.map(url => ({ title: row.title, url, mediaType: 'IMAGE', youtubeId: null, category: normalizeEventTypes(row.type), eventDate: startDate, eventTag: normalizeEventTypes(row.type), eventId: createdEvent.id, isPublished: false })),
          ...videosImportees.map(video => ({ title: row.title, url: video.url, sourceUrl: video.sourceUrl, mediaType: video.mediaType, youtubeId: video.youtubeId, category: normalizeEventTypes(row.type), eventDate: startDate, eventTag: normalizeEventTypes(row.type), eventId: createdEvent.id, isPublished: false }))
        ]

        if (media.length) {
          const existingMedia = await transaction.galleryImage.findMany({
            where: { eventId: createdEvent.id, url: { in: media.map(item => item.url) } },
            select: { url: true }
          })
          const existingUrls = new Set(existingMedia.map(item => item.url))
          // Déduplication DANS le lot : createMany insère tout ce qu'on lui
          // donne, y compris deux fois la même URL.
          const dejaVusLot = new Set<string>()
          const newMedia = media.filter((item) => {
            if (existingUrls.has(item.url) || dejaVusLot.has(item.url)) return false
            dejaVusLot.add(item.url)
            return true
          })
          if (newMedia.length) {
            await transaction.galleryImage.createMany({ data: newMedia })
            mediaCreated += newMedia.length
          }
        }

        result.push({ line: item.line, status: 'created', message: existing ? `Médias synchronisés : ${row.title}` : `Créé : ${row.title}`, eventId: createdEvent.id, row })
      } catch (error) {
        console.error(`[events/bulk] failed row ${item.line}:`, error)
        safeFailures.set(item.line, 'Ligne rejetée pendant la création de l’événement ou des médias.')
      }
    }

    return { rows: result, mediaCreated }
  }, { timeout: 180_000, maxWait: 20_000 })

  const folderWarnings: string[] = []
  for (const createdEvent of created.rows) {
    const directPhotoUrls = [...(createdEvent.row.image_url ? [createdEvent.row.image_url] : []), ...splitUrls(createdEvent.row.photo_urls || '')]
    const folderUrls = [...splitUrls(createdEvent.row.folder_urls || ''), ...directPhotoUrls.filter(url => isPublicFolderUrl(url))]
    if (!folderUrls.length) continue

    // On conserve l'origine de chaque image : un dossier peut contenir
    // plusieurs photos, et il faut savoir de QUEL publink chacune vient
    // pour pouvoir la re-résoudre à l'affichage.
    const parDossier = await Promise.all(folderUrls.map(async (folderUrl) => {
      try {
        const fichiers = await discoverPublicImageUrls(folderUrl)
        return fichiers.map(fichier => ({ fichier, dossier: folderUrl }))
      } catch {
        return []
      }
    }))
    const discoveredFolderImages = parDossier.flat()
    if (!discoveredFolderImages.length) {
      // Un dossier pCloud peut ne contenir QUE des vidéos : dans ce cas
      // « 0 image » est parfaitement normal. On n'avertit donc que si la
      // ligne n'annonce aucune vidéo non plus, sinon le rapport d'import
      // affichait de fausses alertes à chaque import.
      const aDesVideos = Boolean(String(createdEvent.row.video_urls || '').trim())
      if (!aDesVideos) {
        folderWarnings.push(`Aucune image récupérée depuis le dossier de la ligne ${createdEvent.line}.`)
      }
      continue
    }

    const media = discoveredFolderImages.map(({ fichier, dossier }) => ({
      title: createdEvent.row.title,
      // pCloud ne fournit que des liens directs liés à l'IP du demandeur :
      // on stocke le publink (stable) + le nom du fichier, et le proxy
      // re-résout au moment de l'affichage. POUR LES AUTRES DOSSIERS (Terabox,
      // Google Drive) l'URL découverte est publiée TELLE QUELLE : appliquer
      // urlSourcePcloud à un dossier Terabox produisait
      // « https://1024terabox.com/s/<jeton>#f=<vignette> », que plus rien ne
      // sait re-résoudre (défaut H4).
      url: urlImageDepuisDossier(dossier, fichier),
      mediaType: 'IMAGE',
      youtubeId: null,
      category: normalizeEventTypes(createdEvent.row.type),
      eventDate: parseImportDate(createdEvent.row.start_date),
      eventTag: normalizeEventTypes(createdEvent.row.type),
      eventId: createdEvent.eventId,
      // Média importé = EN ATTENTE de validation (le tableau de bord de
      // modération l'approuve ensuite) : sans ce champ, le défaut de la base
      // (true) publiait l'image sur la galerie publique sans contrôle.
      isPublished: false
    }))
    try {
      const existingMedia = await prisma.galleryImage.findMany({
        where: { eventId: createdEvent.eventId, url: { in: media.map(item => item.url) } },
        select: { url: true }
      })
      const existingUrls = new Set(existingMedia.map(item => item.url))
      // Déduplication DANS le lot : createMany insère tout ce qu'on lui
      // donne, y compris deux fois la même URL.
      const dejaVus = new Set<string>()
      const newMedia = media.filter((item) => {
        if (existingUrls.has(item.url) || dejaVus.has(item.url)) return false
        dejaVus.add(item.url)
        return true
      })
      if (newMedia.length) {
        await prisma.galleryImage.createMany({ data: newMedia })
        created.mediaCreated += newMedia.length
      }
      const premier = discoveredFolderImages[0]
      if (createdEvent.row.image_url && isPublicFolderUrl(createdEvent.row.image_url) && premier) {
        await prisma.event.update({ where: { id: createdEvent.eventId }, data: { imageUrl: urlImageDepuisDossier(premier.dossier, premier.fichier) } })
      }
    } catch (error) {
      console.error('[events/bulk] folder media persistence failed:', error)
      folderWarnings.push(`Images du dossier de la ligne ${createdEvent.line} non enregistrées dans la galerie.`)
    }
  }

  for (const [line, message] of safeFailures.entries()) {
    invalid.push({ line, message })
  }

  const reportRows = [
    ...invalid.map(item => ({ line: item.line, status: 'invalid' as const, message: item.message })),
    ...duplicates.map(item => ({ line: item.line, status: 'duplicate' as const, message: item.message })),
    ...created.rows.map(item => ({ line: item.line, status: item.status, message: item.message })),
    ...folderWarnings.map((message, index) => ({ line: 0 - index, status: 'invalid' as const, message }))
  ].sort((a, b) => a.line - b.line)

  const reportCsv = [
    'line,status,message',
    ...reportRows.map(row => `${row.line},${row.status},"${String(row.message).replace(/"/g, '""')}"`)
  ].join('\n')

  const result = {
    status: 201,
    created: created.rows.length,
    mediaCreated: created.mediaCreated,
    duplicates: duplicates.length,
    invalid: invalid.length,
    ignored: invalid.length + duplicates.length,
    total: rows.length,
    reportCsv,
    rows: reportRows
  }
  if (batchId) {
    try {
      await prisma.importBatch.update({ where: { id: batchId }, data: { status: 'COMPLETED', report: result } })
    } catch (error) {
      console.error('[events/bulk] unable to save completion report:', error)
    }
  }
  // 201 CREATED seulement quand au moins une ligne a réellement été créée
  // (sinon 200 : rien n'a été créé). Avant, le corps annonçait 201 mais la
  // réponse HTTP restait toujours 200 : contrat ambigu et tests cassés.
  setResponseStatus(event, result.created > 0 ? 201 : 200)
  return { ...result, batchId }
})
