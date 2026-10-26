#!/usr/bin/env node
// ============================================================================
// MATRICE RUNTIME DES RÔLES — Club Otaku ENEAM (Nuxt 4 / Nitro)
// ============================================================================
//
// CE QUE CE SCRIPT PROUVE
// -----------------------
// Il n'exécute AUCUNE règle en local : il ouvre une VRAIE session par rôle
// (POST /api/auth/login sur un serveur réellement démarré), conserve le cookie
// `otaku_session`, puis appelle chaque route sensible. Le verdict est le code
// HTTP renvoyé par le serveur — donc par les vraies gardes de
// `server/utils/auth.ts` (requireAuth, requireRole, requireScopedRole,
// requireAdmin, requireAdminOps, requireEventManager, requireShopManager,
// requireSuperAdmin). Une garde uniquement côté interface ne peut pas passer
// ce test : tout refus attendu doit être un 401/403 SERVEUR.
//
//   • 401 = aucune session (ou session expirée) ;
//   • 403 = session valide mais rôle/périmètre insuffisant ;
//   • 400/404/409 = la route a laissé passer la requête, et la validation a
//     refusé un corps volontairement invalide (jamais une écriture).
//
// MATRICE COUVERTE (règle du club depuis le 11/09/2026)
// -----------------------------------------------------
//   SUPER_ADMIN         supervision seulement : admins / comptes / stats /
//                       signalements. 403 sur boutique, événements, galerie,
//                       imports, cartes membres, tournois.
//   INTERMEDIATE_ADMIN  parité boutique avec SHOP_MANAGER + administration du
//                       club (cartes, stats, tournois, événements, galerie,
//                       imports). AUCUNE route requireSuperAdmin.
//   ADMIN               administration du club ; 403 sur la boutique ;
//                       aucune route requireSuperAdmin.
//   SHOP_MANAGER        boutique seulement ; 403 partout ailleurs dans l'admin.
//   MEMBER              parcours membre public ; 403 sur l'admin et la boutique.
//
// AUCUNE DONNÉE DE TEST N'EST LAISSÉE DERRIÈRE
// --------------------------------------------
//   • les corps envoyés aux routes d'ÉCRITURE sont invalides ({} ou identifiant
//     inexistant `qa-roles-inexistant`) : la validation renvoie 400/404 AVANT
//     toute écriture — le test prouve le franchissement de la garde sans rien
//     créer (méthode déjà employée par scripts/test-guard-matrix-http.mjs) ;
//   • aucun compte n'est créé, modifié ni supprimé par ce script.
//
// COMPTES
// -------
// Un compte par rôle. Les mots de passe ne sont JAMAIS imprimés. Sources, dans
// l'ordre : SEED_TEST_PASSWORD puis %USERPROFILE%/otaku-comptes-demo.txt
// (format « email role motdepasse », écrit par scripts/secure-demo-accounts.mjs)
// puis %USERPROFILE%/.qa-runtime-sessions.json (comptes de QA temporaires créés
// par scripts/test-runtime-prod-roles.mjs). Pour chaque rôle, le script essaie
// ses emails candidats dans l'ordre et retient le premier qui ouvre une session.
// Si AUCUN compte d'un rôle n'ouvre de session, ce rôle est déclaré
// « non testable » et le script sort en code 2 : une matrice incomplète ne
// prouve rien, elle ne doit pas passer pour verte.
//
// USAGE
// -----
//   node scripts/test-runtime-roles.mjs                       # détecte le serveur
//   node scripts/test-runtime-roles.mjs http://localhost:3224
//   QA_BASE_URL=https://club-otaku-eneam.vercel.app node scripts/test-runtime-roles.mjs
//   node scripts/test-runtime-roles.mjs --report .qa-tmp/roles.json
//   node scripts/test-runtime-roles.mjs --no-pages            # API seulement
//   node scripts/test-runtime-roles.mjs --fresh               # ignore le cache de session
//
// Le cookie de session est mis en cache dans %USERPROFILE%/.qa-roles-sessions.json
// et réutilisé tant que /api/auth/me répond : sans cela, /api/auth/login
// (10 tentatives / 5 min / IP) épuise son quota en deux exécutions et renvoie
// des 429 au lieu de tester les droits.
//
// Codes de sortie : 0 = 0 divergence · 1 = au moins une divergence ·
//                   2 = test impossible (serveur injoignable ou rôle sans session).
// ============================================================================

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'
import dotenv from 'dotenv'
import pg from 'pg'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: resolve(ROOT, '.env'), quiet: true }) // `node scripts/...` suffit

