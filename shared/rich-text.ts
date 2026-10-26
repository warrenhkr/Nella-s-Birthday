/**
 * shared/rich-text.ts
 * ---------------------------------------------------------------------------
 * Socle commun (application ET serveur) du TEXTE RICHE du Club Otaku.
 *
 * POURQUOI CE FICHIER
 * -------------------
 * Les descriptions d'événements, d'équipes, de tournois, de produits et les
 * annonces de la communauté sont saisies dans un éditeur (Tiptap) PUIS
 * réaffichées. Comme ce contenu vient d'utilisateurs (et parfois d'imports),
 * il ne doit JAMAIS être injecté tel quel dans la page : c'est une faille XSS
 * stockée classique.
 *
 * Ce module fournit donc :
 *   - un nettoyage par LISTE BLANCHE (`sanitizeHtml`) des balises/attributs
 *     réellement produits par Tiptap ;
 *   - une conversion « texte brut / ancien format JSON Tiptap → HTML » afin de
 *     continuer à lire les contenus déjà enregistrés ;
 *   - des mesures de longueur qui ignorent le balisage (compteurs, minimums
 *     exigés par l'API).
 *
 * Aucune dépendance externe : ce code s'exécute à l'identique côté serveur
 * (SSR, sans DOM) et côté navigateur.
 */

// ---------------------------------------------------------------------------
// 1. Listes blanches
// ---------------------------------------------------------------------------

/** Balises conservées : exactement ce que produit notre barre d'outils. */
const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'code',
  'h2', 'h3', 'h4',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'hr',
  'a', 'img', 'mark', 'span'
])

/** Balises dont on supprime la balise ET tout le contenu (jamais voulues). */
const DROP_WITH_CONTENT = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button',
  'select', 'option', 'textarea', 'svg', 'math', 'template', 'noscript',
  'meta', 'link', 'base', 'title', 'head', 'body', 'html', 'video', 'audio',
  'source', 'canvas', 'frame', 'frameset', 'applet',
  // Balises de texte « brut » historiques : leur contenu n'est JAMAIS du HTML,
  // mais certains navigateurs en désactivent l'échappement (base des mXSS).
  'xmp', 'plaintext', 'listing', 'noembed', 'noframes'
])

/** Balises auto-fermantes (jamais de `</...>` attendu). */
const VOID_TAGS = new Set(['br', 'hr', 'img'])

/** Attributs autorisés, par balise. Tout le reste est supprimé. */
const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel']),
  img: new Set(['src', 'alt', 'title', 'width', 'height']),
  p: new Set(['style']),
  h2: new Set(['style']),
  h3: new Set(['style']),
  h4: new Set(['style']),
  li: new Set(['style']),
  span: new Set(['style']),
  mark: new Set(['style', 'data-color'])
}

/**
 * Déclarations CSS tolérées dans un `style`. Tiptap n'a besoin que de
 * l'alignement (extension-text-align), de la couleur de texte (extension-color)
 * et du surlignage (extension-highlight). `background-image`, `url(...)`,
 * `expression(...)` et `position:fixed` sont donc éliminés.
 */
const ALLOWED_STYLE_PROPERTIES = new Set([
  'color', 'background-color', 'text-align', 'text-decoration', 'font-weight', 'font-style'
])

// ---------------------------------------------------------------------------
// 2. Utilitaires internes
// ---------------------------------------------------------------------------

/** Échappe le texte à insérer dans un document HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Échappe une valeur d'attribut (entre guillemets doubles). */
function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#96;')
}

/**
 * Retire les ENVELOPPES de document sans perdre le contenu :
 * un presse-papier (Word, Excel, pages web) livre souvent un document complet
 * `<html><head>…</head><body>…</body></html>`. Si on les traitait comme des
 * balises dangereuses « avec contenu », tout le texte collé disparaîtrait.
 * `<head>` est bien supprimé AVEC son contenu : ce ne sont que des métadonnées.
 */
function unwrapDocumentTags(html: string): string {
  return html
    .replace(/<head\b[^>]*>[\s\S]*?<\/head\s*>/gi, '')
    .replace(/<\/?(?:html|head|body)\b[^>]*>/gi, '')
}

/**
 * Échappe les chevrons qui ne font pas partie d'une balise reconnue.
 * Sans cela, un `<img src=x onerror=…` NON fermé (ou un simple « a < b »)
 * traverserait le nettoyage tel quel et serait refermé par le navigateur :
 * c'est le vecteur XSS le plus courant contre les nettoyeurs maison.
 */
