import { requireEventManager } from '../../../../utils/auth'
import prisma from '../../../../utils/prisma'
import { EXTENSIONS_FICHIER_IMAGE, discoverPublicImageUrls, estHotePcloud, isPublicFolderUrl, parseImportDate, preparerMediasVideo, urlSourcePcloud } from '../../../../utils/import-media'
import { normalizeEventTypes } from '../../../../utils/event-types'

function splitUrls(value: string) {
  return value.split(/[|\n,]/).map(item => item.trim()).filter(Boolean)
}

export default defineEventHandler(async (event) => {
  await requireEventManager(event, ['evenementiel'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Import introuvable.' })

  const batch = await prisma.importBatch.findUnique({ where: { id }, select: { rows: true } })
  if (!batch || !Array.isArray(batch.rows)) throw createError({ statusCode: 404, statusMessage: 'Snapshot d’import introuvable.' })

  let repaired = 0
  let merged = 0
  let mediaCreated = 0
  const warnings: string[] = []

  for (const rawRow of batch.rows as Array<Record<string, unknown>>) {
    const title = String(rawRow.title || rawRow.titre || rawRow.name || '').trim()
    const location = String(rawRow.location || rawRow.lieu || rawRow.place || '').trim()
    const startDate = parseImportDate(rawRow.start_date || rawRow.date)
    if (!title || !location || !startDate) continue

    const matches = await prisma.event.findMany({
      where: { title, place: location, date: startDate },
      orderBy: { createdAt: 'asc' },
      select: { id: true, imageUrl: true }
    })
    const canonical = matches[0]
    if (!canonical) continue

    for (const duplicate of matches.slice(1)) {
      await prisma.galleryImage.updateMany({ where: { eventId: duplicate.id }, data: { eventId: canonical.id } })
      await prisma.event.delete({ where: { id: duplicate.id } })
      merged += 1
    }

    const imageInput = String(rawRow.image_url || rawRow.Image_url || rawRow.image || '').trim()
    const photoInputs = splitUrls(String(rawRow.photo_urls || ''))
    const folderInputs = splitUrls(String(rawRow.folder_urls || ''))
    const folderUrls = [...folderInputs, ...[imageInput, ...photoInputs].filter(isPublicFolderUrl)]
    const imageUrls = new Set([imageInput, ...photoInputs].filter(url => url && !isPublicFolderUrl(url)))
    for (const folderUrl of folderUrls) {
      const discovered = await discoverPublicImageUrls(folderUrl)
      if (!discovered.length) warnings.push(`Aucune image récupérée depuis ${title}.`)
      // pCloud ne fournit que des liens directs liés à l'IP du demandeur (HTTP
      // 410 ailleurs) : on enregistre le publink stable + le nom du fichier.
      // L'URL découverte des AUTRES dossiers (aperçus Terabox, Google Drive) est
      // publiée telle quelle — même règle que la galerie (estHotePcloud +
      // extension de fichier), via la constante PARTAGÉE EXTENSIONS_FICHIER_IMAGE.
      // appliquée ici avec le même garde-fou que l'import de galerie (on ne
      // réécrit que les vrais liens de fichier image).
      discovered.forEach(fichier => imageUrls.add(
        estHotePcloud(folderUrl) && EXTENSIONS_FICHIER_IMAGE.test(fichier)
          ? urlSourcePcloud(folderUrl, fichier)
          : fichier
      ))
    }

    const videoInputs = [...splitUrls(String(rawRow.youtube_urls || '')), ...splitUrls(String(rawRow.video_urls || ''))]
    // Même règle que pour les autres imports : un publink pCloud de dossier
    // donne un média par fichier de vidéo (publink + nom). Les liens
    // inexploitables sont remontés en avertissement.
    const { medias: videosImportees, erreurs: erreursVideo } = await preparerMediasVideo(videoInputs)
    warnings.push(...erreursVideo)
    const media = [
      ...[...imageUrls].map(url => ({ title, url, mediaType: 'IMAGE', youtubeId: null, category: normalizeEventTypes(String(rawRow.type || 'culture')), eventDate: startDate, eventTag: normalizeEventTypes(String(rawRow.type || 'culture')), eventId: canonical.id })),
      ...videosImportees.map(video => ({ title, url: video.url, sourceUrl: video.sourceUrl, mediaType: video.mediaType, youtubeId: video.youtubeId, category: normalizeEventTypes(String(rawRow.type || 'culture')), eventDate: startDate, eventTag: normalizeEventTypes(String(rawRow.type || 'culture')), eventId: canonical.id }))
    ]
    const existing = await prisma.galleryImage.findMany({ where: { eventId: canonical.id, url: { in: media.map(item => item.url) } }, select: { url: true } })
    const existingUrls = new Set(existing.map(item => item.url))
    const newMedia = media.filter(item => !existingUrls.has(item.url))
    if (newMedia.length) {
      await prisma.galleryImage.createMany({ data: newMedia })
      mediaCreated += newMedia.length
    }
    const primary = imageInput && !isPublicFolderUrl(imageInput) ? imageInput : [...imageUrls][0]
    if (primary && canonical.imageUrl !== primary) await prisma.event.update({ where: { id: canonical.id }, data: { imageUrl: primary } })
    repaired += 1
  }

  return { status: 200, repaired, merged, mediaCreated, warnings: [...new Set(warnings)] }
})
