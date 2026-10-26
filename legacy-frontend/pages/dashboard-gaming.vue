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
  visibility: string
  registrationOpen: boolean
  maxTeams: number | null
  format: string | null
  description: string | null
  startDate: string | null
  endDate: string | null
  createdAt: string
  teams: TournamentTeam[]
  matches: TournamentMatch[]
}

type StatusBucket = 'all' | 'draft' | 'active' | 'completed' | 'other'

const { success, alert } = useGameToast()
const { playSfx } = useSoundManager()

const { data: response, pending, error, refresh } = await useFetch<{ data: Tournament[] }>('/api/tournaments', {
  server: false,
  lazy: false
})

const tournaments = computed<Tournament[]>(() => response.value?.data || [])
const refreshPending = ref(false)

const isPlayed = (match: TournamentMatch) => match.status === 'completed' && match.scoreHome !== null && match.scoreAway !== null
const isLive = (match: TournamentMatch) => match.status === 'live'

const allMatches = computed(() => tournaments.value.flatMap(tournament => tournament.matches))

const stats = computed(() => {
  const matches = allMatches.value
  return {
    tournaments: tournaments.value.length,
    teams: tournaments.value.reduce((total, tournament) => total + tournament.teams.length, 0),
    matches: matches.length,
    played: matches.filter(isPlayed).length,
    live: matches.filter(isLive).length,
    completed: tournaments.value.filter(tournament => normalize(tournament.status) === 'completed').length
  }
})

const playedRate = computed(() => stats.value.matches === 0 ? 0 : Math.round((stats.value.played / stats.value.matches) * 100))

function normalize(status: string) {
  return (status || '').trim().toLowerCase()
}

function bucketOf(status: string): StatusBucket {
  const value = normalize(status)
  if (value === 'draft') return 'draft'
  if (value === 'completed') return 'completed'
  if (['in_progress', 'registration_open', 'checkin'].includes(value)) return 'active'
  return 'other'
}

function progressOf(tournament: Tournament) {
  if (tournament.matches.length === 0) return 0
  return tournament.matches.filter(isPlayed).length / tournament.matches.length
}

const statusFilters: Array<{ value: StatusBucket, label: string }> = [
  { value: 'all', label: 'Tous' },
  { value: 'draft', label: 'Brouillons' },
  { value: 'active', label: 'En cours' },
  { value: 'completed', label: 'Terminés' },
  { value: 'other', label: 'Autres' }
]

const activeBucket = ref<StatusBucket>('all')
const search = ref('')
const sortBy = ref<string>('recent')
const view = ref<'cards' | 'table'>('cards')
const page = ref(1)
const perPage = 6
const createOpen = ref(false)

const bucketCounts = computed(() => {
  const counts: Record<StatusBucket, number> = { all: tournaments.value.length, draft: 0, active: 0, completed: 0, other: 0 }
  for (const tournament of tournaments.value) {
    const bucket = bucketOf(tournament.status)
    counts[bucket] += 1
  }
  return counts
})

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()
  const list = tournaments.value.filter((tournament) => {
    if (activeBucket.value !== 'all' && bucketOf(tournament.status) !== activeBucket.value) return false
    if (!term) return true
    return tournament.name.toLowerCase().includes(term) || tournament.game.toLowerCase().includes(term)
  })

  const sorted = [...list]
  switch (sortBy.value) {
    case 'name':
      sorted.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
      break
    case 'teams':
      sorted.sort((a, b) => b.teams.length - a.teams.length)
      break
    case 'progress':
      sorted.sort((a, b) => progressOf(b) - progressOf(a))
      break
    default:
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }
  return sorted
})

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / perPage)))
const pagedTournaments = computed(() => filtered.value.slice((page.value - 1) * perPage, page.value * perPage))
const filtersActive = computed(() => activeBucket.value !== 'all' || search.value.trim().length > 0)

const formats = [
  { code: 'SE', name: 'Élimination directe', when: 'Une demi-journée, horaire serré, beaucoup d’équipes.', risk: 'La moitié du plateau ne joue qu’un match.' },
  { code: 'DE', name: 'Double élimination', when: 'Plateau compétitif : il faut deux défaites pour sortir.', risk: 'Deux fois plus de temps, arbre des perdants à synchroniser.' },
  { code: 'RR', name: 'Round robin', when: '4 à 8 équipes : tout le monde affronte tout le monde.', risk: 'Croissance quadratique (16 équipes = 120 matchs).' },
  { code: 'CH', name: 'Système suisse', when: 'Gros plateau individuel, sur plusieurs sessions.', risk: 'Appariements à produire à chaque tour, départages à publier.' },
  { code: 'GK', name: 'Poules + bracket', when: 'Inscriptions payantes : au moins 3 matchs garantis par équipe.', risk: 'Planification plus lourde.' }
]

