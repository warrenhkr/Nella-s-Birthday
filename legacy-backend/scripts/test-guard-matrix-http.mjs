#!/usr/bin/env node
// ============================================================================
// PREUVE HTTP RÉELLE — matrice des gardes serveur BOUTIQUE + ADMIN
// Club Otaku ENEAM — Nuxt 4 / Nitro
// ============================================================================
//
// CE QUE CE SCRIPT PROUVE (et ce qu'il ne prouve PAS)
// ---------------------------------------------------
// Il ne lit AUCUNE règle dans le code : il se connecte réellement au serveur
// (POST /api/auth/login), garde la session par cookie, puis appelle chaque
// route sensible avec CHAQUE rôle. Le verdict est le code HTTP renvoyé par le
// serveur — donc par les vraies gardes (`requireShopManager`,
// `requireScopedRole`, `requireAuth`). Un contrôle uniquement côté client ne
// peut pas passer ce test : chaque refus attendu doit être un 401/403 SERVEUR.
//
//   • 401 = aucune session (ou session expirée) ;
//   • 403 = session valide mais rôle/périmètre insuffisant ;
//   • autre = la route a laissé passer la requête (le corps, volontairement
//     invalide, explique les 400/404/409 — jamais une écriture réelle).
//
// AUCUNE DONNÉE RÉELLE N'EST TOUCHÉE
// ----------------------------------
//   • les corps de requête envoyés aux routes d'ÉCRITURE sont invalides
//     ({} ou e-mail malformé) : la validation Zod renvoie 400 AVANT toute
//     écriture en base — le test prouve le passage de la garde sans créer
//     quoi que ce soit ;
//   • les identifiants utilisés dans les routes `[id]` n'existent pas
//     (`qa-garde-inexistant`) : aucune ligne existante n'est lue ni modifiée ;
//   • les comptes de test sont créés par CE script (préfixe `qa-gardes-`,
//     mot de passe aléatoire jamais affiché) et SUPPRIMÉS à la fin, y compris
//     en cas d'échec (bloc `finally`). La suppression des utilisateurs
//     entraîne celle de leurs sessions (onDelete: Cascade).
//
// USAGE (rejouable en une commande)
// ---------------------------------
//   node scripts/test-guard-matrix-http.mjs
//   node scripts/test-guard-matrix-http.mjs http://127.0.0.1:3311
//   QA_BASE_URL=https://club-otaku-eneam.vercel.app node scripts/test-guard-matrix-http.mjs
//   node scripts/test-guard-matrix-http.mjs --report docs/QA-GARDES-BOUTIQUE-2026-09-14.md
//
// Sans argument, le script sonde les URL locales usuelles et retient la
// première qui répond comme l'application Otaku (/api/health renvoie
// `data.database` + `data.prisma`), ce qui évite d'attaquer par erreur un
// autre serveur de développement installé sur la même machine.
//
// Codes de sortie : 0 = matrice conforme, 1 = au moins une divergence,
// 2 = impossible d'exécuter le test (base ou serveur indisponible).
// ============================================================================

import { randomBytes, scrypt as scryptCb } from 'node:crypto'
import { promisify } from 'node:util'
import { writeFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import pg from 'pg'

const scrypt = promisify(scryptCb)
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: resolve(ROOT, '.env'), quiet: true }) // `node scripts/...` suffit

const TIMEOUT_MS = Number(process.env.TEST_TIMEOUT_MS || 20000)
const MARKER = 'qa-gardes-'
const FAKE_ID = 'qa-garde-inexistant'
const connectionString = process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL

