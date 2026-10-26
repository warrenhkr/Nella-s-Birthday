<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import GameButton from '../GameButton.vue'
import { LEVELS, ZONE_LABEL, decide, makePackets, matchIndex, ruleText, type Action, type Packet } from '../../../utils/games/firewall'
import { makeRng, sleep, type Rng } from '../../../utils/games/rng'
import { readBest, submitBest } from '../../../utils/games/storage'

const MAX_ERRORS = 3
const TIME_MS = [5000, 4200, 3500]

const rules = [
  'Tu es le pare-feu d’un réseau : des paquets de données arrivent un par un et tu dois les laisser passer ou les bloquer.',
  'Suis la liste de règles dans l’ordre : la première règle qui correspond au paquet décide. Si aucune ne correspond, on bloque.',
  'Chaque paquet a un temps limité. Une mauvaise décision ou un paquet laissé sans réponse compte comme une erreur.',
  '3 niveaux, 3 erreurs maximum au total.',
]

const phase = ref<GamePhase>('intro')
const levelIndex = ref(0)
const packets = ref<Packet[]>([])
const packetIndex = ref(0)
const state = ref<'brief' | 'waiting' | 'feedback'>('brief')
const errors = ref(0)
const correctCount = ref(0)
const timeLeft = ref(0)
const feedback = ref('')
const feedbackOk = ref(true)
const best = ref<number | null>(null)
let rng: Rng = makeRng()
let interval: ReturnType<typeof setInterval> | null = null
let token = 0

const level = computed(() => LEVELS[levelIndex.value]!)
const packet = computed(() => packets.value[packetIndex.value])
const limit = computed(() => TIME_MS[levelIndex.value] ?? 3500)
const highlight = computed(() => (packet.value ? matchIndex(level.value.rules, packet.value) : -1))
const stats = computed(() => [
  { label: 'Niveau', value: levelIndex.value + 1 + '/' + LEVELS.length },
  { label: 'Paquet', value: Math.min(packetIndex.value + 1, level.value.count) + '/' + level.value.count },
  { label: 'Erreurs', value: errors.value + '/' + MAX_ERRORS },
])

function clear() {
  if (interval) clearInterval(interval)
  interval = null
}

function start() {
  clear()
  token++
  rng = makeRng()
  levelIndex.value = 0
  errors.value = 0
  correctCount.value = 0
  best.value = readBest('parefeu')
  phase.value = 'playing'
  openLevel()
}

function openLevel() {
  packets.value = makePackets(level.value, rng)
  packetIndex.value = 0
  state.value = 'brief'
}

function begin() {
  nextPacket()
}

function nextPacket() {
  state.value = 'waiting'
  timeLeft.value = limit.value
  clear()
  const my = token
  const startAt = performance.now()
  interval = setInterval(() => {
    if (my !== token) return clear()
    timeLeft.value = Math.max(0, limit.value - (performance.now() - startAt))
    if (timeLeft.value <= 0) {
      clear()
      void resolve(null)
    }
  }, 60)
}

async function resolve(choice: Action | null) {
  if (state.value !== 'waiting' || !packet.value) return
  clear()
  const my = token
  const expected = decide(level.value.rules, packet.value)
  const idx = matchIndex(level.value.rules, packet.value)
  const why = idx < 0 ? 'Aucune règle ne correspond : blocage par défaut.' : 'Règle ' + (idx + 1) + ' : ' + ruleText(level.value.rules[idx]!)
  feedbackOk.value = choice === expected
  if (feedbackOk.value) {
    correctCount.value++
    feedback.value = '✔ Bien joué ! ' + why
  } else {
    errors.value++
    feedback.value = (choice === null ? '⏱ Trop lent ! ' : '✘ Mauvaise décision ! ') + 'Il fallait ' + (expected === 'allow' ? 'AUTORISER' : 'BLOQUER') + '. ' + why
  }
  state.value = 'feedback'
  await sleep(feedbackOk.value ? 1100 : 2200)
  if (my !== token) return
  if (errors.value >= MAX_ERRORS) return end(false)
  if (packetIndex.value >= level.value.count - 1) {
    if (levelIndex.value >= LEVELS.length - 1) return end(true)
    levelIndex.value++
    openLevel()
    return
  }
  packetIndex.value++
  nextPacket()
}

