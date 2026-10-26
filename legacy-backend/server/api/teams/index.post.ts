import { z } from 'zod'
import { isRichTextEmpty, richTextLength, toSafeHtml } from '../../../shared/rich-text'
import prisma from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'

// ============================================================
// POST /api/teams — un membre crée SON équipe.
//
//   { name, description?, logoUrl?, tournamentId? }
//
//  * le créateur devient automatiquement membre CAPTAIN de l'équipe ;
//  * l'équipe est créée SANS tournoi (elle existe pour elle-même) ;
//  * si `tournamentId` est fourni, une demande d'inscription (PENDING)
//    est créée dans la foulée — mêmes contrôles que
//    POST /api/tournaments/:id/register (publication + inscriptions ouvertes).
// ============================================================

const VisibilityAllowed = ['PUBLIC', 'UNLISTED']

const TeamSchema = z.object({
  name: z.string().trim().min(2).max(60),
  // Présentation d'équipe : TEXTE RICHE (éditeur du site). Nettoyée à
  // l'écriture, bornée sur le TEXTE (1 000 caractères, balisage exclu).
  description: z.string()
    .max(20_000, 'La présentation est trop longue')
    .transform(value => toSafeHtml(value))
    .refine(value => richTextLength(value) <= 1000, 'La présentation ne doit pas dépasser 1 000 caractères')
    .transform(value => (isRichTextEmpty(value) ? null : value))
    .nullable()
    .optional(),
  logoUrl: z.string().trim().max(500).nullable().optional(),
  tournamentId: z.string().trim().min(1).nullable().optional()
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const parsed = TeamSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Équipe invalide (nom de 2 à 60 caractères).', data: parsed.error.flatten() })
  }

  const { name, description, logoUrl, tournamentId } = parsed.data

  // Un membre ne peut pas créer deux équipes portant le même nom.
  const duplicate = await prisma.tournamentTeam.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      OR: [{ captainId: user.id }, { members: { some: { userId: user.id } } }]
    },
    select: { id: true }
  })
  if (duplicate) {
    throw createError({ statusCode: 409, statusMessage: `Tu fais déjà partie d’une équipe nommée « ${name} ».` })
  }

  let targetTournament: { id: string, maxTeams: number | null } | null = null
  if (tournamentId) {
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
    if (tournament.maxTeams) {
      const engaged = await prisma.tournamentRegistration.count({
        where: { tournamentId: tournament.id, status: { in: ['PENDING', 'APPROVED'] } }
      })
      const attached = await prisma.tournamentTeam.count({ where: { tournamentId: tournament.id } })
      if (engaged + attached >= tournament.maxTeams) {
        throw createError({ statusCode: 409, statusMessage: 'Ce tournoi a atteint son nombre maximal d’équipes.' })
      }
    }
    targetTournament = { id: tournament.id, maxTeams: tournament.maxTeams }
  }

  const team = await prisma.tournamentTeam.create({
    data: {
      name,
      description: description || null,
      logoUrl: logoUrl || null,
      captainId: user.id,
      members: { create: { userId: user.id, role: 'CAPTAIN' } }
    },
    include: {
      members: { include: { user: { select: { id: true, pseudo: true, nom: true, prenom: true } } } }
    }
  })

  let registration = null
  if (targetTournament) {
    registration = await prisma.tournamentRegistration.create({
      data: { tournamentId: targetTournament.id, teamId: team.id, status: 'PENDING' }
    })
  }

  setResponseStatus(event, 201)
  return { status: 201, data: { ...team, isCaptain: true, registration } }
})
