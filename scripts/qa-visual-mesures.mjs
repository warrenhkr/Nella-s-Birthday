// scripts/qa-visual-matrix.mjs
//
// QA VISUELLE RÉELLE — matrice pages × résolutions × thèmes × styles.
//
// Étend scripts/qa-visual-cdp.mjs (même méthode : Chrome headless + CDP sur
// WebSocket natif, profil jetable, aucun paquet externe) avec :
//   - les 16 pages de la mission (publiques + protégées par rôle) ;
//   - 1440×900 (desktop) ET 375×667 (mobile) ;
//   - thème sombre/clair × style Persona/Cyberpunk (bascule réelle par le
//     bouton de l'interface, repli sur rechargement si le clic échoue) ;
//   - pour CHAQUE capture : erreurs console, requêtes réseau en échec,
//     débordement horizontal + éléments fautifs, images cassées,
//     éléments cliquables tronqués / trop petits / superposés, contraste.
//   - mode `editeur` : mesure dédiée de la VISIBILITÉ de l'éditeur de texte
//     riche de /dashboard-evenementiel (session ADMIN).
//
// LECTURE SEULE : aucune écriture dans le code applicatif. Sorties uniquement
// dans docs/qa-visual/ (captures + JSON) et docs/qa-runtime/RAPPORT-VISUEL.md.
//
// Usage :
//   node scripts/qa-visual-matrix.mjs                          # http://localhost:3226
//   QA_MODE=editeur node scripts/qa-visual-matrix.mjs
//   QA_ONLY=boutique,galerie node scripts/qa-visual-matrix.mjs # sous-ensemble
//   QA_BASE_URL=https://club-otaku-eneam.vercel.app node scripts/qa-visual-matrix.mjs
//
// Aucun mot de passe n'est imprimé : les comptes viennent de
// %USERPROFILE%/otaku-comptes-demo.txt (format « email rôle motdepasse »).

import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync, appendFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir, homedir } from 'node:os'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BASE = (process.env.QA_BASE_URL || 'http://localhost:3226').replace(/\/$/, '')
const OUT = join(ROOT, 'docs', 'qa-visual')
const SHOTS = join(OUT, 'captures')
const PORT = Number(process.env.CDP_PORT || 9361)
const MODE = process.env.QA_MODE || 'matrix'
const ONLY = (process.env.QA_ONLY || '').split(',').map(s => s.trim()).filter(Boolean)

const VIEWPORTS = [
  { label: '1440', width: 1440, height: 900, mobile: false },
  { label: '375', width: 375, height: 667, mobile: true }
]
const THEMES = ['dark', 'light']
const STYLES = ['persona', 'cyberpunk']
const BASE_STYLE = 'persona'

const PAGES = [
  { path: '/', name: 'accueil', role: null },
  { path: '/communaute', name: 'communaute', role: null },
  { path: '/galerie', name: 'galerie', role: null },
  { path: '/boutique', name: 'boutique', role: null },
  { path: '/auth', name: 'auth', role: null },
  { path: '/inscription', name: 'inscription', role: null },
  { path: '/evenements', name: 'evenements', role: 'MEMBER' },
  { path: '/espace-membre', name: 'espace-membre', role: 'MEMBER' },
  { path: '/tournois', name: 'tournois', role: 'MEMBER' },
  { path: '/equipes', name: 'equipes', role: 'MEMBER' },
  { path: '/dashboard', name: 'dashboard', role: 'ADMIN' },
  { path: '/dashboard-evenementiel', name: 'dashboard-evenementiel', role: 'ADMIN' },
  { path: '/dashboard-moderation', name: 'dashboard-moderation', role: 'ADMIN' },
  { path: '/dashboard-gaming', name: 'dashboard-gaming', role: 'ADMIN' },
  { path: '/boutique-catalogue', name: 'boutique-catalogue', role: 'SHOP_MANAGER' },
  { path: '/boutique-dashboard', name: 'boutique-dashboard', role: 'SHOP_MANAGER' }
]
const PROBES = [
  { path: '/dashboard-super-admin', name: 'dashboard-super-admin', role: 'ADMIN', note: 'aucun compte SUPER_ADMIN dans le fichier de comptes' }
]

// Bruit de développement à NE PAS compter comme défaut (constaté, écarté).
const CONSOLE_NOISE = [
  /Lit is in dev mode/,
  /Download the Vue Devtools/,
  /\[vite\]/,
  /\[nuxt\]/,
  /hot updated/i
]
const isConsoleNoise = (t) => CONSOLE_NOISE.some(rx => rx.test(t))

// ---------------------------------------------------------------------------
// Comptes (mot de passe jamais imprimé)
// ---------------------------------------------------------------------------
function loadAccountsByRole() {
  const file = join(homedir(), 'otaku-comptes-demo.txt')
  const byRole = {}
  if (!existsSync(file)) return byRole
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/)
    if (parts.length < 3 || !parts[0].includes('@') || !/^[A-Z_]+$/.test(parts[1])) continue
    ;(byRole[parts[1]] ||= []).push({ email: parts[0], password: parts[2] })
  }
  return byRole
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// Cache de jetons de session HORS DÉPÔT (le quota anti-force-brute de
// /api/auth/login est de 10 tentatives / 5 min par IP : on ne se reconnecte que
// si le jeton en cache n'est plus valide). Fichier dans le dossier temporaire
// du système, jamais dans le dépôt ; il ne contient que des jetons de session.
const TOKEN_CACHE = join(tmpdir(), 'otaku-qa-session-tokens.json')

