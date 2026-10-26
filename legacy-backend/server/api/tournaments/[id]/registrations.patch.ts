import { z } from 'zod'
import prisma from '../../../utils/prisma'
import { requireAdminOps } from '../../../utils/auth'

// ============================================================
// PATCH /api/tournaments/:id/registrations — valider / refuser une demande.
//
//   { registrationId, status: "APPROVED" | "REJECTED" }
//
// Une demande APPROVED rattache réellement l'équipe au tournoi
// (`tournamentId` + `seed` en fin de tableau) : l'équipe apparaît alors
// dans la liste des équipes du tournoi et peut être seedée depuis le
// cockpit. Le bracket n'est pas régénéré automatiquement — le seeding
// reste une décision de l'organisation.
// ============================================================

const DecisionSchema = z.object({
  registrationId: z.string().trim().min(1),
  status: z.enum(['APPROVED', 'REJECTED'])
})

export default defineEventHandler(async (event) => {
  await requireAdminOps(event, ['gaming'])

  const tournamentId = getRouterParam(event, 'id')
  if (!tournamentId) throw createError({ statusCode: 400, statusMessage: 'Identifiant de tournoi manquant' })

  const parsed = DecisionSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Décision invalide.', data: parsed.error.flatten() })
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, maxTeams: true }
  })
  if (!tournament) throw createError({ statusCode: 404, statusMessage: 'Tournoi introuvable' })

  const registration = await prisma.tournamentRegistration.findUnique({
    where: { id: parsed.data.registrationId },
    include: { team: { select: { id: true, name: true, tournamentId: true } } }
  })
  if (!registration || registration.tournamentId !== tournament.id) {
    throw createError({ statusCode: 404, statusMessage: 'Demande d’inscription introuvable pour ce tournoi' })
  }

  if (parsed.data.status === 'REJECTED') {
    const rejected = await prisma.tournamentRegistration.update({
      where: { id: registration.id },
      data: { status: 'REJECTED' }
    })
    return { status: 200, data: rejected }
  }

  if (registration.team.tournamentId && registration.team.tournamentId !== tournament.id) {
    throw createError({ statusCode: 409, statusMessage: 'Cette équipe est déjà engagée dans un autre tournoi.' })
  }

  if (tournament.maxTeams) {
    const attached = await prisma.tournamentTeam.count({ where: { tournamentId: tournament.id } })
    if (attached >= tournament.maxTeams) {
      throw createError({ statusCode: 409, statusMessage: 'Ce tournoi a atteint son nombre maximal d’équipes.' })
    }
  }

  const maxSeed = await prisma.tournamentTeam.aggregate({
    where: { tournamentId: tournament.id },
    _max: { seed: true }
  })

  try {
    const approved = await prisma.$transaction(async (transaction) => {
      if (registration.team.tournamentId !== tournament.id) {
        await transaction.tournamentTeam.update({
          where: { id: registration.team.id },
          data: { tournamentId: tournament.id, seed: (maxSeed._max.seed ?? 0) + 1 }
        })
      }
      return transaction.tournamentRegistration.update({
        where: { id: registration.id },
        data: { status: 'APPROVED' }
      })
    })
    return { status: 200, data: approved }
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code
    if (code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: `Une équipe nommée « ${registration.team.name} » est déjà engagée dans ce tournoi.` })
    }
    throw error
  }
})
