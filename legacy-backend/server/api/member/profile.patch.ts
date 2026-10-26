import { z } from 'zod'
import prisma from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { POLE_SLUGS, resolveUserPoles, sanitizePoles, toPoleSlug } from '#shared/poles'

// ---------------------------------------------------------------------------
// Mise à jour du profil membre : photo / bio (UserProfile) ET pôles (User).
//
// `poles` est la liste MULTI-PÔLES choisie sur l'écran « Mon profil ».
// Le client peut envoyer des slugs (« k-drama ») ou des libellés (« K-Drama ») ;
// tout pôle inconnu est REFUSÉ (400) et les doublons sont retirés.
// `pole` (ancien champ mono-pôle, conservé pour la compatibilité ascendante)
// reste synchronisé avec le PREMIER pôle choisi.
// ---------------------------------------------------------------------------
const ProfilePatchSchema = z.object({
  pseudo: z.string().trim().min(3, 'Le nom d’utilisateur doit avoir au moins 3 caractères').max(20, 'Le nom d’utilisateur ne peut pas dépasser 20 caractères').optional(),
  avatar: z.string().url().max(2048).nullable().optional(),
  bio: z.string().max(300).nullable().optional(),
  poles: z.array(z.string()).max(POLE_SLUGS.length).optional()
}).superRefine((value, context) => {
  if (Object.keys(value).length === 0) {
    context.addIssue({ code: 'custom', message: 'Aucune modification fournie' })
  }

  if (value.pseudo !== undefined && (value.avatar !== undefined || value.bio !== undefined || value.poles !== undefined)) {
    context.addIssue({ code: 'custom', path: ['pseudo'], message: 'Le nom d’utilisateur doit être modifié séparément.' })
  }
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const parsed = ProfilePatchSchema.safeParse(await readBody(event))

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Profil invalide',
      data: parsed.error.flatten()
    })
  }

  const { pseudo, poles: rawPoles, ...profileData } = parsed.data

  if (pseudo !== undefined) {
    const existing = await prisma.user.findUnique({ where: { pseudo }, select: { id: true } })
    if (existing && existing.id !== user.id) {
      throw createError({ statusCode: 409, statusMessage: 'Ce nom d’utilisateur est déjà utilisé.' })
    }

    try {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { pseudo },
        select: { pseudo: true }
      })
      return { status: 200, data: updated }
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        throw createError({ statusCode: 409, statusMessage: 'Ce nom d’utilisateur est déjà utilisé.' })
      }
      throw error
    }
  }

  let profile = await prisma.userProfile.findUnique({ where: { userId: user.id } })

  if (Object.keys(profileData).length > 0) {
    profile = await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: profileData,
      create: { userId: user.id, ...profileData }
    })
  }

  // ---------- Multi-pôles ----------
  if (rawPoles !== undefined) {
    // 1. Validation stricte : seuls les 6 pôles officiels sont autorisés.
    const unknown = rawPoles.filter(value => toPoleSlug(value) === null)
    if (unknown.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: `Pôle inconnu : ${unknown.join(', ')}. Pôles autorisés : ${POLE_SLUGS.join(', ')}.`
      })
    }

    // 2. Doublons retirés (« Gaming » + « gaming » = un seul pôle).
    const cleaned = sanitizePoles(rawPoles)
    const primary = cleaned[0]
    if (!primary) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Choisis au moins un pôle.'
      })
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { poles: cleaned, pole: primary },
      select: { pole: true, poles: true }
    })

    return {
      status: 200,
      data: { ...(profile ?? {}), pole: updated.pole, poles: resolveUserPoles(updated) }
    }
  }

  return {
    status: 200,
    data: { ...(profile ?? {}), pole: user.pole, poles: resolveUserPoles(user) }
  }
})
