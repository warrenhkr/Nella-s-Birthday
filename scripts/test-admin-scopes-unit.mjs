// scripts/test-admin-scopes-unit.mjs
//
// Test unitaire EXÉCUTABLE des ADMINS À PÉRIMÈTRE (adminScopes).
//
// Ce script exécute du VRAI code, pas une copie :
//
//   A. shared/admin-scopes.ts est importé tel quel (Node 24 sait lire le
//      TypeScript) : normalisation, décision « ce compte peut-il agir sur ce
//      périmètre », pages autorisées, page d'accueil d'un périmètre.
//   B. server/utils/auth.ts : la fonction requireScopedRole est EXTRAITE du
//      fichier et exécutée avec des doublures pour requireAuth/requireRole —
//      c'est la garde réellement utilisée par les routes API.
//   C. app/middleware/admin.ts : la fonction de décision de redirection est
//      EXTRAITE et exécutée (undefined = la page s'ouvre, une chaîne =
//      redirection).
//   D. Invariant de complétude : AUCUNE route admin ne doit appeler une garde
//      sans déclarer son périmètre (sinon un admin limité serait refusé, ou
//      pire, une route oubliée resterait ouverte à tous les admins).
//
// Résultat attendu :
//   • ADMIN + adminScopes vide  → accès admin complet (compatibilité) ;
//   • ADMIN + ['gaming']        → gaming seulement, 403 partout ailleurs ;
//   • SUPER_ADMIN / INTERMEDIATE_ADMIN → droits d'avant, jamais limités.
//
// Usage : node scripts/test-admin-scopes-unit.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
let failures = 0

function check(condition, label, detail = '') {
  if (!condition) failures++
  console.log(`  ${condition ? 'OK  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`)
}

// ---------------------------------------------------------------------------
// A. shared/admin-scopes.ts — code réel importé
// ---------------------------------------------------------------------------
const scopes = await import(pathToFileURL(join(root, 'shared/admin-scopes.ts')).href)
const { canUseAdminScope, adminScopeFilter, normalizeAdminScopes, scopesForAdminPage, adminHomeFor, unknownAdminScopes, adminScopeLabels, ADMIN_SCOPES } = scopes

console.log('=== A. shared/admin-scopes.ts (module réel importé) ===\n')
console.log(`  Périmètres déclarés (${ADMIN_SCOPES.length}) : ${ADMIN_SCOPES.map(s => s.value).join(', ')}\n`)

check(normalizeAdminScopes(['gaming', 'gaming', 'inconnu']).join(',') === 'gaming', 'normalizeAdminScopes filtre et dédoublonne')
check(normalizeAdminScopes('gaming').length === 0, 'normalizeAdminScopes ignore une entrée non-tableau')
check(unknownAdminScopes(['gaming', 'hack']).join(',') === 'hack', 'unknownAdminScopes signale les valeurs inconnues')
check(adminScopeFilter('ADMIN', []) === null, 'adminScopeFilter(ADMIN, []) = null → accès complet (compatibilité)')
check(adminScopeFilter('ADMIN', ['gaming']).join(',') === 'gaming', 'adminScopeFilter(ADMIN, [gaming]) = gaming')
check(Array.isArray(adminScopeFilter('ADMIN', ['perimetre-supprime'])) && adminScopeFilter('ADMIN', ['perimetre-supprime']).length === 0, 'périmètre inconnu en base → aucun accès admin (échec fermé, pas d’élargissement)')
check(adminScopeFilter('INTERMEDIATE_ADMIN', ['gaming']) === null, 'adminScopeFilter(INTERMEDIATE_ADMIN) = null → jamais limité')
check(adminScopeFilter('SUPER_ADMIN', ['gaming']) === null, 'adminScopeFilter(SUPER_ADMIN) = null → jamais limité')
check(adminScopeFilter('SHOP_MANAGER', ['gaming']) === null, 'adminScopeFilter(SHOP_MANAGER) = null → jamais limité')
check(canUseAdminScope('ADMIN', ['gaming'], ['gaming']) === true, 'ADMIN gaming → route gaming autorisée')
check(canUseAdminScope('ADMIN', ['gaming'], ['evenementiel']) === false, 'ADMIN gaming → route événementiel refusée')
check(canUseAdminScope('ADMIN', ['gaming'], []) === false, 'ADMIN gaming → route non déclarée refusée (échec fermé)')
check(canUseAdminScope('ADMIN', [], []) === true, 'ADMIN sans périmètre → route non déclarée autorisée (compatibilité)')
check(canUseAdminScope('ADMIN', ['gaming', 'moderation'], ['moderation']) === true, 'plusieurs périmètres : accès si l’un correspond')

