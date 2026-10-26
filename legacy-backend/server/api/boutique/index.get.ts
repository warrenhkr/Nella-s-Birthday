import prisma from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const category = typeof query.category === 'string' ? query.category.toLowerCase() : undefined
  const search = typeof query.search === 'string' ? query.search : undefined
  const products = await prisma.product.findMany({
    where: {
      ...(category ? { category } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } }
            ]
          }
        : {})
    },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { reviews: true } }, reviews: { select: { rating: true } } }
  })

  return {
    status: 200,
    data: products.map(product => ({
      ...product,
      category: product.category.toLowerCase(),
      imageUrls: Array.isArray(product.imageUrls) ? product.imageUrls : product.imageUrl ? [product.imageUrl] : [],
      available: product.stock > 0,
      reviewCount: product._count.reviews,
      averageRating: product.reviews.length
        ? product.reviews.reduce((sum, review) => sum + review.rating, 0) / product.reviews.length
        : null
    }))
  }
})
