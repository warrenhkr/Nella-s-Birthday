<script setup lang="ts">
import { computed, ref } from 'vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import LevelPicker from '../LevelPicker.vue'
import { generateWordSearch, lineCells, matchSelection, type WordSearch } from '../../../utils/games/wordsearch'
import { makeRng, shuffle } from '../../../utils/games/rng'
import { readBest, submitBest } from '../../../utils/games/storage'
import { formatTime } from '../../../utils/games/format'
import { useStopwatch } from '../../../utils/games/useStopwatch'

const POOL = [
  'GATEAU', 'BOUGIE', 'CADEAU', 'BALLON', 'MUSIQUE', 'DANSE', 'FETE', 'SURPRISE', 'CONFETTI', 'CHANSON',
  'CLAVIER', 'SOURIS', 'PIXEL', 'CODE', 'SERVEUR', 'RESEAU', 'ECRAN', 'ROBOT', 'CRYPTO', 'PIRATE', 'BINAIRE', 'LOGICIEL', 'MOTDEPASSE',
]
const LEVELS = [
  { key: 'facile', label: 'Facile · 8×8', size: 8, words: 5, hard: false },
  { key: 'moyen', label: 'Moyen · 10×10', size: 10, words: 7, hard: false },
  { key: 'difficile', label: 'Difficile · 12×12 (diagonales, à l’envers)', size: 12, words: 9, hard: true },
]

const rules = [
  'Retrouve tous les mots de la liste cachés dans la grille.',
  'Les mots vont de gauche à droite et de haut en bas ; au niveau difficile, aussi en diagonale et à l’envers.',
  'Glisse ton doigt (ou la souris) d’une lettre à l’autre. Tu peux aussi toucher la première lettre, puis la dernière.',
]

const levelKey = ref('facile')
const level = computed(() => LEVELS.find((l) => l.key === levelKey.value) ?? LEVELS[0]!)
const phase = ref<GamePhase>('intro')
const ws = ref<WordSearch | null>(null)
const found = ref<Set<string>>(new Set())
const foundCells = ref<Set<string>>(new Set())
const dragStart = ref<[number, number] | null>(null)
const dragEnd = ref<[number, number] | null>(null)
const anchor = ref<[number, number] | null>(null)
const shake = ref(false)
const best = ref<number | null>(null)
const finalMs = ref(0)
const { elapsed, start: startClock, stop: stopClock } = useStopwatch()

const words = computed(() => (ws.value ? ws.value.placements.map((p) => p.word).sort() : []))
const selected = computed<Set<string>>(() => {
  const s = new Set<string>()
  if (dragStart.value && dragEnd.value) {
    const cells = lineCells(dragStart.value, dragEnd.value)
    if (cells) cells.forEach(([r, c]) => s.add(r + ',' + c))
    else s.add(dragStart.value[0] + ',' + dragStart.value[1])
  } else if (anchor.value) s.add(anchor.value[0] + ',' + anchor.value[1])
  return s
})
const stats = computed(() => [
  { label: 'Trouvés', value: found.value.size + '/' + words.value.length },
  { label: 'Temps', value: formatTime(elapsed.value) },
])

function start() {
  const rng = makeRng()
  const lvl = level.value
  const candidates = POOL.filter((w) => w.length <= lvl.size)
  let grid: WordSearch | null = null
  for (let attempt = 0; attempt < 30 && !grid; attempt++) {
    grid = generateWordSearch(lvl.size, shuffle(candidates, rng).slice(0, lvl.words), rng, lvl.hard)
  }
  ws.value = grid
  found.value = new Set()
  foundCells.value = new Set()
  dragStart.value = dragEnd.value = anchor.value = null
  best.value = readBest('mots-' + levelKey.value)
  phase.value = 'playing'
  startClock()
}

function cellAt(e: PointerEvent): [number, number] | null {
  const el = document.elementFromPoint(e.clientX, e.clientY)
  const cell = el instanceof HTMLElement ? el.closest<HTMLElement>('[data-r]') : null
  if (!cell) return null
  return [Number(cell.dataset.r), Number(cell.dataset.c)]
}