const TIMEOUT_MS = Number(process.env.TEST_TIMEOUT_MS || 20000)
const FAKE_ID = 'qa-roles-inexistant'
const connectionString = process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL
const withPages = !process.argv.includes('--no-pages')

// ─────────────────────────────────────────────────────────────────────────────
// 1. Rôles et comptes candidats
// ─────────────────────────────────────────────────────────────────────────────
// `ANON` n'a pas de compte : c'est la requête SANS cookie (preuve du 401).
const ROLES = ['ANON', 'MEMBER', 'SHOP_MANAGER', 'INTERMEDIATE_ADMIN', 'ADMIN', 'SUPER_ADMIN']

// Emails essayés dans l'ordre pour chaque rôle. Les comptes de QA `qa-runtime-*`
// sont ceux créés (puis conservés) par scripts/test-runtime-prod-roles.mjs : leur
// mot de passe est dans %USERPROFILE%/.qa-runtime-sessions.json. Les comptes
// @otaku.club viennent de scripts/secure-demo-accounts.mjs.
const CANDIDATES = {
  MEMBER: ['aiko@otaku.club', 'ryu@otaku.club', 'yuno@otaku.club'],
  SHOP_MANAGER: ['mika@otaku.club'],
  INTERMEDIATE_ADMIN: ['qa-runtime-interadmin@otaku.club'],
  ADMIN: ['admin629427@otaku.club', 'check142414@otaku.club'],
  SUPER_ADMIN: ['qa-runtime-superadmin@otaku.club']
}

const DEMO_PASSWORDS_FILE = resolve(homedir(), 'otaku-comptes-demo.txt')
const QA_SESSIONS_FILE = resolve(homedir(), '.qa-runtime-sessions.json')
// Cache des SESSIONS (hors dépôt, comme les autres secrets de QA).
//
// POURQUOI : /api/auth/login est limité par IP (server/utils/rate-limit.ts :
// 10 tentatives / fenêtre glissante). Un script qui se reconnecte à chaque
// exécution épuise le quota en deux lancements — le troisième reçoit des 429
// et la matrice devient inexploitable. Le cookie `otaku_session` est donc
// réutilisé tant qu'il ouvre encore /api/auth/me ; on ne refait une connexion
// que lorsque la session est absente, expirée ou d'un autre rôle.
const SESSION_CACHE_FILE = resolve(homedir(), '.qa-roles-sessions.json')
const freshSessions = process.argv.includes('--fresh')

function loadSessionCache() {
  if (freshSessions || !existsSync(SESSION_CACHE_FILE)) return {}
  try {
    return JSON.parse(readFileSync(SESSION_CACHE_FILE, 'utf8'))
  } catch {
    return {}
  }
}

