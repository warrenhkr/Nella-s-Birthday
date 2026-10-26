<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

type TournamentTeam = { id: string, name: string, seed: number | null }
type TournamentMatch = {
  id: string
  round: number
  position: number
  status: string
  scoreHome: number | null
  scoreAway: number | null
  homeTeam: { id: string, name: string, seed: number | null } | null
  awayTeam: { id: string, name: string, seed: number | null } | null
}
type Tournament = {
  id: string
  name: string
  game: string
  status: string
  createdAt: string
  updatedAt: string
  teams: TournamentTeam[]
  matches: TournamentMatch[]
}

type TabValue = 'overview' | 'seeding' | 'bracket' | 'standings'

const route = useRoute()
const { success, alert } = useGameToast()
const { playSfx } = useSoundManager()

const tournamentId = computed(() => String(route.params.id || ''))
const { data: response, pending, error, refresh } = await useFetch<{ data: Tournament[] }>('/api/tournaments')

const tournament = computed<Tournament | null>(() => (response.value?.data || []).find(item => item.id === tournamentId.value) || null)
const refreshPending = ref(false)
const notFound = computed(() => !pending.value && !error.value && !tournament.value)

const matches = computed<TournamentMatch[]>(() => tournament.value?.matches || [])
const teams = computed<TournamentTeam[]>(() => [...(tournament.value?.teams || [])].sort((a, b) => (a.seed ?? 0) - (b.seed ?? 0)))

const isPlayed = (match: TournamentMatch) => match.status === 'completed' && match.scoreHome !== null && match.scoreAway !== null
const isLive = (match: TournamentMatch) => match.status === 'live'

const playedMatches = computed(() => matches.value.filter(isPlayed))
const liveMatches = computed(() => matches.value.filter(isLive))
const remainingMatches = computed(() => matches.value.length - playedMatches.value.length)

const progress = computed(() => matches.value.length === 0 ? 0 : Math.round((playedMatches.value.length / matches.value.length) * 100))

const lastResults = computed(() => [...playedMatches.value]
  .sort((a, b) => b.round - a.round || b.position - a.position)
  .slice(0, 5))

const nextMatch = computed(() => matches.value.find(match => match.status !== 'completed' && match.homeTeam && match.awayTeam) || null)

const tabs: Array<{ value: TabValue, label: string, icon: string }> = [
  { value: 'overview', label: 'Vue d’ensemble', icon: 'i-lucide-gauge' },
  { value: 'seeding', label: 'Seeding', icon: 'i-lucide-list-ordered' },
  { value: 'bracket', label: 'Bracket & matchs', icon: 'i-lucide-git-branch' },
  { value: 'standings', label: 'Classement', icon: 'i-lucide-table-2' }
]
const activeTab = ref<TabValue>('overview')

const selectedMatchId = ref<string | null>(null)
const matchOpen = computed({
  get: () => selectedMatchId.value !== null,
  set: (value: boolean) => {
    if (!value) selectedMatchId.value = null
  }
})
const selectedMatch = computed(() => matches.value.find(match => match.id === selectedMatchId.value) || null)

function openMatch(match: { id: string }) {
  selectedMatchId.value = match.id
  playSfx('popup')
}

function openMatchById(matchId?: string) {
  if (!matchId) return
  selectedMatchId.value = matchId
  playSfx('popup')
}

function selectTab(value: TabValue) {
  activeTab.value = value
  playSfx('click')
}

function onTabKeydown(event: KeyboardEvent, index: number) {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
  event.preventDefault()
  const offset = event.key === 'ArrowRight' ? 1 : -1
  const next = tabs[(index + offset + tabs.length) % tabs.length]
  if (next) selectTab(next.value)
}

async function refreshTournament() {
  refreshPending.value = true
  try {
    await refresh()
    success('Tournoi actualisé.')
  } catch {
    alert('Impossible d’actualiser ce tournoi.')
  } finally {
    refreshPending.value = false
  }
}

async function handleTournamentUpdated() {
  await refresh()
}

