// scripts/test-produit-validation.mjs
//
// Vérification RÉELLE (pas simulée) de la validation du formulaire
// « Ajouter un produit » côté serveur (POST /api/boutique/catalog) :
//
//   1. CONTRÔLES STATIQUES du formulaire (app/pages/boutique-produits.vue) :
//      chaque champ doit être relié à `erreurs.<champ>` pour que l'erreur
//      s'affiche SOUS le champ concerné, et les champs obligatoires côté API
//      doivent porter l'astérisque (Tags, Catégorie, Images).
//   2. TEST HTTP RÉEL : connexion réelle via /api/auth/login avec un compte
//      SHOP_MANAGER (mot de passe par compte dans
//      %USERPROFILE%/otaku-comptes-demo.txt — JAMAIS imprimé), puis
//      POST /api/boutique/catalog avec une charge invalide par champ.
//      Chaque cas exige :
//        - HTTP 400 ;
//        - un `statusMessage` PRÉCIS (champ fautif + correction) et en FRANÇAIS ;
//        - `data.champs` renseigné pour le champ fautif.
//   3. Cas valide → HTTP 201, puis SUPPRESSION du produit créé
//      (DELETE /api/boutique/catalog/{id}) et comparaison du nombre de produits
//      en base avant/après (SELECT count(*) FROM la table réelle du modèle
//      Product, cf. prisma/schema.prisma) : la base doit être laissée intacte.
//   4. Vérification DOM de la NAVIGATION avec une VRAIE session (navigateur
//      headless jetable piloté en CDP, comme scripts/qa-visual-cdp.mjs) :
//      « Gestion boutique » ne doit apparaître qu'UNE fois (barre du haut ET
//      menu mobile). Le HTML SSR ne contient aucun lien de rôle, l'inspection
//      du DOM hydraté est donc le seul moyen de prouver ce point.
//
// Usage :
//   node scripts/test-produit-validation.mjs [http://localhost:3221]
//   SKIP_NAV=1 node scripts/test-produit-validation.mjs   # saute le navigateur
//
// Un test qui ne peut pas échouer ne prouve rien : toute imprécision
// (message générique, message anglais, champ absent de `data.champs`,
// produit non supprimé, comptage modifié, doublon dans la nav) fait sortir le
// script en code ≠ 0. MUTANT=1 rend volontairement une attente fausse pour
// prouver que la campagne sait échouer (elle doit alors sortir en code 1).

import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir, tmpdir } from 'node:os'
import { spawn } from 'node:child_process'
import dotenv from 'dotenv'
import pg from 'pg'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: resolve(ROOT, '.env'), quiet: true })

const baseUrl = (process.argv[2] || process.env.TEST_BASE_URL || 'http://127.0.0.1:3221').replace(/\/$/, '')
const timeoutMs = Number(process.env.TEST_TIMEOUT_MS || 20000)
const connectionString = process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL
const DEMO_PASSWORDS_FILE = resolve(homedir(), 'otaku-comptes-demo.txt')

// ── Mots de passe : fichier hors dépôt (un par compte) ou SEED_TEST_PASSWORD.
//    Aucune valeur n'est jamais imprimée, seul « connu / absent » est affiché.
function chargerComptes() {
  const comptes = new Map()
  if (!existsSync(DEMO_PASSWORDS_FILE)) return comptes
  for (const raw of readFileSync(DEMO_PASSWORDS_FILE, 'utf8').split(/\r?\n/)) {
    const ligne = raw.trim()
    if (!ligne || ligne.startsWith('#')) continue
    const parts = ligne.split(/\s+/)
    if (parts.length < 3 || !parts[0].includes('@')) continue
    comptes.set(parts[0].toLowerCase(), { role: parts[1], password: parts[2] })
  }
  return comptes
}

const comptes = chargerComptes()
const motDePasseGlobal = process.env.SEED_TEST_PASSWORD || ''
function identifiantsPour(email, compte) {
  return { email, password: motDePasseGlobal || compte.password }
}

let echecs = 0
let verifications = 0

function titre(texte = '') {
  console.log(texte ? `\n=== ${texte} ===` : '')
}

function verifier(condition, description, detail = '') {
  verifications++
  if (condition) {
    console.log(`  OK   ${description}`)
    return true
  }
  echecs++
  console.log(`  FAIL ${description}${detail ? ` → ${detail}` : ''}`)
  return false
}

