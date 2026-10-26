<script setup lang="ts">
import { computed, ref } from 'vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import GameButton from '../GameButton.vue'
import { drawMessages, type Message } from '../../../utils/games/phishing'
import { makeRng } from '../../../utils/games/rng'
import { readBest, submitBest } from '../../../utils/games/storage'

const COUNT = 10
const WIN_SCORE = 7

const rules = [
  'Tu reçois des messages (e-mails et SMS). Certains sont légitimes, d’autres sont des pièges : le « phishing » (hameçonnage).',
  'Lis bien le contexte, l’expéditeur, l’adresse du lien et ce qu’on te demande. Touche « Voir l’adresse réelle » pour vérifier un lien.',
  'Décide : message sûr, ou piège ? Après chaque réponse, les indices sont expliqués.',
  COUNT + ' messages par partie, ' + WIN_SCORE + ' bonnes réponses pour gagner. Tous les messages, marques et adresses sont inventés.',
]

const phase = ref<GamePhase>('intro')
const messages = ref<Message[]>([])
const index = ref(0)
const score = ref(0)
const answered = ref<boolean | null>(null)
const showLink = ref(false)
const best = ref<number | null>(null)

const msg = computed(() => messages.value[index.value])
const correct = computed(() => answered.value !== null && msg.value !== undefined && answered.value === msg.value.phishing)
const stats = computed(() => [{ label: 'Message', value: Math.min(index.value + 1, COUNT) + '/' + COUNT }, { label: 'Score', value: score.value }])

function start() {
  messages.value = drawMessages(COUNT, makeRng())
  index.value = 0
  score.value = 0
  answered.value = null
  showLink.value = false
  best.value = readBest('phishing')
  phase.value = 'playing'
}

function answer(isPhishing: boolean) {
  if (answered.value !== null || !msg.value) return
  answered.value = isPhishing
  if (isPhishing === msg.value.phishing) score.value++
}

function next() {
  if (index.value >= COUNT - 1) {
    submitBest('phishing', score.value, 'max')
    best.value = readBest('phishing')
    phase.value = score.value >= WIN_SCORE ? 'won' : 'lost'
    return
  }
  index.value++
  answered.value = null
  showLink.value = false
}

const resultTitle = computed(() => (phase.value === 'won' ? 'Détective du web !' : 'Les pièges étaient bien cachés…'))
const resultText = computed(() => score.value + ' bonne(s) réponse(s) sur ' + COUNT + '. En cas de doute : ne clique pas, et vérifie par un autre moyen.')
</script>

<template>
  <GameShell
    title="Phishing ou cadeau ?"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :best="best !== null ? best + '/' + COUNT : null"
    :result-title="resultTitle"
    :result-text="resultText"
    intro-text="Apprends à repérer les faux messages avant qu’ils ne te piègent."
    @start="start"
    @restart="start"
  >
    <div v-if="msg" class="mx-auto max-w-lg">
      <p class="mb-2 text-xs text-violet-300">Contexte : {{ msg.context }}</p>
      <article class="rounded-2xl border border-violet-300/20 bg-white p-4 text-slate-800 shadow-lg" :class="msg.channel === 'sms' ? 'max-w-sm rounded-bl-sm' : ''">
        <header class="mb-2 border-b border-slate-200 pb-2 text-sm">
          <p><span class="font-semibold text-slate-500">{{ msg.channel === 'sms' ? 'SMS' : 'De' }} :</span> {{ msg.from }}</p>
          <p v-if="msg.subject"><span class="font-semibold text-slate-500">Objet :</span> {{ msg.subject }}</p>
        </header>
        <p class="mb-3 text-sm leading-relaxed">{{ msg.body }}</p>
        <div v-if="msg.link" class="mb-2">
          <span class="text-sm font-medium text-blue-700 underline">{{ msg.link.text }}</span>
          <button type="button" class="ml-3 min-h-8 rounded-lg bg-slate-200 px-2 text-xs font-semibold text-slate-700 active:bg-slate-300" @click="showLink = !showLink">
            {{ showLink ? 'Cacher' : '👁 Voir l’adresse réelle' }}
          </button>
          <p v-if="showLink" class="mt-1 break-all rounded bg-slate-100 p-2 font-mono text-xs text-slate-700">{{ msg.link.target }}</p>
        </div>
        <p v-if="msg.attachment" class="text-sm">📎 Pièce jointe : <span class="font-mono">{{ msg.attachment }}</span></p>
      </article>

      <div v-if="answered === null" class="mt-4 grid grid-cols-2 gap-3">
        <GameButton @click="answer(false)">✅ Message sûr</GameButton>
        <GameButton variant="danger" @click="answer(true)">🎣 C’est du phishing !</GameButton>
      </div>
      <div v-else class="mt-4 rounded-xl border p-4" :class="correct ? 'border-emerald-300/40 bg-emerald-500/10' : 'border-rose-300/40 bg-rose-500/10'" role="status" aria-live="polite">
        <p class="mb-2 font-bold" :class="correct ? 'text-emerald-300' : 'text-rose-300'">
          {{ correct ? '✔ Bien joué !' : '✘ Raté !' }} C’était {{ msg.phishing ? 'un piège.' : 'un message légitime.' }}
        </p>
        <ul class="mb-3 list-disc space-y-1 pl-5 text-sm text-violet-100">
          <li v-for="(c, i) in msg.clues" :key="i">{{ c }}</li>
        </ul>
        <GameButton @click="next">{{ index >= COUNT - 1 ? 'Voir mon score' : 'Message suivant →' }}</GameButton>
      </div>
    </div>
  </GameShell>
</template>
