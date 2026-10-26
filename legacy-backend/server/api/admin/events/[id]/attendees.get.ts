import prisma from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireEventManager(event, ['evenementiel'])
  const { id } = getRouterParams(event)
  const query = getQuery(event)
  const format = query.format === 'names-phones'
    ? 'names-phones'
    : query.format === 'names-txt' ? 'names-txt' : 'names'
  const eventRecord = await prisma.event.findUnique({
    where: { id },
    include: {
      attendees: {
        where: { status: 'confirmed' },
        include: { user: { select: { pseudo: true, email: true } } },
        orderBy: { createdAt: 'asc' }
      }
    }
  })

  if (!eventRecord) throw createError({ statusCode: 404, statusMessage: 'Événement introuvable' })
  const escapeCsv = (value: string) => `"${value.replaceAll('"', '""')}"`
  const header = format === 'names-phones' ? 'Nom;Email;Téléphone' : 'Nom'
  const rows = eventRecord.attendees.map((booking) => {
    const name = booking.participantName || booking.user.pseudo
    if (format === 'names-txt') return name
    if (format === 'names-phones') return [name, booking.user.email, booking.contactPhone || ''].map(escapeCsv).join(';')
    return escapeCsv(name)
  })
  const content = format === 'names-txt' ? rows.join('\r\n') : [header, ...rows].join('\r\n')
  const extension = format === 'names-txt' ? 'txt' : 'csv'
  setHeader(event, 'content-type', `${format === 'names-txt' ? 'text/plain' : 'text/csv'}; charset=utf-8`)
  setHeader(event, 'content-disposition', `attachment; filename="participants-${id}-${format}.${extension}"`)
  return content
})
