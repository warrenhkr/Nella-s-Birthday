<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight, Check, Gauge, X } from '@lucide/vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import GameButton from '../GameButton.vue'
import { drawKpi, type KpiDraw } from '../../../utils/analyste/kpi'
import { makeRng } from '../../../utils/analyste/rng'
import { readBest, submitBest } from '../../../utils/analyste/storage'

const COUNT = 10
const WIN = 7

const rules = [
  'Un KPI (indicateur clé de performance) est un chiffre choisi pour suivre un objectif précis.',
  'Chaque situation pose une question à un analyste. Choisis l’indicateur qui y répond VRAIMENT.',
  'Méfie-toi des « métriques de vanité » : des chiffres flatteurs (visites, « j’aime ») qui ne disent pas si l’entreprise va mieux.',
  COUNT + ' situations. Il faut ' + WIN + ' bonnes réponses.',
]

const phase = ref<GamePhase>('intro')
const questions = ref<KpiDraw[]>([])
const index = ref(0)
const chosen = ref<string | null>(null)
const score = ref(0)
const best = ref<number | null>(null)

const q = computed(() => questions.value[index.value])
const right = computed(() => chosen.value !== null && chosen.value === q.value?.answer)
const stats = computed(() => [{ label: 'Situation', value: Math.min(index.value + 1, COUNT) + '/' + COUNT }, { label: 'Score', value: score.value }])

function start() {
  questions.value = drawKpi(COUNT, makeRng())
  index.value = 0
  score.value = 0
  chosen.value = null
  best.value = readBest('kpi')
  phase.value = 'playing'
}

function choose(option: string) {
  if (chosen.value !== null || !q.value) return
  chosen.value = option
  if (option === q.value.answer) score.value++
}

function next() {
  if (index.value >= COUNT - 1) {
    submitBest('kpi', score.value, 'max')
    best.value = readBest('kpi')
    phase.value = score.value >= WIN ? 'won' : 'lost'
    return
  }
  index.value++
  chosen.value = null
}

const resultText = computed(() => score.value + ' bonne(s) réponse(s) sur ' + COUNT + '.')
</script>

<template>
  <GameShell
    title="Le bon indicateur"
    :icon="Gauge"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :best="best !== null ? best + ' / ' + COUNT : null"
    :result-title="phase === 'won' ? 'Tu sais mesurer ce qui compte' : 'Les indicateurs, à revoir'"
    :result-text="resultText"
    intro-text="Mesurer, oui, mais avec le bon chiffre."
    @start="start"
    @restart="start"
  >
    <div v-if="q" class="mx-auto max-w-xl">
      <p class="mb-4 rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-lg leading-snug text-white">{{ q.situation }}</p>
      <ul class="space-y-2">
        <li v-for="o in q.options" :key="o">
          <button
            type="button"
            class="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-4 py-2 text-left text-sm transition active:scale-[0.98] sm:text-base"
            :class="chosen === null ? 'border-slate-600 bg-slate-800/70 hover:bg-slate-700/70' : o === q.answer ? 'border-emerald-300 bg-emerald-500/20' : o === chosen ? 'border-rose-300 bg-rose-500/20' : 'border-slate-700 bg-slate-900/60 opacity-60'"
            :disabled="chosen !== null"
            @click="choose(o)"
          >
            <span>{{ o }}</span>
            <Check v-if="chosen !== null && o === q.answer" class="h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" />
            <X v-else-if="chosen !== null && o === chosen" class="h-5 w-5 shrink-0 text-rose-300" aria-hidden="true" />
          </button>
        </li>
      </ul>
      <div v-if="chosen !== null" class="mt-3 rounded-xl border p-3" :class="right ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-rose-400/40 bg-rose-500/10'" role="status" aria-live="polite">
        <p class="mb-1 font-bold" :class="right ? 'text-emerald-300' : 'text-rose-300'">{{ right ? 'Bonne réponse' : 'Pas le bon indicateur' }}</p>
        <p class="mb-3 text-sm text-slate-200">{{ q.why }}</p>
        <GameButton @click="next">{{ index >= COUNT - 1 ? 'Voir le résultat' : 'Suivante' }} <ArrowRight class="h-4 w-4" aria-hidden="true" /></GameButton>
      </div>
    </div>
  </GameShell>
</template>
