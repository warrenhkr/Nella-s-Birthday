<script setup lang="ts">
import { computed, ref } from 'vue'
import { Banknote, BookOpen, ChartColumn, Database, ListTodo, Search, Users, X } from '@lucide/vue'
import { CATEGORY_LABEL, TERMS, type GlossaryCategory } from '../../utils/analyste/glossaire'

useHead({ title: 'Glossaire de l’analyste' })

const ICONS = { finance: Banknote, donnees: Database, client: Users, projet: ListTodo, stats: ChartColumn }
const query = ref('')
const category = ref<GlossaryCategory | 'all'>('all')

const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const sorted = TERMS.slice().sort((a, b) => a.term.localeCompare(b.term, 'fr'))
const results = computed(() => {
  const q = normalize(query.value.trim())
  return sorted.filter((t) => (category.value === 'all' || t.category === category.value) && (!q || normalize(t.term + ' ' + t.definition).includes(q)))
})
const filters = computed(() => [
  { key: 'all' as const, label: 'Tous (' + TERMS.length + ')' },
  ...(Object.keys(CATEGORY_LABEL) as GlossaryCategory[]).map((k) => ({ key: k, label: CATEGORY_LABEL[k] + ' (' + TERMS.filter((t) => t.category === k).length + ')' })),
])
</script>

<template>
  <main class="theme-page analyst-page min-h-dvh mx-auto w-full max-w-4xl px-4 py-8 text-slate-100">
    <h1 class="mb-1 flex items-center gap-3 text-3xl font-extrabold tracking-tight text-white"><BookOpen class="h-8 w-8 text-teal-300" aria-hidden="true" />Glossaire de l’analyste</h1>
    <p class="mb-5 max-w-2xl text-slate-300">Les mots du métier, expliqués simplement, chacun avec un exemple.</p>

    <div class="relative mb-4">
      <Search class="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <label for="glossaire-recherche" class="sr-only">Rechercher un terme</label>
      <input id="glossaire-recherche" v-model="query" type="search" placeholder="Rechercher : marge, SQL, churn…" class="min-h-12 w-full rounded-xl border border-slate-600 bg-slate-900 pl-11 pr-11 text-white placeholder-slate-500 focus:border-teal-300 focus:outline-none" />
      <button v-if="query" type="button" class="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800" aria-label="Effacer la recherche" @click="query = ''"><X class="h-4 w-4" aria-hidden="true" /></button>
    </div>
    <div class="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Catégories">
      <button v-for="f in filters" :key="f.key" type="button" role="tab" :aria-selected="category === f.key" class="min-h-10 rounded-full border px-4 text-sm font-medium transition active:scale-95" :class="category === f.key ? 'border-teal-300 bg-teal-400/20 text-white' : 'border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800'" @click="category = f.key">{{ f.label }}</button>
    </div>

    <p class="mb-3 text-sm text-slate-400" role="status" aria-live="polite">{{ results.length }} terme(s)</p>
    <ul v-if="results.length" class="grid gap-3 sm:grid-cols-2">
      <li v-for="t in results" :key="t.term" class="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
        <p class="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-teal-300"><component :is="ICONS[t.category]" class="h-3.5 w-3.5" aria-hidden="true" />{{ CATEGORY_LABEL[t.category] }}</p>
        <h2 class="mb-1 text-lg font-bold text-white">{{ t.term }}</h2>
        <p class="mb-2 text-sm text-slate-200">{{ t.definition }}</p>
        <p class="rounded-lg bg-slate-800/70 p-2 text-sm text-slate-300"><span class="font-semibold text-amber-300">Exemple :</span> {{ t.example }}</p>
      </li>
    </ul>
    <p v-else class="rounded-2xl border border-dashed border-slate-600 p-8 text-center text-slate-300">Aucun terme ne correspond. Essaie un autre mot ou change de catégorie.</p>
  </main>
</template>