async function http(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) })
}

async function posterJson(url, corps, cookie) {
  const entetes = { 'content-type': 'application/json' }
  if (cookie) entetes.cookie = cookie
  const reponse = await http(url, { method: 'POST', headers: entetes, body: JSON.stringify(corps) })
  let corpsReponse = null
  try {
    corpsReponse = await reponse.json()
  } catch {
    corpsReponse = null
  }
  return { statut: reponse.status, corps: corpsReponse, setCookie: reponse.headers.getSetCookie?.() || [] }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Contrôles statiques du formulaire (les bindings qui manquaient)
// ─────────────────────────────────────────────────────────────────────────────
async function controlesStatiques() {
  titre('1. Contrôles statiques du formulaire (app/pages/boutique-produits.vue)')
  const chemin = resolve(ROOT, 'app', 'pages', 'boutique-produits.vue')
  if (!existsSync(chemin)) {
    verifier(false, 'page boutique-produits.vue présente', chemin)
    return
  }
  const source = readFileSync(chemin, 'utf8')

  const liaisons = [
    [':error="erreurs.name || undefined"', 'erreur par champ : nom du produit'],
    [':error="erreurs.tag || undefined"', 'erreur par champ : tags'],
    [':error="erreurs.price || undefined"', 'erreur par champ : prix'],
    [':error="erreurs.stock || undefined"', 'erreur par champ : stock'],
    [':error="erreurs.whatsappNumber || undefined"', 'erreur par champ : WhatsApp'],
    ['v-if="erreurs.imageUrls"', 'erreur par champ : images'],
    ['v-if="messageErreur"', 'message d\'erreur global affiché dans la page'],
    [':title="messageErreur"', 'message d\'erreur global repris tel quel (précis)'],
    ['color: var(--primary-color);', 'astérisque d\'obligation (repère visuel du site)']
  ]
  for (const [motif, description] of liaisons) {
    verifier(source.includes(motif), description, `motif absent : ${motif}`)
  }
  // Les champs obligatoires côté API doivent porter l'astérisque :
  // le bloc « Tags » est celui qui n'en avait AUCUN (bug signalé).
  const blocTags = source.split('label="Tags"')[1]?.split('</UFormField>')[0] || ''
  verifier(/\brequired\b/.test(blocTags), 'le champ « Tags » est marqué obligatoire (astérisque)')
  const blocCategorie = source.split('label="Catégorie"')[1]?.split('/>')[0] || ''
  verifier(/\brequired\b/.test(blocCategorie), 'le champ « Catégorie » (AppSelect) est marqué obligatoire')
  const blocImages = source.split('Images du produit')[1]?.split('ImageUpload')[0] || ''
  const astérisqueImages = blocImages.includes('var(--primary-color)') && blocImages.includes('>*</span>')
  verifier(astérisqueImages, 'le bloc « Images du produit » porte l\'astérisque d\'obligation', blocImages.trim().slice(0, 120))
  // Le champ « Description » appartient à une autre vague : il ne doit pas être
  // modifié par ce correctif (aucun binding d'erreur dessus).
  verifier(!source.includes(':error="erreurs.description'), 'le champ « Description » n\'est pas touché (vague suivante)')
  // BUG TROUVÉ PAR CE TEST : sans `novalidate`, le `min="1"` du champ prix
  // déclenche la validation NATIVE du navigateur, le formulaire n'émet plus
  // l'événement submit… et `valider()` (donc les messages français par champ)
  // ne s'exécute JAMAIS. L'attribut est exigé ici pour que ça ne revienne pas.
  verifier(/\<form[\s\S]{0,200}\bnovalidate\b/.test(source),
    'le formulaire désactive la validation native (novalidate) pour que valider() s\'exécute')
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Test HTTP réel de la validation champ par champ
// ─────────────────────────────────────────────────────────────────────────────
const CHAMPS_ATTENDUS = {
  tag: 'tag',
  name: 'name',
  price: 'price',
  stock: 'stock',
  imageUrls: 'imageUrls',
  whatsappNumber: 'whatsappNumber',
  category: 'category'
}

const chargeValide = {
  name: 'Produit test validation (supprimé automatiquement)',
  tag: 'test, validation',
  category: 'goodies',
  description: 'Produit créé par scripts/test-produit-validation.mjs — supprimé juste après.',
  price: 12000,
  stock: 3,
  imageUrls: ['https://example.com/otaku-test-validation.jpg']
}

// Motif rédigé attendu (extrait du message exact) : le test ÉCHOUE dès que le
// message n'est plus celui rédigé (donc plus précis) pour ce champ.
const CAS_INVALIDES = [
  {
    nom: 'tags vides',
    charge: { ...chargeValide, tag: '' },
    champ: CHAMPS_ATTENDUS.tag,
    motDePasseAttendu: 'Renseigne au moins un tag'
  },
  {
    nom: 'tags absents',
    charge: (() => {
      const { tag, ...reste } = chargeValide
      return reste
    })(),
    champ: CHAMPS_ATTENDUS.tag,
    motDePasseAttendu: 'Renseigne au moins un tag'
  },
  {
    nom: 'nom trop court',
    charge: { ...chargeValide, name: 'A' },
    champ: CHAMPS_ATTENDUS.name,
    motDePasseAttendu: 'au moins 2 caractères'
  },
  {
    nom: 'nom absent',
    charge: (() => {
      const { name, ...reste } = chargeValide
      return reste
    })(),
    champ: CHAMPS_ATTENDUS.name,
    motDePasseAttendu: 'nom du produit est obligatoire'
  },
  {
    nom: 'prix en texte',
    charge: { ...chargeValide, price: '12000' },
    champ: CHAMPS_ATTENDUS.price,
    motDePasseAttendu: 'prix doit être un nombre'
  },
  {
    nom: 'prix à zéro',
    charge: { ...chargeValide, price: 0 },
    champ: CHAMPS_ATTENDUS.price,
    motDePasseAttendu: 'prix doit être un montant positif'
  },
  {
    nom: 'prix décimal',
    charge: { ...chargeValide, price: 120.5 },
    champ: CHAMPS_ATTENDUS.price,
    motDePasseAttendu: 'prix doit être un montant entier'
  },
  {
    nom: 'stock négatif',
    charge: { ...chargeValide, stock: -1 },
    champ: CHAMPS_ATTENDUS.stock,
    motDePasseAttendu: 'stock ne peut pas être négatif'
  },
  {
    nom: 'stock décimal',
    charge: { ...chargeValide, stock: 2.5 },
    champ: CHAMPS_ATTENDUS.stock,
    motDePasseAttendu: 'stock doit être une quantité entière'
  },
  {
    nom: 'aucune image',
    charge: { ...chargeValide, imageUrls: [] },
    champ: CHAMPS_ATTENDUS.imageUrls,
    motDePasseAttendu: 'au moins une image'
  },
  {
    nom: 'image qui n\'est pas une adresse',
    charge: { ...chargeValide, imageUrls: ['pas-une-url'] },
    champ: CHAMPS_ATTENDUS.imageUrls,
    motDePasseAttendu: 'Chaque image doit être une adresse valide'
  },
  {
    nom: 'WhatsApp sans indicatif (22900000000)',
    charge: { ...chargeValide, whatsappNumber: '22900000000' },
    champ: CHAMPS_ATTENDUS.whatsappNumber,
    motDePasseAttendu: 'format international'
  },
  {
    nom: 'WhatsApp avec un espace (+229 90 00 00 00)',
    charge: { ...chargeValide, whatsappNumber: '+229 90 00 00 00' },
    champ: CHAMPS_ATTENDUS.whatsappNumber,
    motDePasseAttendu: 'format international'
  },
  {
    nom: 'catégorie absente',
    charge: (() => {
      const { category, ...reste } = chargeValide
      return reste
    })(),
    champ: CHAMPS_ATTENDUS.category,
    motDePasseAttendu: 'Choisis une catégorie'
  }
]

// Preuve de FALSIFIABILITÉ : avec MUTANT=1, l'attente du premier cas est
// délibérément fausse. La campagne doit alors sortir en code 1 — c'est ce qui
// prouve que ces vérifications comparent bien le message RÉELLEMENT renvoyé par
// l'API (et non une constante recopiée du formulaire).
if (process.env.MUTANT === '1') {
  CAS_INVALIDES[0].motDePasseAttendu = 'Le tag est obligatoire.'
  console.log('  [MUTANT=1] attente du cas « tags vides » volontairement fausse : le test DOIT échouer.\n')
}

/**
 * Messages génériques : présents = le test échoue (aucune aide pour l'utilisateur).
 */
const MESSAGES_GENERIQUES = [
  'Informations produit invalides.',
  'Internal Server Error',
  'Bad Request',
  'Validation Error',
  'Invalid request body'
]

/** Le message doit être une phrase française rédigée, pas un message zod anglais. */
const DEBUT_FRANCAIS = /^(Le |La |Les |L'|Renseigne|Choisis|Ajoute|Trois|Chaque|Vérifie)/

async function testerValidation(cookie) {
  titre('2. Test HTTP réel : POST /api/boutique/catalog (charges invalides)')
  console.log(`  serveur ciblé : ${baseUrl}`)

  for (const cas of CAS_INVALIDES) {
    const { statut, corps } = await posterJson(`${baseUrl}/api/boutique/catalog`, cas.charge, cookie)
    const corpsErreur = corps && typeof corps === 'object' ? corps : {}
    const message = typeof corpsErreur.statusMessage === 'string' ? corpsErreur.statusMessage : ''
    const champs = (corpsErreur.data && typeof corpsErreur.data === 'object' && corpsErreur.data.champs) || null
    const messageChamp = champs && typeof champs === 'object' ? champs[cas.champ] : undefined

    console.log(`\n  ── ${cas.nom}`)
    console.log(`     HTTP ${statut} · statusMessage = ${JSON.stringify(message)}`)
    console.log(`     data.champs = ${JSON.stringify(champs)}`)

    verifier(statut === 400, `${cas.nom} : HTTP 400`, `obtenu ${statut}`)
    verifier(Boolean(message), `${cas.nom} : statusMessage non vide`)
    verifier(!MESSAGES_GENERIQUES.includes(message), `${cas.nom} : message non générique`, message)
    verifier(DEBUT_FRANCAIS.test(message), `${cas.nom} : message rédigé en français`, message)
    verifier(message.includes(cas.motDePasseAttendu), `${cas.nom} : message précis (« ${cas.motDePasseAttendu} »)`, message)
    verifier(typeof messageChamp === 'string' && messageChamp.length > 0,
      `${cas.nom} : data.champs.${cas.champ} renseigné`, JSON.stringify(messageChamp))
    verifier(messageChamp === message,
      `${cas.nom} : le détail par champ est le message affiché sous le champ`, `${JSON.stringify(messageChamp)} ≠ ${JSON.stringify(message)}`)
  }

  // Cas « tout faux » : le détail par champ doit couvrir PLUSIEURS champs, sinon
  // le formulaire ne peut pas souligner chaque champ fautif.
  console.log('\n  ── charge totalement invalide (détail multi-champs)')
  const chargeMultiple = { name: '', tag: '', category: '', price: -5, stock: -2, imageUrls: [] }
  const { statut, corps } = await posterJson(`${baseUrl}/api/boutique/catalog`, chargeMultiple, cookie)
  const champsMultiple = corps?.data?.champs && typeof corps.data.champs === 'object' ? corps.data.champs : {}
  console.log(`     HTTP ${statut} · statusMessage = ${JSON.stringify(corps?.statusMessage)}`)
  console.log(`     data.champs = ${JSON.stringify(champsMultiple)}`)
  verifier(statut === 400, 'charge totalement invalide : HTTP 400', `obtenu ${statut}`)
  // Seuls les champs réellement envoyés et fautifs doivent être détaillés
  // (whatsappNumber est optionnel : absent = pas d'erreur, c'est normal).
  const clesAttendues = ['name', 'tag', 'category', 'price', 'stock', 'imageUrls']
  const clesObtenues = Object.keys(champsMultiple)
  const clesManquantes = clesAttendues.filter(cle => !clesObtenues.includes(cle))
  verifier(clesManquantes.length === 0,
    'charge totalement invalide : tous les champs fautifs envoyés sont détaillés dans data.champs',
    `manquants : ${clesManquantes.join(', ')}`)
  verifier(Object.values(champsMultiple).every(valeur => typeof valeur === 'string' && DEBUT_FRANCAIS.test(valeur)),
    'charge totalement invalide : chaque message de champ est rédigé en français')
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Cas valide → 201, lecture, suppression, comptage avant/après
// ─────────────────────────────────────────────────────────────────────────────
async function testerCasValideEtNettoyage(cookie, compter) {
  titre('3. Cas valide : publication (201) puis suppression et comptage')

  const avant = await compter()
  console.log(`  produits en base avant : ${avant}`)

  const creation = await posterJson(`${baseUrl}/api/boutique/catalog`, chargeValide, cookie)
  const id = creation.corps?.data?.id
  console.log(`  POST /api/boutique/catalog → HTTP ${creation.statut} · id = ${id || '(absent)'}`)
  verifier(creation.statut === 201, 'charge valide : HTTP 201', `obtenu ${creation.statut}`)
  verifier(typeof id === 'string' && id.length > 0, 'charge valide : produit créé avec un id')

  if (typeof id === 'string' && id.length > 0) {
    const apresCreation = await compter()
    verifier(apresCreation === avant + 1, 'le produit est bien présent en base après publication',
      `${avant} → ${apresCreation}`)

    const suppression = await http(`${baseUrl}/api/boutique/catalog/${id}`, {
      method: 'DELETE',
      headers: { cookie }
    })
    console.log(`  DELETE /api/boutique/catalog/${id} → HTTP ${suppression.status}`)
    verifier(suppression.status === 200, 'suppression du produit de test : HTTP 200', `obtenu ${suppression.status}`)
  }

  const apres = await compter()
  console.log(`  produits en base après nettoyage : ${apres}`)
  verifier(apres === avant, 'base laissée intacte : même nombre de produits qu\'au départ', `${avant} → ${apres}`)
  return { avant, apres }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Vérification RÉELLE de la navigation (DOM d'un navigateur jetable, CDP)
//
// Bug signalé : « Gestion boutique » apparaissait DEUX FOIS dans la navigation
// d'un SHOP_MANAGER. Le HTML servi en SSR ne contient AUCUN lien de rôle (la
// session est chargée côté client après l'intro) : la seule preuve valable est
// donc l'inspection du DOM APRÈS hydratation, avec une VRAIE session.
// Approche reprise de scripts/qa-visual-cdp.mjs : Chrome/Edge en headless avec
// un profil jetable et le port de débogage — aucune fenêtre à valider.
// ─────────────────────────────────────────────────────────────────────────────
const PORT_CDP = Number(process.env.CDP_PORT_NAV || 9345)
const CHROME_CANDIDATS = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
].filter(Boolean)

class Cdp {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.attentes = new Map()
    this.evenements = new Map()
    ws.onmessage = (message) => {
      const donnees = JSON.parse(message.data)
      if (donnees.id && this.attentes.has(donnees.id)) {
        const { resolve: resoudre, reject: rejeter } = this.attentes.get(donnees.id)
        this.attentes.delete(donnees.id)
        if (donnees.error) rejeter(new Error(JSON.stringify(donnees.error)))
        else resoudre(donnees.result)
        return
      }
      if (donnees.method && this.evenements.has(donnees.method)) {
        for (const rappel of this.evenements.get(donnees.method)) rappel(donnees.params)
        this.evenements.delete(donnees.method)
      }
    }
  }

  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resoudre, rejeter) => {
      this.attentes.set(id, { resolve: resoudre, reject: rejeter })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  once(method, delai = 20000) {
    return new Promise((resoudre, rejeter) => {
      const minuteur = setTimeout(() => rejeter(new Error(`délai dépassé : ${method}`)), delai)
      const liste = this.evenements.get(method) || []
      liste.push((params) => { clearTimeout(minuteur); resoudre(params) })
      this.evenements.set(method, liste)
    })
  }

  async evaluate(expression) {
    const resultat = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (resultat.exceptionDetails) throw new Error(resultat.exceptionDetails.text || 'erreur JS dans la page')
    return resultat.result?.value
  }
}

async function attendreDevTools() {
  for (let essai = 0; essai < 60; essai++) {
    try {
      const reponse = await fetch(`http://127.0.0.1:${PORT_CDP}/json/version`)
      if (reponse.ok) return await reponse.json()
    } catch { /* pas encore prêt */ }
    await new Promise(resoudre => setTimeout(resoudre, 500))
  }
  throw new Error('le port de débogage du navigateur ne répond pas')
}

async function naviguer(cdp, url) {
  // Le gestionnaire d'échec est attaché DÈS la création : sinon, si la
  // navigation dépasse le délai (en dev, la première compilation Vite peut
  // prendre une minute), la promesse se rejette pendant qu'on l'attend encore
  // et Node la signale comme « unhandled rejection » (crash du script).
  const charge = cdp.once('Page.loadEventFired', 120000).catch(() => undefined)
  await cdp.send('Page.navigate', { url })
  await charge
}

/**
 * Attend que la navigation soit hydratée ET que la session soit chargée.
 * En dev, la PREMIÈRE page peut mettre plus d'une minute à s'hydrater (Vite
 * transforme les modules à la volée) : l'attente est donc longue, et une
 * évaluation qui tombe pendant une navigation est simplement retentée.
 */
async function attendreNavigationPrete(cdp, delaiMs = 180000) {
  const debut = Date.now()
  let dernier = null
  let prochainMessage = 15000
  while (Date.now() - debut < delaiMs) {
    try {
      dernier = await cdp.evaluate(`(() => {
        const nav = document.querySelector('nav.main-nav')
        const liens = nav ? [...nav.querySelectorAll('.main-nav__desktop a')] : []
        return {
          nbLiens: liens.length,
          connecte: document.body.innerText.includes('Mon espace'),
          libelles: liens.map(a => a.textContent.trim())
        }
      })()`)
    } catch {
      // contexte d'exécution détruit (navigation en cours) : on retente.
      dernier = dernier || { nbLiens: 0, connecte: false, libelles: [] }
    }
    if (dernier?.connecte && dernier.nbLiens > 0) return dernier
    const ecoule = Date.now() - debut
    if (ecoule >= prochainMessage) {
      console.log(`     … hydratation en cours (${Math.round(ecoule / 1000)} s)`)
      prochainMessage += 15000
    }
    await new Promise(resoudre => setTimeout(resoudre, 500))
  }
  return dernier
}

const LECTURE_NAV = `(() => {
  const nav = document.querySelector('nav.main-nav')
  const liens = nav ? [...nav.querySelectorAll('.main-nav__desktop a')] : []
  const destinations = liens.map(a => {
    const url = new URL(a.getAttribute('href'), location.origin)
    return url.pathname + url.hash
  })
  const texteNav = nav ? nav.textContent : ''
  const textePage = document.body.innerText || ''
  const compter = (texte, motif) => (texte.match(motif) || []).length
  return {
    libelles: liens.map(a => a.textContent.trim()),
    destinations,
    boutiqueDansNav: compter(texteNav, /Gestion boutique/g),
    boutiqueDansPage: compter(textePage, /Gestion boutique/g),
    liensVersBoutique: destinations.filter(destination => destination.startsWith('/boutique-dashboard')).length,
    doublons: destinations.filter((destination, index) => destinations.indexOf(destination) !== index)
  }
})()`

async function verifierNavigation(sessions) {
  titre('4. Vérification DOM de la navigation (« Gestion boutique » en double ?)')
  const navigateur = CHROME_CANDIDATS.find(candidat => existsSync(candidat))
  if (!navigateur) {
    verifier(false, 'navigateur Chrome/Edge présent pour l\'inspection DOM', 'définis CHROME_PATH')
    return
  }
  console.log(`  navigateur : ${navigateur}`)
  console.log('  (les mots de passe ne sont jamais imprimés ; sessions obtenues par HTTP)\n')

  const profil = join(tmpdir(), `otaku-nav-check-${Date.now()}`)
  mkdirSync(profil, { recursive: true })
  const enfant = spawn(navigateur, [
    '--headless=new',
    `--remote-debugging-port=${PORT_CDP}`,
    `--user-data-dir=${profil}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--hide-scrollbars',
    '--disable-extensions',
    'about:blank'
  ], { stdio: 'ignore' })

  let cdp = null
  try {
    await attendreDevTools()
    const cibles = await (await fetch(`http://127.0.0.1:${PORT_CDP}/json/list`)).json()
    const page = cibles.find(cible => cible.type === 'page')
    if (!page) throw new Error('aucune cible de page dans le navigateur')
    const ws = new WebSocket(page.webSocketDebuggerUrl)
    await new Promise((resoudre, rejeter) => {
      ws.onopen = resoudre
      ws.onerror = rejeter
    })
    cdp = new Cdp(ws)
    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')
    await cdp.send('Network.enable')

    let premier = true
    for (const session of sessions) {
      console.log(`  ── ${session.role} (${session.email})`)
      await cdp.send('Network.clearBrowserCookies')
      await cdp.send('Network.setCookie', {
        name: session.cookieNom,
        value: session.cookieValeur,
        url: `${baseUrl}/`,
        path: '/',
        httpOnly: true
      })
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 1440, height: 900, deviceScaleFactor: 1, mobile: false
      })
      await naviguer(cdp, `${baseUrl}/`)
      const pret = await attendreNavigationPrete(cdp)
      if (!premier) await new Promise(resoudre => setTimeout(resoudre, 1000))
      premier = false

      const etat = await cdp.evaluate(LECTURE_NAV)
      console.log(`     session chargée : ${pret?.connecte === true} · liens desktop : ${JSON.stringify(etat.libelles)}`)
      console.log(`     « Gestion boutique » → dans la nav : ${etat.boutiqueDansNav} · dans la page : ${etat.boutiqueDansPage} · liens vers /boutique-dashboard : ${etat.liensVersBoutique}`)

      verifier(pret?.connecte === true,
        `${session.role} : session réellement chargée dans le navigateur (liens de rôle affichés)`,
        JSON.stringify(pret?.libelles))
      verifier(etat.boutiqueDansNav === 1,
        `${session.role} : « Gestion boutique » apparaît UNE seule fois dans la navigation`,
        `occurrences = ${etat.boutiqueDansNav} (${JSON.stringify(etat.libelles)})`)
      verifier(etat.libelles.filter(libelle => libelle === 'Gestion boutique').length === 1,
        `${session.role} : un seul lien intitulé « Gestion boutique » dans la barre de navigation`,
        JSON.stringify(etat.libelles))
      console.log(`     (indicatif, hors nav : ${etat.boutiqueDansPage - etat.boutiqueDansNav} occurrence(s) ailleurs sur la page d’accueil)`)
      verifier(etat.liensVersBoutique === 1,
        `${session.role} : un seul lien vers /boutique-dashboard`,
        `${etat.liensVersBoutique} lien(s)`)
      verifier(etat.doublons.length === 0,
        `${session.role} : aucune destination en double dans la navigation`,
        `doublons : ${etat.doublons.join(', ')}`)
      if (session.role === 'INTERMEDIATE_ADMIN') {
        verifier(etat.libelles.includes('Administration'),
          'INTERMEDIATE_ADMIN : la nav propose bien « Administration » en plus de la gestion boutique',
          JSON.stringify(etat.libelles))
      }

      // Menu mobile (même tableau de liens, second rendu) : une seule occurrence
      // là aussi, sinon le bug reviendrait sur téléphone.
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 400, height: 820, deviceScaleFactor: 1, mobile: true
      })
      await new Promise(resoudre => setTimeout(resoudre, 800))
      const menuMobile = await cdp.evaluate(`(() => {
        const bouton = document.querySelector('.main-nav__menu-toggle')
        if (bouton) bouton.click()
        return Boolean(bouton)
      })()`)
      await new Promise(resoudre => setTimeout(resoudre, 1000))
      const liensMobile = await cdp.evaluate(`(() => [...document.querySelectorAll('.main-nav-mobile a')].map(a => a.textContent.trim()))()`)
      const occurrencesMobile = (liensMobile || []).filter(libelle => libelle.includes('Gestion boutique')).length
      console.log(`     menu mobile (${liensMobile?.length ?? 0} entrées) : « Gestion boutique » × ${occurrencesMobile}`)
      verifier(menuMobile === true, `${session.role} : menu mobile ouvert (bouton présent)`)
      verifier(occurrencesMobile === 1,
        `${session.role} : « Gestion boutique » apparaît UNE seule fois dans le menu mobile`,
        JSON.stringify(liensMobile))
    }
  } finally {
    try { enfant.kill() } catch { /* déjà arrêté */ }
    try { rmSync(profil, { recursive: true, force: true }) } catch { /* profil déjà supprimé */ }
  }
}

async function main() {
  await controlesStatiques()

  if (!connectionString) {
    console.error('DATABASE_URL absent (.env) : impossible de compter les produits.')
    process.exit(2)
  }

  const client = new pg.Client({
    connectionString,
    ssl: /sslmode=require/.test(connectionString) ? { rejectUnauthorized: false } : undefined
  })
  await client.connect()
  // Nom réel de la table des produits : prisma/schema.prisma mappe le modèle
  // Product sur `@@map("products")` — on lit la table réelle au lieu de la
  // supposer, puis on la cite entre guillemets.
  const { rows: tables } = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND lower(table_name) = 'products'`
  )
  const tableProduits = tables[0]?.table_name
  if (!tableProduits) {
    console.error('Table des produits introuvable (ni "products" ni "Product") : comptage impossible.')
    await client.end()
    process.exit(2)
  }
  console.log(`  table des produits : "${tableProduits}"`)
  const compter = async () => {
    const { rows } = await client.query(`SELECT count(*)::int AS total FROM "${tableProduits}"`)
    return rows[0].total
  }

  titre('0. Compte SHOP_MANAGER de test (lecture seule)')
  const cible = [...comptes.entries()].find(([, compte]) => compte.role === 'SHOP_MANAGER')
  if (!cible) {
    console.log(`  aucun compte SHOP_MANAGER dans ${DEMO_PASSWORDS_FILE}`)
    await client.end()
    process.exit(2)
  }
  const [email, compte] = cible
  console.log(`  compte : ${email} (${compte.role}) · mot de passe : ${motDePasseGlobal ? 'SEED_TEST_PASSWORD' : 'fichier hors dépôt'} (valeur jamais imprimée)`)

  try {
    const sonde = await http(`${baseUrl}/api/health`)
    console.log(`  sonde /api/health → HTTP ${sonde.status}`)
  } catch (error) {
    console.log(`  serveur injoignable (${error.name}: ${error.message})`)
    console.log(`  → lance le serveur puis relance : node scripts/test-produit-validation.mjs ${baseUrl}`)
    await client.end()
    process.exit(2)
  }

  const connexion = await posterJson(`${baseUrl}/api/auth/login`, identifiantsPour(email, compte))
  const enteteSession = connexion.setCookie[0] || ''
  const cookieName = enteteSession.split('=')[0]
  const cookieValeur = enteteSession.split('=').slice(1).join('=').split(';')[0]
  const cookie = connexion.setCookie.map(entree => entree.split(';')[0]).join('; ')
  console.log(`  POST /api/auth/login → HTTP ${connexion.statut} · session : ${cookie ? 'obtenue' : 'ABSENTE'}`)
  if (!cookie) {
    console.log('  → impossible de tester sans session (mot de passe invalide ?).')
    await client.end()
    process.exit(2)
  }

  await testerValidation(cookie)
  const comptage = await testerCasValideEtNettoyage(cookie, compter)

  // Vérification DOM de la navigation : SHOP_MANAGER (le bug signalé) +, si un
  // compte INTERMEDIATE_ADMIN à mot de passe connu existe, ce rôle aussi.
  const sessions = [{ role: compte.role, email, cookieNom: cookieName, cookieValeur }]
  const etatQa = resolve(homedir(), '.qa-runtime-sessions.json')
  if (existsSync(etatQa)) {
    try {
      const interadmin = JSON.parse(readFileSync(etatQa, 'utf8'))?.temp?.interadmin
      if (interadmin?.email && interadmin?.password) {
        const reponse = await posterJson(`${baseUrl}/api/auth/login`, { email: interadmin.email, password: interadmin.password })
        const entete = reponse.setCookie[0] || ''
        if (entete) {
          sessions.push({
            role: 'INTERMEDIATE_ADMIN',
            email: interadmin.email,
            cookieNom: entete.split('=')[0],
            cookieValeur: entete.split('=').slice(1).join('=').split(';')[0]
          })
          console.log(`  compte INTERMEDIATE_ADMIN (${interadmin.email}) : session obtenue (HTTP ${reponse.statut})`)
        } else {
          console.log(`  compte INTERMEDIATE_ADMIN (${interadmin.email}) : pas de session (HTTP ${reponse.statut}) → rôle non vérifié au navigateur`)
        }
      }
    } catch {
      console.log('  fichier .qa-runtime-sessions.json illisible → INTERMEDIATE_ADMIN non vérifié au navigateur')
    }
  }

  if (process.env.SKIP_NAV === '1') {
    titre('4. Vérification DOM de la navigation')
    console.log('  SKIP_NAV=1 : inspection du navigateur ignorée sur demande.')
  } else {
    await verifierNavigation(sessions)
  }

  await client.end()

  titre('5. Synthèse')
  console.log(`  ${verifications} vérification(s), ${echecs} échec(s).`)
  console.log(`  produits en base : ${comptage.avant} avant · ${comptage.apres} après (doit être identique).`)
  process.exit(echecs === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