function escapeStrayText(segment: string): string {
  return segment.replace(/</g, '&lt;')
}

/** Retire les balises dangereuses AVEC leur contenu (script, iframe…). */
function dropDangerousBlocks(html: string): string {
  let output = html
  for (const tag of DROP_WITH_CONTENT) {
    // Contenu imbriqué impossible à parser proprement en une passe : on repète
    // jusqu'à stabilité, ce qui vient à bout des imbrications simples.
    const pattern = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi')
    const unclosed = new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi')
    let previous = ''
    while (previous !== output) {
      previous = output
      output = output.replace(pattern, '')
    }
    output = output.replace(unclosed, '')
  }
  return output
}

/**
 * Vrai si l'URL ne peut pas exécuter de code.
 * On neutralise les contournements classiques (`java\nscript:`, `JaVaScRiPt:`,
 * entités HTML dans le protocole) en supprimant espaces, tabulations et
 * caractères de contrôle avant l'analyse.
 * Exporté : la barre d'outils de l'éditeur valide les liens/images saisis.
 */
export function isSafeRichTextUrl(rawValue: string, options: { strict?: boolean } = {}): boolean {
  const value = rawValue.trim()
  if (!value) return false

  const normalized = value
    .replace(/&(?:#x0*[0-9a-f]+|#0*\d+|colon|tab|newline);/gi, (entity) => {
      if (/^&colon;$/i.test(entity)) return ':'
      if (/^&tab;$/i.test(entity)) return '\t'
      if (/^&newline;$/i.test(entity)) return '\n'
      const numeric = /^&#x/i.test(entity)
        ? Number.parseInt(entity.replace(/^&#x0*/i, '').replace(/;$/, ''), 16)
        : Number.parseInt(entity.replace(/^&#0*/i, '').replace(/;$/, ''), 10)
      return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : ''
    })
    .split('').filter((character) => {
      const code = character.codePointAt(0) ?? 0
      return code > 0x20 && code !== 0x7f && code !== 0xa0
    }).join('')
    .toLowerCase()

  if (options.strict) {
    // Images : uniquement des adresses absolues http(s) ou relatives au site.
    return /^(https?:\/\/|\/)/.test(normalized)
  }

  // Présence d'un protocole ? Seuls http(s), mailto et tel sont inertes.
  if (/^[a-z][a-z0-9+.-]*:/.test(normalized)) {
    return /^(https?:|mailto:|tel:)/.test(normalized)
  }

  // Aucun protocole : lien relatif (#ancre, /chemin, ./fichier) → inerte.
  return true
}

/** Vrai si la valeur CSS est inerte (pas d'`url()`, pas d'`expression()`). */
function isSafeStyleValue(property: string, rawValue: string): boolean {
  const value = rawValue.trim().toLowerCase()
  if (!value) return false
  if (/url\s*\(|expression\s*\(|\\\\|javascript|@import/.test(value)) return false

  switch (property) {
    case 'text-align':
      return /^(left|right|center|justify|start|end)$/.test(value)
    case 'text-decoration':
      return /^(none|underline|line-through|overline)$/.test(value)
    case 'font-weight':
      return /^(normal|bold|[1-9]00)$/.test(value)
    case 'font-style':
      return /^(normal|italic|oblique)$/.test(value)
    case 'color':
    case 'background-color':
      return /^(#[0-9a-f]{3,8}|rgba?\([0-9.,\s%]*\)|hsla?\([0-9.,\s%deg]*\)|[a-z]{3,20})$/.test(value)
    default:
      return false
  }
}

/** Filtre une déclaration `style="…"` : garde uniquement le strict nécessaire. */
function sanitizeStyleAttribute(rawValue: string): string {
  const declarations = rawValue.split(';')
  const kept: string[] = []

  for (const declaration of declarations) {
    const separator = declaration.indexOf(':')
    if (separator === -1) continue
    const property = declaration.slice(0, separator).trim().toLowerCase()
    const value = declaration.slice(separator + 1).trim()
    if (!ALLOWED_STYLE_PROPERTIES.has(property)) continue
    if (!isSafeStyleValue(property, value)) continue
    kept.push(`${property}: ${value}`)
  }

  return kept.join('; ')
}

/** Extrait la liste d'attributs bruts d'une balise ouvrante. */
function parseAttributes(source: string): Array<{ name: string, value: string | null }> {
  const attributes: Array<{ name: string, value: string | null }> = []
  const pattern = /([a-zA-Z_:][a-zA-Z0-9_:.-]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'`=<>]+)))?/g
  let match: RegExpExecArray | null = pattern.exec(source)
  while (match) {
    const name = (match[1] ?? '').toLowerCase()
    const value = match[3] ?? match[4] ?? match[5] ?? null
    attributes.push({ name, value })
    match = pattern.exec(source)
    if (match && match.index === pattern.lastIndex) pattern.lastIndex += 1
  }
  return attributes
}

/** Reconstruit une balise ouvrante nettoyée, ou `null` si la balise est refusée. */
function sanitizeOpenTag(tag: string, rawAttributes: string): string | null {
  if (!ALLOWED_TAGS.has(tag)) return null

  const allowed = ALLOWED_ATTRIBUTES[tag]
  const kept: string[] = []
  let href: string | null = null
  let src: string | null = null

  for (const attribute of parseAttributes(rawAttributes)) {
    if (!allowed || !allowed.has(attribute.name)) continue
    const value = attribute.value ?? ''

    if (attribute.name === 'href') {
      if (!isSafeRichTextUrl(value)) continue
      href = value.trim()
      kept.push(`href="${escapeAttribute(href)}"`)
      continue
    }

    if (attribute.name === 'src') {
      if (!isSafeRichTextUrl(value, { strict: true })) continue
      src = value.trim()
      kept.push(`src="${escapeAttribute(src)}"`)
      continue
    }

    if (attribute.name === 'style') {
      const style = sanitizeStyleAttribute(value)
      if (style) kept.push(`style="${escapeAttribute(style)}"`)
      continue
    }

    if (attribute.name === 'data-color') {
      if (/^#[0-9a-f]{3,8}$/i.test(value.trim())) kept.push(`data-color="${escapeAttribute(value.trim())}"`)
      continue
    }

    if (attribute.name === 'width' || attribute.name === 'height') {
      if (/^\d{1,4}(px)?$/i.test(value.trim())) kept.push(`${attribute.name}="${escapeAttribute(value.trim())}"`)
      continue
    }

    if (attribute.name === 'target') {
      // On ne fait jamais confiance à la cible fournie : elle est imposée
      // juste après pour les liens externes.
      continue
    }

    if (attribute.name === 'rel') continue

    kept.push(`${attribute.name}="${escapeAttribute(value)}"`)
  }

  // Un lien sans destination valide est déplié : on garde le texte, pas une
  // balise `<a>` cliquable sans cible.
  if (tag === 'a' && !href) return null

  // Une image sans source autorisée ne sert à rien (et `<img>` sans `src`
  // reste un point d'ancrage pour les rechargements/erreurs) : on la retire.
  if (tag === 'img' && !src) return null

  // Les liens sortants s'ouvrent sans donner accès à la page d'origine.
  if (tag === 'a' && href) {
    if (/^https?:\/\//i.test(href)) {
      kept.push('target="_blank"', 'rel="noopener noreferrer nofollow"')
    } else {
      kept.push('rel="noopener noreferrer"')
    }
  }

  return kept.length ? `<${tag} ${kept.join(' ')}>` : `<${tag}>`
}

// ---------------------------------------------------------------------------
// 3. Nettoyage principal
// ---------------------------------------------------------------------------

/**
 * Nettoie du HTML par liste blanche.
 * - toute balise inconnue est « dépliée » (on garde son texte, pas sa balise) ;
 * - `script`, `iframe`, `style`… sont supprimés AVEC leur contenu ;
 * - les attributs `on*`, `class`, `id`, `data-*` non prévus sont retirés ;
 * - `javascript:`, `data:`, `vbscript:` sont refusés dans `href`/`src` ;
 * - le `style` est réduit aux déclarations de mise en forme autorisées.
 */
export function sanitizeHtml(input: string): string {
  if (typeof input !== 'string' || !input.trim()) return ''

  const withoutComments = dropDangerousBlocks(unwrapDocumentTags(input)).replace(/<!--[\s\S]*?-->/g, '')
  const tagPattern = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g

  let output = ''
  let cursor = 0
  const openTags: string[] = []
  let match: RegExpExecArray | null = tagPattern.exec(withoutComments)

  while (match) {
    // Le texte entre deux balises est conservé, mais ses chevrons isolés sont
    // échappés (voir escapeStrayText).
    output += escapeStrayText(withoutComments.slice(cursor, match.index))
    cursor = match.index + match[0].length

    const isClosing = match[1] === '/'
    const tag = (match[2] ?? '').toLowerCase()
    const rawAttributes = match[3] ?? ''

    if (isClosing) {
      if (ALLOWED_TAGS.has(tag) && !VOID_TAGS.has(tag)) {
        const position = openTags.lastIndexOf(tag)
        if (position !== -1) {
          // On ferme proprement les balises restées ouvertes au-dessus.
          for (let index = openTags.length - 1; index >= position; index -= 1) {
            output += `</${openTags[index]}>`
            openTags.pop()
          }
        }
      }
    } else {
      const sanitized = sanitizeOpenTag(tag, rawAttributes)
      if (sanitized) {
        output += sanitized
        if (!VOID_TAGS.has(tag) && !rawAttributes.trim().endsWith('/')) openTags.push(tag)
      }
    }

    match = tagPattern.exec(withoutComments)
  }

  output += escapeStrayText(withoutComments.slice(cursor))
  while (openTags.length) output += `</${openTags.pop()}>`

  return output.trim()
}

// ---------------------------------------------------------------------------
// 4. Conversion vers du texte simple (compteurs, aperçus, recherche)
// ---------------------------------------------------------------------------

/** Décode les entités HTML les plus courantes. */
function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': '\'',
    '&apos;': '\'',
    '&nbsp;': ' '
  }

  return value
    .replace(/&(?:amp|lt|gt|quot|#39|apos|nbsp);/gi, entity => named[entity.toLowerCase()] ?? entity)
    .replace(/&#x([0-9a-f]+);/gi, (_full, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_full, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
}

/**
 * Convertit du HTML (ou du texte simple, ou un ancien document JSON Tiptap)
 * en texte lisible : utilisé pour les aperçus de cartes, la recherche plein
 * texte et les compteurs de caractères.
 */
export function htmlToPlainText(input: string): string {
  if (typeof input !== 'string' || !input.trim()) return ''

  const source = /<\/?[a-z][a-z0-9-]*(\s[^>]*)?>/i.test(input) ? input : decodeEntities(input)

  const withBreaks = source
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/(p|div|h[1-6]|li|blockquote|pre|tr|ul|ol)>/gi, '\n')
    .replace(/<[^>]*>/g, '')

  return decodeEntities(withBreaks)
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    // Un « • » de liste ne doit pas être précédé d'une ligne vide.
    .replace(/\n{2,}(• )/g, '\n$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Longueur du TEXTE (sans balisage) : base des minimums/maximums de l'API. */
export function richTextLength(value: string): number {
  return htmlToPlainText(value).length
}

/**
 * Balises qui portent du CONTENU sans porter de texte : une description
 * réduite à une affiche (image) ou à un séparateur n'est PAS vide.
 */
const MEDIA_ONLY_TAGS = /<(?:img|hr)\b/i

/** Vrai si le contenu ne contient aucun caractère visible ni média. */
export function isRichTextEmpty(value: string): boolean {
  if (typeof value !== 'string' || !value.trim()) return true
  if (richTextLength(value) > 0) return false
  return !MEDIA_ONLY_TAGS.test(value)
}

/** `null` si vide — évite d'enregistrer un `<p></p>` là où `NULL` est attendu. */
export function richTextOrNull(value: string): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed || isRichTextEmpty(trimmed)) return null
  return trimmed
}

// ---------------------------------------------------------------------------
// 5. Compatibilité : ancien format JSON Tiptap → HTML
// ---------------------------------------------------------------------------

interface LegacyMark {
  type?: string
  attrs?: Record<string, unknown> | null
}

interface LegacyNode {
  type?: string
  text?: string
  attrs?: Record<string, unknown> | null
  marks?: LegacyMark[]
  content?: LegacyNode[]
}

/** Applique une marque Tiptap à un fragment déjà échappé. */
function applyMark(html: string, mark: LegacyMark): string {
  const color = typeof mark.attrs?.color === 'string' ? mark.attrs.color : ''

  switch (mark.type) {
    case 'bold':
      return `<strong>${html}</strong>`
    case 'italic':
      return `<em>${html}</em>`
    case 'underline':
      return `<u>${html}</u>`
    case 'strike':
      return `<s>${html}</s>`
    case 'code':
      return `<code>${html}</code>`
    case 'highlight':
      return color && /^#[0-9a-f]{3,8}$/i.test(color)
        ? `<mark data-color="${escapeAttribute(color)}" style="background-color: ${escapeAttribute(color)}">${html}</mark>`
        : `<mark>${html}</mark>`
    case 'textStyle':
    case 'color':
      return color && /^#[0-9a-f]{3,8}$/i.test(color)
        ? `<span style="color: ${escapeAttribute(color)}">${html}</span>`
        : html
    case 'link': {
      const href = typeof mark.attrs?.href === 'string' ? mark.attrs.href : ''
      return isSafeRichTextUrl(href) ? `<a href="${escapeAttribute(href.trim())}">${html}</a>` : html
    }
    default:
      return html
  }
}

/** Convertit un nœud Tiptap (ancien stockage JSON) en HTML brut. */
function legacyNodeToHtml(node: LegacyNode | null | undefined): string {
  if (!node || typeof node !== 'object') return ''

  if (node.type === 'text') {
    let html = escapeHtml(typeof node.text === 'string' ? node.text : '')
    for (const mark of node.marks ?? []) html = applyMark(html, mark)
    return html
  }

  const children = (node.content ?? []).map(legacyNodeToHtml).join('')

  switch (node.type) {
    case 'doc':
      return children
    case 'paragraph':
      return `<p>${children}</p>`
    case 'heading': {
      const level = Number(node.attrs?.level ?? 3)
      const tag = level === 2 ? 'h2' : level === 4 ? 'h4' : 'h3'
      return `<${tag}>${children}</${tag}>`
    }
    case 'bulletList':
      return `<ul>${children}</ul>`
    case 'orderedList':
      return `<ol>${children}</ol>`
    case 'listItem':
      return `<li>${children}</li>`
    case 'blockquote':
      return `<blockquote>${children}</blockquote>`
    case 'codeBlock':
      return `<pre><code>${children}</code></pre>`
    case 'hardBreak':
      return '<br>'
    case 'horizontalRule':
      return '<hr>'
    case 'image': {
      const src = typeof node.attrs?.src === 'string' ? node.attrs.src : ''
      if (!isSafeRichTextUrl(src, { strict: true })) return ''
      const alt = typeof node.attrs?.alt === 'string' ? node.attrs.alt : ''
      return `<img src="${escapeAttribute(src.trim())}" alt="${escapeAttribute(alt)}">`
    }
    default:
      return children
  }
}

/** Renvoie le HTML si la chaîne est un ancien document JSON Tiptap, sinon `null`. */
function legacyJsonToHtml(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed.startsWith('{')) return null

  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (!parsed || typeof parsed !== 'object') return null
    const node = parsed as LegacyNode
    if (node.type !== 'doc') return null
    return legacyNodeToHtml(node)
  } catch {
    return null
  }
}

/** Vrai si la chaîne ressemble à du HTML produit par un éditeur. */
export function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][a-z0-9-]*(\s[^>]*)?>/i.test(value)
}

/** Texte simple → HTML sûr (les sauts de ligne deviennent des paragraphes). */
export function plainTextToHtml(value: string): string {
  const normalized = value.replace(/\r\n?/g, '\n').trim()
  if (!normalized) return ''

  return normalized
    .split(/\n{2,}/)
    .map(paragraph => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

/**
 * Point d'entrée UNIQUE de lecture d'un contenu riche stocké en base :
 * accepte l'ancien JSON Tiptap, du HTML, ou du simple texte (imports CSV,
 * données historiques) et renvoie toujours du HTML NETTOYÉ.
 */
export function toSafeHtml(value: unknown): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed) return ''

  const fromLegacyJson = legacyJsonToHtml(trimmed)
  if (fromLegacyJson !== null) return sanitizeHtml(fromLegacyJson)

  if (looksLikeHtml(trimmed)) return sanitizeHtml(trimmed)

  return plainTextToHtml(trimmed)
}

/** Même chose que `toSafeHtml`, mais garantit du HTML éditable non vide. */
export function toEditorHtml(value: unknown): string {
  return toSafeHtml(value)
}
