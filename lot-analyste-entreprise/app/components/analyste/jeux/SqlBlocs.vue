<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight, Check, Database, Table2, Undo2, X } from '@lucide/vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import GameButton from '../GameButton.vue'
import { drawSql, isCorrect, type SqlDraw } from '../../../utils/analyste/sqlblocs'
import { makeRng } from '../../../utils/analyste/rng'
import { readBest, submitBest } from '../../../utils/analyste/storage'

const COUNT = 6
const WIN = 5

const rules = [
  'SQL est le langage qui sert à interroger une base de données. Une requête est écrite en blocs : SELECT (quoi), FROM (où), WHERE (quel filtre), GROUP BY (regrouper), ORDER BY (trier), LIMIT (combien).',
  'Une question d’analyse s’affiche avec les tables disponibles. Touche les blocs, dans l’ordre, pour construire la bonne requête.',
  'Certains blocs sont des pièges qui ne servent pas. Touche un bloc choisi pour le retirer.',
  COUNT + ' requêtes, ' + WIN + ' bonnes réponses pour gagner.',
]

const phase = ref<GamePhase>('intro')
const questions = ref<SqlDraw[]>([])
const index = ref(0)
const chosen = ref<string[]>([])
const validated = ref(false)
const score = ref(0)
const best = ref<number | null>(null)

const q = computed(() => questions.value[index.value])
const right = computed(() => validated.value && q.value !== undefined && isCorrect(chosen.value, q.value.answer))
const remaining = computed(() => (q.value ? q.value.pool.filter((b) => !chosen.value.includes(b)) : []))
const stats = computed(() => [{ label: 'Requête', value: Math.min(index.value + 1, COUNT) + '/' + COUNT }, { label: 'Réussies', value: score.value }])

function start() {
  questions.value = drawSql(COUNT, makeRng())
  index.value = 0
  score.value = 0
  chosen.value = []
  validated.value = false
  best.value = readBest('sql')
  phase.value = 'playing'
}

function add(b: string) {
  if (!validated.value) chosen.value = [...chosen.value, b]
}
function remove(i: number) {
  if (!validated.value) chosen.value = chosen.value.filter((_, k) => k !== i)
}
function check() {
  if (validated.value || chosen.value.length === 0 || !q.value) return
  validated.value = true
  if (isCorrect(chosen.value, q.value.answer)) score.value++
}
function next() {
  if (index.value >= COUNT - 1) {
    submitBest('sql', score.value, 'max')
    best.value = readBest('sql')
    phase.value = score.value >= WIN ? 'won' : 'lost'
    return
  }
  index.value++
  chosen.value = []
  validated.value = false
}

const resultText = computed(() => score.value + ' requête(s) correcte(s) sur ' + COUNT + '.')
</script>

<template>
  <GameShell
    title="SQL en blocs"
    :icon="Database"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :best="best !== null ? best + ' / ' + COUNT : null"
    :result-title="phase === 'won' ? 'Tu parles déjà SQL' : 'La syntaxe est exigeante'"
    :result-text="resultText"
    intro-text="Construis des requêtes de base de données comme on assemble des briques."
    @start="start"
    @restart="start"
  >
    <div v-if="q" class="mx-auto max-w-xl">
      <p class="mb-2 rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-lg leading-snug text-white">{{ q.prompt }}</p>
      <ul class="mb-3 space-y-1 text-xs text-slate-300" aria-label="Tables disponibles">
        <li v-for="t in q.schema" :key="t" class="flex items-center gap-2 font-mono"><Table2 class="h-4 w-4 text-teal-300" aria-hidden="true" />{{ t }}</li>
      </ul>
      <div class="mb-3 min-h-24 rounded-xl border border-dashed border-slate-600 bg-slate-950/70 p-3" aria-label="Ta requête" aria-live="polite">
        <p v-if="chosen.length === 0" class="text-sm text-slate-500">Touche les blocs ci-dessous pour écrire ta requête.</p>
        <ol class="space-y-1.5">
          <li v-for="(b, i) in chosen" :key="b + i">
            <button type="button" class="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border px-3 text-left font-mono text-xs sm:text-sm" :class="validated ? (q.answer[i] === b ? 'border-emerald-300 bg-emerald-500/20' : 'border-rose-300 bg-rose-500/20') : 'border-teal-400/60 bg-teal-500/15'" :disabled="validated" @click="remove(i)">
              <span>{{ b }}</span><Undo2 v-if="!validated" class="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <Check v-else-if="q.answer[i] === b" class="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" /><X v-else class="h-4 w-4 shrink-0 text-rose-300" aria-hidden="true" />
            </button>
          </li>
        </ol>
      </div>
      <ul class="flex flex-wrap gap-2" aria-label="Blocs disponibles">
        <li v-for="b in remaining" :key="b">
          <button type="button" class="min-h-10 rounded-lg border border-slate-600 bg-slate-800/80 px-3 font-mono text-xs text-slate-100 transition active:scale-95 sm:text-sm" :disabled="validated" @click="add(b)">{{ b }}</button>
        </li>
      </ul>
      <div v-if="!validated" class="mt-3 flex justify-center"><GameButton :disabled="chosen.length === 0" @click="check"><Check class="h-4 w-4" aria-hidden="true" /> Exécuter la requête</GameButton></div>
      <div v-else class="mt-3 rounded-xl border p-3" :class="right ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-rose-400/40 bg-rose-500/10'" role="status" aria-live="polite">
        <p class="mb-1 font-bold" :class="right ? 'text-emerald-300' : 'text-rose-300'">{{ right ? 'Requête correcte' : 'Requête incorrecte' }}</p>
        <pre v-if="!right" class="mb-2 overflow-x-auto rounded-lg bg-slate-950 p-2 font-mono text-xs text-emerald-200">{{ q.answer.join('\n') }}</pre>
        <p class="mb-3 text-sm text-slate-200">{{ q.why }}</p>
        <GameButton @click="next">{{ index >= COUNT - 1 ? 'Voir le résultat' : 'Suivante' }} <ArrowRight class="h-4 w-4" aria-hidden="true" /></GameButton>
      </div>
    </div>
  </GameShell>
</template>
