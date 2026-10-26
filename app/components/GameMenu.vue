<script setup lang="ts">
import { computed, ref } from 'vue'
import { CATEGORY_LABELS, MINI_GAMES } from '../data/mini-jeux'
import { games as existingGames } from '../data/games'
import { ANALYSTE_GAMES } from '../../lot-analyste-entreprise/app/data/analyste-jeux'
import { useRoute } from 'vue-router'

type GameFilter = 'all' | 'coeur' | 'fete' | 'geek' | 'cyber' | 'analyste'

const search = ref('')
const route = useRoute()
const activeFilter = ref<GameFilter>(route.query.categorie === 'analyste' ? 'analyste' : 'all')
const miniGameIcons: Record<string, string> = {
  'simon-bougies': 'i-mdi-candle',
  'memory-cadeaux': 'i-lucide-gift',
  'gateau-etages': 'i-lucide-cake-slice',
  'allume-gateau': 'i-lucide-flame',
  'pop-ballons': 'i-lucide-balloon',
  'taquin-illustre': 'i-lucide-puzzle',
  'mots-meles': 'i-lucide-search',
  'plus-ou-moins': 'i-lucide-target',
  'pile-a-l-heure': 'i-lucide-timer',
  'chasse-differences': 'i-lucide-scan-search',
  'gobelets': 'i-lucide-cup-soda',
  'sudoku-couleurs': 'i-lucide-grid-3x3',
  'tri-couleurs': 'i-lucide-palette',
  'vrai-faux': 'i-lucide-circle-help',
  'serpent-gourmand': 'i-game-icons-snake',
  'chasseur-bugs': 'i-lucide-bug',
  'bougies-binaires': 'i-lucide-binary',
  'portes-logiques': 'i-lucide-circuit-board',
  'code-couleur': 'i-lucide-palette',
  'phishing-ou-cadeau': 'i-lucide-mail-warning',
  'mot-de-passe-or': 'i-lucide-key-round',
  'mini-ctf': 'i-lucide-flag',
  'casse-coffre': 'i-lucide-lock-keyhole',
  'pare-feu': 'i-lucide-shield-check'
}

const allGames = [
  ...existingGames.map(game => ({
    key: game.id,
    title: game.title,
    description: game.description,
    accent: game.accent,
    href: `/jeu?game=${game.id}`,
    icon: game.icon,
    category: ['phishing-detective', 'password-lab', 'cipher-breaker'].includes(game.id) ? 'cyber' as const : 'coeur' as const,
    searchableCategory: game.accent
  })),
  ...MINI_GAMES.map(game => ({
    key: game.slug,
    title: game.title,
    description: game.description,
    accent: CATEGORY_LABELS[game.category],
    href: `/jeu?game=${game.slug}`,
    icon: miniGameIcons[game.slug] ?? 'i-lucide-gamepad-2',
    category: game.category,
    searchableCategory: CATEGORY_LABELS[game.category]
  })),
  ...ANALYSTE_GAMES.map(game => ({
    key: game.slug,
    title: game.title,
    description: game.description,
    accent: 'Analyste d’entreprise',
    href: `/jeu?game=${game.slug}`,
    icon: 'i-lucide-briefcase-business',
    category: 'analyste' as const,
    searchableCategory: `Analyste d’entreprise ${game.skill}`
  }))
]

const filters: { id: GameFilter, label: string, icon: string, count?: number }[] = [
  { id: 'all', label: 'Tous', icon: 'i-lucide-orbit' },
  { id: 'coeur', label: 'Jeux de cœur', icon: 'i-lucide-heart' },
  { id: 'fete', label: 'Fête', icon: 'i-lucide-cake-slice' },
  { id: 'geek', label: 'Geek', icon: 'i-lucide-laptop' },
  { id: 'cyber', label: 'Cybersécurité', icon: 'i-lucide-shield-check' },
  { id: 'analyste', label: 'Analyste d’entreprise', icon: 'i-lucide-briefcase-business', count: ANALYSTE_GAMES.length }
]

const filteredGames = computed(() => {
  const query = search.value.trim().toLocaleLowerCase('fr')

  return allGames.filter((game) => {
    const matchesFilter = activeFilter.value === 'all' || game.category === activeFilter.value
    const searchable = `${game.title} ${game.description} ${game.searchableCategory}`.toLocaleLowerCase('fr')
    return matchesFilter && (!query || searchable.includes(query))
  })
})
</script>

