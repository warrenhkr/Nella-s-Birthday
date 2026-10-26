<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import GameButton from '../GameButton.vue'
import LevelPicker from '../LevelPicker.vue'
import { makeRng, randInt } from '../../../utils/games/rng'
import { readBest, submitBest } from '../../../utils/games/storage'

const LEVELS = [
  { key: '50', label: '1 à 50 · 6 essais', max: 50, tries: 6 },
  { key: '100', label: '1 à 100 · 7 essais', max: 100, tries: 7 },
  { key: '1000', label: '1 à 1000 · 10 essais', max: 1000, tries: 10 }
]

const rules = [
  'Un nombre secret est caché dans l’intervalle indiqué. À toi de le deviner en un nombre limité d’essais.',
  'Après chaque proposition, on te dit si le secret est plus grand ou plus petit.',
  'Astuce : coupe toujours l’intervalle en deux. C’est la « recherche dichotomique », celle qu’utilisent les ordinateurs.'
]

const levelKey = ref('100')
const level = computed(() => LEVELS.find(l => l.key === levelKey.value) ?? LEVELS[1]!)
const phase = ref<GamePhase>('intro')
const secret = ref(0)
const low = ref(1)
const high = ref(100)
const guesses = ref<{ value: number, hint: 'plus' | 'moins' | 'ok' }[]>([])
const input = ref<string | number>('')
const error = ref('')
const best = ref<number | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)

const left = computed(() => level.value.tries - guesses.value.length)
const stats = computed(() => [
  { label: 'Essais restants', value: left.value },
  { label: 'Intervalle', value: low.value + ' – ' + high.value }
])

function start() {
  const lvl = level.value
  secret.value = randInt(makeRng(), 1, lvl.max)
  low.value = 1
  high.value = lvl.max
  guesses.value = []
  input.value = ''
  error.value = ''
  best.value = readBest('plusmoins-' + levelKey.value)
  phase.value = 'playing'
  void nextTick(() => inputEl.value?.focus())
}

function submit() {
  if (phase.value !== 'playing') return
  const text = String(input.value ?? '').trim()
  const value = Number(text)
  if (text === '' || !Number.isInteger(value)) {
    error.value = 'Entre un nombre entier.'
    return
  }
  if (value < 1 || value > level.value.max) {
    error.value = 'Le nombre est entre 1 et ' + level.value.max + '.'
    return
  }
  error.value = ''
  input.value = ''
  let hint: 'plus' | 'moins' | 'ok' = 'ok'
  if (value < secret.value) {
    hint = 'plus'
    low.value = Math.max(low.value, value + 1)
  } else if (value > secret.value) {
    hint = 'moins'
    high.value = Math.min(high.value, value - 1)
  }
  guesses.value = [...guesses.value, { value, hint }]
  if (hint === 'ok') {
    submitBest('plusmoins-' + levelKey.value, guesses.value.length, 'min')
    best.value = readBest('plusmoins-' + levelKey.value)
    phase.value = 'won'
  } else if (left.value <= 0) {
    phase.value = 'lost'
  } else void nextTick(() => inputEl.value?.focus())
}

function replayWith(key: string) {
  levelKey.value = key
  start()
}

const resultText = computed(() =>
  phase.value === 'won' ? 'Trouvé en ' + guesses.value.length + ' essai(s) : le secret était ' + secret.value + '.' : 'Le nombre secret était ' + secret.value + '.'
)
</script>

<template>
  <GameShell
    title="Plus ou moins"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :best="best !== null ? best + ' essais' : null"
    :result-text="resultText"
    intro-text="Devine le nombre secret avec le moins d’essais possible."
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
    <div class="mx-auto max-w-sm">
      <form
        class="flex gap-2"
        @submit.prevent="submit"
      >
        <input
          ref="inputEl"
          v-model="input"
          type="number"
          inputmode="numeric"
          :min="1"
          :max="level.max"
          class="min-h-11 w-full rounded-xl border border-violet-300/30 bg-violet-950 px-4 text-lg text-white placeholder-violet-400 focus:border-pink-300 focus:outline-none"
          placeholder="Ton nombre"
          aria-label="Ta proposition"
          :disabled="phase !== 'playing'"
        >
        <GameButton
          type="submit"
          :disabled="phase !== 'playing'"
        >
          Valider
        </GameButton>
      </form>
      <p
        v-if="error"
        class="mt-2 text-sm text-rose-300"
        role="alert"
      >
        {{ error }}
      </p>
      <ul
        class="mt-4 space-y-2"
        aria-label="Propositions précédentes"
      >
        <li
          v-for="(g, i) in [...guesses].reverse()"
          :key="guesses.length - i"
          class="flex items-center justify-between rounded-xl border border-violet-300/20 bg-violet-950/60 px-4 py-2"
        >
          <span class="text-lg font-bold tabular-nums text-white">{{ g.value }}</span>
          <span :class="g.hint === 'ok' ? 'text-emerald-300' : 'text-pink-200'">
            {{ g.hint === 'plus' ? '⬆ C’est plus !' : g.hint === 'moins' ? '⬇ C’est moins !' : '✔ Bravo !' }}
          </span>
        </li>
      </ul>
    </div>
  </GameShell>
</template>
