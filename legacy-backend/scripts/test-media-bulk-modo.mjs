// ============================================================
// scripts/test-media-bulk-modo.mjs
//
// VÉRIFICATION DE BOUT EN BOUT DE L'IMPORT MASSIF D'IMAGES **ET** DE VIDÉOS
// depuis la page de modération (/dashboard-moderation → POST /api/admin/gallery/bulk).
//
// Ce script ne rejoue PAS ce que couvrent déjà :
//   - test-import-e2e.mjs      → import d'ÉVÉNEMENTS depuis test.xlsx
//   - test-media-pipeline.mjs  → résolution pure des liens (import-media.ts)
// Il teste le LOT MIXTE par l'API réelle : images (dossier pCloud + images
// réelles uploadées sur Cloudinary) ET vidéos (YouTube + 2 dossiers pCloud),
// plus les cas limites (lot partiellement invalide, média en doublon, vidéo
// collée dans la zone Images, limite de lot, fichier refusé, droits).
//
// Usage : node scripts/test-media-bulk-modo.mjs [--base http://localhost:3223]
// Aucun mot de passe n'est affiché. Tout ce qui est créé est supprimé en fin de
// course (médias par marqueur, images Cloudinary, comptes temporaires) avec
// comptages avant/après.
// ============================================================

import fs from 'node:fs'
import zlib from 'node:zlib'
import { randomBytes, scrypt as scryptCb } from 'node:crypto'
import { promisify } from 'node:util'
import pg from 'pg'

const scrypt = promisify(scryptCb)
const BASE = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'http://localhost:3223'
const MARQUE = `QA-BULK-MODO ${Date.now()}`

// ---------- générateur de PNG RÉEL (aucune dépendance) ----------
const tableCrc = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
const crc32 = (buf) => {
  let c = 0xFFFFFFFF
  for (const octet of buf) c = tableCrc[(c ^ octet) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}
const chunk = (type, data) => {
  const entete = Buffer.alloc(4)
  entete.writeUInt32BE(data.length)
  const corps = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(corps))
  return Buffer.concat([entete, corps, crc])
}
function pngReel(largeur, hauteur, [r, v, b]) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(largeur, 0)
  ihdr.writeUInt32BE(hauteur, 4)
  ihdr[8] = 8 // 8 bits/canal
  ihdr[9] = 2 // RVB
  const lignes = []
  for (let y = 0; y < hauteur; y++) {
    const ligne = Buffer.alloc(1 + largeur * 3)
    for (let x = 0; x < largeur; x++) {
      ligne[1 + x * 3] = r
      ligne[2 + x * 3] = v
      ligne[3 + x * 3] = b
    }
    lignes.push(ligne)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(lignes))),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// ---------- fixtures stockage réel ----------
const FIXTURES = {
  dossierImages: 'https://u.pcloud.link/publink/show?code=VZKTsHJZxrc1dwuvczht3rJzM61TwmiCNJtk',
  dossierVideos1: 'https://u.pcloud.link/publink/show?code=VZV2sHJZ9TSUcHgYVz0e3ql1atKDOyesFXi7',
  dossierVideos2: 'https://u.pcloud.link/publink/show?code=VZRDsHJZjO07cQ4kl0uDS9A8gGYJuVTrJ0jk',
  publinkInexistant: 'https://u.pcloud.link/publink/show?code=AAAINEXISTANTAAA',
  lienMort: 'https://exemple-qa.invalid/photo.jpg',
  lienNonMedia: 'https://exemple-qa.invalid/document.pdf',
  clipMp4: 'https://exemple-qa.invalid/clip.mp4',
  youtube: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
  youtube2: 'https://youtu.be/9bZkp7q19f0',
  youtube3: 'https://youtu.be/dQw4w9WgXcQ'
}

// ---------- .env ----------
const env = {}
for (const l of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/)
  if (m && !m[1].startsWith('#')) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const db = new pg.Client({ connectionString: env.DIRECT_DATABASE_URL || env.DATABASE_URL })
