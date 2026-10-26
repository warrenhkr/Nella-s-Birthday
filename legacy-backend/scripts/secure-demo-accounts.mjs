// scripts/secure-demo-accounts.mjs
//
// Sécurise les comptes de DÉMONSTRATION du club (ceux du seed, en @otaku.club).
//
// POURQUOI CE SCRIPT
// ------------------
// L'audit de sécurité du 11/09/2026 a montré que 6 comptes @otaku.club étaient
// actifs en PRODUCTION avec le mot de passe de démonstration publié dans le
// dépôt (prisma/seed.ts) — dont DEUX administrateurs et un gestionnaire
// boutique. N'importe qui connaissant le dépôt pouvait donc administrer le site.
//
// DÉCISION PRISE : rotation des mots de passe (et non suppression ni
// désactivation) — les comptes restent utilisables pour tester chaque rôle,
// mais le mot de passe connu disparaît. Aucun compte réel (gmail, hotmail,
// dossoucarrel@, codonarcisse15@, kemifaton9@...) n'est jamais touché : le
// script ne cible QUE les adresses en @otaku.club.
//
// USAGE
//   node --env-file=.env scripts/secure-demo-accounts.mjs --list
//   node --env-file=.env scripts/secure-demo-accounts.mjs --rotate
//   node --env-file=.env scripts/secure-demo-accounts.mjs --deactivate
//   node --env-file=.env scripts/secure-demo-accounts.mjs --reactivate
//   (option) --base-url http://127.0.0.1:3000  pour vérifier la connexion après rotation
//
// Les nouveaux mots de passe sont écrits dans un fichier HORS du dépôt
// (%USERPROFILE%/otaku-comptes-demo.txt) et ne sont JAMAIS affichés à l'écran
// ni committés. Le script vérifie ensuite la connexion réelle de chaque compte
// et n'affiche que les codes HTTP.

import { randomBytes, scrypt as scryptCallback } from 'node:crypto'
import { promisify } from 'node:util'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import pg from 'pg'

const scrypt = promisify(scryptCallback)
const DEMO_DOMAIN = '@otaku.club'
const PASSWORDS_FILE = join(homedir(), 'otaku-comptes-demo.txt')
const connectionString = process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL

// Même format que server/utils/password.ts — indispensable pour que la
// connexion continue de fonctionner après la mise à jour.
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = await scrypt(password, salt, 64)
  return `scrypt:${salt}:${derivedKey.toString('hex')}`
}

function generatePassword() {
  return randomBytes(18).toString('base64url') // 24 caractères
}

const mode = process.argv.includes('--rotate') ? 'rotate'
  : process.argv.includes('--deactivate') ? 'deactivate'
    : process.argv.includes('--reactivate') ? 'reactivate'
      : 'list'
const baseUrlArg = process.argv.indexOf('--base-url')
const baseUrl = (baseUrlArg !== -1 ? process.argv[baseUrlArg + 1] : process.env.TEST_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')

if (!connectionString) {
  console.error('DATABASE_URL absent : lance avec  node --env-file=.env scripts/secure-demo-accounts.mjs ...')
  process.exit(2)
}

const client = new pg.Client({
  connectionString,
  ssl: /sslmode=require/.test(connectionString) ? { rejectUnauthorized: false } : undefined
})
await client.connect()

const { rows: accounts } = await client.query(
  `SELECT id, email, role, "isActive" FROM users WHERE email LIKE $1 ORDER BY role, email`,
  [`%${DEMO_DOMAIN}`]
)

console.log(`Comptes de démonstration (${DEMO_DOMAIN}) : ${accounts.length}`)
for (const account of accounts) {
  console.log(`  ${account.email.padEnd(26)} ${account.role.padEnd(18)} actif=${account.isActive}`)
}
if (!accounts.length) {
  console.log('Rien à faire.')
  await client.end()
  process.exit(0)
}

if (mode === 'list') {
  console.log('\nMode liste uniquement : rien n’a été modifié.')
  await client.end()
  process.exit(0)
}

if (mode === 'deactivate' || mode === 'reactivate') {
  const isActive = mode === 'reactivate'
  const updated = await client.query(
    `UPDATE users SET "isActive" = $1, "updatedAt" = now() WHERE email LIKE $2 RETURNING email`,
    [isActive, `%${DEMO_DOMAIN}`]
  )
  console.log(`\n${updated.rowCount} compte(s) ${isActive ? 'réactivé(s)' : 'DÉSACTIVÉ(S)'}.`)
  await client.end()
  process.exit(0)
}

// ---- Rotation des mots de passe -------------------------------------------
const results = []
for (const account of accounts) {
  const password = generatePassword()
  const hash = await hashPassword(password)
  await client.query(
    `UPDATE users SET password = $1, "updatedAt" = now() WHERE id = $2`,
    [hash, account.id]
  )
  results.push({ email: account.email, role: account.role, password })
}

const lines = [
  '# Comptes de démonstration du Club Otaku — mots de passe tournés',
  `# Généré le ${new Date().toISOString()} par scripts/secure-demo-accounts.mjs`,
  '# NE PAS COMMITER CE FICHIER. Il vit hors du dépôt (%USERPROFILE%).',
  '',
  ...results.map(r => `${r.email.padEnd(26)} ${r.role.padEnd(18)} ${r.password}`),
  '',
  'Pour rejouer les tests qui se connectent :',
  `  SEED_TEST_PASSWORD="<mot de passe du compte>" node --env-file=.env scripts/test-shop-guard.mjs`
]
writeFileSync(PASSWORDS_FILE, lines.join('\n'), 'utf8')
console.log(`\n${results.length} mot(s) de passe tourné(s).`)
console.log(`Fichier (hors dépôt, non committé) : ${PASSWORDS_FILE}`)

// ---- Vérification réelle : la connexion fonctionne-t-elle encore ? ---------
console.log(`\nVérification de connexion réelle sur ${baseUrl} :`)
for (const result of results) {
  try {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: result.email, password: result.password }),
      signal: AbortSignal.timeout(20000)
    })
    console.log(`  ${result.email.padEnd(26)} → HTTP ${response.status} ${response.ok ? '(OK)' : '(ÉCHEC)'}`)
  } catch (error) {
    console.log(`  ${result.email.padEnd(26)} → injoignable (${error.name})`)
  }
}

console.log('\nAncien mot de passe de démonstration : désormais INVALIDE.')
await client.end()
