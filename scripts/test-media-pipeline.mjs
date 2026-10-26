#!/usr/bin/env node
/**
 * Reproducible media-pipeline test for Club Otaku (pCloud images + videos).
 *
 * Runs the REAL server/utils/import-media.ts (Node >= 23 native TS type-stripping)
 * against test.xlsx and verifies that every pCloud link resolves to a directly
 * fetchable media URL, and that the resolved URLs actually serve bytes over HTTP
 * (HEAD + Range 206, as required by <img> and the Vidstack player/proxy).
 *
 * Usage:   node scripts/test-media-pipeline.mjs
 * Exit 0 = all checks pass, 1 = at least one failure.
 *
 * NOTE: requires outbound HTTPS to u.pcloud.link / api.pcloud.com / *.pcloud.com.
 */
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
const root = path.resolve(import.meta.dirname, '..')

// Import the real pipeline module (no transpile step needed on Node >= 23).
const media = await import(pathToFileURL(path.join(root, 'server/utils/import-media.ts')).href)

const xlsxPath = path.join(root, 'test.xlsx')
if (!existsSync(xlsxPath)) { console.error(`FAIL: test.xlsx not found at ${xlsxPath}`); process.exit(1) }

const wb = XLSX.readFile(xlsxPath, { cellDates: true })
const matrix = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' })
const headers = matrix[0].map(String)
const rows = matrix.slice(1).map(r => Object.fromEntries(r.map((c, i) => [headers[i], String(c ?? '').trim()])))

const pick = (row, keys) => keys.map(k => row[k]).find(v => v && v.trim()) || ''
const IS_MEDIA = /\.(?:jpe?g|png|webp|gif|bmp|avif)(?:\?|$)/i

const results = []
let failures = 0
const fail = (msg) => { failures++; console.error(`  ✗ ${msg}`) }

console.log(`\n=== Club Otaku — pipeline média pCloud (${rows.length} lignes) ===\n`)

for (const row of rows) {
  const titre = pick(row, ['Titre', 'title', 'title']) || '(sans titre)'
  const imageUrl = pick(row, ['Image_url', 'image_url', 'image'])
  const videoUrl = pick(row, ['vidéo_url', 'video_url', 'video_urls', 'youtube_urls'])
  const rec = { titre, images: [], videos: [] }
  console.log(`• ${titre}`)

  if (imageUrl) {
    const images = await media.discoverPublicImageUrls(imageUrl)
    rec.images = images
    if (!images.length) fail(`aucune image résolue depuis ${imageUrl}`)
    else if (!images.every(u => IS_MEDIA.test(u))) fail(`URL image non directe : ${images.find(u => !IS_MEDIA.test(u))}`)
    console.log(`    images: ${images.length}`)
  }
  if (videoUrl) {
    const parsed = media.parseVideoUrl(videoUrl)
    const videos = await media.resolvePublicVideoUrls(videoUrl)
    rec.videos = videos
    if (!parsed) fail(`plateforme vidéo non reconnue : ${videoUrl}`)
    if (!videos.length) fail(`aucune vidéo résolue depuis ${videoUrl}`)
    else if (!videos.every(u => /\.(?:mp4|webm|mov|m4v)(?:\?|$)/i.test(u))) fail(`URL vidéo non directe : ${videos.find(u => !/\.(?:mp4|webm|mov|m4v)(?:\?|$)/i.test(u))}`)
    console.log(`    vidéos: ${videos.length} (${parsed?.provider ?? '???'})`)
  }
  results.push(rec)
}

// Probe real bytes for the first resolved image + first resolved video.
async function probe(url, { range = false } = {}) {
  const res = await fetch(url, { method: range ? 'GET' : 'HEAD', headers: range ? { range: 'bytes=0-1023' } : undefined, signal: AbortSignal.timeout(20000) })
  return { status: res.status, type: res.headers.get('content-type'), len: res.headers.get('content-length'), cr: res.headers.get('content-range') }
}

console.log('\n=== Vérification d\'octets réels (réseau) ===')
const firstImage = results.flatMap(r => r.images).find(Boolean)
const firstVideo = results.flatMap(r => r.videos).find(Boolean)

if (firstImage) {
  try {
    const p = await probe(firstImage)
    const ok = p.status === 200 && /^image\//.test(p.type || '')
    console.log(`  ${ok ? '✓' : '✗'} image  HEAD ${p.status} ${p.type} ${p.len ?? ''}`)
    console.log(`      ${firstImage.slice(0, 90)}…`)
    if (!ok) fail('l\'image résolue ne renvoie pas de contenu image/*')
  } catch (e) { fail(`image non récupérable : ${e.message}`) }
}
if (firstVideo) {
  try {
    const head = await probe(firstVideo)
    const rng = await probe(firstVideo, { range: true })
    const ok = head.status === 200 && rng.status === 206 && (rng.cr || '').startsWith('bytes 0-1023/')
    console.log(`  ${ok ? '✓' : '✗'} vidéo  HEAD ${head.status} ${head.type} ${head.len ?? ''} | RANGE ${rng.status} (${rng.cr})`)
    console.log(`      ${firstVideo.slice(0, 90)}…`)
    if (!ok) fail('la vidéo résolue ne supporte pas les requêtes Range (206)')
  } catch (e) { fail(`vidéo non récupérable : ${e.message}`) }
}

console.log(`\n=== RÉSULTAT : ${failures === 0 ? 'PASS' : `FAIL (${failures} erreur(s))`} ===`)
process.exit(failures === 0 ? 0 : 1)