// ─────────────────────────────────────────────────────────────────────────────
// 1. Rôles testés et comptes associés
// ─────────────────────────────────────────────────────────────────────────────
// `ANON` n'a pas de compte : c'est la requête SANS cookie (preuve du 401).
const ACCOUNT_ROLES = {
  MEMBER: { role: 'MEMBER', adminScopes: [], slug: 'member' },
  SHOP_MANAGER: { role: 'SHOP_MANAGER', adminScopes: [], slug: 'shop' },
  INTERMEDIATE_ADMIN: { role: 'INTERMEDIATE_ADMIN', adminScopes: [], slug: 'interadmin' },
  ADMIN: { role: 'ADMIN', adminScopes: [], slug: 'admin' },
  // Administrateur LIMITÉ au gaming : la preuve que les périmètres sont
  // appliqués par le SERVEUR et pas seulement affichés par l'interface.
  ADMIN_SCOPED_GAMING: { role: 'ADMIN', adminScopes: ['gaming'], slug: 'scoped' },
  SUPER_ADMIN: { role: 'SUPER_ADMIN', adminScopes: [], slug: 'super' }
}
const ROLES = ['ANON', ...Object.keys(ACCOUNT_ROLES)]

// ─────────────────────────────────────────────────────────────────────────────
// 2. Matrice attendue — chaque entrée reflète la GARDE RÉELLE de la route
//    (relue dans server/utils/auth.ts et dans les fichiers de route).
//      allow  : rôles que la garde accepte (rôle seul, avant périmètres)
//      scopes : périmètres exigés par la route (null = garde de rôle pur)
//      ok     : codes acceptables pour un rôle AUTORISÉ (corps volontairement
//               invalide → 400 ; identifiant inexistant → 404/409)
// ─────────────────────────────────────────────────────────────────────────────
const ADMIN_ALL = ['SUPER_ADMIN', 'INTERMEDIATE_ADMIN', 'ADMIN', 'ADMIN_SCOPED_GAMING']
const OPS_ALL = ['INTERMEDIATE_ADMIN', 'ADMIN', 'ADMIN_SCOPED_GAMING']
const SHOP_ALL = ['SHOP_MANAGER', 'INTERMEDIATE_ADMIN']
const ANY_CONNECTED = ROLES.filter(role => role !== 'ANON')

