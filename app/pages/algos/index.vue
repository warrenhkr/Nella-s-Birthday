<script setup lang="ts">
import { algos } from '../../data/algos'

const search = ref('')
const activeType = ref('all')
const route = useRoute()
const activeCategory = ref<'all' | 'anniversaire' | 'analyste'>(route.query.categorie === 'analyste' ? 'analyste' : 'all')

const categories = [
  { id: 'all', label: 'Tous', icon: 'i-lucide-orbit', count: algos.length },
  { id: 'anniversaire', label: 'Anniversaire', icon: 'i-lucide-heart', count: algos.filter(algo => algo.category === 'anniversaire').length },
  { id: 'analyste', label: 'Analyste d’entreprise', icon: 'i-lucide-briefcase-business', count: algos.filter(algo => algo.category === 'analyste').length }
]

const renderTypes = [
  { id: 'all', label: 'Tous', icon: 'i-lucide-orbit' },
  { id: 'points', label: 'Points', icon: 'i-lucide-sparkles' },
  { id: 'grille', label: 'Grilles', icon: 'i-lucide-grid-3x3' },
  { id: 'frames', label: 'Animations', icon: 'i-lucide-film' },
  { id: 'texte', label: 'Texte', icon: 'i-lucide-type' },
  { id: 'image', label: 'Images', icon: 'i-lucide-image' }
]

const filteredAlgos = computed(() => {
  const query = search.value.trim().toLocaleLowerCase('fr')

  return algos.filter((algo) => {
    const matchesType = activeType.value === 'all' || algo.renderType === activeType.value
    const matchesCategory = activeCategory.value === 'all' || algo.category === activeCategory.value
    const searchable = `${algo.title} ${algo.description} ${algo.tags.join(' ')}`.toLocaleLowerCase('fr')
    return matchesType && matchesCategory && (!query || searchable.includes(query))
  })
})

function renderIcon(type: string) {
  return renderTypes.find((item) => item.id === type)?.icon ?? 'i-lucide-heart'
}

function renderLabel(type: string) {
  return renderTypes.find((item) => item.id === type)?.label ?? type
}
</script>