function readTokenCache() {
  try { return JSON.parse(readFileSync(TOKEN_CACHE, 'utf8')) } catch { return {} }
}

async function tokenStillValid(token) {
  try {
    const response = await fetch(`${BASE}/api/auth/me`, { headers: { cookie: `otaku_session=${token}` } })
    if (!response.ok) return null
    const body = await response.json()
    return body?.data?.user?.role || null
  } catch { return null }
}

async function attemptLogin(email, password) {
  const response = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  if (response.status === 429) return { status: 429 }
  const raw = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')]
  for (const cookie of raw || []) {
    const match = /otaku_session=([^;]+)/.exec(cookie || '')
    if (match) return { status: response.status, token: match[1] }
  }
  return { status: response.status }
}

/** Connexion réelle par rôle : cache d'abord, puis chaque compte connu. */
async function acquireSessions(accountsByRole, report) {
  const tokens = {}
  const cache = readTokenCache()
  const wanted = ['ADMIN', 'SHOP_MANAGER', 'MEMBER']
  for (const role of wanted) {
    const typedRole = process.env.QA_ROLE ? process.env.QA_ROLE : role
    if (process.env.QA_ROLE && role !== process.env.QA_ROLE) continue
    if (cache[role]) {
      const validRole = await tokenStillValid(cache[role])
      if (validRole === typedRole) {
        tokens[role] = cache[role]
        report[role] = { email: '(jeton en cache)', session: 'obtenue', http: 200, source: 'cache' }
        console.log(`  session ${role} : jeton en cache encore valide (${validRole})`)
        continue
      }
    }
    const accounts = accountsByRole[role] || []
    for (const account of accounts) {
      let result = await attemptLogin(account.email, account.password)
      for (let retry = 0; result.status === 429 && retry < 2; retry++) {
        console.log(`  429 sur ${role} (quota anti-force-brute) — attente 70 s puis nouvel essai`)
        await sleep(70000)
        result = await attemptLogin(account.email, account.password)
      }
      if (result.token) {
        tokens[role] = result.token
        report[role] = { email: account.email, session: 'obtenue', http: result.status }
        const saved = readTokenCache()
        saved[role] = result.token
        try { writeFileSync(TOKEN_CACHE, JSON.stringify(saved)) } catch { /* ignore */ }
        console.log(`  session ${role} (${account.email}) : OK`)
        break
      }
      report[role] = report[role] || { email: account.email, session: 'échec', http: result.status }
      console.log(`  session ${role} (${account.email}) : échec HTTP ${result.status} — compte suivant`)
    }
    if (!tokens[role]) console.log(`  session ${role} : INDISPONIBLE`)
    await sleep(1200)
  }
  return tokens
}

// ---------------------------------------------------------------------------
// Client CDP
// ---------------------------------------------------------------------------
class CDP {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.handlers = new Map()
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      if (message.id && this.pending.has(message.id)) {
        const { resolve: res, reject } = this.pending.get(message.id)
        this.pending.delete(message.id)
        if (message.error) reject(new Error(JSON.stringify(message.error)))
        else res(message.result)
        return
      }
      if (message.method) {
        for (const handler of this.handlers.get(message.method) || []) handler(message.params)
      }
    }
  }

  on(method, handler) {
    const list = this.handlers.get(method) || []
    list.push(handler)
    this.handlers.set(method, list)
  }

  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolvePromise, reject) => {
      this.pending.set(id, { resolve: resolvePromise, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  once(method, timeout = 60000) {
    return new Promise((resolvePromise, reject) => {
      const timer = setTimeout(() => reject(new Error(`délai dépassé : ${method}`)), timeout)
      this.on(method, (params) => { clearTimeout(timer); resolvePromise(params) })
    })
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'erreur JS')
    return result.result?.value
  }
}

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
].filter(Boolean)

function chromePath() {
  const found = CHROME_CANDIDATES.find(candidate => existsSync(candidate))
  if (!found) throw new Error('Chrome/Edge introuvable — définis CHROME_PATH.')
  return found
}

async function waitForDevTools(port) {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (response.ok) return await response.json()
    } catch { /* pas encore prêt */ }
    await sleep(500)
  }
  throw new Error(`DevTools ne répond pas sur le port ${port}.`)
}

/** Tue l'arbre Chrome entier (le lanceur seul ne suffit pas sous Windows). */
function killChromeTree(pid) {
  try {
    spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
  } catch { /* ignore */ }
}

let activePort = PORT

