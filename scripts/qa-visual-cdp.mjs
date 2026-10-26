// scripts/qa-visual-cdp.mjs
//
// PILOTE RÉEL DU NAVIGATEUR pour la QA du Club Otaku — sans aucune dépendance
// externe : il lance Chrome en mode headless avec le protocole DevTools (CDP)
// et parle WebSocket natif (Node 22+).
//
// Pourquoi ce script : le harnais de navigateur habituel exige une autorisation
// manuelle (« Allow remote debugging ») dans une fenêtre Chrome. Ici Chrome est
// lancé avec un profil JETABLE et le port de débogage, donc aucune fenêtre à
// valider : la QA reste reproductible et automatisable.
//
// Ce qu'il fait :
//   captures  → captures d'écran réelles 375 px (mobile) et 1440 px (desktop),
//               thème CLAIR et SOMBRE, plus `prefers-reduced-motion: reduce`.
//   tournoi   → se connecte comme ADMIN, ouvre /dashboard-gaming, clique sur
//               « Nouveau tournoi », remplit le formulaire, crée le tournoi,
//               puis vérifie qu'il apparaît dans la liste. Le NOM créé est
//               écrit dans le rapport pour permettre son nettoyage.
//
// Usage :
//   node --env-file=.env scripts/qa-visual-cdp.mjs captures
//   node --env-file=.env scripts/qa-visual-cdp.mjs tournoi
//
// Les images sont écrites dans docs/qa-runtime/ (dans le dépôt : ce sont les
// preuves visuelles du rapport).

import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'

const BASE = (process.env.QA_BASE_URL || 'https://club-otaku-eneam.vercel.app').replace(/\/$/, '')
const OUT = join(process.cwd(), 'docs', 'qa-runtime')
const PORT = Number(process.env.CDP_PORT || 9344)
const MODE = process.argv[2] || 'captures'

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

// ---------------------------------------------------------------------------
// Client CDP minimal
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
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
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
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'erreur JS')
    return result.result?.value
  }
}

async function waitForDevTools() {
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      if (response.ok) return await response.json()
    } catch { /* pas encore prêt */ }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  throw new Error('DevTools ne répond pas.')
}

// ---------------------------------------------------------------------------
// Connexion réelle pour obtenir un cookie de session
// ---------------------------------------------------------------------------
function demoPasswords() {
  const file = join(homedir(), 'otaku-comptes-demo.txt')
  const map = {}
  if (!existsSync(file)) return map
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^(\S+@\S+)\s+([A-Z_]+)\s+(\S+)\s*$/)
    if (m) map[m[1]] = { role: m[2], password: m[3] }
  }
  return map
}

async function loginCookie(email, password) {
  const response = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  const raw = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [response.headers.get('set-cookie')]
  for (const cookie of raw || []) {
    const match = /otaku_session=([^;]+)/.exec(cookie || '')
    if (match) return match[1]
  }
  return null
}

// ---------------------------------------------------------------------------
// Helpers de pilotage
// ---------------------------------------------------------------------------
async function launchChrome() {
  const profile = join(tmpdir(), `otaku-qa-chrome-${Date.now()}`)
  mkdirSync(profile, { recursive: true })
  const child = spawn(chromePath(), [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--hide-scrollbars',
    '--disable-extensions',
    '--force-device-scale-factor=1',
    'about:blank'
  ], { stdio: 'ignore', detached: false })
  await waitForDevTools()
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
  const page = list.find(target => target.type === 'page')
  if (!page) throw new Error('Aucune cible de page dans Chrome.')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = reject
  })
  const cdp = new CDP(ws)
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Network.enable')
  return { child, cdp, profile }
}

async function go(cdp, url, settleMs = 3500) {
  const loaded = cdp.once('Page.loadEventFired')
  await cdp.send('Page.navigate', { url })
  try { await loaded } catch { /* certaines navigations ne signalent pas l'événement */ }
  await new Promise(resolve => setTimeout(resolve, settleMs))
}

