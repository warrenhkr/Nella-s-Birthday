import { requireEventManager } from '../../../utils/auth'
import prisma from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireEventManager(event, ['evenementiel'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Import introuvable.' })
  await prisma.importBatch.delete({ where: { id } })
  return { status: 200 }
})