async function launchChrome() {
  const profile = join(tmpdir(), `otaku-qa-matrix-${Date.now()}`)
  mkdirSync(profile, { recursive: true })
  let child = null
  for (let essai = 0; essai < 4; essai++) {
    activePort = PORT + essai
    child = spawn(chromePath(), [
      '--headless=new',
      `--remote-debugging-port=${activePort}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--hide-scrollbars',
      '--disable-extensions',
      '--force-device-scale-factor=1',
      'about:blank'
    ], { stdio: 'ignore' })
    try {
      await waitForDevTools(activePort)
      break
    } catch (error) {
      killChromeTree(child.pid)
      if (essai === 3) throw error
      await sleep(1500)
    }
  }

  const list = await (await fetch(`http://127.0.0.1:${activePort}/json/list`)).json()
  const page = list.find(target => target.type === 'page')
  if (!page) throw new Error('Aucune cible de page dans Chrome.')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  // Si Chrome meurt, on le dit TOUT DE SUITE au lieu de rester suspendu.
  ws.onclose = () => {
    console.error('ERREUR: la connexion de débogage Chrome s\'est fermée — ruche interrompue.')
    process.exit(3)
  }
  const cdp = new CDP(ws)
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Network.enable')
  await cdp.send('Log.enable')
  return { child, cdp, profile }
}

function attachCollectors(cdp, bucket) {
  cdp.on('Runtime.consoleAPICalled', (params) => {
    if (!['error', 'warning', 'assert'].includes(params.type)) return
    bucket.console.push({
      type: params.type,
      text: (params.args || []).map(a => a.value ?? a.description ?? a.type).join(' ').slice(0, 300)
    })
  })
  cdp.on('Runtime.exceptionThrown', (params) => {
    bucket.console.push({
      type: 'exception',
      text: (params.exceptionDetails?.exception?.description || params.exceptionDetails?.text || '').slice(0, 300)
    })
  })
  cdp.on('Log.entryAdded', (params) => {
    const e = params.entry
    if (e.level !== 'error') return
    bucket.console.push({ type: `log:${e.source}`, text: `${e.text} ${e.url || ''}`.slice(0, 300) })
  })
  cdp.on('Network.responseReceived', (params) => {
    const r = params.response
    if (r.status >= 400) bucket.network.push({ status: r.status, url: r.url.slice(0, 220), type: params.type })
  })
  cdp.on('Network.loadingFailed', (params) => {
    if (params.canceled) return
    bucket.network.push({ status: 0, url: `(échec ${params.errorText})`, type: params.type })
  })
}

const NETWORK_NOISE = [
  /\/@vite\/client/, /__nuxt_error/, /favicon\.ico/, /\.map$/, /_payload\.json/,
  /\/__nuxt/, /hot-update/, /chrome-extension/
]
const isNetworkNoise = (url) => NETWORK_NOISE.some(rx => rx.test(url))

// ---------------------------------------------------------------------------
// Navigation fiabilisée (le dev Nuxt renvoie une page VIDE à la compilation)
// ---------------------------------------------------------------------------
async function viewport(cdp, vp) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: vp.mobile,
    screenWidth: vp.width, screenHeight: vp.height
  })
}

async function pageState(cdp) {
  try {
    return await cdp.evaluate(`(() => ({
      url: location.href,
      ready: document.readyState,
      elements: document.querySelectorAll('body *').length,
      theme: document.documentElement.dataset.theme || null,
      style: document.documentElement.dataset.visualStyle || null,
      ancre: Boolean(document.querySelector('.app-shell, header, main, nav, #__nuxt > *')),
      visibles: [...document.querySelectorAll('body *')].filter(el => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0
      }).length
    }))()`)
  } catch {
    return null
  }
}

/** Attend que la page soit RÉELLEMENT rendue, hydratée, avec le bon thème/style. */
async function waitRendered(cdp, expect = {}, maxMs = 25000) {
  const start = Date.now()
  let state = null
  while (Date.now() - start < maxMs) {
    state = await pageState(cdp)
    const ok = state && state.ready === 'complete' && state.elements > 80 && state.ancre
      && (!expect.theme || state.theme === expect.theme)
      && (!expect.style || state.style === expect.style)
    if (ok) return { ok: true, state, waitedMs: Date.now() - start }
    await sleep(400)
  }
  return { ok: false, state, waitedMs: Date.now() - start }
}

/** Navigation + attente ; jusqu'à 3 essais (compilation dev = 1re page vide). */
async function navigatePrepared(cdp, path, expect) {
  const url = `${BASE}${path}`
  let last = { ok: false, state: null }
  for (let attempt = 1; attempt <= 3; attempt++) {
    const loaded = cdp.once('Page.loadEventFired', 60000).catch(() => null)
    await cdp.send('Page.navigate', { url })
    await loaded
    last = await waitRendered(cdp, expect, attempt === 1 ? 25000 : 15000)
    if (last.ok) return { ...last, attempts: attempt }
  }
  return { ...last, attempts: 3 }
}

async function setTokens(cdp, theme, style) {
  await cdp.evaluate(`(() => {
    localStorage.setItem('otaku-theme-v2', ${JSON.stringify(theme)});
    localStorage.setItem('otaku-visual-style-v2', ${JSON.stringify(style)});
    return true; })()`).catch(() => {})
}

