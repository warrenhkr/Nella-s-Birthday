import { adminHomeFor } from '#shared/admin-scopes'

export type AppRole = 'SUPER_ADMIN' | 'INTERMEDIATE_ADMIN' | 'ADMIN' | 'SHOP_MANAGER' | 'MEMBER'

/**
 * Espace d'accueil d'un rôle après connexion.
 *
 * Pour un ADMIN limité à des périmètres (`adminScopes`), l'accueil est la
 * première page de SES périmètres (ex. /dashboard-gaming pour un admin
 * « gaming ») ; sans périmètre il garde /dashboard, comme avant. Les autres
 * rôles sont inchangés.
 */
export function getRoleHome(role: string, adminScopes: readonly string[] = []): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return '/dashboard-super-admin'
    case 'ADMIN':
      return adminHomeFor(adminScopes)
    case 'INTERMEDIATE_ADMIN':
      return '/dashboard'
    case 'SHOP_MANAGER':
      return '/boutique-dashboard'
    default:
      return '/espace-membre'
  }
}
