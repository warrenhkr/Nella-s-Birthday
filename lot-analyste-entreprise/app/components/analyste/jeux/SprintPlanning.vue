<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight, Check, ListChecks, Plus } from '@lucide/vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import GameButton from '../GameButton.vue'
import { knapsack, makeBacklog, type Backlog } from '../../../utils/analyste/sprint'
import { makeRng, type Rng } from '../../../utils/analyste/rng'
import { readBest, submitBest } from '../../../utils/analyste/storage'

const ROUNDS = 3
const WIN_PCT = 90

const rules = [
  'Une équipe a une capacité limitée par sprint, mesurée en jours de travail. Chaque fonctionnalité demande un certain nombre de jours (coût) et apporte une certaine valeur pour les utilisateurs.',
  'Choisis les fonctionnalités à réaliser : le total des jours ne peut pas dépasser la capacité.',
  'Ton score est la valeur obtenue divisée par la meilleure valeur possible. Les plus chères ne sont pas forcément les plus rentables : compare valeur et coût.',
  ROUNDS + ' sprints. Il faut atteindre en moyenne ' + WIN_PCT + ' % de la valeur maximale.',
]

const phase = ref<GamePhase>('intro')
const backlogs = ref<Backlog[]>([])
const index = ref(0)
const picked = ref<Set<number>>(new Set())
const validated = ref(false)
const percents = ref<number[]>([])
const best = ref<number | null>(null)
let rng: Rng = makeRng()

const backlog = computed(() => backlogs.value[index.value])
const usedDays = computed(() => [...picked.value].reduce((s, id) => s + backlog.value!.features[id]!.cost, 0))
const gotValue = computed(() => [...picked.value].reduce((s, id) => s + backlog.value!.features[id]!.value, 0))
const pct = computed(() => (backlog.value ? Math.round((100 * gotValue.value) / backlog.value.optimum) : 0))
const optimal = computed(() => (backlog.value ? new Set(knapsack(backlog.value.features, backlog.value.capacity).chosen) : new Set<number>()))
const average = computed(() => (percents.value.length ? Math.round(percents.value.reduce((s, v) => s + v, 0) / percents.value.length) : 0))
const stats = computed(() => [{ label: 'Sprint', value: Math.min(index.value + 1, ROUNDS) + '/' + ROUNDS }, { label: 'Jours', value: usedDays.value + '/' + (backlog.value?.capacity ?? 0) }, { label: 'Valeur', value: gotValue.value }])

function start() {
  rng = makeRng()
  backlogs.value = Array.from({ length: ROUNDS }, () => makeBacklog(8, rng))
  index.value = 0
  picked.value = new Set()
  validated.value = false
  percents.value = []
  best.value = readBest('sprint')
  phase.value = 'playing'
}

function toggle(id: number) {
  if (validated.value || !backlog.value) return
  const next = new Set(picked.value)
  if (next.has(id)) next.delete(id)
  else if (usedDays.value + backlog.value.features[id]!.cost <= backlog.value.capacity) next.add(id)
  picked.value = next
}

function validate() {
  if (validated.value) return
  validated.value = true
  percents.value = [...percents.value, pct.value]
}

function next() {
  if (index.value >= ROUNDS - 1) {
    submitBest('sprint', average.value, 'max')
    best.value = readBest('sprint')
    phase.value = average.value >= WIN_PCT ? 'won' : 'lost'
    return
  }
  index.value++
  picked.value = new Set()
  validated.value = false
}

const resultText = computed(() => 'Valeur moyenne obtenue : ' + average.value + ' % du maximum possible (objectif : ' + WIN_PCT + ' %).')
</script>

<template>
  <GameShell
    title="Sprint planning"
    :icon="ListChecks"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :best="best !== null ? best + ' %' : null"
    :result-title="phase === 'won' ? 'Backlog parfaitement priorisé' : 'Le sprint pouvait rapporter plus'"
    :result-text="resultText"
    intro-text="Choisis les bonnes fonctionnalités avec un temps limité : c’est le quotidien d’un analyste métier."
    @start="start"
    @restart="start"
  >
    <div v-if="backlog" class="mx-auto max-w-xl">
      <div class="mb-3 h-3 overflow-hidden rounded-full bg-slate-800" role="progressbar" :aria-valuenow="usedDays" aria-valuemin="0" :aria-valuemax="backlog.capacity" aria-label="Capacité utilisée">
        <div class="h-full rounded-full bg-teal-400 transition-all" :style="{ width: (100 * usedDays) / backlog.capacity + '%' }" />
      </div>
      <ul class="space-y-2" aria-label="Fonctionnalités du backlog">
        <li v-for="f in backlog.features" :key="f.id">
          <button
            type="button"
            class="flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition active:scale-[0.98]"
            :class="validated ? (picked.has(f.id) && optimal.has(f.id) ? 'border-emerald-300 bg-emerald-500/20' : picked.has(f.id) ? 'border-amber-300 bg-amber-500/15' : optimal.has(f.id) ? 'border-sky-300 border-dashed bg-sky-500/10' : 'border-slate-700 bg-slate-900/60 opacity-60') : picked.has(f.id) ? 'border-teal-300 bg-teal-500/20' : 'border-slate-700 bg-slate-900/70 hover:bg-slate-800'"
            :aria-pressed="picked.has(f.id)"
            :disabled="validated || (!picked.has(f.id) && usedDays + f.cost > backlog.capacity)"
            @click="toggle(f.id)"
          >
            <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-500">
              <Check v-if="picked.has(f.id)" class="h-4 w-4 text-teal-300" aria-hidden="true" /><Plus v-else class="h-4 w-4 text-slate-400" aria-hidden="true" />
            </span>
            <span class="flex-1 text-slate-100">{{ f.name }}</span>
            <span class="text-xs tabular-nums text-slate-300">{{ f.cost }} j · valeur {{ f.value }}</span>
          </button>
        </li>
      </ul>
      <div v-if="!validated" class="mt-3 flex justify-center"><GameButton :disabled="picked.size === 0" @click="validate"><Check class="h-4 w-4" aria-hidden="true" /> Lancer le sprint</GameButton></div>
      <div v-else class="mt-3 rounded-xl border border-slate-700 bg-slate-900/80 p-3 text-center" role="status" aria-live="polite">
        <p class="font-bold" :class="pct >= WIN_PCT ? 'text-emerald-300' : 'text-amber-300'">Valeur obtenue : {{ gotValue }} sur {{ backlog.optimum }} possible ({{ pct }} %)</p>
        <p class="my-2 flex flex-wrap items-center justify-center gap-x-3 text-xs text-slate-300">
          <span class="inline-flex items-center gap-1"><span class="inline-block h-3 w-3 rounded bg-emerald-500/60" />bon choix</span>
          <span class="inline-flex items-center gap-1"><span class="inline-block h-3 w-3 rounded bg-amber-500/60" />choix discutable</span>
          <span class="inline-flex items-center gap-1"><span class="inline-block h-3 w-3 rounded border border-dashed border-sky-300" />à prendre</span>
        </p>
        <GameButton @click="next">{{ index >= ROUNDS - 1 ? 'Voir le résultat' : 'Sprint suivant' }} <ArrowRight class="h-4 w-4" aria-hidden="true" /></GameButton>
      </div>
    </div>
  </GameShell>
</template>
