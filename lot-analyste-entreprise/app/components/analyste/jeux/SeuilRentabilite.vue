<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight, Calculator, Check, Minus, Plus, X } from '@lucide/vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import GameButton from '../GameButton.vue'
import LineChart from '../charts/LineChart.vue'
import { breakEvenUnits, makeRounds, profit, type BreakEvenRound } from '../../../utils/analyste/breakeven'
import { makeRng } from '../../../utils/analyste/rng'
import { readBest, submitBest } from '../../../utils/analyste/storage'
import { formatEuro } from '../../../utils/analyste/format'

const ROUNDS = 5
const WIN = 4

const rules = [
  'Une entreprise a des coûts fixes (loyer, salaires…) et un coût variable pour chaque unité vendue. Chaque unité laisse une marge : prix moins coût variable.',
  'Le seuil de rentabilité est le plus petit nombre d’unités vendues pour lequel on ne perd plus d’argent (bénéfice supérieur ou égal à zéro).',
  'Règle le nombre d’unités avec le curseur ou les boutons − et +, puis valide quand tu penses être pile sur le seuil.',
  ROUNDS + ' entreprises à analyser : il faut en réussir ' + WIN + ' pour gagner.',
]

const phase = ref<GamePhase>('intro')
const rounds = ref<BreakEvenRound[]>([])
const index = ref(0)
const units = ref(0)
const validated = ref(false)
const score = ref(0)
const best = ref<number | null>(null)

const round = computed(() => rounds.value[index.value])
const target = computed(() => (round.value ? breakEvenUnits(round.value) : 0))
const xMax = computed(() => Math.max(100, Math.ceil((target.value * 2) / 10) * 10))
const currentProfit = computed(() => (round.value ? profit(units.value, round.value) : 0))
const xs = computed(() => Array.from({ length: 21 }, (_, i) => (i * xMax.value) / 20))
const series = computed(() => {
  const r = round.value
  if (!r) return []
  return [
    { name: 'Chiffre d’affaires', color: 'var(--primary-color)', values: xs.value.map((x) => x * r.price) },
    { name: 'Coûts totaux', color: 'var(--accent-color)', values: xs.value.map((x) => r.fixed + x * r.unitCost) },
  ]
})
const correct = computed(() => validated.value && units.value === target.value)
const stats = computed(() => [{ label: 'Entreprise', value: Math.min(index.value + 1, ROUNDS) + '/' + ROUNDS }, { label: 'Réussies', value: score.value }])

function start() {
  rounds.value = makeRounds(ROUNDS, makeRng())
  index.value = 0
  score.value = 0
  units.value = 0
  validated.value = false
  best.value = readBest('seuil')
  phase.value = 'playing'
}

function step(delta: number) {
  if (validated.value) return
  units.value = Math.min(xMax.value, Math.max(0, units.value + delta))
}

function validate() {
  if (validated.value) return
  validated.value = true
  if (units.value === target.value) score.value++
}

function next() {
  if (index.value >= ROUNDS - 1) {
    submitBest('seuil', score.value, 'max')
    best.value = readBest('seuil')
    phase.value = score.value >= WIN ? 'won' : 'lost'
    return
  }
  index.value++
  units.value = 0
  validated.value = false
}

const resultTitle = computed(() => (phase.value === 'won' ? 'Les chiffres n’ont plus de secret' : 'Encore un petit effort'))
const resultText = computed(() => score.value + ' seuil(s) trouvé(s) sur ' + ROUNDS + '. Formule : coûts fixes ÷ (prix − coût variable), arrondie à l’entier supérieur.')
</script>

<template>
  <GameShell
    title="Seuil de rentabilité"
    :icon="Calculator"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :best="best !== null ? best + ' / ' + ROUNDS : null"
    :result-title="resultTitle"
    :result-text="resultText"
    intro-text="À partir de quelle quantité une activité commence-t-elle à gagner de l’argent ?"
    @start="start"
    @restart="start"
  >
    <div v-if="round" class="mx-auto max-w-xl">
      <h3 class="mb-2 text-lg font-bold text-white">{{ round.name }}</h3>
      <dl class="mb-3 grid grid-cols-3 gap-2 text-center text-sm">
        <div class="rounded-xl border border-slate-700 bg-slate-900/70 p-2"><dt class="text-xs text-slate-400">Coûts fixes</dt><dd class="font-bold text-white">{{ formatEuro(round.fixed) }}</dd></div>
        <div class="rounded-xl border border-slate-700 bg-slate-900/70 p-2"><dt class="text-xs text-slate-400">Prix de vente</dt><dd class="font-bold text-white">{{ formatEuro(round.price) }}</dd></div>
        <div class="rounded-xl border border-slate-700 bg-slate-900/70 p-2"><dt class="text-xs text-slate-400">Coût variable</dt><dd class="font-bold text-white">{{ formatEuro(round.unitCost) }}</dd></div>
      </dl>
      <LineChart :series="series" :xs="xs" :cursor-x="units" :height="210" label="Chiffre d’affaires et coûts totaux selon le nombre d’unités vendues" />
      <p class="mt-3 text-center text-sm text-slate-300">Combien d’unités faut-il vendre au minimum pour ne pas perdre d’argent ?</p>
      <div class="mt-2 flex items-center gap-2">
        <GameButton variant="ghost" small aria-label="Une unité de moins" :disabled="validated" @click="step(-1)"><Minus class="h-4 w-4" aria-hidden="true" /></GameButton>
        <input v-model.number="units" type="range" min="0" :max="xMax" class="h-10 flex-1 touch-manipulation accent-teal-400" aria-label="Nombre d’unités vendues" :disabled="validated" />
        <GameButton variant="ghost" small aria-label="Une unité de plus" :disabled="validated" @click="step(1)"><Plus class="h-4 w-4" aria-hidden="true" /></GameButton>
      </div>
      <p class="mt-1 text-center text-lg font-bold tabular-nums text-white">{{ units }} unités</p>
      <p class="text-center text-sm" :class="currentProfit >= 0 ? 'text-emerald-300' : 'text-rose-300'" aria-live="polite">
        {{ currentProfit >= 0 ? 'Bénéfice' : 'Perte' }} : {{ formatEuro(Math.abs(currentProfit)) }}
      </p>
      <div v-if="!validated" class="mt-3 flex justify-center"><GameButton @click="validate"><Check class="h-4 w-4" aria-hidden="true" /> Valider ce seuil</GameButton></div>
      <div v-else class="mt-3 rounded-xl border p-3 text-center" :class="correct ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-rose-400/40 bg-rose-500/10'" role="status">
        <p class="flex items-center justify-center gap-2 font-bold" :class="correct ? 'text-emerald-300' : 'text-rose-300'">
          <Check v-if="correct" class="h-5 w-5" aria-hidden="true" /><X v-else class="h-5 w-5" aria-hidden="true" />
          {{ correct ? 'Exact !' : 'Pas tout à fait : tu as choisi ' + units + ' unités.' }}
        </p>
        <p class="my-2 text-sm text-slate-200">{{ formatEuro(round.fixed) }} ÷ ({{ round.price }} − {{ round.unitCost }}) = {{ (round.fixed / (round.price - round.unitCost)).toFixed(2).replace('.', ',') }}, soit {{ target }} unités au minimum.</p>
        <GameButton @click="next">{{ index >= ROUNDS - 1 ? 'Voir le résultat' : 'Entreprise suivante' }} <ArrowRight class="h-4 w-4" aria-hidden="true" /></GameButton>
      </div>
    </div>
  </GameShell>
</template>
