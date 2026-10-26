<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, ShieldAlert, Undo2 } from '@lucide/vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import GameButton from '../GameButton.vue'
import { drawRisks, level, scorePlacement, type Risk } from '../../../utils/analyste/riskmatrix'
import { makeRng } from '../../../utils/analyste/rng'
import { readBest, submitBest } from '../../../utils/analyste/storage'

const COUNT = 8
const MAX = COUNT * 2
const WIN = 11
const LEVEL_CLASS = { faible: 'bg-emerald-500/15 border-emerald-400/30', moyen: 'bg-amber-500/15 border-amber-400/30', eleve: 'bg-rose-500/20 border-rose-400/40' }
const P_LABEL = ['Rare', 'Possible', 'Fréquent']
const I_LABEL = ['Faible', 'Moyen', 'Fort']

const rules = [
  'Une matrice des risques classe chaque risque selon sa probabilité (de rare à fréquent, en colonnes) et son impact (de faible à fort, en lignes). Les risques en haut à droite sont à traiter en premier.',
  'Touche un risque dans la liste, puis touche la case où tu le places. Touche un risque posé pour le reprendre.',
  'Quand tous les risques sont placés, valide : 2 points par case exacte, 1 point si tu es à une case de la bonne.',
  'Il faut ' + WIN + ' points sur ' + MAX + '.',
]

const phase = ref<GamePhase>('intro')
const risks = ref<Risk[]>([])
const placements = ref<Record<number, { p: number; i: number } | undefined>>({})
const selected = ref<number | null>(null)
const validated = ref(false)
const total = ref(0)
const best = ref<number | null>(null)

const unplaced = computed(() => risks.value.filter((r) => !placements.value[r.id]))
const placedCount = computed(() => risks.value.length - unplaced.value.length)
const stats = computed(() => [{ label: 'Placés', value: placedCount.value + '/' + COUNT }, { label: 'Points', value: validated.value ? total.value : '?' }])
const cellRisks = (p: number, i: number) => risks.value.filter((r) => placements.value[r.id]?.p === p && placements.value[r.id]?.i === i)

function start() {
  risks.value = drawRisks(COUNT, makeRng())
  placements.value = {}
  selected.value = null
  validated.value = false
  total.value = 0
  best.value = readBest('risques')
  phase.value = 'playing'
}

function clickCell(p: number, i: number) {
  if (validated.value || selected.value === null) return
  placements.value = { ...placements.value, [selected.value]: { p, i } }
  selected.value = null
}

function take(id: number) {
  if (validated.value) return
  placements.value = { ...placements.value, [id]: undefined }
  selected.value = id
}

function validate() {
  if (validated.value || unplaced.value.length > 0) return
  validated.value = true
  total.value = risks.value.reduce((s, r) => s + scorePlacement(r, placements.value[r.id]!), 0)
}

function finish() {
  submitBest('risques', total.value, 'max')
  best.value = readBest('risques')
  phase.value = total.value >= WIN ? 'won' : 'lost'
}

const resultText = computed(() => total.value + ' points sur ' + MAX + '. Pour chaque risque, on croise « à quelle fréquence ? » et « avec quelles conséquences ? ».')
</script>

<template>
  <GameShell
    title="Matrice des risques"
    :icon="ShieldAlert"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :best="best !== null ? best + ' / ' + MAX : null"
    :result-title="phase === 'won' ? 'Tu sais prioriser les risques' : 'La priorisation, à affiner'"
    :result-text="resultText"
    intro-text="Quels risques surveiller en premier ? Classe-les selon leur probabilité et leur impact."
    @start="start"
    @restart="start"
  >
    <div class="mx-auto max-w-xl">
      <div class="grid grid-cols-[auto_repeat(3,minmax(0,1fr))] gap-1.5 text-xs" role="group" aria-label="Matrice : probabilité en colonnes, impact en lignes">
        <template v-for="i in [3, 2, 1]" :key="'row' + i">
          <div class="flex items-center justify-end pr-1 text-right text-slate-400">{{ I_LABEL[i - 1] }}</div>
          <button
            v-for="p in [1, 2, 3]"
            :key="p + '-' + i"
            type="button"
            class="min-h-20 rounded-lg border p-1 text-left align-top transition"
            :class="[LEVEL_CLASS[level(p, i)], selected !== null && !validated ? 'ring-1 ring-teal-300/60 hover:ring-2' : '']"
            :aria-label="'Probabilité ' + P_LABEL[p - 1] + ', impact ' + I_LABEL[i - 1]"
            @click="clickCell(p, i)"
          >
            <span v-for="r in cellRisks(p, i)" :key="r.id" class="mb-1 block rounded border px-1 py-0.5 text-[0.7rem] leading-tight" :class="validated ? (scorePlacement(r, placements[r.id]!) === 2 ? 'border-emerald-300 bg-emerald-500/30 text-white' : scorePlacement(r, placements[r.id]!) === 1 ? 'border-amber-300 bg-amber-500/30 text-white' : 'border-rose-300 bg-rose-500/30 text-white') : 'border-slate-400 bg-slate-800 text-white'" @click.stop="take(r.id)">{{ r.text }}</span>
          </button>
        </template>
        <div />
        <div v-for="p in [1, 2, 3]" :key="'col' + p" class="pt-1 text-center text-slate-400">{{ P_LABEL[p - 1] }}</div>
      </div>
      <p class="mt-1 text-center text-[0.7rem] text-slate-500">Probabilité →</p>

      <ul v-if="unplaced.length" class="mt-3 space-y-1.5" aria-label="Risques à placer">
        <li v-for="r in unplaced" :key="r.id">
          <button type="button" class="flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 text-left text-sm transition active:scale-[0.98]" :class="selected === r.id ? 'border-teal-300 bg-teal-500/20 text-white' : 'border-slate-600 bg-slate-800/70 text-slate-100'" :aria-pressed="selected === r.id" @click="selected = selected === r.id ? null : r.id">
            {{ r.text }}
          </button>
        </li>
      </ul>
      <div v-else-if="!validated" class="mt-3 flex flex-col items-center gap-2">
        <p class="flex items-center gap-1 text-sm text-slate-300"><Undo2 class="h-4 w-4" aria-hidden="true" /> Touche un risque posé pour le déplacer.</p>
        <GameButton @click="validate"><Check class="h-4 w-4" aria-hidden="true" /> Valider la matrice</GameButton>
      </div>
      <div v-if="validated" class="mt-3 flex flex-col items-center gap-2">
        <p class="text-center font-bold text-white" role="status">{{ total }} point(s) sur {{ MAX }}. Vert : case exacte, orange : à une case, rouge : loin.</p>
        <GameButton @click="finish">Voir le résultat</GameButton>
      </div>
      <div v-if="validated" class="mt-3 space-y-2 text-sm" aria-label="Correction">
        <div v-for="r in risks" :key="r.id" class="rounded-xl border border-slate-700 bg-slate-900/70 p-2">
          <p class="font-semibold text-white">{{ r.text }} <span class="font-normal text-slate-400">· bonne case : {{ P_LABEL[r.p - 1]!.toLowerCase() }}, impact {{ I_LABEL[r.i - 1]!.toLowerCase() }}</span></p>
          <p class="text-slate-300">{{ r.why }}</p>
        </div>
      </div>
    </div>
  </GameShell>
</template>
