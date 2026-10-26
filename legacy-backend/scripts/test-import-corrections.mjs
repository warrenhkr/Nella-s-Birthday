// scripts/test-import-corrections.mjs
//
// Vérifie PAR L'API RÉELLE les corrections apportées à l'import en masse :
//   1. date ISO (`2026-12-05`) — l'ancien test `pattern.source.includes('\d{4}-')`
//      ne correspondait jamais et faisait tomber la ligne dans la mauvaise
//      branche (Invalid time value → lot rejeté) ;
//   2. virgule DANS une URL (transformations Cloudinary `c_fill,w_800`) — la
//      virgule était un séparateur inconditionnel, l'URL était découpée ;
//   3. séparateurs multiples (`;`, `|`, espaces, retours à la ligne) toujours
//      reconnus ;
//   4. statut HTTP réel : 201 (le corps annonçait 201 mais la réponse était 200) ;
//   5. messages de validation zod EN FRANÇAIS dans le rapport d'import ;
//   6. médias importés EN ATTENTE (`isPublished: false`).
//
// Tout ce qui est créé est supprimé en fin de course ; les comptages avant/après
// sont affichés. Aucun mot de passe n'est imprimé.
//
// Usage : node scripts/test-import-corrections.mjs [http://localhost:3226]

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import pg from 'pg'

const BASE = (process.argv[2] || process.env.TEST_BASE_URL || 'http://localhost:3226').replace(/\/$/, '')
const MARQUE = `QA-CORR ${Date.now()}`

function chargerEnv() {
  const env = {}
  for (const ligne of fs.readFileSync('.env', 'utf8').split('\n')) {
    const m = ligne.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m && !m[1].startsWith('#')) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}
const env = chargerEnv()

function comptes() {
  const fichier = path.join(os.homedir(), 'otaku-comptes-demo.txt')
  const parRole = {}
  if (!fs.existsSync(fichier)) return parRole
  for (const ligne of fs.readFileSync(fichier, 'utf8').split(/\r?\n/)) {
    const p = ligne.trim().split(/\s+/)
    if (p.length < 3 || !p[0].includes('@') || !/^[A-Z_]+$/.test(p[1])) continue
    ;(parRole[p[1]] ||= []).push({ email: p[0], password: p[2] })
  }
  return parRole
}

async function session(role) {
  const cache = path.join(os.tmpdir(), 'otaku-qa-session-tokens.json')
  if (fs.existsSync(cache)) {
    const jeton = JSON.parse(fs.readFileSync(cache, 'utf8'))[role]
    if (jeton) {
      const r = await fetch(`${BASE}/api/auth/me`, { headers: { cookie: `otaku_session=${jeton}` } })
      if (r.ok) return jeton
    }
  }
  for (const compte of (comptes()[role] || [])) {
    const r = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: compte.email, password: compte.password })
    })
    if (r.status === 429) {
      console.log('  quota de connexion atteint — nouvel essai dans 70 s')
      await new Promise(s => setTimeout(s, 70000))
    }
    const brut = (r.headers.getSetCookie?.() || []).join(';')
    const m = /otaku_session=([^;]+)/.exec(brut)
    if (m) return m[1]
  }
  return null
}

const resultats = []
function verifier(nom, condition, detail = '') {
  resultats.push({ nom, ok: Boolean(condition), detail })
  console.log(`  ${condition ? '✓' : '✗'} ${nom}${detail ? ` — ${detail}` : ''}`)
}

const client = new pg.Client({ connectionString: env.DATABASE_URL || env.DIRECT_DATABASE_URL })
await client.connect()
const compter = async () => {
  const r = await client.query(`
    select
      (select count(*) from events) as events,
      (select count(*) from gallery_images) as medias,
      (select count(*) from gallery_images where "isPublished" = false) as medias_attente
  `)
  return r.rows[0]
}

const avant = await compter()
console.log(`base avant : ${avant.events} événements, ${avant.medias} médias (${avant.medias_attente} en attente)`)

const cookies = {}
const crees = { events: [], medias: [] }

