import { UserLoginSchema } from '../../schemas/index'
import prisma from '../../utils/prisma'
import { verifyPassword } from '../../utils/password'
import { setSession } from '../../utils/session'
import { enforceRateLimit } from '../../utils/rate-limit'
import { primaryPoleOf, resolveUserPoles } from '#shared/poles'

export default defineEventHandler(async (event) => {
  // Anti force-brute : 10 tentatives par IP et par tranche de 5 minutes.
  // (Ce limiteur est en mémoire, donc par instance : il arrête les attaques
  // simples, mais un hébergement serverless demanderait un stockage partagé
  // pour être totalement fiable.)
  enforceRateLimit(event, 'auth-login', 10, 5 * 60 * 1000, 'Trop de tentatives de connexion. Réessaie dans quelques minutes.')

  const body = await readBody(event)

  // Validate input
  const parsed = UserLoginSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: parsed.error.flatten()
    })
  }

  const { email, password } = parsed.data

  let user
  try {
    user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true }
    })
  } catch (error) {
    console.error('[auth/login] Database lookup failed:', error)
    throw createError({
      statusCode: 503,
      statusMessage: 'Service de connexion indisponible. Vérifiez la base de données.'
    })
  }

  let passwordIsValid = false
  try {
    passwordIsValid = Boolean(user && await verifyPassword(password, user.password))
  } catch (error) {
    console.error('[auth/login] Password verification failed:', error)
  }

  if (!user || !passwordIsValid) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Identifiants invalides'
    })
  }

  try {
    await setSession(event, user.id)
  } catch (error) {
    console.error('[auth/login] Session creation failed:', error)
    throw createError({
      statusCode: 503,
      statusMessage: 'Impossible de créer la session de connexion.'
    })
  }

  return {
    status: 200,
    message: 'Connexion réussie',
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