await db.connect()

const hashPassword = async (pwd) => {
  const salt = randomBytes(16).toString('hex')
  const key = await scrypt(pwd, salt, 64)
  return `scrypt:${salt}:${key.toString('hex')}`
}

const comptages = async () => {
  const total = (await db.query('SELECT count(*)::int n FROM public.gallery_images')).rows[0].n
  const parType = (await db.query('SELECT "mediaType", count(*)::int n FROM public.gallery_images GROUP BY 1 ORDER BY 1')).rows
  const parStatut = (await db.query('SELECT "isPublished", count(*)::int n FROM public.gallery_images GROUP BY 1 ORDER BY 1')).rows
  return {
    total,
    parType: parType.map(r => `${r.mediaType}=${r.n}`).join(' '),
    parStatut: parStatut.map(r => `${r.isPublished ? 'publie' : 'en_attente'}=${r.n}`).join(' ')
  }
}
const afficherComptages = (label, c) => console.log(`${label} total=${c.total} | ${c.parType} | ${c.parStatut}`)

let adminId = null
let memberId = null
const assetsCloudinary = []

async function creerCompte(email, pseudo, role) {
  const pwd = randomBytes(18).toString('base64url')
  const id = `qa${randomBytes(12).toString('hex')}`
  await db.query(
    'INSERT INTO public.users (id, email, pseudo, password, role, "isActive", "adminScopes", poles, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,true,$6,$7,now(),now())',
    [id, email, pseudo, await hashPassword(pwd), role, [], []]
  )
  return { id, email, pwd }
}

async function login(email, pwd) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: pwd })
  })
  const cookie = (r.headers.getSetCookie?.() ?? []).map(c => c.split(';')[0]).join('; ')
  return { status: r.status, cookie }
}

async function bulk(cookie, body) {
  const r = await fetch(`${BASE}/api/admin/gallery/bulk`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body)
  })
  const texte = await r.text()
  let json = null
  try { json = JSON.parse(texte) } catch { /* non JSON */ }
  return { status: r.status, json, texte: texte.slice(0, 800) }
}

const corpsLot = (surcharge = {}) => ({
  title: MARQUE,
  category: 'QA',
  eventDate: `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`,
  eventTag: null,
  eventId: null,
  imageUrls: [],
  videoUrls: [],
  ...surcharge
})

const tester = async (label, url, range) => {
  try {
    const r = await fetch(url, { headers: range ? { Range: 'bytes=0-1023' } : {}, redirect: 'follow' })
    const b = await r.arrayBuffer()
    const ok = r.status === 200 || r.status === 206
    console.log(`    ${ok ? '✓' : '✗'} ${label} → HTTP ${r.status} ${r.headers.get('content-type')} ${b.byteLength} o`)
    return { ok, status: r.status, type: r.headers.get('content-type'), taille: b.byteLength }
  } catch (e) {
    console.log(`    ✗ ${label} → ERREUR ${e.message}`)
    return { ok: false, erreur: e.message }
  }
}

async function uploader(cookie, nom, octets, type) {
  const fd = new FormData()
  fd.append('file', new Blob([octets], { type }), nom)
  const r = await fetch(`${BASE}/api/cloudinary/upload`, { method: 'POST', headers: { cookie }, body: fd })
  const texte = await r.text()
  let json = null
  try { json = JSON.parse(texte) } catch { /* non JSON */ }
  if (json?.public_id) assetsCloudinary.push(json.public_id)
  console.log(`    upload ${nom} (${type}, ${(octets.length / 1024).toFixed(1)} Ko) → HTTP ${r.status} ${json?.url ?? texte.slice(0, 160)}`)
  return { status: r.status, url: json?.url ?? null, publicId: json?.public_id ?? null, texte: texte.slice(0, 200) }
}

const resultats = []
let avant = null

