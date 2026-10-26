import prisma from '../../../utils/prisma'
import { requireShopManager } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireShopManager(event)
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      items: true,
      user: { select: { id: true, pseudo: true, email: true } }
    }
  })

  return { status: 200, data: orders }
})