<script lang="ts">
export type GamePhase = 'intro' | 'playing' | 'won' | 'lost'
export interface GameStat {
  label: string
  value: string | number
}
</script>

<script setup lang="ts">
import { ref, type Component } from 'vue'
import { CircleHelp, Lightbulb, Play, RotateCcw, Trophy } from '@lucide/vue'
import GameButton from './GameButton.vue'

/**
 * Cadre commun des mini-jeux : titre, règles, statistiques, écran d'intro, écran de fin et bouton « Rejouer ».
 * Le jeu garde son état et pilote `phase` ; le cadre affiche et émet `start` / `restart`.
 */
withDefaults(
  defineProps<{
    title: string
    rules: string[]
    phase: GamePhase
    icon?: Component
    resultTitle?: string
    resultText?: string
    stats?: GameStat[]
    best?: string | null
    introText?: string
  }>(),
  { icon: undefined, resultTitle: '', resultText: '', stats: () => [], best: null, introText: '' },
)

const emit = defineEmits<{ (e: 'start'): void; (e: 'restart'): void }>()
const showRules = ref(false)
</script>

<template>
  <section class="mx-auto w-full max-w-2xl text-slate-100" :aria-label="title">
    <header class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 class="flex items-center gap-2 text-xl font-bold tracking-tight text-white sm:text-2xl">
        <component :is="icon" v-if="icon" class="h-6 w-6 text-teal-300" aria-hidden="true" />
        {{ title }}
      </h2>
      <div v-if="phase !== 'intro'" class="flex gap-2">
        <GameButton variant="ghost" small :aria-expanded="showRules" @click="showRules = !showRules">
          <CircleHelp class="h-4 w-4" aria-hidden="true" /> {{ showRules ? 'Masquer' : 'Règles' }}
        </GameButton>
        <GameButton variant="ghost" small @click="emit('restart')"><RotateCcw class="h-4 w-4" aria-hidden="true" /> Rejouer</GameButton>
      </div>
    </header>

    <ul v-if="showRules && phase !== 'intro'" class="mb-3 list-disc space-y-1 rounded-xl border border-slate-700 bg-slate-900/80 p-4 pl-8 text-sm">
      <li v-for="(rule, i) in rules" :key="i">{{ rule }}</li>
    </ul>

    <div v-if="stats.length > 0 && phase !== 'intro'" class="mb-3 grid auto-cols-fr grid-flow-col gap-2 text-center">
      <div v-for="s in stats" :key="s.label" class="rounded-xl border border-slate-700/70 bg-slate-900/70 px-2 py-1.5">
        <div class="text-[0.65rem] uppercase tracking-wide text-slate-400">{{ s.label }}</div>
        <div class="text-lg font-bold tabular-nums text-white">{{ s.value }}</div>
      </div>
    </div>
    <p v-if="best && phase !== 'intro'" class="mb-3 flex items-center justify-center gap-1 text-xs text-amber-300">
      <Trophy class="h-3.5 w-3.5" aria-hidden="true" /> Record : {{ best }}
    </p>

    <div v-if="phase === 'intro'" class="rounded-2xl border border-slate-700 bg-gradient-to-b from-slate-800/70 to-slate-900/90 p-5 sm:p-7">
      <p v-if="introText" class="mb-3 text-slate-300">{{ introText }}</p>
      <h3 class="mb-2 text-sm font-semibold uppercase tracking-wide text-teal-300">Comment jouer</h3>
      <ul class="mb-5 list-disc space-y-1.5 pl-5 text-sm sm:text-base">
        <li v-for="(rule, i) in rules" :key="i">{{ rule }}</li>
      </ul>
      <slot name="intro-extra" />
      <div class="flex justify-center">
        <GameButton @click="emit('start')"><Play class="h-4 w-4" aria-hidden="true" /> Jouer</GameButton>
      </div>
    </div>

    <div v-else class="relative min-h-[16rem]">
      <slot />
      <div
        v-if="phase === 'won' || phase === 'lost'"
        class="absolute inset-0 z-20 flex items-start justify-center overflow-auto rounded-2xl bg-slate-950/85 p-4 backdrop-blur-sm sm:items-center"
        role="status"
        aria-live="polite"
      >
        <div class="w-full max-w-sm rounded-2xl border border-teal-400/30 bg-slate-900 p-5 text-center shadow-2xl">
          <div class="mb-2 flex justify-center">
            <Trophy v-if="phase === 'won'" class="h-10 w-10 text-amber-300" aria-hidden="true" />
            <Lightbulb v-else class="h-10 w-10 text-teal-300" aria-hidden="true" />
          </div>
          <h3 class="mb-1 text-xl font-bold text-white">{{ resultTitle || (phase === 'won' ? 'Bravo !' : 'Pas cette fois') }}</h3>
          <p v-if="resultText" class="mb-4 text-sm text-slate-300">{{ resultText }}</p>
          <slot name="end-extra" />
          <GameButton @click="emit('restart')"><RotateCcw class="h-4 w-4" aria-hidden="true" /> Rejouer</GameButton>
        </div>
      </div>
    </div>
  </section>
</template>
