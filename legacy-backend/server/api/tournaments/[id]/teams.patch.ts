import { z } from 'zod'
import prisma from '../../../utils/prisma'
import { requireAdminOps } from '../../../utils/auth'

const TeamsSchema = z.object({ teamIds: z.array(z.string().min(1)).min(2).max(32) })

export default defineEventHandler(async (event) => {
  await requireAdminOps(event, ['gaming'])
  const tournamentId = getRouterParam(event, 'id')
  const parsed = TeamsSchema.safeParse(await readBody(event))
  if (!tournamentId || !parsed.success || new Set(parsed.data.teamIds).size !== parsed.data.teamIds.length) {
    throw createError({ statusCode: 400, statusMessage: 'Ordre des équipes invalide' })
  }

  const teams = await prisma.tournamentTeam.findMany({ where: { tournamentId }, select: { id: true } })
  if (teams.length !== parsed.data.teamIds.length || teams.some(team => !parsed.data.teamIds.includes(team.id))) {
    throw createError({ statusCode: 400, statusMessage: 'Les équipes ne correspondent pas au tournoi' })
  }

  await prisma.$transaction(parsed.data.teamIds.map((id, index) => prisma.tournamentTeam.update({ where: { id }, data: { seed: index + 1 } })))
  return { status: 200, data: await prisma.tournamentTeam.findMany({ where: { tournamentId }, orderBy: { seed: 'asc' } }) }
})
