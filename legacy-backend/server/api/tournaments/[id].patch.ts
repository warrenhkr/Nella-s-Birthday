import { z } from 'zod'
import { richTextOptionalField } from '../../schemas'
import prisma from '../../utils/prisma'
import { requireAdminOps } from '../../utils/auth'

// ============================================================
// PATCH /api/tournaments/:id — réglages de publication d'un tournoi.
//
// C'est LE point qui manquait : sans lui, un tournoi créé restait
// éternellement en 'DRAFT' et n'apparaissait jamais côté membre.
//
// Tous les champs sont optionnels (mise à jour partielle) : envoyer
// `{ visibility: 'PUBLIC' }` publie le tournoi, envoyer
// `{ registrationOpen: true }` ouvre les inscriptions en ligne.
// ============================================================

const VisibilitySchema = z.enum(['DRAFT', 'UNLISTED', 'PUBLIC'])

const UpdateSchema = z.object({
  name: z.string().trim().min(3).max(100).optional(),
  game: z.string().trim().min(2).max(100).optional(),
  // `status` est une chaîne LIBRE en base (défaut 'draft'). L'exposer ici est
  // ce qui permet d'ARCHIVER un tournoi terminé : 'completed' (Terminé) ou
  // 'archived' (Archivé), valeurs cohérentes avec GamingStatusBadge. Les
  // autres valeurs du cycle de vie (registration_open, in_progress…) restent
  // acceptées pour ne casser aucune fiche existante.
  status: z.string().trim().min(1).max(40).optional(),
  visibility: VisibilitySchema.optional(),
  registrationOpen: z.boolean().optional(),
  maxTeams: z.number().int().min(2).max(128).nullable().optional(),
  format: z.string().trim().max(60).nullable().optional(),
  // Description / règlement : TEXTE RICHE, nettoyé à l'écriture et borné sur le
  // TEXTE (2 000 caractères, balisage exclu). Facultatif : l'omettre laisse la
  // valeur en base intacte, `null` ou '' l'effacent.
  description: richTextOptionalField({
    max: 2000,
    maxMessage: 'La description ne doit pas dépasser 2 000 caractères.'
  }),
  startDate: z.string().trim().nullable().optional(),
  endDate: z.string().trim().nullable().optional()
})

// `'' | null` => null (efface la date), sinon Date valide, sinon 400.
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

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Identifiant de tournoi manquant' })

  const parsed = UpdateSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Réglages de tournoi invalides', data: parsed.error.flatten() })

  const existing = await prisma.tournament.findUnique({ where: { id } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Tournoi introuvable' })

  const body = parsed.data
  const startDate = body.startDate === undefined ? undefined : parseDate(body.startDate, 'date de début')
  const endDate = body.endDate === undefined ? undefined : parseDate(body.endDate, 'date de fin')
  const nextStart = startDate === undefined ? existing.startDate : startDate
  const nextEnd = endDate === undefined ? existing.endDate : endDate
  if (nextStart && nextEnd && nextEnd < nextStart) {
    throw createError({ statusCode: 400, statusMessage: 'La date de fin doit suivre la date de début' })
  }

  const tournament = await prisma.tournament.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.game !== undefined ? { game: body.game } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.visibility !== undefined ? { visibility: body.visibility } : {}),
      ...(body.registrationOpen !== undefined ? { registrationOpen: body.registrationOpen } : {}),
      ...(body.maxTeams !== undefined ? { maxTeams: body.maxTeams } : {}),
      ...(body.format !== undefined ? { format: body.format || null } : {}),
      ...(body.description !== undefined ? { description: body.description || null } : {}),
      ...(startDate !== undefined ? { startDate } : {}),
      ...(endDate !== undefined ? { endDate } : {})
    },
    include: {
      teams: { orderBy: { seed: 'asc' } },
      matches: { include: { homeTeam: true, awayTeam: true }, orderBy: [{ round: 'asc' }, { position: 'asc' }] }
    }
  })

  return { status: 200, data: tournament }
})