try {
  // ------------------------------------------------------------
  // [0] État initial + purge des résidus d'un run interrompu
  // ------------------------------------------------------------
  console.log(`\n=== [0] ÉTAT INITIAL (marqueur « ${MARQUE} ») ===`)
  const residus = (await db.query(`SELECT id FROM public.gallery_images WHERE title LIKE 'QA-BULK-MODO %'`)).rows
  if (residus.length) {
    await db.query('DELETE FROM public.gallery_images WHERE id = ANY($1)', [residus.map(r => r.id)])
    console.log(`    résidus d'un run précédent supprimés : ${residus.length}`)
  }
  avant = await comptages()
  afficherComptages('GALERIE AVANT ', avant)

  // ------------------------------------------------------------
  // [1] Sessions réelles (comptes temporaires)
  // ------------------------------------------------------------
  console.log('\n=== [1] SESSIONS ===')
  const stamp = Date.now()
  const admin = await creerCompte(`qa-bulk-interadmin-${stamp}@local.test`, `QA_BulkInterAdmin_${stamp}`, 'INTERMEDIATE_ADMIN')
  adminId = admin.id
  const membre = await creerCompte(`qa-bulk-member-${stamp}@local.test`, `QA_BulkMember_${stamp}`, 'MEMBER')
  memberId = membre.id
  const loginAdmin = await login(admin.email, admin.pwd)
  console.log(`    INTERMEDIATE_ADMIN (temporaire) → login HTTP ${loginAdmin.status} ${loginAdmin.cookie ? '(session ok)' : '(ÉCHEC)'}`)
  if (!loginAdmin.cookie) throw new Error('login admin impossible')
  const loginMembre = await login(membre.email, membre.pwd)
  console.log(`    MEMBER              (temporaire) → login HTTP ${loginMembre.status} ${loginMembre.cookie ? '(session ok)' : '(ÉCHEC)'}`)
  const { rows: modos } = await db.query(`SELECT email, role FROM public.users WHERE role IN ('ADMIN','INTERMEDIATE_ADMIN') AND "isActive" = true`)
  console.log(`    comptes réels de modération en base : ${modos.map(m => `${m.email}(${m.role})`).join(', ')}`)

  // ------------------------------------------------------------
  // [2] Fichiers locaux → Cloudinary (chemin fichier de la page)
  // ------------------------------------------------------------
  console.log('\n=== [2] FICHIERS RÉELS (PNG générés) → Cloudinary ===')
  const pngA = pngReel(64, 64, [210, 40, 40])
  const pngB = pngReel(64, 64, [40, 110, 210])
  const envoiA = await uploader(loginAdmin.cookie, 'qa-bulk-a.png', pngA, 'image/png')
  const envoiB = await uploader(loginAdmin.cookie, 'qa-bulk-b.png', pngB, 'image/png')
  if (!envoiA.url || !envoiB.url) throw new Error('upload Cloudinary des fixtures impossible')
  resultats.push(['T0 fichier réel → Cloudinary', 'POST /api/cloudinary/upload (PNG 64×64 généré)', `A=HTTP ${envoiA.status} ${envoiA.url} | B=HTTP ${envoiB.status} ${envoiB.url}`])

  // ------------------------------------------------------------
  // [3] TEST A — LOT MIXTE RÉEL (images + vidéos, une seule requête)
  // ------------------------------------------------------------
  console.log('\n=== [3] LOT MIXTE RÉEL : dossier d\'images pCloud + 1 image directe + 1 YouTube + 2 dossiers vidéo pCloud ===')
  const lot = corpsLot({
    imageUrls: [FIXTURES.dossierImages, envoiA.url],
    videoUrls: [FIXTURES.youtube, FIXTURES.dossierVideos1, FIXTURES.dossierVideos2]
  })
  console.log(`    envoyé → ${lot.imageUrls.length} lien(s) image, ${lot.videoUrls.length} lien(s) vidéo`)
  console.log(`      imageUrls : ${lot.imageUrls.join('\n                  ')}`)
  console.log(`      videoUrls : ${lot.videoUrls.join('\n                  ')}`)
  const rA = await bulk(loginAdmin.cookie, lot)
  console.log(`    POST /api/admin/gallery/bulk → HTTP ${rA.status}`)
  console.log(`    corps : ${JSON.stringify(rA.json ?? rA.texte)}`)
  resultats.push(['T1 lot mixte images+vidéos', 'POST /api/admin/gallery/bulk', `HTTP ${rA.status} created=${rA.json?.created} rejected=${rA.json?.rejected} errors=${JSON.stringify(rA.json?.errors ?? [])}`])

  const lireLot = async () => (await db.query(
    'SELECT id, "mediaType", "isPublished", "youtubeId", url, "sourceUrl" FROM public.gallery_images WHERE title = $1 ORDER BY "mediaType", url',
    [MARQUE]
  )).rows
  const crees = await lireLot()
  console.log(`    lignes créées en base (SQL) : ${crees.length}`)
  for (const r of crees) console.log(`      ${r.mediaType.padEnd(13)} pub=${r.isPublished} yt=${r.youtubeId ?? '-'} url=${r.url.slice(0, 120)}`)
  console.log(`    images=${crees.filter(r => r.mediaType === 'IMAGE').length} | vidéos=${crees.filter(r => r.mediaType === 'VIDEO').length} | youtube=${crees.filter(r => r.mediaType === 'YOUTUBE_VIDEO').length}`)
  const apresA = await comptages()
  afficherComptages('GALERIE APRÈS  ', apresA)
  const imagesStables = crees.filter(r => r.mediaType === 'IMAGE' && /u\.pcloud\.link\/publink/i.test(r.url)).length
  const imagesDirectes = crees.filter(r => r.mediaType === 'IMAGE' && /^https?:\/\/p-lux\d*\.pcloud\.com/i.test(r.url)).length
  console.log(`    forme stockée des images de dossier → publink#f= : ${imagesStables} | lien direct pCloud (fragile) : ${imagesDirectes}`)

  // ------------------------------------------------------------
  // [4] STOCKAGE RÉEL : le média doit être servi (proxy inclus)
  // ------------------------------------------------------------
  console.log('\n=== [4] STOCKAGE : accès réel aux octets ===')
  const imageRow = crees.find(r => r.mediaType === 'IMAGE' && /pcloud/i.test(r.url))
  const imageDirecte = crees.find(r => r.mediaType === 'IMAGE' && /cloudinary/i.test(r.url))
  const videoRow = crees.find(r => r.mediaType === 'VIDEO')
  const ytRow = crees.find(r => r.mediaType === 'YOUTUBE_VIDEO')
  const proxy = (url, type) => `${BASE}/api/media/proxy?url=${encodeURIComponent(url)}&type=${type}`
  let stockageOk = true
  if (imageRow) stockageOk = (await tester('image pCloud via /api/media/proxy', proxy(imageRow.url, 'IMAGE'))).ok && stockageOk
  if (imageDirecte) stockageOk = (await tester('image directe (Cloudinary)', imageDirecte.url)).ok && stockageOk
  if (videoRow) stockageOk = (await tester('vidéo pCloud via /api/media/proxy (Range)', proxy(videoRow.url, 'VIDEO'), true)).ok && stockageOk
  if (videoRow) stockageOk = (await tester('vidéo pCloud via /api/media/proxy-video', `${BASE}/api/media/proxy-video?url=${encodeURIComponent(videoRow.url)}`, true)).ok && stockageOk
  if (ytRow) await tester('vignette YouTube du média importé', `https://i.ytimg.com/vi/${ytRow.youtubeId}/hqdefault.jpg`)
  resultats.push(['T2 stockage réellement servi', 'GET /api/media/proxy (image + vidéo), GET image directe', stockageOk ? 'tous les médias répondent 200/206' : 'AU MOINS UN ÉCHEC (voir détail)'])

  // ------------------------------------------------------------
  // [5] AFFICHAGE dans la page de modération (HTML rendu, session admin)
  // ------------------------------------------------------------
  console.log('\n=== [5] AFFICHAGE /dashboard-moderation (HTML rendu, SSR) ===')
  const page = await fetch(`${BASE}/dashboard-moderation`, { headers: { cookie: loginAdmin.cookie }, redirect: 'follow' })
  const html = await page.text()
  const occurrences = (html.match(/QA-BULK-MODO/g) || []).length
  console.log(`    GET /dashboard-moderation → HTTP ${page.status} (${html.length} o)`)
  console.log(`    occurrences du titre du lot dans le HTML : ${occurrences}`)
  const badges = ['Vidéo YouTube', 'Vidéo', 'Image', 'Approuvé', 'En attente']
  for (const b of badges) console.log(`      « ${b} » présent : ${html.includes(b)}`)
  console.log(`    URL de proxy média présente dans le HTML : ${html.includes('/api/media/proxy')}`)
  const extrait = html.match(/.{0,100}QA-BULK-MODO.{0,220}/s)
  if (extrait) console.log(`    extrait HTML : …${extrait[0].replace(/\s+/g, ' ')}…`)
  const typesAffiches = ['Image', 'Vidéo', 'Vidéo YouTube'].filter(b => html.includes(b))
  resultats.push(['T3 affichage page modération', 'GET /dashboard-moderation (SSR, session admin)', `HTTP ${page.status}, ${occurrences} occurrence(s) du titre, badges=${typesAffiches.join('/')}`])

  // ------------------------------------------------------------
  // [6] CAS LIMITES
  // ------------------------------------------------------------
  console.log('\n=== [6] CAS LIMITES ===')

  console.log('\n  [6a] lot partiellement invalide : 2 valides + 3 invalides')
  const rB = await bulk(loginAdmin.cookie, corpsLot({
    imageUrls: [envoiB.url, FIXTURES.publinkInexistant, FIXTURES.lienMort, FIXTURES.lienNonMedia],
    videoUrls: [FIXTURES.youtube2]
  }))
  console.log(`    envoyé : imageUrls=[image valide, publink vide, lien mort, PDF] videoUrls=[YouTube 2]`)
  console.log(`    → HTTP ${rB.status} corps : ${JSON.stringify(rB.json ?? rB.texte)}`)
  const creesB = (await lireLot()).filter(r => r.url.includes('qa-bulk-b') || r.url.includes('9bZkp7q19f0'))
  console.log(`    lignes créées pour ce lot : ${creesB.map(r => `${r.mediaType}:${r.url.slice(0, 60)}`).join(' | ') || 'aucune'}`)
  resultats.push(['T4 lot partiellement invalide', 'POST /bulk (2 valides + 3 invalides)', `HTTP ${rB.status} created=${rB.json?.created} rejected=${rB.json?.rejected} erreurs=${JSON.stringify(rB.json?.errors ?? [])}`])

  console.log('\n  [6b] vidéo collée dans la zone Images : .mp4 inconnu puis vrai YouTube')
  const rC1 = await bulk(loginAdmin.cookie, corpsLot({ imageUrls: [FIXTURES.clipMp4], videoUrls: [] }))
  console.log(`    .mp4 inconnu → HTTP ${rC1.status} ${JSON.stringify(rC1.json ?? rC1.texte)}`)
  const rC2 = await bulk(loginAdmin.cookie, corpsLot({ imageUrls: [FIXTURES.youtube3], videoUrls: [] }))
  console.log(`    YouTube dans la zone Images → HTTP ${rC2.status} ${JSON.stringify(rC2.json ?? rC2.texte)}`)
  const creesC = (await lireLot()).filter(r => r.url.includes('clip.mp4') || r.url.includes('dQw4w9WgXcQ'))
  for (const r of creesC) console.log(`      ligne créée : ${r.mediaType} (isVideo=${r.mediaType !== 'IMAGE'}) ${r.url.slice(0, 70)}`)
  const phantomImage = creesC.filter(r => r.url.includes('clip.mp4') && r.mediaType === 'IMAGE').length
  console.log(`    « photo » fantôme créée pour un .mp4 : ${phantomImage}${phantomImage ? ' (KO)' : ' (OK : refusée)'}`)
  resultats.push(['T5 vidéo dans la zone Images', 'POST /bulk imageUrls=[clip.mp4] puis [youtu.be]', `.mp4:HTTP ${rC1.status} created=${rC1.json?.created} rejected=${rC1.json?.rejected} | YouTube:HTTP ${rC2.status} created=${rC2.json?.created} type=${creesC.find(r => r.url.includes('dQw4w9WgXcQ'))?.mediaType ?? '-'}`])

  console.log('\n  [6c] doublon : mêmes liens qu\'au test A réimportés')
  const rD = await bulk(loginAdmin.cookie, corpsLot({ imageUrls: [envoiA.url], videoUrls: [FIXTURES.youtube] }))
  console.log(`    → HTTP ${rD.status} corps : ${JSON.stringify(rD.json ?? rD.texte)}`)
  const doublonImage = (await lireLot()).filter(r => r.mediaType === 'IMAGE' && r.url === envoiA.url).length
  console.log(`    lignes en base pour l'image déjà importée : ${doublonImage} (2+ = doublon silencieux, 1 = refus explicite)`)
  resultats.push(['T6 média déjà importé (doublon)', 'POST /bulk (même image + même YouTube)', `HTTP ${rD.status} created=${rD.json?.created} rejected=${rD.json?.rejected} copies_image=${doublonImage} erreurs=${JSON.stringify(rD.json?.errors ?? [])}`])

  console.log('\n  [6d] limite de lot : 205 liens dans une seule entrée')
  const liens205 = Array.from({ length: 205 }, (_, i) => `https://exemple-qa.invalid/limite-${i}.jpg`).join('\n')
  const rE = await bulk(loginAdmin.cookie, corpsLot({ imageUrls: [liens205], videoUrls: [] }))
  console.log(`    → HTTP ${rE.status} corps : ${(JSON.stringify(rE.json ?? rE.texte)).slice(0, 300)}`)
  resultats.push(['T7 limite de lot (200)', 'POST /bulk (205 liens en 1 entrée)', `HTTP ${rE.status} created=${rE.json?.created} rejected=${rE.json?.rejected}`])

  console.log('\n  [6e] fichier local refusé : > 5 Mo / vidéo / texte (POST /api/cloudinary/upload)')
  const envoiGros = await uploader(loginAdmin.cookie, 'trop-gros.png', Buffer.concat([pngReel(8, 8, [1, 2, 3]), Buffer.alloc(6 * 1024 * 1024)]), 'image/png')
  const envoiMp4 = await uploader(loginAdmin.cookie, 'clip.mp4', Buffer.concat([Buffer.from('00000018667479706d703432', 'hex'), Buffer.alloc(2048)]), 'video/mp4')
  const envoiTxt = await uploader(loginAdmin.cookie, 'note.txt', Buffer.from('pas une image'), 'text/plain')
  resultats.push(['T8 fichier refusé (taille/type)', 'POST /api/cloudinary/upload', `6 Mo→HTTP ${envoiGros.status} | mp4→HTTP ${envoiMp4.status} | txt→HTTP ${envoiTxt.status}`])

  console.log('\n  [6f] import sans droits')
  const rF = await bulk(null, corpsLot({ imageUrls: [envoiB.url] }))
  console.log(`    anonyme → HTTP ${rF.status} ${rF.texte.slice(0, 110)}`)
  const rG = await bulk(loginMembre.cookie, corpsLot({ imageUrls: [envoiB.url] }))
  console.log(`    MEMBER  → HTTP ${rG.status} ${rG.texte.slice(0, 110)}`)
  resultats.push(['T9 import sans droits', 'POST /bulk sans cookie / cookie MEMBER', `anonyme=HTTP ${rF.status} | MEMBER=HTTP ${rG.status}`])

  console.log(`\n    (ni l'import anonyme ni celui du MEMBER ne doit avoir créé de ligne)`)

  // ------------------------------------------------------------
  // [7] NETTOYAGE
  // ------------------------------------------------------------
  console.log('\n=== [7] NETTOYAGE (DELETE /api/admin/gallery/:id) ===')
  const aSupprimer = (await db.query(`SELECT id FROM public.gallery_images WHERE title LIKE 'QA-BULK-MODO %'`)).rows
  let supprimes = 0
  for (const m of aSupprimer) {
    const r = await fetch(`${BASE}/api/admin/gallery/${m.id}`, { method: 'DELETE', headers: { cookie: loginAdmin.cookie } })
    if (r.status === 200) supprimes += 1
    else console.log(`    ✗ DELETE ${m.id} → HTTP ${r.status}`)
  }
  console.log(`    DELETE via l'API réussis : ${supprimes}/${aSupprimer.length}`)
  console.log(`    médias du lot encore en base : ${(await db.query(`SELECT count(*)::int n FROM public.gallery_images WHERE title LIKE 'QA-BULK-MODO %'`)).rows[0].n}`)

  for (const publicId of assetsCloudinary) {
    const r = await fetch(`${BASE}/api/cloudinary/delete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: loginAdmin.cookie },
      body: JSON.stringify({ public_id: publicId, resource_type: 'image' })
    })
    console.log(`    suppression de l'image Cloudinary ${publicId} → HTTP ${r.status}`)
  }
} catch (e) {
  console.log(`\n❌ ERREUR DU TEST : ${e.message}`)
} finally {
  try {
    const purge = await db.query(`DELETE FROM public.gallery_images WHERE title LIKE 'QA-BULK-MODO %' RETURNING id`)
    if (purge.rowCount) console.log(`    (sécurité) médias du lot supprimés en SQL : ${purge.rowCount}`)
  } catch (e) { console.log('    (sécurité) purge SQL impossible :', e.message) }
  try {
    for (const id of [adminId, memberId].filter(Boolean)) {
      await db.query('DELETE FROM public.sessions WHERE "userId" = $1', [id])
      await db.query('DELETE FROM public.users WHERE id = $1', [id])
    }
    console.log('    comptes temporaires supprimés')
  } catch (e) { console.log('    nettoyage comptes :', e.message) }

  const apres = await comptages()
  console.log('\n=== COMPTAGES FINAUX ===')
  afficherComptages('GALERIE FINALE', apres)
  if (avant) {
    console.log(`    identique à l'état initial : ${avant.total === apres.total && avant.parType === apres.parType && avant.parStatut === apres.parStatut ? 'OUI' : 'NON'}`)
  }
  console.log(`    résidus de test en galerie : ${(await db.query(`SELECT count(*)::int n FROM public.gallery_images WHERE title LIKE 'QA-BULK-MODO %'`)).rows[0].n}`)
  console.log(`    comptes de test restants : ${(await db.query(`SELECT count(*)::int n FROM public.users WHERE email LIKE 'qa-bulk-%@local.test'`)).rows[0].n}`)
  console.log(`    images Cloudinary créées : ${assetsCloudinary.length} (supprimées ci-dessus)`)

  console.log('\n=== TABLEAU DES CAS (cas | commande | résultat brut) ===')
  for (const [cas, cmd, res] of resultats) console.log(`- ${cas} | ${cmd} | ${res}`)

  await db.end()
}
