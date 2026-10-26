/**
 * scripts/test-rich-text.mjs
 * ---------------------------------------------------------------------------
 * Vérifie le socle de texte riche partagé (shared/rich-text.ts) qui sert
 * AUSSI BIEN à l'édition (RichTextEditor) qu'à l'affichage (RichTextContent)
 * et à la validation des API.
 *
 * Le script ÉCHOUE (code de sortie 1) dès qu'une seule assertion n'est pas
 * tenue : c'est le garde-fou XSS + cohérence de longueur du projet.
 *
 * Lancement :  node scripts/test-rich-text.mjs
 */
import {
  sanitizeHtml,
  htmlToPlainText,
  toSafeHtml,
  toEditorHtml,
  richTextLength,
  isRichTextEmpty,
  richTextOrNull,
  isSafeRichTextUrl,
  plainTextToHtml
} from '../shared/rich-text.ts'

let failures = 0
let checks = 0

function ok(label) {
  checks += 1
  console.log(`OK    | ${label}`)
}

function fail(label, detail) {
  checks += 1
  failures += 1
  console.log(`ECHEC | ${label}${detail ? `\n        ${detail}` : ''}`)
}

/** Égalité stricte. */
function check(label, actual, expected) {
  if (actual === expected) ok(label)
  else fail(label, `attendu : ${JSON.stringify(expected)}\n        obtenu  : ${JSON.stringify(actual)}`)
}

/** Vrai si le HTML nettoyé ne contient AUCUN des jetons interdits. */
function assertNoDanger(label, html, forbidden) {
  let cleaned = ''
  try {
    cleaned = sanitizeHtml(html)
  } catch (error) {
    fail(`${label} → sanitizeHtml a levé : ${error.message}`)
    return
  }
  const bad = forbidden.find(token => cleaned.toLowerCase().includes(token.toLowerCase()))
  if (bad) fail(label, `« ${bad} » survit dans ${JSON.stringify(cleaned)}`)
  else ok(`${label} → ${JSON.stringify(cleaned)}`)
}

/** Vrai si le HTML nettoyé conserve tous les jetons attendus. */
function assertKeep(label, html, expected) {
  let cleaned = ''
  try {
    cleaned = sanitizeHtml(html)
  } catch (error) {
    fail(`${label} → sanitizeHtml a levé : ${error.message}`)
    return
  }
  const missing = expected.find(token => !cleaned.includes(token))
  if (missing) fail(label, `« ${missing} » perdu dans ${JSON.stringify(cleaned)}`)
  else ok(label)
}

