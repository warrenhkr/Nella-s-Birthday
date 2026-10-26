<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight, Check, CircleHelp, Search, Wrench, X } from '@lucide/vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import GameButton from '../GameButton.vue'
import { drawRoot, type RootDraw } from '../../../utils/analyste/rootcause'
import { makeRng } from '../../../utils/analyste/rng'
import { readBest, submitBest } from '../../../utils/analyste/storage'

const WIN = 9

const rules = [
  'La méthode des « 5 pourquoi » consiste à demander « pourquoi ? » plusieurs fois de suite pour passer d’un symptôme à une cause racine, sur laquelle on peut agir.',
  'Pour chaque problème, choisis à chaque niveau l’explication qui remonte le mieux la chaîne.',
  'Méfie-toi des fausses pistes : accuser une personne, ou citer un fait qui ne permet aucune action.',
  '3 problèmes, 4 niveaux chacun : il faut ' + WIN + ' bonnes réponses sur 12.',
]

const phase = ref<GamePhase>('intro')
const draws = ref<RootDraw[]>([])
const sIndex = ref(0)
const level = ref(0)
const chosen = ref<string | null>(null)
const history = ref<string[]>([])
const done = ref(false)
const score = ref(0)
const best = ref<number | null>(null)

const draw = computed(() => draws.value[sIndex.value])
const scenario = computed(() => draw.value?.scenario)
const lv = computed(() => scenario.value?.levels[level.value])
const options = computed(() => draw.value?.options[level.value] ?? [])
const right = computed(() => chosen.value !== null && chosen.value === lv.value?.ok)
const stats = computed(() => [{ label: 'Problème', value: Math.min(sIndex.value + 1, 3) + '/3' }, { label: 'Niveau', value: Math.min(level.value + 1, 4) + '/4' }, { label: 'Score', value: score.value }])

function start() {
  draws.value = drawRoot(makeRng())
  sIndex.value = 0
  level.value = 0
  chosen.value = null
  history.value = []
  done.value = false
  score.value = 0
  best.value = readBest('pourquoi')
  phase.value = 'playing'
}

function choose(o: string) {
  if (chosen.value !== null || !lv.value) return
  chosen.value = o
  if (o === lv.value.ok) score.value++
}

function next() {
  if (!scenario.value || !lv.value) return
  history.value = [...history.value, lv.value.ok]
  if (level.value < 3) {
    level.value++
    chosen.value = null
    return
  }
  if (!done.value) {
    done.value = true
    return
  }
  if (sIndex.value >= draws.value.length - 1) {
    submitBest('pourquoi', score.value, 'max')
    best.value = readBest('pourquoi')
    phase.value = score.value >= WIN ? 'won' : 'lost'
    return
  }
  sIndex.value++
  level.value = 0
  chosen.value = null
  history.value = []
  done.value = false
}

const resultText = computed(() => score.value + ' bonne(s) réponse(s) sur 12.')
</script>

<template>
  <GameShell
    title="Les 5 pourquoi"
    :icon="Search"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :best="best !== null ? best + ' / 12' : null"
    :result-title="phase === 'won' ? 'Tu vas jusqu’à la cause racine' : 'Tu t’es arrêté(e) en chemin'"
    :result-text="resultText"
    intro-text="Un problème visible a presque toujours une cause cachée. Remonte la chaîne."
    @start="start"
    @restart="start"
  >
    <div v-if="scenario && lv" class="mx-auto max-w-xl">
      <p class="mb-1 text-sm font-semibold text-teal-300">{{ scenario.title }}</p>
      <p class="mb-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-white">{{ scenario.problem }}</p>
      <ol v-if="history.length" class="mb-3 space-y-1 border-l-2 border-teal-500/50 pl-3 text-sm text-slate-300">
        <li v-for="(h, i) in history" :key="i" class="flex items-start gap-2"><Check class="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />{{ h }}</li>
      </ol>
      <template v-if="!done">
        <p class="mb-2 flex items-center gap-2 text-lg font-semibold text-white"><CircleHelp class="h-5 w-5 text-teal-300" aria-hidden="true" />{{ lv.question }}</p>
        <ul class="space-y-2">
          <li v-for="o in options" :key="o">
            <button
              type="button"
              class="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-4 py-2 text-left text-sm transition active:scale-[0.98]"
              :class="chosen === null ? 'border-slate-600 bg-slate-800/70 hover:bg-slate-700/70' : o === lv.ok ? 'border-emerald-300 bg-emerald-500/20' : o === chosen ? 'border-rose-300 bg-rose-500/20' : 'border-slate-700 bg-slate-900/60 opacity-60'"
              :disabled="chosen !== null"
              @click="choose(o)"
            >
              <span>{{ o }}</span>
              <Check v-if="chosen !== null && o === lv.ok" class="h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" />
              <X v-else-if="chosen !== null && o === chosen" class="h-5 w-5 shrink-0 text-rose-300" aria-hidden="true" />
            </button>
          </li>
        </ul>
        <div v-if="chosen !== null" class="mt-3 rounded-xl border p-3" :class="right ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-rose-400/40 bg-rose-500/10'" role="status" aria-live="polite">
          <p class="mb-1 font-bold" :class="right ? 'text-emerald-300' : 'text-rose-300'">{{ right ? 'Bonne piste' : 'Fausse piste' }}</p>
          <p class="mb-3 text-sm text-slate-200">{{ lv.why }}</p>
          <GameButton @click="next">{{ level >= 3 ? 'Voir la cause racine' : 'Pourquoi suivant' }} <ArrowRight class="h-4 w-4" aria-hidden="true" /></GameButton>
        </div>
      </template>
      <div v-else class="rounded-xl border border-teal-400/40 bg-teal-500/10 p-4" role="status" aria-live="polite">
        <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-teal-300">Cause racine</p>
        <p class="mb-3 text-lg font-bold text-white">{{ scenario.root }}</p>
        <p class="mb-3 flex items-start gap-2 text-sm text-slate-200"><Wrench class="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />{{ scenario.action }}</p>
        <GameButton @click="next">{{ sIndex >= draws.length - 1 ? 'Voir le résultat' : 'Problème suivant' }} <ArrowRight class="h-4 w-4" aria-hidden="true" /></GameButton>
      </div>
    </div>
  </GameShell>
</template>
