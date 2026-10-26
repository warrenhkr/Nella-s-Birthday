import prisma from '../utils/prisma'
import { requireAuth } from '../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  // Source de vérité : le centre de notifications du dashboard ne liste QUE les
  // notifications non lues. Une notification marquée lue ne doit plus jamais
  // réapparaître au prochain chargement / rafraîchissement (sinon elle
  // "persiste" indéfiniment à l'écran).
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id, isRead: false },
    orderBy: { createdAt: 'desc' },
    take: 50
  })

  return { status: 200, data: notifications }
})
