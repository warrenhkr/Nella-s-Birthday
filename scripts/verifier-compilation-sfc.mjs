#!/usr/bin/env node
// ============================================================
// verifier-compilation-sfc.mjs — vérifie la COMPILATION d'un lot de .vue
// (script + template + styles scoped), sans serveur de dev ni navigateur.
//
// Usage :
//   node verifier-compilation-sfc.mjs                       (scanne app/ du projet courant)
//   node verifier-compilation-sfc.mjs app/pages/x.vue app/components/Y.vue
//   node verifier-compilation-sfc.mjs --projet D:/mon/projet app/pages/x.vue
//
// Sortie : une ligne OK/ECHEC par fichier, puis un total. Code de sortie 1
// dès qu'un fichier échoue (utilisable dans une chaîne de vérification).
//
// pnpm strict : @vue/compiler-sfc n'est pas résoluble depuis la racine ; on
// passe par createRequire(<projet>/package.json) puis par le store virtuel.
// Le script peut donc vivre HORS du projet (ex. $TEMP), ce qui évite de
// laisser un fichier non suivi dans un dépôt partagé.
// ============================================================
import { createRequire } from 'node:module'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

function analyserArguments(argv) {
  const fichiers = []
  let projet = null
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--projet') {
      projet = resolve(argv[i + 1])
      i += 1
    } else {
      fichiers.push(argv[i])
    }
  }
  return { projet, fichiers }
}

/** Remonte les dossiers jusqu'au package.json du projet. */
function trouverProjet(depart) {
  let dossier = resolve(depart)
  for (let i = 0; i < 12; i += 1) {
    if (existsSync(join(dossier, 'package.json'))) return dossier
    const parent = dirname(dossier)
    if (parent === dossier) break
    dossier = parent
  }
  throw new Error(`Aucun package.json trouvé en remontant depuis ${depart}`)
}

function chargerCompilerSfc(projet) {
  const require = createRequire(join(projet, 'package.json'))
  for (const nom of ['@vue/compiler-sfc', 'vue/compiler-sfc']) {
    try {
      return require(nom)
    } catch {
      // on essaie le nom suivant
    }
  }
  const store = join(projet, 'node_modules', '.pnpm')
  if (existsSync(store)) {
    const dossier = readdirSync(store).filter(nom => nom.startsWith('@vue+compiler-sfc@')).sort().pop()
    if (dossier) return require(join(store, dossier, 'node_modules', '@vue', 'compiler-sfc'))
  }
  throw new Error('Impossible de résoudre @vue/compiler-sfc (pnpm strict : vérifier node_modules/.pnpm)')
}

function listerVue(dossier) {
  if (!existsSync(dossier)) return []
  return readdirSync(dossier).flatMap((nom) => {
    const complet = join(dossier, nom)
    if (statSync(complet).isDirectory()) return listerVue(complet)
    return nom.endsWith('.vue') ? [complet] : []
  })
}

const { projet: projetFourni, fichiers: argumentsFichiers } = analyserArguments(process.argv.slice(2))
const projet = projetFourni ? trouverProjet(projetFourni) : trouverProjet(process.cwd())
const { parse, compileScript, compileTemplate, compileStyleAsync } = chargerCompilerSfc(projet)

const cibles = argumentsFichiers.length
  ? argumentsFichiers.map(chemin => resolve(projet, chemin))
  : [...listerVue(join(projet, 'app', 'pages')), ...listerVue(join(projet, 'app', 'components'))]

let echecs = 0
for (const fichier of cibles) {
  const rel = relative(projet, fichier).replace(/\\/g, '/')
  if (!existsSync(fichier)) {
    echecs += 1
    console.log(`ECHEC  ${rel}\n       - fichier introuvable`)
    continue
  }

  const source = readFileSync(fichier, 'utf8')
  const id = rel.replace(/[^a-z0-9]/gi, '_')
  const problemes = []
  let resume = ''

  try {
    const { descriptor, errors } = parse(source, { filename: rel })
    for (const erreur of errors) problemes.push(`parse: ${erreur.message}`)

    if (descriptor.script || descriptor.scriptSetup) {
      const script = compileScript(descriptor, { id })
      resume += `script ok (${Object.keys(script.bindings || {}).length} bindings) `
    } else {
      problemes.push('parse: aucun <script> trouvé')
    }

    if (descriptor.template) {
      const template = compileTemplate({
        source: descriptor.template.content,
        filename: rel,
        id,
        scoped: descriptor.styles.some(style => style.scoped)
      })
      for (const erreur of template.errors) problemes.push(`template: ${String(erreur.message || erreur)}`)
      resume += `template ok (${template.code.length} car.) `
    } else {
      problemes.push('template: aucun <template> trouvé')
    }

    for (const style of descriptor.styles) {
      const resultat = await compileStyleAsync({ source: style.content, filename: rel, id, scoped: style.scoped })
      for (const erreur of resultat.errors) problemes.push(`style: ${erreur.message}`)
      resume += `style${style.scoped ? '(scoped)' : ''} ok `
    }
  } catch (erreur) {
    problemes.push(`exception: ${erreur.message}`)
  }

  if (problemes.length) {
    echecs += 1
    console.log(`ECHEC  ${rel}`)
    for (const probleme of problemes) console.log(`       - ${probleme}`)
  } else {
    console.log(`OK     ${rel}  ->  ${resume.trim()}`)
  }
}

console.log(`\nProjet : ${projet}`)
console.log(`Fichiers compilés : ${cibles.length}  |  en échec : ${echecs}`)
process.exitCode = echecs ? 1 : 0
