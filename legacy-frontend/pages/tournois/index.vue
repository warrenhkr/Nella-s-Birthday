<script setup lang="ts">
// Le texte riche est stocké en HTML : pour un APERÇU sur deux lignes (cartes de
// la liste), on affiche le TEXTE (balises retirées) — la mise en forme ne
// tiendrait de toute façon pas dans la carte, et `-webkit-line-clamp` compte
// mal les lignes à travers des blocs imbriqués.
import { htmlToPlainText } from '#shared/rich-text'

// ============================================================
// /tournois — la liste des tournois vue par un MEMBRE.
//
// Cette page manquait totalement : il n'existait que le cockpit admin
// (`dashboard-gaming.vue`, middleware 'admin'), donc un membre ne pouvait
// voir aucun tournoi. Ici on lit `/api/tournaments/public`, qui ne renvoie
// QUE les tournois publiés (`visibility = 'PUBLIC'`).
//
// Garde : `middleware: 'auth'` (membre connecté), PAS 'admin'.
// ============================================================
definePageMeta({ middleware: 'auth' })

type TournamentSummary = {
  id: string
  name: string
  game: string
  status: string
  visibility: string
  format: string | null
  description: string | null
  startDate: string | null
  endDate: string | null
  registrationOpen: boolean
  maxTeams: number | null
  teamCount: number
  matchCount: number
}

type Etat = 'upcoming' | 'ongoing' | 'finished'
type EtatFilter = Etat | 'all'

const { data: response, pending, error, refresh } = await useFetch<{ data: TournamentSummary[] }>('/api/tournaments/public')

const tournaments = computed<TournamentSummary[]>(() => response.value?.data || [])

const search = ref('')
const gameFilter = ref('')
const stateFilter = ref<EtatFilter>('all')
// Section « Terminés » repliée par défaut (plus discrète) — décision du propriétaire.
const showFinished = ref(false)

const gameOptions = computed(() => {
  const games = [...new Set(tournaments.value.map(tournament => tournament.game).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'fr'))
  return [
    { value: '', label: 'Tous les jeux' },
    ...games.map(game => ({ value: game, label: game }))
  ]
})

// L'état affiché au membre est DÉRIVÉ (le statut en base peut rester « draft »
// longtemps) : on combine le statut, la date de début et la date de fin.
// Aucune valeur inventée : sans date ni statut parlant, le tournoi est « à venir ».
function etatOf(tournament: TournamentSummary): Etat {
  const status = (tournament.status || '').trim().toLowerCase()
  if (['completed', 'archived', 'cancelled'].includes(status)) return 'finished'
  if (['in_progress', 'live', 'paused', 'checkin', 'seeding'].includes(status)) return 'ongoing'

  const now = Date.now()
  const start = tournament.startDate ? new Date(tournament.startDate).getTime() : null
  const end = tournament.endDate ? new Date(tournament.endDate).getTime() : null

  if (end !== null && end < now) return 'finished'
  if (start !== null && start <= now && (end === null || end >= now)) return 'ongoing'
  return 'upcoming'
}

const ETAT_META: Record<Etat, { label: string, icon: string }> = {
  upcoming: { label: 'À venir', icon: 'i-lucide-calendar-days' },
  ongoing: { label: 'En cours', icon: 'i-lucide-radio' },
  finished: { label: 'Terminé', icon: 'i-lucide-flag' }
}

const stateFilters: Array<{ value: EtatFilter, label: string, icon: string }> = [
  { value: 'all', label: 'Tous', icon: 'i-lucide-list-filter' },
  { value: 'upcoming', label: 'À venir', icon: 'i-lucide-calendar-days' },
  { value: 'ongoing', label: 'En cours', icon: 'i-lucide-radio' },
  { value: 'finished', label: 'Terminés', icon: 'i-lucide-flag' }
]

function countFor(value: EtatFilter) {
  if (value === 'all') return tournaments.value.length
  return tournaments.value.filter(tournament => etatOf(tournament) === value).length
}

const filteredTournaments = computed(() => tournaments.value.filter((tournament) => {
  if (gameFilter.value && tournament.game !== gameFilter.value) return false
  if (stateFilter.value !== 'all' && etatOf(tournament) !== stateFilter.value) return false

  const term = search.value.trim().toLowerCase()
  if (!term) return true
  return tournament.name.toLowerCase().includes(term)
    || tournament.game.toLowerCase().includes(term)
    || (tournament.format || '').toLowerCase().includes(term)
    || htmlToPlainText(tournament.description || '').toLowerCase().includes(term)
}))