function attempt(a: [number, number], b: [number, number]) {
  if (!ws.value) return
  const cells = lineCells(a, b)
  const word = cells ? matchSelection(ws.value, cells, found.value) : null
  if (!word || !cells) {
    shake.value = true
    setTimeout(() => (shake.value = false), 250)
    return
  }
  found.value = new Set([...found.value, word])
  const next = new Set(foundCells.value)
  cells.forEach(([r, c]) => next.add(r + ',' + c))
  foundCells.value = next
  if (found.value.size === ws.value.placements.length) {
    finalMs.value = stopClock()
    submitBest('mots-' + levelKey.value, Math.round(finalMs.value), 'min')
    best.value = readBest('mots-' + levelKey.value)
    phase.value = 'won'
  }
}

function down(e: PointerEvent) {
  if (phase.value !== 'playing') return
  const cell = cellAt(e)
  if (!cell) return
  dragStart.value = cell
  dragEnd.value = cell
}
function move(e: PointerEvent) {
  if (!dragStart.value) return
  const cell = cellAt(e)
  if (cell) dragEnd.value = cell
}
function up(e: PointerEvent) {
  const start = dragStart.value
  if (!start) return
  const end = cellAt(e) ?? dragEnd.value ?? start
  dragStart.value = dragEnd.value = null
  if (start[0] === end[0] && start[1] === end[1]) {
    if (anchor.value) {
      const a = anchor.value
      anchor.value = null
      attempt(a, end)
    } else anchor.value = end
  } else {
    anchor.value = null
    attempt(start, end)
  }
}
function cancel() {
  dragStart.value = dragEnd.value = null
}

function replayWith(key: string) {
  levelKey.value = key
  start()
}

const resultText = computed(() => 'Tous les mots trouvés en ' + formatTime(finalMs.value) + '.')
</script>

<template>
  <GameShell
    title="Mots mêlés de la fête"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :best="best !== null ? formatTime(best) : null"
    :result-text="resultText"
    intro-text="Des mots de fête, de musique et d’informatique sont cachés dans la grille."
    @start="start"
    @restart="start"
  >
    <template #intro-extra>
      <LevelPicker :options="LEVELS" :model-value="levelKey" @update:model-value="levelKey = $event" />
    </template>
    <template #end-extra>
      <LevelPicker :options="LEVELS" :model-value="levelKey" @update:model-value="replayWith" />
    </template>
    <div v-if="ws" class="mx-auto max-w-md">
      <div
        class="touch-none select-none rounded-2xl border border-violet-300/20 bg-violet-950/70 p-1.5 sm:p-2"
        :class="shake ? 'animate-pulse' : ''"
        @pointerdown.prevent="down"
        @pointermove="move"
        @pointerup="up"
        @pointercancel="cancel"
      >
        <div class="grid gap-px" :style="{ gridTemplateColumns: 'repeat(' + ws.size + ', minmax(0, 1fr))' }">
          <template v-for="(row, r) in ws.grid" :key="r">
            <div
              v-for="(ch, c) in row"
              :key="c"
              :data-r="r"
              :data-c="c"
              class="flex aspect-square items-center justify-center rounded text-sm font-bold uppercase sm:text-base"
              :class="
                selected.has(r + ',' + c)
                  ? 'bg-pink-400 text-white'
                  : foundCells.has(r + ',' + c)
                    ? 'bg-emerald-400/40 text-emerald-50'
                    : 'bg-violet-900/50 text-violet-100'
              "
            >
              {{ ch }}
            </div>
          </template>
        </div>
      </div>
      <ul class="mt-3 flex flex-wrap justify-center gap-2" aria-label="Mots à trouver">
        <li
          v-for="w in words"
          :key="w"
          class="rounded-full border px-3 py-1 text-xs font-semibold tracking-wide"
          :class="found.has(w) ? 'border-emerald-300/50 bg-emerald-400/20 text-emerald-100 line-through' : 'border-violet-300/30 text-violet-100'"
        >
          {{ w }}
        </li>
      </ul>
    </div>
    <p v-else class="text-center text-violet-200">Impossible de créer la grille, relance une partie.</p>
  </GameShell>
</template>
