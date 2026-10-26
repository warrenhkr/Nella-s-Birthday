// scripts/preuve-deploiement-chunk.mjs
//
// Prouve qu'un deploiement CONTIENT bien le code pousse, sans navigateur.
//
// Pourquoi ce script : sur une app Nuxt gatee cote client (app.vue masque tout
// derriere un IntroLoader dans <ClientOnly>), le HTML servi est VIDE. Grepper ce
// HTML ne prouve donc RIEN sur la page. En revanche les chunks JS/CSS servis
// contiennent, eux, les chaines du code deploye : c'est la preuve externe.
//
// Usage :
//   node preuve-deploiement-chunk.mjs https://exemple.app/communaute commu-tab "Derniers inscrits"
//   node preuve-deploiement-chunk.mjs https://exemple.app/communaute --marqueurs marqueurs.txt
//
// --marqueurs <fichier> : un marqueur par ligne (indispensable pour les marqueurs
// contenant des backticks, des espaces ou des accents).
// Sortie : une ligne par marqueur + VERDICT. Code de sortie 0 si TOUS trouves.

import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const url = args[0]
if (!url) {
  console.error('Usage: node preuve-deploiement-chunk.mjs <url> <marqueur...> | --marqueurs <fichier>')
  process.exit(2)
}

let marqueurs = args.slice(1)
const iFichier = marqueurs.indexOf('--marqueurs')
if (iFichier !== -1) {
  const chemin = marqueurs[iFichier + 1]
  if (!chemin) { console.error('--marqueurs attend un chemin de fichier'); process.exit(2) }
  marqueurs = readFileSync(chemin, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
}
if (!marqueurs.length) { console.error('Aucun marqueur fourni.'); process.exit(2) }

const origine = new URL(url).origin

async function recuperer(u) {
  try {
    const reponse = await fetch(u)
    if (!reponse.ok) { console.log(`  (HTTP ${reponse.status} sur ${u})`); return '' }
    return await reponse.text()
  } catch (erreur) {
    console.log(`  (echec reseau sur ${u} : ${erreur.message})`)
    return ''
  }
}

function compter(texte, marqueur) {
  if (!texte) return 0
  return texte.split(marqueur).length - 1
}

console.log(`== Preuve de deploiement : ${url} ==\n`)

const html = await recuperer(url)
console.log(`HTML servi : ${html.length} octets`)

// Un shell quasi vide = app gatee cote client : grepper le HTML ne conclurait rien.
const coquilleVide = /<div id="__nuxt"[^>]*>(?:\s*<!--.*?-->)*\s*<\/div>/s.test(html)
if (coquilleVide) {
  console.log('NOTE : <div id="__nuxt"> est VIDE -> app gatee cote client.')
  console.log('       Grepper ce HTML ne prouverait rien ; on passe aux chunks.\n')
} else {
  console.log('NOTE : le HTML contient du contenu rendu (grep du HTML exploitable).\n')
}

// 1) l'entry : importmap "#entry" sinon premier .js reference par le HTML
const entry = html.match(/"#entry"\s*:\s*"([^"]+)"/)?.[1]
  || html.match(/\/_nuxt\/[A-Za-z0-9_.-]+\.js/)?.[0]
let codeEntry = ''
if (entry) {
  codeEntry = await recuperer(origine + (entry.startsWith('/') ? entry : `/${entry}`))
  console.log(`entry : ${entry} (${codeEntry.length} octets)`)
}

// 2) chunk + CSS de la page, lus dans la table de routes Vite de l'entry
const slug = (new URL(url).pathname.split('/').filter(Boolean).pop() || '').replace(/[^a-zA-Z0-9-]/g, '')
let chunkPage = ''
let cssPage = ''
if (slug && codeEntry) {
  const motifChunk = new RegExp('name:`' + slug + '`[\\s\\S]{0,240}?import\\(`\\.\\/([A-Za-z0-9_.-]+\\.js)`')
  const motifCss = new RegExp('\\.\\/(' + slug + '\\.[A-Za-z0-9_.-]+\\.css)')
  const nomChunk = codeEntry.match(motifChunk)?.[1]
  const nomCss = codeEntry.match(motifCss)?.[1]
  if (nomChunk) {
    chunkPage = await recuperer(`${origine}/_nuxt/${nomChunk}`)
    console.log(`chunk de page (route "${slug}") : /_nuxt/${nomChunk} (${chunkPage.length} octets)`)
  }
  if (nomCss) {
    cssPage = await recuperer(`${origine}/_nuxt/${nomCss}`)
    console.log(`CSS de page : /_nuxt/${nomCss} (${cssPage.length} octets)`)
  }
  if (!nomChunk && !nomCss) {
    console.log(`(route "${slug}" absente de la table de routes : chunk non identifiable)`)
  }
}

console.log('\nmarqueur                                    HTML  entry   page    css')
let manquants = 0
for (const marqueur of marqueurs) {
  const comptes = [html, codeEntry, chunkPage, cssPage].map(t => compter(t, marqueur))
  const total = comptes.reduce((a, b) => a + b, 0)
  if (total === 0) manquants += 1
  const etiquette = (total === 0 ? 'KO ' : 'OK ') + marqueur.slice(0, 36)
  console.log(`${etiquette.padEnd(42)} ${comptes.map(n => String(n).padStart(5)).join(' ')}`)
}

console.log(`\nVERDICT : ${marqueurs.length - manquants}/${marqueurs.length} marqueur(s) trouve(s) dans les fichiers servis.`)
if (manquants) {
  console.log('ATTENTION : un marqueur absent peut signifier (a) un deploiement plus ancien,')
  console.log('(b) un nom de marqueur errone, ou (c) un chunk de page non identifie.')
  console.log('Verifier le HTML puis l URL du chunk AVANT de conclure que le deploiement est en retard.')
}
process.exitCode = manquants ? 1 : 0
