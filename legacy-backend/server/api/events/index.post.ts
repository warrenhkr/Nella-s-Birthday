import { EventCreateSchema } from '../../schemas/index'
import prisma from '../../utils/prisma'
import { toEventTypeLabel } from '../../utils/event-types'
import { getRichTextLength } from '../../utils/rich-text'
import { requireEventManager } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'

export default defineEventHandler(async (event) => {
  const { user } = await requireEventManager(event, ['evenementiel'])
  enforceRateLimit(event, 'event-create', 30, 60 * 1000, 'Trop de créations d’événements. Réessayez plus tard.')

  const body = await readBody(event)

  // Validate input
  const parsed = EventCreateSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: parsed.error.flatten()
    })
  }
  if (getRichTextLength(parsed.data.description) < 10) {
    throw createError({
      statusCode: 400,
      statusMessage: 'La description doit contenir au moins 10 caractères.'
    })
  }

  const eventRecord = await prisma.event.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      date: new Date(parsed.data.start_date),
      endDate: parsed.data.end_date ? new Date(parsed.data.end_date) : null,
      place: parsed.data.location,
      pole: toEventTypeLabel(parsed.data.type || parsed.data.pole),
      imageUrl: parsed.data.image_url,
      status: parsed.data.status,
      capacity: parsed.data.max_attendees ?? null,
      price: parsed.data.is_free ? 0 : (parsed.data.price ?? 0),
      isFree: parsed.data.is_free,
      paymentInstructions: parsed.data.is_free ? null : parsed.data.payment_instructions,
      organizerId: user.id
    }
  })

  return {
    status: 201,
    message: 'Événement créé avec succès',
    data: eventRecord
  }
})