// ------------------------------------------------------------
// Séparation « ce qui est jouable » / « archives » (décision du
// propriétaire) : les tournois terminés ne noient plus les tournois à
// venir ou en cours. Le statut en base n'est PAS inventé : on réutilise
// l'état dérivé `etatOf` (statut + dates).
// ------------------------------------------------------------
function isFinished(tournament: TournamentSummary) {
  return etatOf(tournament) === 'finished'
}

// Clé de tri : début sinon fin ; sans date, le tournoi passe en dernier.
function sortTime(tournament: TournamentSummary) {
  const value = tournament.startDate || tournament.endDate
  const time = value ? new Date(value).getTime() : 0
  return Number.isNaN(time) ? 0 : time
}

// Bloc principal : en cours d'abord (à suivre maintenant), puis à venir par
// date la plus proche. `filter` renvoie un nouveau tableau : le tri ne
// modifie pas la source des filtres.
const activeTournaments = computed(() => filteredTournaments.value
  .filter(tournament => !isFinished(tournament))
  .sort((a, b) => {
    const rank = (tournament: TournamentSummary) => (etatOf(tournament) === 'ongoing' ? 0 : 1)
    return rank(a) - rank(b) || sortTime(a) - sortTime(b)
  }))

// Bloc archives : le plus récent d'abord.
const finishedTournaments = computed(() => filteredTournaments.value
  .filter(isFinished)
  .sort((a, b) => sortTime(b) - sortTime(a)))

// Section terminés : repliée par défaut, mais dépliée dès qu'il n'y a rien
// de jouable à afficher (sinon un visiteur verrait une page vide).
const finishedExpanded = computed(() => showFinished.value || activeTournaments.value.length === 0)

// Blocs affichés, dans l'ordre : « À venir et en cours », puis « Terminés ».
const blocks = computed(() => {
  const list: Array<{
    key: string
    eyebrow: string
    title: string
    desc: string
    finished: boolean
    items: TournamentSummary[]
  }> = []

  if (activeTournaments.value.length) {
    list.push({
      key: 'actifs',
      eyebrow: 'Compétition',
      title: 'À venir et en cours',
      desc: 'Les tournois ouverts du club : ouvre une fiche pour le bracket et le classement.',
      finished: false,
      items: activeTournaments.value
    })
  }

  if (finishedTournaments.value.length) {
    list.push({
      key: 'archives',
      eyebrow: 'Archives',
      title: 'Terminés',
      desc: 'Tournois clôturés, conservés pour l’historique et les résultats.',
      finished: true,
      items: finishedTournaments.value
    })
  }

  return list
})

const hasPublishedTournaments = computed(() => tournaments.value.length > 0)
const hasActiveFilters = computed(() => Boolean(search.value.trim()) || Boolean(gameFilter.value) || stateFilter.value !== 'all')

