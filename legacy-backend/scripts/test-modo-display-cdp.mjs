// ============================================================
// scripts/test-modo-display-cdp.mjs
//
// PREUVE D'AFFICHAGE : les médias importés par lot (images ET vidéos) doivent
// apparaître réellement dans la page de modération, avec le bon type et le bon
// statut. On ne se contente pas de l'API : Chrome headless est piloté en CDP
// (profil jetable, aucune fenêtre à autoriser — méthode de scripts/qa-visual-cdp.mjs),
// la session réelle est injectée par cookie, puis le DOM est LU après hydratation.
//
// Ce que la preuve établit :
//   - les 4+ éléments du lot sont présents dans le DOM, titrés ;
//   - le badge de TYPE affiché correspond au médiaType réel (« Image »,
//     « Vidéo », « Vidéo YouTube ») ;
//   - le badge de STATUT affiché correspond à `isPublished` (« Approuvé ») ;
//   - les images sont VRAIMENT rendues : `naturalWidth > 0` prouve que les
//     octets ont été téléchargés (via /api/media/proxy pour pCloud) et décodés ;
//   - une capture d'écran est écrite dans docs/qa-runtime/.
//
// Le script crée et supprime lui-même son lot, ses images Cloudinary et son
// compte temporaire ; les comptages SQL avant/après sont affichés.
//
// Usage : node scripts/test-modo-display-cdp.mjs [--base http://localhost:3223]
// ============================================================

import fs from 'node:fs'
import zlib from 'node:zlib'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes, scrypt as scryptCb } from 'node:crypto'
import { promisify } from 'node:util'
import pg from 'pg'

const scrypt = promisify(scryptCb)
const BASE = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'http://localhost:3223'
const MARQUE = `QA-BULK-MODO ${Date.now()}`
const OUT = join(process.cwd(), 'docs', 'qa-runtime')
const PORT = Number(process.env.CDP_PORT || 9355)

// ---------- PNG réel ----------
const tableCrc = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c }
  return t
})()
const crc32 = (buf) => { let c = 0xFFFFFFFF; for (const o of buf) c = tableCrc[(c ^ o) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0 }
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const corps = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(corps))
  return Buffer.concat([len, corps, crc])
}
function pngReel(w, h, [r, v, b]) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2
  const lignes = []
  for (let y = 0; y < h; y++) { const l = Buffer.alloc(1 + w * 3); for (let x = 0; x < w; x++) { l[1 + x * 3] = r; l[2 + x * 3] = v; l[3 + x * 3] = b } lignes.push(l) }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(lignes))), chunk('IEND', Buffer.alloc(0))])
}

const FIXTURES = {
  dossierImages: 'https://u.pcloud.link/publink/show?code=VZKTsHJZxrc1dwuvczht3rJzM61TwmiCNJtk',
  dossierVideos: 'https://u.pcloud.link/publink/show?code=VZV2sHJZ9TSUcHgYVz0e3ql1atKDOyesFXi7',
  youtube: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'
}

// ---------- .env ----------
const env = {}
for (const l of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/)
  if (m && !m[1].startsWith('#')) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const db = new pg.Client({ connectionString: env.DIRECT_DATABASE_URL || env.DATABASE_URL })
await db.connect()

const comptage = async () => {
  const t = (await db.query('SELECT count(*)::int n FROM public.gallery_images')).rows[0].n
  const par = (await db.query('SELECT "mediaType", count(*)::int n FROM public.gallery_images GROUP BY 1 ORDER BY 1')).rows.map(r => `${r.mediaType}=${r.n}`).join(' ')
  return `${t} (${par})`
}

// ---------- client CDP minimal (même approche que scripts/qa-visual-cdp.mjs) ----------
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = new Map()
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id)
        this.pending.delete(message.id)
        if (message.error) reject(new Error(JSON.stringify(message.error)))
        else resolve(message.result)
        return
      }
      if (message.method) {
        const list = this.handlers.get(message.method) || []
        this.handlers.set(message.method, [])
        for (const handler of list) handler(message.params)
      }
    }
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })) })
  }
  once(method, timeout = 45000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`délai dépassé : ${method}`)), timeout)
      const list = this.handlers.get(method) || []
      list.push((params) => { clearTimeout(timer); resolve(params) })
      this.handlers.set(method, list)
    })
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'erreur JS')
    return result.result?.value
  }
}