const ROUTES = [
  // ── Vitrine publique (par conception, aucune session) ─────────────────────
  {
    id: 'P1',
    method: 'GET',
    path: '/api/boutique',
    guard: 'aucune (route publique)',
    allow: [],
    public: true,
    ok: [200],
    probe: 'Vitrine boutique publique (lecture seule)'
  },
  // ── /api/boutique/** — requireShopManager ─────────────────────────────────
  {
    id: 'S1',
    method: 'GET',
    path: '/api/boutique/catalog',
    guard: 'requireShopManager',
    allow: SHOP_ALL,
    scopes: null,
    ok: [200],
    probe: 'Lister le catalogue (back-office)'
  },
  {
    id: 'S2',
    method: 'GET',
    path: '/api/boutique/orders',
    guard: 'requireShopManager',
    allow: SHOP_ALL,
    scopes: null,
    ok: [200],
    probe: 'Lister les commandes'
  },
  {
    id: 'S3',
    method: 'GET',
    path: '/api/boutique/reviews',
    guard: 'requireShopManager',
    allow: SHOP_ALL,
    scopes: null,
    ok: [200],
    probe: 'Modération des avis'
  },
  {
    id: 'S4',
    method: 'POST',
    path: '/api/boutique/catalog',
    body: {},
    guard: 'requireShopManager',
    allow: SHOP_ALL,
    scopes: null,
    ok: [400],
    probe: 'Créer un produit (corps invalide → 400, aucune écriture)'
  },
  {
    id: 'S5',
    method: 'PATCH',
    path: `/api/boutique/catalog/${FAKE_ID}`,
    body: {},
    guard: 'requireShopManager',
    allow: SHOP_ALL,
    scopes: null,
    ok: [400],
    probe: 'Modifier un produit (corps invalide → 400)'
  },
  {
    id: 'S6',
    method: 'DELETE',
    path: `/api/boutique/catalog/${FAKE_ID}`,
    guard: 'requireShopManager',
    allow: SHOP_ALL,
    scopes: null,
    ok: [409],
    probe: 'Supprimer un produit inexistant → 409'
  },
  {
    id: 'S7',
    method: 'POST',
    path: '/api/boutique/orders',
    body: {},
    guard: 'requireAuth (commande passée par un membre)',
    allow: ANY_CONNECTED,
    scopes: null,
    ok: [400, 404, 409],
    probe: 'Commander (réservé aux membres connectés)'
  },
  {
    id: 'S8',
    method: 'POST',
    path: `/api/boutique/products/${FAKE_ID}/reviews`,
    body: {},
    guard: 'requireAuth (avis déposé par un membre)',
    allow: ANY_CONNECTED,
    scopes: null,
    ok: [400, 404],
    probe: 'Laisser un avis sur un produit inexistant'
  },
  // ── /api/admin/** — supervision (requireAdmin) ────────────────────────────
  {
    id: 'A1',
    method: 'GET',
    path: '/api/admin/stats',
    guard: "requireAdmin(event, ['membres','supervision'])",
    allow: ADMIN_ALL,
    scopes: ['membres', 'supervision'],
    ok: [200],
    probe: 'Statistiques du club'
  },
  {
    id: 'A2',
    method: 'GET',
    path: '/api/admin/accounts',
    guard: "requireAdmin(event, ['supervision'])",
    allow: ADMIN_ALL,
    scopes: ['supervision'],
    ok: [200],
    probe: 'Lister les comptes (attribution des rôles)'
  },
  {
    id: 'A3',
    method: 'GET',
    path: '/api/admin/admins',
    guard: "requireAdmin(event, ['supervision'])",
    allow: ADMIN_ALL,
    scopes: ['supervision'],
    ok: [200],
    probe: 'Lister les administrateurs'
  },
  {
    id: 'A4',
    method: 'POST',
    path: '/api/admin/admins',
    body: { email: 'pas-un-email' },
    guard: "requireAdmin(event, ['supervision'])",
    allow: ADMIN_ALL,
    scopes: ['supervision'],
    ok: [400],
    probe: 'Créer un administrateur (corps invalide → 400, aucun compte créé)'
  },
  // ── /api/admin/** — supervision stricte (requireSuperAdmin) ───────────────
  {
    id: 'A5',
    method: 'PATCH',
    path: `/api/admin/admins/${FAKE_ID}`,
    body: {},
    guard: 'requireSuperAdmin',
    allow: ['SUPER_ADMIN'],
    scopes: null,
    ok: [400, 404],
    probe: 'Modifier un administrateur (identifiant inexistant)'
  },
  {
    id: 'A6',
    method: 'DELETE',
    path: `/api/admin/admins/${FAKE_ID}`,
    guard: 'requireSuperAdmin',
    allow: ['SUPER_ADMIN'],
    scopes: null,
    ok: [404, 409],
    probe: 'Supprimer un administrateur inexistant'
  },
  // ── /api/admin/** — opérations (requireAdminOps) ──────────────────────────
  {
    id: 'A7',
    method: 'GET',
    path: '/api/admin/members',
    guard: "requireAdminOps(event, ['membres','supervision'])",
    allow: OPS_ALL,
    scopes: ['membres', 'supervision'],
    ok: [200],
    probe: 'Annuaire des membres'
  },
  {
    id: 'A8',
    method: 'GET',
    path: '/api/admin/cards',
    guard: "requireAdminOps(event, ['membres'])",
    allow: OPS_ALL,
    scopes: ['membres'],
    ok: [200],
    probe: 'Cartes Otaku à valider'
  },
  // ── /api/admin/** — événementiel / modération (requireEventManager) ───────
  {
    id: 'A9',
    method: 'GET',
    path: '/api/admin/gallery',
    guard: "requireEventManager(event, ['moderation'])",
    allow: OPS_ALL,
    scopes: ['moderation'],
    ok: [200],
    probe: 'Galerie (modération)'
  },
  {
    id: 'A10',
    method: 'GET',
    path: '/api/admin/imports',
    guard: "requireEventManager(event, ['evenementiel'])",
    allow: OPS_ALL,
    scopes: ['evenementiel'],
    ok: [200],
    probe: 'Imports d’événements'
  },
  {
    id: 'A11',
    method: 'GET',
    path: `/api/admin/events/${FAKE_ID}/attendees`,
    guard: "requireEventManager(event, ['evenementiel'])",
    allow: OPS_ALL,
    scopes: ['evenementiel'],
    ok: [404],
    probe: 'Inscrits d’un événement inexistant'
  },
  {
    id: 'A12',
    method: 'GET',
    path: `/api/admin/events/${FAKE_ID}/media-count`,
    guard: "requireEventManager(event, ['evenementiel'])",
    allow: OPS_ALL,
    scopes: ['evenementiel'],
    ok: [200, 404],
    probe: 'Compteur de médias d’un événement inexistant'
  },
  // ── /api/admin/orders — boutique (requireShopManager) ─────────────────────
  {
    id: 'A13',
    method: 'GET',
    path: '/api/admin/orders',
    guard: 'requireShopManager',
    allow: SHOP_ALL,
    scopes: null,
    ok: [200],
    probe: 'Commandes (vue administration)'
  },
  {
    id: 'A14',
    method: 'PATCH',
    path: `/api/admin/orders/${FAKE_ID}`,
    body: { status: 'COMPLETED' },
    guard: 'requireShopManager',
    allow: SHOP_ALL,
    scopes: null,
    ok: [400, 404],
    probe: 'Changer le statut d’une commande inexistante'
  },
  // ── Opérations du club hors /api/admin (mêmes gardes) ─────────────────────
  {
    id: 'O1',
    method: 'GET',
    path: '/api/tournaments',
    guard: "requireAdminOps(event, ['gaming'])",
    allow: OPS_ALL,
    scopes: ['gaming'],
    ok: [200],
    probe: 'Tournois (cockpit gaming)'
  },
  {
    id: 'O2',
    method: 'POST',
    path: '/api/tournaments',
    body: {},
    guard: "requireAdminOps(event, ['gaming'])",
    allow: OPS_ALL,
    scopes: ['gaming'],
    ok: [400],
    probe: 'Créer un tournoi (corps invalide → 400, aucun tournoi créé)'
  },
  {
    id: 'O3',
    method: 'GET',
    path: '/api/teams/admin',
    guard: "requireAdminOps(event, ['gaming'])",
    allow: OPS_ALL,
    scopes: ['gaming'],
    ok: [200],
    probe: 'Équipes du club'
  },
  {
    id: 'O4',
    method: 'POST',
    path: '/api/events',
    body: {},
    guard: "requireEventManager(event, ['evenementiel'])",
    allow: OPS_ALL,
    scopes: ['evenementiel'],
    ok: [400],
    probe: 'Créer un événement (corps invalide → 400, aucun événement créé)'
  },
  {
    id: 'O5',
    method: 'POST',
    path: '/api/events/bulk',
    body: {},
    guard: "requireEventManager(event, ['evenementiel'])",
    allow: OPS_ALL,
    scopes: ['evenementiel'],
    ok: [400],
    probe: 'Import groupé d’événements (corps invalide → 400)'
  }
]

