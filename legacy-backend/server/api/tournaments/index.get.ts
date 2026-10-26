import prisma from '../../utils/prisma'
import { requireAdminOps } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAdminOps(event, ['gaming'])
  const tournaments = await prisma.tournament.findMany({
    orderBy: { createdAt: 'desc' },
    include: { teams: { orderBy: { seed: 'asc' } }, matches: { include: { homeTeam: true, awayTeam: true }, orderBy: [{ round: 'asc' }, { position: 'asc' }] } }
  })
  return { status: 200, data: tournaments }
})
