<script setup lang="ts">
import { computed, ref } from 'vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import GameButton from '../GameButton.vue'
import LevelPicker from '../LevelPicker.vue'
import BirthdayScene from '../BirthdayScene.vue'
import { isSolved, scrambleTiles, slide } from '../../../utils/games/slidepuzzle'
import { SCENE_H, SCENE_W } from '../../../utils/games/scene'
import { makeRng } from '../../../utils/games/rng'
import { readBest, submitBest } from '../../../utils/games/storage'
import { formatTime } from '../../../utils/games/format'
import { useStopwatch } from '../../../utils/games/useStopwatch'

const LEVELS = [
  { key: '3', label: 'Facile · 3×3' },
  { key: '4', label: 'Difficile · 4×4' },
]

const rules = [
  'Reconstitue l’image de la salle de fête en faisant glisser les morceaux.',
  'Touche un morceau situé dans la même ligne ou la même colonne que la case vide : il (et ceux qui sont entre) glissent vers elle.',
  'Le bouton « Aperçu » montre l’image complète. Moins tu fais de coups, mieux c’est.',
]

const levelKey = ref('3')
const n = computed(() => Number(levelKey.value))
const phase = ref<GamePhase>('intro')
const tiles = ref<number[]>([])
const moves = ref(0)
const preview = ref(false)
const numbers = ref(false)
const best = ref<number | null>(null)
const { elapsed, start: startClock, stop: stopClock } = useStopwatch()

const stats = computed(() => [
  { label: 'Coups', value: moves.value },
  { label: 'Temps', value: formatTime(elapsed.value) },
])

function viewBoxOf(v: number): string {
  const idx = v - 1
  const col = idx % n.value
  const row = Math.floor(idx / n.value)
  const w = SCENE_W / n.value
  const h = SCENE_H / n.value
  return col * w + ' ' + row * h + ' ' + w + ' ' + h
}

function start() {
  tiles.value = scrambleTiles(n.value, n.value * n.value * 14, makeRng())
  moves.value = 0
  preview.value = false
  best.value = readBest('taquin-' + levelKey.value)
  phase.value = 'playing'
  startClock()
}

function tap(i: number) {
  if (phase.value !== 'playing') return
  const result = slide(tiles.value, n.value, i)
  if (!result) return
  tiles.value = result.tiles
  moves.value++
  if (isSolved(tiles.value)) {
    stopClock()
    submitBest('taquin-' + levelKey.value, moves.value, 'min')
    best.value = readBest('taquin-' + levelKey.value)
    phase.value = 'won'
  }
}

function replayWith(key: string) {
  levelKey.value = key
  start()
}

const resultText = computed(() => 'Image reconstituée en ' + moves.value + ' coups et ' + formatTime(elapsed.value) + '.')
</script>

<template>
  <GameShell
    title="Taquin illustré"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :best="best !== null ? best + ' coups' : null"
    :result-text="resultText"
    intro-text="Le puzzle coulissant, avec une scène de fête dessinée pour le site."
    @start="start"
    @restart="start"
  >
    <template #intro-extra>
      <LevelPicker :options="LEVELS" :model-value="levelKey" @update:model-value="levelKey = $event" />
    </template>
    <template #end-extra>
      <LevelPicker :options="LEVELS" :model-value="levelKey" @update:model-value="replayWith" />
    </template>
    <div class="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-2xl border border-violet-300/20 bg-violet-950 p-1">
      <div class="grid h-full w-full gap-0.5" :style="{ gridTemplateColumns: 'repeat(' + n + ', minmax(0, 1fr))', gridTemplateRows: 'repeat(' + n + ', minmax(0, 1fr))' }">
        <button
          v-for="(v, i) in tiles"
          :key="i"
          type="button"
          class="relative overflow-hidden rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300"
          :class="v === 0 ? 'cursor-default bg-violet-900/40' : 'active:brightness-90'"
          :disabled="v === 0"
          :aria-label="v === 0 ? 'Case vide' : 'Morceau ' + v"
          @click="tap(i)"
        >
          <template v-if="v !== 0">
            <BirthdayScene :view-box="viewBoxOf(v)" />
            <span v-if="numbers" class="absolute left-1 top-1 rounded bg-violet-950/80 px-1.5 text-xs font-bold text-white">{{ v }}</span>
          </template>
        </button>
      </div>
      <div v-if="preview" class="absolute inset-1 z-10 overflow-hidden rounded-md">
        <BirthdayScene />
      </div>
    </div>
    <div class="mt-3 flex justify-center gap-2">
      <GameButton variant="ghost" small @click="preview = !preview">{{ preview ? '🙈 Masquer' : '👁 Aperçu' }}</GameButton>
      <GameButton variant="ghost" small @click="numbers = !numbers">{{ numbers ? 'Cacher les numéros' : '# Numéros' }}</GameButton>
    </div>
  </GameShell>
</template>
