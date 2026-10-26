#!/usr/bin/env node
// ============================================================================
// Test reproductible — Parité de droits BOUTIQUE (intermediate_admin = shop_manager)
//
// Ce script ne réimplémente RIEN : il lit les fichiers réels du projet,
// en extrait le code des gardes (serveur) et de la navigation (front), puis
// l'EXÉCUTE dans un bac à sable pour vérifier le comportement réel par rôle.
//
//   1. server/utils/auth.ts        → requireShopManager() réellement exécuté
//   2. app/middleware/shop.ts      → redirectTargetFor() réellement exécuté
//   3. app/components/AdminQuickNav.vue → computed `links` réellement exécuté
//   4. app/components/MainNav.vue       → computed `links` réellement exécuté
//   5. Base de données (LECTURE SEULE) → rôles réellement présents
//
// Usage : node scripts/test-boutique-roles.mjs
// Sortie : tableau par rôle + code de sortie 1 si une assertion échoue.
// ============================================================================
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import vm from 'node:vm'
import dotenv from 'dotenv'
import pg from 'pg'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// L'environnement est chargé ici, avec un chemin EXPLICITE : `import 'dotenv/config'`
// dépend du répertoire courant (lancé depuis ailleurs, DATABASE_URL restait
// absent et la partie base de données était silencieusement ignorée).
dotenv.config({ path: resolve(ROOT, '.env'), quiet: true })

const ROLES = ['SUPER_ADMIN', 'INTERMEDIATE_ADMIN', 'ADMIN', 'SHOP_MANAGER', 'MEMBER']

const results = []
let failures = 0

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures++
  results.push({ label, actual, expected, ok })
  return ok
}

// ── Extraction de code source : renvoie le bloc { ... } équilibré ──────────
function extractBlock(source, startMarker) {
  const start = source.indexOf(startMarker)
  if (start === -1) throw new Error(`Marqueur introuvable : ${startMarker}`)
  const open = source.indexOf('{', start)
  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}') {
      depth--
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  throw new Error(`Bloc non équilibré pour : ${startMarker}`)
}

const read = path => readFileSync(resolve(ROOT, path), 'utf8')

// ── Nettoyage TypeScript minimal : le code exécuté reste identique à la
//    logique source, on retire seulement les annotations de type et `export`.
function sanitizeTs(code) {
  return code
    .replace(/^export /gm, '')
    // `const shopLinks: QuickLink[] = [...]` → `const shopLinks = [...]`
    // (les constantes de module injectées en prélude portent une annotation de
    // type que `new Function` ne sait pas lire).
    .replace(/(\bconst\s+[A-Za-z_$][\w$]*)\s*:\s*[A-Za-z_$][\w$.]*(?:\[\])?\s*=/g, '$1 =')
    .replace(/\bas const\b/g, '')
    .replace(/\): string \| undefined \{/g, ') {')
    .replace(/\): boolean \{/g, ') {')
    .replace(/\(event: any, \.\.\.allowedRoles: string\[\]\)/g, '(event, ...allowedRoles)')
    .replace(/\(role: string\)/g, '(role)')
    .replace(/: any/g, '')
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) GARDE SERVEUR — requireShopManager() (code réel, exécuté)
// ─────────────────────────────────────────────────────────────────────────────
const authSource = read('server/utils/auth.ts')
const requireRoleCode = sanitizeTs(extractBlock(authSource, 'export async function requireRole'))
const requireShopManagerCode = sanitizeTs(extractBlock(authSource, 'export async function requireShopManager'))

// Bac à sable : on remplace requireAuth (renvoie le rôle testé) et createError
// (lève une erreur 403 comme le fait Nuxt) — le reste du code est le vrai.
function buildRequireShopManager() {
  const sandbox = {
    requireAuth: async () => ({ id: 'test-user', role: sandbox.__role, isActive: true }),
    getUserProfile: async () => null,
    createError: ({ statusCode, statusMessage }) => {
      const error = new Error(statusMessage)
      error.statusCode = statusCode
      return error
    },
    __role: null
  }
  const context = vm.createContext(sandbox)
  vm.runInContext(`${requireRoleCode}\n${requireShopManagerCode}\nthis.__requireShopManager = requireShopManager`, context)
  return async (role) => {
    sandbox.__role = role
    try {
      await sandbox.__requireShopManager({})
      return 'AUTORISÉ'
    } catch (error) {
      return `REFUSÉ (${error.statusCode})`
    }
  }
}

