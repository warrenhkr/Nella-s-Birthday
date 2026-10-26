import { requireEventManager } from '../../utils/auth'
import prisma from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireEventManager(event, ['evenementiel'])
  const now = new Date()
  await prisma.importBatch.deleteMany({ where: { expiresAt: { lt: now } } })
  const data = await prisma.importBatch.findMany({
    where: { kind: 'EVENTS', deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, filename: true, format: true, status: true, rows: true, report: true, createdAt: true, expiresAt: true }
  })
  return { status: 200, data }
})
