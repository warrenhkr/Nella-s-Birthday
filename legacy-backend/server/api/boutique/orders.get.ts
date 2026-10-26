import prisma from '../../utils/prisma'
import { requireShopManager } from '../../utils/auth'

const orderStatuses = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'] as const

export default defineEventHandler(async (event) => {
  // Les commandes sont réservées au gestionnaire boutique (et au super-admin).
  // Un ADMIN n'a aucun écran de commandes : l'accès UI et l'accès API sont donc alignés.
  const { user } = await requireShopManager(event)
  const status = getQuery(event).status
  // Un statut inconnu faisait échouer la requête Prisma (erreur 500) : on l'ignore.
  const statusFilter = typeof status === 'string' && (orderStatuses as readonly string[]).includes(status)
    ? (status as typeof orderStatuses[number])
    : undefined
  const orders = await prisma.order.findMany({
    where: statusFilter ? { status: statusFilter } : undefined,
    include: { items: true, user: { select: { id: true, pseudo: true, email: true } } },
    orderBy: { createdAt: 'desc' }
  })
  return { status: 200, data: orders, meta: { managerId: user.id } }
})
