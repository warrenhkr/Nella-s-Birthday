import prisma from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const productId = getRouterParam(event, 'id')
  if (!productId) throw createError({ statusCode: 400, statusMessage: 'Produit invalide' })

  const reviews = await prisma.productReview.findMany({
    where: { productId },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { pseudo: true } } }
  })
  return { status: 200, data: reviews }
})
