export interface PasswordRule {
  id: number
  text: string
  test: (pw: string) => boolean
}

const MONTHS = ['janvier', 'fevrier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'août', 'septembre', 'octobre', 'novembre', 'decembre', 'décembre']

export function digitSum(pw: string): number {
  let s = 0
  for (const ch of pw) if (ch >= '0' && ch <= '9') s += Number(ch)
  return s
}

export const RULES: PasswordRule[] = [
  { id: 1, text: 'Au moins 8 caractères.', test: pw => pw.length >= 8 },
  { id: 2, text: 'Contient au moins un chiffre.', test: pw => /\d/.test(pw) },
  { id: 3, text: 'Contient une lettre majuscule.', test: pw => /[A-Z]/.test(pw) },
  { id: 4, text: 'Contient un de ces symboles : ! ? @ # $ % & *', test: pw => /[!?@#$%&*]/.test(pw) },
  { id: 5, text: 'Contient le mot « gateau » (majuscules ou minuscules, sans accent).', test: pw => /gateau/i.test(pw) },
  { id: 6, text: 'La somme de tous les chiffres vaut exactement 15.', test: pw => digitSum(pw) === 15 },
  { id: 7, text: 'Aucun caractère ne se répète deux fois de suite.', test: pw => !/(.)\1/.test(pw) },
  { id: 8, text: 'Contient un mois de l’année (en toutes lettres, en français).', test: pw => MONTHS.some(m => pw.toLowerCase().includes(m)) },
  { id: 9, text: 'Contient une année à 4 chiffres qui commence par 19 ou 20.', test: pw => /(19|20)\d{2}/.test(pw) },
  { id: 10, text: 'Se termine par un point d’exclamation.', test: pw => pw.endsWith('!') }
]

/** Estimation très grossière de la force : longueur × log2 de la taille de l'alphabet utilisé. */
export function estimateBits(pw: string): number {
  if (pw.length === 0) return 0
  let pool = 0
  if (/[a-z]/.test(pw)) pool += 26
  if (/[A-Z]/.test(pw)) pool += 26
  if (/\d/.test(pw)) pool += 10
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 32
  return Math.round(pw.length * Math.log2(Math.max(pool, 2)))
}

/** Nombre de règles consécutives satisfaites en partant de la première : c'est ce qui débloque les suivantes. */
export function unlockedCount(pw: string): number {
  let n = 0
  while (n < RULES.length && RULES[n]!.test(pw)) n++
  return n
}
