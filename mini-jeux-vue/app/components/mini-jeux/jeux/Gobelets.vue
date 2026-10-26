<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import { makeRng, randInt, sleep, type Rng } from '../../../utils/games/rng'
import { readBest, submitBest } from '../../../utils/games/storage'

interface Round {
  cups: number
  swaps: number
  ms: number
}
const ROUNDS: Round[] = [
  { cups: 3, swaps: 4, ms: 650 },
  { cups: 3, swaps: 6, ms: 550 },
  { cups: 3, swaps: 8, ms: 450 },
  { cups: 4, swaps: 8, ms: 450 },
  { cups: 4, swaps: 10, ms: 380 },
  { cups: 5, swaps: 12, ms: 330 },
]
const LIVES = 3

const rules = [
  'Un cadeau est caché sous un gobelet. Regarde bien où il se trouve.',
  'Les gobelets s’échangent de place de plus en plus vite. Suis du regard celui qui cache le cadeau.',
  'Quand ils s’arrêtent, touche le bon gobelet. Tu as 3 vies et 6 manches à réussir.',
]

interface Cup {
  id: number
  slot: number
}
const phase = ref<GamePhase>('intro')
const round = ref(0)
const lives = ref(LIVES)
const cups = ref<Cup[]>([])
const ballCup = ref(0)
const lifted = ref<number[]>([])
const status = ref<'idle' | 'watch' | 'shuffle' | 'choose' | 'reveal'>('idle')
const message = ref('')
const best = ref<number | null>(null)
const score = ref(0)
let token = 0
let rng: Rng = makeRng()

const current = computed(() => ROUNDS[Math.min(round.value, ROUNDS.length - 1)]!)
const stats = computed(() => [
  { label: 'Manche', value: Math.min(round.value + 1, ROUNDS.length) + '/' + ROUNDS.length },
  { label: 'Vies', value: '❤️'.repeat(lives.value) || '—' },
  { label: 'Gobelets', value: current.value.cups },
])

const slotLeft = (slot: number, total: number) => ((slot + 0.5) / total) * 100 + '%'

async function playRound() {
  const my = token
  const r = current.value
  cups.value = Array.from({ length: r.cups }, (_, i) => ({ id: i, slot: i }))
  ballCup.value = randInt(rng, 0, r.cups - 1)
  lifted.value = [ballCup.value]
  status.value = 'watch'
  message.value = 'Regarde bien où est le cadeau…'
  await sleep(1300)
  if (my !== token) return
  lifted.value = []
  await sleep(400)
  if (my !== token) return
  status.value = 'shuffle'
  message.value = 'Suis-le des yeux !'
  for (let k = 0; k < r.swaps; k++) {
    const a = randInt(rng, 0, r.cups - 1)
    let b = randInt(rng, 0, r.cups - 1)
    while (b === a) b = randInt(rng, 0, r.cups - 1)
    cups.value = cups.value.map((c) => (c.id === a ? { ...c, slot: cups.value[b]!.slot } : c.id === b ? { ...c, slot: cups.value[a]!.slot } : c))
    await sleep(r.ms + 60)
    if (my !== token) return
  }
  status.value = 'choose'
  message.value = 'Où est le cadeau ? Touche un gobelet.'
}

async function choose(id: number) {
  if (status.value !== 'choose' || phase.value !== 'playing') return
  const my = token
  status.value = 'reveal'
  lifted.value = cups.value.map((c) => c.id)
  const ok = id === ballCup.value
  if (ok) {
    score.value++
    message.value = 'Bravo, c’est là !'
  } else {
    lives.value--
    message.value = 'Raté… le cadeau était sous un autre gobelet.'
  }
  await sleep(1500)
  if (my !== token) return
  if (lives.value <= 0) return end(false)
  if (round.value >= ROUNDS.length - 1) return end(true)
  round.value++
  await playRound()
}

function end(won: boolean) {
  submitBest('gobelets', score.value, 'max')
  best.value = readBest('gobelets')
  phase.value = won ? 'won' : 'lost'
}

function start() {
  token++
  rng = makeRng()
  round.value = 0
  lives.value = LIVES
  score.value = 0
  lifted.value = []
  best.value = readBest('gobelets')
  phase.value = 'playing'
  void playRound()
}

onBeforeUnmount(() => {
  token++
})

const resultText = computed(() =>
  phase.value === 'won' ? 'Tu as suivi le cadeau pendant les 6 manches !' : 'Tu as retrouvé le cadeau ' + score.value + ' fois sur ' + ROUNDS.length + '.',
)
</script>

<template>
  <GameShell
    title="Les gobelets"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :best="best !== null ? best + ' manches gagnées' : null"
    :result-text="resultText"
    intro-text="Le jeu du cadeau caché : garde les yeux ouverts."
    @start="start"
    @restart="start"
  >
    <p class="mb-3 min-h-6 text-center text-sm text-violet-200" aria-live="polite">{{ message }}</p>
    <div class="relative mx-auto h-44 max-w-md rounded-2xl border border-violet-300/20 bg-gradient-to-b from-violet-900/60 to-violet-950/80">
      <div class="absolute inset-x-0 bottom-6 h-1 rounded bg-violet-400/30" />
      <div
        v-for="c in cups"
        :key="'ball' + c.id"
        class="absolute bottom-7 -translate-x-1/2 text-3xl transition-all ease-in-out"
        :class="c.id === ballCup && lifted.includes(c.id) ? 'opacity-100' : 'opacity-0'"
        :style="{ left: slotLeft(c.slot, current.cups), transitionDuration: current.ms + 'ms' }"
        aria-hidden="true"
      >
        🎁
      </div>
      <button
        v-for="c in cups"
        :key="'cup' + c.id"
        type="button"
        class="absolute bottom-6 h-20 w-16 -translate-x-1/2 touch-manipulation bg-gradient-to-b from-pink-400 to-violet-500 shadow-lg transition-all ease-in-out [clip-path:polygon(14%_0,86%_0,100%_100%,0_100%)] focus:outline-none sm:h-24 sm:w-20"
        :class="[lifted.includes(c.id) ? '-translate-y-12' : '', status === 'choose' ? 'cursor-pointer hover:brightness-110 active:brightness-90' : 'cursor-default']"
        :style="{ left: slotLeft(c.slot, current.cups), transitionDuration: current.ms + 'ms' }"
        :aria-label="'Gobelet ' + (c.slot + 1)"
        :disabled="status !== 'choose'"
        @click="choose(c.id)"
      />
    </div>
  </GameShell>
</template>
