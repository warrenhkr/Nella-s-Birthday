import prisma from '../../../utils/prisma'
import { requireShopManager } from '../../../utils/auth'

// Modération des avis : le gestionnaire boutique (et l'admin intermédiaire) voit
// TOUS les avis publiés, tous produits confondus, du plus récent au plus ancien.
export default defineEventHandler(async (event) => {
  await requireShopManager(event)

  const reviews = await prisma.productReview.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { pseudo: true } },
      product: { select: { id: true, name: true } }
    }
  })

  return { status: 200, data: reviews }
})
