// ============================================================
// scripts/test-import-moderation-regression.mjs
//
// NON-RÉGRESSION (API + SQL, aucun test visuel) des chemins d'import en masse
// voisins de ceux touchés par l'import d'événements :
//   • /dashboard-moderation → POST /api/admin/gallery/bulk
//       - limite de 200 liens appliquée APRÈS découpage des entrées
//       - vidéo collée dans la zone Images
//       - lien non reconnu → erreur explicite, aucun média mort
//       - sans session → 401
//   • ProductBulkImport.vue → POST /api/boutique/catalog/bulk (+ suppression)
//   • lecture /api/events (sélecteur « rattacher à un événement » de la modération)
//
// Usage : node scripts/test-import-moderation-regression.mjs [http://localhost:3226]
// ============================================================

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import pg from 'pg'

const BASE = (process.argv[2] || process.env.TEST_BASE_URL || 'http://localhost:3226').replace(/\/$/, '')
const MARQUE = `QA-REGR-MODO ${Date.now()}`

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

const CACHE = path.join(os.tmpdir(), 'otaku-qa-session-tokens.json')
const cookies = {}
if (fs.existsSync(CACHE)) {
  for (const [role, token] of Object.entries(JSON.parse(fs.readFileSync(CACHE, 'utf8')))) {
    const r = await fetch(`${BASE}/api/auth/me`, { headers: { cookie: `otaku_session=${token}` } })
    if (r.status === 200) cookies[role] = `otaku_session=${token}`
  }
}
console.log(`sessions valides : ${Object.keys(cookies).join(', ') || 'AUCUNE'}`)

async function appel (method, route, corps, role) {
  const headers = {}
  if (corps) headers['content-type'] = 'application/json'
  if (role && cookies[role]) headers.cookie = cookies[role]
  const r = await fetch(`${BASE}${route}`, { method, headers, body: corps ? JSON.stringify(corps) : undefined })
  const texte = await r.text()
  let json = null
  try { json = JSON.parse(texte) } catch { /* non JSON */ }
  return { status: r.status, json, texte: texte.slice(0, 300) }
}

let produitId = null
const idsMedias = []

