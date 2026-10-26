<script setup lang="ts">
import { computed, ref } from 'vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import GameButton from '../GameButton.vue'
import LevelPicker from '../LevelPicker.vue'
import { makeRng, randInt } from '../../../utils/games/rng'
import { readBest, submitBest } from '../../../utils/games/storage'
import { formatTime } from '../../../utils/games/format'
import { useStopwatch } from '../../../utils/games/useStopwatch'

const ROUNDS = 5
const LEVELS = [
  { key: '5', label: 'Facile · 5 bougies (1 à 31)' },
  { key: '6', label: 'Moyen · 6 bougies (1 à 63)' },
  { key: '8', label: 'Difficile · 8 bougies (1 à 255)' },
]

const rules = [
  'Chaque bougie vaut un nombre : 1, 2, 4, 8, 16… (le double de la précédente). C’est le langage binaire des ordinateurs.',
  'Une bougie allumée compte, une bougie éteinte ne compte pas. Le total des bougies allumées donne le nombre affiché en bas.',
  'Allume les bonnes bougies pour obtenir le nombre cible. ' + ROUNDS + ' manches, le plus vite possible !',
]

const levelKey = ref('5')
const bits = computed(() => Number(levelKey.value))
const phase = ref<GamePhase>('intro')
const lit = ref<boolean[]>([])
const target = ref(0)
const round = ref(1)
const solved = ref(false)
const best = ref<number | null>(null)
const finalMs = ref(0)
const { elapsed, start: startClock, stop: stopClock } = useStopwatch()

const weights = computed(() => Array.from({ length: bits.value }, (_, i) => 2 ** (bits.value - 1 - i)))
const total = computed(() => lit.value.reduce((sum, on, i) => sum + (on ? weights.value[i]! : 0), 0))
const expression = computed(() => {
  const parts = weights.value.filter((_, i) => lit.value[i])
  return parts.length ? parts.join(' + ') + ' = ' + total.value : '0'
})
const stats = computed(() => [
  { label: 'Manche', value: round.value + '/' + ROUNDS },
  { label: 'Cible', value: target.value },
  { label: 'Temps', value: formatTime(elapsed.value) },
])

const rng = makeRng()
function newTarget() {
  target.value = randInt(rng, 1, 2 ** bits.value - 1)
  lit.value = new Array(bits.value).fill(false)
  solved.value = false
}

function start() {
  round.value = 1
  best.value = readBest('binaire-' + levelKey.value)
  newTarget()
  phase.value = 'playing'
  startClock()
}

function toggle(i: number) {
  if (phase.value !== 'playing' || solved.value) return
  lit.value = lit.value.map((v, k) => (k === i ? !v : v))
  if (total.value === target.value) solved.value = true
}

function next() {
  if (round.value >= ROUNDS) {
    finalMs.value = stopClock()
    submitBest('binaire-' + levelKey.value, Math.round(finalMs.value), 'min')
    best.value = readBest('binaire-' + levelKey.value)
    phase.value = 'won'
    return
  }
  round.value++
  newTarget()
}

function replayWith(key: string) {
  levelKey.value = key
  start()
}

const resultText = computed(() => 'Les ' + ROUNDS + ' nombres binaires en ' + formatTime(finalMs.value) + '.')
</script>

<template>
  <GameShell
    title="Bougies binaires"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :best="best !== null ? formatTime(best) : null"
    :result-text="resultText"
    intro-text="Compter comme un ordinateur, avec des bougies."
    @start="start"
    @restart="start"
  >
    <template #intro-extra>
      <LevelPicker :options="LEVELS" :model-value="levelKey" @update:model-value="levelKey = $event" />
    </template>
    <template #end-extra>
      <LevelPicker :options="LEVELS" :model-value="levelKey" @update:model-value="replayWith" />
    </template>
    <div class="mx-auto max-w-md text-center">
      <p class="text-sm text-violet-300">Fais apparaître le nombre</p>
      <p class="mb-4 text-6xl font-extrabold text-pink-200">{{ target }}</p>
      <div class="mb-4 flex justify-center gap-1.5 sm:gap-2">
        <button
          v-for="(w, i) in weights"
          :key="i"
          type="button"
          class="flex w-full max-w-[3.6rem] flex-col items-center gap-1 rounded-xl border px-1 py-2 transition active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300"
          :class="lit[i] ? 'border-amber-200 bg-amber-300/20' : 'border-violet-300/20 bg-violet-950/70'"
          :aria-pressed="lit[i]"
          :aria-label="'Bougie de valeur ' + w + (lit[i] ? ', allumée' : ', éteinte')"
          @click="toggle(i)"
        >
          <span class="text-2xl sm:text-3xl" aria-hidden="true">{{ lit[i] ? '🔥' : '🕯️' }}</span>
          <span class="text-sm font-bold text-white">{{ w }}</span>
          <span class="font-mono text-xs text-violet-300">{{ lit[i] ? 1 : 0 }}</span>
        </button>
      </div>
      <p class="mb-1 font-mono text-sm text-violet-100">{{ expression }}</p>
      <p class="mb-4 text-lg font-bold" :class="solved ? 'text-emerald-300' : total > target ? 'text-rose-300' : 'text-violet-200'" aria-live="polite">
        {{ solved ? '✔ Exact !' : total > target ? 'Trop haut : éteins une bougie' : 'Total : ' + total }}
      </p>
      <GameButton v-if="solved" @click="next">{{ round >= ROUNDS ? 'Terminer' : 'Manche suivante →' }}</GameButton>
    </div>
  </GameShell>
</template>
