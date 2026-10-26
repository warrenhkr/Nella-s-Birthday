<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import { newSnake, step, type Dir, type SnakeState } from '../../../utils/games/snake'
import { makeRng, type Rng } from '../../../utils/games/rng'
import { readBest, submitBest } from '../../../utils/games/storage'

const SIZE = 15
const TARGET = 20

const rules = [
  'Dirige le serpent pour qu’il mange les cupcakes 🧁 : il grandit à chaque fois.',
  'Sur mobile : glisse le doigt sur le plateau ou utilise les flèches. Sur ordinateur : flèches du clavier ou ZQSD / WASD.',
  'Ne touche ni les bords, ni ton propre corps. Le serpent accélère au fil du jeu.',
  'Mange ' + TARGET + ' cupcakes pour gagner.'
]

const phase = ref<GamePhase>('intro')
const state = ref<SnakeState>(newSnake(SIZE, makeRng(1)))
const best = ref<number | null>(null)
let rng: Rng = makeRng()
let pending: Dir = 'right'
let timer: ReturnType<typeof setTimeout> | null = null
let swipe: { x: number, y: number } | null = null

const stats = computed(() => [{ label: 'Cupcakes', value: state.value.score + '/' + TARGET }, { label: 'Longueur', value: state.value.snake.length }])
const cells = computed(() => {
  const map = new Map<number, 'head' | 'body'>()
  state.value.snake.forEach((p, i) => map.set(p.y * SIZE + p.x, i === 0 ? 'head' : 'body'))
  return map
})
const foodIndex = computed(() => state.value.food.y * SIZE + state.value.food.x)
const delay = computed(() => Math.max(85, 170 - state.value.score * 4))

function schedule() {
  if (timer) clearTimeout(timer)
  timer = setTimeout(tick, delay.value)
}

function tick() {
  if (phase.value !== 'playing') return
  state.value = step(state.value, pending, rng)
  if (state.value.dead) return finish(false)
  if (state.value.score >= TARGET) return finish(true)
  schedule()
}

function finish(won: boolean) {
  if (timer) clearTimeout(timer)
  submitBest('serpent', state.value.score, 'max')
  best.value = readBest('serpent')
  phase.value = won ? 'won' : 'lost'
}

function start() {
  if (timer) clearTimeout(timer)
  rng = makeRng()
  state.value = newSnake(SIZE, rng)
  pending = 'right'
  best.value = readBest('serpent')
  phase.value = 'playing'
  schedule()
}

function turn(d: Dir) {
  if (phase.value === 'playing') pending = d
}

const KEYS: Record<string, Dir> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right', KeyZ: 'up', KeyQ: 'left'
}
function onKey(e: KeyboardEvent) {
  const d = KEYS[e.code]
  if (!d || phase.value !== 'playing') return
  e.preventDefault()
  turn(d)
}

function swipeDown(e: PointerEvent) {
  swipe = { x: e.clientX, y: e.clientY }
}
function swipeMove(e: PointerEvent) {
  if (!swipe) return
  const dx = e.clientX - swipe.x
  const dy = e.clientY - swipe.y
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return
  turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up')
  swipe = { x: e.clientX, y: e.clientY }
}
function swipeEnd() {
  swipe = null
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  if (timer) clearTimeout(timer)
})

const resultText = computed(() =>
  phase.value === 'won' ? 'Les ' + TARGET + ' cupcakes sont engloutis, quel appétit !' : 'Le serpent s’arrête après ' + state.value.score + ' cupcake(s).'
)
</script>

<template>
  <GameShell
    title="Serpent gourmand"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :best="best !== null ? best + ' cupcakes' : null"
    :result-text="resultText"
    intro-text="Le snake des téléphones d’antan, avec des cupcakes."
    @start="start"
    @restart="start"
  >
    <div
      class="mx-auto grid aspect-square w-full max-w-sm touch-none select-none gap-px overflow-hidden rounded-2xl border border-violet-300/30 bg-violet-950 p-px"
      :style="{ gridTemplateColumns: 'repeat(' + SIZE + ', minmax(0, 1fr))' }"
      role="img"
      :aria-label="'Plateau du serpent, ' + state.score + ' cupcakes mangés'"
      @pointerdown="swipeDown"
      @pointermove="swipeMove"
      @pointerup="swipeEnd"
      @pointercancel="swipeEnd"
    >
      <div
        v-for="i in SIZE * SIZE"
        :key="i"
        class="flex items-center justify-center text-[0.55rem] leading-none sm:text-xs"
        :class="cells.get(i - 1) === 'head' ? 'rounded-md bg-pink-300' : cells.get(i - 1) === 'body' ? 'rounded-sm bg-violet-400' : 'bg-violet-900/40'"
      >
        <span
          v-if="foodIndex === i - 1"
          aria-hidden="true"
        >🧁</span>
      </div>
    </div>
    <div
      class="mx-auto mt-4 grid w-44 grid-cols-3 gap-2"
      role="group"
      aria-label="Flèches de direction"
    >
      <span />
      <button
        type="button"
        class="min-h-12 rounded-xl border border-violet-300/30 bg-violet-900/40 text-xl active:bg-violet-700"
        aria-label="Haut"
        @pointerdown.prevent="turn('up')"
      >
        ▲
      </button>
      <span />
      <button
        type="button"
        class="min-h-12 rounded-xl border border-violet-300/30 bg-violet-900/40 text-xl active:bg-violet-700"
        aria-label="Gauche"
        @pointerdown.prevent="turn('left')"
      >
        ◀
      </button>
      <button
        type="button"
        class="min-h-12 rounded-xl border border-violet-300/30 bg-violet-900/40 text-xl active:bg-violet-700"
        aria-label="Bas"
        @pointerdown.prevent="turn('down')"
      >
        ▼
      </button>
      <button
        type="button"
        class="min-h-12 rounded-xl border border-violet-300/30 bg-violet-900/40 text-xl active:bg-violet-700"
        aria-label="Droite"
        @pointerdown.prevent="turn('right')"
      >
        ▶
      </button>
    </div>
  </GameShell>
</template>
