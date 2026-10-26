import { z } from 'zod'
import prisma from '../../../../utils/prisma'
import { requireAdminOps } from '../../../../utils/auth'

const MatchSchema = z.object({
  status: z.enum(['scheduled', 'live', 'completed']).optional(),
  scoreHome: z.number().int().nonnegative().nullable().optional(),
  scoreAway: z.number().int().nonnegative().nullable().optional()
})

export default defineEventHandler(async (event) => {
  await requireAdminOps(event, ['gaming'])
  const tournamentId = getRouterParam(event, 'id')
  const matchId = getRouterParam(event, 'matchId')
  const parsed = MatchSchema.safeParse(await readBody(event))
  if (!tournamentId || !matchId || !parsed.success) throw createError({ statusCode: 400, statusMessage: 'Mise à jour de match invalide' })

  const match = await prisma.tournamentMatch.updateMany({ where: { id: matchId, tournamentId }, data: parsed.data })
  if (match.count === 0) throw createError({ statusCode: 404, statusMessage: 'Match introuvable' })
  return { status: 200, data: await prisma.tournamentMatch.findUnique({ where: { id: matchId }, include: { homeTeam: true, awayTeam: true } }) }
})
