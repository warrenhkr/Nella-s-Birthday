<script setup lang="ts">
import { computed, ref } from 'vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import GameButton from '../GameButton.vue'
import LevelPicker from '../LevelPicker.vue'
import { press, scramble, solve } from '../../../utils/games/lightsout'
import { makeRng } from '../../../utils/games/rng'
import { readBest, submitBest } from '../../../utils/games/storage'

const LEVELS = [
  { key: '3', label: 'Petit · 3×3' },
  { key: '4', label: 'Moyen · 4×4' },
  { key: '5', label: 'Grand · 5×5' },
]

const rules = [
  'Chaque bougie est allumée ou éteinte. Le but : allumer toutes les bougies du gâteau.',
  'Quand tu touches une bougie, elle change d’état, ainsi que ses quatre voisines (haut, bas, gauche, droite).',
  'Réfléchis bien : un seul appui peut tout défaire. Le bouton « Indice » te montre un bon coup, mais il est compté.',
]

const levelKey = ref('3')
const n = computed(() => Number(levelKey.value))
const phase = ref<GamePhase>('intro')
const lit = ref<boolean[]>([])
const moves = ref(0)
const hints = ref(0)
const hintCell = ref<number | null>(null)
const best = ref<number | null>(null)

const stats = computed(() => [
  { label: 'Coups', value: moves.value },
  { label: 'Indices', value: hints.value },
  { label: 'Allumées', value: lit.value.filter(Boolean).length + '/' + lit.value.length },
])

function start() {
  lit.value = scramble(n.value, n.value * n.value + 4, makeRng())
  moves.value = 0
  hints.value = 0
  hintCell.value = null
  best.value = readBest('lights-' + levelKey.value)
  phase.value = 'playing'
}

function tap(i: number) {
  if (phase.value !== 'playing') return
  lit.value = press(lit.value, n.value, i)
  moves.value++
  hintCell.value = null
  if (lit.value.every(Boolean)) {
    submitBest('lights-' + levelKey.value, moves.value, 'min')
    best.value = readBest('lights-' + levelKey.value)
    phase.value = 'won'
  }
}

function hint() {
  const s = solve(lit.value, n.value)
  if (!s || s.length === 0) return
  hints.value++
  hintCell.value = s[0]!
}

function replayWith(key: string) {
  levelKey.value = key
  start()
}

const resultText = computed(() => 'Gâteau tout illuminé en ' + moves.value + ' coups' + (hints.value ? ' (avec ' + hints.value + ' indice(s))' : '') + '.')
</script>

<template>
  <GameShell
    title="Allume le gâteau"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :best="best !== null ? best + ' coups' : null"
    :result-text="resultText"
    intro-text="Un casse-tête de logique : toutes les bougies doivent briller."
    @start="start"
    @restart="start"
  >
    <template #intro-extra>
      <LevelPicker :options="LEVELS" :model-value="levelKey" @update:model-value="levelKey = $event" />
    </template>
    <template #end-extra>
      <LevelPicker :options="LEVELS" :model-value="levelKey" @update:model-value="replayWith" />
    </template>
    <div class="mx-auto grid max-w-xs gap-2" :style="{ gridTemplateColumns: 'repeat(' + n + ', minmax(0, 1fr))' }">
      <button
        v-for="(on, i) in lit"
        :key="i"
        type="button"
        class="flex aspect-square items-center justify-center rounded-xl border text-3xl transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 active:scale-90 sm:text-4xl"
        :class="[
          on ? 'border-yellow-200 bg-gradient-to-b from-amber-300 to-pink-400 shadow-lg shadow-amber-300/40' : 'border-violet-300/20 bg-violet-950',
          hintCell === i ? 'ring-4 ring-emerald-300' : '',
        ]"
        :aria-label="'Bougie ligne ' + (Math.floor(i / n) + 1) + ' colonne ' + ((i % n) + 1) + (on ? ', allumée' : ', éteinte')"
        @click="tap(i)"
      >
        <span aria-hidden="true">{{ on ? '🔥' : '🕯️' }}</span>
      </button>
    </div>
    <div class="mt-4 flex justify-center">
      <GameButton variant="ghost" small :disabled="phase !== 'playing'" @click="hint">💡 Indice</GameButton>
    </div>
  </GameShell>
</template>
