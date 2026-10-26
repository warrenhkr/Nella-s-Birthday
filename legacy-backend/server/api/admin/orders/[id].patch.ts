import { OrderStatusSchema } from '../../../schemas/index'
import prisma from '../../../utils/prisma'
import { requireShopManager } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  // Même règle que /api/boutique/orders/:id : gestionnaire boutique + super-admin.
  await requireShopManager(event)
  const id = getRouterParam(event, 'id')
  const parsed = OrderStatusSchema.safeParse((await readBody(event)).status)

  if (!id || !parsed.success) throw createError({ statusCode: 400, statusMessage: 'Statut de commande invalide' })

  const newStatus = parsed.data

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

    // Annulation : restitution du stock (idempotent grâce à l'ancien statut).
    if (newStatus === 'CANCELLED' && existing.status !== 'CANCELLED') {
      for (const item of existing.items) {
        await transaction.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } }
        })
      }
    }

    // Réactivation d'une commande annulée : redébit du stock si disponible.
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
