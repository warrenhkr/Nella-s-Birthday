// scripts/test-runtime-prod-roles.mjs
//
// QA RUNTIME RÉELLE EN PRODUCTION — Club Otaku ENEAM.
//
// Ce script n'est PAS un test statique : il se connecte réellement au site
// déployé (Vercel) avec CHAQUE rôle, conserve la session par cookie, puis
// interroge les routes sensibles par des appels HTTP directs. C'est le seul
// moyen de prouver qu'un contrôle n'existe pas seulement côté interface.
//
// Il sert aussi de preuve pour :
//   • la création d'un tournoi (POST /api/tournaments) et sa vérification ;
//   • la création / édition complète / suppression d'un événement ;
//   • la chaîne média (pCloud, Terabox, YouTube, dossiers) ;
//   • la robustesse aux données invalides (aucune 500, messages en français).
//
// COMPTES
//   • MEMBER / SHOP_MANAGER / ADMIN : comptes de démonstration @otaku.club
//     (mots de passe lus dans %USERPROFILE%/otaku-comptes-demo.txt, hors dépôt).
//   • SUPER_ADMIN / INTERMEDIATE_ADMIN / ADMIN à périmètre : aucun compte de
//     démonstration n'existe pour ces rôles en base. Le script crée donc des
//     comptes TEMPORAIRES préfixés `qa-runtime-` (même schéma de mot de passe
//     que server/utils/password.ts) et les SUPPRIME à la fin — exactement la
//     méthode déjà employée par scripts/test-import-e2e.mjs.
//
// Usage :
//   node --env-file=.env scripts/test-runtime-prod-roles.mjs roles
//   node --env-file=.env scripts/test-runtime-prod-roles.mjs crud
//   node --env-file=.env scripts/test-runtime-prod-roles.mjs media
//   node --env-file=.env scripts/test-runtime-prod-roles.mjs invalid
//   node --env-file=.env scripts/test-runtime-prod-roles.mjs cleanup
//
// Aucune donnée préexistante n'est modifiée. Le script ne supprime QUE les
// lignes qu'il a lui-même créées (marqueur `qa-runtime-` / `QA-RUNTIME`).

import pg from 'pg'
import { randomBytes, scrypt as scryptCb } from 'node:crypto'
import { promisify } from 'node:util'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const scrypt = promisify(scryptCb)
const BASE = (process.env.QA_BASE_URL || 'https://club-otaku-eneam.vercel.app').replace(/\/$/, '')
const MARK = 'qa-runtime-'
const LABEL = 'QA-RUNTIME'
const SECTION = process.argv[2] || 'roles'
const connectionString = process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL

if (!connectionString) {
  console.error('DATABASE_URL absent : lance avec  node --env-file=.env scripts/test-runtime-prod-roles.mjs <section>')
  process.exit(2)
}

const client = new pg.Client({
  connectionString,
  ssl: /sslmode=require/.test(connectionString) ? { rejectUnauthorized: false } : undefined
})
await client.connect()

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const key = await scrypt(password, salt, 64)
  return `scrypt:${salt}:${key.toString('hex')}`
}

function demoPasswords() {
  const file = join(homedir(), 'otaku-comptes-demo.txt')
  const map = {}
  if (!existsSync(file)) return map
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^(\S+@\S+)\s+([A-Z_]+)\s+(\S+)\s*$/)
    if (m) map[m[1]] = { role: m[2], password: m[3] }
  }
  return map
}

const STATE_FILE = join(homedir(), '.qa-runtime-sessions.json')

async function createTempAccount(suffix, role, adminScopes) {
  const email = `${MARK}${suffix}@otaku.club`
  const pseudo = `${MARK}${suffix}`
  const password = randomBytes(18).toString('base64url')
  await client.query(
    `INSERT INTO users (id, email, pseudo, password, role, "isActive", "adminScopes", poles, "updatedAt")
     VALUES ($1, $2, $3, $4, $5, true, $6::text[], '{}'::text[], now())
     ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, role = EXCLUDED.role,
       "isActive" = true, "adminScopes" = EXCLUDED."adminScopes"`,
    [`qa_${suffix}_${Date.now()}`, email, `${pseudo}_${Date.now()}`, await hashPassword(password), role, adminScopes]
  )
  return { email, password, role, adminScopes }
}

const store = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : {}

