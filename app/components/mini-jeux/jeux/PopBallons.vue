<script setup lang="ts">
import { computed, ref } from 'vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import LevelPicker from '../LevelPicker.vue'
import { placeBalloons, type Balloon } from '../../../utils/games/balloons'
import { makeRng } from '../../../utils/games/rng'
import { readBest, submitBest } from '../../../utils/games/storage'
import { formatTime } from '../../../utils/games/format'
import { useStopwatch } from '../../../utils/games/useStopwatch'

const LEVELS = [
  { key: '8', label: 'Facile · 8 ballons' },
  { key: '12', label: 'Moyen · 12 ballons' },
  { key: '16', label: 'Difficile · 16 ballons' }
]
const PENALTY_MS = 2000

const rules = [
  'Des ballons numérotés flottent à l’écran. Éclate-les dans l’ordre : 1, 2, 3…',
  'Toucher un mauvais ballon ajoute 2 secondes de pénalité.',
  'Termine le plus vite possible. Ton temps final inclut les pénalités.'
]

const levelKey = ref('8')
const phase = ref<GamePhase>('intro')
const balloons = ref<Balloon[]>([])
const next = ref(1)
const mistakes = ref(0)
const wrong = ref<number | null>(null)
const best = ref<number | null>(null)
const record = ref(false)
const finalMs = ref(0)
const { elapsed, start: startClock, stop: stopClock } = useStopwatch()
let wrongTimer: ReturnType<typeof setTimeout> | null = null

const count = computed(() => Number(levelKey.value))
const stats = computed(() => [
  { label: 'Prochain', value: next.value > count.value ? '✓' : next.value },
  { label: 'Erreurs', value: mistakes.value },
  { label: 'Temps', value: formatTime(elapsed.value + mistakes.value * PENALTY_MS) }
])

function start() {
  balloons.value = placeBalloons(count.value, makeRng())
  next.value = 1
  mistakes.value = 0
  wrong.value = null
  record.value = false
  best.value = readBest('ballons-' + levelKey.value)
  phase.value = 'playing'
  startClock()
}

function pop(b: Balloon) {
  if (phase.value !== 'playing' || b.n < next.value) return
  if (b.n !== next.value) {
    mistakes.value++
    wrong.value = b.n
    if (wrongTimer) clearTimeout(wrongTimer)
    wrongTimer = setTimeout(() => (wrong.value = null), 350)
    return
  }
  next.value++
  if (next.value > count.value) {
    finalMs.value = stopClock() + mistakes.value * PENALTY_MS
    record.value = submitBest('ballons-' + levelKey.value, Math.round(finalMs.value), 'min')
    best.value = readBest('ballons-' + levelKey.value)
    phase.value = 'won'
  }
}

function replayWith(key: string) {
  levelKey.value = key
  start()
}

const resultText = computed(
  () => 'Temps final : ' + formatTime(finalMs.value) + (mistakes.value ? ' (dont ' + mistakes.value * 2 + ' s de pénalité)' : '') + (record.value ? ' · Nouveau record !' : '')
)
</script>

<template>
  <GameShell
    title="Pop les ballons"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :best="best !== null ? formatTime(best) : null"
    :result-text="resultText"
    intro-text="Un jeu de rapidité et d’observation : éclate tous les ballons dans l’ordre."
    @start="start"
    @restart="start"
  >
    <template #intro-extra>
      <LevelPicker
        :options="LEVELS"
        :model-value="levelKey"
        @update:model-value="levelKey = $event"
      />
    </template>
    <template #end-extra>
      <LevelPicker
        :options="LEVELS"
        :model-value="levelKey"
        @update:model-value="replayWith"
      />
    </template>
    <div class="relative mx-auto aspect-[4/5] w-full max-w-md touch-manipulation overflow-hidden rounded-2xl border border-violet-300/20 bg-gradient-to-b from-sky-900 via-indigo-900 to-violet-950 sm:aspect-[4/3]">
      <button
        v-for="b in balloons"
        :key="b.n"
        type="button"
        class="absolute flex h-16 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[50%_50%_50%_50%/40%_40%_60%_60%] text-xl font-bold text-white shadow-lg transition-transform duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-90"
        :class="[b.n < next ? 'pointer-events-none scale-0 opacity-0' : '', wrong === b.n ? 'animate-pulse ring-4 ring-red-400' : '']"
        :style="{ left: b.x + '%', top: b.y + '%', backgroundColor: 'hsl(' + b.hue + ' 75% 58%)' }"
        :aria-label="'Ballon ' + b.n"
        @pointerdown.prevent="pop(b)"
      >
        {{ b.n }}
      </button>
    </div>
  </GameShell>
</template>
