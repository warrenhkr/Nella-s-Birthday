<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import GameButton from '../GameButton.vue'
import { dropLayer, oscillate, type Layer } from '../../../utils/games/stack'
import { readBest, submitBest } from '../../../utils/games/storage'

const VIEW_W = 300
const VIEW_H = 420
const BASE_Y = 380
const H = 22
const START_W = 120
const TARGET = 15
const COLORS = ['#f9a8d4', '#c4b5fd', '#fde68a', '#99f6e4', '#fda4af', '#a5b4fc']

const rules = [
  'Un étage de gâteau glisse de gauche à droite. Touche l’écran (ou la touche Espace) pour le poser.',
  'Ce qui dépasse de l’étage du dessous est coupé : l’étage suivant sera plus étroit.',
  'Un étage posé presque pile garde sa largeur, et trois « parfaits » d’affilée l’élargissent un peu.',
  'Atteins ' + TARGET + ' étages pour gagner. Si tu rates complètement, le gâteau s’effondre.'
]

interface Piece {
  x: number
  w: number
  y: number
  vy: number
  color: string
}

const phase = ref<GamePhase>('intro')
const layers = ref<Layer[]>([])
const movingX = ref(0)
const movingW = ref(START_W)
const pieces = ref<Piece[]>([])
const floors = ref(0)
const combo = ref(0)
const flash = ref('')
const best = ref<number | null>(null)
let raf = 0
let startedAt = 0
let lastT = 0

const stats = computed(() => [
  { label: 'Étages', value: floors.value + '/' + TARGET },
  { label: 'Parfaits', value: combo.value }
])
const speed = computed(() => Math.min(230, 95 + floors.value * 9))
const camera = computed(() => Math.max(0, (layers.value.length - 7) * H))
const topLayer = computed(() => layers.value[layers.value.length - 1] as Layer)
const colorOf = (i: number) => COLORS[i % COLORS.length]!

function start() {
  cancelAnimationFrame(raf)
  layers.value = [{ x: (VIEW_W - START_W) / 2, w: START_W }]
  floors.value = 0
  combo.value = 0
  pieces.value = []
  flash.value = ''
  movingW.value = START_W
  best.value = readBest('gateau')
  startedAt = performance.now()
  lastT = startedAt
  phase.value = 'playing'
  raf = requestAnimationFrame(tick)
}

function tick(now: number) {
  if (phase.value !== 'playing' && pieces.value.length === 0) return
  const dt = Math.min(0.05, (now - lastT) / 1000)
  lastT = now
  if (phase.value === 'playing') movingX.value = oscillate(now - startedAt, speed.value, movingW.value, VIEW_W)
  if (pieces.value.length > 0) {
    pieces.value = pieces.value
      .map(p => ({ ...p, y: p.y + p.vy * dt, vy: p.vy + 900 * dt }))
      .filter(p => p.y < BASE_Y + 400)
  }
  raf = requestAnimationFrame(tick)
}

function drop() {
  if (phase.value !== 'playing') return
  const result = dropLayer(topLayer.value, { x: movingX.value, w: movingW.value })
  const y = BASE_Y - layers.value.length * H
  if (!result) {
    pieces.value.push({ x: movingX.value, w: movingW.value, y, vy: 0, color: colorOf(layers.value.length) })
    finish(false)
    return
  }
  let layer = result.layer
  if (result.cut) pieces.value.push({ x: result.cut.x, w: result.cut.w, y, vy: 0, color: colorOf(layers.value.length) })
  if (result.perfect) {
    combo.value++
    flash.value = combo.value >= 2 ? 'Parfait ×' + combo.value + ' !' : 'Parfait !'
    if (combo.value >= 3 && layer.w < START_W) {
      const grow = Math.min(8, START_W - layer.w)
      layer = { x: Math.max(0, layer.x - grow / 2), w: layer.w + grow }
      if (layer.x + layer.w > VIEW_W) layer = { x: VIEW_W - layer.w, w: layer.w }
    }
  } else {
    combo.value = 0
    flash.value = ''
  }
  layers.value = [...layers.value, layer]
  movingW.value = layer.w
  floors.value = layers.value.length - 1
  if (floors.value >= TARGET) {
    finish(true)
    return
  }
  startedAt = performance.now() - 300
}