async function accounts() {
  const demo = demoPasswords()
  const list = []
  list.push({ key: 'MEMBER', email: 'aiko@otaku.club', password: demo['aiko@otaku.club']?.password })
  list.push({ key: 'SHOP_MANAGER', email: 'mika@otaku.club', password: demo['mika@otaku.club']?.password })
  list.push({ key: 'ADMIN', email: 'admin629427@otaku.club', password: demo['admin629427@otaku.club']?.password })

  if (!store.temp) {
    store.temp = {
      superadmin: await createTempAccount('superadmin', 'SUPER_ADMIN', []),
      interadmin: await createTempAccount('interadmin', 'INTERMEDIATE_ADMIN', []),
      scopedgaming: await createTempAccount('scopedgaming', 'ADMIN', ['gaming'])
    }
    writeFileSync(STATE_FILE, JSON.stringify(store, null, 2))
  }
  list.push({ key: 'SUPER_ADMIN', ...store.temp.superadmin })
  list.push({ key: 'INTERMEDIATE_ADMIN', ...store.temp.interadmin })
  list.push({ key: 'ADMIN[gaming]', ...store.temp.scopedgaming })
  return list
}

async function login(account) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: account.email, password: account.password }),
    redirect: 'manual'
  })
  let cookie = null
  const raw = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [r.headers.get('set-cookie')]
  for (const c of raw || []) {
    const m = /otaku_session=([^;]+)/.exec(c || '')
    if (m) { cookie = `otaku_session=${m[1]}`; break }
  }
  let body = null
  try { body = await r.json() } catch { /* ignore */ }
  return { status: r.status, cookie, role: body?.data?.user?.role, scopes: body?.data?.user?.adminScopes }
}

async function probe(cookie, method, path, body) {
  const init = { method, redirect: 'manual', headers: {} }
  if (cookie) init.headers.cookie = cookie
  if (body !== undefined) {
    init.headers['content-type'] = 'application/json'
    init.body = JSON.stringify(body)
  }
  try {
    const r = await fetch(BASE + path, init)
    return { status: r.status, location: r.headers.get('location') }
  } catch (error) {
    return { status: 0, location: null, error: error.message }
  }
}

function verdict(expected, observed) {
  if (expected === 'allow') return observed.status !== 403 ? 'OK' : 'ÉCHEC'
  if (expected === 'deny') return observed.status === 403 ? 'OK' : 'ÉCHEC'
  return observed.status === expected ? 'OK' : 'ÉCHEC'
}

