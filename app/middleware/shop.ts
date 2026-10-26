// Rôles autorisés à atteindre l'espace boutique (middleware `shop`).
// L'INTERMEDIATE_ADMIN y figure : il a EXACTEMENT les mêmes droits que le
// SHOP_MANAGER sur la boutique (aligné sur requireShopManager).
// Le SUPER_ADMIN est EXCLU (décision produit) : il suit l'avancement et traite
// les signalements ; pour la boutique il utilise un compte dédié.
const allowedRoles = ['INTERMEDIATE_ADMIN', 'SHOP_MANAGER']

// Espace naturel d'un rôle qui n'a rien à faire ici.
// Permet de renvoyer chaque rôle vers son propre espace au lieu de la page de
// connexion (un utilisateur déjà connecté ne doit jamais être envoyé vers
// /auth) et garantit un comportement identique en SSR et côté client.
function redirectTargetFor(role: string): string | undefined {
  if (allowedRoles.includes(role)) return undefined
  if (role === 'SUPER_ADMIN') return '/dashboard-super-admin'
  if (role === 'ADMIN') return '/dashboard'
  if (role === 'MEMBER') return '/espace-membre'
  return '/auth'
}

export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) {
    try {
      const requestFetch = useRequestFetch()
      const response = await requestFetch<{ data: { user: { role: string } } }>('/api/auth/me')
      const redirect = redirectTargetFor(response.data.user.role)
      if (redirect) return navigateTo(redirect)
    } catch {
      return navigateTo('/auth')
    }

    return
  }

  const { user, refresh } = useAuth()
  if (!user.value) await refresh()
  if (!user.value) return navigateTo('/auth')
  const redirect = redirectTargetFor(user.value.role)
  if (redirect) return navigateTo(redirect)
})
