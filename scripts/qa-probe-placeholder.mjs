// scripts/qa-probe-placeholder.mjs
//
// Sonde CIBLÉE : pourquoi le texte d'invite (placeholder) de l'éditeur riche de
// /dashboard-evenementiel ne s'affiche pas, alors que la zone de saisie, elle,
// est bien rendue (972×160, display block, visibility visible, opacity 1).
//
// LECTURE SEULE côté application. La seule écriture DOM autorisée ici est
// TEMPORAIRE et confinée au navigateur (injection d'une feuille de style de
// diagnostic) : elle sert à PROUVER la cause racine et n'est jamais enregistrée.
//
// Usage : node --env-file=.env scripts/qa-probe-placeholder.mjs

import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir, homedir } from 'node:os'

const BASE = (process.env.QA_BASE_URL || 'http://localhost:3226').replace(/\/$/, '')
const PORT = Number(process.env.CDP_PORT || 9371)
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
].filter(Boolean).find(p => existsSync(p))

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map()
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data)
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id)
        this.pending.delete(m.id)
        if (m.error) reject(new Error(JSON.stringify(m.error))); else resolve(m.result)
      }
    }
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })) })
  }
  async evaluate(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails).slice(0, 800))
    return r.result?.value
  }
}

const RAPPORT = `(() => {
  const p = document.querySelector('.rich-text-editor__content p.is-editor-empty, .rich-text-editor__content .is-editor-empty, .is-editor-empty');
  const zone = document.querySelector('.ProseMirror[contenteditable="true"], .rich-text-editor__content');
  const before = p ? getComputedStyle(p, '::before') : null;
  const info = (el, pseudo) => el ? {
    selecteur: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).trim().replace(/\\s+/g, '.') : ''),
    html: el.outerHTML.slice(0, 400),
    attributs: Object.fromEntries([...el.attributes].map(a => [a.name, a.value])),
    textContent: (el.textContent || '').slice(0, 80),
    estPremierEnfant: el === el.parentElement?.firstElementChild,
    nbEnfantsParent: el.parentElement ? el.parentElement.children.length : 0,
    parentSelecteur: el.parentElement ? el.parentElement.tagName.toLowerCase() + (el.parentElement.className ? '.' + String(el.parentElement.className).trim().replace(/\\s+/g, '.') : '') : null,
    pseudo: pseudo ? {
      content: pseudo.content, color: pseudo.color, display: pseudo.display,
      float: pseudo.float, height: pseudo.height, position: pseudo.position, opacity: pseudo.opacity
    } : null
  } : null;
  // Règles CSS réellement chargées qui mentionnent l'invite
  const regles = [];
  for (const sheet of document.styleSheets) {
    let rules = null;
    try { rules = sheet.cssRules } catch { continue }
    for (const rule of rules || []) {
      const texte = rule.cssText || '';
      if (texte.includes('is-editor-empty') || texte.includes('data-placeholder') || texte.includes('rich-text-editor__content')) {
        regles.push(texte.slice(0, 320));
      }
    }
  }
  return {
    url: location.href,
    theme: document.documentElement.dataset.theme,
    viewport: { w: window.innerWidth, h: window.innerHeight },
    paragrapheInvite: info(p, before),
    zoneSaisie: info(zone, null),
    minHeightApplique: zone ? getComputedStyle(zone).minHeight : null,
    couleurTexteZone: zone ? getComputedStyle(zone).color : null,
    reglesCSS: regles
  };
})()`

// Vérification de l'hypothèse : une règle de diagnostic injectée DANS la page
// (jamais dans le dépôt) doit faire apparaître l'invite si la cause est bien un
// sélecteur/attribut, et non une couleur ou une opacité.
const TEST = `(() => {
  const p = document.querySelector('.is-editor-empty');
  if (!p) return { possible: false, raison: 'aucun paragraphe .is-editor-empty' };
  const avant = getComputedStyle(p, '::before').content;
  const style = document.createElement('style');
  style.id = 'qa-diagnostic-placeholder';
  style.textContent = '.rich-text-editor__content .is-editor-empty::before{content:attr(data-placeholder);float:left;height:0;color:var(--muted-color)}';
  document.head.appendChild(style);
  const apres = getComputedStyle(p, '::before').content;
  const couleur = getComputedStyle(p, '::before').color;
  style.remove();
  return { possible: true, avant, apres, couleur, attributDataPlaceholder: p.getAttribute('data-placeholder') };
})()`

async function main() {
  const cache = JSON.parse(readFileSync(join(tmpdir(), 'otaku-qa-session-tokens.json'), 'utf8'))
  const token = cache.ADMIN
  if (!token) throw new Error('Jeton ADMIN absent du cache — lancez d\'abord scripts/qa-visual-mesures.mjs')

  const profile = join(tmpdir(), `otaku-qa-probe-${Date.now()}`)
  const child = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars', '--disable-extensions', 'about:blank'], { stdio: 'ignore' })

  let wsUrl = null
  for (let i = 0; i < 60 && !wsUrl; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      wsUrl = list.find(t => t.type === 'page')?.webSocketDebuggerUrl || null
    } catch { /* pas prêt */ }
    if (!wsUrl) await sleep(500)
  }
  const ws = new WebSocket(wsUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  const cdp = new CDP(ws)
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Network.enable')

  const resultats = {}
  try {
    await cdp.send('Network.setCookie', { name: 'otaku_session', value: token, domain: new URL(BASE).hostname, path: '/', secure: BASE.startsWith('https'), httpOnly: true })
    // Pré-navigation : localStorage n'est accessible que sur une page du site
    await cdp.send('Page.navigate', { url: `${BASE}/` })
    await sleep(6000)
    for (const theme of ['dark', 'light']) {
      await cdp.evaluate(`(() => { localStorage.setItem('otaku-theme-v2', ${JSON.stringify(theme)}); localStorage.setItem('otaku-visual-style-v2','persona'); return true })()`)
      await cdp.send('Page.navigate', { url: `${BASE}/dashboard-evenementiel` })
      for (let i = 0; i < 40; i++) {
        const ok = await cdp.evaluate(`Boolean(document.querySelector('.rich-text-editor__content'))`).catch(() => false)
        if (ok) break
        await sleep(500)
      }
      await cdp.evaluate(`document.querySelector('.rich-text-editor, .ProseMirror')?.scrollIntoView({block:'center'})`).catch(() => {})
      await sleep(1000)
      const rapport = await cdp.evaluate(RAPPORT)
      const test = await cdp.evaluate(TEST)
      resultats[theme] = { rapport, test }
      console.log(`\n===== THÈME ${theme} =====`)
      console.log('paragraphe invite :', JSON.stringify(rapport.paragrapheInvite, null, 2))
      console.log('min-height zone   :', rapport.minHeightApplique, '| couleur zone :', rapport.couleurTexteZone)
      console.log('test hypothèse    :', JSON.stringify(test))
      console.log('règles CSS trouvées :')
      for (const r of rapport.reglesCSS) console.log('   ', r)
    }
    writeFileSync(join(process.cwd(), 'docs', 'qa-visual', 'sonde-placeholder.json'), JSON.stringify(resultats, null, 2))
    console.log('\nRapport écrit : docs/qa-visual/sonde-placeholder.json')
  } finally {
    try { spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }) } catch { /* ignore */ }
  }
}

await main()
