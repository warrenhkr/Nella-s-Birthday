import prisma from '../../../utils/prisma'
import { requireAdminOps } from '../../../utils/auth'

// ============================================================
// GET /api/tournaments/:id/registrations — demandes d'inscription.
//
// Réservé à l'organisation : liste des équipes qui demandent à entrer
// dans le tournoi (roster et capitaine compris) pour valider ou refuser.
// ============================================================

export default defineEventHandler(async (event) => {
  await requireAdminOps(event, ['gaming'])

  const tournamentId = getRouterParam(event, 'id')
  if (!tournamentId) throw createError({ statusCode: 400, statusMessage: 'Identifiant de tournoi manquant' })

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, maxTeams: true, registrationOpen: true, visibility: true }
  })
  if (!tournament) throw createError({ statusCode: 404, statusMessage: 'Tournoi introuvable' })

  const registrations = await prisma.tournamentRegistration.findMany({
    where: { tournamentId },
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    include: {
      team: {
        include: {
          members: {
            orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
            include: { user: { select: { id: true, pseudo: true, nom: true, prenom: true } } }
          },
          captain: { select: { id: true, pseudo: true, nom: true, prenom: true } }
        }
      }
    }
  })

  return {
    status: 200,
    data: {
      tournament,
      registrations: registrations.map(registration => ({
        id: registration.id,
        status: registration.status,
        message: registration.message,
        createdAt: registration.createdAt,
        team: {
          id: registration.team.id,
          name: registration.team.name,
          logoUrl: registration.team.logoUrl,
          description: registration.team.description,
          seed: registration.team.seed,
          tournamentId: registration.team.tournamentId,
          captainPseudo: registration.team.captain?.pseudo ?? null,
          memberCount: registration.team.members.length,
          members: registration.team.members.map(member => ({
            userId: member.userId,
            role: member.role,
            pseudo: member.user.pseudo,
            nom: member.user.nom,
            prenom: member.user.prenom
          }))
        }
      }))
    }
  }
})
