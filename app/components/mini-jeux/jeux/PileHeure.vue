<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import GameButton from '../GameButton.vue'
import { readBest, submitBest } from '../../../utils/games/storage'

const ROUNDS = [5, 8, 10]
const HIDE_AFTER_MS = 2000
const WIN_TOTAL_MS = 800

const rules = [
  'Un chronomètre démarre. Appuie sur « Stop » quand tu penses qu’il atteint exactement la cible (5, 8 puis 10 secondes).',
  'Après 2 secondes, le chrono se cache : à toi de sentir le temps passer !',
  'Trois manches. Tu gagnes si l’écart total reste sous 0,8 seconde. Plus l’écart est petit, plus ton score est beau.'
]

type RoundState = 'ready' | 'running' | 'result'
const phase = ref<GamePhase>('intro')
const round = ref(0)
const roundState = ref<RoundState>('ready')
const display = ref(0)
const errors = ref<number[]>([])
const best = ref<number | null>(null)
let startedAt = 0
let raf = 0

const target = computed(() => ROUNDS[round.value] ?? 0)
const total = computed(() => errors.value.reduce((a, b) => a + b, 0))
const hidden = computed(() => roundState.value === 'running' && display.value > HIDE_AFTER_MS)
const lastError = computed(() => (errors.value.length ? errors.value[errors.value.length - 1]! : 0))
const stats = computed(() => [
  { label: 'Manche', value: Math.min(round.value + 1, ROUNDS.length) + '/' + ROUNDS.length },
  { label: 'Cible', value: target.value + ' s' },
  { label: 'Écart total', value: (total.value / 1000).toFixed(2) + ' s' }
])

function start() {
  cancelAnimationFrame(raf)
  round.value = 0
  errors.value = []
  display.value = 0
  roundState.value = 'ready'
  best.value = readBest('pileheure')
  phase.value = 'playing'
}

function launch() {
  roundState.value = 'running'
  startedAt = performance.now()
  const loop = () => {
    display.value = performance.now() - startedAt
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)
}

function stop() {
  if (roundState.value !== 'running') return
  cancelAnimationFrame(raf)
  display.value = performance.now() - startedAt
  errors.value = [...errors.value, Math.abs(display.value - target.value * 1000)]
  roundState.value = 'result'
}

function nextRound() {
  if (round.value >= ROUNDS.length - 1) {
    submitBest('pileheure', Math.round(total.value), 'min')
    best.value = readBest('pileheure')
    phase.value = total.value <= WIN_TOTAL_MS ? 'won' : 'lost'
    return
  }
  round.value++
  display.value = 0
  roundState.value = 'ready'
}

onBeforeUnmount(() => cancelAnimationFrame(raf))

const resultTitle = computed(() => (phase.value === 'won' ? 'Quel sens du temps !' : 'Pas tout à fait…'))
const resultText = computed(() => 'Écart total : ' + (total.value / 1000).toFixed(2) + ' s (objectif : moins de 0,8 s).')
</script>

<template>
  <GameShell
    title="Pile à l’heure"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :best="best !== null ? (best / 1000).toFixed(2) + ' s d’écart' : null"
    :result-title="resultTitle"
    :result-text="resultText"
    intro-text="Ton horloge interne est-elle précise ? Arrête le chrono pile sur la cible."
    @start="start"
    @restart="start"
  >
    <div class="mx-auto flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-violet-300/20 bg-violet-950/60 p-6 text-center">
      <p class="text-sm uppercase tracking-wide text-violet-300">
        Arrête-toi à
      </p>
      <p class="text-5xl font-extrabold text-pink-200">
        {{ target }} s
      </p>
      <p
        class="font-mono text-5xl font-bold tabular-nums text-white"
        aria-live="off"
      >
        <template v-if="roundState === 'ready'">
          0.00
        </template>
        <template v-else-if="hidden">
          ⏳ ???
        </template>
        <template v-else>
          {{ (display / 1000).toFixed(2) }}
        </template>
      </p>
      <p
        v-if="roundState === 'result'"
        class="text-lg"
        :class="lastError < 200 ? 'text-emerald-300' : lastError < 600 ? 'text-amber-200' : 'text-rose-300'"
        role="status"
      >
        Tu as arrêté à {{ (display / 1000).toFixed(2) }} s · écart {{ (lastError / 1000).toFixed(2) }} s
      </p>
      <GameButton
        v-if="roundState === 'ready'"
        @click="launch"
      >
        ▶ Lancer le chrono
      </GameButton>
      <button
        v-else-if="roundState === 'running'"
        type="button"
        class="min-h-16 w-full touch-manipulation rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 text-2xl font-bold text-white shadow-lg active:scale-95"
        @pointerdown.prevent="stop"
        @keydown.enter.prevent="stop"
        @keydown.space.prevent="stop"
      >
        ⏹ STOP
      </button>
      <GameButton
        v-else
        @click="nextRound"
      >
        {{ round >= ROUNDS.length - 1 ? 'Voir le résultat' : 'Manche suivante →' }}
      </GameButton>
    </div>
  </GameShell>
</template>
