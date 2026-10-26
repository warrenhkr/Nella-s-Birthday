<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import { readBest, submitBest } from '../../../utils/games/storage'
import { randInt, makeRng, sleep } from '../../../utils/games/rng'

const TARGET = 10
const CANDLES = [
  { name: 'rose', cls: 'bg-pink-500', glow: 'ring-pink-200 shadow-pink-400/70' },
  { name: 'violette', cls: 'bg-violet-500', glow: 'ring-violet-200 shadow-violet-400/70' },
  { name: 'jaune', cls: 'bg-yellow-400', glow: 'ring-yellow-100 shadow-yellow-300/70' },
  { name: 'turquoise', cls: 'bg-teal-400', glow: 'ring-teal-100 shadow-teal-300/70' },
]

const rules = [
  'Regarde la séquence de bougies qui s’allument, puis rejoue-la dans le même ordre.',
  'À chaque tour, une bougie de plus s’ajoute à la séquence et le rythme s’accélère.',
  'Tu gagnes en réussissant ' + TARGET + ' bougies d’affilée. Une erreur et c’est perdu.',
]

const phase = ref<GamePhase>('intro')
const sequence = ref<number[]>([])
const lit = ref<number | null>(null)
const showing = ref(false)
const inputIndex = ref(0)
const best = ref<number | null>(null)
const rng = makeRng()
let token = 0

const stats = computed(() => [
  { label: 'Longueur', value: sequence.value.length },
  { label: 'Objectif', value: TARGET },
])

function speedFor(len: number): number {
  return Math.max(260, 620 - len * 35)
}

async function playSequence(myToken: number) {
  showing.value = true
  await sleep(500)
  for (const idx of sequence.value) {
    if (myToken !== token) return
    lit.value = idx
    await sleep(speedFor(sequence.value.length))
    lit.value = null
    await sleep(160)
  }
  if (myToken !== token) return
  showing.value = false
  inputIndex.value = 0
}

async function nextRound() {
  sequence.value = [...sequence.value, randInt(rng, 0, 3)]
  await playSequence(token)
}

function start() {
  token++
  sequence.value = []
  lit.value = null
  inputIndex.value = 0
  best.value = readBest('simon')
  phase.value = 'playing'
  void nextRound()
}

async function press(i: number) {
  if (phase.value !== 'playing' || showing.value) return
  const myToken = token
  lit.value = i
  setTimeout(() => {
    if (myToken === token && !showing.value) lit.value = null
  }, 220)
  if (sequence.value[inputIndex.value] !== i) {
    finish(false)
    return
  }
  inputIndex.value++
  if (inputIndex.value === sequence.value.length) {
    if (sequence.value.length >= TARGET) {
      finish(true)
      return
    }
    showing.value = true
    await sleep(700)
    if (myToken !== token) return
    await nextRound()
  }
}

function finish(won: boolean) {
  const reached = won ? sequence.value.length : Math.max(0, sequence.value.length - 1)
  submitBest('simon', reached, 'max')
  best.value = readBest('simon')
  phase.value = won ? 'won' : 'lost'
}

onBeforeUnmount(() => {
  token++
})

const resultText = computed(() =>
  phase.value === 'won'
    ? 'Tu as mémorisé ' + TARGET + ' bougies d’affilée : mémoire d’éléphant !'
    : 'Tu avais réussi ' + Math.max(0, sequence.value.length - 1) + ' bougie(s). Encore un essai ?',
)
</script>

<template>
  <GameShell
    title="Simon des bougies"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :best="best !== null ? best + ' bougies' : null"
    :result-text="resultText"
    intro-text="Un classique de mémoire, version gâteau d’anniversaire."
    @start="start"
    @restart="start"
  >
    <p class="mb-3 text-center text-sm text-violet-200" aria-live="polite">
      {{ phase !== 'playing' ? '' : showing ? 'Observe…' : 'À toi de jouer !' }}
    </p>
    <div class="mx-auto grid max-w-sm grid-cols-2 gap-3 sm:gap-4">
      <button
        v-for="(c, i) in CANDLES"
        :key="c.name"
        type="button"
        class="flex aspect-square flex-col items-center justify-center rounded-2xl text-5xl transition-all duration-150 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70 sm:text-6xl"
        :class="[
          c.cls,
          lit === i ? 'scale-105 shadow-2xl ring-4 brightness-125 ' + c.glow : 'opacity-60',
          showing ? 'cursor-default' : 'active:scale-95',
        ]"
        :aria-label="'Bougie ' + c.name"
        :disabled="showing"
        @pointerdown.prevent="press(i)"
      >
        <span aria-hidden="true">{{ lit === i ? '🔥' : '🕯️' }}</span>
      </button>
    </div>
  </GameShell>
</template>
