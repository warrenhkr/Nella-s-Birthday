<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight, Check, Eye, EyeOff, TrendingUp } from '@lucide/vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import GameButton from '../GameButton.vue'
import LineChart, { type LineSeries, type Marker } from '../charts/LineChart.vue'
import { MONTHS, errorPct, linearForecast, makeSeries, pointsFor, type Series } from '../../../utils/analyste/forecast'
import { makeRng, type Rng } from '../../../utils/analyste/rng'
import { readBest, submitBest } from '../../../utils/analyste/storage'

const ROUNDS = 5
const WIN = 30
const TREND_PENALTY = 2

const rules = [
  'Voici les ventes mensuelles d’un produit sur 11 mois. À toi de prévoir les ventes du 12e mois (décembre) avec le curseur.',
  'Observe la tendance (hausse, baisse) et les petites variations d’un mois à l’autre.',
  'Plus ton estimation est proche de la réalité, plus tu gagnes de points (jusqu’à 10 par manche).',
  'Le bouton « Afficher la tendance » trace une droite de régression, mais il retire ' + TREND_PENALTY + ' points. ' + ROUNDS + ' manches, ' + WIN + ' points sur 50 pour gagner.',
]

const phase = ref<GamePhase>('intro')
const seriesList = ref<Series[]>([])
const index = ref(0)
const guess = ref(0)
const validated = ref(false)
const showTrend = ref(false)
const trendUsed = ref(false)
const total = ref(0)
const gained = ref(0)
const best = ref<number | null>(null)
let rng: Rng = makeRng()

const s = computed(() => seriesList.value[index.value])
const lo = computed(() => (s.value ? Math.floor(Math.min(...s.value.values, s.value.truth) * 0.6) : 0))
const hi = computed(() => (s.value ? Math.ceil(Math.max(...s.value.values, s.value.truth) * 1.4) : 100))
const xs = computed(() => (s.value ? s.value.values.map((_, i) => i).concat([11]) : []))
const labels = computed(() => MONTHS)
const chartSeries = computed<LineSeries[]>(() => {
  if (!s.value) return []
  const list: LineSeries[] = [{ name: 'Ventes connues', color: 'var(--primary-color)', values: [...s.value.values, null] }]
  if (showTrend.value || validated.value) {
    const line = Array.from({ length: 12 }, (_, t) => linearForecast(s.value!.values, t))
    list.push({ name: 'Tendance (régression)', color: 'var(--accent-color)', dashed: true, values: line })
  }
  return list
})
const markers = computed<Marker[]>(() => {
  const m: Marker[] = [{ x: 11, y: guess.value, color: 'var(--theme-heading)', label: 'Ton estimation : ' + guess.value }]
  if (validated.value && s.value) m.push({ x: 11, y: s.value.truth, color: 'var(--accent-color)', label: 'Réalité : ' + s.value.truth })
  return m
})
const err = computed(() => (s.value ? errorPct(guess.value, s.value.truth) : 0))
const stats = computed(() => [{ label: 'Manche', value: Math.min(index.value + 1, ROUNDS) + '/' + ROUNDS }, { label: 'Points', value: total.value }])

function setup() {
  const cur = seriesList.value[index.value]!
  guess.value = Math.round(cur.values[cur.values.length - 1]!)
  validated.value = false
  showTrend.value = false
  trendUsed.value = false
  gained.value = 0
}

function start() {
  rng = makeRng()
  seriesList.value = Array.from({ length: ROUNDS }, () => makeSeries(rng))
  index.value = 0
  total.value = 0
  best.value = readBest('tendance')
  phase.value = 'playing'
  setup()
}

function toggleTrend() {
  showTrend.value = !showTrend.value
  if (showTrend.value) trendUsed.value = true
}

function validate() {
  if (validated.value || !s.value) return
  validated.value = true
  gained.value = Math.max(0, pointsFor(err.value) - (trendUsed.value ? TREND_PENALTY : 0))
  total.value += gained.value
}

function next() {
  if (index.value >= ROUNDS - 1) {
    submitBest('tendance', total.value, 'max')
    best.value = readBest('tendance')
    phase.value = total.value >= WIN ? 'won' : 'lost'
    return
  }
  index.value++
  setup()
}

const resultText = computed(() => total.value + ' points sur 50 (il en fallait ' + WIN + ').')
</script>

<template>
  <GameShell
    title="Devine la tendance"
    :icon="TrendingUp"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :best="best !== null ? best + ' / 50' : null"
    :result-title="phase === 'won' ? 'Tu as le sens de la tendance' : 'La prévision, ce n’est pas si simple'"
    :result-text="resultText"
    intro-text="Prévoir l’avenir à partir du passé, comme un vrai analyste."
    @start="start"
    @restart="start"
  >
    <div v-if="s" class="mx-auto max-w-xl">
      <div class="rounded-2xl border border-slate-700 bg-slate-900/70 p-3">
        <LineChart :series="chartSeries" :xs="xs.slice(0, 11).concat([11])" :labels="labels" :markers="markers" :y-min="lo" :y-max="hi" :height="240" :x-label-every="2" label="Ventes mensuelles de janvier à novembre et estimation pour décembre" />
      </div>
      <div class="mt-3 flex items-center gap-3">
        <label for="devine-estimation" class="text-sm text-slate-300">Décembre :</label>
        <input id="devine-estimation" v-model.number="guess" type="range" :min="lo" :max="hi" class="h-10 flex-1 touch-manipulation accent-sky-400" :disabled="validated" />
        <span class="w-12 text-right font-bold tabular-nums text-white">{{ guess }}</span>
      </div>
      <div v-if="!validated" class="mt-3 flex flex-wrap justify-center gap-2">
        <GameButton variant="ghost" small @click="toggleTrend">
          <component :is="showTrend ? EyeOff : Eye" class="h-4 w-4" aria-hidden="true" /> {{ showTrend ? 'Masquer la tendance' : 'Afficher la tendance (−' + TREND_PENALTY + ' pts)' }}
        </GameButton>
        <GameButton @click="validate"><Check class="h-4 w-4" aria-hidden="true" /> Valider</GameButton>
      </div>
      <div v-else class="mt-3 rounded-xl border border-slate-700 bg-slate-900/80 p-3 text-center" role="status" aria-live="polite">
        <p class="font-bold" :class="gained >= 6 ? 'text-emerald-300' : gained > 0 ? 'text-amber-300' : 'text-rose-300'">
          {{ gained }} point(s) : erreur de {{ err.toFixed(1).replace('.', ',') }} % (réalité : {{ s.truth }}).
        </p>
        <p class="my-2 text-sm text-slate-300">La droite de tendance donnait {{ Math.round(linearForecast(s.values, 11)) }}.</p>
        <GameButton @click="next">{{ index >= ROUNDS - 1 ? 'Voir le résultat' : 'Manche suivante' }} <ArrowRight class="h-4 w-4" aria-hidden="true" /></GameButton>
      </div>
    </div>
  </GameShell>
</template>
