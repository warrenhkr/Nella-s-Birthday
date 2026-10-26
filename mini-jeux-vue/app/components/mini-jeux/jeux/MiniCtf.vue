<script setup lang="ts">
import { computed, ref } from 'vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import GameButton from '../GameButton.vue'
import { CHALLENGES, binaryToText, caesar, checkFlag, fromBase64 } from '../../../utils/games/ctf'
import { readBest, submitBest } from '../../../utils/games/storage'
import { formatTime } from '../../../utils/games/format'
import { useStopwatch } from '../../../utils/games/useStopwatch'

type Tab = 'base64' | 'caesar' | 'binary'
const TABS: { key: Tab; label: string }[] = [
  { key: 'base64', label: 'Base64' },
  { key: 'caesar', label: 'César' },
  { key: 'binary', label: 'Binaire' },
]

const rules = [
  'Un CTF (« Capture The Flag ») est un jeu de piratage éthique : on cherche des drapeaux cachés, au format FLAG{…}.',
  '5 défis très accessibles. Les 4 premiers cachent un drapeau, le dernier te demande de les assembler.',
  'Une boîte à outils (Base64, César, binaire) t’aide à décoder. Tape le drapeau trouvé et valide.',
  'Les indices sont gratuits, mais comptés. Tout se passe dans ton navigateur : rien n’est piraté, tout est inventé pour jouer.',
]

const phase = ref<GamePhase>('intro')
const index = ref(0)
const solved = ref<boolean[]>([])
const answer = ref('')
const message = ref('')
const hintsUsed = ref(0)
const hintShown = ref(false)
const tab = ref<Tab>('base64')
const toolInput = ref('')
const shift = ref(0)
const showSource = ref(false)
const best = ref<number | null>(null)
const finalMs = ref(0)
const { elapsed, start: startClock, stop: stopClock } = useStopwatch()

const challenge = computed(() => CHALLENGES[index.value]!)
const output = computed(() => {
  const text = toolInput.value
  if (text.trim() === '') return ''
  if (tab.value === 'base64') return fromBase64(text) ?? '⚠ Ce n’est pas du base64 valide.'
  if (tab.value === 'binary') return binaryToText(text) ?? '⚠ Ce n’est pas du binaire valide (groupes de 8 chiffres 0 ou 1).'
  return caesar(text, shift.value)
})
const foundFlags = computed(() => CHALLENGES.slice(0, 4).filter((_, i) => solved.value[i]).map((c) => c.flag))
const stats = computed(() => [
  { label: 'Défi', value: Math.min(index.value + 1, CHALLENGES.length) + '/' + CHALLENGES.length },
  { label: 'Indices', value: hintsUsed.value },
  { label: 'Temps', value: formatTime(elapsed.value) },
])

function resetChallengeState() {
  answer.value = ''
  message.value = ''
  hintShown.value = false
  showSource.value = false
  toolInput.value = ''
  shift.value = 0
}

function start() {
  index.value = 0
  solved.value = new Array(CHALLENGES.length).fill(false)
  hintsUsed.value = 0
  best.value = readBest('ctf')
  resetChallengeState()
  phase.value = 'playing'
  startClock()
}

function validate() {
  if (phase.value !== 'playing') return
  if (!checkFlag(challenge.value, answer.value)) {
    message.value = 'Ce n’est pas le bon drapeau. Vérifie les accolades et les lettres, ou demande un indice.'
    return
  }
  solved.value = solved.value.map((v, i) => v || i === index.value)
  if (index.value >= CHALLENGES.length - 1) {
    finalMs.value = stopClock()
    submitBest('ctf', Math.round(finalMs.value), 'min')
    best.value = readBest('ctf')
    phase.value = 'won'
    return
  }
  message.value = '✔ Drapeau validé !'
  index.value++
  const keep = message.value
  resetChallengeState()
  message.value = keep
}

function showHint() {
  if (!hintShown.value) hintsUsed.value++
  hintShown.value = true
}

const resultText = computed(() => 'Les 5 défis résolus en ' + formatTime(finalMs.value) + ' avec ' + hintsUsed.value + ' indice(s). Tu viens de faire du vrai CTF !')
</script>