const callRequireShopManager = buildRequireShopManager()
const serverMatrix = {}
for (const role of ROLES) serverMatrix[role] = await callRequireShopManager(role)

// ─────────────────────────────────────────────────────────────────────────────
// 2) MIDDLEWARE FRONT — redirectTargetFor() + allowedRoles (code réel, exécuté)
// ─────────────────────────────────────────────────────────────────────────────
const shopMiddlewareSource = read('app/middleware/shop.ts')
const allowedRolesMatch = shopMiddlewareSource.match(/const allowedRoles = (\[[^\]]*\])/)
const allowedRoles = vm.runInNewContext(allowedRolesMatch[1])
const sandboxMiddleware = { allowedRoles }
vm.createContext(sandboxMiddleware)
vm.runInContext(`${sanitizeTs(extractBlock(shopMiddlewareSource, 'function redirectTargetFor'))}\nthis.__redirect = redirectTargetFor`, sandboxMiddleware)
const redirectTargetFor = sandboxMiddleware.__redirect

const middlewareMatrix = {}
for (const role of ROLES) {
  const target = redirectTargetFor(role)
  middlewareMatrix[role] = target === undefined ? 'ACCÈS AUTORISÉ' : `redirigé → ${target}`
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) NAVIGATION — AdminQuickNav.vue (computed `links` réellement exécuté)
//
// CAUSE RACINE DU CRASH PRÉCÉDENT : le marqueur recherché était la chaîne
// littérale « const links = computed(() => », or AdminQuickNav.vue déclare
// aujourd'hui « const links = computed<QuickLink[]>(() => » (computed typé).
// indexOf() ne trouvait plus le marqueur, extractBlock() levait
// « Marqueur introuvable » et le script mourait (exit 1) AVANT la moindre
// assertion. Les marqueurs sont maintenant des PRÉFIXES stables, et les
// dépendances réelles du computed (canUseAdminScope, adminHomeFor) sont
// fournies par le VRAI module shared/admin-scopes.ts, chargé et exécuté par
// Node (type-stripping natif) : aucune règle n'est recopiée ici.
// ─────────────────────────────────────────────────────────────────────────────
const adminScopesModule = await import(pathToFileURL(resolve(ROOT, 'shared/admin-scopes.ts')).href)

function runNavComputed(path, marker, preludePatterns = []) {
  const source = read(path)
  const block = extractBlock(source, marker) // « const links = computed… »
  const body = block.slice(block.indexOf('{') + 1, block.lastIndexOf('}'))
  // Constantes de module dont dépend le computed (ex. shopLinks dans AdminQuickNav).
  const prelude = sanitizeTs(preludePatterns
    .map((pattern) => {
      const match = source.match(pattern)
      if (!match) throw new Error(`Prélude introuvable dans ${path} : ${pattern}`)
      return match[0]
    })
    .join('\n'))
  const factory = new Function(
    'user',
    'canUseAdminScope',
    'adminHomeFor',
    `const computed = (fn) => fn(); ${prelude}\n${body}`
  )
  return (role, adminScopes = []) => factory(
    { value: { role, adminScopes } },
    adminScopesModule.canUseAdminScope,
    adminScopesModule.adminHomeFor
  )
}

const adminQuickNavLinks = runNavComputed('app/components/AdminQuickNav.vue', 'const links = computed', [
  // `const shopLinks: QuickLink[] = [...]` : l'annotation de type est tolerée
  // (l'ancien motif `const shopLinks = \[` ignorait l'annotation et échouait).
  /const shopLinks[^=]*=\s*\[[\s\S]*?\n\]/,
  /const adminLinks[^=]*=\s*\[[\s\S]*?\n\]/,
  // `const overviewLink: QuickLink = { ... }` (ajouté avec les périmètres).
  /const overviewLink[^=]*=\s*\{[\s\S]*?\n\}/
])
const mainNavLinks = runNavComputed('app/components/MainNav.vue', 'const links = computed')

