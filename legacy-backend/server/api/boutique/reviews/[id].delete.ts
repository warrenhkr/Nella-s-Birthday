import prisma from '../../../utils/prisma'
import { requireShopManager } from '../../../utils/auth'

// Retrait d'un avis abusif par le gestionnaire boutique. La lecture publique des
// avis reste ouverte (products/[id]/reviews.get.ts) ; seule la suppression est
// réservée à requireShopManager.
export default defineEventHandler(async (event) => {
  await requireShopManager(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Avis invalide' })

  const review = await prisma.productReview.findUnique({ where: { id }, select: { id: true } })
  if (!review) throw createError({ statusCode: 404, statusMessage: 'Avis introuvable' })

  await prisma.productReview.delete({ where: { id } })
  return { status: 200, message: 'Avis supprimé' }
})