watch(totalPages, (value) => {
  if (page.value > value) page.value = value
}, { flush: 'post' })

watch([search, activeBucket, sortBy], () => {
  page.value = 1
})

function selectBucket(bucket: StatusBucket) {
  activeBucket.value = bucket
  playSfx('click')
}

function resetFilters() {
  activeBucket.value = 'all'
  search.value = ''
  sortBy.value = 'recent'
  playSfx('click')
}

function toggleView() {
  view.value = view.value === 'cards' ? 'table' : 'cards'
  playSfx('click')
}

async function refreshList() {
  refreshPending.value = true
  try {
    await refresh()
    success('Liste des tournois actualisée.')
  } catch {
    alert('Impossible d’actualiser la liste des tournois.')
  } finally {
    refreshPending.value = false
  }
}

async function handleCreated() {
  await refresh()
  page.value = 1
  resetFilters()
}

function openCreate() {
  createOpen.value = true
  playSfx('popup')
}

// ---------- Publication & inscriptions (Lot 3) ----------
const settingsOpen = ref(false)
const settingsTournament = ref<Tournament | null>(null)
const registrationsOpen = ref(false)
const registrationsTournament = ref<Tournament | null>(null)
const savingVisibilityId = ref<string | null>(null)

const visibilityOptions = [
  { value: 'DRAFT', label: 'Brouillon' },
  { value: 'UNLISTED', label: 'Non listé' },
  { value: 'PUBLIC', label: 'Public' }
]

const VISIBILITY_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  UNLISTED: 'Non listé',
  PUBLIC: 'Public'
}

const publishedCount = computed(() => tournaments.value.filter(tournament => tournament.visibility === 'PUBLIC').length)
const openRegistrationCount = computed(() => tournaments.value.filter(tournament => tournament.registrationOpen).length)

function visibilityLabel(visibility: string) {
  return VISIBILITY_LABELS[visibility] || visibility
}

function getApiErrorMessage(errorValue: unknown, fallback: string) {
  if (typeof errorValue === 'object' && errorValue !== null && 'data' in errorValue) {
    const data = errorValue.data
    if (typeof data === 'object' && data !== null && 'statusMessage' in data && typeof data.statusMessage === 'string') return data.statusMessage
  }
  return fallback
}

function openSettings(tournament: Tournament) {
  settingsTournament.value = tournament
  settingsOpen.value = true
  playSfx('popup')
}

function openRegistrations(tournament: Tournament) {
  registrationsTournament.value = tournament
  registrationsOpen.value = true
  playSfx('popup')
}

// Publication en un geste depuis la liste : PATCH /api/tournaments/:id.
// C'est ce qui débloque l'affichage côté membre (seul PUBLIC est listé).
async function setVisibility(tournament: Tournament, visibility: string) {
  if (!visibility || visibility === tournament.visibility) return
  savingVisibilityId.value = tournament.id
  try {
    await $fetch(`/api/tournaments/${encodeURIComponent(tournament.id)}`, {
      method: 'PATCH',
      body: { visibility }
    })
    playSfx('success')
    success(visibility === 'PUBLIC'
      ? `« ${tournament.name} » est publié : il apparaît dans la liste des tournois.`
      : `« ${tournament.name} » — visibilité : ${visibilityLabel(visibility).toLowerCase()}.`)
    await refresh()
  } catch (visibilityError: unknown) {
    playSfx('error')
    alert(getApiErrorMessage(visibilityError, 'Impossible de changer la visibilité de ce tournoi.'))
  } finally {
    savingVisibilityId.value = null
  }
}

