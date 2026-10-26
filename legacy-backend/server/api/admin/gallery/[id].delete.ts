import prisma from '../../../utils/prisma'
import { requireEventManager } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireEventManager(event, ['moderation'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Image introuvable' })

  await prisma.galleryImage.delete({ where: { id } })
  return { status: 200, message: 'Image retirée de la galerie' }
})
