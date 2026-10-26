import prisma from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'

// ============================================================
// GET /api/tournaments/:id/public — détail d'UN tournoi, côté MEMBRE.
//
// Accessible à tout utilisateur connecté (requireAuth), en LECTURE SEULE :
// aucune donnée d'administration, aucun endpoint d'écriture ici.
//
// Règle de visibilité (verrou n°3 du rapport d'audit) :
//   - visibility 'PUBLIC'  -> accessible à tout membre connecté ;
//   - visibility 'UNLISTED' ou 'DRAFT' -> uniquement pour un admin.
//     Un membre reçoit 403 : le tournoi non public ne doit pas fuiter.
//
// La réponse contient l'en-tête du tournoi, ses équipes (triées par seed)
// et ses matchs (avec l'équipe à domicile et à l'extérieur).
// ============================================================

const ADMIN_ROLES = ['SUPER_ADMIN', 'INTERMEDIATE_ADMIN', 'ADMIN']

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Identifiant de tournoi manquant' })
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      teams: { orderBy: { seed: 'asc' } },
      matches: {
        include: { homeTeam: true, awayTeam: true },
        orderBy: [{ round: 'asc' }, { position: 'asc' }]
      }
    }
  })

  if (!tournament) {
    throw createError({ statusCode: 404, statusMessage: 'Tournoi introuvable' })
  }

  const isAdmin = ADMIN_ROLES.includes(user.role)
  if (tournament.visibility !== 'PUBLIC' && !isAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'Ce tournoi n’est pas public' })
  }

  return {
    status: 200,
    data: {
      id: tournament.id,
      name: tournament.name,
      game: tournament.game,
      status: tournament.status,
      visibility: tournament.visibility,
      format: tournament.format,
      description: tournament.description,
      startDate: tournament.startDate,
      endDate: tournament.endDate,
      registrationOpen: tournament.registrationOpen,
      maxTeams: tournament.maxTeams,
      createdAt: tournament.createdAt,
      updatedAt: tournament.updatedAt,
      teamCount: tournament.teams.length,
      matchCount: tournament.matches.length,
      teams: tournament.teams,
      matches: tournament.matches
    }
  }
})
