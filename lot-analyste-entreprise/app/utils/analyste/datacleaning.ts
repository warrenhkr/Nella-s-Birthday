import type { Rng } from './rng.ts'
import { shuffle } from './rng.ts'

/** Nettoyage de données : repérer les cellules suspectes d'un petit fichier de ventes. */
export type AnomalyType = 'doublon' | 'manquant' | 'impossible' | 'format' | 'aberrant'

export const ANOMALY_LABEL: Record<AnomalyType, string> = {
  doublon: 'Doublon : un numéro de commande qui apparaît deux fois',
  manquant: 'Valeur manquante : une case vide',
  impossible: 'Valeur impossible : une quantité négative ou une date qui n’existe pas',
  format: 'Mauvais format : du texte à la place d’un nombre ou d’une date',
  aberrant: 'Valeur aberrante : un chiffre démesuré par rapport aux autres',
}

export interface Anomaly {
  type: AnomalyType
  /** Cellules [ligne, colonne] dont le repérage compte comme une réussite (les deux lignes d'un doublon, par exemple). */
  cells: [number, number][]
}

export interface TableData {
  headers: string[]
  rows: string[][]
  anomalies: Anomaly[]
}

const HEADERS = ['N° commande', 'Date', 'Produit', 'Quantité', 'Prix unitaire (€)']
const PRODUCTS: [string, number][] = [['Macaron', 2.5], ['Éclair', 3.2], ['Tarte', 18], ['Cannelé', 1.8], ['Box cadeau', 34]]
const ROWS = 8

function baseRows(rng: Rng): string[][] {
  return Array.from({ length: ROWS }, (_, i) => {
    const [name, price] = PRODUCTS[Math.floor(rng() * PRODUCTS.length)]!
    const day = 1 + Math.floor(rng() * 27)
    return ['C-' + (1001 + i), '2026-03-' + String(day).padStart(2, '0'), name, String(1 + Math.floor(rng() * 6)), price.toFixed(2)]
  })
}

/** Table de 8 lignes avec exactement `count` anomalies, toutes sur des lignes différentes. */
export function makeTable(count: number, rng: Rng): TableData {
  const rows = baseRows(rng)
  const lines = shuffle(Array.from({ length: ROWS }, (_, i) => i), rng)
  const kinds = shuffle<AnomalyType>(['doublon', 'manquant', 'impossible', 'format', 'aberrant'], rng)
  const anomalies: Anomaly[] = []
  for (let k = 0; k < count; k++) {
    const type = kinds[k % kinds.length]!
    let r = lines.shift()!
    if (type === 'doublon') {
      const other = lines.shift()!
      rows[r]![0] = rows[other]![0]!
      anomalies.push({ type, cells: [[r, 0], [other, 0]] })
      continue
    }
    if (type === 'manquant') {
      const col = [2, 3, 4][Math.floor(rng() * 3)]!
      rows[r]![col] = ''
      anomalies.push({ type, cells: [[r, col]] })
    } else if (type === 'impossible') {
      if (rng() < 0.5) {
        rows[r]![3] = '-' + (1 + Math.floor(rng() * 5))
        anomalies.push({ type, cells: [[r, 3]] })
      } else {
        rows[r]![1] = '2026-02-30'
        anomalies.push({ type, cells: [[r, 1]] })
      }
    } else if (type === 'format') {
      if (rng() < 0.5) {
        rows[r]![4] = 'dix-huit euros'
        anomalies.push({ type, cells: [[r, 4]] })
      } else {
        rows[r]![1] = '12 mars'
        anomalies.push({ type, cells: [[r, 1]] })
      }
    } else {
      if (rng() < 0.5) {
        rows[r]![3] = String(400 + Math.floor(rng() * 500))
        anomalies.push({ type, cells: [[r, 3]] })
      } else {
        rows[r]![4] = (1800 + Math.floor(rng() * 800)).toFixed(2)
        anomalies.push({ type, cells: [[r, 4]] })
      }
    }
    r = -1
  }
  return { headers: HEADERS, rows, anomalies }
}

export interface Verdict {
  found: Anomaly[]
  missed: Anomaly[]
  falseFlags: [number, number][]
}

export const cellKey = (r: number, c: number) => r + ',' + c

export function judge(table: TableData, flagged: ReadonlySet<string>): Verdict {
  const good = new Set<string>()
  table.anomalies.forEach((a) => a.cells.forEach(([r, c]) => good.add(cellKey(r, c))))
  const found = table.anomalies.filter((a) => a.cells.some(([r, c]) => flagged.has(cellKey(r, c))))
  const missed = table.anomalies.filter((a) => !found.includes(a))
  const falseFlags = [...flagged].filter((k) => !good.has(k)).map((k) => k.split(',').map(Number) as [number, number])
  return { found, missed, falseFlags }
}