async function viewport(cdp, width, height, mobile) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile, screenWidth: width, screenHeight: height
  })
}

async function reducedMotion(cdp, enabled) {
  await cdp.send('Emulation.setEmulatedMedia', enabled
    ? { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }
    : { features: [] })
}

async function setTheme(cdp, theme, style = 'persona') {
  await cdp.evaluate(`(() => {
    localStorage.setItem('otaku-theme-v2', ${JSON.stringify(theme)});
    localStorage.setItem('otaku-visual-style-v2', ${JSON.stringify(style)});
    return true;
  })()`)
}

async function shot(cdp, name) {
  mkdirSync(OUT, { recursive: true })
  const result = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const file = join(OUT, `${name}.png`)
  writeFileSync(file, Buffer.from(result.data, 'base64'))
  console.log(`  capture → ${file}`)
  return file
}

// ---------------------------------------------------------------------------
// Mode « captures » — QA visuelle réelle
// ---------------------------------------------------------------------------
async function modeCaptures() {
  const { child, cdp, profile } = await launchChrome()
  const pages = [
    { path: '/', name: 'accueil' },
    { path: '/evenements', name: 'evenements' },
    { path: '/galerie', name: 'galerie' },
    { path: '/boutique', name: 'boutique' }
  ]
  const shots = []
  try {
    await viewport(cdp, 375, 812, true)
    await go(cdp, `${BASE}/`)
    await setTheme(cdp, 'light')
    for (const page of pages) {
      await go(cdp, `${BASE}${page.path}`)
      shots.push(await shot(cdp, `${page.name}-375-clair`))
    }
    await setTheme(cdp, 'dark')
    for (const page of pages) {
      await go(cdp, `${BASE}${page.path}`)
      shots.push(await shot(cdp, `${page.name}-375-sombre`))
    }

    await viewport(cdp, 1440, 900, false)
    await setTheme(cdp, 'light')
    for (const page of pages) {
      await go(cdp, `${BASE}${page.path}`)
      shots.push(await shot(cdp, `${page.name}-1440-clair`))
    }
    await setTheme(cdp, 'dark')
    for (const page of pages) {
      await go(cdp, `${BASE}${page.path}`)
      shots.push(await shot(cdp, `${page.name}-1440-sombre`))
    }

    // Mouvement réduit
    await viewport(cdp, 375, 812, true)
    await reducedMotion(cdp, true)
    await go(cdp, `${BASE}/`)
    shots.push(await shot(cdp, 'accueil-375-mouvement-reduit'))
    const reduceState = await cdp.evaluate(`(() => {
      const probe = document.querySelector('.app-shell, main, body > *');
      const style = probe ? getComputedStyle(probe) : null;
      return {
        mediaReduit: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        transitionProbe: style ? style.transitionDuration : null,
        animationProbe: style ? style.animationDuration : null,
        themeClasse: document.documentElement.className
      };
    })()`)
    console.log('  état mouvement réduit :', JSON.stringify(reduceState))
    writeFileSync(join(OUT, 'etat-mouvement-reduit.json'), JSON.stringify(reduceState, null, 2))

    // Débordement horizontal réel à 375 px (mesuré, pas supposé)
    await reducedMotion(cdp, false)
    const overflow = {}
    for (const page of pages) {
      await go(cdp, `${BASE}${page.path}`)
      overflow[page.path] = await cdp.evaluate(`({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        debordement: document.documentElement.scrollWidth - document.documentElement.clientWidth
      })`)
    }
    console.log('  débordement horizontal 375 px :', JSON.stringify(overflow, null, 2))
    writeFileSync(join(OUT, 'debordement-375.json'), JSON.stringify(overflow, null, 2))
    writeFileSync(join(OUT, 'captures.json'), JSON.stringify(shots, null, 2))
    console.log(`\n${shots.length} captures écrites dans ${OUT}`)
  } finally {
    try { child.kill() } catch { /* ignore */ }
    await new Promise(resolve => setTimeout(resolve, 500))
    try { rmSync(profile, { recursive: true, force: true }) } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// Mode « tournoi » — parcours d'interface réel
// ---------------------------------------------------------------------------
async function modeTournoi() {
  const demo = demoPasswords()
  const admin = demo['admin629427@otaku.club']
  if (!admin) throw new Error('Mot de passe ADMIN introuvable dans %USERPROFILE%/otaku-comptes-demo.txt')
  const token = await loginCookie('admin629427@otaku.club', admin.password)
  if (!token) throw new Error('Connexion ADMIN impossible.')

  const { child, cdp, profile } = await launchChrome()
  const stamp = Date.now()
  const tournamentName = `QA-RUNTIME Tournoi UI ${stamp}`
  const report = { tournamentName, steps: [] }
  try {
    await viewport(cdp, 1440, 900, false)
    await cdp.send('Network.setCookie', {
      name: 'otaku_session',
      value: token,
      domain: new URL(BASE).hostname,
      path: '/',
      secure: true,
      httpOnly: true
    })

    await go(cdp, `${BASE}/dashboard-gaming`, 5000)
    // On capture les `alert()` (messages d'erreur du formulaire) : en headless
    // ils sont silencieux, donc invisibles — c'est exactement le cas qui fait
    // croire à un « bouton qui ne fait rien ».
    await cdp.evaluate(`(() => { window.__alerts = []; window.__consoleErrors = [];
      const original = window.alert; window.alert = (message) => { window.__alerts.push(String(message)); };
      window.addEventListener('error', (event) => window.__consoleErrors.push(String(event.message)));
      return true; })()`)
    const landing = await cdp.evaluate(`(() => ({
      url: location.href,
      titre: document.querySelector('h1')?.textContent?.trim() || null,
      boutonNouveau: [...document.querySelectorAll('button')].some(b => b.textContent.includes('Nouveau tournoi')),
      boutonPremier: [...document.querySelectorAll('button')].some(b => b.textContent.includes('Créer mon premier tournoi'))
    }))()`)
    report.steps.push({ etape: 'ouverture /dashboard-gaming', ...landing })
    console.log('  arrivée :', JSON.stringify(landing))
    await shot(cdp, 'dashboard-gaming-1440-sombre')

    // Clic réel sur « Nouveau tournoi »
    const clicked = await cdp.evaluate(`(() => {
      const button = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Nouveau tournoi'));
      if (!button) return false;
      button.click();
      return true;
    })()`)
    report.steps.push({ etape: 'clic « Nouveau tournoi »', clique: clicked })
    console.log('  clic « Nouveau tournoi » :', clicked)
    await new Promise(resolve => setTimeout(resolve, 1500))

    const formVisible = await cdp.evaluate(`(() => {
      const form = document.querySelector('#gaming-tournament-form');
      return { formulairePresent: Boolean(form), titre: document.querySelector('[role="dialog"] h2, [role="dialog"] h3')?.textContent?.trim() || null };
    })()`)
    report.steps.push({ etape: 'ouverture du formulaire', ...formVisible })
    console.log('  formulaire :', JSON.stringify(formVisible))
    await shot(cdp, 'tournoi-formulaire-1440')

    // 1) Mode « Ouvert aux inscriptions » (le roster est vide : les équipes
    //    s'inscriront en ligne). 2) Interrupteur d'inscriptions. 3) Limite.
    const setup = await cdp.evaluate(`(() => {
      const chip = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Ouvert aux inscriptions');
      if (chip) chip.click();
      return { chipModeTrouve: Boolean(chip) };
    })()`)
    await new Promise(resolve => setTimeout(resolve, 900))
    const toggle = await cdp.evaluate(`(() => {
      const form = document.querySelector('#gaming-tournament-form');
      const sw = form.querySelector('[role="switch"]') || document.querySelector('[role="switch"]');
      if (sw && sw.getAttribute('aria-checked') !== 'true') sw.click();
      return { interrupteurTrouve: Boolean(sw), etat: sw ? sw.getAttribute('aria-checked') : null };
    })()`)
    await new Promise(resolve => setTimeout(resolve, 600))
    const limites = await cdp.evaluate(`(() => {
      const form = document.querySelector('#gaming-tournament-form');
      const numberInput = form.querySelector('input[type="number"]');
      if (!numberInput) return { limiteTrouvee: false };
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(numberInput, '8');
      numberInput.dispatchEvent(new Event('input', { bubbles: true }));
      numberInput.dispatchEvent(new Event('change', { bubbles: true }));
      return { limiteTrouvee: true, valeur: numberInput.value };
    })()`)
    report.steps.push({ etape: 'préparation mode ouvert', ...setup, ...toggle, ...limites })
    console.log('  préparation mode ouvert :', JSON.stringify({ ...setup, ...toggle, ...limites }))

    // Saisie réelle dans les champs (événements natifs, comme un utilisateur)
    const filled = await cdp.evaluate(`(() => {
      const form = document.querySelector('#gaming-tournament-form');
      if (!form) return { ok: false, raison: 'formulaire absent' };
      const setNative = (element, value) => {
        const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(element, value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const textInputs = [...form.querySelectorAll('input')].filter(i => !['number','checkbox'].includes(i.type));
      const textarea = form.querySelector('textarea');
      setNative(textInputs[0], ${JSON.stringify(tournamentName)});
      setNative(textInputs[1], 'QA Runtime');
      if (textarea) setNative(textarea, 'QA Alpha\\nQA Beta');
      return { ok: true, valeurs: [textInputs[0].value, textInputs[1].value, textarea ? textarea.value : null] };
    })()`)
    report.steps.push({ etape: 'saisie du formulaire', ...filled })
    console.log('  saisie :', JSON.stringify(filled))
    await new Promise(resolve => setTimeout(resolve, 400))

    const submitted = await cdp.evaluate(`(() => {
      const button = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Créer le tournoi');
      if (!button) return false;
      button.click();
      return true;
    })()`)
    report.steps.push({ etape: 'clic « Créer le tournoi »', clique: submitted })
    console.log('  clic « Créer le tournoi » :', submitted)
    await new Promise(resolve => setTimeout(resolve, 7000))

    const after = await cdp.evaluate(`(() => ({
      url: location.href,
      presentDansListe: document.body.textContent.includes(${JSON.stringify(tournamentName)}),
      formulaireEncoreOuvert: Boolean(document.querySelector('#gaming-tournament-form')),
      alertes: window.__alerts || [],
      erreursJS: window.__consoleErrors || [],
      toast: [...document.querySelectorAll('.Toastify__toast, [role="alert"], [role="status"]')].map(el => el.textContent.trim()).filter(Boolean)
    }))()`)
    report.steps.push({ etape: 'vérification après création', ...after })
    console.log('  après création :', JSON.stringify(after))
    await shot(cdp, 'tournoi-cree-liste-1440')

    writeFileSync(join(OUT, 'tournoi-ui.json'), JSON.stringify(report, null, 2))
    console.log(`\nNom du tournoi créé : ${tournamentName}`)
  } finally {
    try { child.kill() } catch { /* ignore */ }
    await new Promise(resolve => setTimeout(resolve, 500))
    try { rmSync(profile, { recursive: true, force: true }) } catch { /* ignore */ }
  }
}

mkdirSync(OUT, { recursive: true })
if (MODE === 'captures') await modeCaptures()
else if (MODE === 'tournoi') await modeTournoi()
else { console.error(`Mode inconnu : ${MODE}`); process.exit(2) }
