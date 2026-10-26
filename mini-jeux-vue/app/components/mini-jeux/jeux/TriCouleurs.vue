<script setup lang="ts">
import { computed, ref } from 'vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import GameButton from '../GameButton.vue'
import LevelPicker from '../LevelPicker.vue'
import { CAPACITY, generate, isWon, pour, solve, type Tubes } from '../../../utils/games/ballsort'
import { makeRng } from '../../../utils/games/rng'
import { readBest, submitBest } from '../../../utils/games/storage'

const LEVELS = [
  { key: '4', label: 'Facile · 4 couleurs' },
  { key: '5', label: 'Moyen · 5 couleurs' },
  { key: '6', label: 'Difficile · 6 couleurs' },
]
const BALLS = [
  { color: '#ef4444', glyph: '●' },
  { color: '#facc15', glyph: '▲' },
  { color: '#22c55e', glyph: '■' },
  { color: '#38bdf8', glyph: '★' },
  { color: '#a855f7', glyph: '◆' },
  { color: '#fb923c', glyph: '♥' },
]

const rules = [
  'Chaque tube contient des billes de couleurs mélangées. Le but : un tube = une seule couleur.',
  'Touche un tube pour le choisir, puis un autre tube pour y verser la bille du dessus.',
  'On ne peut verser que sur une bille de la même couleur, ou dans un tube vide, et s’il reste de la place (4 billes maximum).',
  'Tu peux annuler un coup à tout moment. Le bouton « Indice » te montre un bon coup.',
]

const levelKey = ref('4')
const phase = ref<GamePhase>('intro')
const tubes = ref<Tubes>([])
const history = ref<Tubes[]>([])
const source = ref<number | null>(null)
const moves = ref(0)
const hintMove = ref<[number, number] | null>(null)
let plan: { path: [number, number][]; states: string[] } | null = null
const message = ref('')
const best = ref<number | null>(null)

const stats = computed(() => [{ label: 'Coups', value: moves.value }, { label: 'Annulations', value: history.value.length }])

const stateKey = (t: Tubes) => t.map((x) => x.join('')).join('|')

/** Mémorise un plan complet : les indices suivent ce plan tant que le joueur reste dessus (ou y revient). */
function makePlan(from: Tubes, path: [number, number][]) {
  const states = [stateKey(from)]
  let cur = from
  for (const [a, b] of path) {
    cur = pour(cur, a, b) ?? cur
    states.push(stateKey(cur))
  }
  plan = { path, states }
}

function start() {
  plan = null
  const { tubes: t, solution } = generate(Number(levelKey.value), makeRng())
  makePlan(t, solution)
  tubes.value = t
  history.value = []
  source.value = null
  moves.value = 0
  hintMove.value = null
  message.value = ''
  best.value = readBest('tri-' + levelKey.value)
  phase.value = 'playing'
}

function tap(i: number) {
  if (phase.value !== 'playing') return
  hintMove.value = null
  message.value = ''
  if (source.value === null) {
    if (tubes.value[i]!.length > 0) source.value = i
    return
  }
  if (source.value === i) {
    source.value = null
    return
  }
  const next = pour(tubes.value, source.value, i)
  if (!next) {
    message.value = 'Ce versement n’est pas possible.'
    source.value = tubes.value[i]!.length > 0 ? i : null
    return
  }
  history.value = [...history.value, tubes.value]
  tubes.value = next
  moves.value++
  source.value = null
  if (isWon(next)) {
    submitBest('tri-' + levelKey.value, moves.value, 'min')
    best.value = readBest('tri-' + levelKey.value)
    phase.value = 'won'
  }
}

function undo() {
  if (phase.value !== 'playing' || history.value.length === 0) return
  tubes.value = history.value[history.value.length - 1]!
  history.value = history.value.slice(0, -1)
  source.value = null
  hintMove.value = null
}

function hint() {
  if (phase.value !== 'playing') return
  const key = stateKey(tubes.value)
  let step = plan ? plan.states.indexOf(key) : -1
  if (!plan || step < 0 || step >= plan.path.length) {
    const path = solve(tubes.value, 30000)
    if (!path || path.length === 0) {
      message.value = 'Pas d’indice trouvé : essaie d’annuler quelques coups.'
      return
    }
    makePlan(tubes.value, path)
    step = 0
  }
  const move = plan!.path[step]!
  hintMove.value = move
  message.value = 'Verse le tube ' + (move[0] + 1) + ' dans le tube ' + (move[1] + 1) + '.'
}

function replayWith(key: string) {
  levelKey.value = key
  start()
}

const resultText = computed(() => 'Tous les tubes sont triés en ' + moves.value + ' coups.')
</script>

<template>
  <GameShell
    title="Tri des couleurs"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :best="best !== null ? best + ' coups' : null"
    :result-text="resultText"
    intro-text="Verse, trie, range : un casse-tête relaxant."
    @start="start"
    @restart="start"
  >
    <template #intro-extra>
      <LevelPicker :options="LEVELS" :model-value="levelKey" @update:model-value="levelKey = $event" />
    </template>
    <template #end-extra>
      <LevelPicker :options="LEVELS" :model-value="levelKey" @update:model-value="replayWith" />
    </template>
    <div class="mx-auto flex max-w-md flex-wrap justify-center gap-3">
      <button
        v-for="(t, i) in tubes"
        :key="i"
        type="button"
        class="flex h-36 w-12 touch-manipulation flex-col-reverse items-center justify-start gap-1 rounded-b-2xl rounded-t-md border-2 bg-violet-950/70 p-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 sm:w-14"
        :class="[
          source === i ? '-translate-y-2 border-pink-300' : 'border-violet-300/40',
          hintMove && (hintMove[0] === i || hintMove[1] === i) ? 'ring-4 ring-emerald-300' : '',
        ]"
        :aria-label="'Tube ' + (i + 1) + ', ' + t.length + ' bille(s)'"
        @click="tap(i)"
      >
        <span
          v-for="(b, k) in t"
          :key="k"
          class="flex h-7 w-full items-center justify-center rounded-full text-sm font-bold text-black/60"
          :style="{ backgroundColor: BALLS[b]!.color }"
          aria-hidden="true"
        >
          {{ BALLS[b]!.glyph }}
        </span>
        <span v-if="t.length === 0" class="sr-only">vide</span>
      </button>
    </div>
    <p class="mt-3 min-h-5 text-center text-sm text-amber-200" aria-live="polite">{{ message }}</p>
    <p class="text-center text-xs text-violet-300">Capacité d’un tube : {{ CAPACITY }} billes</p>
    <div class="mt-3 flex justify-center gap-2">
      <GameButton variant="ghost" small :disabled="history.length === 0" @click="undo">↶ Annuler</GameButton>
      <GameButton variant="ghost" small @click="hint">💡 Indice</GameButton>
    </div>
  </GameShell>
</template>
