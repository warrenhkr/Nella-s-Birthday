import prisma from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'

// ============================================================
// GET /api/tournaments/public — lecture côté MEMBRE.
//
// Visible par tout utilisateur CONNECTÉ (requireAuth, pas requireAdmin) :
// un membre peut enfin consulter les tournois sans recevoir de 403.
//
// Règle de visibilité :
//   - la LISTE ne contient QUE les tournois `visibility = 'PUBLIC'` ;
//   - un tournoi 'UNLISTED' (partage par lien) n'est renvoyé que si le
//     client le demande EXPLICITEMENT par son identifiant (?id=xxx) ;
//   - un tournoi 'DRAFT' (brouillon) n'est jamais exposé à un membre,
//     même avec l'identifiant : seul un admin y accède.
//
// Aucun champ sensible n'est renvoyé : pas de brouillon, pas de données
// d'administration, seulement l'en-tête du tournoi et deux compteurs.
// ============================================================

// Mêmes rôles que requireAdmin (server/utils/auth.ts) : le contrôle ci-dessous
// sert uniquement à distinguer « admin » de « membre » SANS lever d'exception.
const ADMIN_ROLES = ['SUPER_ADMIN', 'INTERMEDIATE_ADMIN', 'ADMIN']

type TournamentSummaryRow = {
  id: string
  name: string
  game: string
  status: string
  visibility: string
  format: string | null
  description: string | null
  startDate: Date | null
  endDate: Date | null
  registrationOpen: boolean
  maxTeams: number | null
  _count: { teams: number, matches: number }
}

// Champs exposés au membre + compteurs (pas de relation lourde dans la liste).
const summarySelect = {
  id: true,
  name: true,
  game: true,
  status: true,
  visibility: true,
  format: true,
  description: true,
  startDate: true,
  endDate: true,
  registrationOpen: true,
  maxTeams: true,
  _count: { select: { teams: true, matches: true } }
}

function shape(row: TournamentSummaryRow) {
  return {
    id: row.id,
    name: row.name,
    game: row.game,
    status: row.status,
    visibility: row.visibility,
    format: row.format,
    description: row.description,
    startDate: row.startDate,
    endDate: row.endDate,
    registrationOpen: row.registrationOpen,
    maxTeams: row.maxTeams,
    teamCount: row._count.teams,
    matchCount: row._count.matches
  }
}

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const query = getQuery(event)
  const requestedId = typeof query.id === 'string' ? query.id.trim() : ''

  // ---- Demande explicite d'UN tournoi par identifiant -------------------
  // C'est le seul chemin qui autorise un membre à voir un tournoi 'UNLISTED'
  // (tournoi « accessible par lien »). Un brouillon reste invisible.
  if (requestedId) {
    const tournament = await prisma.tournament.findUnique({
      where: { id: requestedId },
      select: summarySelect
    })

    if (!tournament) {
      throw createError({ statusCode: 404, statusMessage: 'Tournoi introuvable' })
    }

    const isAdmin = ADMIN_ROLES.includes(user.role)
    const visible = tournament.visibility === 'PUBLIC' || tournament.visibility === 'UNLISTED' || isAdmin
    if (!visible) {
      // Un brouillon : on renvoie 404 (et non 403) pour ne pas confirmer
      // l'existence du tournoi à un membre.
      throw createError({ statusCode: 404, statusMessage: 'Tournoi introuvable' })
    }

    return { status: 200, data: shape(tournament) }
  }

  // ---- Liste : PUBLIC uniquement ----------------------------------------
  const tournaments = await prisma.tournament.findMany({
    where: { visibility: 'PUBLIC' },
    orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    select: summarySelect
  })

  return { status: 200, data: tournaments.map(shape) }
})
