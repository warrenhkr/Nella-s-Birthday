// ============================================================================
// PÉRIMÈTRES D'ADMINISTRATION (« adminScopes »)
// ============================================================================
//
// Demande client : un ADMIN_INTERMÉDIAIRE (ou le SUPER_ADMIN) doit pouvoir
// nommer un ADMIN limité à UNE PARTIE de l'administration — par exemple un
// administrateur qui ne gère que le GAMING, un autre que les ÉVÉNEMENTS, etc.
//
// Modèle retenu (celui du schéma Prisma, champ `User.adminScopes String[]`) :
//   • rôle ADMIN + `adminScopes` VIDE  → accès admin complet (compatibilité
//     ascendante : tous les comptes admin existants gardent leurs droits) ;
//   • rôle ADMIN + `adminScopes` NON VIDE → l'administrateur n'a accès qu'aux
//     périmètres listés, côté serveur (gardes des routes API) ET côté
//     interface (middlewares de pages, navigation, onglets) ;
//   • SUPER_ADMIN et INTERMEDIATE_ADMIN → jamais limités (droits actuels
//     inchangés) ; les périmètres ne sont stockés que pour le rôle ADMIN.
//
// Ce fichier est LA source unique de vérité : il est importé par le serveur
// (server/utils/auth.ts), par l'interface (middlewares, navigation, écrans
// d'administration) et par le test unitaire scripts/test-admin-scopes-unit.mjs.
//
// Les périmètres reprennent EXACTEMENT les domaines réellement présents dans
// le code (routes serveur + écrans de l'espace admin) — aucun domaine inventé :
//
//   gaming        /api/tournaments/**, /api/teams/admin        /dashboard-gaming
//   evenementiel  POST|PATCH /api/events, /api/events/bulk,
//                 /api/admin/events/**, /api/admin/imports/**  /dashboard-evenementiel
//   moderation    /api/admin/gallery/**                        /dashboard-moderation
//   communication DELETE /api/communaute/posts/[id]            /dashboard-communication
//   membres       /api/admin/cards/**, /api/admin/members      /dashboard (onglet Cartes)
//   supervision   /api/admin/admins/**, /api/admin/accounts/**,
//                 /api/admin/stats                             /dashboard (onglets Admins/Comptes)
//
// La BOUTIQUE n'est volontairement pas un périmètre délégable : le code en
// place exclut explicitement le rôle ADMIN de l'espace boutique
// (requireShopManager n'accepte que shop_manager et intermediate_admin, et le
// middleware `shop` renvoie un ADMIN vers /dashboard). Un « admin limité à la
// boutique » s'obtient avec le rôle SHOP_MANAGER existant, inchangé.
// ============================================================================

export const ADMIN_SCOPES = [
  {
    value: 'gaming',
    label: 'Gaming',
    description: 'Tournois, inscriptions, équipes et matchs.',
    home: '/dashboard-gaming'
  },
  {
    value: 'evenementiel',
    label: 'Événementiel',
    description: 'Création et suivi des événements, imports et médias associés.',
    home: '/dashboard-evenementiel'
  },
  {
    value: 'communication',
    label: 'Communication',
    description: 'Fil d’actualité de la communauté : publications et retraits.',
    home: '/dashboard-communication'
  },
  {
    value: 'moderation',
    label: 'Modération',
    description: 'Galerie : validation, publication et suppression des médias.',
    home: '/dashboard-moderation'
  },
  {
    value: 'membres',
    label: 'Membres et cartes',
    description: 'Cartes Otaku à valider et annuaire des membres.',
    home: '/dashboard'
  },
  {
    value: 'supervision',
    label: 'Comptes et délégation',
    description: 'Création d’administrateurs, attribution des rôles et des périmètres.',
    home: '/dashboard'
  }
] as const

export type AdminScope = typeof ADMIN_SCOPES[number]['value']

export const ADMIN_SCOPE_VALUES: readonly AdminScope[] = ADMIN_SCOPES.map(scope => scope.value)

export function isAdminScope(value: unknown): value is AdminScope {
  return typeof value === 'string' && (ADMIN_SCOPE_VALUES as readonly string[]).includes(value)
}

export function unknownAdminScopes(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input.filter(item => !isAdminScope(item)).map(item => String(item))
}

/**
 * Nettoie une valeur quelconque (corps de requête, base...) en liste de
 * périmètres connus, dédupliquée et dans l'ordre canonique.
 */