check(scopesForAdminPage('/dashboard-gaming').join(',') === 'gaming', 'page /dashboard-gaming → périmètre gaming')
check(scopesForAdminPage('/dashboard-evenementiel').join(',') === 'evenementiel', 'page /dashboard-evenementiel → événementiel')
check(scopesForAdminPage('/dashboard-communication').join(',') === 'communication', 'page /dashboard-communication → communication')
check(scopesForAdminPage('/dashboard-moderation').join(',') === 'moderation', 'page /dashboard-moderation → modération')
check(scopesForAdminPage('/dashboard').join(',') === 'membres,supervision', 'page /dashboard → membres ou supervision')
check(scopesForAdminPage('/dashboard-gaming?x=1').join(',') === 'gaming', 'la query string est ignorée')
check(scopesForAdminPage('/gaming-tournoi-abc').join(',') === 'gaming', 'page /gaming-tournoi-<id> → gaming (préfixe)')
check(scopesForAdminPage('/espace-membre') === null, 'page hors espace admin → null (non soumise aux périmètres)')
check(adminHomeFor(['gaming']) === '/dashboard-gaming', 'accueil d’un admin gaming = /dashboard-gaming')
check(adminHomeFor(['supervision', 'gaming']) === '/dashboard-gaming', 'accueil = première page d’un périmètre autorisé')
check(adminHomeFor([]) === '/dashboard', 'accueil d’un admin sans périmètre = /dashboard')
check(adminScopeLabels(['gaming', 'moderation']) === 'Gaming, Modération', 'libellés lisibles des périmètres')

// Chaque périmètre annoncé doit réellement exister dans le code : on vérifie
// qu'au moins une route API lui est rattachée (voir partie D).
const scopeSlugs = ADMIN_SCOPES.map(s => s.value)

// ---------------------------------------------------------------------------
// B. server/utils/auth.ts — requireScopedRole extrait et exécuté
// ---------------------------------------------------------------------------
const authSource = readFileSync(join(root, 'server/utils/auth.ts'), 'utf8')

function extractFunction(source, name) {
  const re = new RegExp(`(?:export )?(?:async )?function ${name}\\([^\\n]*\\{[\\s\\S]*?\\n\\}`)
  const match = source.match(re)
  if (!match) throw new Error(`fonction introuvable dans le fichier : ${name}`)
  const raw = match[0]
  const signatureLine = raw.split('\n')[0]
  const bodyStart = signatureLine.lastIndexOf('{')
  if (bodyStart === -1) throw new Error(`signature illisible : ${name}`)
  const isAsync = /(?:export )?async function/.test(signatureLine)
  return { isAsync, body: raw.slice(bodyStart) }
}

// Doublure de requireRole (rôle uniquement) : renvoie l'utilisateur de l'event.
const roleStub = `
async function requireRole(event, ...allowedRoles) {
  const normalized = allowedRoles.map(role => role.toUpperCase())
  if (!normalized.includes(event.user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden - permissions insuffisantes' })
  }
  return { user: event.user, profile: null }
}
`

const scopedError = extractFunction(authSource, 'scopedAccessError')
const scopedRole = extractFunction(authSource, 'requireScopedRole')
const code = [
  roleStub,
  `function scopedAccessError(user, required) ${scopedError.body}`,
  `async function requireScopedRole(event, scopes, ...allowedRoles) ${scopedRole.body}`
].join('\n\n')

const guardFactory = new Function(
  'createError',
  'canUseAdminScope',
  'normalizeAdminScopes',
  'adminScopeLabels',
  `${code}\nreturn { requireScopedRole }`
)
const guards = guardFactory(
  (payload) => {
    const error = new Error(payload.statusMessage)
    error.statusCode = payload.statusCode
    return error
  },
  canUseAdminScope,
  normalizeAdminScopes,
  adminScopeLabels
)

const ROLES = ['SUPER_ADMIN', 'INTERMEDIATE_ADMIN', 'ADMIN', 'SHOP_MANAGER', 'MEMBER']

async function scopedAllowed(role, adminScopes, allowedRoles, required) {
  try {
    await guards.requireScopedRole({ user: { id: 'u-1', role, adminScopes } }, required, ...allowedRoles)
    return true
  } catch (error) {
    if (error.statusCode === 403) return false
    throw error
  }
}

