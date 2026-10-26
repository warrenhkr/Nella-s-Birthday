import prisma from '../../../utils/prisma'
import { requireShopManager } from '../../../utils/auth'

const statuses = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'] as const

export default defineEventHandler(async (event) => {
  // Les commandes sont réservées au gestionnaire boutique (et au super-admin) :
  // même règle que /api/admin/orders et que le middleware `shop` côté front.
  await requireShopManager(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody<{ status?: string }>(event)

  if (!id || !body.status || !statuses.includes(body.status as typeof statuses[number])) {
    throw createError({ statusCode: 400, statusMessage: 'Statut de commande invalide' })
  }

  const newStatus = body.status as typeof statuses[number]

  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.order.findUnique({
      where: { id },
      include: { items: true }
    })
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Commande introuvable' })

    const order = await transaction.order.update({
      where: { id },
      data: { status: newStatus },
      include: { items: true }
    })

    // Annulation : le stock débité à la création de la commande est restitué.
    // La comparaison avec l'ancien statut rend l'opération idempotente (pas de
    // double restitution si l'annulation est renvoyée plusieurs fois).
    if (newStatus === 'CANCELLED' && existing.status !== 'CANCELLED') {
      for (const item of existing.items) {
        await transaction.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } }
        })
      }
    }

    // Réactivation d'une commande annulée : le stock est redébité si disponible.
    if (existing.status === 'CANCELLED' && newStatus !== 'CANCELLED') {
      for (const item of existing.items) {
        const debited = await transaction.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } }
        })
        if (debited.count !== 1) {
          throw createError({ statusCode: 409, statusMessage: 'Stock insuffisant pour réactiver cette commande' })
        }
      }
    }

    return { status: 200, data: order }
  })
})