export function normalizeAdminScopes(input: unknown): AdminScope[] {
  if (!Array.isArray(input)) return []
  const retained = new Set<string>()
  for (const item of input) {
    if (isAdminScope(item)) retained.add(item)
  }
  return ADMIN_SCOPE_VALUES.filter(value => retained.has(value))
}

export function adminScopeLabel(value: string): string {
  const scope = ADMIN_SCOPES.find(candidate => candidate.value === value)
  return scope ? scope.label : value
}

export function adminScopeLabels(scopes: readonly string[]): string {
  const labels = normalizeAdminScopes(scopes).map(scope => adminScopeLabel(scope))
  return labels.length ? labels.join(', ') : 'aucun'
}

/**
 * Limites effectives d'un compte. Renvoie :
 *   • `null` → aucune limite (SUPER_ADMIN, INTERMEDIATE_ADMIN, SHOP_MANAGER,
 *     MEMBER, ou ADMIN dont `adminScopes` est vide = compatibilité) ;
 *   • la liste des périmètres → ADMIN explicitement limité ;
 *   • une liste VIDE alors que `adminScopes` n'était pas vide → périmètre
 *     inconnu/corrompu : AUCUN accès admin (échec fermé, jamais d'élargissement
 *     silencieux si une valeur n'existe plus).
 */
export function adminScopeFilter(role: string, adminScopes: readonly string[]): AdminScope[] | null {
  if (role !== 'ADMIN') return null
  const raw = Array.isArray(adminScopes) ? adminScopes : []
  const scopes = normalizeAdminScopes(raw)
  if (scopes.length === 0) return raw.length === 0 ? null : []
  return scopes
}

/**
 * Décision unique « ce compte peut-il agir sur ce périmètre ? ».
 * C'est la règle réutilisée par les gardes serveur ET par l'interface.
 */
export function canUseAdminScope(role: string, adminScopes: readonly string[], required: readonly AdminScope[]): boolean {
  const limit = adminScopeFilter(role, adminScopes)
  if (limit === null) return true
  const needed = normalizeAdminScopes(required)
  // Périmètre non déclaré : un admin limité n'obtient rien (échec fermé).
  if (needed.length === 0) return false
  return needed.some(scope => limit.includes(scope))
}

// ----------------------------------------------------------------------------
// Pages de l'espace admin → périmètre requis (middleware `admin`)
// ----------------------------------------------------------------------------
export type AdminScopePageRule = {
  path: string
  scopes: AdminScope[]
  prefix?: boolean
}

export const ADMIN_SCOPE_PAGES: readonly AdminScopePageRule[] = [
  { path: '/dashboard-gaming', scopes: ['gaming'] },
  { path: '/gaming-tournoi-', scopes: ['gaming'], prefix: true },
  { path: '/dashboard-evenementiel', scopes: ['evenementiel'] },
  { path: '/dashboard-communication', scopes: ['communication'] },
  { path: '/dashboard-moderation', scopes: ['moderation'] },
  { path: '/dashboard', scopes: ['membres', 'supervision'] }
]

/**
 * Périmètres qui ouvrent une page de l'espace admin.
 * `null` = page non soumise aux périmètres.
 */
export function scopesForAdminPage(path: string): AdminScope[] | null {
  const clean = (path.split('?')[0] || '/').replace(/\/+$/, '') || '/'
  for (const rule of ADMIN_SCOPE_PAGES) {
    const matches = rule.prefix ? clean.startsWith(rule.path) : clean === rule.path
    if (matches) return [...rule.scopes]
  }
  return null
}

/**
 * Première page accessible pour une liste de périmètres.
 *
 * Liste vide = administrateur complet → /dashboard. Si `adminScopes` contient
 * des valeurs mais AUCUNE valide (périmètre corrompu), on renvoie l'espace
 * membre : l'administrateur n'a aucun accès admin et ne peut donc pas être
 * redirigé vers une page admin (donc jamais de boucle de redirection).
 */
export function adminHomeFor(adminScopes: readonly string[]): string {
  const raw = Array.isArray(adminScopes) ? adminScopes : []
  const scopes = normalizeAdminScopes(raw)
  for (const value of scopes) {
    const scope = ADMIN_SCOPES.find(candidate => candidate.value === value)
    if (scope) return scope.home
  }
  return raw.length === 0 ? '/dashboard' : '/espace-membre'
}
