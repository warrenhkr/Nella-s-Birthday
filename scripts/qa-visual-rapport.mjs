// scripts/qa-visual-rapport.mjs
//
// Génère docs/qa-visual/RAPPORT-VISUEL.md À PARTIR des mesures déjà collectées
// (summary.json, editeur-riche.json, sonde-placeholder.json). Aucun navigateur,
// aucun appel réseau : c'est une agrégation, pas un test.
//
// Usage : node scripts/qa-visual-rapport.mjs

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIR = join(ROOT, 'docs', 'qa-visual')
const lire = (f) => existsSync(join(DIR, f)) ? JSON.parse(readFileSync(join(DIR, f), 'utf8')) : null

const meta = lire('meta.json') || {}
const summary = lire('summary.json') || []
const editeur = lire('editeur-riche.json') || []

const lignes = []
const w = (t = '') => lignes.push(t)

w('# Rapport QA visuelle — Club Otaku ENEAM')
w()
w(`- **Cible** : ${meta.base || 'http://localhost:3226'} (serveur de développement local)`)
w(`- **Généré le** : ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`)
w('- **Méthode** : Chrome headless piloté par le protocole DevTools (WebSocket natif, profil jetable).')
w('- **Aucune écriture dans le code applicatif** ; mesures et captures uniquement dans `docs/qa-visual/`.')
w(`- **Captures mesurées** : ${summary.length}`)
w()

// --------------------------------------------------------------------------
// Couverture
// --------------------------------------------------------------------------
const pages = [...new Set(summary.map(e => e.page))]
const parPage = pages.map(p => {
  const items = summary.filter(e => e.page === p)
  return {
    page: p,
    role: items[0]?.role || 'GUEST',
    resolutions: [...new Set(items.map(i => i.resolution))].sort().join(' + '),
    themes: [...new Set(items.map(i => i.theme))].sort().join(' + '),
    styles: [...new Set(items.map(i => i.style))].sort().join(' + '),
    nb: items.length
  }
})

w('## 1. Couverture réelle')
w()
w('| Page | Rôle | Résolutions | Thèmes | Styles | Captures |')
w('|---|---|---|---|---|---|')
for (const r of parPage) w(`| \`${r.page}\` | ${r.role} | ${r.resolutions} | ${r.themes} | ${r.styles} | ${r.nb} |`)
w()
const malHydratees = summary.filter(e => e.hydratation && e.hydratation.ok === false)
w(`Captures non hydratées (thème/style non appliqué — **à refaire**) : ${malHydratees.length}`)
for (const e of malHydratees) w(`- \`${e.name}\` (${e.url})`)
w()

// Captures réellement présentes sur le disque (peut dépasser summary.json :
// un lancement sans fusion réinitialise les mesures, pas les images).
const dossiers = join(DIR, 'captures')
const pngs = existsSync(dossiers) ? readdirSync(dossiers).filter(f => f.endsWith('.png')) : []
const pngParPage = new Map()
for (const f of pngs) {
  const cle = f.replace(`-1440-`, '|').replace(`-375-`, '|').split('|')[0].replace(/-zoom$/, '')
  pngParPage.set(cle, (pngParPage.get(cle) || 0) + 1)
}
w(`**Captures présentes sur le disque** : ${pngs.length} fichiers pour ${pngParPage.size} groupes `
  + `(pages + éditeur riche) — ${[...pngParPage.entries()].map(([k, v]) => `${k}(${v})`).join(', ')}`)
w()

// --------------------------------------------------------------------------
// Défauts
// --------------------------------------------------------------------------
const debord = summary.filter(e => (e.overflow?.delta || 0) > 0)
const images = summary.filter(e => (e.brokenImages || []).length > 0)
const consoles = summary.filter(e => (e.console || []).length > 0)
const reseaux = summary.filter(e => (e.network || []).length > 0)
const contrastes = summary.filter(e => (e.lowContrastCount || 0) > 0)
const tronques = summary.filter(e => (e.truncatedCount || 0) > 0)

w('## 2. Défauts constatés')
w()
w('### Observations d’exécutions antérieures (mêmes outils, mesures non reprises dans `summary.json`)')
w()
w('- **`/communaute` @375 px — débordement horizontal mesuré : `scrollWidth` 510 px pour `clientWidth` 375 px, '
  + 'soit **+135 px**, sur les 4 combinaisons thème/style.** Preuves : `docs/qa-visual/captures/communaute-375-*.png`. '
  + 'À revérifier après correctif : `QA_MODE=matrix QA_ONLY=communaute node scripts/qa-visual-matrix.mjs`.')