function matchTeamsLabel(match: TournamentMatch) {
  return `${match.homeTeam?.name || 'À déterminer'} vs ${match.awayTeam?.name || 'À déterminer'}`
}
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-10 pb-32 sm:py-16 lg:px-8">
    <NuxtLink
      to="/dashboard-gaming"
      class="gaming-back"
    >
      <UIcon
        name="i-lucide-arrow-left"
        aria-hidden="true"
      />
      Tous les tournois
    </NuxtLink>

    <div
      v-if="error"
      class="gaming-error surface-solid clip-corner mt-6"
      role="alert"
    >
      <div>
        <p
          class="font-semibold"
          style="color: var(--text-color);"
        >
          Impossible de charger ce tournoi.
        </p>
        <p class="mt-1 text-sm text-muted">
          L’API des tournois n’a pas répondu. Réessaie dans quelques instants.
        </p>
      </div>
      <UButton
        color="primary"
        variant="soft"
        icon="i-lucide-refresh-cw"
        label="Réessayer"
        @click="refreshTournament"
      />
    </div>

    <div
      v-else-if="notFound"
      class="gaming-empty surface-solid clip-corner mt-6"
    >
      <UIcon
        name="i-lucide-search-x"
        class="gaming-empty__icon"
        aria-hidden="true"
      />
      <h1 class="gaming-empty__title">
        Tournoi introuvable
      </h1>
      <p class="gaming-empty__text">
        Aucun tournoi ne porte cet identifiant. Il a peut-être été supprimé, ou le lien est incomplet.
      </p>
      <UButton
        class="mt-5"
        color="primary"
        icon="i-lucide-arrow-left"
        label="Revenir au cockpit gaming"
        @click="navigateTo('/dashboard-gaming')"
      />
    </div>

    <div
      v-else-if="pending || !tournament"
      class="mt-6 space-y-4"
    >
      <USkeleton class="h-28" />
      <div class="grid gap-4 sm:grid-cols-3">
        <USkeleton
          v-for="index in 3"
          :key="index"
          class="h-24"
        />
      </div>
      <USkeleton class="h-64" />
    </div>

    <template v-else>
      <header class="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0">
          <p class="text-xs uppercase tracking-[0.28em] text-brand">
            {{ tournament.game }}
          </p>
          <h1
            class="mt-2 font-display text-3xl font-black sm:text-4xl"
            style="color: var(--text-color);"
          >
            {{ tournament.name }}
          </h1>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <GamingStatusBadge :status="tournament.status" />
            <span class="gaming-chip">{{ teams.length }} équipe<span v-if="teams.length > 1">s</span></span>
            <span class="gaming-chip">{{ matches.length }} match<span v-if="matches.length > 1">s</span></span>
            <span
              v-if="liveMatches.length"
              class="gaming-chip gaming-chip--live"
            >
              {{ liveMatches.length }} en direct
            </span>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-refresh-cw"
            label="Actualiser"
            :loading="refreshPending"
            @click="refreshTournament"
          />
          <UButton
            color="primary"
            variant="soft"
            icon="i-lucide-gamepad-2"
            label="Voir les matchs"
            @click="selectTab('bracket')"
          />
        </div>
      </header>

      <section
        class="mt-6 surface-solid clip-corner p-4"
        aria-label="Avancement du tournoi"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-xs uppercase tracking-[0.18em] text-accent-otaku">
            Avancement
          </p>
          <p class="text-sm text-muted">
            {{ playedMatches.length }} / {{ matches.length }} matchs terminés · {{ progress }} %
          </p>
        </div>
        <div class="mt-3">
          <UProgress
            color="primary"
            size="sm"
            :model-value="progress"
          />
        </div>
      </section>

      <div
        class="gaming-tabs mt-6"
        role="tablist"
        aria-label="Sections du tournoi"
      >
        <button
          v-for="(tab, index) in tabs"
          :key="tab.value"
          type="button"
          role="tab"
          class="pole-filter"
          :class="{ 'pole-filter--active': activeTab === tab.value }"
          :aria-selected="activeTab === tab.value"
          @click="selectTab(tab.value)"
          @keydown="onTabKeydown($event, index)"
        >
          <UIcon
            :name="tab.icon"
            class="pole-filter__icon"
            aria-hidden="true"
          />
          {{ tab.label }}
        </button>
      </div>

      <section
        v-show="activeTab === 'overview'"
        class="mt-6 space-y-6"
        role="tabpanel"
        aria-label="Vue d’ensemble"
      >
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <GamingStatCard
            label="Équipes"
            :value="teams.length"
            hint="Engagées dans ce tournoi"
            icon="i-lucide-users"
          />
          <GamingStatCard
            label="Matchs terminés"
            :value="playedMatches.length"
            :hint="`sur ${matches.length} au programme`"
            icon="i-lucide-check-check"
            tone="done"
          />
          <GamingStatCard
            label="Matchs restants"
            :value="remainingMatches"
            hint="À jouer ou à saisir"
            icon="i-lucide-hourglass"
          />
          <GamingStatCard
            label="En direct"
            :value="liveMatches.length"
            :hint="liveMatches.length ? 'Saisie de score attendue' : 'Aucun match en cours'"
            icon="i-lucide-radio"
            :tone="liveMatches.length ? 'active' : 'default'"
          />
        </div>

        <GamingAlertsPanel
          :teams="teams"
          :matches="matches"
          @focus="openMatchById"
        />

        <div class="grid gap-5 lg:grid-cols-2">
          <div class="surface-solid clip-corner p-5">
            <p class="text-xs uppercase tracking-[0.18em] text-accent-otaku">
              Prochain match à contrôler
            </p>
            <div
              v-if="nextMatch"
              class="mt-3 space-y-3"
            >
              <p
                class="text-lg font-semibold"
                style="color: var(--text-color);"
              >
                {{ matchTeamsLabel(nextMatch) }}
              </p>
              <p class="text-sm text-muted">
                Tour {{ nextMatch.round }} · match {{ nextMatch.position }}
              </p>
              <div class="flex flex-wrap items-center gap-2">
                <GamingStatusBadge :status="nextMatch.status" />
                <UButton
                  color="primary"
                  icon="i-lucide-sliders-horizontal"
                  label="Contrôler ce match"
                  @click="openMatch(nextMatch)"
                />
              </div>
            </div>
            <p
              v-else
              class="mt-3 text-sm text-muted"
            >
              Aucun match en attente : tous les matchs sont terminés ou attendent une équipe.
            </p>
          </div>

          <div class="surface-solid clip-corner p-5">
            <p class="text-xs uppercase tracking-[0.18em] text-accent-otaku">
              Derniers résultats
            </p>
            <ul
              v-if="lastResults.length"
              class="mt-3 space-y-2"
            >
              <li
                v-for="match in lastResults"
                :key="match.id"
                class="gaming-result"
              >
                <span class="gaming-result__teams">
                  {{ match.homeTeam?.name || 'À déterminer' }} — {{ match.awayTeam?.name || 'À déterminer' }}
                </span>
                <span class="gaming-result__score">{{ match.scoreHome }} – {{ match.scoreAway }}</span>
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  icon="i-lucide-pencil"
                  :aria-label="`Corriger le match ${match.id}`"
                  @click="openMatch(match)"
                />
              </li>
            </ul>
            <p
              v-else
              class="mt-3 text-sm text-muted"
            >
              Aucun résultat enregistré pour l’instant.
            </p>
          </div>
        </div>
      </section>

      <section
        v-show="activeTab === 'seeding'"
        class="mt-6 surface-solid clip-corner p-5"
        role="tabpanel"
        aria-label="Seeding"
      >
        <GamingSeedingList
          :tournament-id="tournament.id"
          :teams="teams"
          @updated="handleTournamentUpdated"
        />
      </section>

      <section
        v-show="activeTab === 'bracket'"
        class="mt-6 space-y-4"
        role="tabpanel"
        aria-label="Bracket et matchs"
      >
        <div class="surface-solid clip-corner p-5">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-xs uppercase tracking-[0.18em] text-accent-otaku">
              Bracket
            </p>
            <p class="text-xs text-muted">
              Sélectionne un match pour saisir le score, changer son statut ou enregistrer un forfait.
            </p>
          </div>
          <div class="mt-4">
            <GamingBracket
              :matches="matches"
              @select="openMatch"
            />
          </div>
        </div>

        <div class="surface-solid clip-corner p-5">
          <p class="text-xs uppercase tracking-[0.18em] text-accent-otaku">
            Tous les matchs
          </p>
          <ul
            v-if="matches.length"
            class="mt-3 space-y-2"
          >
            <li
              v-for="match in matches"
              :key="match.id"
              class="gaming-result"
            >
              <span class="gaming-result__teams">
                Tour {{ match.round }} · {{ matchTeamsLabel(match) }}
              </span>
              <span
                v-if="match.scoreHome !== null && match.scoreAway !== null"
                class="gaming-result__score"
              >
                {{ match.scoreHome }} – {{ match.scoreAway }}
              </span>
              <GamingStatusBadge :status="match.status" />
              <UButton
                color="neutral"
                variant="soft"
                size="xs"
                label="Contrôler"
                @click="openMatch(match)"
              />
            </li>
          </ul>
          <p
            v-else
            class="mt-3 text-sm text-muted"
          >
            Aucun match généré pour ce tournoi.
          </p>
        </div>
      </section>

      <section
        v-show="activeTab === 'standings'"
        class="mt-6 surface-solid clip-corner p-5"
        role="tabpanel"
        aria-label="Classement"
      >
        <GamingStandingsTable
          :teams="teams"
          :matches="matches"
        />
      </section>
    </template>

    <USlideover
      v-model:open="matchOpen"
      :title="selectedMatch ? `Contrôle du match — tour ${selectedMatch.round}` : 'Contrôle du match'"
      description="Statut, scores et forfait. Chaque enregistrement est écrit immédiatement."
      :ui="{ content: 'gaming-match-panel', overlay: 'gaming-match-panel-overlay' }"
    >
      <template #body>
        <GamingMatchControl
          v-if="selectedMatch && tournament"
          :tournament-id="tournament ? tournament.id : ''"
          :match="selectedMatch"
          @updated="handleTournamentUpdated"
        />
      </template>
    </USlideover>
  </div>