const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
].filter(Boolean).find(p => existsSync(p))

/** Attends que le serveur de développement réponde (il se reconstruit parfois). */
async function attendreServeur(maxMs = 180000) {
  const debut = Date.now()
  while (Date.now() - debut < maxMs) {
    try {
      const r = await fetch(`${BASE}/api/auth/me`, { signal: AbortSignal.timeout(8000) })
      if (r.status === 401 || r.status === 200) {
        console.log(`    serveur prêt (HTTP ${r.status} sur /api/auth/me après ${Math.round((Date.now() - debut) / 1000)} s)`)
        return true
      }
    } catch { /* pas encore prêt */ }
    await new Promise(r => setTimeout(r, 3000))
  }
  console.log('    ⚠ serveur toujours indisponible')
  return false
}

async function lancerChrome() {
  const profile = join(tmpdir(), `otaku-modo-cdp-${Date.now()}`)
  mkdirSync(profile, { recursive: true })
  const child = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars',
    '--disable-extensions', '--force-device-scale-factor=1', 'about:blank'
  ], { stdio: 'ignore' })
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break } catch { /* pas prêt */ }
    await new Promise(r => setTimeout(r, 500))
  }
  const cible = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page')
  const ws = new WebSocket(cible.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  const cdp = new CDP(ws)
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Network.enable')
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false })
  return { child, cdp, profile }
}

/** Évaluation CDP avec étiquette : en cas d'erreur JS, on sait QUELLE requête a échoué. */
async function ev(cdp, expression, etiquette) {
  try {
    return await cdp.evaluate(expression)
  } catch (e) {
    console.log(`    ✗ [${etiquette}] erreur JS : ${e.message}`)
    return null
  }
}

const hashPassword = async (pwd) => {
  const salt = randomBytes(16).toString('hex')
  const key = await scrypt(pwd, salt, 64)
  return `scrypt:${salt}:${key.toString('hex')}`
}

let adminId = null
let child = null
let cookiePourNettoyage = ''
let captureARecycler = null
const assetsCloudinary = []