<template>
  <main class="theme-page min-h-dvh px-4 py-8 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-6xl">
      <header class="algo-intro mb-8 border-b border-white/10 pb-7">
        <NuxtLink
          to="/anniversaire"
          class="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-pink-100 transition hover:bg-white/10"
        >
          <UIcon name="i-lucide-arrow-left" class="h-4 w-4" />
          Retour à l’anniversaire
        </NuxtLink>

        <p class="mb-2 text-xs uppercase tracking-[0.32em] text-pink-200/80">
          Collection · {{ algos.length }} algorithmes
        </p>
        <h1 class="text-3xl font-semibold text-pink-100 sm:text-4xl">
          Algorithmes interactifs
        </h1>
        <p class="mt-3 max-w-2xl text-sm text-pink-50/80 sm:text-base">
          Explore les algorithmes, ajuste leurs paramètres et observe leur rendu.
        </p>
      </header>

      <section aria-label="Parcourir les algorithmes" class="algo-intro algo-intro--delayed mb-6 space-y-4">
        <label class="relative block max-w-xl">
          <UIcon name="i-lucide-search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pink-100/50" />
          <input
            v-model="search"
            type="search"
            placeholder="Rechercher un algorithme, un thème…"
            class="w-full rounded-xl border border-white/15 bg-[#170e20] py-3 pl-10 pr-4 text-sm text-white placeholder:text-pink-100/45 outline-none transition focus:border-pink-200/55 focus:ring-2 focus:ring-pink-300/15"
          />
        </label>

        <div class="flex flex-wrap gap-2" role="group" aria-label="Filtrer par univers">
          <button
            v-for="category in categories"
            :key="category.id"
            type="button"
            :aria-pressed="activeCategory === category.id"
            class="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-200"
            :class="activeCategory === category.id ? 'border-pink-200/50 bg-pink-300/15 text-white' : 'border-white/10 bg-white/3 text-pink-50/65 hover:border-white/25 hover:text-white'"
            @click="activeCategory = category.id as 'all' | 'anniversaire' | 'analyste'"
          >
            <UIcon :name="category.icon" class="h-4 w-4" />
            {{ category.label }}
            <span class="text-xs text-pink-100/50">{{ category.count }}</span>
          </button>
        </div>

        <div class="flex flex-wrap gap-2" role="group" aria-label="Filtrer par type de rendu">
          <button
            v-for="type in renderTypes"
            :key="type.id"
            type="button"
            :aria-pressed="activeType === type.id"
            class="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-200"
            :class="activeType === type.id ? 'border-pink-200/50 bg-pink-300/15 text-white' : 'border-white/10 bg-white/3 text-pink-50/65 hover:border-white/25 hover:text-white'"
            @click="activeType = type.id"
          >
            <UIcon :name="type.icon" class="h-4 w-4" />
            {{ type.label }}
            <span v-if="type.id === 'all'" class="text-xs text-pink-100/50">{{ algos.length }}</span>
          </button>
        </div>
      </section>

      <Transition name="algo-result" mode="out-in">
        <p :key="filteredAlgos.length" class="mb-3 text-xs text-pink-100/55" aria-live="polite">
          {{ filteredAlgos.length }} résultat{{ filteredAlgos.length === 1 ? '' : 's' }}
        </p>
      </Transition>

      <TransitionGroup
        v-if="filteredAlgos.length"
        name="algo-list"
        tag="section"
        appear
        aria-label="Algorithmes disponibles"
        class="relative grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        <NuxtLink
          v-for="(algo, index) in filteredAlgos"
          :key="algo.id"
          :to="`/algos/${algo.id}`"
          :prefetch-on="{ visibility: false, interaction: true }"
          :style="{ '--algo-enter-delay': `${Math.min(index * 42, 336)}ms` }"
          class="algo-card group relative flex min-h-55 min-w-0 flex-col overflow-hidden rounded-md border p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-200"
        >
          <div class="mb-5 flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <span class="algo-card__icon inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg">
                <UIcon :name="renderIcon(algo.renderType)" class="h-5 w-5" />
              </span>
              <span class="algo-card__index font-mono text-xs tabular-nums">{{ String(index + 1).padStart(2, '0') }}</span>
            </div>
            <span class="algo-card__type rounded border px-2 py-1 text-[10px] uppercase tracking-[0.16em]">
              {{ renderLabel(algo.renderType) }}
            </span>
          </div>

          <h2 class="algo-card__title break-words text-lg font-semibold leading-snug">
            {{ algo.title }}
          </h2>
          <p class="algo-card__description mt-2 break-words line-clamp-3 text-sm leading-6">
            {{ algo.description }}
          </p>

          <div class="mt-auto flex min-w-0 items-end justify-between gap-2 pt-4">
            <div class="flex min-w-0 flex-wrap gap-1.5">
              <span
                v-for="tag in algo.tags.slice(0, 3)"
                :key="tag"
                class="algo-card__tag rounded px-2 py-1 text-[10px] uppercase tracking-[0.12em]"
              >
                {{ tag }}
              </span>
            </div>
            <UIcon name="i-lucide-arrow-up-right" class="algo-card__arrow h-4 w-4 shrink-0" />
          </div>
        </NuxtLink>
      </TransitionGroup>

      <Transition v-else name="algo-result" appear>
        <div class="rounded-xl border border-dashed border-white/15 px-5 py-12 text-center">
        <UIcon name="i-lucide-search-x" class="mx-auto h-6 w-6 text-pink-100/45" />
        <p class="mt-3 text-sm text-pink-50/65">Aucun algorithme ne correspond à cette recherche.</p>
        <button type="button" class="mt-3 text-sm text-pink-200 underline decoration-pink-200/40 underline-offset-4" @click="search = ''; activeType = 'all'">
          Effacer les filtres
        </button>
        </div>
      </Transition>
    </div>
  </main>
</template>

