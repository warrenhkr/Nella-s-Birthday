// ============================================================
// .e2e-full.mjs — Test de bout en bout COMPLET de l'import en masse.
//   1. crée un compte SUPER_ADMIN temporaire (supprimé à la fin) ;
//   2. se connecte via /api/auth/login (session réelle) ;
//   3. lit test.xlsx et reproduit la normalisation du client ;
//   4. POST /api/events/bulk — écriture RÉELLE en base ;
//   5. vérifie les événements ET les médias créés via l'API ;
//   6. teste les octets réels d'une image et d'une vidéo créées ;
//   7. supprime les événements de test puis le compte temporaire.
//
// Aucun identifiant n'est affiché.
// ============================================================

import fs from 'node:fs'
import { randomBytes, scrypt as scryptCb } from 'node:crypto'
import { promisify } from 'node:util'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const scrypt = promisify(scryptCb)
const BASE = process.argv[2] || 'http://localhost:3226'
const MARQUEUR = `E2E ${Date.now()}`
const MARQUE_RESIDUS = / E2E \d{10,}/

const hashPassword = async (pwd) => {
  const salt = randomBytes(16).toString('hex')
  const key = await scrypt(pwd, salt, 64)
  return `scrypt:${salt}:${key.toString('hex')}`
}

// ---------- .env ----------
const env = {}
for (const l of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/)
  if (m && !m[1].startsWith('#')) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

// ---------- Normalisation CLIENT (copie fidèle) ----------
const keyOf = (v) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const MOIS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre']
const monthNumber = (v) => MOIS.indexOf(keyOf(v))
const finJour = (y, m, d) => new Date(Date.UTC(y, m, d, 23, 59, 59)).toISOString()
function parseHistoricalDate(value) {
  const n = value.trim()
  if (/^\d{4}-\d{2}-\d{2}(?:[T ]|$)/.test(n)) {
    const d = new Date(n)
    if (!Number.isNaN(d.getTime())) return { start: d.toISOString(), end: finJour(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) }
  }
  const r = n.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})\s*[-/]\s*(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)
  if (r) {
    const [, sd, sm, sy, ed, em, ey] = r
    return { start: new Date(Date.UTC(+sy, +sm - 1, +sd)).toISOString(), end: finJour(+ey, +em - 1, +ed) }
  }
  const dr = n.match(/^(\d{1,2})(?:\s+au\s+(\d{1,2}))?\s+([a-zA-ZÀ-ÿ]+)\s+(\d{4})$/i)
  if (dr) {
    const [, fd, sd, mn, y] = dr
    const m = monthNumber(mn)
    if (m >= 0) return { start: new Date(Date.UTC(+y, m, +fd)).toISOString(), end: finJour(+y, m, +(sd || fd)) }
  }
  const mr = n.match(/^([\p{L}]+)(?:\s*[-–—/]\s*([\p{L}]+))?\s+(\d{4})$/iu)
  if (mr) {
    const [, m1, m2, y] = mr
    const sm = monthNumber(m1)
    const em = monthNumber(m2 || m1)
    if (sm >= 0 && em >= 0) {
      const ey = em < sm ? +y + 1 : +y
      return { start: new Date(Date.UTC(+y, sm, 1)).toISOString(), end: finJour(ey, em + 1, 0) }
    }
  }
  if (/^\d{5,6}$/.test(n)) {
    const serie = Number(n)
    const d = new Date(Date.UTC(1899, 11, 30) + serie * 86400000)
    const annee = d.getUTCFullYear()
    if (!Number.isNaN(d.getTime()) && annee >= 1990 && annee <= 2100) {
      return { start: d.toISOString(), end: finJour(annee, d.getUTCMonth(), d.getUTCDate()) }
    }
  }
  return null
}
const findValue = (row, names) => {
  const e = Object.entries(row).find(([k]) => names.includes(keyOf(k)))
  return e?.[1]?.toString().trim() || ''
}
const isFolderUrl = (v) => {
  try {
    const u = new URL(v.trim()); const h = u.hostname.replace(/^www\./, '').toLowerCase()
    if (h === 'drive.google.com' || h === 'docs.google.com') return /\/folders\//i.test(u.pathname)
    if (h === 'pcloud.com' || h.endsWith('.pcloud.com') || h === 'u.pcloud.link') return /\/publink\//i.test(u.pathname)
  } catch { return false }
  return false
}
function normaliserLigne(row, suffixe) {
  const n = { ...row }
  n.title = (n.title || findValue(row, ['title', 'titre', 'name'])) + (suffixe ? ` ${suffixe}` : '')
  n.description = n.description || findValue(row, ['description', 'details'])
  n.location = n.location || findValue(row, ['location', 'lieu', 'place'])
  n.type = n.type || findValue(row, ['type', 'categorie', 'category'])
  n.image_url = n.image_url || findValue(row, ['imageurl', 'image'])
  n.folder_urls = n.folder_urls || findValue(row, ['folderurl', 'folderurls', 'dossier', 'dossiers'])
  n.video_urls = n.video_urls || findValue(row, ['videourl', 'videourls', 'youtubeurl', 'youtubeurls', 'video'])
  const inf = [n.image_url, n.photo_urls, n.video_urls]
    .flatMap((v) => (v || '').split(/[|\n,]/).map((i) => i.trim()).filter(isFolderUrl))
  n.folder_urls = [...new Set([...n.folder_urls.split(/[|\n,]/).map((v) => v.trim()).filter(Boolean), ...inf])].join('|')
  const rd = findValue(row, ['date', 'eventdate'])
  if (!n.start_date && rd) { const p = parseHistoricalDate(rd); if (p) { n.start_date = p.start; n.end_date = p.end } }
  n.type = [...new Set(n.type.split(/[,|\n]/).map((v) => v.trim()).filter(Boolean))].join(', ')
  const rp = n.price || findValue(row, ['price', 'prix'])
  n.price = rp.replace(/[^0-9.]/g, '')
  n.is_free = n.is_free || (/(gratuit|free)/i.test(rp) ? 'true' : n.price ? 'false' : 'true')
  return n
}

