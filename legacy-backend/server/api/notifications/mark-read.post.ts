import prisma from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody(event) as { ids?: string[], all?: boolean }
  const ids = Array.isArray(body?.ids) ? body.ids : []

  // Deux modes :
  //  - `all: true` : marque TOUTES les notifications non lues de l'utilisateur
  //    (bouton « Tout marquer comme lu » et fermeture automatique).
  //  - `ids: [...]` : marque uniquement la sélection.
  if (!body?.all && !ids.length) {
    return { status: 400, message: 'No ids provided' }
  }

  const { count } = await prisma.notification.updateMany({
    where: body.all
      ? { userId: user.id, isRead: false }
      : { id: { in: ids }, userId: user.id },
    data: { isRead: true }
  })

  return { status: 200, message: 'Marked read', data: { updated: count } }
})
