import prisma from '../../utils/prisma'
import { requireShopManager } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireShopManager(event)
  return {
    status: 200,
    data: (await prisma.product.findMany({ orderBy: { createdAt: 'desc' } })).map(product => ({
      ...product,
      imageUrls: Array.isArray(product.imageUrls) ? product.imageUrls : product.imageUrl ? [product.imageUrl] : []
    }))
  }
})