async function shot(cdp, name) {
  const result = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(result.data, 'base64'))
  return `docs/qa-visual/captures/${name}.png`
}

// ---------------------------------------------------------------------------
// Métriques mesurées DANS la page
// ---------------------------------------------------------------------------
function measureFn() {
  const doc = document.documentElement
  const clientWidth = doc.clientWidth
  const visible = (el) => {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }
  const label = (el) => {
    const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60)
    const cls = typeof el.className === 'string' ? el.className.trim().replace(/\s+/g, '.').slice(0, 70) : ''
    return { tag: el.tagName.toLowerCase(), cls, text }
  }
  const path = (el) => {
    const parts = []
    let node = el
    for (let i = 0; i < 4 && node && node.tagName; i++) {
      const l = label(node)
      parts.unshift(`${l.tag}[${l.cls ? '.' + l.cls : ''}]`)
      node = node.parentElement
    }
    return parts.join(' > ')
  }

  const overflow = {
    scrollWidth: doc.scrollWidth,
    clientWidth,
    delta: doc.scrollWidth - clientWidth,
    bodyScrollWidth: document.body ? document.body.scrollWidth : null
  }

  // Couleur de fond effective (utile pour départager visibilité/transparence)
  const outOfView = []
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue
    const r = el.getBoundingClientRect()
    if (r.right <= clientWidth + 1 && r.left >= -1) continue
    const cs = getComputedStyle(el)
    const inFlow = cs.position === 'static' || cs.position === 'relative'
    outOfView.push({
      ...label(el), position: cs.position, inFlow,
      interactive: ['a', 'button', 'input', 'select', 'textarea'].includes(el.tagName.toLowerCase()),
      left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width),
      overflowPx: Math.round(r.right - clientWidth), path: path(el)
    })
  }
  outOfView.sort((a, b) => b.overflowPx - a.overflowPx)

  const brokenImages = []
  const images = [...document.querySelectorAll('img')]
  for (const img of images) {
    if (!visible(img)) continue
    if (img.complete && img.naturalWidth === 0) {
      brokenImages.push({ src: (img.currentSrc || img.src || '(vide)').slice(0, 200), alt: img.alt || null, ...label(img) })
    }
  }

  const truncated = []
  const smallTargets = []
  const clipped = []
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    const isClickable = ['a', 'button', 'input', 'select', 'textarea'].includes(el.tagName.toLowerCase())
      || el.getAttribute('role') === 'button' || cs.cursor === 'pointer'
    const tag = el.tagName.toLowerCase()
    if (isClickable && tag !== 'input' && (r.width < 24 || r.height < 24)) {
      smallTargets.push({ ...label(el), w: Math.round(r.width), h: Math.round(r.height) })
    }
    const hides = ['hidden', 'clip'].includes(cs.overflowX) || cs.textOverflow === 'ellipsis'
    if (!hides) continue
    const childOverflows = [...el.children].some(child => {
      const cr = child.getBoundingClientRect()
      return cr.right > r.right + 1 || cr.bottom > r.bottom + 1
    })
    if (childOverflows) continue
    if (!(el.textContent || '').trim()) continue
    const overX = el.scrollWidth - el.clientWidth
    const overY = el.scrollHeight - el.clientHeight
    if (isClickable && (overX > 1 || overY > 1)) {
      truncated.push({ ...label(el), overX, overY, w: Math.round(r.width), h: Math.round(r.height) })
    } else if (overX > 2 || overY > 2) {
      clipped.push({ ...label(el), overX, overY })
    }
  }

  const overlaps = []
  outer:
  for (const parent of document.querySelectorAll('body *')) {
    const kids = [...parent.children].filter(el => visible(el))
    if (kids.length < 2 || kids.length > 12) continue
    for (let i = 0; i < kids.length; i++) {
      for (let j = i + 1; j < kids.length; j++) {
        const a = kids[i].getBoundingClientRect()
        const b = kids[j].getBoundingClientRect()
        const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left)
        const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
        if (ix > 2 && iy > 2) {
          const ratio = (ix * iy) / Math.min(a.width * a.height, b.width * b.height)
          if (ratio > 0.25) {
            overlaps.push({ parent: path(parent), a: label(kids[i]), b: label(kids[j]), ratio: Math.round(ratio * 100) })
            if (overlaps.length > 12) break outer
          }
        }
      }
    }
  }

  const parseColor = (value) => {
    const m = /rgba?\(([^)]+)\)/.exec(value || '')
    if (!m) return null
    const n = m[1].split(',').map(v => Number(v.trim()))
    return { r: n[0], g: n[1], b: n[2], a: n.length > 3 ? n[3] : 1 }
  }
  const over = (fg, bg) => ({
    r: Math.round(fg.r * fg.a + bg.r * (1 - fg.a)),
    g: Math.round(fg.g * fg.a + bg.g * (1 - fg.a)),
    b: Math.round(fg.b * fg.a + bg.b * (1 - fg.a)),
    a: 1
  })
  const lum = (c) => {
    const ch = [c.r, c.g, c.b].map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) })
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
  }
  const ratio = (a, b) => { const la = lum(a), lb = lum(b); const hi = Math.max(la, lb), lo = Math.min(la, lb); return (hi + 0.05) / (lo + 0.05) }
  const lowContrast = []
  const uncheckedContrast = []
  let contrastChecked = 0
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1)
    if (!own) continue
    const cs = getComputedStyle(el)
    const fg = parseColor(cs.color)
    if (!fg) continue
    let node = el
    let bg = null
    let gradient = false
    while (node && node.tagName) {
      const ncs = getComputedStyle(node)
      if (ncs.backgroundImage && ncs.backgroundImage !== 'none') gradient = true
      const c = parseColor(ncs.backgroundColor)
      if (c && c.a > 0) { bg = bg ? over(bg, c) : c; if (c.a === 1) break }
      node = node.parentElement
    }
    if (!bg) bg = { r: 255, g: 255, b: 255, a: 1 }
    const composed = fg.a < 1 ? over(fg, bg) : fg
    const fontSize = parseFloat(cs.fontSize)
    const bold = Number(cs.fontWeight) >= 700
    const large = fontSize >= 24 || (fontSize >= 18.66 && bold)
    const seuil = large ? 3 : 4.5
    const r = ratio(composed, bg)
    contrastChecked++
    const record = {
      ...label(el), ratio: Math.round(r * 100) / 100, fontSize, color: cs.color,
      bg: `rgb(${bg.r},${bg.g},${bg.b})`, seuil, opacite: cs.opacity
    }
    if (gradient) {
      if (r < seuil) uncheckedContrast.push({ ...record, raison: 'fond en dégradé — non mesurable sans pixel' })
      continue
    }
    if (r < seuil) lowContrast.push(record)
  }
  lowContrast.sort((a, b) => a.ratio - b.ratio)

  const rootStyle = getComputedStyle(doc)
  const tokens = {
    bg: rootStyle.getPropertyValue('--bg-color').trim(),
    primary: rootStyle.getPropertyValue('--primary-color').trim(),
    accent: rootStyle.getPropertyValue('--accent-color').trim(),
    text: rootStyle.getPropertyValue('--text-color').trim()
  }

  return {
    url: location.href,
    title: document.title,
    themeAttr: doc.dataset.theme || null,
    styleAttr: doc.dataset.visualStyle || null,
    htmlClass: doc.className,
    tokens,
    elements: document.querySelectorAll('body *').length,
    overflow,
    outOfView: outOfView.slice(0, 12),
    outOfViewCount: outOfView.length,
    images: images.length,
    brokenImages,
    truncated: truncated.slice(0, 10),
    truncatedCount: truncated.length,
    clipped: clipped.slice(0, 10),
    clippedCount: clipped.length,
    smallTargets: smallTargets.slice(0, 10),
    smallTargetsCount: smallTargets.length,
    overlaps: overlaps.slice(0, 8),
    lowContrast: lowContrast.slice(0, 12),
    lowContrastCount: lowContrast.length,
    uncheckedContrast: uncheckedContrast.slice(0, 5),
    contrastChecked,
    h1: [...document.querySelectorAll('h1')].map(h => (h.textContent || '').trim().slice(0, 80))
  }
}

