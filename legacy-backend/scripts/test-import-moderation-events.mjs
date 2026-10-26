// ============================================================
// scripts/test-import-moderation-events.mjs
//
// TEST AU NIVEAU CODE (API + SQL, AUCUN test visuel) de l'import en masse
// tel qu'il est déclenché depuis les tableaux de bord d'administration :
//
//   • import en masse d'ÉVÉNEMENTS   → POST /api/events/bulk
//     (composant app/components/EventBulkImport.vue)
//   • import en masse de MÉDIAS vu depuis le tableau de bord de modération
//     (/dashboard-moderation → POST /api/admin/gallery/bulk, avec eventId)
//
// Vérifie : gardes d'accès réelles, création réelle en base, rattachement
// événement ↔ médias, doublons, limites de lot, historique d'import
// (import_batches), octets réellement servis par les URL stockées, puis
// NETTOIE tout ce qu'il a créé (comptages avant/après).
//
// Usage : node scripts/test-import-moderation-events.mjs [http://localhost:3226]
// Les mots de passe ne sont JAMAIS imprimés.
// ============================================================

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import pg from 'pg'

const BASE = (process.argv[2] || process.env.TEST_BASE_URL || 'http://localhost:3226').replace(/\/$/, '')
const MARQUE = `QA-IMPORT-MODO ${Date.now()}`
const MARQUE_RE = /^QA-IMPORT-MODO \d{10,}/

// ---------- .env ----------
const env = {}
for (const l of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/)
  if (m && !m[1].startsWith('#')) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const db = new pg.Client({ connectionString: env.DIRECT_DATABASE_URL || env.DATABASE_URL })
await db.connect()

const echecs = []
const ok = (label, cond, detail = '') => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!cond) echecs.push(`${label}${detail ? ` — ${detail}` : ''}`)
  return cond
}

// ---------- sessions réelles (cache de jetons, sinon fichier de comptes) ----------
const CACHE = path.join(os.tmpdir(), 'otaku-qa-session-tokens.json')
const cookies = {}
if (fs.existsSync(CACHE)) {
  const cache = JSON.parse(fs.readFileSync(CACHE, 'utf8'))
  for (const [role, token] of Object.entries(cache)) {
    const r = await fetch(`${BASE}/api/auth/me`, { headers: { cookie: `otaku_session=${token}` } })
    if (r.status === 200) cookies[role] = `otaku_session=${token}`
    console.log(`  session ${role.padEnd(13)} → /api/auth/me HTTP ${r.status}`)
  }
}

const appels = { 'events/bulk': 0, 'admin/gallery/bulk': 0 }

