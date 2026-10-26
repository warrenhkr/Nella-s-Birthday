<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import GameButton from '../GameButton.vue'
import BirthdayScene from '../BirthdayScene.vue'
import { DIFFERENCES, SCENE_H, SCENE_W, hitDifference, type Difference } from '../../../utils/games/scene'
import { makeRng, shuffle } from '../../../utils/games/rng'
import { readBest, submitBest } from '../../../utils/games/storage'
import { formatTime } from '../../../utils/games/format'
import { useStopwatch } from '../../../utils/games/useStopwatch'

const COUNT = 5
const MAX_ERRORS = 5

const rules = [
  'Deux images de la même salle de fête, mais ' + COUNT + ' détails ont changé dans celle de droite (ou du bas).',
  'Touche l’endroit de chaque différence, sur l’une ou l’autre des images.',
  'Tu peux te tromper ' + (MAX_ERRORS - 1) + ' fois. À la ' + MAX_ERRORS + 'e erreur, la partie est perdue.',
  'Le bouton « Indice » entoure brièvement une différence restante.'
]

const phase = ref<GamePhase>('intro')
const chosen = ref<Difference[]>([])
const found = ref<number[]>([])
const errors = ref(0)
const hints = ref(0)
const hintId = ref<number | null>(null)
const miss = ref<{ x: number, y: number } | null>(null)
const best = ref<number | null>(null)
const finalMs = ref(0)
const { elapsed, start: startClock, stop: stopClock } = useStopwatch()
let hintTimer: ReturnType<typeof setTimeout> | null = null
let missTimer: ReturnType<typeof setTimeout> | null = null

const diffIds = computed(() => chosen.value.map(d => d.id))
const remaining = computed(() => chosen.value.filter(d => !found.value.includes(d.id)))
const marks = computed(() => {
  const m = chosen.value.filter(d => found.value.includes(d.id)).map(d => ({ cx: d.cx, cy: d.cy, r: d.r }))
  const h = chosen.value.find(d => d.id === hintId.value)
  if (h) m.push({ cx: h.cx, cy: h.cy, r: h.r + 6 })
  return m
})
const stats = computed(() => [
  { label: 'Trouvées', value: found.value.length + '/' + COUNT },
  { label: 'Erreurs', value: errors.value + '/' + MAX_ERRORS },
  { label: 'Temps', value: formatTime(elapsed.value) }
])

function start() {
  chosen.value = shuffle(DIFFERENCES, makeRng()).slice(0, COUNT)
  found.value = []
  errors.value = 0
  hints.value = 0
  hintId.value = null
  miss.value = null
  best.value = readBest('differences')
  phase.value = 'playing'
  startClock()
}

function tap(e: PointerEvent) {
  if (phase.value !== 'playing') return
  const el = e.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  const x = ((e.clientX - rect.left) / rect.width) * SCENE_W
  const y = ((e.clientY - rect.top) / rect.height) * SCENE_H
  const hit = hitDifference(x, y, remaining.value)
  if (hit) {
    found.value = [...found.value, hit.id]
    if (hintId.value === hit.id) hintId.value = null
    if (found.value.length === COUNT) {
      finalMs.value = stopClock()
      submitBest('differences', Math.round(finalMs.value), 'min')
      best.value = readBest('differences')
      phase.value = 'won'
    }
    return
  }
  errors.value++
  miss.value = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  if (missTimer) clearTimeout(missTimer)
  missTimer = setTimeout(() => (miss.value = null), 400)
  if (errors.value >= MAX_ERRORS) {
    stopClock()
    phase.value = 'lost'
  }
}

function hint() {
  const next = remaining.value[0]
  if (!next || phase.value !== 'playing') return
  hints.value++
  hintId.value = next.id
  if (hintTimer) clearTimeout(hintTimer)
  hintTimer = setTimeout(() => (hintId.value = null), 1600)
}

onBeforeUnmount(() => {
  if (hintTimer) clearTimeout(hintTimer)
  if (missTimer) clearTimeout(missTimer)
})

const resultText = computed(() =>
  phase.value === 'won'
    ? 'Les ' + COUNT + ' différences en ' + formatTime(finalMs.value) + (hints.value ? ' (avec ' + hints.value + ' indice(s))' : '') + '.'
    : 'Il en restait : ' + remaining.value.map(d => d.label.toLowerCase()).join(' ; ') + '.'
)
</script>

<template>
  <GameShell
    title="Chasse aux différences"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :best="best !== null ? formatTime(best) : null"
    :result-text="resultText"
    intro-text="Un vrai jeu d’observation : qu’est-ce qui a changé dans la salle de fête ?"
    @start="start"
    @restart="start"
  >
    <div class="grid gap-3 sm:grid-cols-2">
      <figure class="relative">
        <figcaption class="mb-1 text-center text-xs uppercase tracking-wide text-violet-300">
          Original
        </figcaption>
        <div
          class="relative aspect-[4/3] cursor-crosshair touch-manipulation overflow-hidden rounded-xl border border-violet-300/30"
          @pointerdown.prevent="tap"
        >
          <BirthdayScene :marks="marks" />
          <span
            v-if="miss"
            class="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-2xl"
            :style="{ left: miss.x + 'px', top: miss.y + 'px' }"
          >❌</span>
        </div>
      </figure>
      <figure class="relative">
        <figcaption class="mb-1 text-center text-xs uppercase tracking-wide text-violet-300">
          Modifiée
        </figcaption>
        <div
          class="relative aspect-[4/3] cursor-crosshair touch-manipulation overflow-hidden rounded-xl border border-violet-300/30"
          @pointerdown.prevent="tap"
        >
          <BirthdayScene
            :diffs="diffIds"
            :marks="marks"
          />
        </div>
      </figure>
    </div>
    <div class="mt-3 flex justify-center">
      <GameButton
        variant="ghost"
        small
        :disabled="phase !== 'playing'"
        @click="hint"
      >
        💡 Indice
      </GameButton>
    </div>
  </GameShell>
</template>