</template>

<style scoped>
.gaming-back {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: var(--muted-color);
  text-decoration: none;
}

.gaming-back:hover {
  color: var(--primary-color);
}

.gaming-back svg {
  height: 1rem;
  width: 1rem;
}

.gaming-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 9999px;
  border: 1px solid var(--border-color);
  padding: 0.2rem 0.6rem;
  font-size: 0.7rem;
  color: var(--muted-color);
}

.gaming-chip--live {
  border-color: rgba(var(--primary-color-rgb), 0.5);
  color: var(--primary-color);
  background: rgba(var(--primary-color-rgb), 0.12);
}

.gaming-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.pole-filter {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border-radius: 9999px;
  padding: 0.4rem 0.9rem;
  min-height: 2.4rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-color);
  background: transparent;
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, transform 0.15s ease;
}

.pole-filter:hover {
  border-color: rgba(var(--primary-color-rgb), 0.5);
  transform: translateY(-1px);
}

.pole-filter--active {
  color: var(--text-color);
  background: rgba(var(--primary-color-rgb), 0.18);
  border-color: var(--primary-color);
  font-weight: 600;
}

.pole-filter__icon {
  height: 0.95rem;
  width: 0.95rem;
  color: var(--accent-color);
}

.pole-filter--active .pole-filter__icon {
  color: var(--primary-color);
}

