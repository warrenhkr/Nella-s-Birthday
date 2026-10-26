// Seul le SUPER_ADMIN a accès à cet espace ; les autres rôles sont renvoyés
// vers leur propre espace (et jamais vers /auth s'ils sont déjà connectés).
// Le comportement est identique en SSR et côté client.
function redirectTargetFor(role: string): string | undefined {
  if (role === 'SUPER_ADMIN') return undefined
  if (role === 'ADMIN' || role === 'INTERMEDIATE_ADMIN') return '/dashboard'
  if (role === 'SHOP_MANAGER') return '/boutique-dashboard'
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
