import { BulkOrderCreateSchema } from '../../schemas/index'
import prisma from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const parsed = BulkOrderCreateSchema.safeParse(await readBody(event))

  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Validation error', data: parsed.error.flatten() })
  }

  const productIds = parsed.data.items.map(item => item.productId)
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } })
  const productMap = new Map(products.map(product => [product.id, product]))
  const quantities = new Map<string, number>()
  for (const item of parsed.data.items) {
    quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity)
  }

  const items = parsed.data.items.map((item) => {
    const product = productMap.get(item.productId)
    if (!product) throw createError({ statusCode: 404, statusMessage: 'Produit introuvable' })
    return { productId: product.id, name: product.name, unitPrice: product.price, quantity: item.quantity }
  })
  const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const order = await prisma.$transaction(async (transaction) => {
    for (const [productId, quantity] of quantities) {
      const updated = await transaction.product.updateMany({
        where: { id: productId, stock: { gte: quantity } },
        data: { stock: { decrement: quantity } }
      })
      if (updated.count !== 1) {
        throw createError({ statusCode: 409, statusMessage: 'Stock insuffisant pour un ou plusieurs produits' })
      }
    }

    return transaction.order.create({
      data: {
        userId: user.id,
        customerName: parsed.data.customerName,
        phone: parsed.data.phone,
        deliveryNote: parsed.data.deliveryNote,
        total,
        items: { create: items }
      },
      include: { items: true }
    })
  })

  // Create notifications for shop managers and super-admin
  try {
    const managers = await prisma.user.findMany({ where: { role: { in: ['SUPER_ADMIN', 'SHOP_MANAGER'] }, isActive: true }, select: { id: true } })
    if (managers.length) {
      await prisma.notification.createMany({
        data: managers.map(m => ({
          userId: m.id,
          title: 'Nouvelle commande',
          body: `Commande ${order.id} de ${order.customerName} (${order.total} FCFA)`,
          type: 'order'
        }))
      })
    }

    // Notify the customer
    await prisma.notification.create({
      data: {
        userId: user.id,
        title: 'Commande reçue',
        body: `Ta commande ${order.id} a bien été reçue. Total: ${order.total} FCFA`,
        type: 'order'
      }
    })
  } catch (e) {
    // notifications are best-effort; log and continue
    console.warn('Failed to create notifications for order', order.id, e)
  }

  setResponseStatus(event, 201)
  return { status: 201, message: 'Commande envoyée', data: order }
})