const uiMatrix = {}
for (const role of ROLES) {
  const quick = adminQuickNavLinks(role).map(link => link.to)
  const main = mainNavLinks(role).map(link => link.to)
  uiMatrix[role] = {
    raccourciBas: quick.includes('/boutique-dashboard') ? 'OUI' : 'non',
    lienNavPrincipale: main.includes('/boutique-dashboard') ? 'OUI' : 'non',
    // Régression du 11/09/2026 : la barre de raccourcis de l'admin intermédiaire
    // avait perdu ses liens vers les tableaux de bord admin au profit de la
    // boutique. Ces deux destinations sont les seuls liens du site vers ces pages.
    lienEvenementiel: quick.includes('/dashboard-evenementiel') ? 'OUI' : 'non',
    lienModeration: quick.includes('/dashboard-moderation') ? 'OUI' : 'non'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) BASE DE DONNÉES (LECTURE SEULE) — rôles réellement présents
// ─────────────────────────────────────────────────────────────────────────────
let dbAccounts = []
let dbError = null
try {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  const { rows } = await client.query('SELECT email, role FROM users ORDER BY role, email')
  dbAccounts = rows
  await client.end()
} catch (error) {
  dbError = error.message
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) ASSERTIONS
// ─────────────────────────────────────────────────────────────────────────────
check('serveur · INTERMEDIATE_ADMIN = SHOP_MANAGER (même verdict)', serverMatrix.INTERMEDIATE_ADMIN, serverMatrix.SHOP_MANAGER)
check('serveur · INTERMEDIATE_ADMIN autorisé sur la boutique', serverMatrix.INTERMEDIATE_ADMIN, 'AUTORISÉ')
check('serveur · SHOP_MANAGER autorisé sur la boutique', serverMatrix.SHOP_MANAGER, 'AUTORISÉ')
check('serveur · SUPER_ADMIN exclu de la boutique (décision produit)', serverMatrix.SUPER_ADMIN, 'REFUSÉ (403)')
check('serveur · ADMIN exclu de la boutique (comportement voulu)', serverMatrix.ADMIN, 'REFUSÉ (403)')
check('serveur · MEMBER exclu de la boutique', serverMatrix.MEMBER, 'REFUSÉ (403)')

check('middleware · INTERMEDIATE_ADMIN non redirigé', middlewareMatrix.INTERMEDIATE_ADMIN, 'ACCÈS AUTORISÉ')
check('middleware · SHOP_MANAGER non redirigé', middlewareMatrix.SHOP_MANAGER, 'ACCÈS AUTORISÉ')
check('middleware · SUPER_ADMIN redirigé vers /dashboard-super-admin', middlewareMatrix.SUPER_ADMIN, 'redirigé → /dashboard-super-admin')
check('middleware · ADMIN toujours redirigé vers /dashboard', middlewareMatrix.ADMIN, 'redirigé → /dashboard')
check('middleware · MEMBER toujours redirigé vers /espace-membre', middlewareMatrix.MEMBER, 'redirigé → /espace-membre')

check('UI · raccourci boutique de l’INTERMEDIATE_ADMIN', uiMatrix.INTERMEDIATE_ADMIN.raccourciBas, 'OUI')
check('UI · raccourci boutique du SHOP_MANAGER', uiMatrix.SHOP_MANAGER.raccourciBas, 'OUI')
check('UI · lien « Gestion boutique » de l’INTERMEDIATE_ADMIN dans la nav principale', uiMatrix.INTERMEDIATE_ADMIN.lienNavPrincipale, 'OUI')
check('UI · le MEMBER ne voit aucun lien de gestion boutique', uiMatrix.MEMBER.lienNavPrincipale, 'non')
check('UI · le SUPER_ADMIN ne voit aucun lien de gestion boutique', uiMatrix.SUPER_ADMIN.lienNavPrincipale, 'non')
check('UI · l’INTERMEDIATE_ADMIN garde le lien Événementiel', uiMatrix.INTERMEDIATE_ADMIN.lienEvenementiel, 'OUI')
check('UI · l’INTERMEDIATE_ADMIN garde le lien Modération (galerie)', uiMatrix.INTERMEDIATE_ADMIN.lienModeration, 'OUI')
check('UI · l’INTERMEDIATE_ADMIN garde les liens admin ET la boutique', `${uiMatrix.INTERMEDIATE_ADMIN.lienEvenementiel}/${uiMatrix.INTERMEDIATE_ADMIN.raccourciBas}`, 'OUI/OUI')

// Administrateur à périmètre (ADMIN + adminScopes = ['gaming']) : le computed
// réel doit n'exposer QUE les entrées de son périmètre. Ces trois assertions
// n'existaient pas avant : la navigation d'un admin limité n'était vérifiée
// nulle part de façon exécutable.
const scopedGamingQuick = adminQuickNavLinks('ADMIN', ['gaming']).map(link => link.to)
const scopedGamingMain = mainNavLinks('ADMIN', ['gaming']).map(link => link.to)
const scopedSupervisionQuick = adminQuickNavLinks('ADMIN', ['supervision']).map(link => link.to)
check('UI · ADMIN limité au gaming voit le raccourci Gaming', scopedGamingQuick.includes('/dashboard-gaming') ? 'OUI' : 'non', 'OUI')
check('UI · ADMIN limité au gaming ne voit PAS le raccourci Modération', scopedGamingQuick.includes('/dashboard-moderation') ? 'OUI' : 'non', 'non')
check('UI · ADMIN limité au gaming ne voit PAS de raccourci boutique', scopedGamingQuick.includes('/boutique-dashboard') ? 'OUI' : 'non', 'non')
check('UI · ADMIN limité au gaming est conduit à /dashboard-gaming par la nav principale', scopedGamingMain.includes('/dashboard-gaming') ? 'OUI' : 'non', 'OUI')
check('UI · ADMIN limité à la supervision est conduit à /dashboard par la nav principale', scopedSupervisionQuick.includes('/dashboard') ? 'OUI' : 'non', 'OUI')

// L'INTERMEDIATE_ADMIN n'est jamais limité par un périmètre (partage exact des
// droits du SHOP_MANAGER sur la boutique) : ses raccourcis sont identiques avec
// ou sans adminScopes en base.
check(
  'UI · les raccourcis de l’INTERMEDIATE_ADMIN ne dépendent pas de ses adminScopes',
  JSON.stringify(adminQuickNavLinks('INTERMEDIATE_ADMIN', ['gaming']).map(link => link.to)),
  JSON.stringify(adminQuickNavLinks('INTERMEDIATE_ADMIN', []).map(link => link.to))
)

// ─────────────────────────────────────────────────────────────────────────────
// RAPPORT
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== 1. GARDE SERVEUR (server/utils/auth.ts → requireShopManager, code réel exécuté) ===')
for (const role of ROLES) console.log(`  ${role.padEnd(18)} ${serverMatrix[role]}`)

console.log('\n=== 2. MIDDLEWARE FRONT (app/middleware/shop.ts, code réel exécuté) ===')
console.log(`  allowedRoles = [${allowedRoles.join(', ')}]`)
for (const role of ROLES) console.log(`  ${role.padEnd(18)} ${middlewareMatrix[role]}`)

console.log('\n=== 3. NAVIGATION (computed réels exécutés) ===')
for (const role of ROLES) {
  console.log(`  ${role.padEnd(18)} raccourci bas: ${uiMatrix[role].raccourciBas.padEnd(3)} · nav principale: ${uiMatrix[role].lienNavPrincipale}`)
}

console.log('\n=== 4. BASE DE DONNÉES (lecture seule) — comptes réels par rôle ===')
if (dbError) {
  console.log(`  ⚠️  Lecture impossible : ${dbError}`)
} else {
  const counts = {}
  for (const row of dbAccounts) counts[row.role] = (counts[row.role] || 0) + 1
  console.log(`  ${dbAccounts.length} compte(s) : ${Object.entries(counts).map(([role, n]) => `${role}=${n}`).join(', ') || 'aucun'}`)
  for (const row of dbAccounts) console.log(`    - ${row.role.padEnd(18)} ${row.email}`)
}

console.log('\n=== 5. ASSERTIONS ===')
for (const result of results) {
  console.log(`  ${result.ok ? '✅' : '❌'} ${result.label} → obtenu: ${JSON.stringify(result.actual)} / attendu: ${JSON.stringify(result.expected)}`)
}
console.log(`\n${failures === 0 ? '✅' : '❌'} ${results.length - failures}/${results.length} assertions réussies.`)
process.exit(failures === 0 ? 0 : 1)