/**
 * Verdict attendu pour un couple (route, rôle).
 * Renvoie un nombre (refus ou route publique) ou un tableau de codes
 * acceptables pour un rôle autorisé.
 */
function expected(route, roleKey) {
  if (roleKey === 'ANON') return route.public ? route.ok : 401
  if (route.public) return route.ok
  if (!route.allow.includes(roleKey)) return 403
  // Administrateur à périmètre : la garde accepte le rôle, mais le PÉRIMÈTRE
  // requis par la route doit lui être ouvert (échec fermé sinon).
  if (roleKey === 'ADMIN_SCOPED_GAMING' && route.scopes && !route.scopes.includes('gaming')) return 403
  return route.ok
}

function formatExpected(value) {
  return Array.isArray(value) ? value.join('/') : String(value)
}

function formatRoute(route) {
  return `${route.method} ${route.path}`
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Utilitaires HTTP
// ─────────────────────────────────────────────────────────────────────────────
async function http(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(TIMEOUT_MS) })
}

const CANDIDATES = [
  process.argv[2]?.startsWith('http') ? process.argv[2] : null,
  process.env.QA_BASE_URL,
  process.env.TEST_BASE_URL,
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3311',
  'http://127.0.0.1:3100',
  'http://localhost:3000'
].filter(Boolean).map(url => url.replace(/\/$/, ''))