async function post (route, corps, role) {
  const cle = route.replace(/^\/api\//, '').split('/')[0] === 'admin' ? route.replace(/^\/api\//, '').split('/').slice(0, 3).join('/') : route.replace(/^\/api\//, '')
  appels[cle] = (appels[cle] ?? 0) + 1
  const headers = { 'content-type': 'application/json' }
  if (role && cookies[role]) headers.cookie = cookies[role]
  const r = await fetch(`${BASE}${route}`, { method: 'POST', headers, body: JSON.stringify(corps) })
  const texte = await r.text()
  let json = null
  try { json = JSON.parse(texte) } catch { /* non JSON */ }
  return { status: r.status, json, texte: texte.slice(0, 400) }
}

async function get (route, role) {
  const headers = {}
  if (role && cookies[role]) headers.cookie = cookies[role]
  const r = await fetch(`${BASE}${route}`, { headers })
  const texte = await r.text()
  let json = null
  try { json = JSON.parse(texte) } catch { /* non JSON */ }
  return { status: r.status, json, texte: texte.slice(0, 400) }
}

// ---------- comptages SQL ----------
const comptages = async () => {
  const ev = (await db.query('SELECT count(*)::int n FROM public.events')).rows[0].n
  const gal = (await db.query('SELECT count(*)::int n FROM public.gallery_images')).rows[0].n
  const batches = (await db.query('SELECT count(*)::int n FROM public.import_batches')).rows[0].n
  return { ev, gal, batches }
}

// ---------- charge utile d'import d'événements ----------
const DATE_DEBUT = new Date(Date.now() + 30 * 86400000).toISOString()
const DATE_FIN = new Date(Date.now() + 30 * 86400000 + 3 * 3600000).toISOString()
const IMAGE_OK = 'https://res.cloudinary.com/demo/image/upload/sample.jpg'
const IMAGE_OK_2 = 'https://res.cloudinary.com/demo/image/upload/w_100/sample.jpg'

const ligneValide = (titre = `${MARQUE} Atelier dessin`) => ({
  title: titre,
  description: 'Événement de test automatisé (aucun test visuel) — description valide.',
  location: 'ENEAM Cotonou',
  type: 'culture, gaming',
  start_date: DATE_DEBUT,
  end_date: DATE_FIN,
  status: 'upcoming',
  capacity: '30',
  price: '',
  is_free: 'true',
  payment_instructions: '',
  image_url: IMAGE_OK,
  photo_urls: '',
  youtube_urls: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
  video_urls: '',
  folder_urls: ''
})

let idEvenement = null
const idsEvenements = []
const idsMedias = []
const idsBatches = []

console.log(`\n=== Import en masse — tests code (${BASE}) — marqueur « ${MARQUE} » ===`)

// ============================================================
console.log('\n=== [0] ÉTAT INITIAL ===')
const avant = await comptages()
console.log(`  events=${avant.ev} gallery_images=${avant.gal} import_batches=${avant.batches}`)

// Purge des résidus d'un run interrompu
const residusEv = (await db.query(`SELECT id FROM public.events WHERE title LIKE 'QA-IMPORT-MODO %'`)).rows.map(r => r.id)
const residusGal = (await db.query(`SELECT id FROM public.gallery_images WHERE title LIKE 'QA-IMPORT-MODO %'`)).rows.map(r => r.id)
const residusBatch = (await db.query(`SELECT id FROM public.import_batches WHERE filename LIKE 'qa-import-modo%'`)).rows.map(r => r.id)
if (residusGal.length) await db.query('DELETE FROM public.gallery_images WHERE id = ANY($1)', [residusGal])
if (residusEv.length) await db.query('DELETE FROM public.events WHERE id = ANY($1)', [residusEv])
if (residusBatch.length) await db.query('DELETE FROM public.import_batches WHERE id = ANY($1)', [residusBatch])
console.log(`  résidus purgés : ${residusEv.length} événement(s), ${residusGal.length} média(s), ${residusBatch.length} lot(s)`)

// ============================================================
console.log('\n=== [1] GARDES D\'ACCÈS (import d\'événements) ===')
{
  const anon = await post('/api/events/bulk', { events: [ligneValide()] })
  ok('POST /api/events/bulk sans session → 401', anon.status === 401, `HTTP ${anon.status}`)
}
if (cookies.MEMBER) {
  const m = await post('/api/events/bulk', { events: [ligneValide()] }, 'MEMBER')
  ok('POST /api/events/bulk (MEMBER) → 403', m.status === 403, `HTTP ${m.status}`)
} else console.log('  (pas de session MEMBER disponible — cas ignoré)')
if (cookies.SHOP_MANAGER) {
  const s = await post('/api/events/bulk', { events: [ligneValide()] }, 'SHOP_MANAGER')
  ok('POST /api/events/bulk (SHOP_MANAGER) → 403', s.status === 403, `HTTP ${s.status}`)
  const g = await post('/api/admin/gallery/bulk', { title: MARQUE, category: 'QA', eventDate: DATE_DEBUT, imageUrls: [IMAGE_OK], videoUrls: [] }, 'SHOP_MANAGER')
  ok('POST /api/admin/gallery/bulk (SHOP_MANAGER) → 403', g.status === 403, `HTTP ${g.status}`)
} else console.log('  (pas de session SHOP_MANAGER disponible — cas ignoré)')

// ============================================================
console.log('\n=== [2] IMPORT EN MASSE D\'ÉVÉNEMENTS (POST /api/events/bulk, session ADMIN) ===')
const lot = [
  ligneValide(),                                                                          // ligne 2 : valide
  { ...ligneValide(`${MARQUE} Refusee`), description: 'court' },                          // ligne 3 : description < 10
  { ...ligneValide(`${MARQUE} Atelier dessin`) } // ligne 4 : doublon intra-lot (même titre)

]
let repbulk = null
if (!cookies.ADMIN) {
  console.log('  ✗ aucune session ADMIN/INTERMEDIATE_ADMIN disponible : import impossible à tester')
  echecs.push('session ADMIN indisponible')
} else {
  repbulk = await post('/api/events/bulk', { events: lot, sourceFileName: 'qa-import-modo-events.csv', sourceFormat: 'csv' }, 'ADMIN')
  console.log(`  POST /api/events/bulk → HTTP ${repbulk.status}`)
  if (repbulk.status !== 201) console.log('   ', repbulk.texte)
  const j = repbulk.json ?? {}
  console.log(`    créés=${j.created} médias=${j.mediaCreated} doublons=${j.duplicates} invalides=${j.invalid} total=${j.total} batchId=${j.batchId}`)
  for (const r of (j.rows ?? [])) console.log(`      ligne ${r.line} [${r.status}] ${String(r.message).slice(0, 90)}`)
  ok('HTTP 200 (l\'endpoint ne pose PAS de code 201 — voir défauts)', repbulk.status === 200, `HTTP ${repbulk.status}`)
  ok('body.status = 201 (statut métier annoncé dans le corps)', j.status === 201, `body.status=${j.status}`)
  ok('created = 1', j.created === 1, `created=${j.created}`)
  ok('duplicates = 1 (doublon intra-lot)', j.duplicates === 1, `duplicates=${j.duplicates}`)
  ok('invalid = 1 (description trop courte)', j.invalid === 1, `invalid=${j.invalid}`)
  ok('total = 3', j.total === 3, `total=${j.total}`)
  ok('historique d\'import créé (batchId)', typeof j.batchId === 'string' && j.batchId.length > 0, String(j.batchId))
  if (j.batchId) idsBatches.push(j.batchId)
}

// ============================================================
console.log('\n=== [3] PREUVE SQL : événements + médias réellement écrits ===')
{
  const evs = (await db.query(
    `SELECT id, title, place, pole, date, "endDate", status, capacity, price, "isFree", "imageUrl", "organizerId"
       FROM public.events WHERE title LIKE $1`, [`${MARQUE}%`])).rows
  console.log(`  SQL events (LIKE « ${MARQUE}% ») → ${evs.length} ligne(s)`)
  for (const e of evs) {
    console.log(`    ${e.title.slice(0, 45)} | place=${e.place} | pole=${e.pole} | status=${e.status} | isFree=${e.isFree} | capacity=${e.capacity} | imageUrl=${String(e.imageUrl).slice(0, 60)}`)
  }
  ok('1 événement en base', evs.length === 1, `${evs.length}`)
  const e = evs[0]
  if (e) {
    idEvenement = e.id
    idsEvenements.push(e.id)
    ok('pole normalisé depuis type « culture, gaming »', e.pole === 'Culture, Gaming', `pole=${e.pole}`)
    ok('capacity=30', e.capacity === 30, String(e.capacity))
    ok('isFree=true → price=0', e.isFree === true && Number(e.price) === 0, `isFree=${e.isFree} price=${e.price}`)
    ok('organizerId renseigné', Boolean(e.organizerId), String(e.organizerId))
    ok('status calculé (upcoming → …)', typeof e.status === 'string' && e.status.length > 0, `status=${e.status}`)
    ok('endDate écrite', Boolean(e.endDate), String(e.endDate))
  }

  const medias = (await db.query(
    `SELECT id, title, url, "mediaType", "youtubeId", "eventId", "isPublished", category
       FROM public.gallery_images WHERE "eventId" = $1`, [idEvenement])).rows
  console.log(`  SQL gallery_images (eventId=${String(idEvenement).slice(0, 8)}…) → ${medias.length} ligne(s)`)
  for (const m of medias) {
    console.log(`    ${m.mediaType} pub=${m.isPublished} yt=${m.youtubeId ?? '-'} url=${String(m.url).slice(0, 70)}`)
    idsMedias.push(m.id)
  }
  ok('médias rattachés à l\'événement (≥2 : 1 image + 1 vidéo YouTube)', medias.length >= 2, `${medias.length}`)
  const image = medias.find(m => m.mediaType === 'IMAGE')
  const video = medias.find(m => String(m.mediaType).includes('VIDEO'))
  ok('un média IMAGE', Boolean(image), image ? image.url.slice(0, 50) : 'aucun')
  ok('un média vidéo YouTube avec youtubeId', Boolean(video?.youtubeId), video ? `youtubeId=${video.youtubeId}` : 'aucun')
  // OBSERVATION (pas un échec de test) : les deux imports créent les médias
  // SANS isPublished → le défaut de schéma (true) s'applique, donc les médias
  // importés apparaissent APPROUVÉS dans /dashboard-moderation dès l'import.
  ok('OBSERVATION : médias importés publiés d\'emblée (isPublished=true, aucun passage en PENDING)', medias.every(m => m.isPublished === true), `isPublished=${medias.map(m => m.isPublished).join(',')}`)

  const tot = (await db.query(`SELECT count(*)::int n FROM public.gallery_images WHERE "eventId" = $1`, [idEvenement])).rows[0].n
  ok('aucun média en double dans le lot (count SQL = nb lignes listées)', tot === medias.length, `count=${tot}`)
}

// ============================================================
console.log('\n=== [4] OCTETS RÉELLEMENT SERVIS PAR LES URL STOCKÉES ===')
for (const m of (await db.query(`SELECT url, "mediaType", "sourceUrl" FROM public.gallery_images WHERE "eventId" = $1`, [idEvenement])).rows) {
  const url = m.url.startsWith('/') ? `${BASE}${m.url}` : m.url
  try {
    const r = await fetch(url, { headers: { Range: 'bytes=0-2047' }, redirect: 'follow', signal: AbortSignal.timeout(15000) })
    const octets = (await r.arrayBuffer()).byteLength
    console.log(`  ${r.ok || r.status === 206 ? '✓' : '✗'} ${m.mediaType} HTTP ${r.status} ${r.headers.get('content-type')} ${octets} o — ${url.slice(0, 80)}`)
    ok(`octets servis (${m.mediaType})`, r.status === 200 || r.status === 206, `HTTP ${r.status}`)
  } catch (e) {
    console.log(`  ✗ ${m.mediaType} ERREUR ${e.message} — ${url.slice(0, 80)}`)
    echecs.push(`octets non servis (${m.mediaType}): ${e.message}`)
  }
}

// ============================================================
console.log('\n=== [5] HISTORIQUE D\'IMPORT (import_batches, table lue par /api/admin/imports) ===')
{
  const b = (await db.query(`SELECT id, kind, filename, format, status, jsonb_array_length(rows::jsonb) AS n, report->>'created' AS created FROM public.import_batches WHERE id = $1`, [idsBatches[0] ?? ''])).rows[0]
  if (b) {
    console.log(`  batch ${b.id.slice(0, 8)}… kind=${b.kind} status=${b.status} filename=${b.filename} format=${b.format} lignes=${b.n} report.created=${b.created}`)
    ok('batch kind=EVENTS', b.kind === 'EVENTS', b.kind)
    ok('batch status=COMPLETED', b.status === 'COMPLETED', b.status)
    ok('batch rows = charge envoyée (3)', Number(b.n) === 3, String(b.n))
    ok('batch report.created = 1', Number(b.created) === 1, String(b.created))
  } else {
    ok('lot d\'import enregistré en base', false, 'aucune ligne import_batches trouvée')
  }
  const liste = await get('/api/admin/imports', 'ADMIN')
  console.log(`  GET /api/admin/imports (ADMIN) → HTTP ${liste.status}`)
  const trouve = JSON.stringify(liste.json ?? {}).includes(idsBatches[0] ?? '@@')
  ok('le lot apparaît dans /api/admin/imports', liste.status === 200 && trouve, `HTTP ${liste.status}`)
}

// ============================================================
console.log('\n=== [6] RÉ-IMPORT DU MÊME FICHIER (idempotence) ===')
{
  const r = await post('/api/events/bulk', { events: [ligneValide()], sourceFileName: 'qa-import-modo-events.csv', sourceFormat: 'csv' }, 'ADMIN')
  const j = r.json ?? {}
  console.log(`  POST /api/events/bulk (ré-import) → HTTP ${r.status} créés=${j.created} médias=${j.mediaCreated}`)
  if (j.batchId) idsBatches.push(j.batchId)
  ok('HTTP 200 (pas de code 201 posé)', r.status === 200, `HTTP ${r.status}`)
  ok('aucun nouvel événement créé en base (toujours 1)', (await db.query(`SELECT count(*)::int n FROM public.events WHERE title LIKE $1`, [`${MARQUE}%`])).rows[0].n === 1)
  ok('aucun média dupliqué (mediaCreated=0)', j.mediaCreated === 0, `mediaCreated=${j.mediaCreated}`)
}

// ============================================================
console.log('\n=== [7] LIMITES ET VALIDATION D\'ENTRÉE ===')
{
  const vide = await post('/api/events/bulk', { events: [] }, 'ADMIN')
  ok('events: [] → 400', vide.status === 400, `HTTP ${vide.status} ${String(vide.json?.statusMessage ?? vide.texte).slice(0, 80)}`)
  const trop = await post('/api/events/bulk', { events: Array.from({ length: 201 }, (_, i) => ligneValide(`${MARQUE} L${i}`)) }, 'ADMIN')
  ok('201 lignes → 400 (max 200)', trop.status === 400, `HTTP ${trop.status} ${String(trop.json?.statusMessage ?? trop.texte).slice(0, 80)}`)
}

// ============================================================
console.log('\n=== [8] IMPORT EN MASSE DE MÉDIAS — TABLEAU DE BORD DE MODÉRATION (POST /api/admin/gallery/bulk) ===')
let repGal = null
{
  const corps = {
    title: `${MARQUE} Souvenir`,
    category: 'culture',
    eventDate: DATE_DEBUT,
    eventTag: 'culture',
    eventId: idEvenement,
    imageUrls: [IMAGE_OK_2],
    videoUrls: ['https://youtu.be/9bZkp7q19f0']
  }
  repGal = await post('/api/admin/gallery/bulk', corps, 'ADMIN')
  const j = repGal.json ?? {}
  console.log(`  POST /api/admin/gallery/bulk → HTTP ${repGal.status} créés=${j.created} rejetés=${j.rejected}`)
  for (const e of (j.errors ?? [])) console.log(`      refus : ${String(e).slice(0, 110)}`)
  if (!repGal.status.toString().startsWith('2')) console.log('   ', repGal.texte)
  ok('HTTP 200 (pas de code 201 posé)', repGal.status === 200, `HTTP ${repGal.status}`)
  ok('created = 2 (1 image + 1 vidéo)', j.created === 2, `created=${j.created}`)

  const medias = (await db.query(
    `SELECT id, title, url, "mediaType", "eventId", "eventTag", "isPublished", category FROM public.gallery_images WHERE title = $1`, [`${MARQUE} Souvenir`])).rows
  console.log(`  SQL gallery_images (title = « ${MARQUE} Souvenir ») → ${medias.length} ligne(s)`)
  for (const m of medias) {
    console.log(`    ${m.mediaType} pub=${m.isPublished} eventId=${String(m.eventId).slice(0, 8)}… cat=${m.category} url=${String(m.url).slice(0, 65)}`)
    idsMedias.push(m.id)
  }
  ok('2 médias en base', medias.length === 2, `${medias.length}`)
  ok('rattachés à l\'événement importé', medias.every(m => m.eventId === idEvenement), medias.map(m => String(m.eventId).slice(0, 6)).join(','))
  ok('OBSERVATION : médias du lot publiés d\'emblée (isPublished=true)', medias.every(m => m.isPublished === true), `isPublished=${medias.map(m => m.isPublished).join(',')}`)

  // La liste lue par /dashboard-moderation est GET /api/admin/gallery
  const gal = await get('/api/admin/gallery', 'ADMIN')
  const dansListe = (gal.json?.data ?? []).filter(m => m.title === `${MARQUE} Souvenir`)
  console.log(`  GET /api/admin/gallery (ADMIN) → HTTP ${gal.status}, ${(gal.json?.data ?? []).length} médias, dont ${dansListe.length} du test`)
  ok('les médias du test sont visibles dans la liste de modération', gal.status === 200 && dansListe.length === 2, `${dansListe.length}`)
  ok('les médias du test ont isPublished=true → statut APPROUVÉ dans /dashboard-moderation', dansListe.every(m => m.isPublished === true))

  // L'événement doit aussi alimenter le sélecteur « rattacher à un événement »
  const evs = await get('/api/events', 'ADMIN')
  const dansEvents = (evs.json?.data ?? []).filter(e => String(e.title).startsWith(MARQUE))
  console.log(`  GET /api/events → HTTP ${evs.status}, ${(evs.json?.data ?? []).length} événements, dont ${dansEvents.length} du test`)
  ok('l\'événement importé alimente le sélecteur de la modération', evs.status === 200 && dansEvents.length === 1, `${dansEvents.length}`)
}

// ============================================================
console.log('\n=== [9] RÉ-IMPORT DU MÊME LOT MÉDIA (doublons) ===')
{
  const r = await post('/api/admin/gallery/bulk', {
    title: `${MARQUE} Souvenir`,
    category: 'culture',
    eventDate: DATE_DEBUT,
    eventTag: 'culture',
    eventId: idEvenement,
    imageUrls: [IMAGE_OK_2],
    videoUrls: ['https://youtu.be/9bZkp7q19f0']
  }, 'ADMIN')
  const j = r.json ?? {}
  console.log(`  POST /api/admin/gallery/bulk (ré-import) → HTTP ${r.status} créés=${j.created} rejetés=${j.rejected}`)
  for (const e of (j.errors ?? [])) console.log(`      refus : ${String(e).slice(0, 110)}`)
  ok('HTTP 200 (pas de code 201 posé)', r.status === 200, `HTTP ${r.status}`)
  ok('created = 0 (aucun doublon créé)', j.created === 0, `created=${j.created}`)
  ok('rejected = 2 (signalés)', j.rejected === 2, `rejected=${j.rejected}`)
  ok('toujours 2 médias en base (pas de doublon)', (await db.query(`SELECT count(*)::int n FROM public.gallery_images WHERE title = $1`, [`${MARQUE} Souvenir`])).rows[0].n === 2)
}

// ============================================================
console.log('\n=== [9bis] LIMITE CONNUE : URL contenant des VIRGULES (transformations Cloudinary) ===')
{
  const urlAvecVirgule = 'https://res.cloudinary.com/demo/image/upload/c_fill,h_120,w_160/sample.jpg'
  const r = await post('/api/admin/gallery/bulk', {
    title: `${MARQUE} Virgule`,
    category: 'culture',
    eventDate: DATE_DEBUT,
    eventId: null,
    imageUrls: [urlAvecVirgule],
    videoUrls: []
  }, 'ADMIN')
  const j = r.json ?? {}
  console.log(`  POST /api/admin/gallery/bulk (1 seule URL, contenant 2 virgules) → HTTP ${r.status} créés=${j.created} rejetés=${j.rejected}`)
  for (const e of (j.errors ?? [])) console.log(`      refus : ${String(e).slice(0, 130)}`)
  const lignes = (await db.query(`SELECT id, url FROM public.gallery_images WHERE title = $1`, [`${MARQUE} Virgule`])).rows
  for (const l of lignes) idsMedias.push(l.id)
  console.log(`  → ${j.rejected} erreur(s) pour UNE seule URL valide (elle est découpée en 3 fragments par splitUrls(/[|\\n,]/)) ; médias créés : ${lignes.length}`)
}

console.log('\n=== [10] LIENS DE DOSSIER pCloud (pipeline média partagé par les deux imports) ===')
{
  const dossier = 'https://u.pcloud.link/publink/show?code=VZKTsHJZxrc1dwuvczht3rJzM61TwmiCNJtk'
  const r = await post('/api/admin/gallery/bulk', {
    title: `${MARQUE} Dossier`,
    category: 'culture',
    eventDate: DATE_DEBUT,
    eventId: null,
    imageUrls: [dossier],
    videoUrls: []
  }, 'ADMIN')
  const j = r.json ?? {}
  console.log(`  POST /api/admin/gallery/bulk (dossier pCloud) → HTTP ${r.status} créés=${j.created} rejetés=${j.rejected}`)
  for (const e of (j.errors ?? [])) console.log(`      info : ${String(e).slice(0, 110)}`)
  if (j.created > 0) {
    const lignes = (await db.query(`SELECT id, url FROM public.gallery_images WHERE title = $1`, [`${MARQUE} Dossier`])).rows
    for (const l of lignes) { idsMedias.push(l.id); console.log(`    url stockée : ${String(l.url).slice(0, 90)}`) }
    ok('URL stockée = publink stable (jamais un lien direct pCloud lié à l\'IP)', lignes.every(l => !/^https?:\/\/[a-z0-9-]+\.pcloud\.com\//i.test(l.url)), `${lignes.length} média(s)`)
  } else {
    console.log('  (aucune image récupérée depuis le dossier pCloud — dépend du réseau externe, non bloquant)')
  }
}

// ============================================================
console.log('\n=== [11] CONTRÔLE STATIQUE : où vit l\'import d\'événements ? ===')
{
  const mod = fs.readFileSync('app/pages/dashboard-moderation.vue', 'utf8')
  const even = fs.readFileSync('app/pages/dashboard-evenementiel.vue', 'utf8')
  console.log(`  app/pages/dashboard-moderation.vue  contient « EventBulkImport » : ${mod.includes('EventBulkImport')}`)
  console.log(`  app/pages/dashboard-moderation.vue  appelle « /api/events/bulk »     : ${mod.includes('/api/events/bulk')}`)
  console.log(`  app/pages/dashboard-evenementiel.vue contient « EventBulkImport »    : ${even.includes('EventBulkImport')}`)
}

// ============================================================
console.log('\n=== [12] NETTOYAGE + BASE LAISSÉE INTACTE ===')
{
  const medias = (await db.query(`SELECT id FROM public.gallery_images WHERE title LIKE 'QA-IMPORT-MODO %'`)).rows.map(r => r.id)
  if (medias.length) await db.query('DELETE FROM public.gallery_images WHERE id = ANY($1)', [medias])
  const evs = (await db.query(`SELECT id FROM public.events WHERE title LIKE 'QA-IMPORT-MODO %'`)).rows.map(r => r.id)
  if (evs.length) await db.query('DELETE FROM public.events WHERE id = ANY($1)', [evs])
  const batches = (await db.query(`SELECT id FROM public.import_batches WHERE filename LIKE 'qa-import-modo%'`)).rows.map(r => r.id)
  if (batches.length) await db.query('DELETE FROM public.import_batches WHERE id = ANY($1)', [batches])
  console.log(`  supprimés : ${evs.length} événement(s), ${medias.length} média(s), ${batches.length} lot(s) d'import`)

  const apres = await comptages()
  console.log(`  comptages GLOBAUX : events=${apres.ev} (avant ${avant.ev}) | gallery_images=${apres.gal} (avant ${avant.gal}) | import_batches=${apres.batches} (avant ${avant.batches})`)
  console.log('  (la base est partagée : d\'autres scripts de test tournent en parallèle → les totaux globaux peuvent bouger sans lien avec ce test)')

  const resteMedias = (await db.query(`SELECT count(*)::int n FROM public.gallery_images WHERE title LIKE 'QA-IMPORT-MODO %'`)).rows[0].n
  const resteEv = (await db.query(`SELECT count(*)::int n FROM public.events WHERE title LIKE 'QA-IMPORT-MODO %'`)).rows[0].n
  const resteBatch = (await db.query(`SELECT count(*)::int n FROM public.import_batches WHERE filename LIKE 'qa-import-modo%'`)).rows[0].n
  ok('aucun événement du test laissé en base', resteEv === 0, `${resteEv}`)
  ok('aucun média du test laissé en base', resteMedias === 0, `${resteMedias}`)
  ok('aucun lot d\'import du test laissé en base', resteBatch === 0, `${resteBatch}`)
}

console.log(`\n  requêtes authentifiées envoyées : /api/events/bulk ×${appels['events/bulk']} (limite 10/min), /api/admin/gallery/bulk ×${appels['admin/gallery/bulk']} (limite 10/min)`)
console.log(`\n${echecs.length === 0 ? '✅ TOUS LES CONTRÔLES PASSENT' : `❌ ${echecs.length} ÉCHEC(S) :\n   - ` + echecs.join('\n   - ')}`)

await db.end()
process.exit(echecs.length === 0 ? 0 : 1)