async function handleSettingsUpdated() {
  await refresh()
}
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-10 pb-32 sm:py-16 lg:px-8">
    <header class="mb-8">
      <p class="text-xs uppercase tracking-[0.28em] text-brand">
        Pôle gaming
      </p>
      <h1
        class="mt-3 font-display text-4xl font-black"
        style="color: var(--text-color);"
      >
        Piloter les tournois du club
      </h1>
      <p class="mt-2 max-w-3xl text-sm text-muted">
        Le gaming est une activité du Club Otaku ENEAM, organisée au même niveau que les autres pôles.
        Depuis ce cockpit : créer un tournoi, figer le seeding, saisir les scores, contrôler les matchs et surveiller
        les points de vigilance.
      </p>
      <div class="mt-5 flex flex-wrap gap-2">
        <UButton
          color="primary"
          icon="i-lucide-plus"
          label="Nouveau tournoi"
          @click="openCreate"
        />
        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-refresh-cw"
          label="Actualiser"
          :loading="refreshPending"
          @click="refreshList"
        />
        <NuxtLink
          to="/dashboard-evenementiel"
          class="gaming-link"
        >
          <UIcon
            name="i-lucide-calendar-days"
            aria-hidden="true"
          />
          Créer un événement de pôle gaming
        </NuxtLink>
      </div>
    </header>

    <div
      v-if="error"
      class="gaming-error surface-solid clip-corner"
      role="alert"
    >
      <div>
        <p
          class="font-semibold"
          style="color: var(--text-color);"
        >
          Impossible de charger les tournois.
        </p>
        <p class="mt-1 text-sm text-muted">
          L’API des tournois n’a pas répondu. Vérifie que la session admin est active, puis réessaie.
        </p>
      </div>
      <UButton
        color="primary"
        variant="soft"
        icon="i-lucide-refresh-cw"
        label="Réessayer"
        @click="refreshList"
      />
    </div>

    <template v-else>
      <section
        class="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Indicateurs des tournois"
      >
        <GamingStatCard
          label="Tournois"
          :value="stats.tournaments"
          :hint="`${stats.completed} terminé${stats.completed > 1 ? 's' : ''}`"
          icon="i-lucide-trophy"
        />
        <GamingStatCard
          label="Équipes engagées"
          :value="stats.teams"
          hint="Toutes équipes et joueurs inscrits"
          icon="i-lucide-users"
        />
        <GamingStatCard
          label="Matchs joués"
          :value="`${stats.played} / ${stats.matches}`"
          :hint="`${playedRate} % du programme réalisé`"
          icon="i-lucide-swords"
          tone="done"
        />
        <GamingStatCard
          label="En direct"
          :value="stats.live"
          :hint="stats.live ? 'Matchs à suivre maintenant' : 'Aucun match en cours'"
          icon="i-lucide-radio"
          :tone="stats.live ? 'active' : 'default'"
        />
      </section>

      <!-- Publication & inscriptions : sans publication, rien n'est visible côté membre. -->
      <section
        class="gaming-publish surface-solid clip-corner mb-6"
        aria-label="Publication et inscriptions des tournois"
      >
        <div class="gaming-publish__head">
          <p class="gaming-publish__title">
            <UIcon
              name="i-lucide-megaphone"
              aria-hidden="true"
            />
            Publication et inscriptions
          </p>
          <p class="gaming-publish__stats">
            {{ publishedCount }} publié<span v-if="publishedCount > 1">s</span> ·
            {{ openRegistrationCount }} inscription<span v-if="openRegistrationCount > 1">s</span> ouverte<span v-if="openRegistrationCount > 1">s</span>
          </p>
        </div>
        <p class="gaming-publish__hint">
          Un tournoi en « Brouillon » n’est visible par AUCUN membre, même avec le lien.
          Passe-le en « Public » pour l’afficher dans la page Tournois, puis active les
          inscriptions pour que les capitaines puissent engager leur équipe en ligne.
        </p>

        <p
          v-if="!tournaments.length"
          class="gaming-publish__empty"
        >
          Crée d’abord un tournoi : il apparaîtra ici pour être publié.
        </p>

        <ul
          v-else
          class="gaming-publish__list"
        >
          <li
            v-for="tournament in tournaments"
            :key="`publish-${tournament.id}`"
            class="gaming-publish__row"
          >
            <div class="gaming-publish__info">
              <p class="gaming-publish__name">
                {{ tournament.name }}
              </p>
              <p class="gaming-publish__meta">
                {{ tournament.game }} · {{ tournament.teams.length }} équipe<span v-if="tournament.teams.length > 1">s</span>
                · {{ tournament.registrationOpen ? 'inscriptions ouvertes' : 'inscriptions fermées' }}
                <span v-if="tournament.maxTeams"> · max {{ tournament.maxTeams }}</span>
              </p>
            </div>

            <div class="gaming-publish__select">
              <AppSelect
                :model-value="tournament.visibility"
                :options="visibilityOptions"
                size="sm"
                icon="i-lucide-eye"
                :disabled="savingVisibilityId === tournament.id"
                :aria-label="`Visibilité du tournoi ${tournament.name}`"
                @change="setVisibility(tournament, $event)"
              />
            </div>

            <div class="gaming-publish__actions">
              <UButton
                color="neutral"
                variant="soft"
                size="sm"
                icon="i-lucide-settings-2"
                label="Réglages"
                @click="openSettings(tournament)"
              />
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-inbox"
                label="Inscriptions"
                @click="openRegistrations(tournament)"
              />
            </div>
          </li>
        </ul>
      </section>

      <section class="mb-6 space-y-4">
        <div class="flex flex-wrap items-center gap-2">
          <div class="min-w-56 flex-1">
            <UInput
              v-model="search"
              icon="i-lucide-search"
              placeholder="Rechercher un tournoi ou un jeu"
              aria-label="Rechercher un tournoi ou un jeu"
              autocomplete="off"
            />
          </div>
          <div class="min-w-44">
            <AppSelect
              v-model="sortBy"
              icon="i-lucide-arrow-up-down"
              variant="filter"
              aria-label="Trier les tournois"
              :options="[
                { value: 'recent', label: 'Plus récents' },
                { value: 'name', label: 'Nom (A → Z)' },
                { value: 'progress', label: 'Avancement' },
                { value: 'teams', label: 'Nombre d’équipes' }
              ]"
            />
          </div>
          <UButton
            color="neutral"
            variant="soft"
            :icon="view === 'cards' ? 'i-lucide-table' : 'i-lucide-layout-grid'"
            :label="view === 'cards' ? 'Vue tableau' : 'Vue cartes'"
            @click="toggleView"
          />
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            v-for="filter in statusFilters"
            :key="filter.value"
            type="button"
            class="pole-filter"
            :class="{ 'pole-filter--active': activeBucket === filter.value }"
            @click="selectBucket(filter.value)"
          >
            {{ filter.label }}
            <span class="pole-filter__count">{{ bucketCounts[filter.value] }}</span>
          </button>
          <button
            v-if="filtersActive"
            type="button"
            class="pole-filter pole-filter--reset"
            @click="resetFilters"
          >
            Réinitialiser
          </button>
        </div>
      </section>

      <div
        v-if="pending"
        class="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
      >
        <USkeleton
          v-for="index in 6"
          :key="index"
          :class="view === 'cards' ? 'h-56' : 'h-14'"
        />
      </div>

      <div
        v-else-if="tournaments.length === 0"
        class="gaming-empty surface-solid clip-corner"
      >
        <UIcon
          name="i-lucide-gamepad-2"
          class="gaming-empty__icon"
          aria-hidden="true"
        />
        <h2 class="gaming-empty__title">
          Aucun tournoi pour l’instant
        </h2>
        <p class="gaming-empty__text">
          Crée le premier tournoi du club : le premier tour d’appariements est généré automatiquement
          dans l’ordre des équipes saisies.
        </p>
        <ol class="gaming-steps">
          <li><span class="gaming-steps__num">1</span> Créer le tournoi et sa liste d’équipes.</li>
          <li><span class="gaming-steps__num">2</span> Ouvrir le cockpit, figer le seeding, vérifier les points de vigilance.</li>
          <li><span class="gaming-steps__num">3</span> Démarrer les matchs, saisir les scores, clôturer.</li>
        </ol>
        <UButton
          class="mt-5"
          color="primary"
          icon="i-lucide-plus"
          label="Créer mon premier tournoi"
          @click="openCreate"
        />
      </div>

      <div
        v-else-if="filtered.length === 0"
        class="gaming-empty surface-solid clip-corner"
      >
        <UIcon
          name="i-lucide-filter-x"
          class="gaming-empty__icon"
          aria-hidden="true"
        />
        <h2 class="gaming-empty__title">
          Aucun tournoi ne correspond à ce filtre
        </h2>
        <p class="gaming-empty__text">
          {{ tournaments.length }} tournoi<span v-if="tournaments.length > 1">s</span> existe<span v-if="tournaments.length === 1">s</span>,
          mais aucun ne correspond à la recherche « {{ search }} » ou au filtre sélectionné.
        </p>
        <UButton
          class="mt-5"
          color="neutral"
          variant="soft"
          icon="i-lucide-rotate-ccw"
          label="Réinitialiser les filtres"
          @click="resetFilters"
        />
      </div>

      <div
        v-else-if="view === 'cards'"
        class="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
      >
        <GamingTournamentCard
          v-for="tournament in pagedTournaments"
          :key="tournament.id"
          :tournament="tournament"
        />
      </div>

      <div
        v-else
        class="gaming-table-wrap surface-solid clip-corner"
      >
        <table class="gaming-table">
          <caption class="sr-only">
            Liste des tournois du club
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                class="gaming-table__left"
              >
                Tournoi
              </th>
              <th scope="col">
                Jeu
              </th>
              <th scope="col">
                Statut
              </th>
              <th scope="col">
                Équipes
              </th>
              <th scope="col">
                Avancement
              </th>
              <th scope="col">
                Cockpit
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="tournament in pagedTournaments"
              :key="tournament.id"
            >
              <td class="gaming-table__left">
                {{ tournament.name }}
              </td>
              <td>{{ tournament.game }}</td>
              <td>
                <GamingStatusBadge :status="tournament.status" />
              </td>
              <td>{{ tournament.teams.length }}</td>
              <td>
                {{ tournament.matches.filter(isPlayed).length }} / {{ tournament.matches.length }}
              </td>
              <td>
                <NuxtLink
                  :to="`/gaming-tournoi-${tournament.id}`"
                  class="gaming-link gaming-link--compact"
                >
                  Ouvrir
                </NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <AppPagination
        v-if="!pending && filtered.length > perPage"
        :current-page="page"
        :total-pages="totalPages"
        :item-count="filtered.length"
        item-label="tournoi"
        @page-change="(nextPage) => (page = nextPage)"
      />

      <details class="gaming-guide surface-solid clip-corner">
        <summary class="gaming-guide__summary">
          <span>Quel format pour ton tournoi ? — repères de préparation</span>
          <UIcon
            name="i-lucide-chevron-down"
            class="gaming-guide__chevron"
            aria-hidden="true"
          />
        </summary>
        <div class="gaming-guide__body">
          <p class="text-sm text-muted">
            Le format n’est pas encore enregistré par le back-office : ces repères servent à cadrer la préparation
            (nombre d’équipes à viser, durée à bloquer, garantie de matchs par participant) avant de créer le tournoi.
          </p>
          <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <article
              v-for="format in formats"
              :key="format.code"
              class="gaming-format"
            >
              <p class="gaming-format__code">
                {{ format.code }}
              </p>
              <h3 class="gaming-format__name">
                {{ format.name }}
              </h3>
              <p class="gaming-format__when">
                {{ format.when }}
              </p>
              <p class="gaming-format__risk">
                <UIcon
                  name="i-lucide-triangle-alert"
                  aria-hidden="true"
                />
                {{ format.risk }}
              </p>
            </article>
          </div>
        </div>
      </details>
    </template>

    <GamingTournamentForm
      v-model:open="createOpen"
      @created="handleCreated"
    />

    <GamingTournamentSettingsForm
      v-model:open="settingsOpen"
      :tournament="settingsTournament"
      @updated="handleSettingsUpdated"
    />

    <GamingRegistrationsPanel
      v-model:open="registrationsOpen"
      :tournament="registrationsTournament"
      @updated="handleSettingsUpdated"
    />
  </div>