<style scoped>
.algo-intro {
  animation: algo-intro-reveal 760ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.algo-intro--delayed {
  animation-delay: 90ms;
}

.algo-card {
  position: relative;
  isolation: isolate;
  border-color: var(--border-color);
  background: var(--theme-panel);
  box-shadow: 0 0.7rem 1.8rem rgba(var(--primary-color-rgb), 0.07);
  transform: translateY(0);
  transition: border-color 300ms ease, background-color 300ms ease, box-shadow 350ms ease, transform 350ms cubic-bezier(0.2, 0.75, 0.2, 1);
}

.algo-card::before {
  position: absolute;
  z-index: -1;
  inset: 0;
  background: linear-gradient(115deg, rgba(var(--primary-color-rgb), 0.12), rgba(var(--accent-color-rgb), 0.06) 46%, transparent 74%);
  content: '';
  opacity: 0;
  transform: translateX(-12%);
  transition: opacity 280ms ease, transform 450ms cubic-bezier(0.2, 0.75, 0.2, 1);
}

.algo-card:hover,
.algo-card:focus-visible {
  border-color: color-mix(in srgb, var(--primary-color) 55%, var(--accent-color));
  background: var(--theme-panel-solid);
  box-shadow: 0 1rem 2.5rem rgba(var(--primary-color-rgb), 0.18), 0 0 0 1px rgba(var(--accent-color-rgb), 0.14);
  transform: translateY(-4px);
}

.algo-card:hover::before,
.algo-card:focus-visible::before {
  opacity: 1;
  transform: translateX(0);
}

.algo-card__icon {
  border: 1px solid rgba(var(--primary-color-rgb), 0.2);
  background: var(--theme-soft-primary);
  color: var(--primary-color);
  transition: color 220ms ease, background-color 220ms ease, transform 350ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.algo-card:hover .algo-card__icon,
.algo-card:focus-visible .algo-card__icon {
  background: var(--primary-color);
  color: var(--theme-panel-solid);
  transform: rotate(-7deg) scale(1.06);
}

.algo-card__index { color: var(--theme-muted-text); opacity: 0.72; }
.algo-card__type { border-color: var(--border-color); color: var(--theme-accent-text); }
.algo-card__title { color: var(--theme-heading); transition: color 220ms ease; }
.algo-card:hover .algo-card__title,
.algo-card:focus-visible .algo-card__title { color: var(--primary-color); }
.algo-card__description { color: var(--theme-muted-text); }
.algo-card__tag { background: var(--theme-soft-primary); color: var(--theme-accent-text); }
.algo-card__arrow { color: var(--theme-muted-text); opacity: 0.55; transition: color 220ms ease, opacity 220ms ease, transform 300ms ease; }
.algo-card:hover .algo-card__arrow,
.algo-card:focus-visible .algo-card__arrow { color: var(--primary-color); opacity: 1; transform: translate(2px, -2px); }

.algo-list-enter-active,
.algo-list-leave-active {
  transition: opacity 480ms cubic-bezier(0.22, 1, 0.36, 1), transform 560ms cubic-bezier(0.22, 1, 0.36, 1);
  transition-delay: var(--algo-enter-delay, 0ms);
}

.algo-list-enter-from,
.algo-list-leave-to {
  opacity: 0;
  transform: translateY(14px) scale(0.985);
}

.algo-list-leave-active { transition-duration: 180ms; }
.algo-list-move { transition: transform 420ms cubic-bezier(0.2, 0.75, 0.2, 1); }

.algo-result-enter-active,
.algo-result-leave-active {
  transition: opacity 300ms ease, transform 360ms cubic-bezier(0.22, 1, 0.36, 1);
}

.algo-result-enter-from,
.algo-result-leave-to { opacity: 0; transform: translateY(7px); }

@keyframes algo-intro-reveal {
  from { opacity: 0; transform: translateY(10px); filter: blur(2px); }
  to { opacity: 1; transform: translateY(0); filter: blur(0); }
}

@media (prefers-reduced-motion: reduce) {
  .algo-intro { animation: none; }
  .algo-card,
  .algo-card::before,
  .algo-card__icon,
  .algo-card__title,
  .algo-card__arrow,
  .algo-list-enter-active,
  .algo-list-leave-active,
  .algo-list-move,
  .algo-result-enter-active,
  .algo-result-leave-active {
    transition: none;
  }
}
</style>
