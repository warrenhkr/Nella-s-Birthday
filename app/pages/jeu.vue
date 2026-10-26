<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import GameMenu from '../components/GameMenu.vue'
import GameShell from '../components/GameShell.vue'
import MemoryGame from '../components/games/MemoryGame.vue'
import TerminalPuzzle from '../components/games/TerminalPuzzle.vue'
import LoveQuiz from '../components/games/LoveQuiz.vue'
import HeartTap from '../components/games/HeartTap.vue'
import ConstellationStudio from '../components/games/ConstellationStudio.vue'
import OrbitLanding from '../components/games/OrbitLanding.vue'
import CyberSecurityQuiz, { type CyberGameId } from '../components/games/CyberSecurityQuiz.vue'
import { games } from '../data/games'
import { findMiniGame, MINI_GAMES } from '../data/mini-jeux'
import { ANALYSTE_GAMES, findAnalysteGame } from '../../lot-analyste-entreprise/app/data/analyste-jeux'

const route = useRoute()
const selectedGameId = computed(() => String(route.query.game ?? ''))
const selectedGame = computed(() => games.find(game => game.id === selectedGameId.value) ?? null)
const selectedMiniGame = computed(() => findMiniGame(selectedGameId.value) ?? null)
const selectedAnalysteGame = computed(() => findAnalysteGame(selectedGameId.value) ?? null)
const gameSequence = [
  ...games.map(game => ({ id: game.id, title: game.title })),
  ...MINI_GAMES.map(game => ({ id: game.slug, title: game.title })),
  ...ANALYSTE_GAMES.map(game => ({ id: game.slug, title: game.title }))
]
const selectedGameIndex = computed(() => gameSequence.findIndex(game => game.id === selectedGameId.value))
const previousGame = computed(() => gameSequence[(selectedGameIndex.value - 1 + gameSequence.length) % gameSequence.length]!)
const nextGame = computed(() => gameSequence[(selectedGameIndex.value + 1) % gameSequence.length]!)
const miniGameComponent = computed(() => {
  const game = selectedMiniGame.value
  return game ? defineAsyncComponent(game.loader) : null
})
const analysteGameComponent = computed(() => {
  const game = selectedAnalysteGame.value
  return game ? defineAsyncComponent(game.loader) : null
})
const cyberGameIds: CyberGameId[] = ['phishing-detective', 'password-lab', 'cipher-breaker']
const selectedCyberGameId = computed(() => cyberGameIds.find(id => id === selectedGame.value?.id) ?? null)
const gameScore = ref(0)

useHead({
  title: computed(() => selectedGame.value?.title ?? selectedMiniGame.value?.title ?? selectedAnalysteGame.value?.title ?? 'Jeux')
})

function resetSelection() {
  gameScore.value = 0
  navigateTo('/jeu')
}

function selectGame(id: string) {
  gameScore.value = 0
  navigateTo(`/jeu?game=${encodeURIComponent(id)}`)
}
</script>

<template>
  <main class="theme-page min-h-dvh px-4 py-8 sm:px-6 lg:px-8" :class="{ 'analyst-page': selectedAnalysteGame || route.query.categorie === 'analyste' }">
    <div class="mx-auto max-w-6xl">
      <header class="mb-8">
        <NuxtLink
          to="/anniversaire"
          class="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-pink-100 transition hover:bg-white/10"
        >
          <UIcon
            name="i-lucide-arrow-left"
            class="h-4 w-4"
          />
          Retour à l’anniversaire
        </NuxtLink>

        <p class="mb-2 text-xs uppercase tracking-[0.32em] text-pink-200/80">
          Jeux
        </p>
        <h1 class="text-3xl font-semibold text-pink-100 sm:text-4xl">
          Petits défis de cœur
        </h1>
      </header>

      <div v-if="!selectedGame && !selectedMiniGame && !selectedAnalysteGame">
        <GameMenu />
      </div>

      <div v-else>
        <nav
          class="mb-5 flex items-center justify-between gap-3"
          aria-label="Navigation entre les jeux"
        >
          <NuxtLink
            to="/jeu"
            class="rounded-lg px-2 py-2 text-sm text-pink-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300"
          >
            ← Tous les jeux
          </NuxtLink>
          <span class="flex gap-2">
            <button
              type="button"
              class="rounded-lg px-2 py-2 text-sm text-pink-100 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300"
              :aria-label="'Jeu précédent : ' + previousGame.title"
              @click="selectGame(previousGame.id)"
            >
              ‹ Précédent
            </button>
            <button
              type="button"
              class="rounded-lg px-2 py-2 text-sm text-pink-100 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300"
              :aria-label="'Jeu suivant : ' + nextGame.title"
              @click="selectGame(nextGame.id)"
            >
              Suivant ›
            </button>
          </span>
        </nav>

        <GameShell
          v-if="selectedGame"
          :key="selectedGame.id"
          :title="selectedGame.title"
          :subtitle="selectedGame.description"
          :score="gameScore"
          :show-score="true"
          @back="resetSelection"
          @replay="resetSelection"
        >
          <MemoryGame v-if="selectedGame.id === 'memory-game'" />
          <TerminalPuzzle v-else-if="selectedGame.id === 'terminal-puzzle'" />
          <LoveQuiz v-else-if="selectedGame.id === 'love-quiz'" />
          <HeartTap v-else-if="selectedGame.id === 'heart-tap'" />
          <ConstellationStudio v-else-if="selectedGame.id === 'constellation-studio'" />
          <OrbitLanding v-else-if="selectedGame.id === 'orbit-landing'" />
          <CyberSecurityQuiz
            v-else-if="selectedCyberGameId"
            :game-id="selectedCyberGameId"
            @score="gameScore = $event"
          />
        </GameShell>

        <ClientOnly v-else-if="selectedMiniGame">
          <component
            :is="miniGameComponent"
            :key="selectedMiniGame.slug"
          />
          <template #fallback>
            <p class="py-16 text-center text-violet-300">
              Chargement du jeu…
            </p>
          </template>
        </ClientOnly>

        <ClientOnly v-else-if="selectedAnalysteGame">
          <component
            :is="analysteGameComponent"
            :key="selectedAnalysteGame.slug"
          />
          <template #fallback>
            <p class="py-16 text-center text-pink-200">Chargement du jeu…</p>
          </template>
        </ClientOnly>
      </div>
    </div>
  </main>
</template>