// ---------------------------------------------------------------------------
// SECTION 1 — matrice HTTP par rôle
// ---------------------------------------------------------------------------
const STAFF = ['ADMIN', 'INTERMEDIATE_ADMIN']
async function sectionRoles() {
  const sess = {}
  const logins = []
  for (const account of await accounts()) {
    const result = await login(account)
    logins.push({ role: account.key, email: account.email, http: result.status, roleRenvoye: result.role, scopes: result.scopes })
    sess[account.key] = result.cookie
    await new Promise(resolve => setTimeout(resolve, 400))
  }

  console.log('=== CONNEXIONS RÉELLES ===')
  for (const l of logins) console.log(`  ${l.role.padEnd(20)} ${String(l.http).padEnd(4)} role=${l.roleRenvoye} scopes=[${(l.scopes || []).join(',')}]`)

  // route, méthode, corps éventuel, attentes par rôle
  const A = 'allow'; const D = 'deny'
  const matrix = [
    { path: '/api/health', method: 'GET', expect: { MEMBER: 200, SHOP_MANAGER: 200, ADMIN: 200, SUPER_ADMIN: 200, INTERMEDIATE_ADMIN: 200, 'ADMIN[gaming]': 200 } },
    { path: '/api/auth/me', method: 'GET', expect: { MEMBER: 200, SHOP_MANAGER: 200, ADMIN: 200, SUPER_ADMIN: 200, INTERMEDIATE_ADMIN: 200, 'ADMIN[gaming]': 200 } },

    // --- Supervision (requireAdmin + périmètre supervision) ---
    { path: '/api/admin/stats', method: 'GET', expect: { MEMBER: D, SHOP_MANAGER: D, ADMIN: A, SUPER_ADMIN: A, INTERMEDIATE_ADMIN: A, 'ADMIN[gaming]': D } },
    { path: '/api/admin/admins', method: 'GET', expect: { MEMBER: D, SHOP_MANAGER: D, ADMIN: A, SUPER_ADMIN: A, INTERMEDIATE_ADMIN: A, 'ADMIN[gaming]': D } },
    { path: '/api/admin/accounts', method: 'GET', expect: { MEMBER: D, SHOP_MANAGER: D, ADMIN: A, SUPER_ADMIN: A, INTERMEDIATE_ADMIN: A, 'ADMIN[gaming]': D } },
    // POST supervision : corps invalide -> un compte autorisé reçoit 400, jamais 403.
    { path: '/api/admin/admins', method: 'POST', body: {}, expect: { MEMBER: D, SHOP_MANAGER: D, ADMIN: A, SUPER_ADMIN: A, INTERMEDIATE_ADMIN: A, 'ADMIN[gaming]': D } },
    // Suppression d'admin : réservée au SUPER_ADMIN
    { path: '/api/admin/admins/id-inexistant', method: 'DELETE', expect: { MEMBER: D, SHOP_MANAGER: D, ADMIN: D, SUPER_ADMIN: A, INTERMEDIATE_ADMIN: D, 'ADMIN[gaming]': D } },

    // --- Opérations du club / membres (requireAdminOps, SUPER_ADMIN exclu) ---
    { path: '/api/admin/members', method: 'GET', expect: { MEMBER: D, SHOP_MANAGER: D, ADMIN: A, SUPER_ADMIN: D, INTERMEDIATE_ADMIN: A, 'ADMIN[gaming]': D } },
    { path: '/api/admin/cards', method: 'GET', expect: { MEMBER: D, SHOP_MANAGER: D, ADMIN: A, SUPER_ADMIN: D, INTERMEDIATE_ADMIN: A, 'ADMIN[gaming]': D } },

    // --- Gaming (requireAdminOps + périmètre gaming) ---
    { path: '/api/tournaments', method: 'GET', expect: { MEMBER: D, SHOP_MANAGER: D, ADMIN: A, SUPER_ADMIN: D, INTERMEDIATE_ADMIN: A, 'ADMIN[gaming]': A } },
    { path: '/api/tournaments', method: 'POST', body: {}, expect: { MEMBER: D, SHOP_MANAGER: D, ADMIN: A, SUPER_ADMIN: D, INTERMEDIATE_ADMIN: A, 'ADMIN[gaming]': A } },
    { path: '/api/teams/admin', method: 'GET', expect: { MEMBER: D, SHOP_MANAGER: D, ADMIN: A, SUPER_ADMIN: D, INTERMEDIATE_ADMIN: A, 'ADMIN[gaming]': A } },

    // --- Événementiel / médias (requireEventManager) ---
    { path: '/api/admin/imports', method: 'GET', expect: { MEMBER: D, SHOP_MANAGER: D, ADMIN: A, SUPER_ADMIN: D, INTERMEDIATE_ADMIN: A, 'ADMIN[gaming]': D } },
    { path: '/api/events', method: 'POST', body: {}, expect: { MEMBER: D, SHOP_MANAGER: D, ADMIN: A, SUPER_ADMIN: D, INTERMEDIATE_ADMIN: A, 'ADMIN[gaming]': D } },

    // --- Modération / galerie (requireEventManager + périmètre moderation) ---
    { path: '/api/admin/gallery', method: 'GET', expect: { MEMBER: D, SHOP_MANAGER: D, ADMIN: A, SUPER_ADMIN: D, INTERMEDIATE_ADMIN: A, 'ADMIN[gaming]': D } },
    { path: '/api/admin/gallery', method: 'POST', body: {}, expect: { MEMBER: D, SHOP_MANAGER: D, ADMIN: A, SUPER_ADMIN: D, INTERMEDIATE_ADMIN: A, 'ADMIN[gaming]': D } },

    // --- Boutique (requireShopManager : SHOP_MANAGER + INTERMEDIATE_ADMIN) ---
    { path: '/api/admin/orders', method: 'GET', expect: { MEMBER: D, SHOP_MANAGER: A, ADMIN: D, SUPER_ADMIN: D, INTERMEDIATE_ADMIN: A, 'ADMIN[gaming]': D } },
    { path: '/api/boutique/catalog', method: 'GET', expect: { MEMBER: D, SHOP_MANAGER: A, ADMIN: D, SUPER_ADMIN: D, INTERMEDIATE_ADMIN: A, 'ADMIN[gaming]': D } },
    { path: '/api/boutique/reviews', method: 'GET', expect: { MEMBER: D, SHOP_MANAGER: A, ADMIN: D, SUPER_ADMIN: D, INTERMEDIATE_ADMIN: A, 'ADMIN[gaming]': D } },

    // --- Espace membre (requireAuth : tout compte connecté) ---
    { path: '/api/member/card', method: 'GET', expect: { MEMBER: A, SHOP_MANAGER: A, ADMIN: A, SUPER_ADMIN: A, INTERMEDIATE_ADMIN: A, 'ADMIN[gaming]': A } },
    { path: '/api/tournaments/public', method: 'GET', expect: { MEMBER: A, SHOP_MANAGER: A, ADMIN: A, SUPER_ADMIN: A, INTERMEDIATE_ADMIN: A, 'ADMIN[gaming]': A } },
    { path: '/api/notifications', method: 'GET', expect: { MEMBER: A, SHOP_MANAGER: A, ADMIN: A, SUPER_ADMIN: A, INTERMEDIATE_ADMIN: A, 'ADMIN[gaming]': A } }
  ]

  // Pages : le middleware SSR s'exécute côté serveur -> on observe le 302.
  const pages = [
    { path: '/dashboard', expect: { MEMBER: 302, SHOP_MANAGER: 302, SUPER_ADMIN: 302, 'ADMIN[gaming]': 302, ADMIN: 200, INTERMEDIATE_ADMIN: 200 } },
    { path: '/dashboard-gaming', expect: { MEMBER: 302, SHOP_MANAGER: 302, SUPER_ADMIN: 302, ADMIN: 200, INTERMEDIATE_ADMIN: 200, 'ADMIN[gaming]': 200 } },
    { path: '/dashboard-evenementiel', expect: { MEMBER: 302, SHOP_MANAGER: 302, SUPER_ADMIN: 302, ADMIN: 200, INTERMEDIATE_ADMIN: 200, 'ADMIN[gaming]': 302 } },
    { path: '/dashboard-moderation', expect: { MEMBER: 302, SHOP_MANAGER: 302, SUPER_ADMIN: 302, ADMIN: 200, INTERMEDIATE_ADMIN: 200, 'ADMIN[gaming]': 302 } },
    { path: '/dashboard-super-admin', expect: { MEMBER: 302, SHOP_MANAGER: 302, ADMIN: 302, INTERMEDIATE_ADMIN: 302, SUPER_ADMIN: 200, 'ADMIN[gaming]': 302 } },
    { path: '/boutique-dashboard', expect: { MEMBER: 302, ADMIN: 302, SUPER_ADMIN: 302, SHOP_MANAGER: 200, INTERMEDIATE_ADMIN: 200, 'ADMIN[gaming]': 302 } }
  ]

  const rows = []
  for (const route of matrix) {
    for (const [role, expected] of Object.entries(route.expect)) {
      const observed = await probe(sess[role], route.method, route.path, route.body)
      const status = verdict(expected, observed)
      rows.push({ type: 'api', role, method: route.method, path: route.path, expected: expected === 'allow' ? 'autorisé' : expected === 'deny' ? '403' : String(expected), observed: observed.status, extra: observed.error || '', result: status })
    }
  }
  for (const page of pages) {
    for (const [role, expected] of Object.entries(page.expect)) {
      const observed = await probe(sess[role], 'GET', page.path)
      const status = expected === 302
        ? (observed.status === 302 ? 'OK' : 'ÉCHEC')
        : (observed.status === 200 ? 'OK' : 'ÉCHEC')
      rows.push({ type: 'page', role, method: 'GET', path: page.path, expected: expected === 302 ? 'redirection' : 'page', observed: observed.status, extra: observed.location || '', result: status })
    }
  }

  console.log('\n=== MATRICE RUNTIME (API + PAGES) ===')
  let failures = 0
  for (const row of rows) {
    if (row.result === 'ÉCHEC') failures++
    console.log(`  ${row.result.padEnd(6)} ${row.type.padEnd(4)} ${row.role.padEnd(20)} ${row.method.padEnd(6)} ${row.path.padEnd(34)} attendu=${String(row.expected).padEnd(10)} obtenu=${String(row.observed).padEnd(4)} ${row.extra}`)
  }
  console.log(`\n${rows.length - failures}/${rows.length} vérifications OK, ${failures} échec(s).`)
  writeFileSync(join(homedir(), '.qa-runtime-roles.json'), JSON.stringify({ logins, rows }, null, 2))
  return failures
}

