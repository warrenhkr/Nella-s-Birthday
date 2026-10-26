<script setup lang="ts">
import { computed, ref } from 'vue'
import GameShell, { type GamePhase } from '../GameShell.vue'
import GameButton from '../GameButton.vue'
import { GATE_LABEL, GATE_LEVELS, evaluate, optionsFor, type GateType } from '../../../utils/games/gates'

const rules = [
  'Une lampe 💡 doit réagir à des interrupteurs (A, B, C) selon une règle donnée par le niveau.',
  'Chaque porte logique prend une ou deux entrées. ET : vrai si les deux entrées sont vraies. OU : vrai si au moins une est vraie. OU exclusif : vrai si une seule est vraie. NON-ET : le contraire de ET. NON : inverse l’entrée.',
  'Choisis le type de chaque porte. Le tableau vérifie tous les cas : quand toutes les lignes sont ✔, le niveau est gagné.',
  '6 niveaux, de plus en plus riches en portes.',
]

const phase = ref<GamePhase>('intro')
const levelIndex = ref(0)
const choice = ref<Record<string, GateType | undefined>>({})
const changes = ref(0)

const level = computed(() => GATE_LEVELS[levelIndex.value]!)
const rows = computed(() =>
  level.value.tests.map((t) => {
    const got = evaluate(level.value, choice.value, t.inputs)
    return { test: t, got, ok: got === t.expected }
  }),
)
const allOk = computed(() => rows.value.every((r) => r.ok))
const stats = computed(() => [
  { label: 'Niveau', value: levelIndex.value + 1 + '/' + GATE_LEVELS.length },
  { label: 'Changements', value: changes.value },
])

function start() {
  levelIndex.value = 0
  choice.value = {}
  changes.value = 0
  phase.value = 'playing'
}

function setGate(id: string, type: GateType) {
  choice.value = { ...choice.value, [id]: type }
  changes.value++
}

function nextLevel() {
  if (levelIndex.value >= GATE_LEVELS.length - 1) {
    phase.value = 'won'
    return
  }
  levelIndex.value++
  choice.value = {}
}

const lamp = (v: boolean | null) => (v === null ? '…' : v ? '💡' : '⚫')
const inputText = (t: Record<string, boolean>) => level.value.inputs.map((n) => n + ' ' + (t[n] ? '↑' : '↓')).join('  ')
const nameOf = (id: string) => (level.value.inputs.includes(id) ? 'interrupteur ' + id : 'sortie de la porte ' + id)
const resultText = 'Tu maîtrises les portes logiques : ce sont les briques de tous les processeurs.'
</script>

<template>
  <GameShell
    title="Portes logiques"
    :rules="rules"
    :phase="phase"
    :stats="stats"
    :result-text="resultText"
    intro-text="Assemble des portes logiques pour allumer la lampe au bon moment."
    @start="start"
    @restart="start"
  >
    <div class="mx-auto max-w-lg">
      <h3 class="text-lg font-bold text-white">{{ level.title }}</h3>
      <p class="mb-4 text-sm text-violet-200">{{ level.story }}</p>

      <ul class="mb-4 space-y-3">
        <li v-for="slot in level.slots" :key="slot.id" class="rounded-xl border border-violet-300/20 bg-violet-950/60 p-3">
          <p class="mb-2 text-sm text-violet-100">
            <strong class="text-white">Porte {{ slot.id }}</strong>
            <span v-if="slot.id === level.out" class="ml-2 rounded bg-pink-500/30 px-1.5 text-xs">vers la lampe</span>
            : entrée{{ slot.b !== undefined ? 's' : '' }} {{ nameOf(slot.a) }}{{ slot.b !== undefined ? ' et ' + nameOf(slot.b) : '' }}
          </p>
          <div class="flex flex-wrap gap-2" role="radiogroup" :aria-label="'Type de la porte ' + slot.id">
            <button
              v-for="type in optionsFor(slot)"
              :key="type"
              type="button"
              role="radio"
              :aria-checked="choice[slot.id] === type"
              class="min-h-10 rounded-lg border px-3 text-sm font-semibold transition active:scale-95"
              :class="choice[slot.id] === type ? 'border-pink-300 bg-pink-500/30 text-white' : 'border-violet-300/30 bg-violet-900/30 text-violet-100'"
              @click="setGate(slot.id, type)"
            >
              {{ GATE_LABEL[type] }}
            </button>
          </div>
        </li>
      </ul>

      <div class="overflow-hidden rounded-xl border border-violet-300/20">
        <table class="w-full text-center text-sm">
          <caption class="sr-only">Vérification de la lampe pour chaque combinaison</caption>
          <thead class="bg-violet-900/60 text-xs uppercase text-violet-200">
            <tr><th class="p-2">Interrupteurs</th><th class="p-2">Attendu</th><th class="p-2">Obtenu</th><th class="p-2">✔</th></tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in rows" :key="i" class="border-t border-violet-300/10" :class="r.ok ? 'bg-emerald-500/10' : ''">
              <td class="p-2 font-mono text-xs">{{ inputText(r.test.inputs) }}</td>
              <td class="p-2 text-lg">{{ lamp(r.test.expected) }}</td>
              <td class="p-2 text-lg">{{ lamp(r.got) }}</td>
              <td class="p-2">{{ r.ok ? '✔' : '✘' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="mt-4 flex justify-center">
        <GameButton :disabled="!allOk" @click="nextLevel">{{ allOk ? (levelIndex >= GATE_LEVELS.length - 1 ? 'Terminer 🎉' : 'Niveau suivant →') : 'Il reste des ✘' }}</GameButton>
      </div>
    </div>
  </GameShell>
</template>
