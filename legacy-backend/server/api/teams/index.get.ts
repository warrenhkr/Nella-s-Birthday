import prisma from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'

// ============================================================
// GET /api/teams — « mes équipes ».
//
// Renvoie les équipes dont l'utilisateur connecté fait partie (capitaine
// ou simple joueur), avec le roster, le tournoi d'attache s'il existe et
// ses demandes d'inscription. Aucune donnée d'un autre membre n'est
// exposée : le filtre porte sur l'appartenance de l'appelant.
// ============================================================

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const teams = await prisma.tournamentTeam.findMany({
    where: {
      OR: [
        { captainId: user.id },
        { members: { some: { userId: user.id } } }
      ]
    },
    orderBy: [{ name: 'asc' }],
    include: {
      tournament: { select: { id: true, name: true, game: true, visibility: true, status: true } },
      members: {
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        include: { user: { select: { id: true, pseudo: true, nom: true, prenom: true } } }
      },
      registrations: {
        orderBy: { createdAt: 'desc' },
        include: { tournament: { select: { id: true, name: true, game: true, visibility: true, status: true, startDate: true } } }
      }
    }
  })

  return {
    status: 200,
    data: teams.map(team => ({
      id: team.id,
      name: team.name,
      seed: team.seed,
      logoUrl: team.logoUrl,
      description: team.description,
      captainId: team.captainId,
      isCaptain: team.captainId === user.id || team.members.some(member => member.userId === user.id && member.role === 'CAPTAIN'),
      memberCount: team.members.length,
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
    }))
  }
})
