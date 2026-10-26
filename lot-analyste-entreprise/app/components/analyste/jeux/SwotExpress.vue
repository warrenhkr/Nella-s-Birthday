<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight, Check, CloudLightning, Grid2x2, Rocket, ShieldCheck, TriangleAlert, X } from '@lucide/vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import GameButton from '../GameButton.vue'
import { QUADRANTS, drawScenario, type Quadrant } from '../../../utils/analyste/swot'
import { makeRng, type Rng } from '../../../utils/analyste/rng'
import { readBest, submitBest } from '../../../utils/analyste/storage'

const WIN = 9
const ICONS = { S: ShieldCheck, W: TriangleAlert, O: Rocket, T: CloudLightning }
const TONE: Record<Quadrant, string> = { S: 'border-emerald-400/50 bg-emerald-500/10', W: 'border-amber-400/50 bg-amber-500/10', O: 'border-sky-400/50 bg-sky-500/10', T: 'border-rose-400/50 bg-rose-500/10' }

const rules = [
  'Une analyse SWOT classe les éléments qui touchent une entreprise en quatre cases.',
  'Forces et faiblesses sont INTERNES : elles viennent de l’entreprise. Opportunités et menaces sont EXTERNES : elles viennent de son environnement.',
  'Forces et opportunités sont favorables. Faiblesses et menaces sont défavorables.',
  'Classe chaque affirmation dans la bonne case. Il faut ' + WIN + ' bonnes réponses sur 12.',
]

const phase = ref<GamePhase>('intro')
const title = ref('')
const intro = ref('')
const cards = ref<{ id: number; text: string; quad: Quadrant }[]>([])
const index = ref(0)
const answered = ref<Quadrant | null>(null)
const placed = ref<{ text: string; quad: Quadrant }[]>([])
const score = ref(0)
const best = ref<number | null>(null)
let scenarioIndex = -1
let rng: Rng = makeRng()

const card = computed(() => cards.value[index.value])
const right = computed(() => answered.value !== null && card.value?.quad === answered.value)
const label = (q: Quadrant) => QUADRANTS.find((x) => x.key === q)!.label
const stats = computed(() => [{ label: 'Affirmation', value: Math.min(index.value + 1, 12) + '/12' }, { label: 'Bonnes réponses', value: score.value }])

function start() {
  rng = makeRng()
  const d = drawScenario(rng, scenarioIndex)
  scenarioIndex = d.index
  title.value = d.scenario.title
  intro.value = d.scenario.intro
  cards.value = d.cards
  index.value = 0
  score.value = 0
  answered.value = null
  placed.value = []
  best.value = readBest('swot')
  phase.value = 'playing'
}

function answer(q: Quadrant) {
  if (answered.value !== null || !card.value) return
  answered.value = q
  if (q === card.value.quad) score.value++
  placed.value = [...placed.value, { text: card.value.text, quad: card.value.quad }]
}

function next() {
  if (index.value >= cards.value.length - 1) {
    submitBest('swot', score.value, 'max')
    best.value = readBest('swot')
    phase.value = score.value >= WIN ? 'won' : 'lost'
    return
  }
  index.value++
  answered.value = null
}

const explain = (q: Quadrant) => ({ S: 'interne et favorable', W: 'interne et défavorable', O: 'externe et favorable', T: 'externe et défavorable' })[q]
const resultText = computed(() => score.value + ' bonne(s) réponse(s) sur 12 pour « ' + title.value + ' ».')
</script>

<template>
  <GameShell
    title="SWOT express"
    :icon="Grid2x2"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :best="best !== null ? best + ' / 12' : null"
    :result-title="phase === 'won' ? 'Diagnostic stratégique réussi' : 'Interne ou externe ? Il faut y revenir'"
    :result-text="resultText"
    intro-text="Le premier outil de tout analyste : diagnostiquer une entreprise en quatre cases."
    @start="start"
    @restart="start"
  >
    <div v-if="card" class="mx-auto max-w-xl">
      <p class="mb-1 text-sm font-semibold text-teal-300">{{ title }}</p>
      <p class="mb-3 text-xs text-slate-400">{{ intro }}</p>
      <div class="rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
        <p class="mb-4 text-lg leading-snug text-white">{{ card.text }}</p>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="q in QUADRANTS"
            :key="q.key"
            type="button"
            class="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-2 text-sm font-semibold transition active:scale-95 disabled:cursor-default"
            :class="answered === null ? 'border-slate-600 bg-slate-800/70 hover:bg-slate-700/70' : q.key === card.quad ? 'border-emerald-300 bg-emerald-500/25' : q.key === answered ? 'border-rose-300 bg-rose-500/25' : 'border-slate-700 bg-slate-900/60 opacity-60'"
            :disabled="answered !== null"
            @click="answer(q.key)"
          >
            <component :is="ICONS[q.key]" class="h-5 w-5" aria-hidden="true" />
            <span>{{ q.label }}</span><span class="text-[0.65rem] font-normal text-slate-400">{{ q.hint }}</span>
          </button>
        </div>
        <div v-if="answered !== null" class="mt-3 text-center" role="status" aria-live="polite">
          <p class="flex items-center justify-center gap-2 font-bold" :class="right ? 'text-emerald-300' : 'text-rose-300'">
            <Check v-if="right" class="h-5 w-5" aria-hidden="true" /><X v-else class="h-5 w-5" aria-hidden="true" />
            {{ right ? 'Bien classé !' : 'C’était : ' + label(card.quad) + '.' }}
          </p>
          <p class="my-2 text-sm text-slate-300">Cet élément est {{ explain(card.quad) }}.</p>
          <GameButton @click="next">{{ index >= cards.length - 1 ? 'Voir le résultat' : 'Suivante' }} <ArrowRight class="h-4 w-4" aria-hidden="true" /></GameButton>
        </div>
      </div>
      <div class="mt-4 grid grid-cols-2 gap-2 text-xs" aria-label="Matrice SWOT en construction">
        <div v-for="q in QUADRANTS" :key="q.key" class="min-h-16 rounded-xl border p-2" :class="TONE[q.key]">
          <p class="mb-1 flex items-center gap-1 font-semibold text-slate-100"><component :is="ICONS[q.key]" class="h-3.5 w-3.5" aria-hidden="true" />{{ q.label }}s</p>
          <ul class="space-y-0.5 text-slate-300"><li v-for="p in placed.filter((x) => x.quad === q.key)" :key="p.text" class="line-clamp-2">{{ p.text }}</li></ul>
        </div>
      </div>
    </div>
  </GameShell>
</template>