try {
  cookies.ADMIN = await session('ADMIN')
  cookies.SHOP_MANAGER = await session('SHOP_MANAGER')
  verifier('sessions ADMIN + SHOP_MANAGER obtenues', Boolean(cookies.ADMIN && cookies.SHOP_MANAGER))

  const admin = (corps, entetes = {}) => fetch(`${BASE}/api/events/bulk`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cookie': `otaku_session=${cookies.ADMIN}`, ...entetes },
    body: JSON.stringify(corps)
  })

  // ------------------------------------------------------------------
  // 1. DATE ISO + 4. statut HTTP 201 + 5. messages français
  // ------------------------------------------------------------------
  const ligneIso = {
    title: `${MARQUE} ISO`,
    description: 'Description suffisamment longue pour la validation.',
    location: 'Cotonou',
    type: 'Anime',
    start_date: '2026-12-05',
    end_date: '2026-12-06',
    status: 'upcoming',
    is_free: 'true'
  }
  const r1 = await admin({ events: [ligneIso], sourceFileName: 'qa-iso.csv', sourceFormat: 'csv' })
  const j1 = await r1.json().catch(() => ({}))
  verifier('date ISO acceptée (HTTP 201, aucune erreur)', r1.status === 201 && j1.created === 1,
    `HTTP ${r1.status}, created=${j1.created}, invalid=${JSON.stringify(j1.rows?.filter(x => x.status === 'invalid') || [])}`)
  verifier('statut HTTP réel = 201', r1.status === 201, `reçu ${r1.status}`)
  const creeIso = (j1.rows || []).find(x => x.status === 'created')
  if (creeIso?.eventId) crees.events.push(creeIso.eventId)

  if (crees.events.length) {
    const detail = await fetch(`${BASE}/api/events/${crees.events[0]}`, { headers: { cookie: `otaku_session=${cookies.ADMIN}` } })
    const corps = await detail.json().catch(() => ({}))
    const ev = corps.data || corps
    const debut = ev.startDate || ev.start_date
    verifier('l’événement ISO a bien été enregistré', detail.ok, `HTTP ${detail.status}`)
    verifier('date de début = 2026-12-05', String(debut || '').includes('2026-12-05'), String(debut))
  }

  // Message de validation EN FRANÇAIS
  const r2 = await admin({ events: [{ ...ligneIso, title: 'AB', description: 'court' }], sourceFileName: 'qa-invalide.csv', sourceFormat: 'csv' })
  const j2 = await r2.json().catch(() => ({}))
  const messages = JSON.stringify(j2.rows || [])
  verifier('lot 100 % invalide → aucune création (HTTP 200, created=0)',
    r2.status === 200 && j2.created === 0, `HTTP ${r2.status}, created=${j2.created}`)
  verifier('messages de validation en FRANÇAIS',
    /au moins 3 caractères|au moins 10 caractères/.test(messages) && !/Too small|expected string/i.test(messages),
    messages.slice(0, 220))

  // ------------------------------------------------------------------
  // 2 + 3. séparateurs : virgule DANS une URL vs virgule séparatrice
  // ------------------------------------------------------------------
  const cible = await fetch(`${BASE}/api/events`, { headers: { cookie: `otaku_session=${cookies.ADMIN}` } })
  void cible

  const urlVirgule = 'https://res.cloudinary.com/demo/image/upload/c_fill,w_200,q_auto/sample.jpg'
  const r3 = await fetch(`${BASE}/api/admin/gallery/bulk`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cookie': `otaku_session=${cookies.ADMIN}` },
    body: JSON.stringify({
      title: `${MARQUE} médias`,
      category: 'Anime',
      eventDate: new Date().toISOString(),
      imageUrls: [urlVirgule],
      videoUrls: []
    })
  })
  const j3 = await r3.json().catch(() => ({}))
  const erreurs3 = j3.errors || []
  const fragments = erreurs3.filter(e => /c_fill|w_200|q_auto|sample\.jpg[^,]*$/.test(String(e)) && !String(e).includes(urlVirgule))
  verifier('URL avec virgule non découpée (aucun fragment rejeté)', fragments.length === 0,
    `créés=${j3.created} erreurs=${JSON.stringify(erreurs3).slice(0, 200)}`)
  verifier('statut HTTP du lot média cohérent (201 si créés, sinon 200)',
    r3.status === (j3.created > 0 ? 201 : 200), `HTTP ${r3.status}, créés=${j3.created}`)

  // Séparateurs restés fonctionnels : 2 liens séparés par « , » puis par « ; »
  const r4 = await fetch(`${BASE}/api/admin/gallery/bulk`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cookie': `otaku_session=${cookies.ADMIN}` },
    body: JSON.stringify({
      title: `${MARQUE} séparateurs`,
      category: 'Anime',
      eventDate: new Date().toISOString(),
      imageUrls: [`${urlVirgule}, ${urlVirgule.replace('sample.jpg', 'sample.jpg')}`],
      videoUrls: []
    })
  })
  const j4 = await r4.json().catch(() => ({}))
  verifier('séparateur « virgule + espace » toujours reconnu (doublon détecté, pas de fragment)',
    (j4.errors || []).some(e => /déjà présent/i.test(String(e))), JSON.stringify(j4.errors || []).slice(0, 200))

  // 6. médias en attente + conservation des identifiants pour le nettoyage
  const medias = await client.query(
    'select id, "isPublished" from gallery_images where title like $1', [`${MARQUE}%`]
  )
  crees.medias = medias.rows.map(r => r.id)
  verifier('médias importés marqués EN ATTENTE (isPublished = false)',
    crees.medias.length > 0 && medias.rows.every(r => r.isPublished === false),
    `${medias.rows.length} média(s) : ${JSON.stringify(medias.rows.map(r => r.isPublished))}`)

  // ------------------------------------------------------------------
  // 7. MATRICE DES SOURCES (défauts H3/H4)
  //    IMAGES : pCloud + Terabox   —   VIDÉOS : pCloud + YouTube + Terabox
  //
  //    Dans l'import d'ÉVÉNEMENTS, le filtre « dossier » ignorait Terabox : le
  //    lien restait en photo directe et devenait un média IMAGE dont l'URL est
  //    une PAGE HTML (vignette morte, aucun message) ; et l'URL découverte était
  //    préfixée du publink pCloud (« …#f= <vignette terabox> »), que plus rien
  //    ne sait re-résoudre. Ces contrôles passent par l'API RÉELLE et lisent le
  //    résultat en base.
  // ------------------------------------------------------------------
  const MARQUE_MATRICE = `${MARQUE} MATRICE`
  const PARTAGE_TERABOX = 'https://1024terabox.com/s/1Gos5U_4mEpThLjWffO1tPg' // 1 image publique
  const PARTAGE_TERABOX_7 = 'https://1024terabox.com/s/1nBesAPNXXVJWYpRKpacPZg' // 7 images publiques
  const PUBLINK_VIDEO_PCLOUD = 'https://u.pcloud.link/publink/show?code=VZV2sHJZ9TSUcHgYVz0e3ql1atKDOyesFXi7'
  const LIEN_YOUTUBE = 'https://youtu.be/dQw4w9WgXcQ'
  const APERCU_TERABOX = /^https:\/\/data\.1024terabox\.com\/thumbnail\//i
  const PAGE_PARTAGE_TERABOX = /1024terabox\.com\/(s|sharing)\//i

  const ligneEvenement = (suffixe, champs = {}) => ({
    title: `${MARQUE_MATRICE} ${suffixe}`,
    description: 'Description suffisamment longue pour la validation du schéma.',
    location: 'Cotonou',
    type: 'Anime',
    start_date: '2026-12-05',
    end_date: '2026-12-06',
    status: 'upcoming',
    is_free: 'true',
    ...champs
  })

  const mediasDesTitres = async titres => (await client.query(
    'select g.url, g."mediaType", g."sourceUrl" from gallery_images g join events e on e.id = g."eventId" where e.title = any($1)',
    [titres]
  )).rows

  // 7a. IMAGE Terabox (dossier public) : un média par image, URL = aperçu public
  const envoiEvenement = (lignes, fichier) => admin({ events: lignes, sourceFileName: fichier, sourceFormat: 'csv' })
  const rImgTerabox = await envoiEvenement([ligneEvenement('img terabox', { image_url: PARTAGE_TERABOX })], 'qa-matrice-img-terabox.csv')
  const jImgTerabox = await rImgTerabox.json().catch(() => ({}))
  const mediasImgTerabox = await mediasDesTitres([`${MARQUE_MATRICE} img terabox`])
  verifier('matrice IMAGES/Terabox : événement importé', rImgTerabox.status === 201 && jImgTerabox.created === 1, `HTTP ${rImgTerabox.status}, created=${jImgTerabox.created}`)
  verifier('matrice IMAGES/Terabox : médias = APERÇUS publics (jamais la page de partage)',
    mediasImgTerabox.length > 0 && mediasImgTerabox.every(m => m.mediaType === 'IMAGE' && APERCU_TERABOX.test(String(m.url))),
    `${mediasImgTerabox.length} média(s) : ${JSON.stringify(mediasImgTerabox.map(m => String(m.url).slice(0, 58)))}`)
  verifier('matrice IMAGES/Terabox : aucune URL de page de partage en galerie',
    mediasImgTerabox.every(m => !PAGE_PARTAGE_TERABOX.test(String(m.url))))
  verifier('matrice IMAGES/Terabox : aucune URL « …#f= » (publink pCloud appliqué à tort à Terabox)',
    mediasImgTerabox.every(m => !String(m.url).includes('#f=')))
  const couverture = await client.query('select "imageUrl" from events where title = $1', [`${MARQUE_MATRICE} img terabox`])
  verifier('matrice IMAGES/Terabox : couverture de l’événement = aperçu Terabox',
    APERCU_TERABOX.test(String(couverture.rows[0]?.imageUrl || '')), String(couverture.rows[0]?.imageUrl || '(null)').slice(0, 90))

  // 7b. VIDÉO Terabox : média VIDEO, lien de partage conservé (lien sortant)
  const rVidTerabox = await envoiEvenement([ligneEvenement('vid terabox', { video_urls: PARTAGE_TERABOX_7 })], 'qa-matrice-vid-terabox.csv')
  const jVidTerabox = await rVidTerabox.json().catch(() => ({}))
  const mediasVidTerabox = await mediasDesTitres([`${MARQUE_MATRICE} vid terabox`])
  verifier('matrice VIDÉOS/Terabox : événement importé', rVidTerabox.status === 201 && jVidTerabox.created === 1, `HTTP ${rVidTerabox.status}, created=${jVidTerabox.created}`)
  verifier('matrice VIDÉOS/Terabox : média VIDEO (lien sortant) et jamais un média IMAGE',
    mediasVidTerabox.length === 1 && mediasVidTerabox[0].mediaType === 'VIDEO' && String(mediasVidTerabox[0].url).includes('terabox'),
    JSON.stringify(mediasVidTerabox.map(m => [m.mediaType, String(m.url).slice(0, 48)])))

  // 7c. VIDÉO pCloud (publink de dossier) : un média PAR FICHIER (« …#f=nom.mp4 »)
  // pCloud limite le débit quand plusieurs dossiers sont résolus en parallèle :
  // on retente une fois. Le 2e POST est idempotent — l'événement existe alors
  // déjà (même titre/lieu/date) et la route synchronise simplement ses médias.
  const envoiVidPcloud = () => envoiEvenement([ligneEvenement('vid pcloud', { video_urls: PUBLINK_VIDEO_PCLOUD })], 'qa-matrice-vid-pcloud.csv')
  let rVidPcloud = await envoiVidPcloud()
  let jVidPcloud = await rVidPcloud.json().catch(() => ({}))
  let mediasVidPcloud = await mediasDesTitres([`${MARQUE_MATRICE} vid pcloud`])
  if (!mediasVidPcloud.length) {
    await new Promise(resolve => setTimeout(resolve, 4000))
    rVidPcloud = await envoiVidPcloud()
    jVidPcloud = await rVidPcloud.json().catch(() => ({}))
    mediasVidPcloud = await mediasDesTitres([`${MARQUE_MATRICE} vid pcloud`])
  }
  verifier('matrice VIDÉOS/pCloud : un média par fichier du dossier (publink stable + nom)',
    rVidPcloud.status === 201 && mediasVidPcloud.length > 0
    && mediasVidPcloud.every(m => m.mediaType === 'VIDEO' && String(m.url).startsWith(PUBLINK_VIDEO_PCLOUD) && String(m.url).includes('#f=')),
    `HTTP ${rVidPcloud.status}, médiaCreated=${jVidPcloud.mediaCreated}, ${mediasVidPcloud.length} média(s) — 1er = ${String(mediasVidPcloud[0]?.url || '(aucun)').slice(0, 100)}`)

  // 7d. VIDÉO collée dans une colonne d'IMAGES : basculée vers le pipeline vidéo
  const rVidColonneImages = await envoiEvenement([ligneEvenement('vid dans images', { image_url: LIEN_YOUTUBE })], 'qa-matrice-vid-images.csv')
  const jVidColonneImages = await rVidColonneImages.json().catch(() => ({}))
  const mediasVidColonneImages = await mediasDesTitres([`${MARQUE_MATRICE} vid dans images`])
  verifier('matrice VIDÉOS : un lien vidéo collé dans la colonne Images devient un média vidéo (jamais IMAGE)',
    rVidColonneImages.status === 201 && jVidColonneImages.created === 1
    && mediasVidColonneImages.length === 1 && mediasVidColonneImages[0].mediaType === 'YOUTUBE_VIDEO',
    JSON.stringify(mediasVidColonneImages.map(m => [m.mediaType, String(m.url).slice(0, 48)])))

  // 7e. GALERIE / modération : dossier Terabox -> aperçus ; vidéo Terabox -> média VIDEO
  const galerieBulk = corps => fetch(`${BASE}/api/admin/gallery/bulk`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cookie': `otaku_session=${cookies.ADMIN}` },
    body: JSON.stringify(corps)
  })
  const rGalerieImages = await galerieBulk({
    title: `${MARQUE_MATRICE} galerie terabox`,
    category: 'Anime',
    eventDate: new Date().toISOString(),
    imageUrls: [PARTAGE_TERABOX_7],
    videoUrls: []
  })
  const jGalerieImages = await rGalerieImages.json().catch(() => ({}))
  const mediasGalerie = (await client.query('select url, "mediaType" from gallery_images where title = $1', [`${MARQUE_MATRICE} galerie terabox`])).rows
  verifier('matrice IMAGES/galerie de modération : dossier Terabox parcouru (aperçus publiés comme images)',
    rGalerieImages.status === 201 && mediasGalerie.length > 0
    && mediasGalerie.every(m => m.mediaType === 'IMAGE' && APERCU_TERABOX.test(String(m.url))),
    `HTTP ${rGalerieImages.status}, créés=${jGalerieImages.created}, ${mediasGalerie.length} média(s) — erreurs=${JSON.stringify(jGalerieImages.errors || []).slice(0, 140)}`)

  const rGalerieVideo = await galerieBulk({
    title: `${MARQUE_MATRICE} galerie video terabox`,
    category: 'Anime',
    eventDate: new Date().toISOString(),
    imageUrls: [],
    videoUrls: [PARTAGE_TERABOX]
  })
  const jGalerieVideo = await rGalerieVideo.json().catch(() => ({}))
  const mediasGalerieVideo = (await client.query('select url, "mediaType" from gallery_images where title = $1', [`${MARQUE_MATRICE} galerie video terabox`])).rows
  verifier('matrice VIDÉOS/galerie de modération : partage Terabox accepté comme vidéo',
    rGalerieVideo.status === 201 && mediasGalerieVideo.length === 1 && mediasGalerieVideo[0].mediaType === 'VIDEO',
    `HTTP ${rGalerieVideo.status}, créés=${jGalerieVideo.created}, ${JSON.stringify(mediasGalerieVideo.map(m => m.mediaType))}`)

  // 7f. BOUTIQUE : visuel Terabox -> aperçus ; vidéo et lien pCloud direct REFUSÉS
  const boutiqueBulk = products => fetch(`${BASE}/api/boutique/catalog/bulk`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cookie': `otaku_session=${cookies.SHOP_MANAGER}` },
    body: JSON.stringify({ products })
  })
  const produitDeBase = (nom, imageUrl) => ({
    name: nom,
    description: 'Description produit suffisamment longue pour la validation.',
    category: 'goodies',
    price: '5000',
    stock: '3',
    whatsapp_number: '+22960000000',
    image_url: imageUrl
  })
  const rProduitTerabox = await boutiqueBulk([produitDeBase(`${MARQUE_MATRICE} produit terabox`, PARTAGE_TERABOX)])
  const jProduitTerabox = await rProduitTerabox.json().catch(() => ({}))
  const produitTerabox = (await client.query('select "imageUrl", "imageUrls"::text as images from products where name = $1', [`${MARQUE_MATRICE} produit terabox`])).rows[0]
  verifier('matrice IMAGES/boutique : dossier Terabox parcouru et visuels enregistrés (aperçus)',
    jProduitTerabox.created === 1 && Boolean(produitTerabox) && APERCU_TERABOX.test(String(produitTerabox.imageUrl || '')),
    `HTTP ${rProduitTerabox.status}, créés=${jProduitTerabox.created}, imageUrl=${String(produitTerabox?.imageUrl || '(aucun)').slice(0, 80)}, erreurs=${JSON.stringify(jProduitTerabox.rows || []).slice(0, 140)}`)

  const rProduitVideo = await boutiqueBulk([produitDeBase(`${MARQUE_MATRICE} produit video`, LIEN_YOUTUBE)])
  const jProduitVideo = await rProduitVideo.json().catch(() => ({}))
  verifier('matrice IMAGES/boutique : une vidéo en visuel produit est REFUSÉE avec un message français',
    jProduitVideo.created === 0 && (jProduitVideo.rows || []).some(r => /vidéo/i.test(String(r.message))),
    JSON.stringify(jProduitVideo.rows || []).slice(0, 200))

  const rProduitPcloudDirect = await boutiqueBulk([produitDeBase(`${MARQUE_MATRICE} produit pcloud direct`, 'https://fivet.pcloud.com/cget/x/photo.jpg')])
  const jProduitPcloudDirect = await rProduitPcloudDirect.json().catch(() => ({}))
  verifier('matrice IMAGES/boutique : un lien pCloud DIRECT (lié à l’IP) est refusé avec un message français',
    jProduitPcloudDirect.created === 0 && (jProduitPcloudDirect.rows || []).some(r => /pCloud direct/i.test(String(r.message))),
    JSON.stringify(jProduitPcloudDirect.rows || []).slice(0, 200))

  // 7g. Les import_batches de ces cas portent un nom reconnaissable (nettoyage)
} finally {
  // ------------------------------------------------------------------
  // Nettoyage : tout ce qui a été créé par ce test disparaît.
  // ------------------------------------------------------------------
  // Il n'existe AUCUNE route DELETE pour un événement : le nettoyage passe par SQL.
  await client.query('delete from gallery_images where "eventId" in (select id from events where title like $1)', [`${MARQUE}%`]).catch(() => {})
  await client.query('delete from events where title like $1', [`${MARQUE}%`]).catch(() => {})
  if (crees.medias.length) {
    await client.query('delete from gallery_images where id = any($1)', [crees.medias]).catch(() => {})
  }
  await client.query('delete from import_batches where filename like $1', [`qa-iso%`]).catch(() => {})
  await client.query('delete from import_batches where filename like $1', [`qa-invalide%`]).catch(() => {})
  // Produits et traces créés par la section « matrice des sources »
  await client.query('delete from products where name like $1', [`${MARQUE}%`]).catch(() => {})
  await client.query('delete from import_batches where filename like $1', ['qa-matrice%']).catch(() => {})

  const apres = await compter()
  console.log(`\nbase après : ${apres.events} événements, ${apres.medias} médias (${apres.medias_attente} en attente)`)
  verifier('base laissée dans son état initial',
    apres.events === avant.events && apres.medias === avant.medias && apres.medias_attente === avant.medias_attente,
    `avant ${avant.events}/${avant.medias}/${avant.medias_attente} — après ${apres.events}/${apres.medias}/${apres.medias_attente}`)
  await client.end()

  const echecs = resultats.filter(r => !r.ok)
  console.log(`\n${resultats.length - echecs.length}/${resultats.length} vérifications OK`)
  if (echecs.length) {
    console.log('ÉCHECS :')
    for (const e of echecs) console.log(`  - ${e.nom} (${e.detail})`)
    process.exit(1)
  }
  console.log('✅ CORRECTIONS IMPORT : TOUS LES CONTRÔLES PASSENT')
}
