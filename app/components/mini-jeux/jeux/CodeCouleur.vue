<script setup lang="ts">
import { computed, ref } from 'vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import GameButton from '../GameButton.vue'
import { accuracy, choices, randomColor, toHex, type Rgb } from '../../../utils/games/colorhex'
import { makeRng, type Rng } from '../../../utils/games/rng'
import { readBest, submitBest } from '../../../utils/games/storage'

const ROUNDS = 6
const WIN_SCORE = 40

const rules = [
  'Sur le web, une couleur s’écrit #RRVVBB : trois nombres en hexadécimal (00 à FF) pour le rouge, le vert et le bleu.',
  'Manches 1, 3 et 5 : choisis le bon code parmi 4 propositions (10 points si tu as bon).',
  'Manches 2, 4 et 6 : règle toi-même les curseurs rouge, vert et bleu pour retrouver la couleur (jusqu’à 10 points selon la précision).',
  'Il faut au moins ' + WIN_SCORE + ' points sur 60 pour gagner.'
]

const phase = ref<GamePhase>('intro')
const round = ref(0)
const score = ref(0)
const target = ref<Rgb>([0, 0, 0])
const options = ref<string[]>([])
const answer = ref('')
const picked = ref<string | null>(null)
const sliders = ref<Rgb>([128, 128, 128])
const validated = ref(false)
const gained = ref(0)
const best = ref<number | null>(null)
let rng: Rng = makeRng()

const isChoice = computed(() => round.value % 2 === 0)
const swatch = computed(() => ({ backgroundColor: toHex(target.value) }))
const mine = computed(() => ({ backgroundColor: toHex(sliders.value) }))
const stats = computed(() => [{ label: 'Manche', value: Math.min(round.value + 1, ROUNDS) + '/' + ROUNDS }, { label: 'Points', value: score.value }])

function newRound() {
  target.value = randomColor(rng)
  picked.value = null
  validated.value = false
  gained.value = 0
  sliders.value = [128, 128, 128]
  if (round.value % 2 === 0) {
    const c = choices(target.value, rng)
    options.value = c.options
    answer.value = c.answer
  }
}

function start() {
  rng = makeRng()
  round.value = 0
  score.value = 0
  best.value = readBest('couleur')
  phase.value = 'playing'
  newRound()
}

function choose(hex: string) {
  if (picked.value !== null) return
  picked.value = hex
  validated.value = true
  gained.value = hex === answer.value ? 10 : 0
  score.value += gained.value
}

function setSlider(k: 0 | 1 | 2, value: number) {
  const next: Rgb = [...sliders.value]
  next[k] = value
  sliders.value = next
}

function validate() {
  if (validated.value) return
  validated.value = true
  gained.value = Math.round(Math.pow(accuracy(sliders.value, target.value) / 100, 6) * 10)
  score.value += gained.value
}

function next() {
  if (round.value >= ROUNDS - 1) {
    submitBest('couleur', score.value, 'max')
    best.value = readBest('couleur')
    phase.value = score.value >= WIN_SCORE ? 'won' : 'lost'
    return
  }
  round.value++
  newRound()
}

const resultTitle = computed(() => (phase.value === 'won' ? 'Œil de designer !' : 'Pas encore un pro du hexa…'))
const resultText = computed(() => score.value + ' points sur 60 (il en fallait ' + WIN_SCORE + ').')
</script>

<template>
  <GameShell
    title="Devine le code couleur"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :best="best !== null ? best + '/60' : null"
    :result-title="resultTitle"
    :result-text="resultText"
    intro-text="Les couleurs du web ont un code secret : apprends à le lire."
    @start="start"
    @restart="start"
  >
    <div class="mx-auto max-w-md">
      <div
        class="mb-4 h-28 rounded-2xl border-2 border-white/30 shadow-lg"
        :style="swatch"
        role="img"
        :aria-label="validated ? 'Couleur cible ' + toHex(target) : 'Couleur à deviner'"
      />
      <template v-if="isChoice">
        <p class="mb-2 text-center text-violet-100">
          Quel est le code de cette couleur ?
        </p>
        <div class="grid grid-cols-2 gap-3">
          <button
            v-for="o in options"
            :key="o"
            type="button"
            class="min-h-12 rounded-xl border font-mono text-lg font-bold transition active:scale-95"
            :class="
              picked === null
                ? 'border-violet-300/30 bg-violet-900/40 text-white'
                : o === answer
                  ? 'border-emerald-300 bg-emerald-500/30 text-white'
                  : o === picked
                    ? 'border-rose-300 bg-rose-500/30 text-white'
                    : 'border-violet-300/10 bg-violet-950/40 text-violet-300'
            "
            :disabled="picked !== null"
            @click="choose(o)"
          >
            {{ o }}
          </button>
        </div>
      </template>
      <template v-else>
        <p class="mb-2 text-center text-violet-100">
          Règle les curseurs pour recréer la couleur.
        </p>
        <div class="mb-3 flex items-center gap-3">
          <div
            class="h-12 flex-1 rounded-xl border-2 border-white/30"
            :style="mine"
            aria-hidden="true"
          />
          <span class="font-mono text-lg font-bold text-white">{{ toHex(sliders) }}</span>
        </div>
        <div
          v-for="(label, k) in ['Rouge', 'Vert', 'Bleu']"
          :key="label"
          class="mb-2 flex items-center gap-3"
        >
          <label
            class="w-14 text-sm text-violet-100"
            :for="'curseur-' + k"
          >{{ label }}</label>
          <input
            :id="'curseur-' + k"
            type="range"
            min="0"
            max="255"
            :value="sliders[k as 0 | 1 | 2]"
            class="h-10 flex-1 touch-manipulation accent-pink-400"
            :disabled="validated"
            @input="setSlider(k as 0 | 1 | 2, Number(($event.target as HTMLInputElement).value))"
          >
          <span class="w-8 text-right font-mono text-sm text-violet-200">{{ sliders[k as 0 | 1 | 2].toString(16).toUpperCase().padStart(2, '0') }}</span>
        </div>
        <div
          v-if="!validated"
          class="mt-3 flex justify-center"
        >
          <GameButton @click="validate">
            Valider
          </GameButton>
        </div>
      </template>
      <div
        v-if="validated"
        class="mt-4 text-center"
        role="status"
        aria-live="polite"
      >
        <p
          class="mb-3 text-lg font-bold"
          :class="gained >= 7 ? 'text-emerald-300' : gained > 0 ? 'text-amber-200' : 'text-rose-300'"
        >
          {{ gained }} point(s) · la couleur était {{ toHex(target) }}
        </p>
        <GameButton @click="next">
          {{ round >= ROUNDS - 1 ? 'Voir le résultat' : 'Manche suivante →' }}
        </GameButton>
      </div>
    </div>
  </GameShell>
</template>
