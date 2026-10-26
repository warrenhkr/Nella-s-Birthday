// scripts/audit-links.mjs
//
// Audit STATIQUE des liens internes : compare chaque destination interne
// utilisée dans le code (`to="/..."`, `navigateTo('/...')`, `router.push`,
// `window.location`, `<NuxtLink>`, formulaires...) à la liste réelle des pages
// Nuxt. Détecte les liens morts et les fautes de frappe avant l'utilisateur.
//
// Usage : node scripts/audit-links.mjs

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

// 1. Routes réellement servies (dérivées de app/pages, avec les paramètres [x]).
const pageFiles = walk(join(root, 'app/pages')).filter(file => file.endsWith('.vue'))
const routes = new Set(['/'])
for (const file of pageFiles) {
  const rel = relative(join(root, 'app/pages'), file).replace(/\\/g, '/').replace(/\.vue$/, '')
  if (rel === 'index') continue
  let route = `/${rel}`.replace(/\/index$/, '')
  route = route.replace(/\[([^\]]+)\]/g, '§') // segment dynamique → joker
  routes.add(route)
}

// 2. Destinations internes trouvées dans le code.
const sources = [...walk(join(root, 'app')), ...walk(join(root, 'shared'))]
  .filter(file => /\.(vue|ts)$/.test(file))

const LINK_PATTERN = /(?:to|href)=["'](\/[^"'?#]*)/g
const CODE_PATTERN = /(?:navigateTo|router\.push|redirect)\(\s*['"`](\/[^'"`?#]*)/g
const found = new Map()

for (const file of sources) {
  const source = readFileSync(file, 'utf8')
  const rel = relative(root, file).replace(/\\/g, '/')
  for (const pattern of [LINK_PATTERN, CODE_PATTERN]) {
    for (const match of source.matchAll(pattern)) {
      const target = match[1].replace(/\/$/, '') || '/'
      if (!found.has(target)) found.set(target, new Set())
      found.get(target).add(rel)
    }
  }
}

// 3. Comparaison, en tolérant les segments dynamiques (identifiants de données).
function isKnown(target) {
  if (routes.has(target)) return true
  const parts = target.split('/')
  for (const route of routes) {
    const routeParts = route.split('/')
    if (routeParts.length !== parts.length) {
      // tolère un id en plus (ex. /equipes/<id> construit dynamiquement)
      if (routeParts.length + 1 === parts.length && routeParts.includes('§')) continue
      continue
    }
    const ok = routeParts.every((segment, index) => segment === '§' || segment === parts[index])
    if (ok) return true
  }
  return false
}

const dead = [...found.entries()]
  .filter(([target]) => !isKnown(target))
  .sort((a, b) => a[0].localeCompare(b[0]))

const dynamic = [...found.keys()].filter(target => target.includes('${') || target.includes(':'))
console.log(`Pages/routes connues : ${routes.size}  |  destinations internes distinctes : ${found.size}`)
console.log(`Destinations dynamiques (ignorées) : ${dynamic.length}`)

if (!dead.length) {
  console.log('\nAucun lien interne mort detecte.')
} else {
  console.log(`\nLiens internes SANS page correspondante : ${dead.length}`)
  for (const [target, files] of dead) {
    console.log(`  ${target}`)
    console.log(`     utilise dans : ${[...files].slice(0, 4).join(', ')}`)
  }
}

console.log('\nRoutes servies :')
console.log('  ' + [...routes].sort().join('\n  '))
