// scripts/test-shop-guard-matrix.mjs
//
// Vérification STATIQUE EXÉCUTABLE (aucun serveur requis) de la matrice de
// rôles réellement autorisée par les gardes du projet.
//
// Ce script ne réimplémente PAS les règles : il lit le code source réel
// (server/utils/auth.ts) et évalue les listes de rôles passées à requireRole(),
// puis liste chaque route qui appelle chaque garde. Toute divergence entre
// requireShopManager (serveur) et app/middleware/shop.ts (interface) est
// signalée comme une erreur.
//
// Usage : node scripts/test-shop-guard-matrix.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const ROLES = ['SUPER_ADMIN', 'INTERMEDIATE_ADMIN', 'ADMIN', 'SHOP_MANAGER', 'MEMBER']

// ---------------------------------------------------------------------------
// 1. Gardes serveur : on lit auth.ts et on évalue les appels requireRole(...)
// ---------------------------------------------------------------------------
const authSource = readFileSync(join(root, 'server/utils/auth.ts'), 'utf8')

// ─────────────────────────────────────────────────────────────────────────────
// CAUSE RACINE DU CRASH PRÉCÉDENT : ce parseur ne connaissait qu'UNE forme
// d'appel — `requireRole(event, 'role_a', 'role_b')`. Depuis l'ajout des
// périmètres d'administration (shared/admin-scopes.ts), requireAdmin,
// requireAdminOps et requireEventManager délèguent à
// `requireScopedRole(event, ['perimetre'], 'role_a', 'role_b')` : le motif ne
// matchait plus rien pour requireAdmin et le script mourait sur
// « appel requireRole introuvable dans requireAdmin » (exit 1) sans rien
// vérifier. Le parseur couvre désormais les DEUX formes réelles.
// ─────────────────────────────────────────────────────────────────────────────
function guardSource(functionName) {
  const match = authSource.match(new RegExp(`export async function ${functionName}\\([\\s\\S]*?\\n\\}`))
  if (!match) throw new Error(`garde introuvable : ${functionName}`)
  return match[0]
}

/** Rôles (majuscules) réellement passés à la garde — lus dans le code source. */
function guardRoles(functionName) {
  const body = guardSource(functionName)
  // Forme 1 : requireRole(event, 'a', 'b')            (garde simple)
  // Forme 2 : requireScopedRole(event, scopes, 'a')   (garde + périmètre)
  //           requireScopedRole(event, ['gaming'], 'a', 'b')  (périmètre littéral)
  const call = body.match(/require(?:Scoped)?Role\(event((?:\s*,\s*(?:scopes\b|\[[^\]]*\]|'[a-z_]+'))+)\)/)
  if (!call) throw new Error(`appel requireRole/requireScopedRole introuvable dans ${functionName}`)
  return [...call[1].matchAll(/'([a-z_]+)'/g)].map(hit => hit[1].toUpperCase())
}

/**
 * Périmètres exigés par la garde :
 *   null  = la garde n'est pas soumise aux périmètres (SUPER_ADMIN / INTERMEDIATE_ADMIN
 *           / SHOP_MANAGER ne sont jamais limités) ;
 *   []    = garde stricte sans périmètre déclaré ;
 *   [...] = liste lue dans le code source (null quand elle vient du paramètre `scopes`).
 */
function guardScopes(functionName) {
  const body = guardSource(functionName)
  const call = body.match(/requireScopedRole\(event\s*,\s*(\[[^\]]*\]|scopes\b)/)
  if (!call) return null
  if (call[1] === 'scopes') return { dynamic: true, scopes: [] }
  return { dynamic: false, scopes: [...call[1].matchAll(/'([a-z_]+)'/g)].map(hit => hit[1]) }
}

const guards = {
  requireAdmin: guardRoles('requireAdmin'),
  requireAdminOps: guardRoles('requireAdminOps'),
  requireEventManager: guardRoles('requireEventManager'),
  requireShopManager: guardRoles('requireShopManager'),
  requireSuperAdmin: guardRoles('requireSuperAdmin')
}

const scopes = {
  requireAdmin: guardScopes('requireAdmin'),
  requireAdminOps: guardScopes('requireAdminOps'),
  requireEventManager: guardScopes('requireEventManager'),
  requireShopManager: guardScopes('requireShopManager'),
  requireSuperAdmin: guardScopes('requireSuperAdmin')
}