const MEASURE = `(${measureFn.toString()})()`

// ---------------------------------------------------------------------------
// Mode MATRICE
// ---------------------------------------------------------------------------
async function modeMatrix() {
  mkdirSync(SHOTS, { recursive: true })
  const accountsByRole = loadAccountsByRole()
  const capturesFile = join(OUT, 'captures.jsonl')
  const summaryFile = join(OUT, 'summary.json')
  // REPRENABLE : les exécutions partielles s'AJOUTENT (les entrées de même nom
  // sont remplacées) au lieu d'écraser le travail déjà fait.
  const summary = existsSync(summaryFile) ? JSON.parse(readFileSync(summaryFile, 'utf8')) : []
  const seen = new Set(summary.map(entry => entry.name))
  const sessionReport = {}

  const { child, cdp, profile } = await launchChrome()
  try {
    const tokens = await acquireSessions(accountsByRole, sessionReport)
    writeFileSync(join(OUT, 'sessions.json'), JSON.stringify(sessionReport, null, 2))

    const buckets = { console: [], network: [] }
    attachCollectors(cdp, buckets)

    const capture = async (page, vp, theme, style, expect, extra = {}) => {
      const name = `${page.name}-${vp.label}-${theme}-${style}`
      if (process.env.QA_RESUME === '1' && seen.has(name)) {
        const dejaVu = summary.find(entry => entry.name === name)
        if (dejaVu?.hydratation?.ok !== false) {
          console.log(`  ${name} — déjà mesuré (reprise), ignoré`)
          buckets.console.length = 0
          buckets.network.length = 0
          return null
        }
      }
      const metrics = await cdp.evaluate(MEASURE).catch(error => ({ erreur: String(error) }))
      const image = await shot(cdp, name)
      const consoleMessages = buckets.console.slice(0, 40)
      const network = buckets.network.filter(n => !isNetworkNoise(n.url)).slice(0, 40)
      const record = {
        page: page.path, pageName: page.name, role: page.role || 'GUEST',
        resolution: vp.label, theme, style, capture: image,
        hydratation: expect, console: consoleMessages, network, metrics
      }
      appendFileSync(capturesFile, JSON.stringify(record) + '\n')
      const m = metrics || {}
      const erreurs = consoleMessages.filter(c => !isConsoleNoise(c.text))
      const entree = {
        name, page: page.path, role: page.role || 'GUEST', resolution: vp.label, theme, style,
        capture: image, hydratation: expect, url: m.url, h1: m.h1, elements: m.elements,
        themeAttr: m.themeAttr, styleAttr: m.styleAttr, tokens: m.tokens,
        overflow: m.overflow, outOfViewCount: m.outOfViewCount, outOfView: (m.outOfView || []).slice(0, 5),
        brokenImages: m.brokenImages || [], truncatedCount: m.truncatedCount || 0,
        truncated: (m.truncated || []).slice(0, 5), clippedCount: m.clippedCount || 0,
        clipped: (m.clipped || []).slice(0, 5),
        smallTargetsCount: m.smallTargetsCount || 0, smallTargets: (m.smallTargets || []).slice(0, 5),
        overlaps: m.overlaps || [], lowContrastCount: m.lowContrastCount || 0,
        lowContrast: (m.lowContrast || []).slice(0, 6), contrastChecked: m.contrastChecked,
        uncheckedContrast: (m.uncheckedContrast || []).slice(0, 3),
        console: erreurs, network, ...extra
      }
      const existing = summary.findIndex(entry => entry.name === name)
      if (existing >= 0) summary[existing] = entree
      else summary.push(entree)
      seen.add(name)
      writeFileSync(summaryFile, JSON.stringify(summary, null, 2))
      console.log(`  ${name}${m.overflow?.delta > 0 ? ` DÉBORDEMENT +${m.overflow.delta}px` : ''} `
        + `(hydraté ${expect.ok ? 'oui' : 'NON'}, ${m.elements} nœuds, img cassées ${(m.brokenImages || []).length}, `
        + `tronqués ${m.truncatedCount || 0}, console ${erreurs.length}, réseau ${network.length}, `
        + `bas-contraste ${m.lowContrastCount || 0}/${m.contrastChecked})`)
      buckets.console.length = 0
      buckets.network.length = 0
      return record
    }

    for (const page of PAGES) {
      if (ONLY.length && !ONLY.includes(page.name)) continue
      await cdp.send('Network.clearBrowserCookies').catch(() => {})
      if (page.role && tokens[page.role]) {
        await cdp.send('Network.setCookie', {
          name: 'otaku_session', value: tokens[page.role], domain: new URL(BASE).hostname,
          path: '/', secure: BASE.startsWith('https'), httpOnly: true
        })
      }
      for (const vp of VIEWPORTS) {
        await viewport(cdp, vp)
        for (const theme of THEMES) {
          await setTokens(cdp, theme, BASE_STYLE)
          let nav = await navigatePrepared(cdp, page.path, { theme, style: BASE_STYLE })
          await capture(page, vp, theme, BASE_STYLE, { ok: nav.ok, tentatives: nav.attempts, attenduMs: nav.waitedMs })

          // Bascule RÉELLE vers cyberpunk par le bouton de l'interface
          const clic = await cdp.evaluate(`(() => {
            const btn = document.querySelector('.theme-switcher__button--style')
              || [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || '').startsWith('Activer le style'));
            if (!btn) return { clique: false, raison: 'bouton de style introuvable' };
            const avant = document.documentElement.dataset.visualStyle;
            btn.click();
            return { clique: true, avant }; })()`).catch(e => ({ clique: false, raison: String(e) }))
          let toggled = { ok: false }
          if (clic.clique) toggled = await waitRendered(cdp, { style: 'cyberpunk' }, 8000)
          let via = 'bouton interface'
          if (!toggled.ok) {
            via = 'rechargement (bascule par bouton inopérante)'
            await setTokens(cdp, theme, 'cyberpunk')
            nav = await navigatePrepared(cdp, page.path, { theme, style: 'cyberpunk' })
            toggled = { ok: nav.ok, state: nav.state }
          }
          await capture(page, vp, theme, 'cyberpunk', { ok: toggled.ok, bascule: via, clic: clic.clique })
        }
      }
    }

    for (const probe of PROBES) {
      if (ONLY.length && !ONLY.includes(probe.name)) continue
      await cdp.send('Network.clearBrowserCookies').catch(() => {})
      if (tokens[probe.role]) {
        await cdp.send('Network.setCookie', {
          name: 'otaku_session', value: tokens[probe.role], domain: new URL(BASE).hostname,
          path: '/', secure: BASE.startsWith('https'), httpOnly: true
        })
      }
      await viewport(cdp, VIEWPORTS[0])
      await navigatePrepared(cdp, probe.path, {})
      const state = await cdp.evaluate(`({
        demande: ${JSON.stringify(probe.path)}, urlFinal: location.href,
        h1: (document.querySelector('h1')?.textContent || '').trim().slice(0, 80)
      })`).catch(e => ({ erreur: String(e) }))
      const record = { ...probe, resultat: state }
      appendFileSync(capturesFile, JSON.stringify(record) + '\n')
      console.log(`  sonde ${probe.path} → ${state.urlFinal}`)
      writeFileSync(join(OUT, 'probes.json'), JSON.stringify([record], null, 2))
    }

    writeFileSync(join(OUT, 'meta.json'), JSON.stringify({
      base: BASE, date: new Date().toISOString(), viewports: VIEWPORTS, themes: THEMES,
      styles: STYLES, pages: PAGES.map(p => p.path), captures: summary.length, sessions: sessionReport
    }, null, 2))
    console.log(`\n${summary.length} captures écrites dans ${SHOTS}`)
  } finally {
    try { killChromeTree(child.pid) } catch { /* ignore */ }
    await sleep(1200)
    try { rmSync(profile, { recursive: true, force: true }) } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// Mode ÉDITEUR — visibilité de l'éditeur riche (/dashboard-evenementiel, ADMIN)
// ---------------------------------------------------------------------------
const EDITOR_MEASURE = `(() => {
  const probe = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      selecteur: el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().replace(/\\s+/g, '.') : ''),
      rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom) },
      offsetHeight: el.offsetHeight, offsetWidth: el.offsetWidth,
      clientHeight: el.clientHeight, clientWidth: el.clientWidth,
      scrollHeight: el.scrollHeight,
      display: cs.display, visibility: cs.visibility, opacity: cs.opacity,
      overflow: cs.overflow, position: cs.position, zIndex: cs.zIndex,
      color: cs.color, backgroundColor: cs.backgroundColor, fontSize: cs.fontSize,
      clipPath: cs.clipPath, transform: cs.transform, minHeight: cs.minHeight,
      contentVisibility: cs.contentVisibility, contain: cs.contain,
      dansViewport: r.top < window.innerHeight && r.bottom > 0 && r.width > 0 && r.height > 0,
      pixelsVisibles: Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0))
    };
  };
  const chain = (el, max) => {
    const out = [];
    let node = el;
    while (node && node.tagName && out.length < max) { out.push(probe(node)); node = node.parentElement; }
    return out;
  };
  const editable = document.querySelector('.ProseMirror[contenteditable="true"], [contenteditable="true"], .ProseMirror');
  const conteneur = editable ? editable.closest('[class*="rich-text-editor"]') : document.querySelector('[class*="rich-text-editor"]');
  const text = (editable?.textContent || '').trim();
  const before = editable ? getComputedStyle(editable, '::before') : null;
  const cible = editable?.getBoundingClientRect();
  const point = (cible && cible.width > 0 && cible.height > 0) ? {
    x: Math.round(cible.left + cible.width / 2),
    y: Math.round(cible.top + Math.min(cible.height / 2, 40))
  } : null;
  let dessus = null;
  if (point && point.y >= 0 && point.y <= window.innerHeight && point.x >= 0 && point.x <= window.innerWidth) {
    const el = document.elementFromPoint(point.x, point.y);
    dessus = el ? {
      point, tag: el.tagName.toLowerCase(),
      classe: typeof el.className === 'string' ? el.className.slice(0, 120) : '',
      estDansEditeur: Boolean(editable && editable.contains(el)),
      texte: (el.textContent || '').trim().slice(0, 40)
    } : { point, aucunElement: true };
  } else if (point) {
    dessus = { point, horsViewport: true, hauteurViewport: window.innerHeight };
  }
  const rectPage = cible ? { x: Math.round(cible.x + window.scrollX), y: Math.round(cible.y + window.scrollY), width: Math.round(cible.width), height: Math.round(cible.height) } : null;
  return {
    url: location.href,
    theme: document.documentElement.dataset.theme,
    style: document.documentElement.dataset.visualStyle,
    viewport: { w: window.innerWidth, h: window.innerHeight },
    scroll: { x: Math.round(window.scrollX), y: Math.round(window.scrollY) },
    rectPage,
    zoneEditable: probe(editable),
    chaineParents: chain(editable?.parentElement, 6),
    conteneur: probe(conteneur),
    texteContenu: text.slice(0, 60),
    nbCaracteres: text.length,
    placeholderPseudoElement: before ? { content: before.content, color: before.color, display: before.display, position: before.position, opacity: before.opacity, float: before.float } : null,
    paragrapheVide: Boolean(document.querySelector('.ProseMirror p.is-editor-empty, .is-editor-empty')),
    barreOutilsBoutons: conteneur ? conteneur.querySelectorAll('button').length : 0,
    rectangleBarreOutils: probe(conteneur ? conteneur.querySelector('[class*="toolbar"]') : null),
    dessusAuPoint: dessus,
    editorPresent: Boolean(editable),
    fallbackTextarea: Boolean(document.querySelector('textarea[placeholder*="Description"]'))
  };
})()`

async function modeEditeur() {
  mkdirSync(SHOTS, { recursive: true })
  const accountsByRole = loadAccountsByRole()
  const sessionReport = {}
  const { child, cdp, profile } = await launchChrome()
  const rapport = []
  try {
    const tokens = await acquireSessions({ ADMIN: accountsByRole.ADMIN || [] }, sessionReport)
    if (!tokens.ADMIN) throw new Error('Session ADMIN indisponible — mesure impossible.')
    await cdp.send('Network.setCookie', {
      name: 'otaku_session', value: tokens.ADMIN, domain: new URL(BASE).hostname,
      path: '/', secure: BASE.startsWith('https'), httpOnly: true
    })
    for (const vp of VIEWPORTS) {
      await viewport(cdp, vp)
      for (const theme of THEMES) {
        for (const motion of (vp.mobile ? ['no-preference'] : ['no-preference', 'reduce'])) {
          await cdp.send('Emulation.setEmulatedMedia', motion === 'reduce'
            ? { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }
            : { features: [] }).catch(() => {})
          await setTokens(cdp, theme, BASE_STYLE)
          const nav = await navigatePrepared(cdp, '/dashboard-evenementiel', { theme, style: BASE_STYLE })
          // Attente RÉELLE du montage de l'éditeur (composant .client + chunk async)
          let monte = false
          for (let attempt = 0; attempt < 30 && !monte; attempt++) {
            monte = await cdp.evaluate(`Boolean(document.querySelector('.ProseMirror, [contenteditable="true"]'))`).catch(() => false)
            if (!monte) await sleep(500)
          }
          // On amène l'éditeur dans la fenêtre, comme le ferait l'utilisateur
          const scroll = await cdp.evaluate(`(() => {
            const el = document.querySelector('.ProseMirror, [contenteditable="true"]');
            if (!el) return null;
            el.scrollIntoView({ block: 'center' });
            return true; })()`).catch(() => null)
          await sleep(1200)
          const mesure = await cdp.evaluate(EDITOR_MEASURE).catch(e => ({ erreur: String(e) }))
          const suffixe = motion === 'reduce' ? '-mouvement-reduit' : ''
          const imagePage = await shot(cdp, `editeur-riche-${vp.label}-${theme}${suffixe}`)
          // Capture RECADRÉE sur l'éditeur (coordonnées de PAGE + captureBeyondViewport)
          let imageEditor = null
          const rp = mesure.rectPage
          if (rp && rp.width > 0 && rp.height > 0) {
            const clip = {
              x: Math.max(0, rp.x - 20),
              y: Math.max(0, rp.y - 120),
              width: rp.width + 40,
              height: rp.height + 260,
              scale: 1
            }
            const result = await cdp.send('Page.captureScreenshot', {
              format: 'png', captureBeyondViewport: true, clip
            }).catch(() => null)
            if (result) {
              const file = join(SHOTS, `editeur-riche-zoom-${vp.label}-${theme}${suffixe}.png`)
              writeFileSync(file, Buffer.from(result.data, 'base64'))
              imageEditor = `docs/qa-visual/captures/editeur-riche-zoom-${vp.label}-${theme}${suffixe}.png`
            }
          }
          rapport.push({
            resolution: vp.label, theme, style: BASE_STYLE, mouvement: motion,
            capture: imagePage, captureZoom: imageEditor,
            hydratation: { ok: nav.ok, tentatives: nav.attempts }, editeurMonte: monte, scrollIntoView: scroll, mesure
          })
          const z = mesure.zoneEditable
          console.log(`  editeur ${vp.label}/${theme}/${motion} -> ${imagePage} ${imageEditor || ''}`)
          console.log(`    monte=${monte} zoneEditable=${z ? z.rect.width + 'x' + z.rect.height + ' @y=' + z.rect.top + ' display=' + z.display + ' visibility=' + z.visibility + ' opacity=' + z.opacity + ' clip=' + z.clipPath + ' dansViewport=' + z.dansViewport + ' pxVisibles=' + z.pixelsVisibles : 'ABSENT'}`)
          console.log(`    ::before content=${JSON.stringify(mesure.placeholderPseudoElement?.content)} couleur=${mesure.placeholderPseudoElement?.color} opacity=${mesure.placeholderPseudoElement?.opacity} | boutons barre=${mesure.barreOutilsBoutons} | dessusAuPoint=${JSON.stringify(mesure.dessusAuPoint)}`)
        }
      }
    }
    writeFileSync(join(OUT, 'editeur-riche.json'), JSON.stringify(rapport, null, 2))
    console.log('\nMesures écrites dans docs/qa-visual/editeur-riche.json')
  } finally {
    try { killChromeTree(child.pid) } catch { /* ignore */ }
    await sleep(1200)
    try { rmSync(profile, { recursive: true, force: true }) } catch { /* ignore */ }
  }
}

mkdirSync(OUT, { recursive: true })
if (MODE === 'matrix') await modeMatrix()
else if (MODE === 'editeur') await modeEditeur()
else { console.error(`Mode inconnu : ${MODE}`); process.exit(2) }