console.log('== 1. XSS : les charges classiques doivent disparaître ==')
assertNoDanger('script inline', '<p>Bonjour</p><script>alert(1)</script>', ['<script', 'alert(1)'])
assertNoDanger('img onerror', '<img src="https://x.tld/a.png" onerror="alert(1)">', ['onerror', 'alert'])
assertNoDanger('a javascript:', '<a href="javascript:alert(1)">clic</a>', ['javascript', '<a'])
assertNoDanger('a javascript entités', '<a href="java&#115;cript:alert(1)">clic</a>', ['javascript', '<a'])
assertNoDanger('a javascript espaces/contrôles', '<a href="  ja\nva\tscript:alert(1)">clic</a>', ['javascript', '<a'])
assertNoDanger('a data:text/html', '<a href="data:text/html;base64,PHNjcmlwdD4=">clic</a>', ['data:text/html'])
assertNoDanger('svg onload', '<svg onload="alert(1)"><circle /></svg>', ['<svg', 'onload'])
assertNoDanger('math mXSS', '<math><mtext></mtext></math>', ['<math'])
assertNoDanger('iframe', '<iframe src="https://evil.tld"></iframe>', ['<iframe'])
assertNoDanger('style url()', '<p style="background: url(javascript:alert(1))">x</p>', ['url(', 'javascript'])
assertNoDanger('style expression', '<p style="width: expression(alert(1))">x</p>', ['expression'])
assertNoDanger('onmouseover sur p', '<p onmouseover="alert(1)">x</p>', ['onmouseover'])
assertNoDanger('div wrapper avec onclick', '<div onclick="alert(1)">texte</div>', ['onclick', '<div'])
assertNoDanger('data-uri image', '<img src="data:text/html;base64,PHNjcmlwdD4=">', ['data:', '<img'])
assertNoDanger('balise inconnue', '<marquee>salut</marquee>', ['<marquee'])
assertNoDanger('entité script dans texte', '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>', ['<script>'])
assertNoDanger('form + input caché', '<form action="https://evil.tld"><input name="x"></form>', ['<form', '<input'])
assertNoDanger('noscript mXSS', '<noscript><p title="</noscript><img src=x onerror=alert(1)>">', ['onerror', '<img src=x'])
assertNoDanger('style dans la page', '<style>body{background:red}</style>', ['<style'])
// Balise NON fermée : le navigateur la refermerait tout seul à la fin du
// document → le chevron doit être échappé (« &lt;img »), pas conservé tel quel.
{
  const cleaned = sanitizeHtml('<p>coucou</p><img src=x onerror=alert(1)')
  if (cleaned.includes('<img')) fail('balise ouvrante non fermée', `balise vivante : ${JSON.stringify(cleaned)}`)
  else if (!cleaned.includes('&lt;img')) fail('balise ouvrante non fermée', `chevron non échappé : ${JSON.stringify(cleaned)}`)
  else ok(`balise ouvrante non fermée → ${JSON.stringify(cleaned)}`)
}
assertNoDanger('chevron orphelin', '<p>a < b et <script', ['<script'])
assertNoDanger('xmp', '<xmp><img src=x onerror=alert(1)></xmp>', ['onerror', '<xmp'])
assertNoDanger('template imbriqué', '<template><script>alert(1)</script></template>', ['<script', 'alert(1)'])

console.log('\n== 1bis. Presse-papier : document complet (Word, page web) ==')
{
  // Un collage rend souvent un document entier : le contenu doit SURVIVRE.
  const pasted = '<html xmlns:o="urn:schemas"><head><meta charset="utf-8"><title>x</title><base href="https://evil.tld/"></head><body style="font-family:X"><p>Bonjour <b>tout le monde</b></p><p><a href="javascript:alert(1)">clic</a></p></body></html>'
  const cleaned = sanitizeHtml(pasted)
  if (cleaned.includes('Bonjour') && /<(?:strong|b)>tout le monde<\/(?:strong|b)>/.test(cleaned)) ok(`document complet → ${JSON.stringify(cleaned)}`)
  else fail('document complet : contenu perdu', JSON.stringify(cleaned))
  if (cleaned.includes('evil.tld') || cleaned.includes('javascript')) fail('document complet : métadonnées conservées', JSON.stringify(cleaned))
  else ok('en-tête (base/title/meta) supprimé')
}

console.log('\n== 2. Contenu légitime : rien ne doit être perdu ==')
const legit = '<h2>Grand titre</h2><p>Un <strong>gras</strong>, un <em>italique</em>, un <u>souligné</u>.</p><ul><li>puces 1</li><li>puces 2</li></ul><ol><li>un</li><li>deux</li></ol><blockquote>citation</blockquote><pre><code>const x = 1 &lt; 2</code></pre><p style="text-align: center">centré</p><p><span style="color: #c1122d">rouge</span> et <mark data-color="#ffff00" style="background-color: #ffff00">surligné</mark></p><a href="https://club-otaku-eneam.vercel.app/evenements" target="_blank">lien</a><hr><p>fin</p>'
assertKeep('balises de la barre d’outils', legit, [
  '<h2>', '<strong>', '<em>', '<u>', '<ul>', '<ol>', '<li>', '<blockquote>', '<pre>', '<code>',
  'text-align: center', 'color: #c1122d', 'background-color: #ffff00',
  'href="https://club-otaku-eneam.vercel.app/evenements"', '<hr>'
])
assertKeep('lien externe sécurisé', legit, ['target="_blank"', 'rel="noopener noreferrer nofollow"'])
assertKeep('image légitime', '<p><img src="https://cdn.tld/a.webp" alt="logo" width="320"></p>', ['<img src="https://cdn.tld/a.webp"', 'alt="logo"', 'width="320"'])
assertKeep('lien interne', '<a href="/evenements">interne</a>', ['href="/evenements"'])
assertKeep('mailto', '<a href="mailto:club@eneam.bj">écris-nous</a>', ['href="mailto:club@eneam.bj"'])

