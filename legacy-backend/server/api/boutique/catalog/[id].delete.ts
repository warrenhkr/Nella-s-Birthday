import prisma from '../../../utils/prisma'
import { requireShopManager } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireShopManager(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Produit invalide' })

  try {
    await prisma.product.delete({ where: { id } })
  } catch {
    throw createError({
      statusCode: 409,
      statusMessage: 'Ce produit est lié à une commande et ne peut pas être supprimé.'
    })
  }
  return { status: 200, message: 'Produit supprimé' }
})