</template>

<style scoped>
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

/* Fond primaire translucide + texte du thème : lisible dans les 4 combinaisons
   (un texte var(--bg-color) sur fond rouge devient quasi noir en thème sombre). */
.pole-filter--active {
  color: var(--text-color);
  background: rgba(var(--primary-color-rgb), 0.18);
  border-color: var(--primary-color);
  font-weight: 600;
}

.pole-filter__count {
  border-radius: 9999px;
  background: rgba(var(--primary-color-rgb), 0.14);
  padding: 0 0.4rem;
  font-family: var(--font-mono);
  font-size: 0.68rem;
}

.pole-filter--reset {
  border-style: dashed;
}

.gaming-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border-radius: 9999px;
  border: 1px solid var(--border-color);
  padding: 0.45rem 0.9rem;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--text-color);
  text-decoration: none;
  transition: border-color 0.18s ease, transform 0.15s ease;
}

.gaming-link:hover {
  border-color: var(--primary-color);
  transform: translateY(-1px);
}

.gaming-link svg {
  height: 1rem;
  width: 1rem;
  color: var(--accent-color);
}

.gaming-link--compact {
  border: 0;
  padding: 0;
  color: var(--primary-color);
  font-weight: 600;
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
  max-width: 44rem;
  font-size: 0.875rem;
  color: var(--muted-color);
}

