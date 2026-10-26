import prisma from '../../utils/prisma'
import { requireAdminOps } from '../../utils/auth'

// ============================================================
// GET /api/teams/admin — liste toutes les équipes du club pour le
// cockpit gaming, afin qu’un admin sélectionne un plateau déjà connu
// ou renseigne un tournoi ouvert à l’inscription.
// ============================================================

export default defineEventHandler(async (event) => {
  await requireAdminOps(event, ['gaming'])

  const teams = await prisma.tournamentTeam.findMany({
    orderBy: [{ name: 'asc' }],
    select: {
      id: true,
      name: true,
      logoUrl: true,
      description: true,
      captainId: true,
      tournamentId: true,
      seed: true,
      members: {
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        include: { user: { select: { id: true, pseudo: true, nom: true, prenom: true } } }
      }
    }
  })

  return {
    status: 200,
    data: teams.map(team => ({
      id: team.id,
      name: team.name,
      logoUrl: team.logoUrl,
      description: team.description,
      captainId: team.captainId,
      tournamentId: team.tournamentId,
      seed: team.seed,
      memberCount: team.members.length,
      members: team.members.map(member => ({
        id: member.id,
        userId: member.userId,
        role: member.role,
        joinedAt: member.joinedAt,
        pseudo: member.user.pseudo,
        nom: member.user.nom,
        prenom: member.user.prenom
      }))
    }))
  }
})
