import prisma from '../../utils/prisma'
import { normalizePublicMediaForResponse } from '../../utils/import-media'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const category = typeof query.category === 'string' ? query.category : undefined
  const mediaType = typeof query.mediaType === 'string' ? query.mediaType : undefined
  const eventId = typeof query.eventId === 'string' ? query.eventId : undefined
  const eventTag = typeof query.eventTag === 'string' ? query.eventTag : undefined
  const year = typeof query.year === 'string' && /^\d{4}$/.test(query.year) ? Number(query.year) : undefined

  const images = await prisma.galleryImage.findMany({
    where: {
      isPublished: true,
      // Un média sans événement ne doit pas apparaître : quand un événement est
      // supprimé, ses médias restent en base (relation onDelete: SetNull) et
      // s'affichaient donc orphelins dans la galerie publique.
      eventId: { not: null },
      ...(category ? { category } : {}),
      ...(mediaType ? { mediaType } : {}),
      ...(eventId ? { eventId } : {}),
      ...(eventTag ? { eventTag } : {}),
      ...(year ? { eventDate: { gte: new Date(`${year}-01-01T00:00:00.000Z`), lt: new Date(`${year + 1}-01-01T00:00:00.000Z`) } } : {})
    },
    orderBy: { createdAt: 'desc' }
  })

  const validImages = images.filter((image) => {
    if (typeof image.url !== 'string') return false
    const normalized = image.url.trim()
    if (!normalized || /^null$/i.test(normalized) || /^undefined$/i.test(normalized)) return false
    if (/^(?:data:|blob:|javascript:|about:)/i.test(normalized)) return false

    try {
      const parsed = new URL(normalized)
      return ['http:', 'https:'].includes(parsed.protocol)
    } catch {
      return false
    }
  })

  return {
    status: 200,
    data: await Promise.all(validImages.map(async (image) => ({
      ...image,
      url: await normalizePublicMediaForResponse(image.url, image.mediaType as 'IMAGE' | 'VIDEO'),
      sourceUrl: image.sourceUrl ? await normalizePublicMediaForResponse(image.sourceUrl, image.mediaType as 'IMAGE' | 'VIDEO') : null
    })))
  }
})
