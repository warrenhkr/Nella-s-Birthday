// scripts/test-require-role-unit.mjs
//
// Test unitaire EXÉCUTABLE des gardes réelles de server/utils/auth.ts.
//
// Ce script n'appelle pas un serveur : il EXTRAIT le code source exact des
// fonctions requireRole / requireScopedRole / scopedAccessError /
// requireAdmin / requireAdminOps / requireEventManager / requireShopManager /
// requireSuperAdmin depuis server/utils/auth.ts, remplace les deux dépendances
// non pertinentes ici (requireAuth, getUserProfile — qui ne font que lire la
// session) par des doublures, injecte les fonctions réelles de
// shared/admin-scopes.ts, puis exécute le VRAI code des gardes pour chaque rôle.
//
// Résultat attendu (matrice produit) :
//   SUPER_ADMIN        → autorisé partout SAUF sur les routes club (décision produit)
//   INTERMEDIATE_ADMIN → autorisé partout SAUF super-admin, ET sur la boutique
//                        exactement comme SHOP_MANAGER
//   ADMIN              → admin/événementiel uniquement (403 sur la boutique) ;
//                        avec des PÉRIMÈTRES (adminScopes) → ses périmètres seulement
//   SHOP_MANAGER       → boutique uniquement
//   MEMBER             → refusé partout
//
// Usage : node scripts/test-require-role-unit.mjs

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const authSource = readFileSync(join(root, 'server/utils/auth.ts'), 'utf8')
const ROLES = ['SUPER_ADMIN', 'INTERMEDIATE_ADMIN', 'ADMIN', 'SHOP_MANAGER', 'MEMBER']
const GUARDS = ['requireAdmin', 'requireAdminOps', 'requireEventManager', 'requireShopManager', 'requireSuperAdmin']

// Fonctions réelles de périmètre (Node lit le TypeScript nativement).
const { canUseAdminScope, normalizeAdminScopes, adminScopeLabels } = await import(
  pathToFileURL(join(root, 'shared/admin-scopes.ts')).href
)

// Paramètres JavaScript de chaque fonction extraite (les annotations
// TypeScript, optionnelles ou non, ne passent pas dans new Function()).
const PARAMS = {
  requireRole: 'event, ...allowedRoles',
  scopedAccessError: 'user, required',
  requireScopedRole: 'event, scopes, ...allowedRoles',
  requireAdmin: 'event, scopes',
  requireAdminOps: 'event, scopes',
  requireEventManager: 'event, scopes',
  requireShopManager: 'event',
  requireSuperAdmin: 'event'
}

// Extrait une fonction de auth.ts et réécrit sa signature en JavaScript pur ;
// le corps est conservé TEL QUEL (c'est lui qui est testé).
function extract(name) {
  const match = authSource.match(new RegExp(`(?:export )?(?:async )?function ${name}\\([^\\n]*\\{[\\s\\S]*?\\n\\}`))
  if (!match) throw new Error(`fonction introuvable dans auth.ts : ${name}`)
  const raw = match[0]
  const signatureLine = raw.split('\n')[0]
  const isAsync = /(?:export )?async function/.test(signatureLine)
  const body = raw.slice(signatureLine.lastIndexOf('{'))
  if (!body.startsWith('{')) throw new Error(`signature illisible dans auth.ts : ${name}`)
  return `${isAsync ? 'async ' : ''}function ${name}(${PARAMS[name]}) ${body}`
}

// Doublures : ne servent qu'à fournir l'utilisateur courant.
const stubs = `
async function requireAuth(event) { return { id: 'u-1', role: event.role, adminScopes: event.adminScopes ?? [], isActive: true } }
async function getUserProfile() { return null }
`
const code = [
  stubs,
  extract('requireRole'),
  extract('scopedAccessError'),
  extract('requireScopedRole'),
  ...GUARDS.map(name => extract(name))
].join('\n\n')

