import prisma from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'

// ============================================================
// GET /api/teams/:id — détail d'une équipe (roster compris).
//
// Accessible à ses membres et à l'organisation. Un tiers reçoit 403 :
// le roster (pseudo, nom) n'est pas public.
// ============================================================

const ADMIN_ROLES = ['SUPER_ADMIN', 'INTERMEDIATE_ADMIN', 'ADMIN']

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Identifiant d’équipe manquant' })

  const team = await prisma.tournamentTeam.findUnique({
    where: { id },
    include: {
      tournament: { select: { id: true, name: true, game: true, visibility: true, status: true, startDate: true } },
      members: {
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        include: { user: { select: { id: true, pseudo: true, nom: true, prenom: true } } }
      },
      registrations: {
        orderBy: { createdAt: 'desc' },
        include: { tournament: { select: { id: true, name: true, game: true, visibility: true, status: true, startDate: true } } }
      },
      homeMatches: { select: { id: true } },
      awayMatches: { select: { id: true } }
    }
  })

  if (!team) throw createError({ statusCode: 404, statusMessage: 'Équipe introuvable' })

  const isMember = team.members.some(member => member.userId === user.id)
  if (!isMember && !ADMIN_ROLES.includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Cette équipe ne t’appartient pas.' })
  }

  return {
    status: 200,
    data: {
      id: team.id,
      name: team.name,
      seed: team.seed,
      logoUrl: team.logoUrl,
      description: team.description,
      captainId: team.captainId,
      isCaptain: team.captainId === user.id || team.members.some(member => member.userId === user.id && member.role === 'CAPTAIN'),
      isAdmin: ADMIN_ROLES.includes(user.role),
      matchCount: team.homeMatches.length + team.awayMatches.length,
      tournament: team.tournament,
      members: team.members.map(member => ({
        id: member.id,
        userId: member.userId,
        role: member.role,
        joinedAt: member.joinedAt,
        pseudo: member.user.pseudo,
        nom: member.user.nom,
        prenom: member.user.prenom
      })),
      registrations: team.registrations.map(registration => ({
        id: registration.id,
        status: registration.status,
        message: registration.message,
        createdAt: registration.createdAt,
        tournament: registration.tournament
      }))
    }
  }
})
