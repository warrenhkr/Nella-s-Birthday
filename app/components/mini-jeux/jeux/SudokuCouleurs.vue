<script setup lang="ts">
import { computed, ref } from 'vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import GameButton from '../GameButton.vue'
import LevelPicker from '../LevelPicker.vue'
import { conflicts, isComplete, makePuzzle, type Board } from '../../../utils/games/sudoku4'
import { makeRng } from '../../../utils/games/rng'
import { readBest, submitBest } from '../../../utils/games/storage'
import { formatTime } from '../../../utils/games/format'
import { useStopwatch } from '../../../utils/games/useStopwatch'

const LEVELS = [
  { key: '6', label: 'Facile', holes: 6 },
  { key: '8', label: 'Moyen', holes: 8 },
  { key: '10', label: 'Difficile', holes: 10 }
]
const COLORS = [
  { name: 'rouge', cls: 'bg-rose-500', glyph: '●' },
  { name: 'jaune', cls: 'bg-amber-400 text-violet-950', glyph: '▲' },
  { name: 'vert', cls: 'bg-teal-400 text-violet-950', glyph: '■' },
  { name: 'violet', cls: 'bg-violet-500', glyph: '★' }
]

const rules = [
  'Remplis la grille de 4×4 avec 4 couleurs.',
  'Chaque couleur doit apparaître une seule fois par ligne, par colonne et dans chacun des quatre blocs de 2×2.',
  'Touche une case vide, puis choisis une couleur dans la palette. Les cases en conflit s’entourent de rouge.',
  'Chaque couleur a aussi un symbole (● ▲ ■ ★) pour mieux les distinguer.'
]

const levelKey = ref('6')
const phase = ref<GamePhase>('intro')
const given = ref<Board>([])
const board = ref<Board>([])
const solution = ref<Board>([])
const selected = ref<number | null>(null)
const hints = ref(0)
const best = ref<number | null>(null)
const finalMs = ref(0)
const { elapsed, start: startClock, stop: stopClock } = useStopwatch()

const bad = computed(() => conflicts(board.value))
const empty = computed(() => board.value.filter(v => v === 0).length)
const stats = computed(() => [
  { label: 'Cases vides', value: empty.value },
  { label: 'Indices', value: hints.value },
  { label: 'Temps', value: formatTime(elapsed.value) }
])

function start() {
  const holes = LEVELS.find(l => l.key === levelKey.value)?.holes ?? 6
  const { puzzle, solution: sol } = makePuzzle(makeRng(), holes)
  given.value = puzzle.slice()
  board.value = puzzle.slice()
  solution.value = sol
  selected.value = null
  hints.value = 0
  best.value = readBest('sudoku-' + levelKey.value)
  phase.value = 'playing'
  startClock()
}

function check() {
  if (isComplete(board.value)) {
    finalMs.value = stopClock()
    submitBest('sudoku-' + levelKey.value, Math.round(finalMs.value), 'min')
    best.value = readBest('sudoku-' + levelKey.value)
    phase.value = 'won'
  }
}

function place(value: number) {
  const i = selected.value
  if (phase.value !== 'playing' || i === null || given.value[i] !== 0) return
  const next = board.value.slice()
  next[i] = value
  board.value = next
  check()
}

function hint() {
  if (phase.value !== 'playing') return
  const sel = selected.value
  const selectedIsWrong = sel !== null && given.value[sel] === 0 && board.value[sel] !== solution.value[sel]
  const target = selectedIsWrong ? sel : board.value.findIndex((v, i) => v !== solution.value[i])
  if (target < 0) return
  hints.value++
  const next = board.value.slice()
  next[target] = solution.value[target]!
  board.value = next
  selected.value = target
  check()
}

function replayWith(key: string) {
  levelKey.value = key
  start()
}

const resultText = computed(() => 'Grille complétée en ' + formatTime(finalMs.value) + (hints.value ? ' avec ' + hints.value + ' indice(s)' : ' sans aucun indice') + '.')
</script>

<template>
  <GameShell
    title="Sudoku en couleurs"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :best="best !== null ? formatTime(best) : null"
    :result-text="resultText"
    intro-text="Le sudoku, version miniature et colorée, pour réfléchir sans se prendre la tête."
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
    <div class="mx-auto max-w-xs">
      <div class="grid grid-cols-4 gap-1.5 rounded-2xl border border-violet-300/20 bg-violet-950/70 p-2">
        <button
          v-for="(v, i) in board"
          :key="i"
          type="button"
          class="flex aspect-square items-center justify-center rounded-lg text-2xl font-bold text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300"
          :class="[
            v === 0 ? 'bg-violet-900/60' : COLORS[v - 1]!.cls,
            given[i] !== 0 ? 'ring-2 ring-white/50' : '',
            selected === i ? 'outline outline-4 outline-pink-300' : '',
            bad.has(i) ? 'ring-4 ring-red-500' : '',
            Math.floor(i / 4) === 1 ? 'mb-1.5' : '',
            i % 4 === 1 ? 'mr-1.5' : ''
          ]"
          :aria-label="'Ligne ' + (Math.floor(i / 4) + 1) + ' colonne ' + ((i % 4) + 1) + (v ? ', ' + COLORS[v - 1]!.name : ', vide')"
          @click="selected = i"
        >
          <span aria-hidden="true">{{ v ? COLORS[v - 1]!.glyph : '' }}</span>
        </button>
      </div>
      <div
        class="mt-4 flex justify-center gap-2"
        role="group"
        aria-label="Palette de couleurs"
      >
        <button
          v-for="(c, k) in COLORS"
          :key="c.name"
          type="button"
          class="flex h-14 w-14 items-center justify-center rounded-xl text-2xl font-bold text-white shadow active:scale-90"
          :class="c.cls"
          :aria-label="'Placer ' + c.name"
          :disabled="selected === null"
          @click="place(k + 1)"
        >
          {{ c.glyph }}
        </button>
        <button
          type="button"
          class="flex h-14 w-14 items-center justify-center rounded-xl border border-violet-300/40 bg-violet-900/50 text-xl text-violet-100 active:scale-90"
          aria-label="Effacer la case"
          :disabled="selected === null"
          @click="place(0)"
        >
          ⌫
        </button>
      </div>
      <div class="mt-3 flex justify-center">
        <GameButton
          variant="ghost"
          small
          @click="hint"
        >
          💡 Indice
        </GameButton>
      </div>
    </div>
  </GameShell>
</template>