console.log('\n== 2bis. Balises de la barre d’outils : souligné → séparateur ==')
// Chaque balise est vérifiée SÉPARÉMENT : une régression sur une seule doit
// être nommée par le test, pas noyée dans un gros bloc de HTML. Ces balises
// sont produites par les boutons Souligné, Barré, Citation, Bloc de code,
// Code en ligne et Séparateur — si l'une disparaît de la liste blanche, elle
// est supprimée EN SILENCE à l'enregistrement : c'est exactement ce que ce
// test doit empêcher.
check('sanitizeHtml conserve <u>', sanitizeHtml('<p><u>x</u></p>'), '<p><u>x</u></p>')
assertKeep('souligné', '<p>du <u>souligné</u></p>', ['<u>'])
assertKeep('barré', '<p>du <s>barré</s></p>', ['<s>'])
assertKeep('citation', '<blockquote><p>Un règlement cité</p></blockquote>', ['<blockquote>'])
assertKeep('bloc de code', '<pre><code>const x = 1 &lt; 2</code></pre>', ['<pre>', '<code>', '&lt;'])
assertKeep('code en ligne', '<p>la commande <code>pnpm test</code></p>', ['<code>'])
assertKeep('séparateur', '<p>avant</p><hr><p>après</p>', ['<hr>'])
// Combinaison réelle de l'éditeur (Ctrl+U puis barré sur la même sélection) :
// les deux marques doivent tenir ensemble.
assertKeep('souligné + barré combinés', '<p><s><u>texte</u></s></p>', ['<s>', '<u>'])
check('longueur du texte combiné', richTextLength('<p><s><u>texte</u></s></p>'), 5)
check('un séparateur n’est pas du contenu vide', isRichTextEmpty('<p>a</p><hr>'), false)
assertNoDanger('onclick sur souligné', '<p><u onclick="alert(1)">x</u></p>', ['onclick'])
assertNoDanger('onmouseover sur bloc de code', '<pre><code onmouseover="alert(1)">x</code></pre>', ['onmouseover'])
assertNoDanger('script dans une citation', '<blockquote><script>alert(1)</script>citation</blockquote>', ['<script', 'alert(1)'])
assertNoDanger('style url() sur une citation', '<blockquote style="background-image: url(javascript:alert(1))">x</blockquote>', ['url(', 'javascript'])
assertNoDanger('onload sur un séparateur', '<hr onload="alert(1)">', ['onload'])
assertNoDanger('barré porteur de script', '<p><s><script>alert(1)</script></s></p>', ['<script'])

console.log('\n== 2ter. Collage en texte brut (Ctrl+Maj+V) ==')
{
  // L'éditeur insère `plainTextToHtml(presse-papier)` : ce que l'utilisateur
  // colle doit ressortir INERTE (chevrons échappés) tout en gardant ses
  // paragraphes. C'est le seul chemin d'entrée qui ajoute du contenu à
  // l'éditeur sans passer par la barre d'outils.
  const colle = plainTextToHtml('Titre repris d’un site\n\n<img src=x onerror=alert(1)>\n<script>alert(1)</script>')
  if (colle.includes('<img') || colle.includes('<script')) fail('collage en texte brut : balise vivante', colle)
  else if (!colle.includes('&lt;img') || !colle.includes('&lt;script')) fail('collage en texte brut : texte perdu', colle)
  else ok(`collage en texte brut → ${JSON.stringify(colle)}`)

  const paragraphes = (colle.match(/<p>/g) ?? []).length
  check('collage : un paragraphe par bloc de texte', paragraphes, 2)
  check('collage : déjà conforme à la liste blanche', sanitizeHtml(colle), colle)
  check('collage : longueur de texte conservée', richTextLength(plainTextToHtml('abc')), 3)
}

