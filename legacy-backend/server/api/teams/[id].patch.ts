import { z } from 'zod'
import { isRichTextEmpty, richTextLength, toSafeHtml } from '../../../shared/rich-text'
import prisma from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'

// ============================================================
// PATCH /api/teams/:id — modifier nom / photo / description.
//
// Réservé au CAPITAINE de l'équipe (ou à l'organisation). La photo vient
// de l'upload existant (`ImageUpload.vue` -> POST /api/cloudinary/upload) :
// on ne stocke ici qu'une URL.
// ============================================================

const ADMIN_ROLES = ['SUPER_ADMIN', 'INTERMEDIATE_ADMIN', 'ADMIN']

const TeamSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  // Présentation d'équipe : TEXTE RICHE (éditeur du site), nettoyée à
  // l'écriture et bornée sur le TEXTE (1 000 caractères, balisage exclu).
  description: z.string()
    .max(20_000, 'La présentation est trop longue')
    .transform(value => toSafeHtml(value))
    .refine(value => richTextLength(value) <= 1000, 'La présentation ne doit pas dépasser 1 000 caractères')
    .transform(value => (isRichTextEmpty(value) ? null : value))
    .nullable()
    .optional(),
  logoUrl: z.string().trim().max(500).nullable().optional()
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Identifiant d’équipe manquant' })

  const parsed = TeamSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Modifications invalides.', data: parsed.error.flatten() })
  }

  const team = await prisma.tournamentTeam.findUnique({ where: { id } })
  if (!team) throw createError({ statusCode: 404, statusMessage: 'Équipe introuvable' })

  const isCaptain = team.captainId === user.id
  if (!isCaptain && !ADMIN_ROLES.includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Seul le capitaine peut modifier cette équipe.' })
  }

  const { name, description, logoUrl } = parsed.data

  if (name && name.toLowerCase() !== team.name.toLowerCase()) {
    const duplicate = await prisma.tournamentTeam.findFirst({
      where: {
        id: { not: team.id },
        name: { equals: name, mode: 'insensitive' },
        OR: [{ captainId: team.captainId ?? undefined }, { members: { some: { userId: team.captainId ?? '' } } }]
      },
      select: { id: true }
    })
    if (duplicate) {
      throw createError({ statusCode: 409, statusMessage: `Une autre équipe porte déjà le nom « ${name} ».` })
    }
  }

  const updated = await prisma.tournamentTeam.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description: description || null } : {}),
      ...(logoUrl !== undefined ? { logoUrl: logoUrl || null } : {})
    },
    include: {
      members: { include: { user: { select: { id: true, pseudo: true, nom: true, prenom: true } } } }
    }
  })

  return { status: 200, data: updated }
})
