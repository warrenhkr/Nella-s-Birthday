import { z } from 'zod'
import { richTextOptionalField } from '../../schemas'
import prisma from '../../utils/prisma'
import { requireAdminOps } from '../../utils/auth'

// ============================================================
// POST /api/tournaments — création d'un tournoi par l'organisation.
//
// Lot 3 : le schéma accepte enfin toute la fiche de publication
// (`visibility`, `registrationOpen`, `maxTeams`, `format`,
// `description`, `startDate`, `endDate`). Avant, ces champs existaient
// en base mais n'étaient jamais alimentés : tout tournoi restait donc
// en 'DRAFT' et les pages membre restaient vides.
//
// `teams` devient optionnel : un tournoi ouvert à l'inscription en ligne
// peut être créé sans plateau pré-rempli (les équipes s'inscrivent depuis
// `/tournois/[id]`). Quand une liste est fournie, le premier tour est
// généré exactement comme avant.
// ============================================================

const VisibilitySchema = z.enum(['DRAFT', 'UNLISTED', 'PUBLIC'])

const TournamentSchema = z.object({
  name: z.string().trim().min(3).max(100),
  game: z.string().trim().min(2).max(100),
  teams: z.array(z.string().trim().min(2).max(80)).max(32).default([]),
  teamIds: z.array(z.string().trim().min(1)).max(32).default([]),
  // `status` est une chaîne LIBRE en base (défaut 'draft'). On l'expose pour
  // pouvoir ENREGISTRER un tournoi déjà terminé (archive) dès la création :
  // valeurs cohérentes avec GamingStatusBadge (draft, registration_open,
  // in_progress, completed, archived…). Absent → défaut 'draft' de la base.
  status: z.string().trim().min(1).max(40).optional(),
  visibility: VisibilitySchema.default('DRAFT'),
  registrationOpen: z.boolean().default(false),
  maxTeams: z.number().int().min(2).max(128).nullable().optional(),
  format: z.string().trim().max(60).nullable().optional(),
  // Description / règlement du tournoi : TEXTE RICHE (éditeur du site),
  // nettoyé à l'écriture et borné sur le TEXTE — 2 000 caractères, balisage
  // exclu. Toujours facultatif : '' et null restent acceptés et effacent la
  // description.
  description: richTextOptionalField({
    max: 2000,
    maxMessage: 'La description ne doit pas dépasser 2 000 caractères.'
  }),
  startDate: z.string().trim().nullable().optional(),
  endDate: z.string().trim().nullable().optional()
})

// `'' | null | undefined` => null, sinon Date valide, sinon 400.
function parseDate(value: string | null | undefined, label: string) {
  if (value === undefined || value === null || value === '') return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw createError({ statusCode: 400, statusMessage: `Date invalide : ${label}` })
  }
  return date
}

export default defineEventHandler(async (event) => {
  await requireAdminOps(event, ['gaming'])
  const parsed = TournamentSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Données de tournoi invalides', data: parsed.error.flatten() })

  const uniqueTeams = [...new Set(parsed.data.teams)]
  if (uniqueTeams.length > 0 && uniqueTeams.length < 2) {
    throw createError({ statusCode: 400, statusMessage: 'Deux équipes distinctes sont nécessaires' })
  }

  const uniqueTeamIds = [...new Set(parsed.data.teamIds)]
  if (uniqueTeamIds.length > 0 && uniqueTeams.length + uniqueTeamIds.length < 2) {
    throw createError({ statusCode: 400, statusMessage: 'Deux équipes distinctes sont nécessaires' })
  }

  const startDate = parseDate(parsed.data.startDate, 'date de début')
  const endDate = parseDate(parsed.data.endDate, 'date de fin')
  if (startDate && endDate && endDate < startDate) {
    throw createError({ statusCode: 400, statusMessage: 'La date de fin doit suivre la date de début' })
  }

  const tournament = await prisma.$transaction(async (transaction) => {
    const createdTournament = await transaction.tournament.create({
      data: {
        name: parsed.data.name,
        game: parsed.data.game,
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        visibility: parsed.data.visibility,
        registrationOpen: parsed.data.registrationOpen,
        maxTeams: parsed.data.maxTeams ?? null,
        format: parsed.data.format || null,
        description: parsed.data.description || null,
        startDate,
        endDate
      }
    })

    const createdTeamPayload = uniqueTeams.map((name, index) => ({ name, seed: index + 1 }))
    if (createdTeamPayload.length) {
      await transaction.tournamentTeam.createMany({
        data: createdTeamPayload.map(team => ({
          name: team.name,
          seed: team.seed,
          tournamentId: createdTournament.id
        }))
      })
    }

    const requestedTeams = uniqueTeamIds.length
      ? await transaction.tournamentTeam.findMany({
          where: { id: { in: uniqueTeamIds } },
          select: { id: true, name: true, tournamentId: true, seed: true }
        })
      : []

    if (requestedTeams.length !== uniqueTeamIds.length) {
      throw createError({ statusCode: 404, statusMessage: 'Une équipe sélectionnée est introuvable.' })
    }

    for (const team of requestedTeams) {
      if (team.tournamentId && team.tournamentId !== createdTournament.id) {
        throw createError({ statusCode: 409, statusMessage: `L’équipe « ${team.name} » est déjà engagée dans un autre tournoi.` })
      }
    }

    const seedOffset = createdTeamPayload.length + 1
    for (const [index, team] of requestedTeams.entries()) {
      await transaction.tournamentTeam.update({
        where: { id: team.id },
        data: {
          tournamentId: createdTournament.id,
          seed: seedOffset + index
        }
      })
    }

    const finalTeams = await transaction.tournamentTeam.findMany({
      where: { tournamentId: createdTournament.id },
      orderBy: { seed: 'asc' },
      include: { homeMatches: true, awayMatches: true }
    })

    const matches = []
    for (let index = 0; index < finalTeams.length; index += 2) {
      matches.push({
        tournamentId: createdTournament.id,
        round: 1,
        position: Math.floor(index / 2) + 1,
        homeTeamId: finalTeams[index]?.id,
        awayTeamId: finalTeams[index + 1]?.id
      })
    }
    if (matches.length) await transaction.tournamentMatch.createMany({ data: matches })

    return transaction.tournament.findUnique({
      where: { id: createdTournament.id },
      include: { teams: { orderBy: { seed: 'asc' } }, matches: { include: { homeTeam: true, awayTeam: true } } }
    })
  })

  setResponseStatus(event, 201)
  return { status: 201, data: tournament }
})
