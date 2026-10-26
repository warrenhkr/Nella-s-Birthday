import { z } from 'zod'
import prisma from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'

const CardSchema = z.object({
  displayName: z.string().min(2).max(40),
  imageUrl: z.string().url().optional(),
  favoriteAnime: z.string().max(80).optional(),
  favoriteManga: z.string().max(80).optional(),
  favoriteAnimes: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
  favoriteMangas: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
  favoriteGame: z.string().max(80).optional(),
  bio: z.string().max(300).optional(),
  nom: z.string().trim().min(2).max(80),
  prenom: z.string().trim().min(2).max(80),
  telephone: z.string().trim().min(6).max(30),
  situation: z.enum(['STUDENT_BENIN', 'STUDENT_ABROAD', 'PROFESSIONAL']).default('STUDENT_BENIN'),
  pays: z.string().trim().max(100).optional(),
  profession: z.string().trim().max(150).optional(),
  universite: z.string().trim().max(255).optional(),
  faculte: z.string().trim().max(255).default(''),
  filiere: z.string().trim().max(255).optional()
}).superRefine((value, context) => {
  const exiger = (champ: 'universite' | 'filiere' | 'pays' | 'profession', libelle: string) => {
    if ((value[champ] || '').trim().length < 2) {
      context.addIssue({ code: 'custom', path: [champ], message: `${libelle} est obligatoire` })
    }
  }

  if (value.situation === 'STUDENT_BENIN') {
    exiger('universite', 'L’université')
    exiger('filiere', 'La filière')
  } else if (value.situation === 'STUDENT_ABROAD') {
    exiger('pays', 'Le pays')
    exiger('universite', 'L’établissement')
    exiger('filiere', 'La filière')
  } else {
    exiger('profession', 'La profession ou activité')
  }
})

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const parsed = CardSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Carte Otaku invalide', data: parsed.error.flatten() })

  const { nom, prenom, telephone, situation, pays, profession, universite, faculte, filiere } = parsed.data
  const data = {
    displayName: parsed.data.displayName,
    imageUrl: parsed.data.imageUrl,
    favoriteAnime: parsed.data.favoriteAnimes[0] || parsed.data.favoriteAnime,
    favoriteManga: parsed.data.favoriteMangas[0] || parsed.data.favoriteManga,
    favoriteAnimes: parsed.data.favoriteAnimes,
    favoriteMangas: parsed.data.favoriteMangas,
    favoriteGame: parsed.data.favoriteGame,
    bio: parsed.data.bio
  }
  await prisma.user.update({
    where: { id: user.id },
    data: {
      nom,
      prenom,
      telephone,
      situation,
      pays: situation === 'STUDENT_ABROAD' ? pays : null,
      profession: situation === 'PROFESSIONAL' ? profession : null,
      universite: situation === 'PROFESSIONAL' ? null : universite,
      faculte: situation === 'STUDENT_BENIN' ? faculte : null,
      filiere: situation === 'PROFESSIONAL' ? null : filiere
    }
  })
  const card = await prisma.otakuCard.upsert({
    where: { userId: user.id },
    update: { ...data, status: 'PENDING', reviewedAt: null },
    create: { ...data, userId: user.id }
  })

  setResponseStatus(event, 201)
  return { status: 201, message: 'Carte Otaku envoyée pour validation', data: card }
})