function resetFilters() {
  search.value = ''
  gameFilter.value = ''
  stateFilter.value = 'all'
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

function formatDate(value?: string | null) {
  return value ? dateFormatter.format(new Date(value)) : null
}

function formatRange(tournament: TournamentSummary) {
  const start = formatDate(tournament.startDate)
  const end = formatDate(tournament.endDate)
  if (start && end) return `${start} → ${end}`
  if (start) return `Dès le ${start}`
  if (end) return `Jusqu’au ${end}`
  return 'Dates à confirmer'
}

function teamsLabel(tournament: TournamentSummary) {
  const count = `${tournament.teamCount} équipe${tournament.teamCount > 1 ? 's' : ''}`
  return tournament.maxTeams ? `${count} / ${tournament.maxTeams}` : count
}

function matchesLabel(tournament: TournamentSummary) {
  return `${tournament.matchCount} match${tournament.matchCount > 1 ? 's' : ''}`
}
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-10 sm:py-14 lg:px-8">
    <!-- En-tête -->
    <header class="mb-8">
      <p class="text-xs uppercase tracking-[0.28em] text-accent-otaku">
        Gaming
      </p>
      <h1
        class="mt-3 font-display text-4xl font-black"
        style="color: var(--text-color);"
      >
        Tournois du club
      </h1>
      <p class="mt-3 max-w-2xl text-sm text-muted">
        Retrouve ici les tournois ouverts au club : format, dates, équipes engagées,
        bracket et classement. Chaque fiche est en lecture seule — pour t’inscrire,
        contacte l’organisation.
      </p>
    </header>

    <!-- Barre de filtres -->
    <div class="tournois-toolbar surface-solid clip-corner mb-7">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Rechercher un tournoi, un jeu…"
        aria-label="Rechercher un tournoi"
        class="w-full sm:max-w-xs"
      />

      <AppSelect
        v-model="gameFilter"
        :options="gameOptions"
        label="Jeu"
        icon="i-lucide-gamepad-2"
        variant="filter"
        size="sm"
      />

      <div class="flex flex-wrap gap-2">
        <button
          v-for="filter in stateFilters"
          :key="filter.value"
          type="button"
          class="pole-filter"
          :class="{ 'pole-filter--active': stateFilter === filter.value }"
          @click="stateFilter = filter.value"
        >
          <UIcon
            :name="filter.icon"
            class="h-3.5 w-3.5"
            aria-hidden="true"
          />
          {{ filter.label }}
          <span class="pole-filter__count">{{ countFor(filter.value) }}</span>
        </button>
      </div>

      <UButton
        v-if="hasActiveFilters"
        color="neutral"
        variant="ghost"
        size="sm"
        icon="i-lucide-rotate-ccw"
        label="Réinitialiser"
        class="sm:ml-auto"
        @click="resetFilters"
      />
    </div>

    <!-- Chargement : squelettes -->
    <div
      v-if="pending"
      class="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
      aria-hidden="true"
    >
      <USkeleton
        v-for="index in 6"
        :key="index"
        class="h-56 rounded-2xl"
      />
    </div>

    <!-- Erreur réseau -->
    <div
      v-else-if="error"
      class="surface-solid clip-corner p-8 text-center"
    >
      <UIcon
        name="i-lucide-circle-question-mark"
        class="mx-auto h-8 w-8 text-accent-otaku"
        aria-hidden="true"
      />
      <p class="mt-3 text-sm text-muted">
        Les tournois sont momentanément indisponibles. Réessaie dans un instant.
      </p>
      <UButton
        class="mt-4"
        color="primary"
        variant="soft"
        icon="i-lucide-rotate-ccw"
        label="Réessayer"
        @click="refresh()"
      />
    </div>

    <!-- Aucun tournoi publié -->
    <div
      v-else-if="!hasPublishedTournaments"
      class="surface-solid clip-corner p-10 text-center"
    >
      <UIcon
        name="i-lucide-trophy"
        class="mx-auto h-9 w-9 text-accent-otaku"
        aria-hidden="true"
      />
      <p
        class="mt-4 font-display text-lg font-bold"
        style="color: var(--text-color);"
      >
        Aucun tournoi publié pour le moment
      </p>
      <p class="mx-auto mt-2 max-w-md text-sm text-muted">
        Les tournois apparaissent ici dès que l’équipe du club les rend publics.
      </p>
      <UButton
        to="/evenements"
        class="mt-5"
        color="primary"
        variant="soft"
        icon="i-lucide-calendar-days"
        label="Voir les événements du club"
      />
    </div>

    <!-- Aucun résultat pour ces filtres -->
    <div
      v-else-if="!filteredTournaments.length"
      class="surface-solid clip-corner p-10 text-center"
    >
      <UIcon
        name="i-lucide-search"
        class="mx-auto h-8 w-8 text-accent-otaku"
        aria-hidden="true"
      />
      <p class="mt-4 text-sm text-muted">
        Aucun tournoi ne correspond à ta recherche ou à ces filtres.
      </p>
      <UButton
        class="mt-4"
        color="primary"
        variant="soft"
        icon="i-lucide-rotate-ccw"
        label="Réinitialiser les filtres"
        @click="resetFilters"
      />
    </div>

    <!-- Deux blocs : « À venir et en cours », puis « Terminés » (archives). -->
    <template v-else>
      <section
        v-for="block in blocks"
        :key="block.key"
        class="tournois-block"
        :class="{ 'tournois-block--archive': block.finished }"
        :aria-labelledby="`tournois-${block.key}-titre`"
      >
        <header class="tournois-block__head">
          <p class="section-eyebrow">
            {{ block.eyebrow }}
          </p>
          <div class="tournois-block__title-row">
            <h2
              :id="`tournois-${block.key}-titre`"
              class="section-title section-title--sub"
            >
              {{ block.title }}
            </h2>
            <button
              v-if="block.finished && activeTournaments.length"
              type="button"
              class="tournois-archive-toggle"
              :aria-expanded="finishedExpanded"
              aria-controls="tournois-archives-liste"
              @click="showFinished = !showFinished"
            >
              <UIcon
                :name="finishedExpanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                class="h-4 w-4"
                aria-hidden="true"
              />
              {{ finishedExpanded ? 'Masquer' : 'Afficher' }}
              les {{ block.items.length }} tournoi{{ block.items.length > 1 ? 's' : '' }} terminé{{ block.items.length > 1 ? 's' : '' }}
            </button>
          </div>
          <p class="section-desc">
            {{ block.desc }}
          </p>
        </header>

        <div
          v-show="!block.finished || finishedExpanded"
          :id="block.finished ? 'tournois-archives-liste' : undefined"
          class="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
        >
          <NuxtLink
            v-for="tournament in block.items"
            :key="tournament.id"
            :to="`/tournois/${tournament.id}`"
            class="tournoi-card surface-solid clip-corner"
          >
            <div class="tournoi-card__head">
              <span class="tournoi-card__game">
                <UIcon
                  name="i-lucide-gamepad-2"
                  class="h-3.5 w-3.5"
                  aria-hidden="true"
                />
                {{ tournament.game }}
              </span>
              <span
                class="tournoi-etat"
                :class="`tournoi-etat--${etatOf(tournament)}`"
              >
                <UIcon
                  :name="ETAT_META[etatOf(tournament)].icon"
                  class="h-3 w-3"
                  aria-hidden="true"
                />
                {{ ETAT_META[etatOf(tournament)].label }}
              </span>
            </div>

            <h2 class="tournoi-card__title">
              {{ tournament.name }}
            </h2>

            <p
              v-if="tournament.description"
              class="tournoi-card__desc"
            >
              {{ htmlToPlainText(tournament.description || '') }}
            </p>

            <dl class="tournoi-card__meta">
              <div>
                <dt>Dates</dt>
                <dd>{{ formatRange(tournament) }}</dd>
              </div>
              <div v-if="tournament.format">
                <dt>Format</dt>
                <dd>{{ tournament.format }}</dd>
              </div>
              <div>
                <dt>Équipes</dt>
                <dd>{{ teamsLabel(tournament) }}</dd>
              </div>
              <div>
                <dt>Matchs</dt>
                <dd>{{ matchesLabel(tournament) }}</dd>
              </div>
            </dl>

            <div class="tournoi-card__foot">
              <!-- Tournoi terminé : aucun appel à l’inscription (état cohérent). -->
              <template v-if="isFinished(tournament)">
                <span class="tournoi-card__closed">
                  <UIcon
                    name="i-lucide-flag"
                    class="h-3.5 w-3.5"
                    aria-hidden="true"
                  />
                  Tournoi terminé
                </span>
              </template>
              <template v-else>
                <GamingStatusBadge
                  v-if="tournament.status && tournament.status !== 'draft'"
                  :status="tournament.status"
                />
                <span
                  v-if="tournament.registrationOpen"
                  class="tournoi-card__open"
                >
                  <UIcon
                    name="i-lucide-ticket"
                    class="h-3.5 w-3.5"
                    aria-hidden="true"
                  />
                  Inscriptions ouvertes
                </span>
                <span
                  v-else
                  class="tournoi-card__closed"
                >
                  <UIcon
                    name="i-lucide-lock"
                    class="h-3.5 w-3.5"
                    aria-hidden="true"
                  />
                  Inscriptions fermées
                </span>
              </template>

              <span class="tournoi-card__more">
                Voir la fiche
                <UIcon
                  name="i-lucide-chevron-right"
                  class="h-4 w-4"
                  aria-hidden="true"
                />
              </span>
            </div>
          </NuxtLink>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.tournois-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.85rem;
  padding: 1rem 1.15rem;
}