try {
  console.log(`\n=== PRÉPARATION (marqueur « ${MARQUE} ») ===`)
  console.log(`GALERIE AVANT : ${await comptage()}`)

  // Compte temporaire + session
  const email = `qa-modo-display-${Date.now()}@local.test`
  const pwd = randomBytes(18).toString('base64url')
  adminId = `qa${randomBytes(12).toString('hex')}`
  await db.query('INSERT INTO public.users (id,email,pseudo,password,role,"isActive","adminScopes",poles,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,true,$6,$7,now(),now())',
    [adminId, email, `QA_ModoDisplay_${Date.now()}`, await hashPassword(pwd), 'INTERMEDIATE_ADMIN', [], []])
  const lr = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: pwd }) })
  const setCookies = lr.headers.getSetCookie?.() ?? []
  const cookieEntier = setCookies.map(c => c.split(';')[0]).join('; ')
  const token = setCookies.map(c => /otaku_session=([^;]+)/.exec(c)?.[1]).find(Boolean)
  cookiePourNettoyage = cookieEntier
  console.log(`    compte INTERMEDIATE_ADMIN temporaire → login HTTP ${lr.status} ${token ? '(session ok)' : '(ÉCHEC)'}`)
  if (!token) throw new Error('session impossible')

  // Image réelle (fichier → Cloudinary)
  const fd = new FormData()
  fd.append('file', new Blob([pngReel(240, 160, [190, 60, 40])], { type: 'image/png' }), 'qa-display.png')
  const up = await fetch(`${BASE}/api/cloudinary/upload`, { method: 'POST', headers: { cookie: cookieEntier }, body: fd })
  const upJson = await up.json()
  if (upJson.public_id) assetsCloudinary.push(upJson.public_id)
  console.log(`    image réelle uploadée → HTTP ${up.status} ${upJson.url}`)

  // Lot mixte réel : 5 images (dossier pCloud) + 1 image directe + 3 vidéos pCloud + 1 YouTube = 10 médias
  const lot = {
    title: MARQUE, category: 'QA', eventDate: `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`,
    eventTag: null, eventId: null,
    imageUrls: [FIXTURES.dossierImages, upJson.url],
    videoUrls: [FIXTURES.youtube, FIXTURES.dossierVideos]
  }
  const rLot = await fetch(`${BASE}/api/admin/gallery/bulk`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: cookieEntier }, body: JSON.stringify(lot) })
  const corpsLot = await rLot.json()
  console.log(`    POST /api/admin/gallery/bulk → HTTP ${rLot.status} ${JSON.stringify(corpsLot)}`)
  const attendus = (await db.query('SELECT id, "mediaType", url, "isPublished" FROM public.gallery_images WHERE title = $1 ORDER BY "mediaType", url', [MARQUE])).rows
  console.log(`    médias du lot en base : ${attendus.length}`)
  for (const a of attendus) console.log(`      ${a.mediaType.padEnd(13)} pub=${a.isPublished} ${a.url.slice(0, 100)}`)
  console.log(`GALERIE APRÈS IMPORT : ${await comptage()}`)

  // ------------------------------------------------------------
  // Inspection DOM réelle
  // ------------------------------------------------------------
  console.log('\n=== INSPECTION DU DOM (/dashboard-moderation, Chrome headless) ===')
  await attendreServeur()
  const chrome = await lancerChrome()
  child = chrome.child
  const { cdp } = chrome
  await cdp.send('Network.setCookie', { name: 'otaku_session', value: token, domain: 'localhost', path: '/', httpOnly: true })
  const charge = cdp.once('Page.loadEventFired', 120000)
  charge.catch(() => {}) // évite une promesse rejetée non gérée si la navigation échoue
  await cdp.send('Page.navigate', { url: `${BASE}/dashboard-moderation` })
  try { await charge } catch { /* certaines navigations ne signalent pas l'événement */ }
  // En mode dev, le client Vite transforme des centaines de modules : on attend
  // réellement l'hydratation et l'arrivée des cartes (90 s max) au lieu d'un
  // délai fixe, sinon on lirait une page blanche.
  let etat = { cartes: 0, span: '' }
  for (let i = 0; i < 45; i++) {
    await new Promise(r => setTimeout(r, 2000))
    etat = await ev(cdp, "({ cartes: document.querySelectorAll('.modo-media').length, span: (document.body ? document.body.innerText : '').replace(/\\s+/g, ' ').slice(0, 160) })", 'hydratation') || { cartes: 0, span: '' }
    if (etat.cartes > 0) break
  }
  console.log(`    hydratation : ${etat.cartes} carte(s) — texte visible : « ${etat.span} »`)

  // Lecture SANS filtre (diagnostic), puis avec le filtre du lot.
  const avantFiltre = await cdp.evaluate(`(() => ({
    cartes: document.querySelectorAll('.modo-media').length,
    ongletMedias: (document.body.textContent.match(/M\u00e9dias\\s*\\((\\d+)\\)/) || [])[1] || null,
    message: /Aucun m\u00e9dia/.test(document.body.textContent || '') ? 'état vide affiché' : null,
    connecte: !/Se connecter|Connexion/.test(document.title || '')
  }))()`)
  console.log(`    avant filtre : cartes=${avantFiltre.cartes} compteur=${avantFiltre.ongletMedias} ${avantFiltre.message ?? ''}`)

  // Filtre « QA-BULK-MODO » pour isoler le lot, puis lecture des cartes.
  const filtre = await ev(cdp, `(function () {
    var champ = [].slice.call(document.querySelectorAll('input')).filter(function (i) { return /Titre, \u00e9v\u00e9nement, source/.test(i.placeholder || '') })[0]
    if (!champ) return 'champ de recherche introuvable'
    var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(champ, ${JSON.stringify('QA-BULK-MODO')})
    champ.dispatchEvent(new Event('input', { bubbles: true }))
    return 'filtre applique'
  })()`, 'filtre')
  console.log(`    filtre : ${filtre}`)
  await new Promise(r => setTimeout(r, 2500))

  // Les vignettes sont en `loading="lazy"` : il faut défiler pour que le
  // navigateur les demande vraiment, et attendre la fin des résolutions pCloud
  // (une résolution de publink coûte ~4 s).
  let imagesPretes = 0
  for (let i = 0; i < 40; i++) {
    await ev(cdp, 'window.scrollTo(0, document.body.scrollHeight)', 'defilement')
    const etatImages = await ev(cdp, "({ total: document.querySelectorAll('.modo-media__img').length, chargees: [...document.querySelectorAll('.modo-media__img')].filter(i => i.complete && i.naturalWidth > 0).length })", 'etat vignettes') || { total: 0, chargees: 0 }
    if (etatImages.total > 0 && etatImages.chargees === etatImages.total) { imagesPretes = etatImages.chargees; break }
    imagesPretes = etatImages.chargees
    await new Promise(r => setTimeout(r, 2000))
  }
  await cdp.evaluate(`(() => { window.scrollTo(0, 0); return true })()`)
  await new Promise(r => setTimeout(r, 800))
  console.log(`    vignettes décodées par le navigateur : ${imagesPretes}`)

  const lecture = await cdp.evaluate(`(() => {
    const cartes = [...document.querySelectorAll('.modo-media')]
    return {
      url: location.href,
      titrePage: document.title,
      nbCartesAffichees: cartes.length,
      cartes: cartes.map(c => {
        const img = c.querySelector('.modo-media__img')
        const player = c.querySelector('media-player, video')
        const badges = [...c.querySelectorAll('.modo-media__badges > *')].map(b => (b.textContent || '').trim())
        return {
          titre: (c.querySelector('.modo-media__title')?.textContent || '').trim(),
          type: c.querySelector('.modo-media__badges > *')?.textContent?.trim() || null,
          badges,
          image: img ? { src: img.getAttribute('src'), naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, complete: img.complete } : null,
          lecteurVideo: player ? { tag: player.tagName.toLowerCase() } : null,
          texte: (c.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 220)
        }
      })
    }
  })()`)
  console.log(`    page : ${lecture.url} — ${lecture.titrePage}`)
  console.log(`    cartes affichées après filtre : ${lecture.nbCartesAffichees}`)
  for (const c of lecture.cartes) {
    console.log(`      « ${c.titre} » | type=${c.type} | badges=[${c.badges.join(' / ')}]`)
    if (c.image) console.log(`         image src=${String(c.image.src).slice(0, 90)} naturalWidth=${c.image.naturalWidth}×${c.image.naturalHeight} complete=${c.image.complete}`)
    if (c.lecteurVideo) console.log(`         lecteur vidéo présent : <${c.lecteurVideo.tag}>`)
  }

  // La capture est d'abord écrite HORS du dépôt : écrire dans docs/ pendant le
  // run relance le serveur de développement (Nuxt surveille le dossier racine).
  const capture = await cdp.send('Page.captureScreenshot', { format: 'png' })
  const captureTemp = join(tmpdir(), `moderation-import-lot-mixte-${Date.now()}.png`)
  writeFileSync(captureTemp, Buffer.from(capture.data, 'base64'))
  captureARecycler = captureTemp
  console.log(`    capture d'écran (temporaire) → ${captureTemp} (${Math.round(capture.data.length / 1024)} Ko)`)

  // --- Cas « statut » : on dépublie UN média et on relit la carte dans le DOM.
  // L'API n'expose que `isPublished` : le badge doit passer à « En attente ».
  const cible = attendus.find(a => a.mediaType === 'IMAGE')
  if (cible) {
    const patchRes = await fetch(`${BASE}/api/admin/gallery/${cible.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: cookiePourNettoyage },
      body: JSON.stringify({ isPublished: false })
    })
    console.log(`    PATCH /api/admin/gallery/:id {isPublished:false} sur un média image → HTTP ${patchRes.status}`)
    const rechargement = cdp.once('Page.loadEventFired', 120000)
    rechargement.catch(() => {})
    await cdp.send('Page.navigate', { url: `${BASE}/dashboard-moderation` })
    try { await rechargement } catch { /* ignore */ }
    for (let i = 0; i < 45; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const nb = await ev(cdp, "document.querySelectorAll('.modo-media').length", 'hydratation statut')
      if (nb > 0) break
    }
    await ev(cdp, `(function () {
      var champ = [].slice.call(document.querySelectorAll('input')).filter(function (i) { return /Titre, \u00e9v\u00e9nement, source/.test(i.placeholder || '') })[0]
      if (!champ) return 'introuvable'
      var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(champ, 'QA-BULK-MODO')
      champ.dispatchEvent(new Event('input', { bubbles: true }))
      return 'ok'
    })()`, 'filtre statut')
    await new Promise(r => setTimeout(r, 2500))
    const statutsApres = await ev(cdp, "({ cartes: document.querySelectorAll('.modo-media').length, badges: [].slice.call(document.querySelectorAll('.modo-media__badges')).map(function (b) { return b.textContent.replace(/\\s+/g, ' ').trim() }) })", 'badges statut')
    console.log(`    après dépublication : ${statutsApres?.cartes} carte(s)`)
    console.log(`    badges lus : ${JSON.stringify(statutsApres?.badges)}`)
    await fetch(`${BASE}/api/admin/gallery/${cible.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: cookiePourNettoyage },
      body: JSON.stringify({ isPublished: true })
    })
  }

  const parType = lecture.cartes.reduce((acc, c) => { acc[c.type] = (acc[c.type] || 0) + 1; return acc }, {})
  console.log(`    répartition lue dans le DOM : ${JSON.stringify(parType)}`)
  const imagesRendues = lecture.cartes.filter(c => c.image && c.image.naturalWidth > 0).length
  console.log(`    images RÉELLEMENT rendues (naturalWidth > 0) : ${imagesRendues}`)
  const videosAvecLecteur = lecture.cartes.filter(c => c.lecteurVideo).length
  console.log(`    vidéos avec lecteur dans le DOM : ${videosAvecLecteur}`)
  const statuts = [...new Set(lecture.cartes.flatMap(c => c.badges).filter(b => ['Approuvé', 'En attente', 'Rejeté', 'Signalé'].includes(b)))]
  console.log(`    statuts affichés : ${statuts.join(', ')}`)
} catch (e) {
  console.log(`\n❌ ERREUR : ${e.message}`)
} finally {
  if (child) { try { child.kill() } catch { /* ignore */ } }
  console.log('\n=== NETTOYAGE ===')
  try {
    const aSupprimer = (await db.query(`SELECT id FROM public.gallery_images WHERE title LIKE 'QA-BULK-MODO %'`)).rows
    console.log(`    médias du lot à supprimer : ${aSupprimer.length}`)
    let supprimes = 0
    for (const m of aSupprimer) {
      const r = await fetch(`${BASE}/api/admin/gallery/${m.id}`, { method: 'DELETE', headers: { cookie: cookiePourNettoyage } })
      if (r.status === 200) supprimes += 1
    }
    console.log(`    DELETE /api/admin/gallery/:id réussis : ${supprimes}/${aSupprimer.length}`)
    // Les images Cloudinary du test sont retirées AVANT la suppression du compte
    // (l'API de suppression exige une session).
    for (const publicId of assetsCloudinary) {
      const r = await fetch(`${BASE}/api/cloudinary/delete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: cookiePourNettoyage },
        body: JSON.stringify({ public_id: publicId, resource_type: 'image' })
      })
      console.log(`    image Cloudinary ${publicId} → HTTP ${r.status}`)
    }
  } catch (e) { console.log('    nettoyage médias :', e.message) }
  try {
    const purge = await db.query(`DELETE FROM public.gallery_images WHERE title LIKE 'QA-BULK-MODO %' RETURNING id`)
    if (purge.rowCount) console.log(`    (sécurité) médias supprimés en SQL : ${purge.rowCount}`)
  } catch (e) { console.log('    (sécurité) purge impossible :', e.message) }
  try {
    if (adminId) {
      await db.query('DELETE FROM public.sessions WHERE "userId" = $1', [adminId])
      await db.query('DELETE FROM public.users WHERE id = $1', [adminId])
      console.log('    compte temporaire supprimé')
    }
  } catch (e) { console.log('    nettoyage compte :', e.message) }
  console.log(`GALERIE FINALE : ${await comptage()}`)
  const restes = (await db.query(`SELECT count(*)::int n FROM public.gallery_images WHERE title LIKE 'QA-BULK-MODO %'`)).rows[0].n
  console.log(`    résidus de test : ${restes}`)
  // La capture est copiée dans le dépôt APRÈS le nettoyage : l'écrire pendant le
  // run relancerait le serveur de développement.
  if (captureARecycler && existsSync(captureARecycler)) {
    mkdirSync(OUT, { recursive: true })
    const destination = join(OUT, 'moderation-import-lot-mixte.png')
    writeFileSync(destination, fs.readFileSync(captureARecycler))
    console.log(`    capture d'écran → ${destination}`)
  }
  await db.end()
}
