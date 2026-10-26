import { z } from 'zod'
import prisma from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'

// ============================================================
// POST /api/tournaments/:id/register — un membre inscrit SON équipe.
//
//   { teamId, message? }
//
// Garde-fous (verrou « inscription en ligne » du Lot 3) :
//   * le tournoi doit être PUBLIÉ (visibility PUBLIC ou UNLISTED) ;
//   * `registrationOpen` doit être vrai ;
//   * `maxTeams` est respecté (équipes attachées + demandes en cours) ;
//   * l'appelant doit être CAPITAINE de l'équipe (ou membre CAPTAIN) ;
//   * une seule demande par couple (tournoi, équipe) ;
//   * une équipe déjà engagée dans ce tournoi ne peut pas se ré-inscrire.
//
// La demande est créée en PENDING : c'est l'organisation qui valide
// (PATCH /api/tournaments/:id/registrations), afin qu'aucune équipe
// inconnue n'entre dans un bracket sans contrôle.
// ============================================================

const VisibilityAllowed = ['PUBLIC', 'UNLISTED']

const RegisterSchema = z.object({
  teamId: z.string().trim().min(1),
  message: z.string().trim().max(500).nullable().optional()
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const tournamentId = getRouterParam(event, 'id')
  if (!tournamentId) throw createError({ statusCode: 400, statusMessage: 'Identifiant de tournoi manquant' })

  const parsed = RegisterSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Inscription invalide : sélectionne une équipe.', data: parsed.error.flatten() })
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, visibility: true, registrationOpen: true, maxTeams: true }
  })
  if (!tournament) throw createError({ statusCode: 404, statusMessage: 'Tournoi introuvable' })
  if (!VisibilityAllowed.includes(tournament.visibility)) {
    throw createError({ statusCode: 403, statusMessage: 'Ce tournoi n’est pas encore publié : inscriptions impossibles.' })
  }
  if (!tournament.registrationOpen) {
    throw createError({ statusCode: 403, statusMessage: 'Les inscriptions sont fermées pour ce tournoi.' })
  }

  const team = await prisma.tournamentTeam.findUnique({
    where: { id: parsed.data.teamId },
    include: { members: { select: { userId: true, role: true } } }
  })
  if (!team) throw createError({ statusCode: 404, statusMessage: 'Équipe introuvable' })

  const isCaptain = team.captainId === user.id
    || team.members.some(member => member.userId === user.id && member.role === 'CAPTAIN')
  if (!isCaptain) {
    throw createError({ statusCode: 403, statusMessage: 'Seul le capitaine de l’équipe peut l’inscrire.' })
  }

  if (team.tournamentId === tournament.id) {
    throw createError({ statusCode: 409, statusMessage: 'Cette équipe est déjà engagée dans ce tournoi.' })
  }
  if (team.tournamentId && team.tournamentId !== tournament.id) {
    throw createError({ statusCode: 409, statusMessage: 'Cette équipe est déjà engagée dans un autre tournoi.' })
  }

  const existing = await prisma.tournamentRegistration.findUnique({
    where: { tournamentId_teamId: { tournamentId: tournament.id, teamId: team.id } }
  })
  if (existing) {
    const labels: Record<string, string> = {
      PENDING: 'Une demande d’inscription est déjà en attente de validation.',
      APPROVED: 'Cette équipe est déjà inscrite à ce tournoi.',
      REJECTED: 'La demande précédente a été refusée. Contacte l’organisation du club.'
    }
    throw createError({ statusCode: 409, statusMessage: labels[existing.status] || 'Inscription déjà enregistrée.' })
  }

  if (tournament.maxTeams) {
    const engaged = await prisma.tournamentRegistration.count({
      where: { tournamentId: tournament.id, status: { in: ['PENDING', 'APPROVED'] } }
    })
    const attached = await prisma.tournamentTeam.count({ where: { tournamentId: tournament.id } })
    if (engaged + attached >= tournament.maxTeams) {
      throw createError({ statusCode: 409, statusMessage: 'Ce tournoi a atteint son nombre maximal d’équipes.' })
    }
  }

  const registration = await prisma.tournamentRegistration.create({
    data: {
      tournamentId: tournament.id,
      teamId: team.id,
      status: 'PENDING',
      message: parsed.data.message || null
    },
    include: { tournament: { select: { id: true, name: true } }, team: { select: { id: true, name: true } } }
  })

  setResponseStatus(event, 201)
  return { status: 201, data: registration }
})