/* ---------- En-têtes de blocs (classes maison recopiées à l’identique) ---------- */
.section-eyebrow {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--primary-color);
}

.section-title {
  margin-top: 0.3rem;
  font-family: var(--font-display);
  font-size: clamp(1.6rem, 3vw, 2.25rem);
  font-weight: 900;
  color: var(--text-color);
}

.section-title--sub {
  font-size: clamp(1.2rem, 2.3vw, 1.5rem);
  font-weight: 800;
}

.section-desc {
  margin-top: 0.35rem;
  max-width: 62ch;
  font-size: 0.875rem;
  color: var(--muted-color);
}

.tournois-block + .tournois-block {
  margin-top: 2.5rem;
  padding-top: 2rem;
  border-top: 1px solid var(--border-color);
}

.tournois-block__head {
  margin-bottom: 1.1rem;
}

.tournois-block__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

/* Bloc archives : légèrement atténué pour passer au second plan. */
.tournois-block--archive .section-eyebrow {
  color: var(--muted-color);
}

.tournois-block--archive .tournoi-card {
  opacity: 0.92;
}

.tournois-archive-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 2.75rem;
  border-radius: 9999px;
  border: 1px dashed var(--border-color);
  padding: 0.35rem 0.9rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--muted-color);
  background: transparent;
  cursor: pointer;
  transition: border-color 0.18s ease, color 0.18s ease;
}

