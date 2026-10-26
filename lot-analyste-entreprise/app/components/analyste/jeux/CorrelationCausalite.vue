<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight, Check, Dices, EyeOff, GitCompareArrows, Link2, X } from '@lucide/vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import GameButton from '../GameButton.vue'
import { LINK_LABEL, drawScenarios, type Link, type Scenario } from '../../../utils/analyste/correlation'
import { makeRng } from '../../../utils/analyste/rng'
import { readBest, submitBest } from '../../../utils/analyste/storage'

const COUNT = 8
const WIN = 6
const ICON = { cause: Link2, cache: EyeOff, hasard: Dices }
const KEYS: Link[] = ['cause', 'cache', 'hasard']

const rules = [
  'Deux chiffres qui évoluent ensemble sont « corrélés ». Cela ne veut pas dire que l’un provoque l’autre.',
  'Pour chaque situation, choisis l’explication la plus probable : un lien de cause à effet, un facteur caché qui agit sur les deux, ou une pure coïncidence.',
  'Astuce : demande-toi quel mécanisme réaliste pourrait relier les deux, et si un troisième élément agit sur les deux à la fois.',
  COUNT + ' situations, ' + WIN + ' bonnes réponses pour gagner.',
]

const phase = ref<GamePhase>('intro')
const scenarios = ref<Scenario[]>([])
const index = ref(0)
const chosen = ref<Link | null>(null)
const score = ref(0)
const best = ref<number | null>(null)

const s = computed(() => scenarios.value[index.value])
const right = computed(() => chosen.value !== null && chosen.value === s.value?.answer)
const stats = computed(() => [{ label: 'Situation', value: Math.min(index.value + 1, COUNT) + '/' + COUNT }, { label: 'Score', value: score.value }])

function start() {
  scenarios.value = drawScenarios(COUNT, makeRng())
  index.value = 0
  score.value = 0
  chosen.value = null
  best.value = readBest('correlation')
  phase.value = 'playing'
}

function choose(k: Link) {
  if (chosen.value !== null || !s.value) return
  chosen.value = k
  if (k === s.value.answer) score.value++
}

function next() {
  if (index.value >= COUNT - 1) {
    submitBest('correlation', score.value, 'max')
    best.value = readBest('correlation')
    phase.value = score.value >= WIN ? 'won' : 'lost'
    return
  }
  index.value++
  chosen.value = null
}

const resultText = computed(() => score.value + ' bonne(s) réponse(s) sur ' + COUNT + '. Corrélation n’est pas causalité : c’est la phrase à retenir.')
</script>

<template>
  <GameShell
    title="Corrélation ou causalité ?"
    :icon="GitCompareArrows"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :best="best !== null ? best + ' / ' + COUNT : null"
    :result-title="phase === 'won' ? 'Esprit critique de haut niveau' : 'Les corrélations t’ont piégé(e)'"
    :result-text="resultText"
    intro-text="Deux courbes se ressemblent : qu’est-ce qui explique vraiment le lien ?"
    @start="start"
    @restart="start"
  >
    <div v-if="s" class="mx-auto max-w-xl">
      <p class="mb-4 rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-lg leading-snug text-white">{{ s.text }}</p>
      <ul class="space-y-2">
        <li v-for="k in KEYS" :key="k">
          <button
            type="button"
            class="flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 py-2 text-left transition active:scale-[0.98]"
            :class="chosen === null ? 'border-slate-600 bg-slate-800/70 hover:bg-slate-700/70' : k === s.answer ? 'border-emerald-300 bg-emerald-500/20' : k === chosen ? 'border-rose-300 bg-rose-500/20' : 'border-slate-700 bg-slate-900/60 opacity-60'"
            :disabled="chosen !== null"
            @click="choose(k)"
          >
            <component :is="ICON[k]" class="h-5 w-5 shrink-0 text-teal-300" aria-hidden="true" />
            <span class="flex-1">{{ LINK_LABEL[k] }}</span>
            <Check v-if="chosen !== null && k === s.answer" class="h-5 w-5 text-emerald-300" aria-hidden="true" />
            <X v-else-if="chosen !== null && k === chosen" class="h-5 w-5 text-rose-300" aria-hidden="true" />
          </button>
        </li>
      </ul>
      <div v-if="chosen !== null" class="mt-3 rounded-xl border p-3" :class="right ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-rose-400/40 bg-rose-500/10'" role="status" aria-live="polite">
        <p class="mb-1 font-bold" :class="right ? 'text-emerald-300' : 'text-rose-300'">{{ right ? 'Bien vu' : 'Pas tout à fait : ' + LINK_LABEL[s.answer].toLowerCase() }}</p>
        <p class="mb-3 text-sm text-slate-200">{{ s.why }}</p>
        <GameButton @click="next">{{ index >= COUNT - 1 ? 'Voir le résultat' : 'Suivante' }} <ArrowRight class="h-4 w-4" aria-hidden="true" /></GameButton>
      </div>
    </div>
  </GameShell>
</template>