function end(won: boolean) {
  clear()
  submitBest('parefeu', correctCount.value, 'max')
  best.value = readBest('parefeu')
  phase.value = won ? 'won' : 'lost'
}

onBeforeUnmount(() => {
  token++
  clear()
})

const resultText = computed(() =>
  phase.value === 'won'
    ? 'Réseau protégé ! ' + correctCount.value + ' décisions justes, ' + errors.value + ' erreur(s).'
    : 'Trop de paquets sont passés entre les mailles. Décisions justes : ' + correctCount.value + '.',
)
</script>

<template>
  <GameShell
    title="Pare-feu"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :best="best !== null ? best + ' décisions justes' : null"
    :result-text="resultText"
    intro-text="Protège le réseau de la fête : laisse passer les amis, bloque les intrus."
    @start="start"
    @restart="start"
  >
    <div class="mx-auto max-w-lg">
      <h3 class="mb-2 font-bold text-white">{{ level.title }}</h3>
      <ol class="mb-4 space-y-1.5 text-sm" aria-label="Règles du pare-feu, dans l’ordre">
        <li
          v-for="(r, i) in level.rules"
          :key="i"
          class="rounded-lg border px-3 py-1.5"
          :class="[
            r.action === 'allow' ? 'border-emerald-300/30 bg-emerald-500/10' : 'border-rose-300/30 bg-rose-500/10',
            state !== 'brief' && highlight === i && state === 'feedback' ? 'ring-2 ring-pink-300' : '',
          ]"
        >
          <span class="mr-2 font-bold text-violet-300">{{ i + 1 }}.</span>{{ ruleText(r) }}
        </li>
        <li class="rounded-lg border border-violet-300/20 px-3 py-1.5 text-violet-300"><span class="mr-2 font-bold">{{ level.rules.length + 1 }}.</span>Sinon : BLOQUER</li>
      </ol>

      <div v-if="state === 'brief'" class="text-center">
        <p class="mb-3 text-sm text-violet-200">Lis bien les règles, puis lance le trafic. {{ level.count }} paquets arrivent.</p>
        <GameButton @click="begin">▶ Lancer le trafic</GameButton>
      </div>
      <div v-else-if="packet" class="rounded-2xl border border-violet-300/20 bg-violet-950/70 p-4">
        <div class="mb-3 h-2 overflow-hidden rounded-full bg-violet-900">
          <div class="h-full rounded-full transition-[width] duration-75" :class="timeLeft / limit < 0.3 ? 'bg-rose-400' : 'bg-pink-400'" :style="{ width: (state === 'waiting' ? (timeLeft / limit) * 100 : 0) + '%' }" />
        </div>
        <p class="text-xs uppercase tracking-wide text-violet-400">Paquet entrant</p>
        <p class="mb-3 text-lg font-bold text-white">
          Zone {{ ZONE_LABEL[packet.zone] }} · port {{ packet.port }}
          <span class="block text-sm font-normal text-violet-200">{{ packet.service }}</span>
        </p>
        <div v-if="state === 'waiting'" class="grid grid-cols-2 gap-3">
          <GameButton @click="resolve('allow')">✅ Autoriser</GameButton>
          <GameButton variant="danger" @click="resolve('block')">⛔ Bloquer</GameButton>
        </div>
        <p v-else class="text-sm font-medium" :class="feedbackOk ? 'text-emerald-300' : 'text-rose-300'" role="status" aria-live="polite">{{ feedback }}</p>
      </div>
    </div>
  </GameShell>
</template>
