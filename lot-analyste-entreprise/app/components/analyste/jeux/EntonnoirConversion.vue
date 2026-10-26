<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight, Check, Funnel, X } from '@lucide/vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import GameButton from '../GameButton.vue'
import FunnelChart from '../charts/FunnelChart.vue'
import { STEPS, makeFunnel, makeQuestions, worstTransition, type FunnelQuestion } from '../../../utils/analyste/funnel'
import { makeRng } from '../../../utils/analyste/rng'
import { readBest, submitBest } from '../../../utils/analyste/storage'

const WIN = 5

const rules = [
  'Un entonnoir de conversion montre combien de visiteurs franchissent chaque étape avant d’acheter.',
  'Le taux de passage entre deux étapes se calcule en divisant l’étape suivante par l’étape de départ.',
  'Lis l’entonnoir, puis réponds aux 6 questions. Il faut ' + WIN + ' bonnes réponses.',
]

const phase = ref<GamePhase>('intro')
const counts = ref<number[]>([])
const questions = ref<FunnelQuestion[]>([])
const index = ref(0)
const chosen = ref<string | null>(null)
const score = ref(0)
const best = ref<number | null>(null)
const revealWorst = ref(false)

const q = computed(() => questions.value[index.value])
const right = computed(() => chosen.value !== null && chosen.value === q.value?.answer)
const steps = computed(() => counts.value.map((v, i) => ({ label: STEPS[i]!, value: v })))
const stats = computed(() => [{ label: 'Question', value: Math.min(index.value + 1, 6) + '/6' }, { label: 'Score', value: score.value }])

function start() {
  const rng = makeRng()
  counts.value = makeFunnel(rng)
  questions.value = makeQuestions(counts.value, rng)
  index.value = 0
  score.value = 0
  chosen.value = null
  revealWorst.value = false
  best.value = readBest('entonnoir')
  phase.value = 'playing'
}

function choose(o: string) {
  if (chosen.value !== null || !q.value) return
  chosen.value = o
  if (o === q.value.answer) score.value++
}

function next() {
  if (index.value >= questions.value.length - 1) {
    submitBest('entonnoir', score.value, 'max')
    best.value = readBest('entonnoir')
    phase.value = score.value >= WIN ? 'won' : 'lost'
    return
  }
  index.value++
  chosen.value = null
  revealWorst.value = index.value >= 4
}

const resultText = computed(() => score.value + ' bonne(s) réponse(s) sur 6.')
</script>

<template>
  <GameShell
    title="Entonnoir de conversion"
    :icon="Funnel"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :best="best !== null ? best + ' / 6' : null"
    :result-title="phase === 'won' ? 'Tu lis un entonnoir comme un pro' : 'Les pourcentages t’ont échappé'"
    :result-text="resultText"
    intro-text="Où perd-on les clients entre la visite et la commande ?"
    @start="start"
    @restart="start"
  >
    <div v-if="q" class="mx-auto max-w-xl">
      <div class="mb-4 rounded-2xl border border-slate-700 bg-slate-900/70 p-3">
        <FunnelChart :steps="steps" :highlight="revealWorst ? worstTransition(counts) : undefined" />
      </div>
      <p class="mb-3 text-lg leading-snug text-white">{{ q.prompt }}</p>
      <ul class="grid gap-2 sm:grid-cols-2">
        <li v-for="o in q.options" :key="o">
          <button
            type="button"
            class="flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm transition active:scale-[0.98]"
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
        <p class="mb-1 font-bold" :class="right ? 'text-emerald-300' : 'text-rose-300'">{{ right ? 'Exact' : 'Pas tout à fait' }}</p>
        <p class="mb-3 text-sm text-slate-200">{{ q.why }}</p>
        <GameButton @click="next">{{ index >= questions.length - 1 ? 'Voir le résultat' : 'Suivante' }} <ArrowRight class="h-4 w-4" aria-hidden="true" /></GameButton>
      </div>
    </div>
  </GameShell>
</template>
