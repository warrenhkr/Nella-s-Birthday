// Middleware `auth` : exige un utilisateur connecté (espace membre, équipes,
// événements...).
//
// ⚠️ CORRECTIF DU 11/09/2026 — cette version corrige un bug constaté en
// production : un membre CONNECTÉ qui ouvrait /espace-membre ou /equipes par son
// URL (lien, favori, rafraîchissement) était renvoyé vers /auth, alors que
// /api/auth/me répondait bien 200 avec le même cookie.
//
// Cause : en SSR, `useAuth().refresh()` appelait /api/auth/me SANS transmettre
// le cookie de la requête entrante ; l'appel renvoyait 401, le middleware
// concluait « non connecté » et redirigeait. Les middlewares `shop`, `admin` et
// `super-admin` avaient déjà la parade (useRequestFetch, qui transmet les
// cookies) — pas celui-ci.
export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) {
    try {
      const requestFetch = useRequestFetch()
      const response = await requestFetch<{ data: { user: { role: string } } }>('/api/auth/me')
      if (response?.data?.user) return
    } catch {
      return navigateTo('/auth')
    }

    // Réponse valide mais sans utilisateur : la session n'est pas valide.
    return navigateTo('/auth')
  }

  const { user, refresh } = useAuth()
  if (!user.value) await refresh()
  if (!user.value) return navigateTo('/auth')
})
