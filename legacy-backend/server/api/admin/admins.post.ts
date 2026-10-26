import { AdminCreateSchema } from '../../schemas/index'
import prisma from '../../utils/prisma'
import { hashPassword } from '../../utils/password'
import { requireAdmin } from '../../utils/auth'
import { adminScopeLabels, normalizeAdminScopes, unknownAdminScopes } from '../../../shared/admin-scopes'

// Règle de délégation des PÉRIMÈTRES : seuls un SUPER_ADMIN et un
// ADMIN_INTERMÉDIAIRE peuvent décider des domaines confiés à un administrateur.
// Un ADMIN (même s'il possède le périmètre `supervision`) ne peut pas en
// attribuer : il ne doit pas pouvoir élargir les accès d'un tiers ni créer un
// compte qui échapperait aux siens.
const SCOPE_DELEGATES = ['SUPER_ADMIN', 'INTERMEDIATE_ADMIN']

export default defineEventHandler(async (event) => {
  const { user } = await requireAdmin(event, ['supervision'])

  const parsed = AdminCreateSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: parsed.error.flatten()
    })
  }
  if (parsed.data.role === 'INTERMEDIATE_ADMIN' && user.role !== 'SUPER_ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Seul un super-admin peut nommer un administrateur intermédiaire.' })
  }
  if (parsed.data.role === 'ADMIN' && !['SUPER_ADMIN', 'INTERMEDIATE_ADMIN'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Seul un super-admin ou un administrateur intermédiaire peut créer un administrateur.' })
  }

  // ── Périmètres demandés ────────────────────────────────────────────────
  const requestedScopes = parsed.data.adminScopes ?? []
  if (requestedScopes.length > 0) {
    const unknown = unknownAdminScopes(requestedScopes)
    if (unknown.length > 0) {
      throw createError({ statusCode: 400, statusMessage: `Périmètre inconnu : ${unknown.join(', ')}.` })
    }
    if (parsed.data.role !== 'ADMIN') {
      throw createError({ statusCode: 400, statusMessage: 'Les périmètres d’administration ne s’appliquent qu’à un compte administrateur (rôle ADMIN).' })
    }
    if (!SCOPE_DELEGATES.includes(user.role)) {
      throw createError({ statusCode: 403, statusMessage: 'Seul un super-admin ou un administrateur intermédiaire peut définir les périmètres d’un administrateur.' })
    }
  }
  // Un périmètre vide = administrateur complet (comportement historique).
  const adminScopes = normalizeAdminScopes(requestedScopes)

  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email: parsed.data.email }, { pseudo: parsed.data.pseudo }] }
  })
  if (existingUser) {
    throw createError({ statusCode: 409, statusMessage: 'Cet email ou ce pseudo est déjà utilisé.' })
  }

  const admin = await prisma.user.create({
    data: {
      email: parsed.data.email,
      pseudo: parsed.data.pseudo,
      password: await hashPassword(parsed.data.password),
      role: parsed.data.role,
      pole: parsed.data.pole,
      adminScopes
    },
    select: { id: true, email: true, pseudo: true, role: true, isActive: true, pole: true, poles: true, adminScopes: true, createdAt: true }
  })

  const scopeSentence = adminScopes.length
    ? ` Tu es limité aux périmètres suivants : ${adminScopeLabels(adminScopes)}.`
    : ''

  await prisma.notification.create({
    data: {
      userId: admin.id,
      title: parsed.data.role === 'SHOP_MANAGER' ? 'Nouveau rôle : gestionnaire boutique' : parsed.data.role === 'INTERMEDIATE_ADMIN' ? 'Nouveau rôle : administrateur intermédiaire' : 'Nouveau rôle : administrateur',
      body: parsed.data.role === 'SHOP_MANAGER'
        ? 'Tu peux gérer le catalogue et les commandes depuis ton espace boutique.'
        : parsed.data.role === 'INTERMEDIATE_ADMIN'
          ? 'Tu peux administrer le Club Otaku et nommer des administrateurs.'
          : `Tu peux administrer le Club Otaku depuis ton dashboard.${scopeSentence}`,
      type: 'ROLE_CHANGED',
      data: { newRole: parsed.data.role, adminScopes }
    }
  })

  setResponseStatus(event, 201)
  return { status: 201, message: 'Administrateur créé avec succès', data: { admin } }
})
