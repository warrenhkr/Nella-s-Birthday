import { z } from 'zod'
import prisma from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'

// ============================================================
// POST /api/teams/:id/members — ajouter un membre au roster.
//
//   { identifier: "<pseudo ou email>", role?: "PLAYER" | "CAPTAIN" }
//
// Réservé au capitaine (ou à l'organisation). Le membre est désigné par
// son pseudo ou son email exact : pas d'annuaire complet exposé, donc
// aucun énumération possible des comptes du club.
// ============================================================

const ADMIN_ROLES = ['SUPER_ADMIN', 'INTERMEDIATE_ADMIN', 'ADMIN']

const MemberSchema = z.object({
  identifier: z.string().trim().min(2).max(120),
  role: z.enum(['PLAYER', 'CAPTAIN']).default('PLAYER')
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Identifiant d’équipe manquant' })

  const parsed = MemberSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Membre invalide.', data: parsed.error.flatten() })
  }

  const team = await prisma.tournamentTeam.findUnique({ where: { id } })
  if (!team) throw createError({ statusCode: 404, statusMessage: 'Équipe introuvable' })

  const isCaptain = team.captainId === user.id
  if (!isCaptain && !ADMIN_ROLES.includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Seul le capitaine peut recruter dans cette équipe.' })
  }

  const target = await prisma.user.findFirst({
    where: {
      OR: [
        { pseudo: { equals: parsed.data.identifier, mode: 'insensitive' } },
        { email: { equals: parsed.data.identifier, mode: 'insensitive' } }
      ]
    },
    select: { id: true, pseudo: true, nom: true, prenom: true, isActive: true }
  })
  if (!target) throw createError({ statusCode: 404, statusMessage: `Aucun membre ne correspond à « ${parsed.data.identifier} ».` })
  if (!target.isActive) throw createError({ statusCode: 400, statusMessage: 'Ce compte est désactivé.' })

  const existing = await prisma.tournamentTeamMember.findUnique({
    where: { teamId_userId: { teamId: team.id, userId: target.id } }
  })
  if (existing) throw createError({ statusCode: 409, statusMessage: `${target.pseudo} fait déjà partie du roster.` })

  const member = await prisma.tournamentTeamMember.create({
    data: { teamId: team.id, userId: target.id, role: parsed.data.role },
    include: { user: { select: { id: true, pseudo: true, nom: true, prenom: true } } }
  })

  setResponseStatus(event, 201)
  return { status: 201, data: member }
})
