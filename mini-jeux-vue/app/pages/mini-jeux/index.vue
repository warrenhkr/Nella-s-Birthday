<script setup lang="ts">
import { computed, ref } from 'vue'
import { CATEGORY_LABELS, MINI_GAMES, type MiniGameCategory } from '../../data/mini-jeux'

useHead({ title: 'Mini-jeux' })

const filter = ref<MiniGameCategory | 'all'>('all')
const filters: { key: MiniGameCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'Tous (' + MINI_GAMES.length + ')' },
  ...(Object.keys(CATEGORY_LABELS) as MiniGameCategory[]).map((k) => ({
    key: k,
    label: CATEGORY_LABELS[k] + ' (' + MINI_GAMES.filter((g) => g.category === k).length + ')',
  })),
]
const games = computed(() => (filter.value === 'all' ? MINI_GAMES : MINI_GAMES.filter((g) => g.category === filter.value)))
const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n)
</script>

<template>
  <main class="mx-auto w-full max-w-5xl px-4 py-8 text-violet-100">
    <h1 class="mb-1 text-3xl font-extrabold tracking-tight text-white">Mini-jeux</h1>
    <p class="mb-6 text-violet-200">Des petits jeux pour passer un bon moment, seul ou à plusieurs. Choisis le tien !</p>

    <div class="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Catégories">
      <button
        v-for="f in filters"
        :key="f.key"
        type="button"
        role="tab"
        :aria-selected="filter === f.key"
        class="min-h-10 rounded-full border px-4 text-sm font-medium transition active:scale-95"
        :class="filter === f.key ? 'border-pink-300 bg-pink-500/30 text-white' : 'border-violet-300/30 bg-violet-900/30 text-violet-100 hover:bg-violet-800/40'"
        @click="filter = f.key"
      >
        {{ f.label }}
      </button>
    </div>

    <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="g in games" :key="g.slug">
        <NuxtLink
          :to="'/mini-jeux/' + g.slug"
          class="flex h-full flex-col rounded-2xl border border-violet-300/20 bg-gradient-to-b from-violet-900/50 to-violet-950/80 p-4 transition hover:-translate-y-0.5 hover:border-pink-300/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300"
        >
          <span class="mb-2 text-4xl" aria-hidden="true">{{ g.emoji }}</span>
          <span class="text-lg font-bold text-white">{{ g.title }}</span>
          <span class="mb-3 flex-1 text-sm text-violet-200">{{ g.description }}</span>
          <span class="flex items-center justify-between text-xs text-violet-300">
            <span>{{ CATEGORY_LABELS[g.category] }}</span>
            <span><span class="text-amber-300" :aria-label="'Difficulté ' + g.difficulty + ' sur 3'">{{ stars(g.difficulty) }}</span> · {{ g.duration }}</span>
          </span>
        </NuxtLink>
      </li>
    </ul>
  </main>
</template>