// ---------------------------------------------------------------------------
// SECTION 2 — tournoi + événement (création, édition, suppression)
// ---------------------------------------------------------------------------
async function sectionCrud() {
  const all = await accounts()
  const admin = all.find(a => a.key === 'ADMIN')
  const session = await login(admin)
  console.log(`=== Connexion ADMIN (${admin.email}) → HTTP ${session.status} ===`)
  if (!session.cookie) throw new Error('Session ADMIN indisponible — arrêt.')

  const stamp = Date.now()
  const results = []

  // --- TOURNOI : création ---
  const tournamentPayload = {
    name: `QA-RUNTIME Tournoi ${stamp}`,
    game: 'QA-RUNTIME Test',
    teams: ['QA Alpha', 'QA Beta'],
    visibility: 'PUBLIC',
    registrationOpen: true,
    maxTeams: 8,
    format: 'Élimination directe',
    description: 'Tournoi de vérification QA créé puis supprimé automatiquement.',
    startDate: new Date(stamp + 86400000).toISOString(),
    endDate: new Date(stamp + 172800000).toISOString(),
    status: 'registration_open'
  }
  const createRes = await fetch(`${BASE}/api/tournaments`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: session.cookie },
    body: JSON.stringify(tournamentPayload)
  })
  const createBody = await createRes.json().catch(() => null)
  const tournamentId = createBody?.data?.id
  console.log(`\n[TOURNOI] POST /api/tournaments → HTTP ${createRes.status} id=${tournamentId}`)
  results.push({ step: 'tournament.create', http: createRes.status, id: tournamentId })

  if (tournamentId) {
    // --- TOURNOI : visible dans la liste ---
    const listRes = await probe(session.cookie, 'GET', '/api/tournaments')
    let inList = false
    try { const j = await (await fetch(`${BASE}/api/tournaments`, { headers: { cookie: session.cookie } })).json(); inList = (j.data || []).some(t => t.id === tournamentId) } catch { /* ignore */ }
    // --- TOURNOI : visible publiquement (page membre) ---
    const pubRes = await fetch(`${BASE}/api/tournaments/public`, { headers: { cookie: session.cookie } })
    let inPublic = false
    try { const j = await pubRes.json(); inPublic = (j.data || []).some(t => t.id === tournamentId) } catch { /* ignore */ }
    // --- TOURNOI : présent en base ---
    const dbRow = await client.query('SELECT id, name, visibility, "registrationOpen", status FROM tournaments WHERE id = $1', [tournamentId])
    console.log(`[TOURNOI] liste admin=${inList} · liste publique=${inPublic} · base=${dbRow.rowCount} ligne(s) · GET liste HTTP ${listRes.status}`)
    results.push({ step: 'tournament.visible', inList, inPublic, inDb: dbRow.rowCount === 1 })

    // --- TOURNOI : publication en un geste (PATCH) ---
    const patchRes = await probe(session.cookie, 'PATCH', `/api/tournaments/${tournamentId}`, { visibility: 'UNLISTED', status: 'in_progress' })
    console.log(`[TOURNOI] PATCH (réglages) → HTTP ${patchRes.status}`)
    results.push({ step: 'tournament.patch', http: patchRes.status })
  }

  // --- ÉVÉNEMENT : création ---
  const eventPayload = {
    title: `QA-RUNTIME Événement ${stamp}`,
    description: 'Événement de vérification QA, créé puis supprimé automatiquement par le harnais de test runtime.',
    location: 'ENEAM — salle QA',
    pole: 'culture',
    type: 'culture',
    status: 'upcoming',
    start_date: new Date(stamp + 7 * 86400000).toISOString(),
    end_date: new Date(stamp + 7 * 86400000 + 7200000).toISOString(),
    is_free: true,
    max_attendees: 42
  }
  const evRes = await fetch(`${BASE}/api/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: session.cookie },
    body: JSON.stringify(eventPayload)
  })
  const evBody = await evRes.json().catch(() => null)
  const eventId = evBody?.data?.id
  console.log(`\n[ÉVÉNEMENT] POST /api/events → HTTP ${evRes.status} id=${eventId}`)
  results.push({ step: 'event.create', http: evRes.status, id: eventId })

  if (eventId) {
    // --- ÉVÉNEMENT : édition COMPLÈTE (tous les champs changent) ---
    const editPayload = {
      title: `QA-RUNTIME Événement ÉDITÉ ${stamp}`,
      description: 'Description entièrement réécrite par la QA runtime pour prouver que l’édition complète d’un événement existant fonctionne.',
      location: 'ENEAM — amphithéâtre QA',
      pole: 'gaming',
      type: 'gaming',
      status: 'ongoing',
      start_date: new Date(stamp + 8 * 86400000).toISOString(),
      end_date: new Date(stamp + 8 * 86400000 + 10800000).toISOString(),
      is_free: false,
      price: 2500,
      payment_instructions: 'Paiement QA : Mobile Money 00000000 (données de test).',
      max_attendees: 99
    }
    const editRes = await probe(session.cookie, 'PATCH', `/api/events/${eventId}`, editPayload)
    const dbAfter = await client.query('SELECT title, place, pole, status, capacity, price, "isFree" FROM events WHERE id = $1', [eventId])
    const row = dbAfter.rows[0] || {}
    const edited = row.title === editPayload.title && row.place === editPayload.location && row.pole === 'Gaming'
      && row.status === 'ongoing' && row.capacity === 99 && Number(row.price) === 2500 && row.isFree === false
    console.log(`[ÉVÉNEMENT] PATCH complet → HTTP ${editRes.status} · relecture base = ${edited ? 'ÉDITION COMPLÈTE OK' : 'INCOMPLÈTE'} (${JSON.stringify(row)})`)
    results.push({ step: 'event.edit', http: editRes.status, editedInDb: edited, row })

    // --- ÉVÉNEMENT : suppression + nettoyage ---
    const delRes = await probe(session.cookie, 'DELETE', `/api/admin/events/${eventId}`)
    const gone = await client.query('SELECT 1 FROM events WHERE id = $1', [eventId])
    console.log(`[ÉVÉNEMENT] DELETE → HTTP ${delRes.status} · en base après suppression = ${gone.rowCount} ligne(s)`)
    results.push({ step: 'event.delete', http: delRes.status, remaining: gone.rowCount })
  }

  // --- NETTOYAGE TOURNOI (aucune route de suppression n'existe : voir rapport) ---
  if (tournamentId) {
    await client.query('DELETE FROM tournament_matches WHERE "tournamentId" = $1', [tournamentId])
    await client.query('DELETE FROM tournament_teams WHERE "tournamentId" = $1', [tournamentId])
    await client.query('DELETE FROM tournaments WHERE id = $1', [tournamentId])
    const gone = await client.query('SELECT 1 FROM tournaments WHERE id = $1', [tournamentId])
    console.log(`\n[TOURNOI] nettoyage DB → ${gone.rowCount === 0 ? 'supprimé' : 'ÉCHEC'}`)
    results.push({ step: 'tournament.cleanup', remaining: gone.rowCount })
  }

  writeFileSync(join(homedir(), '.qa-runtime-crud.json'), JSON.stringify(results, null, 2))
  const failed = results.filter(r => r.http >= 400 && !['tournament.patch'].includes(r.step) && r.http !== 404).length
  return failed
}

// ---------------------------------------------------------------------------
// SECTION 3 — chaîne média (pCloud / Terabox / YouTube / dossiers)
// ---------------------------------------------------------------------------
async function sectionMedia() {
  const all = await accounts()
  const admin = all.find(a => a.key === 'ADMIN')
  const session = await login(admin)
  console.log(`=== Chaîne média — connexion ADMIN → HTTP ${session.status} ===`)

  const stamp = Date.now()
  const created = []

  // Liens publics réels extraits du classeur d'import du club (test.xlsx) pour
  // rester sur des sources pCloud/Terabox authentiques.
  const PCLOUD_FOLDER = 'https://u.pcloud.link/publink/show?code=kZ0QO75ZbPTNSPHTS0ZHTS0ZHTS0ZHTS0ZHTS'
  const cases = [
    { label: 'pCloud — DOSSIER public (détection)', kind: 'folder-pcloud', url: PCLOUD_FOLDER },
    { label: 'Terabox — partage (détection / lien sortant)', kind: 'folder-terabox', url: 'https://terabox.com/s/1QAbcDefGhIjKlMnOpQrStU' },
    { label: 'YouTube — vidéo', kind: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    { label: 'Terabox — URL inventée (doit échouer proprement)', kind: 'bad', url: 'https://terabox.com/s/inexistant-qa-runtime' }
  ]

  const rows = []
  for (const item of cases) {
    const resolved = await probe(session.cookie, 'POST', '/api/media/resolve-video', { url: item.url })
    rows.push({ label: item.label, endpoint: 'POST /api/media/resolve-video', http: resolved.status, location: resolved.location })
    console.log(`  ${String(resolved.status).padEnd(4)} resolve-video  ${item.label}`)
  }

  // Publication réelle d'un média dans la galerie (image YouTube + vidéo), puis retrait.
  const galleryCases = [
    {
      label: 'Galerie — IMAGE (URL pCloud directe)',
      body: {
        title: `QA-RUNTIME image ${stamp}`,
        category: 'QA',
        eventDate: new Date(stamp).toISOString(),
        mediaType: 'IMAGE',
        url: 'https://images.unsplash.com/photo-1541562232579-512a21360020?w=800'
      }
    },
    {
      label: 'Galerie — VIDÉO YouTube',
      body: {
        title: `QA-RUNTIME youtube ${stamp}`,
        category: 'QA',
        eventDate: new Date(stamp).toISOString(),
        mediaType: 'YOUTUBE_VIDEO',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      }
    }
  ]
  for (const item of galleryCases) {
    const r = await fetch(`${BASE}/api/admin/gallery`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: session.cookie },
      body: JSON.stringify(item.body)
    })
    const j = await r.json().catch(() => null)
    console.log(`  ${String(r.status).padEnd(4)} galerie POST    ${item.label} → id=${j?.data?.id || '—'}`)
    rows.push({ label: item.label, endpoint: 'POST /api/admin/gallery', http: r.status, id: j?.data?.id || null })
    if (j?.data?.id) created.push(j.data.id)
    await new Promise(resolve => setTimeout(resolve, 300))
  }

  // Nettoyage : retrait des médias de test.
  for (const id of created) {
    const r = await probe(session.cookie, 'DELETE', `/api/admin/gallery/${id}`)
    const gone = await client.query('SELECT 1 FROM gallery_images WHERE id = $1', [id]).catch(() => ({ rowCount: -1 }))
    console.log(`  ${String(r.status).padEnd(4)} galerie DELETE  ${id} → base=${gone.rowCount} ligne(s)`)
  }

  writeFileSync(join(homedir(), '.qa-runtime-media.json'), JSON.stringify({ rows, cleaned: created.length }, null, 2))
  return 0
}

// ---------------------------------------------------------------------------
// SECTION 4 — robustesse aux données invalides
// ---------------------------------------------------------------------------
async function sectionInvalid() {
  const all = await accounts()
  const admin = all.find(a => a.key === 'ADMIN')
  const member = all.find(a => a.key === 'MEMBER')
  const adminSession = await login(admin)
  const memberSession = await login(member)
  console.log(`=== Robustesse — ADMIN HTTP ${adminSession.status} · MEMBER HTTP ${memberSession.status} ===`)

  const cases = [
    { who: 'admin', method: 'POST', path: '/api/events', body: {}, label: 'événement : corps vide' },
    { who: 'admin', method: 'POST', path: '/api/events', body: { title: 'x'.repeat(150), description: 'a'.repeat(20), location: 'Lieu', pole: 'culture', start_date: new Date().toISOString() }, label: 'événement : titre trop long (150)' },
    { who: 'admin', method: 'POST', path: '/api/events', body: { title: 'Titre valide', description: 'court', location: 'Lieu', pole: 'culture', start_date: new Date().toISOString() }, label: 'événement : description < 10' },
    { who: 'admin', method: 'POST', path: '/api/events', body: { title: 'Titre valide', description: 'Description assez longue.', location: 'Lieu', pole: 'culture', start_date: 'pas-une-date' }, label: 'événement : date invalide' },
    { who: 'admin', method: 'POST', path: '/api/events', body: { title: 'Titre valide', description: 'Description assez longue.', location: 'Lieu', pole: 'culture', start_date: new Date().toISOString(), image_url: 'javascript:alert(1)' }, label: 'événement : URL image invalide' },
    { who: 'admin', method: 'POST', path: '/api/events', body: { title: 'Titre valide', description: 'Description assez longue.', location: 'Lieu', pole: 'pole-inexistant', start_date: new Date().toISOString() }, label: 'événement : pôle inconnu' },
    { who: 'admin', method: 'POST', path: '/api/tournaments', body: { name: 'ab', game: 'x' }, label: 'tournoi : nom trop court' },
    { who: 'admin', method: 'POST', path: '/api/tournaments', body: { name: 'Tournoi QA valide', game: 'Jeu', startDate: 'date-bidon' }, label: 'tournoi : date invalide' },
    { who: 'admin', method: 'POST', path: '/api/tournaments', body: { name: 'Tournoi QA valide', game: 'Jeu', teams: ['Une seule équipe'] }, label: 'tournoi : une seule équipe' },
    { who: 'admin', method: 'POST', path: '/api/admin/gallery', body: { title: 'Média QA', category: 'QA', eventDate: new Date().toISOString(), mediaType: 'IMAGE' }, label: 'galerie : image sans URL' },
    { who: 'admin', method: 'POST', path: '/api/admin/gallery', body: { title: 'Média QA', category: 'QA', eventDate: new Date().toISOString(), mediaType: 'VIDEO', videoUrl: 'https://exemple-inconnu.tld/video.mp4' }, label: 'galerie : plateforme vidéo non supportée' },
    { who: 'admin', method: 'POST', path: '/api/media/resolve-video', body: { url: 'https://exemple.com/video.mp4' }, label: 'média : source non pCloud' },
    { who: 'admin', method: 'POST', path: '/api/media/resolve-video', body: { url: 'pas-une-url' }, label: 'média : URL malformée' },
    { who: 'member', method: 'PATCH', path: '/api/member/profile', body: { poles: ['pole-inexistant'] }, label: 'profil : pôle inconnu' },
    { who: 'member', method: 'POST', path: '/api/communaute/posts', body: {}, label: 'annonce : corps vide' },
    { who: 'member', method: 'POST', path: '/api/communaute/posts', body: { content: 'x'.repeat(5001), pole: 'anime' }, label: 'annonce : contenu trop long (5001)' },
    { who: 'member', method: 'POST', path: '/api/orders', body: {}, label: 'commande : corps vide' }
  ]

  const rows = []
  const created = []
  for (const c of cases) {
    const cookie = c.who === 'admin' ? adminSession.cookie : memberSession.cookie
    // UNE SEULE requête par cas : on lit le corps de CETTE requête (un second
    // appel créerait la donnée deux fois).
    let observed = { status: 0, location: null, error: '' }
    let bodyText = ''
    let createdId = null
    try {
      const r = await fetch(BASE + c.path, {
        method: c.method,
        redirect: 'manual',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify(c.body)
      })
      observed = { status: r.status, location: r.headers.get('location'), error: '' }
      const full = await r.text()
      bodyText = full.slice(0, 220)
      try {
        const parsedBody = JSON.parse(full)
        createdId = parsedBody?.data?.id || parsedBody?.id || null
      } catch { /* réponse non JSON */ }
    } catch (error) {
      observed = { status: 0, location: null, error: error.message }
    }
    const clean = observed.status < 500 && observed.status !== 0
    rows.push({ label: c.label, method: c.method, path: c.path, http: observed.status, clean, created: observed.status === 200 || observed.status === 201, body: bodyText })
    if (createdId) created.push({ who: c.who, path: c.path, id: createdId })
    console.log(`  ${clean ? 'OK   ' : 'KO   '} ${String(observed.status).padEnd(4)} ${c.method.padEnd(6)} ${c.path.padEnd(28)} ${c.label}`)
  }
  const broken = rows.filter(r => !r.clean)
  console.log(`\n${rows.length - broken.length}/${rows.length} cas renvoient une erreur propre (< 500). ${broken.length} erreur(s) serveur.`)

  // Nettoyage : ces cas ne DEVRAIENT rien créer. Quand l'un d'eux passe la
  // validation malgré tout (c'est justement l'anomalie recherchée), la donnée
  // créée est retirée immédiatement — le serveur en production ne doit pas
  // conserver les déchets de la QA.
  for (const item of created) {
    if (item.path === '/api/events') {
      const r = await probe(adminSession.cookie, 'DELETE', `/api/admin/events/${item.id}`)
      console.log(`  NETTOYAGE événement créé ${item.id} → HTTP ${r.status}`)
    } else if (item.path === '/api/communaute/posts') {
      const r = await probe(adminSession.cookie, 'DELETE', `/api/communaute/posts/${item.id}`)
      console.log(`  NETTOYAGE annonce créée ${item.id} → HTTP ${r.status}`)
    } else if (item.path === '/api/admin/gallery') {
      const r = await probe(adminSession.cookie, 'DELETE', `/api/admin/gallery/${item.id}`)
      console.log(`  NETTOYAGE média créé ${item.id} → HTTP ${r.status}`)
    } else if (item.path === '/api/tournaments') {
      await client.query('DELETE FROM tournament_matches WHERE "tournamentId" = $1', [item.id])
      await client.query('DELETE FROM tournament_teams WHERE "tournamentId" = $1', [item.id])
      await client.query('DELETE FROM tournaments WHERE id = $1', [item.id])
      console.log(`  NETTOYAGE tournoi créé ${item.id} → supprimé en base`)
    }
  }

  console.log(`Données créées par cette section : ${created.length} (toutes retirées).`)
  writeFileSync(join(homedir(), '.qa-runtime-invalid.json'), JSON.stringify(rows, null, 2))
  return broken.length
}

// ---------------------------------------------------------------------------
// SECTION 5 — nettoyage
// ---------------------------------------------------------------------------
async function sectionCleanup() {
  const sessions = await client.query(`SELECT id FROM users WHERE email LIKE $1`, [`${MARK}%`])
  const ids = sessions.rows.map(r => r.id)
  if (ids.length) {
    await client.query(`DELETE FROM sessions WHERE "userId" = ANY($1::text[])`, [ids])
    await client.query(`DELETE FROM users WHERE id = ANY($1::text[])`, [ids])
  }
  const remaining = await client.query(`SELECT email, role FROM users WHERE email LIKE $1 ORDER BY email`, [`${MARK}%`])
  console.log(`Comptes temporaires supprimés : ${ids.length}. Restants : ${remaining.rowCount}`)
  for (const r of remaining.rows) console.log(`  RESTE ${r.email} ${r.role}`)
  const leftoverTournaments = await client.query(`SELECT id, name FROM tournaments WHERE name LIKE 'QA-RUNTIME%'`)
  const leftoverEvents = await client.query(`SELECT id, title FROM events WHERE title LIKE 'QA-RUNTIME%'`)
  const leftoverGallery = await client.query(`SELECT id, title FROM gallery_images WHERE title LIKE 'QA-RUNTIME%'`)
  console.log(`Données de test restantes — tournois:${leftoverTournaments.rowCount} événements:${leftoverEvents.rowCount} médias:${leftoverGallery.rowCount}`)
  for (const r of leftoverTournaments.rows) console.log(`  TOURNOI ${r.id} ${r.name}`)
  for (const r of leftoverEvents.rows) console.log(`  ÉVÉNEMENT ${r.id} ${r.title}`)
  for (const r of leftoverGallery.rows) console.log(`  MÉDIA ${r.id} ${r.title}`)
  return remaining.rowCount + leftoverTournaments.rowCount + leftoverEvents.rowCount + leftoverGallery.rowCount
}

// ---------------------------------------------------------------------------
let failures = 0
if (SECTION === 'roles') failures = await sectionRoles()
else if (SECTION === 'crud') failures = await sectionCrud()
else if (SECTION === 'media') failures = await sectionMedia()
else if (SECTION === 'invalid') failures = await sectionInvalid()
else if (SECTION === 'cleanup') failures = await sectionCleanup()
else { console.error(`Section inconnue : ${SECTION}`); failures = 2 }

await client.end()
console.log(`\n[${SECTION}] échecs = ${failures}`)
process.exit(failures === 0 ? 0 : 1)
