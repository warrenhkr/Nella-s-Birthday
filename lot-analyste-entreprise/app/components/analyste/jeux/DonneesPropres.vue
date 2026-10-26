<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight, Check, Eraser, Flag, X } from '@lucide/vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import GameButton from '../GameButton.vue'
import { ANOMALY_LABEL, cellKey, judge, makeTable, type TableData, type Verdict } from '../../../utils/analyste/datacleaning'
import { makeRng, type Rng } from '../../../utils/analyste/rng'
import { readBest, submitBest } from '../../../utils/analyste/storage'

const COUNTS = [3, 4, 5]
const rules = [
  'Un fichier de ventes contient des erreurs cachées. Avant toute analyse, un analyste doit les repérer : c’est le nettoyage des données.',
  'Touche les cellules qui te semblent anormales pour les marquer (touche-les à nouveau pour retirer la marque), puis lance la vérification.',
  'Cinq sortes d’anomalies existent : doublon, valeur manquante, valeur impossible, mauvais format, valeur aberrante.',
  'Chaque fausse alerte annule une bonne trouvaille. Il faut repérer au moins 75 % des anomalies, fausses alertes déduites.',
]

const phase = ref<GamePhase>('intro')
const tables = ref<TableData[]>([])
const index = ref(0)
const flagged = ref<Set<string>>(new Set())
const verdict = ref<Verdict | null>(null)
const netTotal = ref(0)
const best = ref<number | null>(null)
let rng: Rng = makeRng()

const table = computed(() => tables.value[index.value])
const totalAnomalies = COUNTS.reduce((s, c) => s + c, 0)
const stats = computed(() => [{ label: 'Fichier', value: Math.min(index.value + 1, COUNTS.length) + '/' + COUNTS.length }, { label: 'Marques', value: flagged.value.size }, { label: 'Points nets', value: netTotal.value }])

function start() {
  rng = makeRng()
  tables.value = COUNTS.map((c) => makeTable(c, rng))
  index.value = 0
  flagged.value = new Set()
  verdict.value = null
  netTotal.value = 0
  best.value = readBest('donnees')
  phase.value = 'playing'
}

function toggle(r: number, c: number) {
  if (verdict.value) return
  const next = new Set(flagged.value)
  const k = cellKey(r, c)
  if (next.has(k)) next.delete(k)
  else next.add(k)
  flagged.value = next
}

function check() {
  if (!table.value || verdict.value) return
  verdict.value = judge(table.value, flagged.value)
  netTotal.value += Math.max(0, verdict.value.found.length - verdict.value.falseFlags.length)
}

function next() {
  if (index.value >= COUNTS.length - 1) {
    submitBest('donnees', netTotal.value, 'max')
    best.value = readBest('donnees')
    phase.value = netTotal.value >= Math.ceil(totalAnomalies * 0.75) ? 'won' : 'lost'
    return
  }
  index.value++
  flagged.value = new Set()
  verdict.value = null
}

function cellState(r: number, c: number): 'ok' | 'miss' | 'false' | 'flag' | 'none' {
  const k = cellKey(r, c)
  if (verdict.value) {
    const isMissed = verdict.value.missed.some((a) => a.cells.some(([rr, cc]) => rr === r && cc === c))
    const isFound = verdict.value.found.some((a) => a.cells.some(([rr, cc]) => rr === r && cc === c))
    if (flagged.value.has(k)) return isFound ? 'ok' : 'false'
    return isMissed ? 'miss' : 'none'
  }
  return flagged.value.has(k) ? 'flag' : 'none'
}
const CELL: Record<string, string> = {
  none: 'border-slate-700 bg-slate-900/70 text-slate-100',
  flag: 'border-amber-300 bg-amber-400/20 text-white',
  ok: 'border-emerald-300 bg-emerald-500/25 text-white',
  miss: 'border-rose-300 border-dashed bg-rose-500/20 text-white',
  false: 'border-rose-300 bg-slate-800 text-slate-300 line-through',
}
const resultText = computed(() => netTotal.value + ' point(s) nets sur ' + totalAnomalies + ' anomalies cachées.')
</script>

<template>
  <GameShell
    title="Données propres"
    :icon="Eraser"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :best="best !== null ? best + ' / ' + totalAnomalies : null"
    :result-title="phase === 'won' ? 'Un œil de data analyst' : 'Quelques erreurs sont passées'"
    :result-text="resultText"
    intro-text="Débusque les erreurs cachées dans un fichier de ventes avant qu’elles ne faussent les résultats."
    @start="start"
    @restart="start"
  >
    <div v-if="table" class="mx-auto max-w-2xl">
      <div class="overflow-x-auto rounded-xl border border-slate-700">
        <table class="w-full min-w-[34rem] border-collapse text-sm">
          <caption class="sr-only">Fichier de ventes à contrôler</caption>
          <thead class="bg-slate-800 text-xs uppercase text-slate-300">
            <tr><th v-for="h in table.headers" :key="h" scope="col" class="px-2 py-2 text-left font-semibold">{{ h }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="(row, r) in table.rows" :key="r" class="border-t border-slate-800">
              <td v-for="(cell, c) in row" :key="c" class="p-1">
                <button
                  type="button"
                  class="flex min-h-10 w-full items-center justify-between gap-1 rounded-lg border px-2 text-left font-mono text-xs transition active:scale-[0.97] sm:text-sm"
                  :class="CELL[cellState(r, c)]"
                  :aria-pressed="flagged.has(cellKey(r, c))"
                  :aria-label="(cell === '' ? 'cellule vide' : cell) + ', ligne ' + (r + 1) + ', ' + table.headers[c]"
                  :disabled="verdict !== null"
                  @click="toggle(r, c)"
                >
                  <span>{{ cell === '' ? '\u00a0' : cell }}</span>
                  <Flag v-if="cellState(r, c) === 'flag'" class="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden="true" />
                  <Check v-else-if="cellState(r, c) === 'ok'" class="h-3.5 w-3.5 shrink-0 text-emerald-300" aria-hidden="true" />
                  <X v-else-if="cellState(r, c) === 'miss' || cellState(r, c) === 'false'" class="h-3.5 w-3.5 shrink-0 text-rose-300" aria-hidden="true" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="mt-2 text-center text-xs text-slate-400">{{ table.anomalies.length }} anomalie(s) cachée(s) dans ce fichier.</p>
      <div v-if="!verdict" class="mt-3 flex justify-center"><GameButton @click="check"><Check class="h-4 w-4" aria-hidden="true" /> Vérifier mes marques</GameButton></div>
      <div v-else class="mt-3 rounded-xl border border-slate-700 bg-slate-900/80 p-3" role="status" aria-live="polite">
        <p class="mb-2 font-bold text-white">{{ verdict.found.length }} trouvée(s), {{ verdict.missed.length }} manquée(s), {{ verdict.falseFlags.length }} fausse(s) alerte(s).</p>
        <ul class="mb-3 space-y-1 text-sm text-slate-300">
          <li v-for="(a, i) in table.anomalies" :key="i" class="flex items-start gap-2">
            <Check v-if="verdict.found.includes(a)" class="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
            <X v-else class="mt-0.5 h-4 w-4 shrink-0 text-rose-300" aria-hidden="true" />
            <span>{{ ANOMALY_LABEL[a.type] }}.</span>
          </li>
        </ul>
        <div class="flex justify-center"><GameButton @click="next">{{ index >= COUNTS.length - 1 ? 'Voir le résultat' : 'Fichier suivant' }} <ArrowRight class="h-4 w-4" aria-hidden="true" /></GameButton></div>
      </div>
    </div>
  </GameShell>
</template>
