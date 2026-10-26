import { z } from 'zod'
import { requireEventManager } from '../../../utils/auth'
import prisma from '../../../utils/prisma'

const schema = z.object({ rows: z.array(z.record(z.string(), z.string())).min(1).max(200) })

export default defineEventHandler(async (event) => {
  await requireEventManager(event, ['evenementiel'])
  const id = getRouterParam(event, 'id')
  const parsed = schema.safeParse(await readBody(event))
  if (!id || !parsed.success) throw createError({ statusCode: 400, statusMessage: 'Révision d’import invalide.' })
  const batch = await prisma.importBatch.update({ where: { id }, data: { rows: parsed.data.rows, status: 'REVIEW' } })
  return { status: 200, data: batch }
})
