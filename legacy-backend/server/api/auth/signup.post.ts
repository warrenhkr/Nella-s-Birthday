import { UserSignUpSchema } from '../../schemas/index'
import prisma from '../../utils/prisma'
import { hashPassword } from '../../utils/password'
import { setSession } from '../../utils/session'
import { enforceRateLimit } from '../../utils/rate-limit'
import { primaryPoleOf, resolveUserPoles } from '#shared/poles'

export default defineEventHandler(async (event) => {
  // Création de compte : 5 inscriptions par IP et par heure (limiteur mémoire,
  // cf. commentaire détaillé dans auth/login.post.ts).
  enforceRateLimit(event, 'auth-signup', 5, 60 * 60 * 1000, 'Trop de créations de compte. Réessaie plus tard.')

  const body = await readBody(event)

  // Validate input
  const parsed = UserSignUpSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: parsed.error.flatten()
    })
  }

  const { email, password, pseudo, pole, bio, avatar_url, nom, prenom, telephone, situation, pays, profession, universite, faculte, filiere } = parsed.data
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { pseudo }]
    }
  })

  if (existingUser) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Cet email ou ce pseudo est déjà utilisé.'
    })
  }

  const user = await prisma.user.create({
    data: {
      email,
      pseudo,
      password: await hashPassword(password),
      pole,
      // Multi-pôles : un compte peut appartenir à plusieurs pôles. À
      // l'inscription on démarre avec le pôle principal choisi ; l'écran
      // « Mon profil » permet d'en ajouter d'autres ensuite.
      poles: [pole],
      nom,
      prenom,
      telephone,
      situation,
      pays: situation === 'STUDENT_ABROAD' ? pays : null,
      profession: situation === 'PROFESSIONAL' ? profession : null,
      universite: situation === 'PROFESSIONAL' ? null : universite,
      faculte: situation === 'STUDENT_BENIN' ? faculte : null,
      filiere: situation === 'PROFESSIONAL' ? null : filiere,
      profile: {
        create: {
          bio: bio || null,
          avatar: avatar_url || null
        }
      }
    },
    include: { profile: true }
  })

  await setSession(event, user.id)

  return {
    status: 201,
    message: 'Inscription réussie',
    data: {
      user: {
        id: user.id,
        email: user.email,
        pseudo: user.pseudo,
        role: user.role,
        pole: primaryPoleOf(user),
        poles: resolveUserPoles(user)
      },
      profile: user.profile
    }
  }
})