const factory = new Function(
  'createError',
  'canUseAdminScope',
  'normalizeAdminScopes',
  'adminScopeLabels',
  `${code}\nreturn { ${GUARDS.join(', ')}, requireScopedRole }`
)
const guards = factory(
  (payload) => {
    const error = new Error(payload.statusMessage)
    error.statusCode = payload.statusCode
    return error
  },
  canUseAdminScope,
  normalizeAdminScopes,
  adminScopeLabels
)

async function allowed(guardName, role, scopes, required) {
  try {
    await guards[guardName]({ role, adminScopes: scopes }, required)
    return true
  } catch (error) {
    if (error.statusCode === 403) return false
    throw error
  }
}

const expected = {
  requireAdmin: ['SUPER_ADMIN', 'INTERMEDIATE_ADMIN', 'ADMIN'],
  requireAdminOps: ['INTERMEDIATE_ADMIN', 'ADMIN'],
  requireEventManager: ['INTERMEDIATE_ADMIN', 'ADMIN'],
  requireShopManager: ['INTERMEDIATE_ADMIN', 'SHOP_MANAGER'],
  requireSuperAdmin: ['SUPER_ADMIN']
}

console.log('=== Exécution réelle des gardes extraites de server/utils/auth.ts ===\n')
console.log('role'.padEnd(20) + GUARDS.map(name => name.padEnd(20)).join(''))
const actual = {}
for (const role of ROLES) {
  actual[role] = []
  let row = role.padEnd(20)
  for (const guard of GUARDS) {
    const ok = await allowed(guard, role)
    if (ok) actual[role].push(guard)
    row += String(ok ? 'OK' : '--').padEnd(20)
  }
  console.log(row)
}

let failures = 0
for (const guard of GUARDS) {
  for (const role of ROLES) {
    const shouldAllow = expected[guard].includes(role)
    const didAllow = actual[role].includes(guard)
    if (shouldAllow !== didAllow) {
      failures++
      console.log(`  FAIL ${guard} / ${role} → attendu ${shouldAllow ? 'autorisé' : '403'} / obtenu ${didAllow ? 'autorisé' : '403'}`)
    }
  }
}

console.log('\n=== Assertions de parité ===')
const shop = async role => allowed('requireShopManager', role)
const intermediateLikeShopManager = await shop('INTERMEDIATE_ADMIN') && await shop('SHOP_MANAGER')
console.log(`  ${intermediateLikeShopManager ? 'OK  ' : 'FAIL'} INTERMEDIATE_ADMIN a les mêmes droits boutique que SHOP_MANAGER`)
if (!intermediateLikeShopManager) failures++
const adminExcluded = await shop('ADMIN') === false
console.log(`  ${adminExcluded ? 'OK  ' : 'FAIL'} ADMIN reste exclu de la boutique (403)`)
if (!adminExcluded) failures++
const superAdminExcluded = await shop('SUPER_ADMIN') === false
console.log(`  ${superAdminExcluded ? 'OK  ' : 'FAIL'} SUPER_ADMIN exclu de la boutique (décision produit : supervision seule)`)
if (!superAdminExcluded) failures++
const memberExcluded = await shop('MEMBER') === false
console.log(`  ${memberExcluded ? 'OK  ' : 'FAIL'} MEMBER reste exclu de la boutique (403)`)
if (!memberExcluded) failures++

