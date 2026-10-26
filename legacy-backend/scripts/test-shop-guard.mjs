// scripts/test-shop-guard.mjs
//
// Vérification RÉELLE (pas simulée) de la garde boutique :
//   1. lecture seule des comptes réellement présents en base (SELECT email, role) ;
//   2. test HTTP réel contre le serveur dev déjà lancé : connexion réelle via
//      /api/auth/login puis appel des routes boutique protégées, pour chaque
//      compte dont le mot de passe de seed est connu (`demo-password`).
//
// ⚠️ CE SCRIPT EST DÉSORMAIS UN SOUS-ENSEMBLE DE scripts/test-runtime-roles.mjs,
// qui couvre les 5 rôles × 33 routes (boutique, supervision, opérations,
// événementiel, pages protégées, parcours par rôle) et sort en code ≠ 0 dès
// qu'une divergence existe. Cette vérification ciblée de la garde boutique
// reste utile pour un contrôle rapide ; pour la matrice complète :
//   node scripts/test-runtime-roles.mjs http://localhost:3224
//
// Usage :
//   node --env-file=.env scripts/test-shop-guard.mjs [http://localhost:3000]
//   TEST_TIMEOUT_MS=60000 node --env-file=.env scripts/test-shop-guard.mjs
//
// Aucune écriture : la partie base de données est un SELECT (client `pg`), la
// partie HTTP utilise les comptes de seed existants. Aucun compte n'est créé,
// modifié ou supprimé.
//
// ⚠️ Limite connue : ce script ne peut PAS tester INTERMEDIATE_ADMIN si la base
// ne contient aucun compte administrateur intermédiaire avec un mot de passe
// connu. Dans ce cas, la ligne correspondante est marquée `no-session`.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'
import dotenv from 'dotenv'
import pg from 'pg'

// ─────────────────────────────────────────────────────────────────────────────
// CAUSE RACINE DU CRASH PRÉCÉDENT : ce script lisait `process.env` directement
// et comptait sur `node --env-file=.env ...`. Lancé comme les autres scripts
// (`node scripts/test-shop-guard.mjs`), l'environnement était vide : il
// sortait en exit 2 (« DATABASE_URL absent ») sans rien tester. Il charge
// désormais lui-même le `.env` du dépôt (comme prisma/seed.ts et
// scripts/test-media-pipeline.mjs), sans écraser les variables déjà définies.
// ─────────────────────────────────────────────────────────────────────────────
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: resolve(ROOT, '.env'), quiet: true })

const baseUrl = (process.argv[2] || process.env.TEST_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const timeoutMs = Number(process.env.TEST_TIMEOUT_MS || 15000)
const connectionString = process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL
// Les comptes de démonstration @otaku.club ont été sécurisés le 11/09/2026
// (rotation des mots de passe, cf. scripts/secure-demo-accounts.mjs) : l'ancien
// mot de passe 'demo-password' n'est plus valide. Deux sources, dans l'ordre :
//   1. SEED_TEST_PASSWORD (s'applique à tous les comptes testés) ;
//   2. le fichier HORS DÉPÔT %USERPROFILE%/otaku-comptes-demo.txt écrit par
//      scripts/secure-demo-accounts.mjs — un mot de passe PAR COMPTE.
// Le script est ainsi rejouable en une seule commande, et aucun mot de passe
// n'est imprimé : seul « connu / absent » est affiché.
const DEMO_PASSWORDS_FILE = resolve(homedir(), 'otaku-comptes-demo.txt')

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

const demoPasswords = loadDemoPasswords()
const globalPassword = process.env.SEED_TEST_PASSWORD || ''
const passwordFor = (email) => globalPassword || demoPasswords.get(String(email).toLowerCase()) || ''
/** Vrai dès qu'un mot de passe est disponible pour ce compte. */
const hasPasswordFor = (email) => passwordFor(email).length > 0

const ROUTES = [
  '/api/boutique/catalog',
  '/api/boutique/orders'
]

// Attendu APRÈS le correctif de parité : l'admin intermédiaire a les mêmes
// droits boutique que le gestionnaire boutique ; ADMIN et MEMBER sont refusés.
const expectedHttp = {
  SUPER_ADMIN: 403,
  INTERMEDIATE_ADMIN: 200,
  SHOP_MANAGER: 200,
  ADMIN: 403,
  MEMBER: 403
}

function line(title = '') {
  console.log(title ? `\n=== ${title} ===` : '')
}

async function http(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) })
}

