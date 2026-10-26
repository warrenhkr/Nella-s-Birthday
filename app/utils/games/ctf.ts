/** Outils et défis du « Mini CTF ». Les réponses sont calculées à partir de textes simples (testable). */

export function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  bytes.forEach((b) => {
    bin += String.fromCharCode(b)
  })
  return btoa(bin)
}

/** Décode du base64 ; renvoie null si le texte n'est pas du base64 valide. */
export function fromBase64(text: string): string | null {
  try {
    const bin = atob(text.trim())
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0))
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}

/** Décale les lettres (a-z, A-Z) de `shift` places ; le reste est inchangé. */
export function caesar(text: string, shift: number): string {
  const k = ((shift % 26) + 26) % 26
  return text.replace(/[a-z]/gi, (ch) => {
    const base = ch <= 'Z' ? 65 : 97
    return String.fromCharCode(((ch.charCodeAt(0) - base + k) % 26) + base)
  })
}

export function textToBinary(text: string): string {
  return Array.from(new TextEncoder().encode(text)).map(b => b.toString(2).padStart(8, '0')).join(' ')
}

/** Décode des groupes de 8 bits (espaces ignorés) ; null si invalide. */
export function binaryToText(bits: string): string | null {
  const clean = bits.replace(/\s+/g, '')
  if (clean.length === 0 || clean.length % 8 !== 0 || /[^01]/.test(clean)) return null
  const bytes = new Uint8Array(clean.length / 8)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.slice(i * 8, i * 8 + 8), 2)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}

export function normalizeFlag(text: string): string {
  return text.trim().replace(/\s+/g, '').toUpperCase()
}

export interface Challenge {
  id: number
  title: string
  story: string
  /** Matériel affiché au joueur (texte codé, extrait de page, etc.) */
  material: string
  tool: 'base64' | 'caesar' | 'binary' | 'source' | 'none'
  hint: string
  flag: string
  /** Mot-clé contenu dans le drapeau (pour le défi final) */
  keyword: string
}

const WORDS = ['cadeau', 'octet', 'dragon', 'etoile']

export const CHALLENGES: Challenge[] = [
  {
    id: 1,
    title: 'Le message mystère',
    story: 'Un colis arrive avec une étiquette bizarre. Ça ressemble à du base64 : des lettres, des chiffres et un « = » à la fin.',
    material: toBase64('FLAG{' + WORDS[0] + '}'),
    tool: 'base64',
    hint: 'Colle l’étiquette dans le décodeur base64 de la boîte à outils.',
    flag: 'FLAG{' + WORDS[0] + '}',
    keyword: WORDS[0]!
  },
  {
    id: 2,
    title: 'Le décalage de César',
    story: 'Jules César cachait ses messages en décalant les lettres. Ici, chaque lettre a été avancée de 5 places dans l’alphabet.',
    material: caesar('FLAG{' + WORDS[1] + '}', 5),
    tool: 'caesar',
    hint: 'Pour revenir en arrière, décale de 5 places dans l’autre sens (ou de 21 vers l’avant).',
    flag: 'FLAG{' + WORDS[1] + '}',
    keyword: WORDS[1]!
  },
  {
    id: 3,
    title: 'Le langage des machines',
    story: 'Un ordinateur ne parle qu’avec des 0 et des 1. Chaque groupe de 8 chiffres est une lettre.',
    material: textToBinary('FLAG{' + WORDS[2] + '}'),
    tool: 'binary',
    hint: 'Le décodeur binaire de la boîte à outils lit les groupes de 8 bits.',
    flag: 'FLAG{' + WORDS[2] + '}',
    keyword: WORDS[2]!
  },
  {
    id: 4,
    title: 'Le commentaire oublié',
    story: 'Les développeurs laissent parfois des notes dans le code d’une page web. Elles sont invisibles à l’écran, mais pas dans le code source.',
    material: '<!-- FLAG{' + WORDS[3] + '} -->\n<h1>Bienvenue sur la page de la fête</h1>\n<p>Rien à voir ici…</p>',
    tool: 'source',
    hint: 'Appuie sur « Voir le code source » : le drapeau est dans un commentaire entre <!-- et -->.',
    flag: 'FLAG{' + WORDS[3] + '}',
    keyword: WORDS[3]!
  },
  {
    id: 5,
    title: 'Le coffre final',
    story: 'La clé du coffre s’écrit FLAG{…} avec, dans l’ordre, les premières lettres des quatre mots-clés trouvés (ceux qui sont dans les drapeaux précédents).',
    material: 'Mots-clés : défi 1 → défi 2 → défi 3 → défi 4',
    tool: 'none',
    hint: 'Prends la première lettre de chaque mot-clé, dans l’ordre des défis, et assemble-les.',
    flag: 'FLAG{' + WORDS.map(w => w[0]).join('') + '}',
    keyword: ''
  }
]

export function checkFlag(challenge: Challenge, answer: string): boolean {
  return normalizeFlag(answer) === normalizeFlag(challenge.flag)
}
