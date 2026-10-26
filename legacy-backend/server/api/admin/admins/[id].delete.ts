import prisma from '../../../utils/prisma'
import { requireSuperAdmin } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const id = getRouterParam(event, 'id')

  if (!id) throw createError({ statusCode: 400, statusMessage: 'Identifiant administrateur requis' })

  const admin = await prisma.user.findFirst({ where: { id, role: { in: ['ADMIN', 'INTERMEDIATE_ADMIN', 'SHOP_MANAGER'] } }, select: { id: true } })
  if (!admin) throw createError({ statusCode: 404, statusMessage: 'Administrateur introuvable' })

  await prisma.user.delete({ where: { id } })
  return { status: 200, message: 'Administrateur supprimé' }
})