.gaming-result {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid var(--border-color);
  padding: 0.5rem 0.7rem;
  font-size: 0.82rem;
  color: var(--text-color);
}

.gaming-result__teams {
  flex: 1;
  min-width: 10rem;
}

.gaming-result__score {
  border-radius: 0.35rem;
  background: rgba(var(--primary-color-rgb), 0.12);
  padding: 0.1rem 0.5rem;
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--primary-color);
}

.gaming-error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border: 1px solid rgba(var(--primary-color-rgb), 0.5);
  padding: 1rem 1.1rem;
}

.gaming-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  border-style: dashed;
  border-color: rgba(var(--primary-color-rgb), 0.3);
  padding: 2.5rem 1.25rem;
  text-align: center;
}

.gaming-empty__icon {
  height: 2.25rem;
  width: 2.25rem;
  color: var(--accent-color);
}

.gaming-empty__title {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-color);
}

.gaming-empty__text {
  max-width: 40rem;
  font-size: 0.875rem;
  color: var(--muted-color);
}

/* Panneau latéral téléporté hors de .app-shell : on repose les tokens Nuxt UI
   avec les seules variables du thème (valables dans les 4 combinaisons). */
:global(.gaming-match-panel) {
  --ui-bg: var(--bg-color-soft);
  --ui-bg-muted: rgba(var(--primary-color-rgb), 0.05);
  --ui-bg-elevated: var(--bg-color-soft);
  --ui-text: var(--text-color);
  --ui-text-muted: var(--muted-color);
  --ui-border: var(--border-color);
  --ui-border-accented: rgba(var(--primary-color-rgb), 0.3);
  overflow: hidden;
  border: 1px solid rgba(var(--primary-color-rgb), 0.36);
  background: var(--bg-color-soft) !important;
  color: var(--text-color);
  box-shadow: 0 24px 80px -24px rgba(var(--primary-color-rgb), 0.56);
}

:global(.gaming-match-panel-overlay) {
  background: color-mix(in srgb, var(--primary-color) 55%, transparent) !important;
  backdrop-filter: blur(8px);
}
</style>
