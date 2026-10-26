<script setup lang="ts">
import { computed, ref } from 'vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import GameButton from '../GameButton.vue'
import { drawFacts, type Fact } from '../../../utils/games/truefalse'
import { makeRng } from '../../../utils/games/rng'
import { readBest, submitBest } from '../../../utils/games/storage'

const COUNT = 10
const WIN_SCORE = 7
const TAGS: Record<Fact['tag'], string> = { nature: '🌿 Nature', science: '🔬 Science', geek: '💻 Geek', cyber: '🔐 Cybersécurité' }

const rules = [
  'Une affirmation s’affiche : est-elle vraie ou fausse ?',
  'Après ta réponse, on t’explique pourquoi. Les idées reçues sont souvent fausses !',
  COUNT + ' affirmations par partie. Il faut au moins ' + WIN_SCORE + ' bonnes réponses pour gagner.',
]

const phase = ref<GamePhase>('intro')
const facts = ref<Fact[]>([])
const index = ref(0)
const score = ref(0)
const streak = ref(0)
const bestStreak = ref(0)
const answered = ref<boolean | null>(null)
const best = ref<number | null>(null)

const fact = computed(() => facts.value[index.value])
const correct = computed(() => answered.value !== null && fact.value !== undefined && answered.value === fact.value.answer)
const stats = computed(() => [
  { label: 'Question', value: Math.min(index.value + 1, COUNT) + '/' + COUNT },
  { label: 'Score', value: score.value },
  { label: 'Série', value: streak.value },
])

function start() {
  facts.value = drawFacts(COUNT, makeRng())
  index.value = 0
  score.value = 0
  streak.value = 0
  bestStreak.value = 0
  answered.value = null
  best.value = readBest('vraifaux')
  phase.value = 'playing'
}

function answer(value: boolean) {
  if (answered.value !== null || !fact.value) return
  answered.value = value
  if (value === fact.value.answer) {
    score.value++
    streak.value++
    bestStreak.value = Math.max(bestStreak.value, streak.value)
  } else streak.value = 0
}

function next() {
  if (index.value >= COUNT - 1) {
    submitBest('vraifaux', score.value, 'max')
    best.value = readBest('vraifaux')
    phase.value = score.value >= WIN_SCORE ? 'won' : 'lost'
    return
  }
  index.value++
  answered.value = null
}

const resultTitle = computed(() => (phase.value === 'won' ? 'Esprit critique au top !' : 'Presque !'))
const resultText = computed(() => score.value + ' bonne(s) réponse(s) sur ' + COUNT + ' · meilleure série : ' + bestStreak.value + '.')
</script>

<template>
  <GameShell
    title="Vrai ou faux"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :best="best !== null ? best + '/' + COUNT : null"
    :result-title="resultTitle"
    :result-text="resultText"
    intro-text="Des faits surprenants sur la nature, la science, l’informatique et la sécurité."
    @start="start"
    @restart="start"
  >
    <div v-if="fact" class="mx-auto max-w-md rounded-2xl border border-violet-300/20 bg-violet-950/60 p-5">
      <span class="mb-3 inline-block rounded-full bg-violet-800/60 px-3 py-1 text-xs font-semibold text-violet-100">{{ TAGS[fact.tag] }}</span>
      <p class="mb-5 text-lg font-medium leading-snug text-white">{{ fact.text }}</p>
      <div v-if="answered === null" class="grid grid-cols-2 gap-3">
        <GameButton @click="answer(true)">✔ Vrai</GameButton>
        <GameButton variant="danger" @click="answer(false)">✘ Faux</GameButton>
      </div>
      <div v-else role="status" aria-live="polite">
        <p class="mb-2 text-lg font-bold" :class="correct ? 'text-emerald-300' : 'text-rose-300'">
          {{ correct ? '✔ Bonne réponse !' : '✘ Raté ! C’était ' + (fact.answer ? 'vrai' : 'faux') + '.' }}
        </p>
        <p class="mb-4 text-sm text-violet-100">{{ fact.why }}</p>
        <GameButton @click="next">{{ index >= COUNT - 1 ? 'Voir mon score' : 'Suivante →' }}</GameButton>
      </div>
    </div>
  </GameShell>
</template>