/** Ne retient qu'un serveur qui répond comme l'application Otaku. */
async function resolveBaseUrl() {
  for (const base of [...new Set(CANDIDATES)]) {
    try {
      const response = await http(`${base}/api/health`, {})
      if (response.status !== 200) continue
      const payload = await response.json().catch(() => null)
      if (payload?.data?.database && payload?.data?.prisma) return base
    } catch {
      // serveur absent : on essaie le suivant
    }
  }
  return null
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = await scrypt(password, salt, 64)
  return `scrypt:${salt}:${derivedKey.toString('hex')}`
}

async function login(baseUrl, email, password) {
  // La connexion est limitée à 10 tentatives / 5 min / IP par
  // server/utils/rate-limit.ts : on réessaie proprement sur 429.
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await http(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    if (response.status === 429 && attempt < 3) {
      console.log(`  … limiteur de connexion atteint (429) — attente 65 s puis nouvelle tentative (${attempt}/2)`)
      await new Promise(resolve => setTimeout(resolve, 65000))
      continue
    }
    const cookies = response.headers.getSetCookie?.() || []
    return {
      status: response.status,
      cookie: cookies.map(entry => entry.split(';')[0]).join('; ')
    }
  }
  return { status: 429, cookie: '' }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Exécution
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  if (!connectionString) {
    console.error('DATABASE_URL absent : vérifie le fichier .env du dépôt.')
    process.exit(2)
  }

  const baseUrl = await resolveBaseUrl()
  if (!baseUrl) {
    console.error('Aucun serveur Otaku joignable (/api/health).')
    console.error(`URL essayées : ${[...new Set(CANDIDATES)].join(', ')}`)
    console.error('Démarre-le (npx nuxt dev --port 3311) ou passe une URL en argument.')
    process.exit(2)
  }

  const reportIndex = process.argv.indexOf('--report')
  const reportPath = reportIndex !== -1 ? process.argv[reportIndex + 1] : null

  console.log('=== Matrice des gardes serveur — preuve HTTP réelle ===')
  console.log(`  serveur        : ${baseUrl}`)
  console.log(`  rôles testés   : ${ROLES.join(', ')}`)

  const client = new pg.Client({
    connectionString,
    ssl: /sslmode=require/.test(connectionString) ? { rejectUnauthorized: false } : undefined
  })
  await client.connect()

  const created = []
  try {
    // Les comptes d'une exécution précédente interrompue porteraient le même
    // e-mail unique : on nettoie d'abord (ils sont tous à nous, préfixe dédié).
    await client.query('DELETE FROM users WHERE email LIKE $1', [`${MARKER}%`])

    const password = randomBytes(18).toString('base64url')
    const hash = await hashPassword(password)

    console.log('\n--- 1. Comptes de test (temporaires, préfixe qa-gardes-) ---')
    for (const [roleKey, def] of Object.entries(ACCOUNT_ROLES)) {
      const email = `${MARKER}${def.slug}@otaku.club`
      const pseudo = `qagardes${def.slug}`
      const result = await client.query(
        `INSERT INTO users (id, email, pseudo, password, role, "isActive", "adminScopes", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4::"Role", true, $5::text[], now(), now())
         RETURNING id`,
        [email, pseudo, hash, def.role, def.adminScopes]
      )
      created.push({ email, id: result.rows[0].id, roleKey })
      console.log(`  ${roleKey.padEnd(20)} ${email.padEnd(34)} role=${def.role.padEnd(18)} scopes=[${def.adminScopes.join(', ')}]`)
    }

    console.log('\n--- 2. Sessions réelles (POST /api/auth/login) ---')
    const sessions = { ANON: '' }
    for (const account of created) {
      const { status, cookie } = await login(baseUrl, account.email, password)
      if (status !== 200 || !cookie) {
        console.error(`  ${account.roleKey.padEnd(20)} connexion ÉCHOUÉE (HTTP ${status})`)
        process.exitCode = 2
        return
      }
      sessions[account.roleKey] = cookie
      console.log(`  ${account.roleKey.padEnd(20)} session ouverte (HTTP ${status}, cookie otaku_session)`)
    }

    console.log('\n--- 3. Appels HTTP par rôle et par route ---')
    const rows = []
    for (const route of ROUTES) {
      for (const roleKey of ROLES) {
        const want = expected(route, roleKey)
        const headers = {}
        if (sessions[roleKey]) headers.cookie = sessions[roleKey]
        let status = 0
        let body
        try {
          const response = await http(`${baseUrl}${route.path}`, {
            method: route.method,
            headers: {
              ...headers,
              ...(route.body !== undefined ? { 'content-type': 'application/json' } : {})
            },
            body: route.body !== undefined ? JSON.stringify(route.body) : undefined
          })
          status = response.status
          body = await response.text().catch(() => '')
        } catch (error) {
          status = 0
          body = String(error?.message || error)
        }

        const ok = Array.isArray(want) ? want.includes(status) : status === want
        rows.push({
          routeId: route.id,
          method: route.method,
          path: route.path,
          guard: route.guard,
          probe: route.probe,
          role: roleKey,
          expected: want,
          status,
          pass: ok,
          note: ok ? '' : body.slice(0, 200).replace(/\s+/g, ' ')
        })
        console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${route.id.padEnd(4)} ${roleKey.padEnd(20)} ${formatRoute(route).padEnd(52)} attendu ${formatExpected(want).padEnd(10)} → ${status}`)
      }
    }

    // ── Synthèse ───────────────────────────────────────────────────────────
    const failures = rows.filter(row => !row.pass)
    console.log('\n--- 4. Synthèse ---')
    console.log(`  ${rows.length} couples (route × rôle) testés, ${failures.length} divergence(s).`)
    if (failures.length) {
      for (const failure of failures) {
        console.log(`  FAIL ${failure.routeId} ${failure.role} ${formatRoute(failure)} attendu ${formatExpected(failure.expected)} / obtenu ${failure.status}`)
      }
    }
    // Garanties minimales de la preuve : sans elles, la matrice ne prouve rien.
    const refusals = rows.filter(row => pageIsRefusal(row))
    console.log(`  401/403 obtenus réellement : ${refusals.filter(row => row.status === 401).length} × 401, ${refusals.filter(row => row.status === 403).length} × 403`)
    const acceptations = rows.filter(row => row.role !== 'ANON' && Array.isArray(row.expected) && row.status < 400)
    console.log(`  réponses 2xx obtenues avec le bon rôle : ${acceptations.length}`)

    if (reportPath) {
      const markdown = buildReport({ baseUrl, rows, failures, created })
      mkdirSync(dirname(resolve(reportPath)), { recursive: true })
      writeFileSync(resolve(reportPath), markdown, 'utf8')
      console.log(`\n  rapport écrit : ${resolve(reportPath)}`)
    }

    if (failures.length) process.exitCode = 1
  } finally {
    // ── Nettoyage OBLIGATOIRE (même en cas d'erreur) ───────────────────────
    const deleted = await client.query('DELETE FROM users WHERE email LIKE $1 RETURNING email', [`${MARKER}%`])
    console.log(`\n--- 5. Nettoyage ---`)
    console.log(`  comptes de test supprimés : ${deleted.rowCount} (sessions supprimées en cascade)`)
    const leftover = await client.query('SELECT email, role FROM users WHERE email LIKE $1 ORDER BY email', [`${MARKER}%`])
    console.log(`  restes avec le préfixe ${MARKER} : ${leftover.rowCount}`)
    await client.end()
  }
}

function pageIsRefusal(row) {
  return row.status === 401 || row.status === 403
}

function buildReport({ baseUrl, rows, failures, created }) {
  const now = new Date()
  const date = now.toISOString().slice(0, 10)
  let commit = 'inconnu'
  try {
    commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT }).toString().trim()
  } catch { /* dépôt absent */ }

  const lines = []
  lines.push(`# QA — gardes serveur boutique & administration (${date})`)
  lines.push('')
  lines.push('Preuve HTTP réelle de la matrice des droits. **Chaque ligne est un appel HTTP')
  lines.push('authentifié par cookie de session** sur le serveur cible : aucun contrôle')
  lines.push('côté client n\'est pris en compte.')
  lines.push('')
  lines.push(`- Serveur ciblé : \`${baseUrl}\``)
  lines.push(`- Commit : \`${commit}\``)
  lines.push(`- Exécuté le : ${now.toISOString()}`)
  lines.push(`- Script : \`scripts/test-guard-matrix-http.mjs\` (rejouable en une commande)`)
  lines.push('')
  lines.push('## Rôles testés')
  lines.push('')
  lines.push('| Rôle | Compte | Origine |')
  lines.push('| --- | --- | --- |')
  lines.push('| ANON | — | requête sans cookie |')
  for (const account of created) {
    const def = ACCOUNT_ROLES[account.roleKey]
    lines.push(`| ${account.roleKey} | \`${account.email}\` | compte temporaire du script (supprimé après le test) — role=${def.role}, adminScopes=[${def.adminScopes.join(', ')}] |`)
  }
  lines.push('')
  lines.push('## Méthode')
  lines.push('')
  lines.push('1. Chaque rôle reçoit un compte temporaire (`qa-gardes-…`, mot de passe aléatoire');
  lines.push('   jamais affiché), supprimé à la fin du test.');
  lines.push('2. Une session réelle est ouverte par `POST /api/auth/login` et conservée par le');
  lines.push('   cookie `otaku_session`.');
  lines.push('3. Chaque route sensible est appelée avec la session de chaque rôle.');
  lines.push('4. Les corps envoyés aux routes d\'écriture sont **volontairement invalides** : la');
  lines.push('   validation Zod renvoie 400 avant toute écriture, ce qui prouve le franchissement');
  lines.push('   de la garde sans créer de donnée. Les identifiants `[id]` utilisés n\'existent pas.');
  lines.push('')
  lines.push(`\`400\`/\`404\`/\`409\` sur un rôle autorisé = la garde a laissé passer ; \`403\` = rôle ou`)
  lines.push('périmètre insuffisant ; `401` = aucune session.')
  lines.push('')
  lines.push('## Matrice détaillée (route × rôle)')
  lines.push('')
  lines.push('| # | Route | Garde serveur | Rôle | Statut attendu | Statut obtenu | Verdict |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- |')
  for (const row of rows) {
    lines.push(`| ${row.routeId} | \`${formatRoute(row)}\` | \`${row.guard}\` | ${row.role} | ${formatExpected(row.expected)} | **${row.status}** | ${row.pass ? '✅' : '❌'} |`)
  }
  lines.push('')
  lines.push('## Ce que chaque route vérifie')
  lines.push('')
  lines.push('| # | Route | Objet |')
  lines.push('| --- | --- | --- |')
  for (const route of ROUTES) {
    lines.push(`| ${route.id} | \`${formatRoute(route)}\` | ${route.probe} |`)
  }
  lines.push('')
  lines.push('## Résultat')
  lines.push('')
  lines.push(`- Couples (route × rôle) testés : **${rows.length}**`)
  lines.push(`- Divergences : **${failures.length}**`)
  lines.push('')
  if (failures.length) {
    lines.push('### Divergences constatées')
    lines.push('')
    for (const failure of failures) {
      lines.push(`- \`${formatRoute(failure)}\` avec **${failure.role}** : attendu ${formatExpected(failure.expected)}, obtenu ${failure.status}${failure.note ? ` — ${failure.note}` : ''}`)
    }
  } else {
    lines.push('Toutes les routes refusent bien les rôles non autorisés (401 sans session,')
    lines.push('403 avec un rôle ou un périmètre insuffisant) et répondent aux rôles autorisés.')
  }
  lines.push('')
  lines.push('## Nettoyage')
  lines.push('')
  lines.push('Les comptes temporaires créés pour le test sont supprimés à la fin de l\'exécution')
  lines.push('(y compris en cas d\'erreur) ; leurs sessions suivent en cascade. Aucune donnée de')
  lines.push('production n\'est lue, modifiée ou supprimée par ce script.')
  lines.push('')
  return lines.join('\n')
}

main().catch(async (error) => {
  console.error(error)
  process.exit(1)
})
