// scripts/audit-responsive.mjs
//
// Audit STATIQUE du risque responsive sur toutes les pages et tous les
// composants Vue du site. Aucun navigateur requis : le script analyse le
// balisage réel (hors <style> et <script>) et signale les motifs qui cassent
// ou fragilisent l'affichage mobile.
//
// Ce n'est PAS un contrôle visuel : il produit une liste de points à vérifier
// et de correctifs concrets. Usage : node scripts/audit-responsive.mjs

import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

const files = [...walk(join(root, 'app/pages')), ...walk(join(root, 'app/components'))]
  .filter(file => file.endsWith('.vue'))

// Motifs à risque. Chaque entrée : [regex, libellé, gravité]
// NOTE (14/09/2026) : les motifs `w-[…px]` utilisaient `\b`, qui matche AUSSI
// le `w-[…]` contenu dans `min-w-[…]` — d'où trois « signaux de gravité
// élevée » entièrement faux (AdminMembersTable, ProductBulkImport,
// dashboard-evenementiel ne contenaient aucun `w-[Npx]`, seulement des
// `min-w-[Npx]`). Le lookbehind `(?<![-\w])` exige que le `w-` ne soit pas
// précédé d'un tiret ni d'un caractère de mot : `min-w-[…]` n'est donc plus
// compté comme une largeur fixe (il reste signalé, à juste titre, comme
// « min-largeur »).
const PATTERNS = [
  [/(?<![-\w])w-\[\d{3,}px\]/g, 'largeur >= 100px fixe', 'eleve'],
  [/(?<![-\w])w-\[\d+px\]/g, 'largeur fixe en px', 'moyen'],
  [/min-w-\[\d+px\]/g, 'min-largeur fixe en px', 'moyen'],
  [/style="[^"]*width:\s*\d+px/g, 'largeur inline en px', 'eleve'],
  [/style="[^"]*min-width:\s*\d+px/g, 'min-largeur inline en px', 'eleve'],
  [/grid-cols-[2-9](?![0-9])/g, 'grille multi-colonnes', 'verifier-breakpoint'],
  [/<table/g, 'tableau HTML (risque de debordement)', 'moyen'],
  [/overflow-x-(auto|scroll)/g, 'scroll horizontal explicite', 'info'],
  [/\bwhitespace-nowrap\b/g, 'texte non wrappe', 'faible'],
  [/text-\[\d{2,}px\]/g, 'taille de police px fixe', 'faible'],
  [/<img(?![^>]*object-(cover|contain))/g, 'image sans object-cover/contain', 'faible'],
  [/\bposition:\s*(absolute|fixed)/g, 'positionnement hors flux', 'info'],
  [/\b(fixed|sticky)\b(?![^"]*z-)/g, 'fixed/sticky sans z-index voisin', 'info'],
  [/\b(v-if|v-for)="[^"]*\.length"/g, 'rendu conditionnel sur longueur', 'info']
]

const rows = []
for (const file of files) {
  const source = readFileSync(file, 'utf8')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
  const hits = []
  for (const [regex, label, severity] of PATTERNS) {
    const found = source.match(regex)
    if (found?.length) hits.push({ label, severity, count: found.length })
  }
  if (hits.length) {
    rows.push({
      file: relative(root, file).replace(/\\/g, '/'),
      hits,
      score: hits.reduce((sum, hit) => sum + (hit.severity === 'eleve' ? 5 : hit.severity === 'moyen' ? 3 : hit.severity === 'faible' ? 1 : 0), 0)
    })
  }
}

rows.sort((a, b) => b.score - a.score)

console.log(`Fichiers analyses : ${files.length}  |  avec signaux : ${rows.length}\n`)
for (const row of rows) {
  console.log(`${String(row.score).padStart(3)}  ${row.file}`)
  console.log(`     ${row.hits.map(hit => `${hit.label} x${hit.count} [${hit.severity}]`).join('  |  ')}`)
}

const high = rows.filter(row => row.hits.some(hit => hit.severity === 'eleve'))
console.log(`\nFichiers avec un signal de gravite ELEVEE : ${high.length}`)
for (const row of high) console.log(`  - ${row.file}`)
