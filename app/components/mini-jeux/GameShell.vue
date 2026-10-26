<script lang="ts">
</script>

<script setup lang="ts">
import { ref } from 'vue'
import GameButton from './GameButton.vue'

export type GamePhase = 'intro' | 'playing' | 'won' | 'lost'
export interface GameStat {
  label: string
  value: string | number
}

/**
 * Cadre commun de tous les mini-jeux : titre, règles, statistiques, écran d'intro,
 * écran de fin (victoire ou défaite) et bouton « Rejouer ».
 * Le jeu garde son état et pilote `phase` ; le cadre ne fait qu'afficher et émettre `start` / `restart`.
 */
withDefaults(
  defineProps<{
    title: string
    rules: string[]
    phase: GamePhase
    resultTitle?: string
    resultText?: string
    stats?: GameStat[]
    best?: string | null
    introText?: string
  }>(),
  { resultTitle: '', resultText: '', stats: () => [], best: null, introText: '' }
)

const emit = defineEmits<{ (e: 'start' | 'restart'): void }>()
const showRules = ref(false)
</script>

<template>
  <section
    class="mx-auto w-full max-w-2xl text-violet-100"
    :aria-label="title"
  >
    <header class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-xl font-bold tracking-tight text-white sm:text-2xl">
        {{ title }}
      </h2>
      <div class="flex gap-2">
        <GameButton
          v-if="phase !== 'intro'"
          variant="ghost"
          small
          @click="showRules = !showRules"
        >
          {{ showRules ? 'Masquer' : 'Règles' }}
        </GameButton>
        <GameButton
          v-if="phase !== 'intro'"
          variant="ghost"
          small
          @click="emit('restart')"
        >
          ↻ Rejouer
        </GameButton>
      </div>
    </header>

    <ul
      v-if="showRules && phase !== 'intro'"
      class="mb-3 list-disc space-y-1 rounded-xl border border-violet-300/20 bg-violet-950/60 p-4 pl-8 text-sm"
    >
      <li
        v-for="(rule, i) in rules"
        :key="i"
      >
        {{ rule }}
      </li>
    </ul>

    <div
      v-if="stats.length > 0 && phase !== 'intro'"
      class="mb-3 grid auto-cols-fr grid-flow-col gap-2 text-center"
    >
      <div
        v-for="s in stats"
        :key="s.label"
        class="rounded-xl border border-violet-300/15 bg-violet-950/50 px-2 py-1.5"
      >
        <div class="text-[0.65rem] uppercase tracking-wide text-violet-300">
          {{ s.label }}
        </div>
        <div class="text-lg font-bold tabular-nums text-white">
          {{ s.value }}
        </div>
      </div>
    </div>
    <p
      v-if="best && phase !== 'intro'"
      class="mb-3 text-center text-xs text-pink-200"
    >
      🏆 Record : {{ best }}
    </p>

    <!-- Écran d'intro : règles + bouton Jouer -->
    <div
      v-if="phase === 'intro'"
      class="rounded-2xl border border-violet-300/20 bg-gradient-to-b from-violet-900/50 to-violet-950/80 p-5 sm:p-7"
    >
      <p
        v-if="introText"
        class="mb-3 text-violet-200"
      >
        {{ introText }}
      </p>
      <h3 class="mb-2 text-sm font-semibold uppercase tracking-wide text-pink-200">
        Comment jouer
      </h3>
      <ul class="mb-5 list-disc space-y-1.5 pl-5 text-sm sm:text-base">
        <li
          v-for="(rule, i) in rules"
          :key="i"
        >
          {{ rule }}
        </li>
      </ul>
      <slot name="intro-extra" />
      <div class="flex justify-center">
        <GameButton @click="emit('start')">
          ▶ Jouer
        </GameButton>
      </div>
    </div>

    <!-- Plateau de jeu + écran de fin par-dessus -->
    <div
      v-else
      class="relative min-h-[16rem]"
    >
      <slot />
      <div
        v-if="phase === 'won' || phase === 'lost'"
        class="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-violet-950/85 p-4 backdrop-blur-sm"
        role="status"
        aria-live="polite"
      >
        <div class="max-h-full w-full max-w-sm overflow-auto rounded-2xl border border-pink-300/30 bg-violet-900/90 p-5 text-center shadow-2xl">
          <div
            class="mb-1 text-4xl"
            aria-hidden="true"
          >
            {{ phase === 'won' ? '🎉' : '💫' }}
          </div>
          <h3 class="mb-1 text-xl font-bold text-white">
            {{ resultTitle || (phase === 'won' ? 'Bravo !' : 'Perdu…') }}
          </h3>
          <p
            v-if="resultText"
            class="mb-4 text-sm text-violet-200"
          >
            {{ resultText }}
          </p>
          <slot name="end-extra" />
          <GameButton @click="emit('restart')">
            ↻ Rejouer
          </GameButton>
        </div>
      </div>
    </div>
  </section>
</template>
