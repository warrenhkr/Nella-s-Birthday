import { EventCreateSchema } from '../../schemas/index'
import prisma from '../../utils/prisma'
import { toEventTypeLabel } from '../../utils/event-types'
import { getRichTextLength } from '../../utils/rich-text'
import { requireEventManager } from '../../utils/auth'
import { enforceRateLimit } from '../../utils/rate-limit'

export default defineEventHandler(async (event) => {
  await requireEventManager(event, ['evenementiel'])
  enforceRateLimit(event, 'event-update', 30, 60 * 1000, 'Trop de modifications d’événements. Réessayez plus tard.')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Événement invalide.' })

  const parsed = EventCreateSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Informations événementielles invalides.', data: parsed.error.flatten() })
  }
  if (getRichTextLength(parsed.data.description) < 10) {
    throw createError({ statusCode: 400, statusMessage: 'La description doit contenir au moins 10 caractères.' })
  }

  try {
    const updated = await prisma.event.update({
      where: { id },
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
        paymentInstructions: parsed.data.is_free ? null : parsed.data.payment_instructions
      }
    })
    return { status: 200, data: updated }
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Événement introuvable.' })
  }
})