const ADMIN_ROLES = ['intermediate_admin', 'admin']

console.log('\n=== B. requireScopedRole (code réel extrait de server/utils/auth.ts) ===\n')
console.log('  rôle                 adminScopes              garde requise            → décision\n')

const cases = [
  // [role, adminScopes, required, allowedRoles, attendu]
  ['SUPER_ADMIN', [], ['gaming'], ['super_admin', 'intermediate_admin', 'admin'], true],
  ['SUPER_ADMIN', [], ['gaming'], ADMIN_ROLES, false],
  ['INTERMEDIATE_ADMIN', [], ['gaming'], ADMIN_ROLES, true],
  ['INTERMEDIATE_ADMIN', ['gaming'], [], ADMIN_ROLES, true],
  ['ADMIN', [], ['gaming'], ADMIN_ROLES, true],
  ['ADMIN', [], [], ADMIN_ROLES, true],
  ['ADMIN', ['gaming'], ['gaming'], ADMIN_ROLES, true],
  ['ADMIN', ['gaming'], [], ADMIN_ROLES, false],
  ['ADMIN', ['gaming'], ['evenementiel'], ADMIN_ROLES, false],
  ['ADMIN', ['gaming'], ['gaming', 'evenementiel'], ADMIN_ROLES, true],
  ['ADMIN', ['supervision'], ['supervision'], ADMIN_ROLES, true],
  ['ADMIN', ['supervision'], ['gaming'], ADMIN_ROLES, false],
  ['ADMIN', ['boutique-inexistant'], ['gaming'], ADMIN_ROLES, false],
  ['ADMIN', ['boutique-inexistant'], [], ADMIN_ROLES, false],
  ['SHOP_MANAGER', [], [], ADMIN_ROLES, false],
  ['MEMBER', [], [], ADMIN_ROLES, false],
  ['ADMIN', ['gaming'], ['supervision'], ['super_admin', 'intermediate_admin', 'admin'], false],
  ['SUPER_ADMIN', [], ['supervision'], ['super_admin', 'intermediate_admin', 'admin'], true]
]

for (const [role, adminScopes, required, allowedRoles, expected] of cases) {
  const got = await scopedAllowed(role, adminScopes, allowedRoles, required)
  const label = `${role.padEnd(20)} ${(adminScopes.join(',') || '—').padEnd(24)} ${(required.join(',') || '—').padEnd(24)} → ${got ? 'autorisé' : '403'}`
  check(got === expected, label, `attendu ${expected ? 'autorisé' : '403'}`)
}

// ---------------------------------------------------------------------------
// C. app/middleware/admin.ts — décision d'interface exécutée
// ---------------------------------------------------------------------------
const middlewareSource = readFileSync(join(root, 'app/middleware/admin.ts'), 'utf8')
const allowedRolesMatch = middlewareSource.match(/const allowedRoles = \[([^\]]*)\]/)
if (!allowedRolesMatch) throw new Error('allowedRoles introuvable dans app/middleware/admin.ts')
const redirectFn = extractFunction(middlewareSource, 'redirectTargetFor')
const uiFactory = new Function(
  'scopesForAdminPage',
  'canUseAdminScope',
  'adminHomeFor',
  `const allowedRoles = [${allowedRolesMatch[1]}]\nfunction redirectTargetFor(role, adminScopes, path) ${redirectFn.body}\nreturn { redirectTargetFor }`
)
const { redirectTargetFor } = uiFactory(scopesForAdminPage, canUseAdminScope, adminHomeFor)

console.log('\n=== C. Middleware d’interface app/middleware/admin.ts (exécuté) ===\n')

const uiCases = [
  ['ADMIN', [], '/dashboard', undefined],
  ['ADMIN', [], '/dashboard-gaming', undefined],
  ['ADMIN', ['gaming'], '/dashboard-gaming', undefined],
  ['ADMIN', ['gaming'], '/dashboard', '/dashboard-gaming'],
  ['ADMIN', ['gaming'], '/dashboard-evenementiel', '/dashboard-gaming'],
  ['ADMIN', ['evenementiel'], '/dashboard-gaming', '/dashboard-evenementiel'],
  ['ADMIN', ['moderation'], '/dashboard-moderation', undefined],
  ['ADMIN', ['membres'], '/dashboard', undefined],
  ['ADMIN', ['supervision'], '/dashboard', undefined],
  ['ADMIN', ['gaming'], '/gaming-tournoi-abc', undefined],
  ['ADMIN', ['membres'], '/gaming-tournoi-abc', '/dashboard'],
  ['ADMIN', ['perimetre-supprime'], '/dashboard-gaming', '/espace-membre'],
  ['ADMIN', ['perimetre-supprime'], '/dashboard', '/espace-membre'],
  ['INTERMEDIATE_ADMIN', [], '/dashboard', undefined],
  ['INTERMEDIATE_ADMIN', ['gaming'], '/dashboard-evenementiel', undefined],
  ['SUPER_ADMIN', [], '/dashboard', '/dashboard-super-admin'],
  ['SHOP_MANAGER', [], '/dashboard', '/boutique-dashboard'],
  ['MEMBER', [], '/dashboard', '/espace-membre']
]

