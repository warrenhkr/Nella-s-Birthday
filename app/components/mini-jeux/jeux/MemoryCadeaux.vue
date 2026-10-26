<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import LevelPicker from '../LevelPicker.vue'
import GiftIcon from '../GiftIcon.vue'
import { buildDeck, MEMORY_LEVELS } from '../../../utils/games/memory'
import { makeRng, sleep } from '../../../utils/games/rng'
import { readBest, submitBest } from '../../../utils/games/storage'
import { formatTime } from '../../../utils/games/format'
import { useStopwatch } from '../../../utils/games/useStopwatch'

const rules = [
  'Retourne deux cartes à la fois pour retrouver les paires de cadeaux identiques.',
  'Si les deux cadeaux sont différents, ils se recachent : retiens leur place !',
  'Tu gagnes quand toutes les paires sont trouvées. Moins tu fais de coups, meilleur est ton score.'
]

const levelKey = ref('moyen')
const level = computed(() => MEMORY_LEVELS.find(l => l.key === levelKey.value) ?? MEMORY_LEVELS[1]!)
const phase = ref<GamePhase>('intro')
const deck = ref<number[]>([])
const flipped = ref<number[]>([])
const matched = ref<boolean[]>([])
const moves = ref(0)
const locked = ref(false)
const best = ref<number | null>(null)
const record = ref(false)
const { elapsed, start: startClock, stop: stopClock } = useStopwatch()
let token = 0

const pairs = computed(() => (level.value.cols * level.value.rows) / 2)
const foundPairs = computed(() => matched.value.filter(Boolean).length / 2)
const stats = computed(() => [
  { label: 'Coups', value: moves.value },
  { label: 'Paires', value: foundPairs.value + '/' + pairs.value },
  { label: 'Temps', value: formatTime(elapsed.value) }
])

function start() {
  token++
  deck.value = buildDeck(pairs.value, makeRng())
  flipped.value = []
  matched.value = new Array(deck.value.length).fill(false)
  moves.value = 0
  locked.value = false
  record.value = false
  best.value = readBest('memory-' + levelKey.value)
  phase.value = 'playing'
  startClock()
}

async function flip(i: number) {
  if (phase.value !== 'playing' || locked.value || matched.value[i] || flipped.value.includes(i)) return
  flipped.value = [...flipped.value, i]
  if (flipped.value.length < 2) return
  moves.value++
  const [a, b] = flipped.value as [number, number]
  if (deck.value[a] === deck.value[b]) {
    matched.value = matched.value.map((m, k) => m || k === a || k === b)
    flipped.value = []
    if (matched.value.every(Boolean)) {
      stopClock()
      record.value = submitBest('memory-' + levelKey.value, moves.value, 'min')
      best.value = readBest('memory-' + levelKey.value)
      phase.value = 'won'
    }
    return
  }
  locked.value = true
  const myToken = token
  await sleep(850)
  if (myToken !== token) return
  flipped.value = []
  locked.value = false
}

function changeLevel(key: string) {
  levelKey.value = key
}
function replayWith(key: string) {
  levelKey.value = key
  start()
}

onBeforeUnmount(() => {
  token++
})

const resultText = computed(
  () => 'Toutes les paires en ' + moves.value + ' coups et ' + formatTime(elapsed.value) + '.' + (record.value ? ' Nouveau record !' : '')
)
</script>

<template>
  <GameShell
    title="Memory des cadeaux"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :best="best !== null ? best + ' coups' : null"
    :result-text="resultText"
    intro-text="Retrouve les paires de cadeaux emballés."
    @start="start"
    @restart="start"
  >
    <template #intro-extra>
      <LevelPicker
        :options="MEMORY_LEVELS"
        :model-value="levelKey"
        @update:model-value="changeLevel"
      />
    </template>
    <template #end-extra>
      <LevelPicker
        :options="MEMORY_LEVELS"
        :model-value="levelKey"
        @update:model-value="replayWith"
      />
    </template>
    <div
      class="mx-auto grid max-w-md gap-2 sm:gap-3"
      :style="{ gridTemplateColumns: 'repeat(' + level.cols + ', minmax(0, 1fr))' }"
    >
      <button
        v-for="(id, i) in deck"
        :key="i"
        type="button"
        class="aspect-square rounded-xl border p-1.5 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 active:scale-95 sm:p-2"
        :class="
          matched[i]
            ? 'border-emerald-300/60 bg-emerald-400/20'
            : flipped.includes(i)
              ? 'border-pink-300 bg-violet-100'
              : 'border-violet-300/30 bg-gradient-to-br from-violet-700 to-violet-900'
        "
        :aria-label="matched[i] || flipped.includes(i) ? 'Cadeau ' + (id + 1) : 'Carte cachée ' + (i + 1)"
        :aria-pressed="flipped.includes(i)"
        @click="flip(i)"
      >
        <GiftIcon
          v-if="matched[i] || flipped.includes(i)"
          :variant="id"
        />
        <span
          v-else
          class="text-2xl text-violet-300/60"
          aria-hidden="true"
        >✦</span>
      </button>
    </div>
  </GameShell>
</template>
