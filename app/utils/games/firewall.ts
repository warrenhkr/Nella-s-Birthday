import type { Rng } from './rng.ts'
import { shuffle } from './rng.ts'

export type Zone = 'bureau' | 'maison' | 'inconnue'
export type Action = 'allow' | 'block'
export interface Packet {
  zone: Zone
  port: number
  service: string
}
export interface Rule {
  action: Action
  /** Absent = « tous ». Une règle s'applique si tous ses critères présents correspondent. */
  ports?: number[]
  zone?: Zone
}
export interface Level {
  title: string
  rules: Rule[]
  /** Paquets possibles pour ce niveau */
  ports: number[]
  count: number
}

export const SERVICES: Record<number, string> = {
  22: 'SSH (accès à distance)',
  25: 'Mail sortant',
  80: 'Web',
  443: 'Web sécurisé',
  3389: 'Bureau à distance',
  23: 'Telnet (ancien)',
  8080: 'Web alternatif'
}

export const ZONE_LABEL: Record<Zone, string> = { bureau: 'Bureau', maison: 'Maison', inconnue: 'Inconnue' }

/** Indice de la première règle qui correspond au paquet (-1 si aucune : blocage par défaut). */
export function matchIndex(rules: readonly Rule[], p: Packet): number {
  for (let i = 0; i < rules.length; i++) {
    const r = rules[i]!
    if (r.zone && r.zone !== p.zone) continue
    if (r.ports && !r.ports.includes(p.port)) continue
    return i
  }
  return -1
}

/** La première règle qui correspond décide ; sans correspondance, on bloque. */
export function decide(rules: readonly Rule[], p: Packet): Action {
  const i = matchIndex(rules, p)
  return i < 0 ? 'block' : rules[i]!.action
}

export function ruleText(r: Rule): string {
  const who = r.zone ? 'venant de la zone ' + ZONE_LABEL[r.zone] : 'de toutes les zones'
  const what = r.ports ? 'les ports ' + r.ports.join(', ') : 'tous les ports'
  return (r.action === 'allow' ? 'AUTORISER ' : 'BLOQUER ') + what + ' ' + who
}

export const LEVELS: Level[] = [
  {
    title: 'Niveau 1 · Le web, oui ; le reste, non',
    rules: [{ action: 'allow', ports: [80, 443] }, { action: 'block' }],
    ports: [80, 443, 22, 23, 25, 3389],
    count: 8
  },
  {
    title: 'Niveau 2 · Les inconnus restent dehors',
    rules: [{ action: 'block', zone: 'inconnue' }, { action: 'allow', ports: [80, 443] }, { action: 'block' }],
    ports: [80, 443, 22, 25, 3389, 8080],
    count: 10
  },
  {
    title: 'Niveau 3 · SSH réservé au bureau',
    rules: [
      { action: 'block', zone: 'inconnue' },
      { action: 'allow', ports: [22], zone: 'bureau' },
      { action: 'block', ports: [22, 23, 3389] },
      { action: 'allow', ports: [80, 443, 8080] },
      { action: 'block' }
    ],
    ports: [80, 443, 22, 23, 3389, 8080, 25],
    count: 12
  }
]

/** Paquets du niveau, avec un bon mélange d'autorisés et de bloqués. */
export function makePackets(level: Level, rng: Rng): Packet[] {
  const zones: Zone[] = ['bureau', 'maison', 'inconnue']
  const pool: Packet[] = []
  for (const zone of zones) for (const port of level.ports) pool.push({ zone, port, service: SERVICES[port] ?? 'Autre' })
  const allowed = shuffle(pool.filter(p => decide(level.rules, p) === 'allow'), rng)
  const blocked = shuffle(pool.filter(p => decide(level.rules, p) === 'block'), rng)
  const nAllow = Math.floor(level.count / 2)
  const chosen: Packet[] = []
  for (let i = 0; i < nAllow; i++) chosen.push(allowed[i % allowed.length]!)
  for (let i = 0; i < level.count - nAllow; i++) chosen.push(blocked[i % blocked.length]!)
  return shuffle(chosen, rng)
}