// ---------- Prisma ----------
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) })
const email = `e2e-devotron-${Date.now()}@local.test`
const pseudo = `E2E_Devotron_${Date.now()}`
const motDePasse = randomBytes(18).toString('base64url')
let userId = null
const idsCrees = []

try {
  // 0. Purge des résidus d'un test précédent interrompu (serveur redémarré,
  //    plantage…) : sans ça, des médias de test restent en base.
  const residus = (await prisma.galleryImage.findMany({ select: { id: true, title: true } }))
    .filter(m => MARQUE_RESIDUS.test(m.title || ''))
  if (residus.length) {
    await prisma.galleryImage.deleteMany({ where: { id: { in: residus.map(r => r.id) } } })
  }
  const evtsResidus = (await prisma.event.findMany({ select: { id: true, title: true } }))
    .filter(e => MARQUE_RESIDUS.test(e.title || ''))
  if (evtsResidus.length) {
    await prisma.event.deleteMany({ where: { id: { in: evtsResidus.map(e => e.id) } } })
  }
  if (residus.length || evtsResidus.length) {
    console.log(`[0] Résidus purgés : ${evtsResidus.length} événement(s) + ${residus.length} média(s)`)
  }

  // 1. Compte temporaire
  const u = await prisma.user.create({
    data: { email, pseudo, password: await hashPassword(motDePasse), role: 'SUPER_ADMIN', isActive: true, pole: 'Gaming' }
  })
  userId = u.id
  console.log(`[1] Compte SUPER_ADMIN temporaire créé (id ${userId.slice(0, 8)}…)`)

  // 2. Login réel
  const lr = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: motDePasse })
  })
  const cookie = (lr.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')
  console.log(`[2] Login → HTTP ${lr.status} ${cookie ? '(session ✓)' : '(ÉCHEC ✗)'}`)
  if (!cookie) throw new Error('login impossible')

  // 3. test.xlsx + normalisation client
  const wb = XLSX.readFile('test.xlsx')
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
  const payload = rows.map((r) => normaliserLigne(r, MARQUEUR))
  console.log(`[3] test.xlsx : ${rows.length} lignes | image_url: ${payload.filter(r => r.image_url).length} | video_urls: ${payload.filter(r => r.video_urls).length} | dates: ${payload.filter(r => r.start_date).length}`)

  // 4. Import réel
  const rep = await fetch(`${BASE}/api/events/bulk`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ events: payload, sourceFileName: 'test.xlsx', sourceFormat: 'xlsx' })
  })
  const res = await rep.json()
  console.log(`[4] POST /api/events/bulk → HTTP ${rep.status}`)
  if (rep.status !== 201) {
    console.log('    --- ERREUR SERVEUR ---')
    console.log('   ', JSON.stringify(res).slice(0, 900))
  }
  console.log(`    créés=${res.created}  MÉDIAS=${res.mediaCreated}  doublons=${res.duplicates}  invalides=${res.invalid}  total=${res.total}`)
  if (res.invalid) for (const l of (res.rows ?? []).filter(r => r.status === 'invalid').slice(0, 5)) console.log(`      refus ligne ${l.line}: ${l.message}`)

  // 5. Vérification via l'API
  const g = await fetch(`${BASE}/api/galerie`).then(r => r.json())
  const tous = g.data ?? []
  const mesEvenements = await prisma.event.findMany({ where: { title: { contains: MARQUEUR } }, select: { id: true, title: true } })
  const ids = new Set(mesEvenements.map(e => e.id))
  const medias = tous.filter(m => m.eventId && ids.has(m.eventId))
  console.log(`[5] Événements créés en base : ${mesEvenements.length} | médias attachés : ${medias.length}`)

  // Vérification STRUCTURELLE : ce qui est stocké doit être un publink
  // (stable), jamais un lien direct pCloud (lié à l'IP, qui casse en prod).
  const decoder = (u) => {
    const m = String(u).match(/[?&]url=([^&]+)/)
    return m ? decodeURIComponent(m[1]) : String(u)
  }
  const publinks = medias.filter(m => /publink|u\.pcloud\.link/i.test(decoder(m.url))).length
  const directs = medias.filter(m => /^https?:\/\/[a-z0-9-]+\.pcloud\.com\//i.test(decoder(m.url))).length
  const avecNom = medias.filter(m => /#f=/.test(decoder(m.url))).length
  console.log(`    format stocké -> publink: ${publinks} | lien direct (KO): ${directs} | avec nom de fichier: ${avecNom}`)
  if (medias[0]) console.log(`    exemple : ${decoder(medias[0].url).slice(0, 110)}`)

  // 6. Octets réels
  const img = medias.find(m => String(m.mediaType).toLowerCase().includes('image'))
  const vid = medias.find(m => String(m.mediaType).toLowerCase().includes('video'))
  const tester = async (label, url, range) => {
    if (!url) { console.log(`    ${label}: aucun média`); return false }
    try {
      const r = await fetch(url, { headers: range ? { Range: 'bytes=0-1023' } : {} })
      const b = await r.arrayBuffer()
      const ok = r.status === 200 || r.status === 206
      console.log(`    ${ok ? '✓' : '✗'} ${label} HTTP ${r.status} ${r.headers.get('content-type')} ${b.byteLength} o`)
      return ok
    } catch (e) { console.log(`    ✗ ${label} ${e.message}`); return false }
  }
  console.log('[6] Octets réels :')
  const okImg = await tester('image', img?.url, false)
  const okVid = await tester('vidéo', vid?.url, true)

  // 7. Nettoyage complet : médias de test PUIS événements de test.
  //    (les médias ne suivent pas la suppression en cascade des événements)
  const tousMedias = await prisma.galleryImage.findMany({ select: { id: true, title: true } })
  const mediasTest = tousMedias.filter((m) => (m.title || '').includes(MARQUEUR))
  if (mediasTest.length) {
    await prisma.galleryImage.deleteMany({ where: { id: { in: mediasTest.map((m) => m.id) } } })
  }
  if (mesEvenements.length) {
    await prisma.event.deleteMany({ where: { id: { in: [...ids] } } })
  }
  console.log(`[7] Nettoyage : ${mesEvenements.length} événement(s) + ${mediasTest.length} média(s) de test supprimés`)
  const resteMedias = await prisma.galleryImage.count()
  console.log(`    médias restants en base : ${resteMedias}`)

  const verdict = res.created > 0 && medias.length > 0 && okImg && okVid
  console.log(`\n${verdict ? '✅ IMPORT EN MASSE + MÉDIAS FONCTIONNENT DE BOUT EN BOUT' : '⚠️ voir le détail ci-dessus'}`)
} catch (e) {
  console.log('❌ ERREUR:', e.message)
} finally {
  try {
    // Suppression du compte temporaire (les sessions suivent en cascade)
    if (userId) {
      await prisma.session.deleteMany({ where: { userId } })
      await prisma.user.delete({ where: { id: userId } })
      console.log('[8] Compte temporaire supprimé')
    }
  } catch (e) { console.log('   (nettoyage compte) ', e.message) }
  await prisma.$disconnect()
}