.gaming-steps {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.4rem;
  margin-top: 1rem;
  text-align: left;
  font-size: 0.82rem;
  color: var(--text-color);
}

.gaming-steps__num {
  display: inline-flex;
  height: 1.25rem;
  width: 1.25rem;
  align-items: center;
  justify-content: center;
  margin-right: 0.4rem;
  border-radius: 9999px;
  background: rgba(var(--primary-color-rgb), 0.16);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--primary-color);
}

.gaming-table-wrap {
  overflow-x: auto;
}

.gaming-table {
  width: 100%;
  min-width: 40rem;
  border-collapse: collapse;
  font-size: 0.82rem;
  color: var(--text-color);
}

.gaming-table th,
.gaming-table td {
  padding: 0.6rem 0.7rem;
  text-align: center;
  border-bottom: 1px solid var(--border-color);
  white-space: nowrap;
}

.gaming-table thead th {
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted-color);
  background: rgba(var(--primary-color-rgb), 0.05);
}

.gaming-table__left {
  text-align: left;
}

.gaming-table tbody tr:last-child td {
  border-bottom: 0;
}

.gaming-table tbody tr:hover td {
  background: rgba(var(--primary-color-rgb), 0.05);
}

.gaming-pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem 1rem;
  margin-top: 1.5rem;
  color: var(--muted-color);
}

