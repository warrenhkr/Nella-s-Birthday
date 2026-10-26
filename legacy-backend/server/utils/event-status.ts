type EventStatusInput = {
  date: Date
  endDate: Date | null
  status: string
  capacity: number | null
  attendeeCount: number
}

export function getEventStatus(input: EventStatusInput) {
  const normalizedStatus = input.status.toLowerCase()
  if (normalizedStatus === 'cancelled' || normalizedStatus === 'annulé') return 'cancelled'
  if (normalizedStatus === 'postponed' || normalizedStatus === 'reporté' || normalizedStatus === 'reporte') return 'postponed'
  const now = Date.now()
  if (input.endDate && input.endDate.getTime() <= now) return 'completed'
  if (input.date.getTime() > now) {
    if (input.capacity !== null && input.attendeeCount >= input.capacity) return 'full'
    return 'upcoming'
  }
  if (input.endDate && input.date.getTime() <= now && input.endDate.getTime() > now) return 'ongoing'
  return 'completed'
}

export function getEventStatusLabel(status: string) {
  return {
    upcoming: 'À venir',
    ongoing: 'En cours',
    completed: 'Terminé',
    full: 'Complet',
    cancelled: 'Annulé',
    postponed: 'Reporté'
  }[status] || status
}
