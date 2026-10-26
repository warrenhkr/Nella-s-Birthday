export type AuthUser = {
  id: string
  email: string
  pseudo: string
  role: 'SUPER_ADMIN' | 'INTERMEDIATE_ADMIN' | 'ADMIN' | 'SHOP_MANAGER' | 'MEMBER'
  /** Pôle principal (premier pôle choisi) — conservé pour la compatibilité. */
  pole: string | null
  /** Multi-pôles : tous les pôles du membre (union « poles + pole »). */
  poles: string[]
  /**
   * Périmètres d'administration (voir shared/admin-scopes.ts). Liste vide =
   * administrateur complet (comportement historique) ; seuls les comptes
   * `ADMIN` peuvent être limités.
   */
  adminScopes: string[]
  nom: string | null
  prenom: string | null
  telephone: string | null
  situation: 'STUDENT_BENIN' | 'STUDENT_ABROAD' | 'PROFESSIONAL' | null
  pays: string | null
  profession: string | null
  universite: string | null
  faculte: string | null
  filiere: string | null
}

export type AuthProfile = {
  id: string
  userId: string
  avatar: string | null
  bio: string | null
  level: string
  role: AuthUser['role']
}

type AuthResponse = {
  data: {
    user: AuthUser
    profile: AuthProfile | null
  }
}

export function useAuth() {
  const user = useState<AuthUser | null>('otaku-auth-user', () => null)
  const profile = useState<AuthProfile | null>('otaku-auth-profile', () => null)
  const isLoading = useState<boolean>('otaku-auth-loading', () => false)
  const isReady = useState<boolean>('otaku-auth-ready', () => false)

  async function refresh() {
    isLoading.value = true

    try {
      const response = await $fetch<AuthResponse>('/api/auth/me')
      user.value = response.data.user
      profile.value = response.data.profile
      return response.data
    } catch {
      user.value = null
      profile.value = null
      return null
    } finally {
      isLoading.value = false
      isReady.value = true
    }
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
    profile.value = null
    await navigateTo('/auth')
  }

  return {
    user: readonly(user),
    profile: readonly(profile),
    isLoading: readonly(isLoading),
    isReady: readonly(isReady),
    isAuthenticated: computed(() => Boolean(user.value)),
    refresh,
    logout
  }
}