async function main() {
  if (!connectionString) {
    console.error('DATABASE_URL absent (.env) : impossible de lire les comptes.')
    process.exit(2)
  }

  const client = new pg.Client({
    connectionString,
    ssl: /sslmode=require/.test(connectionString) ? { rejectUnauthorized: false } : undefined
  })
  await client.connect()

  line('1. Comptes réellement présents en base (lecture seule)')
  const { rows: users } = await client.query(
    'SELECT email, role, "isActive" FROM public.users ORDER BY role ASC, email ASC'
  )
  for (const user of users) {
    console.log(`  ${String(user.role).padEnd(18)} ${String(user.email).padEnd(30)} (actif: ${user.isActive})`)
  }
  console.log(`  total = ${users.length}`)
  const intermediate = users.filter(user => user.role === 'INTERMEDIATE_ADMIN')
  console.log(`  comptes INTERMEDIATE_ADMIN en base : ${intermediate.length}`)

  line('2. Test HTTP réel de la garde boutique')
  console.log(`  serveur ciblé : ${baseUrl}`)
  console.log(`  source des mots de passe : ${globalPassword ? 'SEED_TEST_PASSWORD (variable d’environnement)' : `${DEMO_PASSWORDS_FILE} (fichier hors dépôt)`}`)
  console.log('  (les valeurs ne sont jamais imprimées)\n')

  // Le serveur dev peut être indisponible (relances, conflits .nuxt) : on le
  // détecte AVANT la boucle pour ne pas enchaîner des dizaines de timeouts.
  try {
    const probe = await http(`${baseUrl}/api/health`)
    console.log(`  sonde /api/health → HTTP ${probe.status}`)
  } catch (error) {
    console.log(`  serveur injoignable (${error.name}: ${error.message})`)
    console.log('  → aucun test HTTP possible : lance `npm run dev` (ou cible une URL : node scripts/test-shop-guard.mjs https://club-otaku-eneam.vercel.app).')
    await client.end()
    process.exit(2)
  }

  const results = []
  for (const user of users.filter(entry => entry.isActive)) {
    // Compte dont le mot de passe n'est pas connu (comptes réels, gmail... ) :
    // on ne tente AUCUNE connexion (pas de risque de verrouillage/rate-limit).
    if (!hasPasswordFor(user.email)) {
      console.log(`  ${String(user.role).padEnd(18)} ${String(user.email).padEnd(30)} mot de passe inconnu → ignoré`)
      results.push({ role: user.role, email: user.email, route: '-', status: 'no-password' })
      continue
    }

    let cookie = ''
    let loginStatus = 0
    try {
      const response = await http(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: passwordFor(user.email) })
      })
      loginStatus = response.status
      const setCookie = response.headers.getSetCookie?.() || []
      cookie = setCookie.map(entry => entry.split(';')[0]).join('; ')
    } catch (error) {
      console.log(`  ${String(user.email).padEnd(30)} serveur injoignable (${error.name}: ${error.message})`)
      results.push({ role: user.role, email: user.email, route: '-', status: 'no-server' })
      continue
    }

    if (!cookie) {
      console.log(`  ${String(user.role).padEnd(18)} ${String(user.email).padEnd(30)} login HTTP ${loginStatus} → pas de session`)
      results.push({ role: user.role, email: user.email, route: '-', status: 'no-session' })
      continue
    }

    for (const route of ROUTES) {
      const response = await http(`${baseUrl}${route}`, { headers: { cookie } })
      results.push({ role: user.role, email: user.email, route, status: response.status })
      console.log(`  ${String(user.role).padEnd(18)} ${String(user.email).padEnd(30)} ${route.padEnd(28)} → HTTP ${response.status}`)
    }
  }

  line('3. Synthèse')
  let tested = 0
  let failed = 0
  for (const row of results) {
    if (!Number.isInteger(row.status)) continue
    tested++
    const want = expectedHttp[row.role]
    const pass = row.status === want
    if (!pass) failed++
    console.log(`  ${pass ? 'OK  ' : 'FAIL'} ${String(row.role).padEnd(18)} ${row.route.padEnd(28)} attendu ${want} / obtenu ${row.status}`)
  }
  console.log(`\n  ${tested} requête(s) comparée(s), ${failed} divergence(s).`)
  await client.end()

  // Un test qui ne peut pas échouer ne prouve rien : sans requête comparable,
  // ou avec une divergence, le script sort en erreur.
  if (tested === 0) {
    console.log('  → AUCUN test HTTP n\'a pu être exécuté (serveur injoignable ou mots de passe inconnus).')
    console.log('    Réessaie avec un serveur joignable : node scripts/test-shop-guard.mjs http://127.0.0.1:3000')
    process.exit(2)
  }
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
