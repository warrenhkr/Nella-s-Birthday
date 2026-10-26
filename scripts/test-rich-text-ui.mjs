// scripts/test-rich-text-ui.mjs
// ---------------------------------------------------------------------------
// MESURE RÉELLE (Chrome headless + CDP) de l'éditeur de texte riche.
//
// Pourquoi ce script : le bug signalé est un éditeur « présent mais INVISIBLE »
// dans /dashboard-evenementiel. Impossible de trancher en lisant le CSS : on
// mesure donc le DOM réellement rendu (getBoundingClientRect, offsetHeight,
// styles calculés de la zone éditable ET de tous ses parents), puis on SAISIT
// du texte pour vérifier que la zone accepte la frappe et que le compteur
// réagit. Une capture d'écran est écrite dans docs/qa-runtime/.
//
// Aucune dépendance externe : Chrome est lancé par le script avec un profil
// jetable et le protocole DevTools, via le WebSocket natif de Node 22+.
//
// Usage :  node scripts/test-rich-text-ui.mjs [baseUrl]
// Sortie : code 1 dès qu'une mesure attendue n'est pas obtenue.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = (process.argv[2] || process.env.RICH_BASE_URL || 'http://localhost:3222').replace(/\/$/, '')
const OUT = join(process.cwd(), 'docs', 'qa-runtime')
const PORT = Number(process.env.CDP_PORT || 9355)

