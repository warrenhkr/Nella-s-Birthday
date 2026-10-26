import { requireScopedRole } from '../../../utils/auth'
import prisma from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireScopedRole(event, ['communication'], 'intermediate_admin', 'admin')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Publication invalide' })
  }

  const post = await prisma.post.findUnique({ where: { id }, select: { id: true } })
  if (!post) {
    throw createError({ statusCode: 404, statusMessage: 'Publication introuvable' })
  }

  await prisma.post.delete({ where: { id } })
  return { status: 200, message: 'Publication supprimée' }
})