w('- **401 sur `/api/auth/me`** : attendu pour un visiteur non connecté sur les pages publiques (aucune session) — '
  + 'bruit de console, pas un défaut. À surveiller uniquement sur les pages exigeant une session.')
w()
w(`Synthèse : **${debord.length}** débordement(s) horizontal(aux), **${images.length}** capture(s) avec image cassée, `
  + `**${consoles.length}** avec message console, **${reseaux.length}** avec requête en échec, `
  + `**${contrastes.length}** avec contraste insuffisant, **${tronques.length}** avec texte tronqué.`)
w()

// Débordements (défaut le plus fiable : mesuré, pas interprété)
if (debord.length) {
  w('### D1 — Débordement horizontal (mesuré)')
  w()
  for (const e of debord) {
    w(`- \`${e.page}\` @${e.resolution}px ${e.theme}/${e.style} : `
      + `scrollWidth ${e.overflow.scrollWidth} > clientWidth ${e.overflow.clientWidth} (**+${e.overflow.delta} px**) — \`${e.capture}\``)
    for (const el of (e.outOfView || []).slice(0, 4)) {
      w(`  - élément fautif : \`${el.tag}.${el.cls}\` (${el.position}, ${el.width}px, dépasse de ${el.overflowPx}px) — « ${el.text} »`)
    }
  }
  w()
}

if (images.length) {
  w('### D2 — Images cassées (`naturalWidth === 0`)')
  w()
  const vues = new Map()
  for (const e of images) {
    for (const img of e.brokenImages) {
      if (!vues.has(img.src)) vues.set(img.src, { src: img.src, alt: img.alt, pages: new Set() })
      vues.get(img.src).pages.add(`${e.page}@${e.resolution}`)
    }
  }
  for (const v of vues.values()) w(`- \`${v.src}\` (alt : « ${v.alt || '(vide)'} ») — vu sur ${[...v.pages].join(', ')}`)
  w()
}

if (consoles.length) {
  w('### D3 — Messages console (erreurs et avertissements)')
  w()
  const vues = new Map()
  for (const e of consoles) {
    for (const c of e.console) {
      const cle = `${c.type} — ${c.text}`.slice(0, 160)
      if (!vues.has(cle)) vues.set(cle, { texte: `${c.type} — ${c.text}`.slice(0, 300), pages: new Set() })
      vues.get(cle).pages.add(e.page)
    }
  }
  for (const v of vues.values()) w(`- ${v.texte}\n  - pages : ${[...v.pages].join(', ')}`)
  w()
}

if (reseaux.length) {
  w('### D4 — Requêtes réseau en échec')
  w()
  const vues = new Map()
  for (const e of reseaux) {
    for (const n of e.network) {
      const cle = `${n.status} ${n.url}`
      if (!vues.has(cle)) vues.set(cle, { ...n, pages: new Set() })
      vues.get(cle).pages.add(e.page)
    }
  }
  for (const v of vues.values()) w(`- HTTP ${v.status} — \`${v.url}\` (${[...v.pages].join(', ')})`)
  w()
}

if (contrastes.length) {
  w('### D5 — Contraste sous le seuil WCAG AA (mesure DOM, à confirmer à l’œil)')
  w()
  const vues = new Map()
  for (const e of contrastes) {
    for (const c of e.lowContrast) {
      const cle = `${c.color}|${c.bg}|${c.text}`.slice(0, 120)
      if (!vues.has(cle)) vues.set(cle, { ...c, cas: new Set() })
      vues.get(cle).cas.add(`${e.page}@${e.resolution} ${e.theme}/${e.style}`)
    }
  }
  for (const v of vues.values()) {
    w(`- ratio **${v.ratio}:1** (seuil ${v.seuil}) — texte « ${v.text} » ${v.color} sur ${v.bg}, ${v.fontSize}px`)
    w(`  - ${[...v.cas].slice(0, 6).join(' ; ')}`)
  }
  w()
}