<template>
  <section
    class="space-y-4"
    aria-label="Parcourir les jeux"
  >
    <label class="relative block max-w-xl">
      <UIcon
        name="i-lucide-search"
        class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pink-100/50"
      />
      <input
        v-model="search"
        type="search"
        placeholder="Rechercher un jeu, un thème…"
        aria-label="Rechercher un jeu"
        class="w-full rounded-xl border border-white/15 bg-[#170e20] py-3 pl-10 pr-4 text-sm text-white placeholder:text-pink-100/45 outline-none transition focus:border-pink-200/55 focus:ring-2 focus:ring-pink-300/15"
      >
    </label>

    <div
      class="flex flex-wrap gap-2"
      role="group"
      aria-label="Filtrer les jeux par catégorie"
    >
      <button
        v-for="filter in filters"
        :key="filter.id"
        type="button"
        :aria-pressed="activeFilter === filter.id"
        class="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-200"
        :class="activeFilter === filter.id ? 'border-pink-200/50 bg-pink-300/15 text-white' : 'border-white/10 bg-white/3 text-pink-50/65 hover:border-white/25 hover:text-white'"
        @click="activeFilter = filter.id"
      >
        <UIcon
          :name="filter.icon"
          class="h-4 w-4"
        />
        {{ filter.label }}
        <span v-if="filter.count !== undefined || filter.id === 'all'" class="text-xs text-pink-100/50">{{ filter.count ?? allGames.length }}</span>
      </button>
    </div>

    <p
      class="text-xs text-pink-100/55"
      aria-live="polite"
    >
      {{ filteredGames.length }} résultat{{ filteredGames.length === 1 ? '' : 's' }}
    </p>

    <TransitionGroup
      v-if="filteredGames.length"
      name="game-list"
      tag="div"
      aria-label="Jeux disponibles"
      class="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
    >
      <NuxtLink
        v-for="(game, index) in filteredGames"
        :key="game.key"
        :to="game.href"
        :prefetch-on="{ visibility: false, interaction: true }"
        :style="{ '--game-enter-delay': `${Math.min(index * 30, 300)}ms` }"
        class="game-menu-card group rounded-md border p-5 text-left transition duration-300"
      >
        <div class="mb-4 flex items-center justify-between gap-3">
          <span class="game-menu-card__icon inline-flex h-12 w-12 items-center justify-center rounded-lg">
            <UIcon
              :name="game.icon"
              class="h-5 w-5"
              aria-hidden="true"
            />
          </span>
          <span class="game-menu-card__tag rounded border px-2 py-1 text-[10px] uppercase tracking-[0.16em]">
            {{ game.accent }}
          </span>
        </div>

        <h2 class="game-menu-card__title text-xl font-semibold">{{ game.title }}</h2>
        <p class="game-menu-card__description mt-2 text-sm leading-6">{{ game.description }}</p>
      </NuxtLink>
    </TransitionGroup>

    <div
      v-else
      class="rounded-xl border border-dashed border-white/15 px-5 py-12 text-center"
    >
      <UIcon
        name="i-lucide-search-x"
        class="mx-auto h-6 w-6 text-pink-100/45"
      />
      <p class="mt-3 text-sm text-pink-50/65">
        Aucun jeu ne correspond à cette recherche.
      </p>
      <button
        type="button"
        class="mt-3 text-sm text-pink-200 underline decoration-pink-200/40 underline-offset-4"
        @click="search = ''; activeFilter = 'all'"
      >
        Effacer les filtres
      </button>
    </div>
  </section>
</template>

<style scoped>
.game-menu-card {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border-color: var(--border-color);
  background: var(--theme-panel);
  box-shadow: 0 0.7rem 1.8rem rgba(var(--primary-color-rgb), 0.07);
  transform: translateY(0);
}

.game-menu-card::before {
  position: absolute;
  z-index: -1;
  inset: 0;
  background: linear-gradient(115deg, rgba(var(--primary-color-rgb), 0.12), rgba(var(--accent-color-rgb), 0.06) 46%, transparent 74%);
  content: '';
  opacity: 0;
  transform: translateX(-12%);
  transition: opacity 280ms ease, transform 450ms cubic-bezier(0.2, 0.75, 0.2, 1);
}

.game-menu-card:hover,
.game-menu-card:focus-visible {
  border-color: color-mix(in srgb, var(--primary-color) 55%, var(--accent-color));
  background: var(--theme-panel-solid);
  box-shadow: 0 1rem 2.5rem rgba(var(--primary-color-rgb), 0.18), 0 0 0 1px rgba(var(--accent-color-rgb), 0.14);
  transform: translateY(-4px);
}

.game-menu-card:hover::before,
.game-menu-card:focus-visible::before { opacity: 1; transform: translateX(0); }
.game-menu-card:focus-visible { outline: 2px solid var(--accent-color); outline-offset: 3px; }
.game-menu-card__icon { border: 1px solid rgba(var(--primary-color-rgb), 0.2); background: var(--theme-soft-primary); color: var(--primary-color); transition: color 220ms ease, background-color 220ms ease, transform 350ms cubic-bezier(0.2, 0.8, 0.2, 1); }
.game-menu-card:hover .game-menu-card__icon, .game-menu-card:focus-visible .game-menu-card__icon { background: var(--primary-color); color: var(--theme-panel-solid); transform: rotate(-7deg) scale(1.06); }
.game-menu-card__tag { border-color: var(--border-color); color: var(--theme-accent-text); }
.game-menu-card__title { color: var(--theme-heading); }
.game-menu-card__description { color: var(--theme-muted-text); }

.game-list-enter-active,
.game-list-leave-active {
  transition: opacity 300ms ease, transform 360ms cubic-bezier(0.22, 1, 0.36, 1);
  transition-delay: var(--game-enter-delay, 0ms);
}

.game-list-enter-from,
.game-list-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.game-list-move { transition: transform 300ms ease; }
.game-list-leave-active { transition-duration: 160ms; }

@media (prefers-reduced-motion: reduce) {
  .game-menu-card,
  .game-menu-card::before,
  .game-menu-card__icon,
  .game-list-enter-active,
  .game-list-leave-active,
  .game-list-move { transition: none; }
}
</style>
