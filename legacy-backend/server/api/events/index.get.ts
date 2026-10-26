import prisma from '../../utils/prisma'
import { toEventTypeLabel } from '../../utils/event-types'
import { getEventStatus, getEventStatusLabel } from '../../utils/event-status'
import { requireAuth } from '../../utils/auth'
import { normalizePublicMediaForResponse } from '../../utils/import-media'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const query = getQuery(event)
  const pole = typeof query.pole === 'string' && query.pole !== 'tous' ? toEventTypeLabel(query.pole) : undefined
  const status = typeof query.status === 'string' ? query.status : undefined
  const events = await prisma.event.findMany({
    where: {
      ...(pole ? { pole } : {}),
      ...(status ? { status } : {})
    },
    orderBy: { date: 'asc' },
    include: {
      _count: { select: { attendees: { where: { status: 'confirmed' } } } },
      attendees: user ? { where: { userId: user.id }, select: { id: true, status: true } } : false,
      galleryMedia: {
        where: { isPublished: true, mediaType: 'IMAGE' },
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: { url: true }
      }
    }
  })
  const fallbackImages = await prisma.galleryImage.findMany({
    where: {
      isPublished: true,
      mediaType: 'IMAGE',
      title: { in: events.map(item => item.title) }
    },
    select: { eventId: true, title: true, eventDate: true, url: true },
    orderBy: { createdAt: 'asc' }
  })

  return {
    status: 200,
    data: await Promise.all(events.map(async (item) => {
      const fallbackImage = fallbackImages.find(media =>
        media.eventId === item.id ||
        (media.title === item.title && media.eventDate && Math.abs(media.eventDate.getTime() - item.date.getTime()) <= 86400000)
      )
      const imageUrl = item.imageUrl || item.galleryMedia[0]?.url || fallbackImage?.url || null
      return {
      id: item.id,
      title: item.title,
      description: item.description,
      date: item.date,
      place: item.place,
      pole: item.pole,
      imageUrl: imageUrl ? await normalizePublicMediaForResponse(imageUrl, 'IMAGE') : null,
      type: toEventTypeLabel(item.pole),
      status: getEventStatusLabel(getEventStatus({
        date: item.date,
        endDate: item.endDate,
        status: item.status,
        capacity: item.capacity,
        attendeeCount: item._count.attendees
      })),
      statusCode: getEventStatus({
        date: item.date,
        endDate: item.endDate,
        status: item.status,
        capacity: item.capacity,
        attendeeCount: item._count.attendees
      }),
      endDate: item.endDate,
      capacity: item.capacity,
      price: item.price,
      isFree: item.isFree,
      paymentInstructions: item.paymentInstructions,
      attendeeCount: item._count.attendees,
      registered: Boolean(user && item.attendees?.some(booking => booking.status === 'confirmed'))
      }
    }))
  }
})