/** Lit « email role motdepasse » (le mot de passe n'est jamais réaffiché). */
function loadDemoPasswords() {
  const map = new Map()
  if (!existsSync(DEMO_PASSWORDS_FILE)) return map
  for (const raw of readFileSync(DEMO_PASSWORDS_FILE, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const parts = line.split(/\s+/)
    if (parts.length < 3 || !parts[0].includes('@')) continue
    map.set(parts[0].toLowerCase(), parts[2])
  }
  return map
}

/** Comptes de QA temporaires (mot de passe généré, stocké hors dépôt). */
function loadQaPasswords() {
  const map = new Map()
  if (!existsSync(QA_SESSIONS_FILE)) return map
  try {
    const state = JSON.parse(readFileSync(QA_SESSIONS_FILE, 'utf8'))
    for (const account of Object.values(state.temp || {})) {
      if (account?.email && account?.password) map.set(String(account.email).toLowerCase(), account.password)
    }
  } catch {
    // fichier illisible : on continue avec les autres sources
  }
  return map
}

const demoPasswords = loadDemoPasswords()
const qaPasswords = loadQaPasswords()
const globalPassword = process.env.SEED_TEST_PASSWORD || ''
const passwordFor = (email) => {
  const key = String(email).toLowerCase()
  return globalPassword || demoPasswords.get(key) || qaPasswords.get(key) || ''
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Matrice attendue — chaque ligne reflète la GARDE RÉELLE de la route
// ─────────────────────────────────────────────────────────────────────────────
//   allow : rôles que la garde accepte AVANT périmètres
//   ok    : codes acceptables pour un rôle autorisé (corps invalide → 400,
//           identifiant inexistant → 404/409) ; les codes ci-dessous ont été
//           vérifiés en direct, jamais supposés.
const SHOP_ALL = ['SHOP_MANAGER', 'INTERMEDIATE_ADMIN']
const SUPERVISION_ALL = ['SUPER_ADMIN', 'INTERMEDIATE_ADMIN', 'ADMIN']
const OPS_ALL = ['INTERMEDIATE_ADMIN', 'ADMIN']

const ROUTES = [
  // ── Vitrine publique : aucune session requise ─────────────────────────────
  { id: 'P1', method: 'GET', path: '/api/health', guard: 'aucune (santé)', public: true, ok: [200], label: 'Santé du serveur' },
  { id: 'P2', method: 'GET', path: '/api/home', guard: 'aucune (accueil)', public: true, ok: [200], label: 'Contenu de la page d’accueil' },
  { id: 'P3', method: 'GET', path: '/api/galerie', guard: 'aucune (galerie publique)', public: true, ok: [200], label: 'Galerie publique' },
  { id: 'P4', method: 'GET', path: '/api/communaute/posts', guard: 'aucune (fil communautaire)', public: true, ok: [200], label: 'Fil de la communauté' },

  // ── Espace membre : requireAuth (tout compte connecté) ────────────────────
  { id: 'M1', method: 'GET', path: '/api/boutique', guard: 'aucune (vitrine boutique)', public: true, ok: [200], label: 'Vitrine boutique publique' },
  { id: 'M2', method: 'GET', path: '/api/auth/me', guard: 'requireAuth', allow: ROLES.filter(r => r !== 'ANON'), ok: [200], label: 'Profil de session' },
  { id: 'M3', method: 'GET', path: '/api/events', guard: 'requireAuth', allow: ROLES.filter(r => r !== 'ANON'), ok: [200], label: 'Événements (vue membre)' },
  { id: 'M4', method: 'GET', path: '/api/notifications', guard: 'requireAuth', allow: ROLES.filter(r => r !== 'ANON'), ok: [200], label: 'Notifications' },
  { id: 'M5', method: 'GET', path: '/api/member/card', guard: 'requireAuth', allow: ROLES.filter(r => r !== 'ANON'), ok: [200], label: 'Carte Otaku du membre' },
  { id: 'M6', method: 'GET', path: '/api/orders', guard: 'requireAuth', allow: ROLES.filter(r => r !== 'ANON'), ok: [200], label: 'Mes commandes boutique' },
  { id: 'M7', method: 'GET', path: '/api/issue-reports', guard: 'requireAuth (filtré par auteur sauf SUPER_ADMIN)', allow: ROLES.filter(r => r !== 'ANON'), ok: [200], label: 'Signalements' },
  { id: 'M8', method: 'GET', path: '/api/tournaments/public', guard: 'requireAuth', allow: ROLES.filter(r => r !== 'ANON'), ok: [200], label: 'Tournois publics' },

  // ── Boutique : requireShopManager (SHOP_MANAGER + INTERMEDIATE_ADMIN) ─────
  { id: 'S1', method: 'GET', path: '/api/boutique/catalog', guard: 'requireShopManager', allow: SHOP_ALL, ok: [200], label: 'Catalogue (back-office)' },
  { id: 'S2', method: 'GET', path: '/api/boutique/orders', guard: 'requireShopManager', allow: SHOP_ALL, ok: [200], label: 'Commandes boutique' },
  { id: 'S3', method: 'GET', path: '/api/boutique/reviews', guard: 'requireShopManager', allow: SHOP_ALL, ok: [200], label: 'Modération des avis' },
  { id: 'S4', method: 'GET', path: '/api/admin/orders', guard: 'requireShopManager', allow: SHOP_ALL, ok: [200], label: 'Commandes (vue administration)' },

  // ── Supervision des comptes : requireAdmin(+supervision) ─────────────────
  { id: 'A1', method: 'GET', path: '/api/admin/admins', guard: "requireAdmin(['supervision'])", allow: SUPERVISION_ALL, ok: [200], label: 'Liste des administrateurs' },
  { id: 'A2', method: 'GET', path: '/api/admin/accounts', guard: "requireAdmin(['supervision'])", allow: SUPERVISION_ALL, ok: [200], label: 'Liste des comptes' },
  { id: 'A3', method: 'GET', path: '/api/admin/stats', guard: "requireAdmin(['membres','supervision'])", allow: SUPERVISION_ALL, ok: [200], label: 'Statistiques du club' },
  { id: 'A4', method: 'POST', path: '/api/admin/admins', body: {}, guard: "requireAdmin(['supervision']) + règle de rôle interne", allow: SUPERVISION_ALL, ok: [400], label: 'Créer un administrateur (corps invalide → 400)' },
  // Désactivation / réattribution d'un compte : même garde de supervision que
  // la liste. Corps volontairement vide → 400 avant toute écriture ; un
  // INTERMEDIATE_ADMIN qui tenterait de nommer un autre intermédiaire est
  // refusé par la règle interne (403), mais un SHOP_MANAGER/MEMBER inconnu de
  // la supervision reste refusé par la GARDE (403) — c'est ce que mesure ici la ligne.
  { id: 'A5', method: 'PATCH', path: `/api/admin/accounts/${FAKE_ID}`, body: {}, guard: "requireAdmin(['supervision'])", allow: SUPERVISION_ALL, ok: [400, 404], label: 'Désactiver/réattribuer un compte (corps invalide → 400)' },

  // ── Super-admin strict : requireSuperAdmin (SUPER_ADMIN seul) ────────────
  { id: 'X1', method: 'PATCH', path: `/api/admin/admins/${FAKE_ID}`, body: {}, guard: 'requireSuperAdmin', allow: ['SUPER_ADMIN'], ok: [400, 404], label: 'Désactiver/modifier un administrateur' },
  { id: 'X2', method: 'DELETE', path: `/api/admin/admins/${FAKE_ID}`, guard: 'requireSuperAdmin', allow: ['SUPER_ADMIN'], ok: [404, 409], label: 'Supprimer un administrateur' },
  { id: 'X3', method: 'PATCH', path: `/api/issue-reports/${FAKE_ID}`, body: {}, guard: 'requireSuperAdmin', allow: ['SUPER_ADMIN'], ok: [400, 404], label: 'Traiter un signalement' },

  // ── Opérations du club : requireAdminOps (INTERMEDIATE_ADMIN + ADMIN) ────
  { id: 'O1', method: 'GET', path: '/api/admin/cards', guard: "requireAdminOps(['membres'])", allow: OPS_ALL, ok: [200], label: 'Cartes Otaku à valider' },
  { id: 'O2', method: 'GET', path: '/api/admin/members', guard: "requireAdminOps(['membres','supervision'])", allow: OPS_ALL, ok: [200], label: 'Annuaire des membres' },
  { id: 'O3', method: 'GET', path: '/api/tournaments', guard: "requireAdminOps(['gaming'])", allow: OPS_ALL, ok: [200], label: 'Tournois (cockpit)' },
  { id: 'O4', method: 'GET', path: '/api/teams/admin', guard: "requireAdminOps(['gaming'])", allow: OPS_ALL, ok: [200], label: 'Équipes du club' },

  // ── Événementiel / médias : requireEventManager (idem ADMIN) ─────────────
  { id: 'E1', method: 'GET', path: `/api/admin/events/${FAKE_ID}/attendees`, guard: "requireEventManager(['evenementiel'])", allow: OPS_ALL, ok: [404], label: 'Inscrits d’un événement inexistant' },
  { id: 'E2', method: 'GET', path: `/api/admin/events/${FAKE_ID}/media-count`, guard: "requireEventManager(['evenementiel'])", allow: OPS_ALL, ok: [200, 404], label: 'Compteur de médias d’un événement inexistant' },
  { id: 'E3', method: 'GET', path: '/api/admin/gallery', guard: "requireEventManager(['moderation'])", allow: OPS_ALL, ok: [200], label: 'Galerie (modération)' },
  { id: 'E4', method: 'GET', path: '/api/admin/imports', guard: "requireEventManager(['evenementiel'])", allow: OPS_ALL, ok: [200], label: 'Imports d’événements' },
  { id: 'E5', method: 'POST', path: '/api/events', body: {}, guard: "requireEventManager(['evenementiel'])", allow: OPS_ALL, ok: [400], label: 'Créer un événement (corps invalide → 400)' },
  { id: 'E6', method: 'POST', path: '/api/tournaments', body: {}, guard: "requireAdminOps(['gaming'])", allow: OPS_ALL, ok: [400], label: 'Créer un tournoi (corps invalide → 400)' },

  // ── Référence : route d’administration des événements ───────────────────
  // `/api/admin/events` n’existe PAS (aucun handler) : la liste des événements
  // passe par GET /api/events. Attendu 404 pour tout le monde, y compris ANON —
  // une route inexistante ne divulgue rien et ne peut donc pas être une garde.
  { id: 'R1', method: 'GET', path: '/api/admin/events', guard: 'aucune (route inexistante)', pathless: true, ok: [404], label: 'Liste admin des événements (route inexistante)' }
]

// ─────────────────────────────────────────────────────────────────────────────
// 3. Pages : le middleware SSR s’exécute côté serveur → on observe le 302.
// ─────────────────────────────────────────────────────────────────────────────
const PAGES = [
  { path: '/boutique-dashboard', middleware: 'shop', expect: { MEMBER: 302, SHOP_MANAGER: 200, INTERMEDIATE_ADMIN: 200, ADMIN: 302, SUPER_ADMIN: 302, ANON: 302 } },
  { path: '/dashboard', middleware: 'admin', expect: { MEMBER: 302, SHOP_MANAGER: 302, INTERMEDIATE_ADMIN: 200, ADMIN: 200, SUPER_ADMIN: 302, ANON: 302 } },
  { path: '/dashboard-super-admin', middleware: 'super-admin', expect: { MEMBER: 302, SHOP_MANAGER: 302, INTERMEDIATE_ADMIN: 302, ADMIN: 302, SUPER_ADMIN: 200, ANON: 302 } },
  { path: '/dashboard-gaming', middleware: 'admin', expect: { MEMBER: 302, SHOP_MANAGER: 302, INTERMEDIATE_ADMIN: 200, ADMIN: 200, SUPER_ADMIN: 302, ANON: 302 } },
  { path: '/espace-membre', middleware: 'auth', expect: { MEMBER: 200, SHOP_MANAGER: 200, INTERMEDIATE_ADMIN: 200, ADMIN: 200, SUPER_ADMIN: 200, ANON: 302 } }
]

// ─────────────────────────────────────────────────────────────────────────────
// 4. Parcours minimal par rôle : l’enchaînement réel de son métier, en lecture.
// ─────────────────────────────────────────────────────────────────────────────
// Renvoie { role, steps: [{ label, method, path, expect }] }.
const JOURNEYS = {
  MEMBER: [
    ['Communauté', 'GET', '/api/communaute/posts', 200],
    ['Événements', 'GET', '/api/events', 200],
    ['Galerie', 'GET', '/api/galerie', 200],
    ['Boutique publique', 'GET', '/api/boutique', 200],
    ['Notifications', 'GET', '/api/notifications', 200],
    ['Sa carte Otaku', 'GET', '/api/member/card', 200],
    ['Refus back-office boutique', 'GET', '/api/boutique/catalog', 403],
    ['Refus administration', 'GET', '/api/admin/cards', 403]
  ],
  SHOP_MANAGER: [
    ['Catalogue', 'GET', '/api/boutique/catalog', 200],
    ['Commandes', 'GET', '/api/boutique/orders', 200],
    ['Avis', 'GET', '/api/boutique/reviews', 200],
    ['Refus administration du club', 'GET', '/api/admin/cards', 403],
    ['Refus gestion des admins', 'GET', '/api/admin/admins', 403]
  ],
  INTERMEDIATE_ADMIN: [
    ['Boutique — catalogue (parité)', 'GET', '/api/boutique/catalog', 200],
    ['Boutique — commandes (parité)', 'GET', '/api/boutique/orders', 200],
    ['Cartes membres', 'GET', '/api/admin/cards', 200],
    ['Statistiques', 'GET', '/api/admin/stats', 200],
    ['Tournois', 'GET', '/api/tournaments', 200],
    ['Refus super-admin — modification', 'PATCH', `/api/admin/admins/${FAKE_ID}`, 403],
    ['Refus super-admin — suppression', 'DELETE', `/api/admin/admins/${FAKE_ID}`, 403]
  ],
  ADMIN: [
    ['Événements (vue admin)', 'GET', '/api/events', 200],
    ['Galerie', 'GET', '/api/admin/gallery', 200],
    ['Imports', 'GET', '/api/admin/imports', 200],
    ['Cartes membres', 'GET', '/api/admin/cards', 200],
    ['Tournois', 'GET', '/api/tournaments', 200],
    ['Refus boutique', 'GET', '/api/boutique/catalog', 403],
    ['Refus super-admin — suppression', 'DELETE', `/api/admin/admins/${FAKE_ID}`, 403]
  ],
  SUPER_ADMIN: [
    ['Comptes', 'GET', '/api/admin/accounts', 200],
    ['Administrateurs', 'GET', '/api/admin/admins', 200],
    ['Statistiques', 'GET', '/api/admin/stats', 200],
    ['Signalements', 'GET', '/api/issue-reports', 200],
    ['Refus boutique', 'GET', '/api/boutique/catalog', 403],
    ['Refus cartes membres', 'GET', '/api/admin/cards', 403],
    ['Refus tournois', 'GET', '/api/tournaments', 403],
    ['Refus galerie', 'GET', '/api/admin/gallery', 403],
    ['Refus imports', 'GET', '/api/admin/imports', 403],
    ['Refus création d’événement', 'POST', '/api/events', 403]
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Utilitaires HTTP
// ─────────────────────────────────────────────────────────────────────────────
async function http(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'manual' })
}

const CANDIDATES_URLS = [
  process.argv.find(arg => arg.startsWith('http')),
  process.env.QA_BASE_URL,
  process.env.TEST_BASE_URL,
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'http://127.0.0.1:3224',
  'http://localhost:3224'
].filter(Boolean).map(url => url.replace(/\/$/, ''))

/** Ne retient qu’un serveur qui répond comme l’application Otaku. */
async function resolveBaseUrl() {
  for (const base of [...new Set(CANDIDATES_URLS)]) {
    try {
      const response = await http(`${base}/api/health`)
      if (response.status !== 200) continue
      const payload = await response.json().catch(() => null)
      if (payload?.data?.database && payload?.data?.prisma) return base
    } catch {
      // serveur absent : on essaie le suivant
    }
  }
  return null
}

/** Connexion réelle ; réessaie proprement sur 429 (limiteur 10 tentatives / 5 min). */
async function login(baseUrl, email, password) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await http(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    if (response.status === 429 && attempt < 3) {
      console.log(`  … limiteur de connexion atteint (429) — attente 65 s (tentative ${attempt}/2)`)
      await new Promise(resolve => setTimeout(resolve, 65000))
      continue
    }
    const cookies = response.headers.getSetCookie?.() || []
    const session = cookies.map(entry => entry.split(';')[0]).filter(entry => entry.startsWith('otaku_session=')).join('; ')
    let role = null
    try { role = (await response.json())?.data?.user?.role || null } catch { /* corps absent */ }
    return { status: response.status, cookie: session, role }
  }
  return { status: 429, cookie: '', role: null }
}

async function probe(baseUrl, session, method, path, body) {
  const init = { method, headers: {} }
  if (session) init.headers.cookie = session
  if (body !== undefined) {
    init.headers['content-type'] = 'application/json'
    init.body = JSON.stringify(body)
  }
  try {
    const response = await http(`${baseUrl}${path}`, init)
    return { status: response.status, location: response.headers.get('location') }
  } catch (error) {
    return { status: 0, location: null, error: error.message }
  }
}

/** Verdict attendu pour un couple (route, rôle). */
function expectedFor(route, role) {
  if (route.public || route.pathless) return route.ok
  if (role === 'ANON') return 401
  if (!route.allow.includes(role)) return 403
  return route.ok
}

const fmt = (value) => (Array.isArray(value) ? value.join('/') : String(value))

// ─────────────────────────────────────────────────────────────────────────────
// 6. Exécution
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const reportIndex = process.argv.indexOf('--report')
  const reportPath = reportIndex !== -1 ? process.argv[reportIndex + 1] : null

  const baseUrl = await resolveBaseUrl()
  if (!baseUrl) {
    console.error('Aucun serveur Otaku joignable (/api/health).')
    console.error(`URL essayées : ${[...new Set(CANDIDATES_URLS)].join(', ')}`)
    console.error('Démarre-le (NUXT_IGNORE_LOCK=1 npx nuxt dev --port 3224) ou passe une URL en argument.')
    process.exit(2)
  }
  console.log(`Serveur ciblé : ${baseUrl}`)
  console.log(`Sources des mots de passe : ${process.env.SEED_TEST_PASSWORD ? 'SEED_TEST_PASSWORD' : `${DEMO_PASSWORDS_FILE} + ${QA_SESSIONS_FILE}`} (valeurs jamais imprimées)`)

  // ── Inventaire réel des comptes (lecture seule) ───────────────────────────
  if (!connectionString) {
    console.error('DATABASE_URL absent (.env) : impossible de lire les comptes.')
    process.exit(2)
  }
  const client = new pg.Client({
    connectionString,
    ssl: /sslmode=require/.test(connectionString) ? { rejectUnauthorized: false } : undefined
  })
  await client.connect()
  const { rows: users } = await client.query('SELECT email, role, "isActive" FROM public.users ORDER BY role, email')
  console.log('\n=== 1. INVENTAIRE RÉEL DES COMPTES (lecture seule) ===')
  for (const user of users) {
    console.log(`  ${String(user.role).padEnd(18)} ${String(user.email).padEnd(34)} actif=${user.isActive} mdp=${passwordFor(user.email) ? 'connu' : 'inconnu'}`)
  }
  console.log(`  total = ${users.length} compte(s) · ${users.filter(u => passwordFor(u.email)).length} avec mot de passe connu`)
  await client.end()

  // ── Ouverture des sessions réelles ────────────────────────────────────────
  console.log('\n=== 2. SESSIONS RÉELLES (POST /api/auth/login) ===')
  const sessions = { ANON: '' }
  const untestable = []
  const cache = loadSessionCache()
  const cacheNext = { ...cache }
  for (const role of ROLES.filter(entry => entry !== 'ANON')) {
    // 1) Session en cache encore valable ? On la vérifie AVANT de se reconnecter:
    //    cela évite de consommer le quota de /api/auth/login pour rien.
    let session = null
    const cached = cache[role]
    if (cached?.cookie) {
      const me = await probe(baseUrl, cached.cookie, 'GET', '/api/auth/me')
      let liveRole = null
      try {
        const response = await http(`${baseUrl}/api/auth/me`, { headers: { cookie: cached.cookie } })
        liveRole = (await response.json())?.data?.user?.role || null
      } catch { /* session invalide */ }
      if (me.status === 200 && liveRole === role) {
        session = { email: cached.email, cookie: cached.cookie, role: liveRole, reused: true }
        console.log(`  ${role.padEnd(18)} ${String(cached.email).padEnd(34)} session en cache réutilisée (rôle confirmé : ${liveRole})`)
      }
    }
    // 2) Sinon : connexion réelle sur les comptes candidats.
    for (const email of session ? [] : (CANDIDATES[role] || [])) {
      if (!passwordFor(email)) {
        console.log(`  ${role.padEnd(18)} ${email.padEnd(34)} mot de passe inconnu → ignoré`)
        continue
      }
      const attempt = await login(baseUrl, email, passwordFor(email))
      if (attempt.cookie) {
        session = { email, cookie: attempt.cookie, role: attempt.role }
        console.log(`  ${role.padEnd(18)} ${email.padEnd(34)} HTTP ${attempt.status} → session ouverte (rôle renvoyé : ${attempt.role})`)
        break
      }
      console.log(`  ${role.padEnd(18)} ${email.padEnd(34)} HTTP ${attempt.status} → pas de session`)
      await new Promise(resolve => setTimeout(resolve, 400))
    }
    if (!session) {
      untestable.push(role)
      delete cacheNext[role]
    } else {
      cacheNext[role] = { email: session.email, cookie: session.cookie, savedAt: new Date().toISOString() }
    }
    sessions[role] = session?.cookie || ''
  }
  try {
    writeFileSync(SESSION_CACHE_FILE, JSON.stringify(cacheNext, null, 2))
  } catch { /* cache non écrit : sans conséquence sur le verdict */ }

  // ── Matrice rôle × route ──────────────────────────────────────────────────
  console.log('\n=== 3. MATRICE RÔLE × ROUTE (attendu / obtenu) ===')
  const rows = []
  for (const route of ROUTES) {
    for (const role of ROLES) {
      if (untestable.includes(role)) {
        rows.push({ kind: 'api', id: route.id, role, method: route.method, path: route.path, expected: fmt(expectedFor(route, role)), observed: 'non testé', verdict: 'IGNORÉ' })
        continue
      }
      const observed = await probe(baseUrl, sessions[role], route.method, route.path, route.body)
      const expected = expectedFor(route, role)
      const codes = Array.isArray(expected) ? expected : [expected]
      const verdict = codes.includes(observed.status) ? 'OK' : 'DIVERGENCE'
      rows.push({
        kind: 'api', id: route.id, role, method: route.method, path: route.path,
        guard: route.guard, label: route.label,
        expected: fmt(expected), observed: observed.status, verdict,
        extra: observed.error || (observed.location ? `→ ${observed.location}` : '')
      })
    }
  }

  for (const row of rows) {
    console.log(`  ${row.verdict === 'OK' ? 'OK         ' : row.verdict === 'DIVERGENCE' ? 'DIVERGENCE ' : 'IGNORÉ     '} [${row.id}] ${row.role.padEnd(18)} ${row.method.padEnd(7)} ${row.path.padEnd(46)} attendu=${row.expected.padEnd(9)} obtenu=${String(row.observed).padEnd(4)} ${row.extra || ''}`)
  }

  // ── Pages (middleware SSR) ────────────────────────────────────────────────
  const pageRows = []
  if (withPages) {
    console.log('\n=== 4. PAGES PROTÉGÉES (middleware SSR → 302 attendu) ===')
    for (const page of PAGES) {
      for (const role of ROLES) {
        if (untestable.includes(role)) {
          pageRows.push({ kind: 'page', role, path: page.path, expected: page.expect[role], observed: 'non testé', verdict: 'IGNORÉ' })
          continue
        }
        const observed = await probe(baseUrl, sessions[role], 'GET', page.path)
        const expected = page.expect[role]
        const verdict = observed.status === expected ? 'OK' : 'DIVERGENCE'
        pageRows.push({ kind: 'page', role, path: page.path, middleware: page.middleware, expected, observed: observed.status, verdict, extra: observed.location ? `→ ${observed.location}` : '' })
      }
    }
    for (const row of pageRows) {
      console.log(`  ${row.verdict === 'OK' ? 'OK         ' : row.verdict === 'DIVERGENCE' ? 'DIVERGENCE ' : 'IGNORÉ     '} [page] ${row.role.padEnd(18)} GET     ${row.path.padEnd(46)} attendu=${String(row.expected).padEnd(9)} obtenu=${String(row.observed).padEnd(4)} ${row.extra || ''}`)
    }
  }

  // ── Parcours minimal par rôle ─────────────────────────────────────────────
  console.log('\n=== 5. PARCOURS MINIMAL PAR RÔLE (HTTP réel, lecture seule) ===')
  const journeyRows = []
  for (const [role, steps] of Object.entries(JOURNEYS)) {
    if (untestable.includes(role)) {
      console.log(`  ${role.padEnd(18)} parcours NON TESTÉ (aucune session)`)
      continue
    }
    let ok = 0
    for (const [label, method, path, expected] of steps) {
      const observed = await probe(baseUrl, sessions[role], method, path)
      const verdict = observed.status === expected ? 'OK' : 'DIVERGENCE'
      if (verdict === 'OK') ok++
      journeyRows.push({ kind: 'parcours', role, label, method, path, expected, observed: observed.status, verdict })
      console.log(`  ${verdict === 'OK' ? 'OK        ' : 'DIVERGENCE'} ${role.padEnd(18)} ${label.padEnd(38)} ${method.padEnd(7)} ${path.padEnd(46)} attendu=${String(expected).padEnd(4)} obtenu=${observed.status}`)
    }
    console.log(`  → ${role} : ${ok}/${steps.length} étape(s) conforme(s)`)
  }

  // ── Synthèse ──────────────────────────────────────────────────────────────
  const all = [...rows, ...pageRows, ...journeyRows]
  const compared = all.filter(row => row.verdict !== 'IGNORÉ')
  const divergences = compared.filter(row => row.verdict === 'DIVERGENCE')
  console.log('\n=== 6. SYNTHÈSE ===')
  console.log(`  requêtes comparées : ${compared.length}`)
  console.log(`  divergences        : ${divergences.length}`)
  if (divergences.length) {
    for (const row of divergences) {
      console.log(`   • ${row.role} ${row.method} ${row.path} → attendu ${fmt(row.expected)}, obtenu ${row.observed}${row.extra ? ` ${row.extra}` : ''}`)
    }
  }
  if (untestable.length) {
    console.log(`  rôles NON TESTABLES (aucun compte avec mot de passe connu) : ${untestable.join(', ')}`)
  }

  if (reportPath) {
    const full = resolve(ROOT, reportPath)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, JSON.stringify({
      baseUrl, generatedAt: new Date().toISOString(), untestable,
      rows: all, divergences: divergences.length
    }, null, 2))
    console.log(`  rapport JSON : ${full}`)
  }

  if (untestable.length) {
    console.log('\n  → matrice INCOMPLÈTE : un rôle sans session ne peut pas être déclaré conforme.')
    process.exit(2)
  }
  process.exit(divergences.length === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(2)
})
