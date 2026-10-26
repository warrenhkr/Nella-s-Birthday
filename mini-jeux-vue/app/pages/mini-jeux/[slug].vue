<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { MINI_GAMES, findMiniGame } from '../../data/mini-jeux'

const route = useRoute()
const slug = String(route.params.slug ?? '')
const game = findMiniGame(slug)
if (!game) throw createError({ statusCode: 404, statusMessage: 'Jeu introuvable', fatal: true })

useHead({ title: game.title + ' · Mini-jeux' })

const GameComponent = defineAsyncComponent(game.loader)
const position = MINI_GAMES.findIndex((g) => g.slug === slug)
const previous = computed(() => MINI_GAMES[(position - 1 + MINI_GAMES.length) % MINI_GAMES.length]!)
const next = computed(() => MINI_GAMES[(position + 1) % MINI_GAMES.length]!)
</script>

<template>
  <main class="mx-auto w-full max-w-3xl px-4 py-6 text-violet-100">
    <nav class="mb-4 flex items-center justify-between text-sm" aria-label="Navigation des jeux">
      <NuxtLink to="/mini-jeux" class="rounded-lg px-2 py-2 text-pink-200 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300">← Tous les jeux</NuxtLink>
      <span class="flex gap-3">
        <NuxtLink :to="'/mini-jeux/' + previous.slug" class="rounded-lg px-2 py-2 text-violet-200 hover:underline" :aria-label="'Jeu précédent : ' + previous.title">‹ Précédent</NuxtLink>
        <NuxtLink :to="'/mini-jeux/' + next.slug" class="rounded-lg px-2 py-2 text-violet-200 hover:underline" :aria-label="'Jeu suivant : ' + next.title">Suivant ›</NuxtLink>
      </span>
    </nav>
    <ClientOnly>
      <GameComponent :key="slug" />
      <template #fallback>
        <p class="py-16 text-center text-violet-300">Chargement du jeu…</p>
      </template>
    </ClientOnly>
  </main>
</template>