for (const [role, adminScopes, path, expected] of uiCases) {
  const target = redirectTargetFor(role, adminScopes, path)
  check(
    target === expected,
    `${role.padEnd(20)} ${(adminScopes.join(',') || '—').padEnd(16)} ${path.padEnd(24)} → ${target ?? 'page autorisée'}`,
    `attendu ${expected ?? 'page autorisée'}`
  )
}

// Aucune boucle de redirection possible : la page d'accueil d'un périmètre est
// elle-même ouverte par ce périmètre.
const loopFree = scopeSlugs.every((slug) => {
  const home = adminHomeFor([slug])
  return redirectTargetFor('ADMIN', [slug], home) === undefined
})
check(loopFree, 'la page d’accueil de chaque périmètre est autorisée par ce périmètre (pas de boucle)')

// ---------------------------------------------------------------------------
// D. Complétude : chaque route admin déclare son périmètre
// ---------------------------------------------------------------------------
function listFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...listFiles(full))
    else if (full.endsWith('.ts')) out.push(full)
  }
  return out
}

const apiFiles = listFiles(join(root, 'server/api'))
// Une route admin doit TOUJOURS déclarer son périmètre : `requireXxx(event, ['...'])`.
// `requireScopedRole(event, ['...'], ...)` est aussi accepté (cas du fil de la
// communauté).
const missingGuardPattern = /require(?:Admin|AdminOps|EventManager)\(\s*event\s*\)/
const missingScopedPattern = /requireScopedRole\(\s*event\s*\)/
const annotatedPattern = /(?:require(?:Admin|AdminOps|EventManager)|requireScopedRole)\(\s*event\s*,\s*\[([^\]]*)\]/g
const missing = []
const badScopes = []
const annotated = new Map()

for (const file of apiFiles) {
  const source = readFileSync(file, 'utf8')
  const rel = relative(root, file).replace(/\\/g, '/')
  if (missingGuardPattern.test(source)) missing.push(rel)
  if (missingScopedPattern.test(source)) missing.push(`${rel} (requireScopedRole sans périmètre)`)
  const re = new RegExp(annotatedPattern.source, 'g')
  let match
  while ((match = re.exec(source)) !== null) {
    const names = match[1].split(',').map(part => part.trim().replace(/^'|'$/g, '')).filter(Boolean)
    for (const name of names) {
      if (!scopeSlugs.includes(name)) badScopes.push(`${rel}: ${name}`)
    }
    annotated.set(rel, annotated.has(rel) ? `${annotated.get(rel)},${names.join(',')}` : names.join(','))
  }
}

console.log('\n=== D. Complétude des périmètres déclarés sur les routes API ===\n')
console.log(`  ${annotated.size} routes admin annotées, ${missing.length} sans périmètre, ${badScopes.length} périmètre(s) inconnu(s).\n`)
check(missing.length === 0, 'toutes les routes admin déclarent un périmètre', missing.join(', '))
check(badScopes.length === 0, 'tous les périmètres déclarés existent dans shared/admin-scopes.ts', badScopes.join(', '))

const usedScopes = new Set()
for (const names of annotated.values()) names.split(',').forEach(name => name && usedScopes.add(name))
const orphanScopes = scopeSlugs.filter(slug => !usedScopes.has(slug))
check(orphanScopes.length === 0, 'chaque périmètre proposé gouverne au moins une route API', orphanScopes.join(', '))

console.log('\n  Répartition des routes par périmètre :')
for (const slug of scopeSlugs) {
  const routes = [...annotated.entries()].filter(([, names]) => names.split(',').includes(slug)).map(([file]) => file)
  console.log(`    ${slug.padEnd(14)} ${String(routes.length).padStart(2)} route(s) : ${routes.join(', ') || '—'}`)
}

console.log(`\n  ${failures} échec(s).`)
process.exit(failures ? 1 : 0)
