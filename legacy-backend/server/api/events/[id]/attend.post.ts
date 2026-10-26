import prisma from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const { id } = getRouterParams(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Event ID is required'
    })
  }

  const body = await readBody(event)
  const { action, contactPhone } = body

  if (!['register', 'cancel'].includes(action)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid action'
    })
  }

  if (action === 'register') {
    const eventRecord = await prisma.event.findUnique({
      where: { id },
      include: { _count: { select: { attendees: { where: { status: 'confirmed' } } } } }
    })
    if (!eventRecord) throw createError({ statusCode: 404, statusMessage: 'Événement introuvable' })
    if (eventRecord.status.toLowerCase() === 'cancelled' || eventRecord.date <= new Date()) {
      throw createError({ statusCode: 409, statusMessage: 'Les inscriptions sont fermées pour cet événement.' })
    }
    if (eventRecord.capacity !== null && eventRecord._count.attendees >= eventRecord.capacity) {
      throw createError({ statusCode: 409, statusMessage: 'Cet événement est complet.' })
    }
    if (!eventRecord.isFree && (!contactPhone || !/^[+0-9 ()-]{6,30}$/.test(contactPhone))) {
      throw createError({ statusCode: 400, statusMessage: 'Un numéro de téléphone est requis pour le paiement.' })
    }
    const booking = await prisma.booking.upsert({
      where: { userId_eventId: { userId: user.id, eventId: id } },
      create: { userId: user.id, eventId: id, participantName: user.pseudo, contactPhone: contactPhone || null },
      update: { status: 'confirmed', participantName: user.pseudo, contactPhone: contactPhone || null }
    })

    setResponseStatus(event, 201)
    return {
      status: 201,
      message: 'Inscription à l\'événement réussie',
      data: {
        booking,
        paymentRequired: !eventRecord.isFree,
        paymentInstructions: eventRecord.isFree ? null : eventRecord.paymentInstructions,
        price: eventRecord.price
      }
    }
  }

  await prisma.booking.deleteMany({ where: { eventId: id, userId: user.id } })
  return {
    status: 200,
    message: 'Inscription annulée'
  }
})
