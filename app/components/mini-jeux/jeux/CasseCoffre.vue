<script setup lang="ts">
import { computed, ref } from 'vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import GameButton from '../GameButton.vue'
import LevelPicker from '../LevelPicker.vue'
import { makeSecret, score as scoreGuess, type Feedback } from '../../../utils/games/mastermind'
import { makeRng } from '../../../utils/games/rng'
import { readBest, submitBest } from '../../../utils/games/storage'

const SYMBOLS = ['🔑', '💎', '⭐', '🌙', '🔥', '🍀', '🎲', '🎧']
const LEVELS = [
  { key: 'facile', label: 'Facile · 4 clés, 6 symboles', length: 4, symbols: 6, tries: 10 },
  { key: 'moyen', label: 'Moyen · 4 clés, 8 symboles', length: 4, symbols: 8, tries: 10 },
  { key: 'difficile', label: 'Difficile · 5 clés, 8 symboles', length: 5, symbols: 8, tries: 12 }
]

const rules = [
  'Le coffre est fermé par un code secret : une suite de symboles. Un même symbole peut apparaître plusieurs fois.',
  'Compose une proposition et valide-la. Chaque ● vert = un symbole bien placé. Chaque ○ orange = un symbole présent mais mal placé.',
  'Les pastilles ne disent pas quels symboles sont concernés : à toi de déduire ! Trouve le code avant la fin des essais.'
]

const levelKey = ref('facile')
const level = computed(() => LEVELS.find(l => l.key === levelKey.value) ?? LEVELS[0]!)
const phase = ref<GamePhase>('intro')
const secret = ref<number[]>([])
const current = ref<(number | null)[]>([])
const slot = ref(0)
const history = ref<{ guess: number[], fb: Feedback }[]>([])
const best = ref<number | null>(null)

const left = computed(() => level.value.tries - history.value.length)
const full = computed(() => current.value.every(v => v !== null))
const stats = computed(() => [{ label: 'Essais restants', value: left.value }])

function start() {
  const lvl = level.value
  secret.value = makeSecret(lvl.length, lvl.symbols, makeRng())
  current.value = new Array(lvl.length).fill(null)
  slot.value = 0
  history.value = []
  best.value = readBest('coffre-' + levelKey.value)
  phase.value = 'playing'
}

function put(sym: number) {
  if (phase.value !== 'playing') return
  const next = current.value.slice()
  next[slot.value] = sym
  current.value = next
  const empty = next.findIndex(v => v === null)
  slot.value = empty >= 0 ? empty : Math.min(slot.value + 1, next.length - 1)
}

function clearSlot() {
  const next = current.value.slice()
  next[slot.value] = null
  current.value = next
}

function submit() {
  if (phase.value !== 'playing' || !full.value) return
  const guess = current.value as number[]
  const fb = scoreGuess(secret.value, guess)
  history.value = [...history.value, { guess, fb }]
  current.value = new Array(level.value.length).fill(null)
  slot.value = 0
  if (fb.exact === level.value.length) {
    submitBest('coffre-' + levelKey.value, history.value.length, 'min')
    best.value = readBest('coffre-' + levelKey.value)
    phase.value = 'won'
  } else if (left.value <= 0) phase.value = 'lost'
}

function replayWith(key: string) {
  levelKey.value = key
  start()
}

const resultText = computed(() =>
  phase.value === 'won'
    ? 'Coffre ouvert en ' + history.value.length + ' essai(s) !'
    : 'Le code était : ' + secret.value.map(s => SYMBOLS[s]).join(' ')
)
</script>

<template>
  <GameShell
    title="Casse-coffre"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :best="best !== null ? best + ' essais' : null"
    :result-text="resultText"
    intro-text="Déduis le code du coffre grâce aux indices, comme un cryptanalyste."
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
    <div class="mx-auto max-w-md">
      <ol
        class="mb-4 max-h-56 space-y-1.5 overflow-y-auto"
        aria-label="Propositions précédentes"
      >
        <li
          v-for="(h, i) in history"
          :key="i"
          class="flex items-center justify-between rounded-xl border border-violet-300/15 bg-violet-950/60 px-3 py-1.5"
        >
          <span class="w-5 text-xs text-violet-400">{{ i + 1 }}</span>
          <span
            class="flex gap-1 text-xl"
            aria-hidden="true"
          ><span
            v-for="(g, k) in h.guess"
            :key="k"
          >{{ SYMBOLS[g] }}</span></span>
          <span
            class="flex items-center gap-1 text-lg"
            :aria-label="h.fb.exact + ' bien placé(s), ' + h.fb.misplaced + ' mal placé(s)'"
          >
            <span
              v-for="n in h.fb.exact"
              :key="'e' + n"
              class="text-emerald-400"
            >●</span>
            <span
              v-for="n in h.fb.misplaced"
              :key="'m' + n"
              class="text-amber-300"
            >○</span>
            <span
              v-if="h.fb.exact + h.fb.misplaced === 0"
              class="text-xs text-violet-400"
            >aucun</span>
          </span>
        </li>
      </ol>

      <div
        class="mb-3 flex justify-center gap-2"
        role="group"
        aria-label="Ta proposition"
      >
        <button
          v-for="(v, i) in current"
          :key="i"
          type="button"
          class="flex h-14 w-14 items-center justify-center rounded-xl border-2 text-3xl transition active:scale-95"
          :class="slot === i ? 'border-pink-300 bg-pink-500/20' : 'border-violet-300/30 bg-violet-950/70'"
          :aria-label="'Emplacement ' + (i + 1) + (v !== null ? ' : ' + SYMBOLS[v] : ' : vide')"
          @click="slot = i"
        >
          {{ v !== null ? SYMBOLS[v] : '' }}
        </button>
      </div>
      <div
        class="mb-3 flex flex-wrap justify-center gap-2"
        role="group"
        aria-label="Symboles disponibles"
      >
        <button
          v-for="s in level.symbols"
          :key="s"
          type="button"
          class="flex h-12 w-12 items-center justify-center rounded-xl border border-violet-300/30 bg-violet-900/40 text-2xl active:scale-90"
          :aria-label="'Symbole ' + SYMBOLS[s - 1]"
          @click="put(s - 1)"
        >
          {{ SYMBOLS[s - 1] }}
        </button>
      </div>
      <div class="flex justify-center gap-2">
        <GameButton
          variant="ghost"
          small
          @click="clearSlot"
        >
          ⌫ Effacer
        </GameButton>
        <GameButton
          :disabled="!full"
          @click="submit"
        >
          🔓 Tester le code
        </GameButton>
      </div>
    </div>
  </GameShell>
</template>
