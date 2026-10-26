import { adminHomeFor, canUseAdminScope, scopesForAdminPage } from '#shared/admin-scopes'

// Rôles autorisés dans l'espace d'administration opérationnelle.
const allowedRoles = ['ADMIN', 'INTERMEDIATE_ADMIN']

// Chaque rôle non autorisé est renvoyé vers SON espace : le SUPER_ADMIN vers sa
// supervision, le SHOP_MANAGER vers la boutique (et non vers /espace-membre).
// Comportement identique en SSR et côté client.
//
// PÉRIMÈTRES : un ADMIN dont `adminScopes` est non vide n'ouvre que les pages
// de ses périmètres (voir shared/admin-scopes.ts). Toute autre page de l'espace
// admin le renvoie vers la première page de SON périmètre — jamais d'erreur,
// jamais de page blanche. Les autres rôles ne sont pas limités (et un ADMIN
// sans périmètre garde l'accès complet, comme avant).
function redirectTargetFor(role: string, adminScopes: readonly string[], path: string): string | undefined {
  if (!allowedRoles.includes(role)) {
    if (role === 'SUPER_ADMIN') return '/dashboard-super-admin'
    if (role === 'SHOP_MANAGER') return '/boutique-dashboard'
    if (role === 'MEMBER') return '/espace-membre'
    return '/auth'
  }

  const required = scopesForAdminPage(path)
  if (required && !canUseAdminScope(role, adminScopes, required)) {
    const home = adminHomeFor(adminScopes)
    // Garde-fou anti-boucle : si la page d'accueil calculée est la page
    // courante, on la laisse s'ouvrir (cas d'un périmètre corrompu en base).
    if (home === path) return undefined
    return home
  }

  return undefined
}

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) {
    try {
      const requestFetch = useRequestFetch()
      const response = await requestFetch<{ data: { user: { role: string, adminScopes?: string[] } } }>('/api/auth/me')
      const user = response.data.user
      const redirect = redirectTargetFor(user.role, user.adminScopes ?? [], to.path)
      if (redirect) return navigateTo(redirect)
    } catch {
      return navigateTo('/auth')
    }

    return
  }

  const { user, refresh } = useAuth()
  if (!user.value) await refresh()
  if (!user.value) return navigateTo('/auth')
  const redirect = redirectTargetFor(user.value.role, user.value.adminScopes ?? [], to.path)
  if (redirect) return navigateTo(redirect)
})