.gaming-pagination__label {
  font-size: 0.8rem;
}

.gaming-guide {
  margin-top: 2rem;
  padding: 0;
  overflow: hidden;
}

.gaming-guide__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  cursor: pointer;
  padding: 1rem 1.1rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-color);
  list-style: none;
}

.gaming-guide__summary::-webkit-details-marker {
  display: none;
}

.gaming-guide__chevron {
  height: 1rem;
  width: 1rem;
  flex: none;
  color: var(--accent-color);
  transition: transform 0.2s ease;
}

.gaming-guide[open] .gaming-guide__chevron {
  transform: rotate(180deg);
}

.gaming-guide__body {
  border-top: 1px solid var(--border-color);
  padding: 1rem 1.1rem 1.2rem;
}

.gaming-format {
  border: 1px solid rgba(var(--primary-color-rgb), 0.18);
  background: rgba(var(--primary-color-rgb), 0.03);
  padding: 0.8rem 0.9rem;
}

.gaming-format__code {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.16em;
  color: var(--accent-color);
}

.gaming-format__name {
  margin-top: 0.2rem;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-color);
}

.gaming-format__when {
  margin-top: 0.35rem;
  font-size: 0.8rem;
  color: var(--text-color);
}

.gaming-format__risk {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  margin-top: 0.4rem;
  font-size: 0.75rem;
  color: var(--muted-color);
}

.gaming-format__risk svg {
  height: 0.9rem;
  width: 0.9rem;
  flex: none;
  margin-top: 0.1rem;
  color: var(--primary-color);
}

@media (min-width: 640px) {
  .gaming-steps {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

/* ---------- Publication & inscriptions ---------- */
.gaming-publish {
  border: 1px solid rgba(var(--primary-color-rgb), 0.24);
  padding: 1rem 1.1rem;
}

.gaming-publish__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.gaming-publish__title {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent-color);
}

.gaming-publish__title svg {
  height: 0.95rem;
  width: 0.95rem;
}

.gaming-publish__stats {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--muted-color);
}

.gaming-publish__hint {
  margin-top: 0.5rem;
  max-width: 60rem;
  font-size: 0.78rem;
  color: var(--muted-color);
}

.gaming-publish__empty {
  margin-top: 0.85rem;
  font-size: 0.82rem;
  color: var(--muted-color);
}

.gaming-publish__list {
  display: grid;
  gap: 0.5rem;
  margin-top: 0.9rem;
}

.gaming-publish__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  background: rgba(var(--primary-color-rgb), 0.04);
  padding: 0.6rem 0.75rem;
}

.gaming-publish__info {
  min-width: 12rem;
  flex: 1 1 16rem;
}

.gaming-publish__name {
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--text-color);
}

.gaming-publish__meta {
  margin-top: 0.15rem;
  font-size: 0.75rem;
  color: var(--muted-color);
}

.gaming-publish__select {
  min-width: 11rem;
  flex: 0 1 13rem;
}

.gaming-publish__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
</style>