// ---------------------------------------------------------------------------
// PÉRIMÈTRES : un ADMIN limité n'obtient QUE ses périmètres, et un ADMIN sans
// périmètre garde exactement ses droits d'avant (compatibilité ascendante).
// ---------------------------------------------------------------------------
console.log('\n=== Périmètres d’administration (adminScopes) ===\n')
const scopeCases = [
  ['ADMIN sans périmètre sur une route gaming (compatibilité)', 'requireAdminOps', 'ADMIN', [], ['gaming'], true],
  ['ADMIN gaming sur une route gaming', 'requireAdminOps', 'ADMIN', ['gaming'], ['gaming'], true],
  ['ADMIN gaming sur une route événementiel', 'requireAdminOps', 'ADMIN', ['gaming'], ['evenementiel'], false],
  ['ADMIN gaming sur la galerie (modération)', 'requireEventManager', 'ADMIN', ['gaming'], ['moderation'], false],
  ['ADMIN gaming sur une route non déclarée', 'requireAdminOps', 'ADMIN', ['gaming'], undefined, false],
  ['ADMIN supervision sur la gestion des comptes', 'requireAdmin', 'ADMIN', ['supervision'], ['supervision'], true],
  ['ADMIN supervision sur les comptes membres', 'requireAdminOps', 'ADMIN', ['supervision'], ['membres'], false],
  ['ADMIN gaming + modération sur la galerie', 'requireEventManager', 'ADMIN', ['gaming', 'moderation'], ['moderation'], true],
  ['INTERMEDIATE_ADMIN (jamais limité)', 'requireAdminOps', 'INTERMEDIATE_ADMIN', [], ['gaming'], true]
]
for (const [label, guard, role, scopes, required, want] of scopeCases) {
  const got = await allowed(guard, role, scopes, required)
  if (got !== want) failures++
  console.log(`  ${got === want ? 'OK  ' : 'FAIL'} ${label} → ${got ? 'autorisé' : '403'} (attendu ${want ? 'autorisé' : '403'})`)
}

// ---------------------------------------------------------------------------
// Interface : on exécute la VRAIE fonction de décision de app/middleware/shop.ts
// (undefined = la page s'ouvre ; une chaîne = redirection).
// ---------------------------------------------------------------------------
const middlewareSource = readFileSync(join(root, 'app/middleware/shop.ts'), 'utf8')
const allowedRolesMatch = middlewareSource.match(/const allowedRoles = \[([^\]]*)\]/)
const redirectMatch = middlewareSource.match(/function redirectTargetFor\(role: string\)[\s\S]*?\n\}/)
if (!allowedRolesMatch || !redirectMatch) throw new Error('middleware shop.ts illisible')
const middlewareFactory = new Function(`
${`const allowedRoles = [${allowedRolesMatch[1]}]`}
${redirectMatch[0].replace(/\(role: string\)/, '(role)').replace(/\)\s*:\s*[^{]+\{/, ') {')}
return { allowedRoles, redirectTargetFor }
`)
const { redirectTargetFor } = middlewareFactory()

const expectedUi = {
  SUPER_ADMIN: '/dashboard-super-admin',
  INTERMEDIATE_ADMIN: undefined,
  SHOP_MANAGER: undefined,
  ADMIN: '/dashboard',
  MEMBER: '/espace-membre'
}

console.log('\n=== Middleware d\'interface app/middleware/shop.ts (exécuté) ===\n')
for (const role of ROLES) {
  const target = redirectTargetFor(role)
  const want = expectedUi[role]
  const pass = target === want
  if (!pass) failures++
  console.log(`  ${pass ? 'OK  ' : 'FAIL'} ${role.padEnd(18)} → ${target === undefined ? 'page boutique autorisée' : `redirigé vers ${target}`} (attendu ${want === undefined ? 'autorisé' : want})`)
}

// Parité serveur ↔ interface : les mêmes rôles ouvrent la page et appellent l'API.
const serverRoles = new Set()
for (const role of ROLES) if (await shop(role)) serverRoles.add(role)
const uiRoles = new Set(ROLES.filter(role => redirectTargetFor(role) === undefined))
const parity = [...serverRoles].sort().join(',') === [...uiRoles].sort().join(',')
console.log(`\n  ${parity ? 'OK  ' : 'FAIL'} parité serveur/interface : serveur=[${[...serverRoles].sort().join(', ')}] interface=[${[...uiRoles].sort().join(', ')}]`)
if (!parity) failures++

console.log(`\n  ${failures} échec(s).`)
process.exit(failures ? 1 : 0)
