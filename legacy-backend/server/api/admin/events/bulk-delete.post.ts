import prisma from '../../../utils/prisma'
import { requireEventManager } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireEventManager(event, ['evenementiel'])

  const body = await readBody<{ ids?: string[] }>(event)
  const ids = Array.isArray(body?.ids) ? body.ids.filter(Boolean) : []

  if (!ids.length) {
    throw createError({ statusCode: 400, statusMessage: 'Aucun événement sélectionné.' })
  }

  const uniqueIds = [...new Set(ids)]
  const { count } = await prisma.event.deleteMany({
    where: {
      id: { in: uniqueIds }
    }
  })

  return {
    status: 200,
    deletedCount: count,
    message: `${count} événement(s) supprimé(s).`
  }
})