// ---------------------------------------------------------------------------
// 2. Middlewares d'interface
// ---------------------------------------------------------------------------
function middlewareRoles(file) {
  const source = readFileSync(join(root, 'app/middleware', file), 'utf8')
  const match = source.match(/const allowedRoles = \[([^\]]*)\]/)
  return match ? [...match[1].matchAll(/'([A-Z_]+)'/g)].map(hit => hit[1]) : []
}

const middleware = {
  'middleware admin': middlewareRoles('admin.ts'),
  'middleware shop': middlewareRoles('shop.ts'),
  // super-admin.ts n'a pas de liste `allowedRoles` : il s'appuie sur
  // redirectTargetFor(), qui laisse passer le seul SUPER_ADMIN.
  'middleware super-admin': ['SUPER_ADMIN (seul, via redirectTargetFor)']
}

// ---------------------------------------------------------------------------
// 3. Routes qui appellent chaque garde
// ---------------------------------------------------------------------------
function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

const routeFiles = walk(join(root, 'server/api')).filter(file => file.endsWith('.ts'))
const routeUsage = {}
for (const guard of Object.keys(guards)) routeUsage[guard] = []
for (const file of routeFiles) {
  const source = readFileSync(file, 'utf8')
  for (const guard of Object.keys(guards)) {
    // `guard(event)` ET `guard(event, [périmètres])` : la seconde forme est
    // celle de toutes les routes à périmètre, elle n'était pas détectée avant
    // (le rapport annonçait donc « 0 route » pour requireAdmin / requireEventManager).
    if (new RegExp(`\\b${guard}\\(event[,)]`).test(source)) {
      routeUsage[guard].push(relative(root, file).replace(/\\/g, '/'))
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Rapport
// ---------------------------------------------------------------------------
function cell(allowed) {
  return allowed ? ' OK ' : ' -- '
}

console.log('=== Matrice des gardes serveur (lue dans server/utils/auth.ts) ===\n')
console.log(`role`.padEnd(20) + Object.keys(guards).map(name => name.padEnd(20)).join(''))
for (const role of ROLES) {
  const row = Object.values(guards).map(roles => cell(roles.includes(role)).padEnd(20)).join('')
  console.log(role.padEnd(20) + row)
}

console.log('\n=== Périmètre (adminScopes) exigé par chaque garde ===')
for (const [guard, info] of Object.entries(scopes)) {
  const label = info === null
    ? 'aucun (garde de rôle pur)'
    : info.dynamic
      ? 'fourni par la route (paramètre `scopes`)'
      : `[${info.scopes.join(', ')}] (littéral, dans auth.ts)`
  console.log(`  ${guard.padEnd(20)} ${label}`)
}

console.log('\n=== Routes serveur par garde ===')
for (const [guard, files] of Object.entries(routeUsage)) {
  console.log(`\n${guard} (${files.length}) :`)
  for (const file of files) console.log(`  - ${file}`)
}

console.log('\n=== Middlewares d\'interface ===')
for (const [name, roles] of Object.entries(middleware)) {
  console.log(`  ${name.padEnd(24)} → ${roles.join(', ') || '(tous)'}`)
}

// ---------------------------------------------------------------------------
// 5. Assertions
// ---------------------------------------------------------------------------
const failures = []
const assert = (condition, message) => { if (!condition) failures.push(message) }

assert(guards.requireShopManager.includes('INTERMEDIATE_ADMIN'),
  'requireShopManager doit inclure INTERMEDIATE_ADMIN (parité avec SHOP_MANAGER)')
assert(guards.requireShopManager.includes('SHOP_MANAGER'),
  'requireShopManager doit inclure SHOP_MANAGER')
assert(!guards.requireShopManager.includes('SUPER_ADMIN'),
  'requireShopManager ne doit PAS inclure SUPER_ADMIN (décision produit : il supervise, il n\'exploite pas)')
assert(!guards.requireShopManager.includes('ADMIN'),
  'requireShopManager ne doit PAS inclure ADMIN (aucun écran boutique pour ADMIN)')
assert(!guards.requireShopManager.includes('MEMBER'),
  'requireShopManager ne doit PAS inclure MEMBER')
assert(!guards.requireEventManager.includes('SUPER_ADMIN'),
  'requireEventManager ne doit PAS inclure SUPER_ADMIN (règle métier documentée)')
assert(middleware['middleware shop'].includes('INTERMEDIATE_ADMIN'),
  "middleware shop doit inclure INTERMEDIATE_ADMIN (sinon redirection /dashboard → interface bloquée)")
assert(middleware['middleware shop'].includes('SHOP_MANAGER'),
  'middleware shop doit inclure SHOP_MANAGER')
assert(!middleware['middleware shop'].includes('SUPER_ADMIN'),
  'middleware shop ne doit PAS inclure SUPER_ADMIN (décision produit)')
assert(!middleware['middleware shop'].includes('ADMIN'),
  'middleware shop ne doit PAS inclure ADMIN')

// Parité stricte entre la garde serveur et le middleware d'interface boutique.
const serverShop = [...guards.requireShopManager].sort().join(',')
const uiShop = [...middleware['middleware shop']].sort().join(',')
assert(serverShop === uiShop,
  `parité serveur/interface boutique rompue : serveur=[${serverShop}] interface=[${uiShop}]`)

// Toutes les routes boutique (pour vérifier la couverture des gardes).
const boutiqueRoutes = routeFiles
  .map(file => relative(root, file).replace(/\\/g, '/'))
  .filter(file => file.startsWith('server/api/boutique/'))

// Routes boutique volontairement publiques (la vitrine publique /boutique doit
// s'afficher sans connexion) : lecture seule, aucune écriture.
// (La route héritée /api/boutique/categories a été supprimée le 11/09/2026 :
// aucun consommateur, les catégories viennent de #shared/product-categories.)
const PUBLIC_BOUTIQUE_ROUTES = new Set([
  'server/api/boutique/index.get.ts',
  'server/api/boutique/products/[id]/reviews.get.ts'
])

// Routes boutique réservées aux membres connectés (commander, laisser un avis) :
// elles utilisent requireAuth, pas requireShopManager — c'est voulu.
const MEMBER_BOUTIQUE_ROUTES = new Set([
  'server/api/boutique/orders.post.ts',
  'server/api/boutique/products/[id]/reviews.post.ts'
])

const unprotected = boutiqueRoutes.filter((file) => {
  const source = readFileSync(join(root, file), 'utf8')
  return !/requireShopManager\(event\)/.test(source)
    && !PUBLIC_BOUTIQUE_ROUTES.has(file)
    && !MEMBER_BOUTIQUE_ROUTES.has(file)
})
for (const file of unprotected) {
  assert(false, `route boutique sans requireShopManager et non déclarée publique/membre : ${file}`)
}
for (const file of MEMBER_BOUTIQUE_ROUTES) {
  assert(boutiqueRoutes.includes(file), `route membre déclarée absente : ${file}`)
  const source = readFileSync(join(root, file), 'utf8')
  assert(/requireAuth\(event\)/.test(source), `route membre sans requireAuth : ${file}`)
}
for (const file of PUBLIC_BOUTIQUE_ROUTES) {
  assert(boutiqueRoutes.includes(file), `route publique déclarée absente : ${file}`)
}
console.log(`\n  routes boutique protégées par requireShopManager : ${boutiqueRoutes.length - PUBLIC_BOUTIQUE_ROUTES.size - MEMBER_BOUTIQUE_ROUTES.size}`)
console.log(`  routes boutique membres connectés (requireAuth) : ${MEMBER_BOUTIQUE_ROUTES.size}`)
console.log(`  routes boutique publiques (lecture seule, par conception) : ${PUBLIC_BOUTIQUE_ROUTES.size}`)

// ---------------------------------------------------------------------------
// 4bis. Assertions sur les gardes ADMIN / OPÉRATIONS (ajoutées avec les
//       périmètres : elles verrouillent les décisions produit documentées).
// ---------------------------------------------------------------------------
assert(guards.requireAdmin.includes('SUPER_ADMIN'),
  'requireAdmin doit inclure SUPER_ADMIN (la supervision est son seul espace)')
assert(guards.requireAdmin.includes('INTERMEDIATE_ADMIN'),
  'requireAdmin doit inclure INTERMEDIATE_ADMIN')
assert(guards.requireAdmin.includes('ADMIN'),
  'requireAdmin doit inclure ADMIN')
assert(!guards.requireAdmin.includes('SHOP_MANAGER'),
  'requireAdmin ne doit PAS inclure SHOP_MANAGER (la boutique est son seul espace)')
assert(!guards.requireAdmin.includes('MEMBER'),
  'requireAdmin ne doit PAS inclure MEMBER')
assert(!guards.requireAdminOps.includes('SUPER_ADMIN'),
  'requireAdminOps ne doit PAS inclure SUPER_ADMIN (décision produit : il supervise, il n’exploite pas)')
assert(guards.requireAdminOps.includes('ADMIN') && guards.requireAdminOps.includes('INTERMEDIATE_ADMIN'),
  'requireAdminOps doit inclure ADMIN et INTERMEDIATE_ADMIN')
assert(!guards.requireAdminOps.includes('SHOP_MANAGER'),
  'requireAdminOps ne doit PAS inclure SHOP_MANAGER')
assert(!guards.requireEventManager.includes('SUPER_ADMIN'),
  'requireEventManager ne doit PAS inclure SUPER_ADMIN')
assert(!guards.requireEventManager.includes('SHOP_MANAGER'),
  'requireEventManager ne doit PAS inclure SHOP_MANAGER')
assert(guards.requireAdmin.includes('SUPER_ADMIN') && !guards.requireAdminOps.includes('SUPER_ADMIN'),
  'SUPER_ADMIN doit avoir la supervision (requireAdmin) mais pas les opérations (requireAdminOps)')
assert(guards.requireSuperAdmin.length === 1 && guards.requireSuperAdmin[0] === 'SUPER_ADMIN',
  `requireSuperAdmin doit être réservé au SUPER_ADMIN (obtenu : ${guards.requireSuperAdmin.join(', ') || 'rien'})`)

// Toute garde qui exige un périmètre doit en exiger au moins un : une garde
// « à périmètre » qui n'en déclare aucun refuse TOUT admin limité (échec
// fermé) — comportement voulu, mais qui doit rester explicite dans le code.
for (const [guard, info] of Object.entries(scopes)) {
  if (info && !info.dynamic && info.scopes.length === 0) {
    assert(false, `${guard} déclare une liste de périmètres VIDE (échec fermé pour tout admin limité)`)
  }
}

// Aucune route de l'espace admin ne doit être sans garde.
const adminRoutes = routeFiles
  .map(file => relative(root, file).replace(/\\/g, '/'))
  .filter(file => file.startsWith('server/api/admin/'))
const GUARD_RE = /require(?:Auth|Role|ScopedRole|ShopManager|AdminOps|Admin|EventManager|SuperAdmin)\(/
const unguardedAdmin = adminRoutes.filter((file) => {
  return !GUARD_RE.test(readFileSync(join(root, file), 'utf8'))
})
for (const file of unguardedAdmin) {
  assert(false, `route admin sans AUCUNE garde : ${file}`)
}

// Idem pour les routes boutique, publiques/membres exceptées (déclarées plus bas).
const boutiqueRoutesAll = routeFiles
  .map(file => relative(root, file).replace(/\\/g, '/'))
  .filter(file => file.startsWith('server/api/boutique/'))
const unguardedBoutique = boutiqueRoutesAll.filter((file) => {
  if (PUBLIC_BOUTIQUE_ROUTES.has(file) || MEMBER_BOUTIQUE_ROUTES.has(file)) return false
  return !GUARD_RE.test(readFileSync(join(root, file), 'utf8'))
})
for (const file of unguardedBoutique) {
  assert(false, `route boutique sans AUCUNE garde : ${file}`)
}
console.log(`\n  routes /api/admin/** : ${adminRoutes.length} (toutes gardées : ${unguardedAdmin.length === 0 ? 'OUI' : 'NON'})`)

console.log('\n=== Résultat ===')
if (failures.length) {
  for (const failure of failures) console.log(`  FAIL ${failure}`)
  console.log(`\n  ${failures.length} assertion(s) en échec.`)
  process.exit(1)
}
console.log('  OK  toutes les assertions passent (parité serveur/interface boutique vérifiée).')