console.log('\n== 3. Idempotence et cohérence édition / affichage ==')
try {
  const once = sanitizeHtml(legit)
  const twice = sanitizeHtml(once)
  check('nettoie deux fois sans dérive', twice, once)
  check('longueur identique après nettoyage', richTextLength(once), richTextLength(legit))
  check('toEditorHtml(toSafeHtml(x)) stable', toEditorHtml(toSafeHtml(once)), toEditorHtml(once))
} catch (error) {
  fail(`cohérence : ${error.message}`)
}

console.log('\n== 4. Longueurs / texte simple (base des max des API) ==')
check('texte simple sans balise', htmlToPlainText('<p>Bonjour</p><ul><li>un</li><li>deux</li></ul>'), 'Bonjour\n• un\n• deux')
check('longueur ignore le balisage', richTextLength('<p>Bonjour</p>'), 7)
check('longueur HTML riche', richTextLength('<h2>Titre</h2><p>Corps</p>'), htmlToPlainText('<h2>Titre</h2><p>Corps</p>').length)
check('vide après nettoyage', isRichTextEmpty('<p></p><p>  </p>'), true)
check('espace insécable = vide', isRichTextEmpty('<p>&nbsp;</p>'), true)
check('null si vide', richTextOrNull('<p></p>'), null)
check('null si seulement des balises', richTextOrNull('<p><br></p>'), null)
check('image seule non vide', isRichTextEmpty('<p><img src="/a.png" alt=""></p>'), false)

console.log('\n== 5. Compatibilité ancien JSON Tiptap (contenus déjà en base) ==')
const legacy = JSON.stringify({
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Titre' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'texte ', marks: [{ type: 'bold' }] }, { type: 'text', text: 'lien', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] },
    { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'item' }] }] }] }
  ]
})
const converted = toSafeHtml(legacy)
if (converted.includes('javascript:')) fail('ancien JSON : lien javascript conservé', converted)
else ok(`ancien JSON → ${converted}`)
assertKeep('ancien JSON : structure conservée', converted, ['<h2>', '<strong>', '<ul>', '<li>'])

console.log('\n== 6. Texte brut (imports CSV, fallback SSR, anciens contenus) ==')
const plain = toSafeHtml('Soirée gaming <3 avec l\'équipe\n\nDeuxième paragraphe')
if (plain.startsWith('<p>') && !plain.includes('<3')) ok(`texte brut → ${plain}`)
else fail('échappement du texte brut', plain)
check('texte brut déjà en balises conservé', plainTextToHtml('<script>'), '<p>&lt;script&gt;</p>')

console.log('\n== 7. URLs ==')
check('url http sûre', isSafeRichTextUrl('https://exemple.tld/a'), true)
check('url javascript refusée', isSafeRichTextUrl('javascript:alert(1)'), false)
check('url javascript obfusquée refusée', isSafeRichTextUrl('jAv\tascript:alert(1)'), false)
check('image relative acceptée', isSafeRichTextUrl('/images/a.png', { strict: true }), true)
check('image data: refusée', isSafeRichTextUrl('data:image/png;base64,AAA', { strict: true }), false)

console.log(`\n${checks} vérifications — ${failures === 0 ? 'TOUT OK' : `${failures} ECHEC(S)`}`)
process.exit(failures === 0 ? 0 : 1)
