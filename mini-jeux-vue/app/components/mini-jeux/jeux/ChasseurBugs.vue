<script setup lang="ts">
import { computed, ref } from 'vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import GameButton from '../GameButton.vue'
import { drawSnippets, type BugSnippet } from '../../../utils/games/bugs'
import { makeRng } from '../../../utils/games/rng'
import { readBest, submitBest } from '../../../utils/games/storage'

const COUNT = 8
const LIVES = 3

const rules = [
  'Chaque petit programme contient UNE ligne qui contient un bug (une erreur).',
  'Lis l’objectif du programme, puis touche la ligne fautive.',
  'Tu as ' + LIVES + ' vies. Après chaque réponse, on t’explique le bug et comment le corriger.',
  'Pas besoin de savoir coder : la logique suffit, et les explications t’aident à apprendre.',
]

const phase = ref<GamePhase>('intro')
const snippets = ref<BugSnippet[]>([])
const index = ref(0)
const lives = ref(LIVES)
const score = ref(0)
const picked = ref<number | null>(null)
const best = ref<number | null>(null)

const snippet = computed(() => snippets.value[index.value])
const isCorrect = computed(() => snippet.value !== undefined && picked.value === snippet.value.bugLine)
const stats = computed(() => [
  { label: 'Programme', value: Math.min(index.value + 1, COUNT) + '/' + COUNT },
  { label: 'Vies', value: '❤️'.repeat(lives.value) || '—' },
  { label: 'Bugs trouvés', value: score.value },
])

function start() {
  snippets.value = drawSnippets(COUNT, makeRng())
  index.value = 0
  lives.value = LIVES
  score.value = 0
  picked.value = null
  best.value = readBest('bugs')
  phase.value = 'playing'
}

function pick(line: number) {
  if (picked.value !== null || !snippet.value) return
  picked.value = line
  if (line === snippet.value.bugLine) score.value++
  else lives.value--
}

function next() {
  if (lives.value <= 0 || index.value >= COUNT - 1) {
    submitBest('bugs', score.value, 'max')
    best.value = readBest('bugs')
    phase.value = lives.value > 0 ? 'won' : 'lost'
    return
  }
  index.value++
  picked.value = null
}

const resultTitle = computed(() => (phase.value === 'won' ? 'Chasseur de bugs confirmé !' : 'Le bug a gagné cette fois…'))
const resultText = computed(() => score.value + ' bug(s) trouvé(s) sur ' + COUNT + '.')
</script>

<template>
  <GameShell
    title="Chasseur de bugs"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :best="best !== null ? best + '/' + COUNT : null"
    :result-title="resultTitle"
    :result-text="resultText"
    intro-text="Trouve la ligne qui cloche, comme un vrai développeur."
    @start="start"
    @restart="start"
  >
    <div v-if="snippet" class="mx-auto max-w-xl">
      <div class="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span class="rounded-full bg-violet-800/70 px-3 py-1 font-semibold text-violet-100">{{ snippet.lang }}</span>
        <span v-if="snippet.cyber" class="rounded-full bg-rose-700/60 px-3 py-1 font-semibold text-rose-100">🔐 Sécurité</span>
      </div>
      <p class="mb-3 text-violet-100"><strong class="text-white">Objectif :</strong> {{ snippet.goal }}</p>
      <div class="overflow-x-auto rounded-xl border border-violet-300/20 bg-slate-950 py-2 font-mono text-xs sm:text-sm" role="group" aria-label="Lignes du programme">
        <button
          v-for="(line, i) in snippet.lines"
          :key="i"
          type="button"
          class="flex min-h-10 w-full items-center gap-3 px-3 text-left transition focus:outline-none focus-visible:bg-violet-800/50"
          :class="
            picked === null
              ? 'hover:bg-violet-800/40 active:bg-violet-700/50'
              : i === snippet.bugLine
                ? 'bg-emerald-500/25'
                : i === picked
                  ? 'bg-rose-500/25'
                  : 'opacity-60'
          "
          :disabled="picked !== null"
          :aria-label="'Ligne ' + (i + 1) + ' : ' + (line.trim() || 'vide')"
          @click="pick(i)"
        >
          <span class="w-5 shrink-0 select-none text-right text-violet-400" aria-hidden="true">{{ i + 1 }}</span>
          <code class="whitespace-pre text-violet-50">{{ line === '' ? ' ' : line }}</code>
        </button>
      </div>
      <div v-if="picked !== null" class="mt-4 rounded-xl border p-4" :class="isCorrect ? 'border-emerald-300/40 bg-emerald-500/10' : 'border-rose-300/40 bg-rose-500/10'" role="status" aria-live="polite">
        <p class="mb-1 font-bold" :class="isCorrect ? 'text-emerald-300' : 'text-rose-300'">
          {{ isCorrect ? '✔ Bien vu !' : '✘ Ce n’était pas cette ligne (la ligne ' + (snippet.bugLine + 1) + ').' }}
        </p>
        <p class="mb-2 text-sm text-violet-100">{{ snippet.why }}</p>
        <p class="mb-3 text-xs text-violet-300">Correction : <code class="rounded bg-slate-950 px-1.5 py-0.5 text-pink-200">{{ snippet.fix }}</code></p>
        <GameButton @click="next">{{ lives <= 0 || index >= COUNT - 1 ? 'Voir le résultat' : 'Suivant →' }}</GameButton>
      </div>
    </div>
  </GameShell>
</template>