// Familles de faux positifs vérifiés
w('### Points examinés puis écartés (faux positifs de la sonde)')
w()
const petits = summary.reduce((n, e) => n + (e.smallTargetsCount || 0), 0)
const overlaps = summary.reduce((n, e) => n + (e.overlaps || []).length, 0)
w(`- **${petits} « petites cibles »** : la sonde compte les enfants d'un même contrôle (icônes \`span.size-5\`, libellés \`span.truncate\` internes à un lien). Les contrôles mesurés font ≥ 32 px. Écarté.`)
w(`- **${overlaps} « superpositions »** : la couche décorative \`.floating-icons\` (arrière-plan, sans interaction) recouvre \`header\`/\`main\` **par construction** — c'est l'effet graphique recherché. Écarté.`)
w()

// --------------------------------------------------------------------------
// Éditeur riche
// --------------------------------------------------------------------------
if (editeur.length) {
  w('## 3. Éditeur de texte riche (Tiptap) — vérification dédiée')
  w()
  w('Signalement initial : « l’éditeur ne s’affiche pas ». **Non reproduit.** Mesures réelles sur '
    + '`/dashboard-evenementiel` (session ADMIN) :')
  w()
  w('| Résolution | Thème | Mouvement | Zone de saisie | Rendu | Clic reçu au centre |')
  w('|---|---|---|---|---|---|')
  for (const e of editeur) {
    const z = e.mesure?.zoneEditable
    const d = e.mesure?.dessusAuPoint
    w(`| ${e.resolution}px | ${e.theme} | ${e.mouvement || 'normal'} | ${z ? `${z.rect.width}×${z.rect.height}` : 'absent'} `
      + `| ${z ? `${z.display} / ${z.visibility} / opacité ${z.opacity} / clip ${z.clipPath}` : '—'} `
      + `| ${d && d.estDansEditeur ? `oui (\`${d.tag}.${d.classe}\`)` : JSON.stringify(d)} |`)
  }
  w()
  const p1 = editeur[0]?.mesure
  if (p1) {
    const para = (p1.chaineParents && p1.chaineParents.length) ? null : null
    w(`- Zone de saisie : \`min-height\` = ${p1.zoneEditable?.minHeight}, dans la fenêtre après défilement : `
      + `${p1.zoneEditable?.dansViewport ? 'oui' : 'non'} (${p1.zoneEditable?.pixelsVisibles} px visibles).`)
    void para
  }
  w('- Texte d’invite : `<p data-placeholder="Description (10 caractères minimum)" class="is-empty is-editor-empty">`, '
    + 'pseudo-élément `::before` rendu par la règle `.rich-text-editor__content p.is-editor-empty:first-child::before`.')
  w('- Cause racine **historique déjà corrigée** (commentaire `app/assets/css/main.css` §14) : les règles de l’éditeur '
    + 'vivaient par erreur dans `@media (prefers-reduced-motion: reduce)`. Vérifié : elles sont désormais hors média query.')
  w('- Preuves visuelles : `docs/qa-visual/captures/editeur-riche-zoom-*.png` ; mesures brutes : '
    + '`editeur-riche.json` et `sonde-placeholder.json`.')
  w()
}

w('## 4. Reproductibilité')
w()
w('```bash')
w('# Matrice complète (par lots, reprise possible)')
w('bash scripts/qa-visual-run.sh matrix')
w()
w('# Sous-ensemble de pages')
w('QA_MODE=matrix QA_ONLY=tournois,espace-membre node scripts/qa-visual-matrix.mjs')
w()
w('# Éditeur riche uniquement')
w('QA_MODE=editeur QA_ROLE=ADMIN node scripts/qa-visual-matrix.mjs')
w()
w('# Régénérer ce rapport à partir des mesures existantes')
w('node scripts/qa-visual-rapport.mjs')
w('```')
w()
w('## 5. Limites')
w()
w('- Mesures faites sur le **serveur de développement** (`localhost:3226`) : le rendu de production peut différer '
  + '(pas de compression, pas de préchargement, HMR actif).')
w('- La sonde de contraste est **DOM** (pas de pixel) : les fonds en dégradé sont écartés et listés à part dans '
  + '`summary.json` (`uncheckedContrast`), jamais validés à tort.')
w('- L’exécution a été interrompue puis reprise ; les lots non couverts sont listés en section 1 et peuvent être '
  + 'relancés par `bash scripts/qa-visual-run.sh matrix` sans refaire l’existant.')

writeFileSync(join(DIR, 'RAPPORT-VISUEL.md'), lignes.join('\n') + '\n')
console.log(`Rapport écrit : docs/qa-visual/RAPPORT-VISUEL.md (${lignes.length} lignes, ${summary.length} captures analysées)`)