try {
  // ------------------------------------------------------------
  console.log('\n=== [A] GARDES — import produit (SHOP_MANAGER) ===')
  {
    const anon = await appel('POST', '/api/boutique/catalog/bulk', { products: [{ name: 'x' }] })
    ok('POST /api/boutique/catalog/bulk sans session → 401', anon.status === 401, `HTTP ${anon.status}`)
    if (cookies.MEMBER) {
      const mem = await appel('POST', '/api/boutique/catalog/bulk', { products: [{ name: 'x' }] }, 'MEMBER')
      ok('POST /api/boutique/catalog/bulk (MEMBER) → 403', mem.status === 403, `HTTP ${mem.status}`)
    }
    const av = await appel('GET', '/api/boutique/catalog', null, 'SHOP_MANAGER')
    const avantProduits = (av.json?.data ?? av.json?.products ?? []).length
    console.log(`  GET /api/boutique/catalog (SHOP_MANAGER) → HTTP ${av.status}, ${avantProduits} produit(s)`)

    const lot = [
      { name: `${MARQUE} Produit`, description: 'Produit de test automatisé (aucun test visuel).', category: 'goodies', price: '2500', stock: '4', whatsapp_number: '+22990000000', image_url: '' },
      { name: `${MARQUE} Refuse`, description: 'Produit de test avec prix invalide.', category: 'goodies', price: 'abc', stock: '1', whatsapp_number: '+22990000000', image_url: '' },
      { name: `${MARQUE} Produit`, description: 'Produit de test automatisé (aucun test visuel).', category: 'goodies', price: '2500', stock: '4', whatsapp_number: '+22990000000', image_url: '' }
    ]
    const r = await appel('POST', '/api/boutique/catalog/bulk', { products: lot, sourceFileName: 'qa-regr-modo-produits.csv', sourceFormat: 'csv' }, 'SHOP_MANAGER')
    const j = r.json ?? {}
    console.log(`  POST /api/boutique/catalog/bulk → HTTP ${r.status} créés=${j.created} doublons=${j.duplicates} invalides=${j.invalid} total=${j.total}`)
    for (const row of (j.rows ?? [])) console.log(`      ligne ${row.line} [${row.status}] ${String(row.message).slice(0, 90)}`)
    ok('import produit HTTP 200', r.status === 200, `HTTP ${r.status}`)
    ok('1 produit créé', j.created === 1, `created=${j.created}`)
    ok('1 doublon intra-lot détecté', j.duplicates === 1, `duplicates=${j.duplicates}`)
    ok('1 ligne invalide refusée', j.invalid === 1, `invalid=${j.invalid}`)

    const enBase = (await db.query('SELECT id, name, price, stock FROM public.products WHERE name LIKE $1', [`${MARQUE}%`])).rows
    console.log(`  SQL products (LIKE « ${MARQUE}% ») → ${enBase.length} ligne(s)`)
    for (const p of enBase) console.log(`    ${p.name.slice(0, 40)} | price=${p.price} | stock=${p.stock}`)
    ok('1 produit du test en base', enBase.length === 1, `${enBase.length}`)
    produitId = enBase[0]?.id ?? null

    if (produitId) {
      const sup = await appel('DELETE', `/api/boutique/catalog/${produitId}`, null, 'SHOP_MANAGER')
      console.log(`  DELETE /api/boutique/catalog/${String(produitId).slice(0, 8)}… → HTTP ${sup.status}`)
      ok('suppression du produit de test', sup.status === 200 || sup.status === 204, `HTTP ${sup.status}`)
      produitId = null
    }
  }

  // ------------------------------------------------------------
  console.log('\n=== [B] MODÉRATION — garde sans session + limites du lot média ===')
  {
    const anon = await appel('POST', '/api/admin/gallery/bulk', { title: MARQUE, category: 'QA', eventDate: new Date().toISOString(), imageUrls: ['https://res.cloudinary.com/demo/image/upload/sample.jpg'], videoUrls: [] })
    ok('POST /api/admin/gallery/bulk sans session → 401', anon.status === 401, `HTTP ${anon.status}`)
  }

  if (!cookies.ADMIN) {
    console.log('  (aucune session ADMIN : limites de lot non testables)')
  } else {
    const corps = (surcharge = {}) => ({
      title: `${MARQUE} Limites`,
      category: 'culture',
      eventDate: new Date().toISOString(),
      eventId: null,
      imageUrls: [],
      videoUrls: [],
      ...surcharge
    })

    // 201 liens DANS UNE SEULE chaîne : la limite doit s'appliquer après découpage
    const gros = await appel('POST', '/api/admin/gallery/bulk', corps({ imageUrls: [Array.from({ length: 201 }, (_, i) => `https://res.cloudinary.com/demo/image/upload/x${i}.jpg`).join('\n')] }), 'ADMIN')
    console.log(`  POST /api/admin/gallery/bulk (201 liens en 1 chaîne) → HTTP ${gros.status} ${String(gros.json?.statusMessage ?? gros.texte).slice(0, 120)}`)
    ok('201 liens découpés → 400 (limite 200 après découpage)', gros.status === 400 && /limité à 200/.test(String(gros.json?.statusMessage ?? '')), `HTTP ${gros.status}`)

    // Vidéo collée dans la zone Images
    const video = await appel('POST', '/api/admin/gallery/bulk', corps({ title: `${MARQUE} VideoZone`, imageUrls: ['https://youtu.be/dQw4w9WgXcQ'], videoUrls: [] }), 'ADMIN')
    const jv = video.json ?? {}
    console.log(`  POST /api/admin/gallery/bulk (vidéo dans la zone Images) → HTTP ${video.status} créés=${jv.created}`)
    for (const e of (jv.errors ?? [])) console.log(`      info : ${String(e).slice(0, 120)}`)
    ok('vidéo de la zone Images importée comme vidéo (created=1)', jv.created === 1, `created=${jv.created}`)
    ok('message explicite de bascule vidéo', (jv.errors ?? []).some(e => /zone Images/i.test(String(e))), JSON.stringify(jv.errors ?? []).slice(0, 120))
    const medias = (await db.query(`SELECT id, "mediaType" FROM public.gallery_images WHERE title = $1`, [`${MARQUE} VideoZone`])).rows
    for (const m of medias) idsMedias.push(m.id)
    ok('média stocké en YOUTUBE_VIDEO', medias.length === 1 && medias[0].mediaType === 'YOUTUBE_VIDEO', medias.map(m => m.mediaType).join(','))

    // Lien non reconnu (ni extension image, ni dossier public)
    const inconnu = await appel('POST', '/api/admin/gallery/bulk', corps({ title: `${MARQUE} Inconnu`, imageUrls: ['https://exemple-qa.invalid/document.pdf'], videoUrls: [] }), 'ADMIN')
    const ji = inconnu.json ?? {}
    console.log(`  POST /api/admin/gallery/bulk (lien non média) → HTTP ${inconnu.status} créés=${ji.created} rejetés=${ji.rejected}`)
    for (const e of (ji.errors ?? [])) console.log(`      refus : ${String(e).slice(0, 120)}`)
    ok('aucun média mort créé (created=0)', ji.created === 0, `created=${ji.created}`)
    ok('lien refusé signalé explicitement', (ji.errors ?? []).some(e => /non reconnu|inaccessible/i.test(String(e))), `${ji.rejected} refus`)
  }

  // ------------------------------------------------------------
  console.log('\n=== [C] LECTURES UTILISÉES PAR LE TABLEAU DE BORD DE MODÉRATION ===')
  {
    const ev = await appel('GET', '/api/events', null, 'ADMIN')
    ok('GET /api/events (sélecteur d\'événement de la modération) → 200', ev.status === 200, `HTTP ${ev.status}, ${(ev.json?.data ?? []).length} événement(s)`)
    const gal = await appel('GET', '/api/admin/gallery', null, 'ADMIN')
    ok('GET /api/admin/gallery (liste de modération) → 200', gal.status === 200, `HTTP ${gal.status}, ${(gal.json?.data ?? []).length} média(s)`)
    const imp = await appel('GET', '/api/admin/imports', null, 'ADMIN')
    ok('GET /api/admin/imports (historique d\'import) → 200', imp.status === 200, `HTTP ${imp.status}`)
    const cat = await appel('GET', '/api/boutique/catalog', null, 'SHOP_MANAGER')
    ok('GET /api/boutique/catalog (boutique non cassée) → 200', cat.status === 200, `HTTP ${cat.status}`)
  }
} catch (e) {
  console.log('❌ ERREUR INATTENDUE :', e.message)
  echecs.push(`exception : ${e.message}`)
} finally {
  // ---------- nettoyage ----------
  console.log('\n=== [D] NETTOYAGE ===')
  const medias = (await db.query(`SELECT id FROM public.gallery_images WHERE title LIKE 'QA-REGR-MODO %'`)).rows.map(r => r.id)
  if (medias.length) await db.query('DELETE FROM public.gallery_images WHERE id = ANY($1)', [medias])
  const prods = (await db.query(`SELECT id FROM public.products WHERE name LIKE 'QA-REGR-MODO %'`)).rows.map(r => r.id)
  if (prods.length) await db.query('DELETE FROM public.products WHERE id = ANY($1)', [prods])
  const batches = (await db.query(`SELECT id FROM public.import_batches WHERE filename LIKE 'qa-regr-modo%'`)).rows.map(r => r.id)
  if (batches.length) await db.query('DELETE FROM public.import_batches WHERE id = ANY($1)', [batches])
  console.log(`  supprimés : ${prods.length} produit(s), ${medias.length} média(s), ${batches.length} lot(s)`)
  const reste = {
    produits: (await db.query(`SELECT count(*)::int n FROM public.products WHERE name LIKE 'QA-REGR-MODO %'`)).rows[0].n,
    medias: (await db.query(`SELECT count(*)::int n FROM public.gallery_images WHERE title LIKE 'QA-REGR-MODO %'`)).rows[0].n
  }
  ok('aucun produit du test laissé en base', reste.produits === 0, `${reste.produits}`)
  ok('aucun média du test laissé en base', reste.medias === 0, `${reste.medias}`)
  await db.end()
}

console.log(`\n${echecs.length === 0 ? '✅ NON-RÉGRESSION : TOUS LES CONTRÔLES PASSENT' : `❌ ${echecs.length} ÉCHEC(S) :\n   - ` + echecs.join('\n   - ')}`)
process.exit(echecs.length === 0 ? 0 : 1)
