import prisma from '../../utils/prisma'
import { getEventStatus, getEventStatusLabel } from '../../utils/event-status'
import { toEventTypeLabel } from '../../utils/event-types'
import { requireAuth } from '../../utils/auth'
import { normalizePublicMediaForResponse } from '../../utils/import-media'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const { id } = getRouterParams(event)
  const item = await prisma.event.findUnique({
    where: { id },
    include: {
      _count: { select: { attendees: { where: { status: 'confirmed' } } } },
      attendees: user ? { where: { userId: user.id }, select: { id: true, status: true } } : false,
      galleryMedia: {
        where: { isPublished: true },
        orderBy: { createdAt: 'desc' }
      }
    }
  })

  if (!item) throw createError({ statusCode: 404, statusMessage: 'Événement introuvable' })
  const linkedMedia = item.galleryMedia.length
    ? item.galleryMedia
    : await prisma.galleryImage.findMany({
        where: {
          isPublished: true,
          title: item.title,
          eventDate: { gte: new Date(item.date.getTime() - 86400000), lte: new Date(item.date.getTime() + 86400000) }
        },
        orderBy: { createdAt: 'asc' }
      })
  const statusCode = getEventStatus({
    date: item.date,
    endDate: item.endDate,
    status: item.status,
    capacity: item.capacity,
    attendeeCount: item._count.attendees
  })

  const normalizedGalleryMedia = await Promise.all(linkedMedia.map(async (media) => ({
    id: media.id,
    title: media.title,
    url: await normalizePublicMediaForResponse(media.url, media.mediaType as 'IMAGE' | 'VIDEO'),
    mediaType: media.mediaType,
    youtubeId: media.youtubeId,
    category: media.category,
    eventDate: media.eventDate
  })))

  const primaryImageUrl = item.imageUrl || linkedMedia.find(media => media.mediaType === 'IMAGE')?.url || null

  return {
    status: 200,
    data: {
      ...item,
      type: toEventTypeLabel(item.pole),
      status: getEventStatusLabel(statusCode),
      statusCode,
      attendeeCount: item._count.attendees,
      registered: Boolean(user && item.attendees?.some(booking => booking.status === 'confirmed')),
      imageUrl: primaryImageUrl ? await normalizePublicMediaForResponse(primaryImageUrl, 'IMAGE') : null,
      galleryMedia: normalizedGalleryMedia
    }
  }
})