.tournois-archive-toggle:hover {
  border-color: rgba(var(--primary-color-rgb), 0.5);
  color: var(--text-color);
}

.tournois-archive-toggle:focus-visible {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(var(--primary-color-rgb), 0.24);
}

/* ---------- Cartes ---------- */
.tournoi-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.65rem;
  padding: 1.15rem;
  text-decoration: none;
  color: var(--text-color);
  border: 1px solid rgba(var(--primary-color-rgb), 0.18);
  background: linear-gradient(180deg, rgba(var(--primary-color-rgb), 0.04), var(--panel-color-solid));
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.2s ease;
}

.tournoi-card:hover,
.tournoi-card:focus-visible {
  outline: none;
  transform: translateY(-3px);
  border-color: var(--primary-color);
  box-shadow: 0 18px 34px -26px rgba(var(--primary-color-rgb), 0.95);
}

.tournoi-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.tournoi-card__game {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent-color);
}

.tournoi-card__title {
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 800;
  line-height: 1.25;
  color: var(--text-color);
}

.tournoi-card__desc {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  font-size: 0.85rem;
  color: var(--muted-color);
}

.tournoi-card__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.4rem 0.75rem;
  margin-top: 0.15rem;
}

.tournoi-card__meta dt {
  font-size: 0.62rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted-color);
}

.tournoi-card__meta dd {
  font-size: 0.82rem;
  color: var(--text-color);
}

.tournoi-card__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: auto;
  border-top: 1px solid var(--border-color);
  padding-top: 0.7rem;
}

.tournoi-card__open,
.tournoi-card__closed {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.72rem;
  font-weight: 600;
}

.tournoi-card__open {
  color: var(--primary-color);
}

.tournoi-card__closed {
  color: var(--muted-color);
}

.tournoi-card__more {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  margin-left: auto;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-color);
  opacity: 0.75;
}

.tournoi-card:hover .tournoi-card__more {
  color: var(--primary-color);
  opacity: 1;
}

/* ---------- Pastille d'état ---------- */
.tournoi-etat {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: 1px solid var(--border-color);
  border-radius: 9999px;
  padding: 0.15rem 0.55rem;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  color: var(--muted-color);
  background: transparent;
}

.tournoi-etat--upcoming {
  border-color: rgba(var(--accent-color-rgb), 0.45);
  color: var(--accent-color);
  background: rgba(var(--accent-color-rgb), 0.1);
}

.tournoi-etat--ongoing {
  border-color: rgba(var(--primary-color-rgb), 0.5);
  color: var(--primary-color);
  background: rgba(var(--primary-color-rgb), 0.12);
}

.tournoi-etat--finished {
  border-style: dashed;
  color: var(--muted-color);
  background: transparent;
}

/* ---------- Filtres (classe maison .pole-filter) ---------- */
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

/* Fond primaire translucide + texte du thème : lisible dans les 4 combinaisons. */
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
</style>