<template>
  <GameShell
    title="Mini CTF"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :best="best !== null ? formatTime(best) : null"
    result-title="Tous les drapeaux capturés !"
    :result-text="resultText"
    intro-text="Ton premier concours de piratage éthique, version très accessible."
    @start="start"
    @restart="start"
  >
    <div class="mx-auto max-w-lg">
      <ol class="mb-3 flex justify-center gap-2" aria-label="Progression">
        <li
          v-for="(c, i) in CHALLENGES"
          :key="c.id"
          class="flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold"
          :class="solved[i] ? 'border-emerald-300 bg-emerald-500/30 text-white' : i === index ? 'border-pink-300 bg-pink-500/30 text-white' : 'border-violet-300/30 text-violet-300'"
          :aria-current="i === index ? 'step' : undefined"
        >
          {{ solved[i] ? '✔' : i + 1 }}
        </li>
      </ol>

      <h3 class="text-lg font-bold text-white">Défi {{ challenge.id }} · {{ challenge.title }}</h3>
      <p class="mb-3 text-sm text-violet-200">{{ challenge.story }}</p>

      <div v-if="challenge.tool === 'source'" class="mb-3 rounded-xl border border-violet-300/20 bg-slate-950 p-3">
        <p v-if="!showSource" class="text-sm text-violet-100"><strong class="text-white">Bienvenue sur la page de la fête</strong><br />Rien à voir ici…</p>
        <pre v-else class="overflow-x-auto font-mono text-xs text-emerald-200">{{ challenge.material }}</pre>
        <GameButton class="mt-3" variant="ghost" small @click="showSource = !showSource">{{ showSource ? 'Revenir à la page' : '🔍 Voir le code source' }}</GameButton>
      </div>
      <div v-else-if="challenge.tool !== 'none'" class="mb-3 rounded-xl border border-violet-300/20 bg-slate-950 p-3">
        <p class="mb-1 text-xs uppercase tracking-wide text-violet-400">Message intercepté</p>
        <p class="break-all font-mono text-sm text-emerald-200">{{ challenge.material }}</p>
        <GameButton class="mt-2" variant="ghost" small @click="toolInput = challenge.material">📋 Copier dans la boîte à outils</GameButton>
      </div>
      <div v-else class="mb-3 rounded-xl border border-violet-300/20 bg-slate-950 p-3 text-sm text-violet-100">
        <p class="mb-1 text-xs uppercase tracking-wide text-violet-400">Drapeaux déjà capturés</p>
        <ul class="font-mono text-emerald-200"><li v-for="f in foundFlags" :key="f">{{ f }}</li></ul>
        <p class="mt-2 text-violet-200">{{ challenge.material }}</p>
      </div>

      <div v-if="challenge.tool !== 'none'" class="mb-3 rounded-xl border border-violet-300/20 bg-violet-950/60 p-3">
        <div class="mb-2 flex gap-2" role="tablist" aria-label="Boîte à outils">
          <button
            v-for="t in TABS"
            :key="t.key"
            type="button"
            role="tab"
            :aria-selected="tab === t.key"
            class="min-h-9 rounded-lg border px-3 text-sm font-semibold"
            :class="tab === t.key ? 'border-pink-300 bg-pink-500/30 text-white' : 'border-violet-300/30 text-violet-200'"
            @click="tab = t.key"
          >
            {{ t.label }}
          </button>
        </div>
        <label class="sr-only" for="ctf-outil">Texte à décoder</label>
        <textarea id="ctf-outil" v-model="toolInput" rows="2" class="w-full rounded-lg border border-violet-300/30 bg-slate-950 p-2 font-mono text-xs text-white focus:border-pink-300 focus:outline-none" placeholder="Colle ici le texte à décoder" />
        <div v-if="tab === 'caesar'" class="my-2 flex items-center gap-3 text-sm text-violet-100">
          <label for="ctf-shift">Décalage : {{ shift > 0 ? '+' : '' }}{{ shift }}</label>
          <input id="ctf-shift" v-model.number="shift" type="range" min="-25" max="25" class="h-8 flex-1 accent-pink-400" />
        </div>
        <p class="mt-2 text-xs uppercase tracking-wide text-violet-400">Résultat</p>
        <p class="min-h-6 break-all font-mono text-sm text-amber-200" aria-live="polite">{{ output }}</p>
      </div>

      <div class="flex gap-2">
        <label class="sr-only" for="ctf-reponse">Ton drapeau</label>
        <input
          id="ctf-reponse"
          v-model="answer"
          type="text"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          class="min-h-11 w-full rounded-xl border border-violet-300/30 bg-violet-950 px-3 font-mono text-white placeholder-violet-400 focus:border-pink-300 focus:outline-none"
          placeholder="FLAG{…}"
          @keydown.enter.prevent="validate"
        />
        <GameButton @click="validate">Valider</GameButton>
      </div>
      <p v-if="message" class="mt-2 text-sm" :class="message.startsWith('✔') ? 'text-emerald-300' : 'text-amber-200'" role="status">{{ message }}</p>
      <div class="mt-3">
        <GameButton variant="ghost" small @click="showHint">💡 Indice</GameButton>
        <p v-if="hintShown" class="mt-2 rounded-xl bg-violet-900/60 p-3 text-sm text-violet-100">{{ challenge.hint }}</p>
      </div>
    </div>
  </GameShell>
</template>