function finish(won: boolean) {
  submitBest('gateau', floors.value, 'max')
  best.value = readBest('gateau')
  phase.value = won ? 'won' : 'lost'
}

function onKey(e: KeyboardEvent) {
  if (phase.value !== 'playing') return
  if (e.code === 'Space' || e.code === 'Enter') {
    if (e.target instanceof HTMLElement && (e.target.tagName === 'BUTTON' || e.target.tagName === 'A')) return
    e.preventDefault()
    drop()
  }
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  cancelAnimationFrame(raf)
})

const resultText = computed(() =>
  phase.value === 'won'
    ? 'Un gâteau de ' + TARGET + ' étages, digne d’un grand pâtissier. Il ne manque que la bougie !'
    : 'Ton gâteau a ' + floors.value + ' étage(s) avant de s’effondrer.'
)
</script>

<template>
  <GameShell
    title="Gâteau à étages"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :best="best !== null ? best + ' étages' : null"
    :result-text="resultText"
    intro-text="Empile des étages de gâteau sans en perdre trop en route."
    @start="start"
    @restart="start"
  >
    <div
      class="mx-auto max-w-sm touch-none select-none overflow-hidden rounded-2xl border border-violet-300/20 bg-gradient-to-b from-indigo-950 to-violet-900"
      @pointerdown.prevent="drop"
    >
      <svg
        :viewBox="'0 0 ' + VIEW_W + ' ' + VIEW_H"
        class="block w-full"
        role="img"
        :aria-label="'Gâteau de ' + floors + ' étages'"
      >
        <rect
          :y="BASE_Y + H - 2"
          :width="VIEW_W"
          :height="VIEW_H"
          fill="#4c1d95"
        />
        <g :transform="'translate(0 ' + camera + ')'">
          <g
            v-for="(l, i) in layers"
            :key="i"
          >
            <rect
              :x="l.x"
              :y="BASE_Y - i * H"
              :width="l.w"
              :height="H - 1"
              rx="4"
              :fill="colorOf(i)"
            />
            <rect
              :x="l.x"
              :y="BASE_Y - i * H"
              :width="l.w"
              height="5"
              rx="3"
              fill="#ffffff"
              fill-opacity="0.7"
            />
          </g>
          <rect
            v-if="phase === 'playing'"
            :x="movingX"
            :y="BASE_Y - layers.length * H"
            :width="movingW"
            :height="H - 1"
            rx="4"
            :fill="colorOf(layers.length)"
          />
          <rect
            v-for="(p, i) in pieces"
            :key="'p' + i"
            :x="p.x"
            :y="p.y"
            :width="p.w"
            :height="H - 1"
            rx="4"
            :fill="p.color"
            fill-opacity="0.9"
          />
          <g
            v-if="phase === 'won'"
            :transform="'translate(' + (topLayer.x + topLayer.w / 2) + ' ' + (BASE_Y - (layers.length - 1) * H) + ')'"
          >
            <rect
              x="-2"
              y="-22"
              width="4"
              height="22"
              fill="#facc15"
            />
            <ellipse
              cx="0"
              cy="-27"
              rx="4"
              ry="7"
              fill="#fb923c"
            />
          </g>
        </g>
        <text
          v-if="flash"
          :x="VIEW_W / 2"
          y="48"
          text-anchor="middle"
          font-size="22"
          font-weight="700"
          fill="#fde68a"
        >{{ flash }}</text>
      </svg>
    </div>
    <div class="mt-3 flex justify-center">
      <GameButton
        :disabled="phase !== 'playing'"
        @click="drop"
      >
        ⬇ Poser l’étage
      </GameButton>
    </div>
  </GameShell>
</template>
