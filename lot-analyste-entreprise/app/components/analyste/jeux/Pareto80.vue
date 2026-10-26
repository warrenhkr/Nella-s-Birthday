<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight, Check, ChartColumn, X } from '@lucide/vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import GameButton from '../GameButton.vue'
import BarChart from '../charts/BarChart.vue'
import { cumulativePct, makeCauses, vitalFewCount, type Cause } from '../../../utils/analyste/pareto'
import { makeRng, type Rng } from '../../../utils/analyste/rng'
import { readBest, submitBest } from '../../../utils/analyste/storage'

const ROUNDS = 4
const WIN = 3
const THRESHOLD = 80

const rules = [
  'Le principe de Pareto : quelques causes (les « vitales ») expliquent l’essentiel des problèmes, souvent environ 80 %.',
  'Chaque manche présente les causes de réclamations d’une entreprise, de la plus fréquente à la moins fréquente.',
  'Sélectionne les premières causes, en nombre minimal, qui expliquent au moins ' + THRESHOLD + ' % des réclamations. Ni trop, ni trop peu.',
  'Il faut réussir ' + WIN + ' manches sur ' + ROUNDS + '.',
]

const phase = ref<GamePhase>('intro')
const datasets = ref<Cause[][]>([])
const index = ref(0)
const picked = ref<Set<number>>(new Set())
const validated = ref(false)
const score = ref(0)
const best = ref<number | null>(null)
let rng: Rng = makeRng()

const causes = computed(() => datasets.value[index.value] ?? [])
const total = computed(() => causes.value.reduce((s, c) => s + c.count, 0))
const k = computed(() => vitalFewCount(causes.value.map((c) => c.count), THRESHOLD))
const cumul = computed(() => cumulativePct(causes.value))
const pickedShare = computed(() => (100 * [...picked.value].reduce((s, i) => s + causes.value[i]!.count, 0)) / (total.value || 1))
const exact = computed(() => picked.value.size === k.value && [...picked.value].every((i) => i < k.value))
const stats = computed(() => [{ label: 'Manche', value: Math.min(index.value + 1, ROUNDS) + '/' + ROUNDS }, { label: 'Réussies', value: score.value }])

function setup() {
  const skew = [1.6, 1.2, 2.0, 1.4][index.value] ?? 1.5
  datasets.value[index.value] = makeCauses(6 + (index.value % 2), skew, rng)
  picked.value = new Set()
  validated.value = false
}

function start() {
  rng = makeRng()
  datasets.value = []
  index.value = 0
  score.value = 0
  best.value = readBest('pareto')
  phase.value = 'playing'
  setup()
}

function toggle(i: number) {
  if (validated.value) return
  const next = new Set(picked.value)
  if (next.has(i)) next.delete(i)
  else next.add(i)
  picked.value = next
}

function validate() {
  if (validated.value || picked.value.size === 0) return
  validated.value = true
  if (exact.value) score.value++
}

function next() {
  if (index.value >= ROUNDS - 1) {
    submitBest('pareto', score.value, 'max')
    best.value = readBest('pareto')
    phase.value = score.value >= WIN ? 'won' : 'lost'
    return
  }
  index.value++
  setup()
}

const resultText = computed(() => score.value + ' manche(s) réussie(s) sur ' + ROUNDS + '. Dans un Pareto, on classe puis on cumule : on s’arrête dès que le seuil est atteint.')
</script>

<template>
  <GameShell
    title="Pareto 80/20"
    :icon="ChartColumn"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :best="best !== null ? best + ' / ' + ROUNDS : null"
    :result-title="phase === 'won' ? 'Le 80/20, tu connais' : 'Le cumul t’a échappé'"
    :result-text="resultText"
    intro-text="Repère les rares causes qui font l’essentiel des dégâts."
    @start="start"
    @restart="start"
  >
    <div class="mx-auto max-w-xl">
      <BarChart
        :labels="causes.map((c) => c.name)"
        :values="causes.map((c) => c.count)"
        :highlight="[...picked]"
        :cumulative="validated ? cumul : undefined"
        :threshold="validated ? THRESHOLD : undefined"
        :height="250"
        label="Nombre de réclamations par cause, de la plus fréquente à la moins fréquente"
      />
      <p class="mb-2 text-center text-sm text-slate-300">Réclamations au total : <strong class="text-white">{{ total }}</strong>. Sélection : <strong class="text-teal-300">{{ picked.size }}</strong> cause(s), soit <strong class="text-teal-300">{{ pickedShare.toFixed(1).replace('.', ',') }} %</strong>.</p>
      <ul class="grid gap-2 sm:grid-cols-2" aria-label="Causes de réclamation">
        <li v-for="(c, i) in causes" :key="c.name">
          <button
            type="button"
            class="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border px-3 text-left text-sm transition active:scale-[0.98]"
            :class="picked.has(i) ? 'border-teal-300 bg-teal-500/20 text-white' : 'border-slate-700 bg-slate-900/70 text-slate-200'"
            :aria-pressed="picked.has(i)"
            :disabled="validated"
            @click="toggle(i)"
          >
            <span>{{ c.name }}</span><span class="tabular-nums text-slate-400">{{ c.count }}</span>
          </button>
        </li>
      </ul>
      <div v-if="!validated" class="mt-3 flex justify-center"><GameButton :disabled="picked.size === 0" @click="validate"><Check class="h-4 w-4" aria-hidden="true" /> Valider ma sélection</GameButton></div>
      <div v-else class="mt-3 rounded-xl border p-3 text-center" :class="exact ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-rose-400/40 bg-rose-500/10'" role="status">
        <p class="flex items-center justify-center gap-2 font-bold" :class="exact ? 'text-emerald-300' : 'text-rose-300'">
          <Check v-if="exact" class="h-5 w-5" aria-hidden="true" /><X v-else class="h-5 w-5" aria-hidden="true" />
          {{ exact ? 'Exact !' : 'Pas tout à fait.' }}
        </p>
        <p class="my-2 text-sm text-slate-200">Il faut les {{ k }} premières causes : leur cumul atteint {{ cumul[k - 1]!.toFixed(1).replace('.', ',') }} %{{ k > 1 ? ', alors que ' + (k - 1) + ' seulement donnent ' + cumul[k - 2]!.toFixed(1).replace('.', ',') + ' %' : '' }}.</p>
        <GameButton @click="next">{{ index >= ROUNDS - 1 ? 'Voir le résultat' : 'Manche suivante' }} <ArrowRight class="h-4 w-4" aria-hidden="true" /></GameButton>
      </div>
    </div>
  </GameShell>
</template>
