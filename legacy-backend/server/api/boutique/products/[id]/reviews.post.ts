import { z } from 'zod'
import prisma from '../../../../utils/prisma'
import { requireAuth } from '../../../../utils/auth'

const ReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional()
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const productId = getRouterParam(event, 'id')
  const parsed = ReviewSchema.safeParse(await readBody(event))
  if (!productId || !parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Avis invalide', data: parsed.success ? undefined : parsed.error.flatten() })
  }

  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } })
  if (!product) throw createError({ statusCode: 404, statusMessage: 'Produit introuvable' })

  const review = await prisma.productReview.upsert({
    where: { productId_userId: { productId, userId: user.id } },
    create: { productId, userId: user.id, rating: parsed.data.rating, comment: parsed.data.comment || null },
    update: { rating: parsed.data.rating, comment: parsed.data.comment || null },
    include: { user: { select: { pseudo: true } } }
  })
  return { status: 200, data: review }
})
