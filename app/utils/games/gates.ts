/** « Portes logiques » : on choisit le type de chaque porte pour que la lampe réponde correctement à tous les cas de test. */
export type GateType = 'AND' | 'OR' | 'XOR' | 'NAND' | 'NOT' | 'WIRE'

export interface Slot {
  id: string
  /** Entrée A : le nom d'un interrupteur ou l'id d'une autre porte */
  a: string
  /** Entrée B : absente pour les portes à une seule entrée (NON / fil) */
  b?: string
}

export interface TestCase {
  inputs: Record<string, boolean>
  expected: boolean
}

export interface GateLevel {
  title: string
  story: string
  inputs: string[]
  slots: Slot[]
  out: string
  tests: TestCase[]
}

export const BINARY_GATES: GateType[] = ['AND', 'OR', 'XOR', 'NAND']
export const UNARY_GATES: GateType[] = ['NOT', 'WIRE']

export const GATE_LABEL: Record<GateType, string> = {
  AND: 'ET',
  OR: 'OU',
  XOR: 'OU exclusif',
  NAND: 'NON-ET',
  NOT: 'NON',
  WIRE: 'Fil direct'
}

export function evalGate(type: GateType, a: boolean, b: boolean): boolean {
  switch (type) {
    case 'AND': return a && b
    case 'OR': return a || b
    case 'XOR': return a !== b
    case 'NAND': return !(a && b)
    case 'NOT': return !a
    case 'WIRE': return a
  }
}

/** Valeur de la sortie pour un cas de test ; null tant qu'une porte nécessaire n'a pas de type choisi. */
export function evaluate(level: GateLevel, choice: Record<string, GateType | undefined>, inputs: Record<string, boolean>): boolean | null {
  const values: Record<string, boolean> = { ...inputs }
  for (const slot of level.slots) {
    const type = choice[slot.id]
    if (!type) return null
    const a = values[slot.a]
    const b = slot.b === undefined ? false : values[slot.b]
    if (a === undefined || (slot.b !== undefined && b === undefined)) return null
    values[slot.id] = evalGate(type, a, b ?? false)
  }
  return values[level.out] ?? null
}

function table(inputs: string[], f: (v: Record<string, boolean>) => boolean): TestCase[] {
  const out: TestCase[] = []
  for (let mask = 0; mask < 1 << inputs.length; mask++) {
    const v: Record<string, boolean> = {}
    inputs.forEach((name, i) => {
      v[name] = ((mask >> i) & 1) === 1
    })
    out.push({ inputs: v, expected: f(v) })
  }
  return out
}

export const GATE_LEVELS: GateLevel[] = [
  {
    title: 'Les deux interrupteurs',
    story: 'La lampe doit s’allumer quand UN SEUL des deux interrupteurs est levé, pas quand les deux le sont.',
    inputs: ['A', 'B'],
    slots: [{ id: 'P1', a: 'A', b: 'B' }],
    out: 'P1',
    tests: table(['A', 'B'], v => v.A! !== v.B!)
  },
  {
    title: 'Tout sauf les deux',
    story: 'La lampe est allumée sauf quand A et B sont levés en même temps. Deux portes à assembler.',
    inputs: ['A', 'B'],
    slots: [{ id: 'P1', a: 'A', b: 'B' }, { id: 'P2', a: 'P1' }],
    out: 'P2',
    tests: table(['A', 'B'], v => !(v.A! && v.B!))
  },
  {
    title: 'La porte du jardin',
    story: 'La lampe s’allume si A et B sont levés, MAIS PAS C. Trois portes : une pour A et B, une pour C, une pour réunir.',
    inputs: ['A', 'B', 'C'],
    slots: [{ id: 'P1', a: 'A', b: 'B' }, { id: 'P2', a: 'C' }, { id: 'P3', a: 'P1', b: 'P2' }],
    out: 'P3',
    tests: table(['A', 'B', 'C'], v => v.A! && v.B! && !v.C!)
  },
  {
    title: 'L’alarme de la fête',
    story: 'La sirène sonne si la porte est ouverte (A) ET que soit le code est faux (B = code juste), soit le mode nuit est actif (C).',
    inputs: ['A', 'B', 'C'],
    slots: [{ id: 'P1', a: 'B' }, { id: 'P2', a: 'P1', b: 'C' }, { id: 'P3', a: 'A', b: 'P2' }],
    out: 'P3',
    tests: table(['A', 'B', 'C'], v => v.A! && (!v.B! || v.C!))
  },
  {
    title: 'Le compteur de bougies',
    story: 'La lampe s’allume quand un nombre IMPAIR d’interrupteurs sur les trois est levé.',
    inputs: ['A', 'B', 'C'],
    slots: [{ id: 'P1', a: 'A', b: 'B' }, { id: 'P2', a: 'P1', b: 'C' }],
    out: 'P2',
    tests: table(['A', 'B', 'C'], v => [v.A!, v.B!, v.C!].filter(Boolean).length % 2 === 1)
  },
  {
    title: 'Le vote à la majorité',
    story: 'La lampe s’allume si au moins DEUX interrupteurs sur trois sont levés. Quatre portes, c’est le plus gros circuit !',
    inputs: ['A', 'B', 'C'],
    slots: [
      { id: 'P1', a: 'A', b: 'B' },
      { id: 'P2', a: 'A', b: 'B' },
      { id: 'P3', a: 'P2', b: 'C' },
      { id: 'P4', a: 'P1', b: 'P3' }
    ],
    out: 'P4',
    tests: table(['A', 'B', 'C'], v => [v.A!, v.B!, v.C!].filter(Boolean).length >= 2)
  }
]

/** Tous les types possibles d'une porte selon qu'elle a une ou deux entrées. */
export function optionsFor(slot: Slot): GateType[] {
  return slot.b === undefined ? UNARY_GATES : BINARY_GATES
}

/** Cherche une solution par force brute (utilisé par les tests et pour vérifier que chaque niveau est jouable). */
export function bruteForce(level: GateLevel): Record<string, GateType> | null {
  const slots = level.slots
  const pick = (i: number, cur: Record<string, GateType>): Record<string, GateType> | null => {
    if (i === slots.length) {
      return level.tests.every(t => evaluate(level, cur, t.inputs) === t.expected) ? { ...cur } : null
    }
    for (const type of optionsFor(slots[i]!)) {
      cur[slots[i]!.id] = type
      const r = pick(i + 1, cur)
      if (r) return r
    }
    return null
  }
  return pick(0, {})
}
