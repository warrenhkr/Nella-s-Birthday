import prisma from '../../../utils/prisma'
import { requireSuperAdmin } from '../../../utils/auth'
import { adminScopeLabels, normalizeAdminScopes, unknownAdminScopes } from '../../../../shared/admin-scopes'

// Réservé au SUPER_ADMIN : activer/désactiver un compte spécial et (nouveau)
// ajuster ses PÉRIMÈTRES d'administration. Un périmètre vide = administrateur
// complet.
export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody<{ isActive?: boolean, adminScopes?: string[] }>(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Administrateur introuvable' })
  }
  if (body?.isActive !== undefined && typeof body.isActive !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'Statut administrateur invalide' })
  }
  if (body?.adminScopes !== undefined && !Array.isArray(body.adminScopes)) {
    throw createError({ statusCode: 400, statusMessage: 'Périmètres d’administration invalides' })
  }
  if (body?.isActive === undefined && body?.adminScopes === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'Statut ou périmètres administrateur invalides' })
  }

  const admin = await prisma.user.findFirst({ where: { id, role: { in: ['ADMIN', 'INTERMEDIATE_ADMIN', 'SHOP_MANAGER'] } } })
  if (!admin) throw createError({ statusCode: 404, statusMessage: 'Administrateur introuvable' })

  let nextScopes = admin.adminScopes ?? []
  if (body.adminScopes !== undefined) {
    const unknown = unknownAdminScopes(body.adminScopes)
    if (unknown.length > 0) {
      throw createError({ statusCode: 400, statusMessage: `Périmètre inconnu : ${unknown.join(', ')}.` })
    }
    if (admin.role !== 'ADMIN') {
      throw createError({ statusCode: 400, statusMessage: 'Les périmètres d’administration ne s’appliquent qu’à un compte administrateur (rôle ADMIN).' })
    }
    nextScopes = normalizeAdminScopes(body.adminScopes)
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(body.adminScopes !== undefined ? { adminScopes: nextScopes } : {})
    },
    select: { id: true, email: true, pseudo: true, role: true, isActive: true, pole: true, poles: true, adminScopes: true, createdAt: true }
  })

  if (body.isActive === false) {
    await prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } })
  }

  if (body.adminScopes !== undefined) {
    await prisma.notification.create({
      data: {
        userId: id,
        title: nextScopes.length ? 'Périmètres d’administration modifiés' : 'Périmètres d’administration élargis',
        body: nextScopes.length
          ? `Tu es désormais limité aux périmètres suivants : ${adminScopeLabels(nextScopes)}.`
          : 'Tu retrouves l’accès complet à l’administration du club.',
        type: 'ROLE_CHANGED',
        data: { previousScopes: normalizeAdminScopes(admin.adminScopes), adminScopes: nextScopes }
      }
    })
  }

  return { status: 200, data: updated }
})