let failures = 0
let checks = 0
function check(label, condition, detail = '') {
  checks += 1
  if (condition) {
    console.log(`OK    | ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failures += 1
    console.log(`ECHEC | ${label}${detail ? ` — ${detail}` : ''}`)
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
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
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

async function launchChrome() {
  const profile = join(tmpdir(), `otaku-rte-chrome-${Date.now()}`)
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
    '--window-size=1440,1000',
    'about:blank'
  ], { stdio: 'ignore' })

  await waitForDevTools()
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
  const page = list.find(target => target.type === 'page')
  if (!page) throw new Error('Aucune cible de page dans Chrome.')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  const cdp = new CDP(ws)
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Network.enable')
  return { child, cdp, profile }
}

function demoAccount(wantedRole) {
  const file = join(homedir(), 'otaku-comptes-demo.txt')
  if (!existsSync(file)) return null
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^(\S+@\S+)\s+([A-Z_]+)\s+(\S+)\s*$/)
    if (m && m[2] === wantedRole) return { email: m[1], role: m[2], password: m[3] }
  }
  return null
}

async function loginCookie(account) {
  const response = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: account.email, password: account.password })
  })
  if (!response.ok) return { ok: false, status: response.status }
  const raw = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [response.headers.get('set-cookie')]
  for (const cookie of raw || []) {
    const match = /(otaku_session=[^;]+)/.exec(cookie || '')
    if (match) return { ok: true, pair: match[1] }
  }
  return { ok: false, status: 0 }
}

async function go(cdp, url, settleMs = 2500) {
  const loaded = cdp.once('Page.loadEventFired')
  await cdp.send('Page.navigate', { url })
  try { await loaded } catch { /* navigation sans événement */ }
  await new Promise(resolve => setTimeout(resolve, settleMs))
}

/**
 * L'application n'affiche son contenu qu'après la fin de l'intro-loader
 * (`showIntro` dans app/app.vue) : attendre explicitement `.app-shell` évite de
 * mesurer une page encore vide et de conclure à tort à un élément « invisible ».
 */
async function waitForShell(cdp, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const ready = await cdp.evaluate('Boolean(document.querySelector(".app-shell"))')
    if (ready) return true
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  return false
}

async function shot(cdp, name) {
  mkdirSync(OUT, { recursive: true })
  const result = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const file = join(OUT, `${name}.png`)
  writeFileSync(file, Buffer.from(result.data, 'base64'))
  return file
}

/** Mesure d'un élément + de toute sa chaîne de parents (cause d'une zone écrasée). */
const MEASURE = (selector) => `(() => {
  const target = document.querySelector(${JSON.stringify(selector)});
  if (!target) return { found: false };
  const describe = (el) => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return {
      tag: el.tagName.toLowerCase(),
      cls: typeof el.className === 'string' ? el.className : '',
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
      offsetH: el.offsetHeight,
      offsetW: el.offsetWidth,
      scrollH: el.scrollHeight,
      clientH: el.clientHeight,
      computed: {
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        height: style.height,
        minHeight: style.minHeight,
        maxHeight: style.maxHeight,
        overflow: style.overflow,
        position: style.position,
        zIndex: style.zIndex,
        color: style.color,
        backgroundColor: style.backgroundColor,
        fontSize: style.fontSize,
        whiteSpace: style.whiteSpace,
        padding: style.padding
      },
      contenteditable: el.getAttribute('contenteditable'),
      ariaLabel: el.getAttribute('aria-label'),
      ariaLabelledby: el.getAttribute('aria-labelledby'),
      ariaDescribedby: el.getAttribute('aria-describedby'),
      innerHTML: (el.innerHTML || '').slice(0, 200)
    };
  };
  const chain = [];
  let node = target;
  while (node && node !== document.documentElement.parentElement) {
    chain.push(describe(node));
    node = node.parentElement;
  }
  return { found: true, target: describe(target), chain, viewport: { w: innerWidth, h: innerHeight } };
})()`

/** Vrai dès qu'une des causes classiques d'invisibilité est détectée. */
function invisibilityCause(measure) {
  if (!measure?.found) return 'élément absent du DOM'
  const t = measure.target
  if (t.rect.h <= 1) return `hauteur de la zone = ${t.rect.h}px`
  if (t.computed.display === 'none') return 'display:none'
  if (t.computed.visibility === 'hidden') return 'visibility:hidden'
  if (Number(t.computed.opacity) === 0) return 'opacity:0'
  const hidden = measure.chain.find(node => node.computed.display === 'none' || node.computed.visibility === 'hidden' || node.rect.h === 0)
  if (hidden) return `parent masqué : ${hidden.tag}.${hidden.cls} (display=${hidden.computed.display}, h=${hidden.rect.h})`
  if (t.rect.w <= 1) return `largeur de la zone = ${t.rect.w}px`
  return null
}

async function main() {
  const account = demoAccount('ADMIN') || demoAccount('MEMBER')
  if (!account) {
    console.error('Aucun compte de démonstration utilisable — test impossible.')
    process.exit(2)
  }

  const { child, cdp, profile } = await launchChrome()
  try {
    console.log(`== Connexion réelle (${account.role}) sur ${BASE} ==`)
    const session = await loginCookie(account)
    check('POST /api/auth/login répond 200 avec un cookie de session', session.ok, `statut=${session.status}`)
    if (session.ok) {
      const [name, value] = session.pair.split('=')
      await cdp.send('Network.setCookie', { name, value, domain: 'localhost', path: '/' })
    }

    // ---------------------------------------------------------------------
    // 1. L'ÉDITEUR : /dashboard-evenementiel (Champ « Résumé »)
    // ---------------------------------------------------------------------
    console.log('\n== 1. Éditeur riche de /dashboard-evenementiel ==')
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
    await go(cdp, `${BASE}/dashboard-evenementiel`, 3000)
    check('l’application est sortie de l’intro-loader (.app-shell présent)', await waitForShell(cdp), 'sinon toute mesure serait trompeuse')
    await new Promise(resolve => setTimeout(resolve, 2000))
    console.log('   URL finale :', await cdp.evaluate('location.pathname'))

    // Attente du montage du composant (.client.vue → après hydratation)
    let measureEditor = { found: false }
    for (let attempt = 0; attempt < 20; attempt++) {
      measureEditor = await cdp.evaluate(MEASURE('.rich-text-editor, .ProseMirror, [contenteditable="true"]'))
      if (measureEditor.found) break
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    const root = await cdp.evaluate(MEASURE('.rich-text-editor'))
    check('le conteneur .rich-text-editor est monté', root.found, root.found ? `h=${root.target.rect.h}px` : 'introuvable')

    const editable = await cdp.evaluate(MEASURE('.rich-text-editor__content'))
    const cause = invisibilityCause(editable)
    check('la zone éditable est VISIBLE (hauteur > 0)', cause === null, cause || `h=${editable.target.rect.h}px, min-height=${editable.target.computed.minHeight}`)
    check('la zone éditable est en contenteditable', editable.found && editable.target.contenteditable === 'true', editable.found ? `contenteditable=${editable.target.contenteditable}` : '')
    check('la zone éditable est étiquetée (aria)', Boolean(editable.found && (editable.target.ariaLabel || editable.target.ariaLabelledby)), editable.found ? `aria-labelledby=${editable.target.ariaLabelledby}, aria-label=${editable.target.ariaLabel}` : '')

    if (editable.found) {
      console.log('   mesure zone éditable :', JSON.stringify({ rect: editable.target.rect, computed: { display: editable.target.computed.display, height: editable.target.computed.height, minHeight: editable.target.computed.minHeight, overflow: editable.target.computed.overflow, color: editable.target.computed.color, backgroundColor: editable.target.computed.backgroundColor, whiteSpace: editable.target.computed.whiteSpace } }))
      const suspects = editable.chain.filter(node => node.rect.h < 50 || node.computed.display === 'none' || node.computed.visibility === 'hidden')
      console.log('   parents suspects :', JSON.stringify(suspects.map(node => ({ tag: node.tag, cls: node.cls.slice(0, 60), h: node.rect.h, display: node.computed.display, overflow: node.computed.overflow, maxHeight: node.computed.maxHeight }))))

      // Hypothèse signalée côté client : une règle enfermée dans
      // `@media (prefers-reduced-motion: reduce)` masquerait la zone.
      await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
      await new Promise(resolve => setTimeout(resolve, 500))
      const reduced = await cdp.evaluate(MEASURE('.rich-text-editor__content'))
      const reducedCause = invisibilityCause(reduced)
      check('la zone éditable reste visible avec prefers-reduced-motion: reduce', reducedCause === null && reduced.target.rect.h > 0, reducedCause || `h=${reduced.target.rect.h}px, min-height=${reduced.target.computed.minHeight}`)
      await cdp.send('Emulation.setEmulatedMedia', { features: [] })
    }

    // Saisie RÉELLE dans la zone éditable (il faut d'abord l'amener à l'écran :
    // un clic à des coordonnées hors viewport ne touche jamais l'élément).
    if (editable.found && editable.target.rect.h > 0) {
      await cdp.evaluate('document.querySelector(".rich-text-editor")?.scrollIntoView({ block: "center" })')
      await new Promise(resolve => setTimeout(resolve, 600))
      const box = await cdp.evaluate('(() => { const el = document.querySelector(".rich-text-editor__content"); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })()')
      console.log('   zone éditable après défilement :', JSON.stringify(box))
      const x = box.x + Math.min(60, Math.max(10, box.w / 2))
      const y = box.y + Math.min(20, Math.max(4, box.h / 2))
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
      await new Promise(resolve => setTimeout(resolve, 400))
      check('le champ reçoit le focus', await cdp.evaluate('document.activeElement?.classList.contains("rich-text-editor__content") === true'), `activeElement=${await cdp.evaluate('document.activeElement?.className || "aucun"')}`)

      const before = await cdp.evaluate('document.querySelector(".rich-text-editor__footer, .rich-text-editor")?.textContent?.trim().slice(0, 60) || ""')
      await cdp.send('Input.insertText', { text: 'Soirée jeux vidéo : tournoi Smash à 18 h.' })
      await new Promise(resolve => setTimeout(resolve, 500))

      const html = await cdp.evaluate('document.querySelector(".rich-text-editor__content")?.innerHTML || ""')
      const after = await cdp.evaluate('document.querySelector(".rich-text-editor__content")?.textContent || ""')
      check('la frappe produit du HTML dans le champ', /<p\b/.test(html), `innerHTML=${JSON.stringify(html.slice(0, 120))}`)
      check('le texte saisi est bien dans la zone', after.includes('tournoi Smash'), `texte=${JSON.stringify(after.slice(0, 80))}`)
      console.log('   pied avant/après :', JSON.stringify(before), '→', JSON.stringify(await cdp.evaluate('document.querySelector(".rich-text-editor")?.textContent?.trim().slice(0, 80) || ""')))
    }

    const editorShot = await shot(cdp, 'rich-text-editor-dashboard-evenementiel')
    console.log('   capture →', editorShot)

    // ---------------------------------------------------------------------
    // 1bis. ALLER-RETOUR API : contenu riche enregistré, nettoyé, relu
    // ---------------------------------------------------------------------
    console.log('\n== 1bis. Aller-retour API (publication communautaire) ==')
    const roundTrip = await cdp.evaluate(`(async () => {
      const payload = {
        pole: 'all',
        content: '<p>Soirée <strong>tournoi</strong> samedi</p><script>alert(1)</script><ul><li>Smash</li><li>Tekken</li></ul><p><a href="javascript:alert(1)">clic</a> et <img src="data:text/html;base64,AAA" alt="x"></p><p style="background: url(javascript:alert(1))">style</p>'
      };
      const created = await fetch('/api/communaute/posts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const createdBody = await created.json().catch(() => null);
      const id = createdBody?.data?.id || null;
      const list = await fetch('/api/communaute/posts', { credentials: 'same-origin' }).then(r => r.json());
      const stored = (list.data || []).find(post => post.id === id) || null;
      return {
        status: created.status,
        id,
        stored: stored ? stored.content : null,
        authorPseudo: stored?.author?.pseudo || null
      };
    })()`)
    console.log('   statut création :', roundTrip.status, '| id :', roundTrip.id)
    console.log('   contenu RELU en base :', JSON.stringify(roundTrip.stored))
    check('la publication riche est créée (201)', roundTrip.status === 201)
    const storedHtml = String(roundTrip.stored || '')
    check('le <script> est retiré du contenu enregistré', !/script/i.test(storedHtml))
    check('le lien javascript: est neutralisé', !/javascript:/i.test(storedHtml))
    check('l’image data: est retirée', !/data:/i.test(storedHtml))
    check('la mise en forme légitime est conservée', /<strong>tournoi<\/strong>/.test(storedHtml) && /<li>Smash<\/li>/.test(storedHtml))

    // Refus attendus (aucune DONNÉE écrite : uniquement des 400) — ils prouvent
    // que les minimums/maximums comptent le TEXTE et non le balisage.
    const refusals = await cdp.evaluate(`(async () => {
      const post = (url, body) => fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      }).then(r => r.status);
      return {
        postBalisesSeules: await post('/api/communaute/posts', { pole: 'all', content: '<p></p><p><br></p>' }),
        postTropCourt: await post('/api/communaute/posts', { pole: 'all', content: 'ok' }),
        postTropLong: await post('/api/communaute/posts', { pole: 'all', content: '<p>' + 'a'.repeat(5001) + '</p>' }),
        signalementBalisesSeules: await post('/api/issue-reports', { title: 'Contrôle', description: '<p></p><p></p><p></p>', category: 'BUG' })
      };
    })()`)
    console.log('   refus attendus (statuts) :', JSON.stringify(refusals))
    check('publication réduite à des balises refusée (400)', refusals.postBalisesSeules === 400, `statut=${refusals.postBalisesSeules}`)
    check('publication de 2 caractères refusée (400)', refusals.postTropCourt === 400, `statut=${refusals.postTropCourt}`)
    check('publication de 5 001 caractères de texte refusée (400)', refusals.postTropLong === 400, `statut=${refusals.postTropLong}`)
    check('signalement « balises seules » refusé (400)', refusals.signalementBalisesSeules === 400, `statut=${refusals.signalementBalisesSeules}`)

    // Affichage réel de cette publication dans la page Communauté (onglet
    // « Annonces » : l'état de navigation vit dans l'URL de la page).
    await go(cdp, `${BASE}/communaute?vue=annonces`, 3000)
    await waitForShell(cdp)
    await new Promise(resolve => setTimeout(resolve, 2500))
    const communityDisplay = await cdp.evaluate(`(() => {
      const blocks = Array.from(document.querySelectorAll('.rich-text-content'));
      const target = blocks.find(el => el.innerHTML.includes('tournoi'));
      return {
        blocks: blocks.length,
        found: Boolean(target),
        html: target ? target.innerHTML.slice(0, 220) : null,
        height: target ? Math.round(target.getBoundingClientRect().height) : 0,
        scriptTags: target ? target.querySelectorAll('script').length : -1,
        bold: target ? target.querySelectorAll('strong, b').length : 0,
        items: target ? target.querySelectorAll('li').length : 0
      };
    })()`)
    console.log('   affichage communauté :', JSON.stringify(communityDisplay))
    check('la publication riche est AFFICHÉE en HTML formaté', communityDisplay.found && communityDisplay.bold > 0 && communityDisplay.items > 0, JSON.stringify(communityDisplay))
    check('le bloc affiché occupe une hauteur réelle (onglet Annonces)', communityDisplay.height > 0, `h=${communityDisplay.height}px`)
    check('aucun <script> dans le HTML affiché', communityDisplay.scriptTags === 0)
    // Nettoyage : la publication de test ne doit pas rester en base
    if (roundTrip.id) {
      const removed = await cdp.evaluate(`fetch('/api/communaute/posts/${roundTrip.id}', { method: 'DELETE' }).then(r => r.status)`)
      console.log('   suppression de la publication de test :', removed)
    }

    // ---------------------------------------------------------------------
    // 2. L'AFFICHAGE : la description d'événement relue par RichTextContent
    // ---------------------------------------------------------------------
    console.log('\n== 2. Affichage RichTextContent (description d’événement) ==')
    const eventsApi = await cdp.evaluate(`fetch('/api/events', { credentials: 'same-origin' }).then(r => r.json()).then(d => {
      const list = d.data || d.events || [];
      const withText = list.find(e => e.description && /<[a-z]/.test(String(e.description)));
      return { count: list.length, sample: withText ? { title: withText.title, description: String(withText.description).slice(0, 160) } : null };
    })`)
    console.log('   API événements :', JSON.stringify(eventsApi))

    await go(cdp, `${BASE}/evenements`, 3000)
    await waitForShell(cdp)
    await new Promise(resolve => setTimeout(resolve, 2000))
    const rendered = await cdp.evaluate(`(() => {
      const nodes = Array.from(document.querySelectorAll('.rich-text-content'));
      return nodes.slice(0, 5).map(el => ({
        h: Math.round(el.getBoundingClientRect().height),
        htmlLength: el.innerHTML.length,
        bold: el.querySelectorAll('strong, b').length,
        lists: el.querySelectorAll('ul, ol, li').length,
        scripts: el.querySelectorAll('script').length,
        sample: el.innerHTML.slice(0, 120)
      }));
    })()`)
    console.log('   blocs .rich-text-content :', JSON.stringify(rendered))
    check('des blocs .rich-text-content sont rendus', rendered.length > 0, `${rendered.length} bloc(s)`)
    check('les blocs affichés ont une hauteur > 0', rendered.every(block => block.h > 0), JSON.stringify(rendered.map(b => b.h)))
    check('aucune balise script dans le contenu affiché', rendered.every(block => block.scripts === 0))
    const eventsShot = await shot(cdp, 'rich-text-content-evenements')
    console.log('   capture →', eventsShot)

    console.log(`\n${checks} vérifications — ${failures === 0 ? 'TOUT OK' : `${failures} ECHEC(S)`}`)
  } finally {
    try { child.kill() } catch { /* déjà arrêté */ }
    try { rmSync(profile, { recursive: true, force: true }) } catch { /* profil verrouillé */ }
  }

  process.exit(failures === 0 ? 0 : 1)
}

await main()
