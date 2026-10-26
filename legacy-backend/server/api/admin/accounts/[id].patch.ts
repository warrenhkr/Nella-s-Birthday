import { z } from 'zod'
import { requireAdmin } from '../../../utils/auth'
import prisma from '../../../utils/prisma'
import { adminScopeLabels, normalizeAdminScopes, unknownAdminScopes } from '../../../../shared/admin-scopes'

const RoleAssignmentSchema = z.object({
  role: z.enum(['ADMIN', 'INTERMEDIATE_ADMIN', 'SHOP_MANAGER', 'MEMBER']).optional(),
  // Périmètres d'administration (voir shared/admin-scopes.ts). Une liste vide
  // rend l'administrateur complet (comportement historique).
  adminScopes: z.array(z.string()).optional()
})

// Seuls ces rôles peuvent décider des périmètres d'un administrateur.
const SCOPE_DELEGATES = ['SUPER_ADMIN', 'INTERMEDIATE_ADMIN']

export default defineEventHandler(async (event) => {
  const { user } = await requireAdmin(event, ['supervision'])
  const id = getRouterParam(event, 'id')
  const parsed = RoleAssignmentSchema.safeParse(await readBody(event))

  if (!id || !parsed.success || (parsed.data.role === undefined && parsed.data.adminScopes === undefined)) {
    throw createError({ statusCode: 400, statusMessage: 'Rôle ou périmètres invalides' })
  }
  const nextRole = parsed.data.role
  const scopesProvided = parsed.data.adminScopes !== undefined

  // Un administrateur ne modifie pas ses propres accès : sans cette règle, un
  // ADMIN à périmètre pourrait s'octroyer un rôle hors de son périmètre (ou un
  // ADMIN_INTERMÉDIAIRE se retirer lui-même ses droits par erreur).
  if (user.id === id) {
    throw createError({ statusCode: 403, statusMessage: 'Vous ne pouvez pas modifier vos propres accès.' })
  }

  if (nextRole !== undefined) {
    if (user.role === 'ADMIN' && ['ADMIN', 'INTERMEDIATE_ADMIN'].includes(nextRole)) {
      throw createError({ statusCode: 403, statusMessage: 'Un administrateur peut uniquement gérer les gestionnaires boutique.' })
    }
    if (user.role === 'INTERMEDIATE_ADMIN' && nextRole === 'INTERMEDIATE_ADMIN') {
      throw createError({ statusCode: 403, statusMessage: 'Seul un super-admin peut nommer un administrateur intermédiaire.' })
    }
  }

  const account = await prisma.user.findFirst({
    where: { id, role: { not: 'SUPER_ADMIN' } },
    select: { id: true, role: true, adminScopes: true }
  })
  if (!account) throw createError({ statusCode: 404, statusMessage: 'Compte introuvable' })
  if (user.role === 'ADMIN' && ['ADMIN', 'INTERMEDIATE_ADMIN'].includes(account.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Un administrateur ne peut pas modifier un autre administrateur.' })
  }
  if (user.role === 'INTERMEDIATE_ADMIN' && account.role === 'INTERMEDIATE_ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Un administrateur intermédiaire ne peut pas modifier un autre administrateur intermédiaire.' })
  }

  // Rôle effectif après la requête : sert à valider les périmètres.
  const effectiveRole = nextRole ?? account.role
  let nextScopes = account.adminScopes ?? []

  if (scopesProvided) {
    const requested = parsed.data.adminScopes ?? []
    const unknown = unknownAdminScopes(requested)
    if (unknown.length > 0) {
      throw createError({ statusCode: 400, statusMessage: `Périmètre inconnu : ${unknown.join(', ')}.` })
    }
    if (!SCOPE_DELEGATES.includes(user.role)) {
      throw createError({ statusCode: 403, statusMessage: 'Seul un super-admin ou un administrateur intermédiaire peut définir les périmètres d’un administrateur.' })
    }
    if (effectiveRole !== 'ADMIN') {
      throw createError({ statusCode: 400, statusMessage: 'Les périmètres d’administration ne s’appliquent qu’à un compte administrateur (rôle ADMIN).' })
    }
    nextScopes = normalizeAdminScopes(requested)
  } else if (effectiveRole !== 'ADMIN') {
    // Retirer le rôle ADMIN retire aussi les périmètres : aucun reste de droits.
    nextScopes = []
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(nextRole !== undefined ? { role: nextRole } : {}),
      adminScopes: nextScopes
    },
    select: {
      id: true,
      email: true,
      pseudo: true,
      role: true,
      isActive: true,
      pole: true,
      poles: true,
      adminScopes: true,
      createdAt: true
    }
  })

  const roleChanged = nextRole !== undefined && account.role !== nextRole
  const scopesChanged = scopesProvided && normalizeAdminScopes(account.adminScopes).join(',') !== nextScopes.join(',')

  if (roleChanged) {
    const scopeSentence = nextScopes.length
      ? ` Tu es limité aux périmètres suivants : ${adminScopeLabels(nextScopes)}.`
      : ''

    await prisma.notification.create({
      data: {
        userId: updated.id,
        title: nextRole === 'ADMIN'
          ? 'Nouveau rôle : administrateur'
          : nextRole === 'INTERMEDIATE_ADMIN'
            ? 'Nouveau rôle : administrateur intermédiaire'
            : nextRole === 'SHOP_MANAGER'
              ? 'Nouveau rôle : gestionnaire boutique'
              : 'Rôle spécial retiré',
        body: nextRole === 'SHOP_MANAGER'
          ? 'Tu peux maintenant gérer le catalogue et les commandes depuis ton espace boutique.'
          : nextRole === 'ADMIN'
            ? `Tu peux maintenant administrer le Club Otaku depuis ton dashboard.${scopeSentence}`
            : nextRole === 'INTERMEDIATE_ADMIN'
              ? 'Tu peux maintenant administrer le Club Otaku et nommer des administrateurs.'
              : 'Ton rôle spécial a été retiré. Ton compte redevient membre.',
        type: 'ROLE_CHANGED',
        data: { previousRole: account.role, newRole: nextRole, adminScopes: nextScopes }
      }
    })
  } else if (scopesChanged) {
    await prisma.notification.create({
      data: {
        userId: updated.id,
        title: nextScopes.length ? 'Périmètres d’administration modifiés' : 'Périmètres d’administration élargis',
        body: nextScopes.length
          ? `Tu es désormais limité aux périmètres suivants : ${adminScopeLabels(nextScopes)}.`
          : 'Tu retrouves l’accès complet à l’administration du club.',
        type: 'ROLE_CHANGED',
        data: { previousScopes: normalizeAdminScopes(account.adminScopes), adminScopes: nextScopes }
      }
    })
  }

  return { status: 200, data: updated }
})
