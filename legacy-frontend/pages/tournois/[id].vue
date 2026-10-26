<script setup lang="ts">
// ============================================================
// /tournois/:id — la fiche d'un tournoi vue par un MEMBRE.
//
// Lecture seule : en-tête (jeu, format, dates, équipes, état), bracket,
// classement et liste des matchs. Aucun bouton d'écriture, aucune donnée
// d'administration — le cockpit admin reste `gaming-tournoi-[id].vue`.
//
// Visibilité : l'endpoint de détail ne renvoie que les tournois PUBLIC
// (un membre reçoit 403 sur un tournoi non public). Dans ce cas, on retombe
// proprement sur `/api/tournaments/public?id=…`, qui autorise un tournoi
// UNLISTED demandé EXPLICITEMENT (partage par lien) : on affiche alors
// l'en-tête, sans divulguer équipes, bracket ni classement.
//
// Garde : `middleware: 'auth'` (membre connecté), PAS 'admin'.
// ============================================================
definePageMeta({ middleware: 'auth' })

type VersusTeam = { id: string, name: string, seed: number | null }
type TournamentMatch = {
  id: string
  round: number
  position: number
  status: string
  scoreHome: number | null
  scoreAway: number | null
  homeTeam: VersusTeam | null
  awayTeam: VersusTeam | null
}
type TournamentDetail = {
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
  teams: VersusTeam[]
  matches: TournamentMatch[]
}
type TournamentSummary = Omit<TournamentDetail, 'teams' | 'matches'>
type PageData = { detail: TournamentDetail | null, summary: TournamentSummary | null, restricted: boolean }

const route = useRoute()
const tournamentId = computed(() => String(route.params.id || ''))

// useRequestFetch : transmet les cookies de session quand la page est rendue
// côté serveur (sinon requireAuth renverrait 401 en SSR).
const requestFetch = useRequestFetch()

const { data, pending, error, refresh } = await useAsyncData<PageData>(
  'tournoi-public-detail',
  async () => {
    try {
      const response = await requestFetch<{ data: TournamentDetail }>(`/api/tournaments/${encodeURIComponent(tournamentId.value)}/public`)
      return { detail: response.data, summary: null, restricted: false }
    } catch (err) {
      const failure = err as { statusCode?: number, response?: { status?: number } }
      const status = failure?.statusCode ?? failure?.response?.status
      if (status !== 403 && status !== 404) throw err

      // Tournoi non public : on tente l'accès « par lien » (UNLISTED accepté
      // uniquement en demandant explicitement cet identifiant). Un brouillon
      // reste inaccessible : on n'affiche alors rien du tout.
      try {
        const fallback = await requestFetch<{ data: TournamentSummary | null }>('/api/tournaments/public', {
          query: { id: tournamentId.value }
        })
        return { detail: null, summary: fallback.data ?? null, restricted: Boolean(fallback.data) }
      } catch {
        return { detail: null, summary: null, restricted: false }
      }
    }
  },
  { watch: [tournamentId] }
)

const detail = computed(() => data.value?.detail ?? null)
const summary = computed(() => data.value?.summary ?? null)
const restricted = computed(() => Boolean(data.value?.restricted))
const found = computed(() => Boolean(detail.value || summary.value))

// En-tête : alimenté par le détail complet, ou par le résumé si l'accès est limité.
const header = computed<TournamentDetail | TournamentSummary | null>(() => detail.value || summary.value)

const teams = computed<VersusTeam[]>(() => detail.value?.teams ?? [])
const matches = computed<TournamentMatch[]>(() => detail.value?.matches ?? [])

type Etat = 'upcoming' | 'ongoing' | 'finished'

function etatOf(tournament: TournamentDetail | TournamentSummary): Etat {
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

const etat = computed(() => (header.value ? etatOf(header.value) : 'upcoming'))
const etatMeta = computed(() => ETAT_META[etat.value])

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

function formatDate(value?: string | null) {
  return value ? dateFormatter.format(new Date(value)) : null
}

function formatRange(tournament: TournamentDetail | TournamentSummary) {
  const start = formatDate(tournament.startDate)
  const end = formatDate(tournament.endDate)
  if (start && end) return `${start} → ${end}`
  if (start) return `Dès le ${start}`
  if (end) return `Jusqu’au ${end}`
  return 'Dates à confirmer'
}

function teamsLabel(tournament: TournamentDetail | TournamentSummary) {
  const count = `${tournament.teamCount} équipe${tournament.teamCount > 1 ? 's' : ''}`
  return tournament.maxTeams ? `${count} / ${tournament.maxTeams}` : count
}

// ---------- Regroupement des matchs par tour ----------
const totalRounds = computed(() => matches.value.reduce((max, match) => Math.max(max, match.round), 0))

const participantCount = computed(() => {
  const names = new Set<string>()
  for (const match of matches.value) {
    if (match.homeTeam) names.add(match.homeTeam.name)
    if (match.awayTeam) names.add(match.awayTeam.name)
  }
  return names.size
})

const expectedRounds = computed(() => Math.max(1, Math.ceil(Math.log2(Math.max(participantCount.value, 2)))))
const bracketComplete = computed(() => totalRounds.value >= expectedRounds.value)

function roundLabel(round: number) {
  // Bracket incomplet (l'API ne génère que le premier tour) : on annonce un
  // numéro de tour sur le total attendu, jamais une « Finale » trompeuse.
  if (!bracketComplete.value) return `Tour ${round} / ${expectedRounds.value}`
  const fromEnd = totalRounds.value - round
  if (fromEnd === 0) return 'Finale'
  if (fromEnd === 1) return 'Demi-finales'
  if (fromEnd === 2) return 'Quarts de finale'
  if (fromEnd === 3) return 'Huitièmes'
  return `Tour ${round}`
}

const matchGroups = computed(() => {
  const buckets = new Map<number, TournamentMatch[]>()
  for (const match of matches.value) {
    const bucket = buckets.get(match.round)
    if (bucket) bucket.push(match)
    else buckets.set(match.round, [match])
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([round, items]) => ({
      round,
      label: roundLabel(round),
      matches: [...items].sort((a, b) => a.position - b.position)
    }))
})

// ---------- Inscription en ligne (Lot 3) ----------
// « S'inscrire avec mon équipe » : on liste MES équipes dont je suis
// capitaine, et on envoie POST /api/tournaments/:id/register.
type MyTeamRegistration = { id: string, status: string, tournament: { id: string } }
type MyTeam = {
  id: string
  name: string
  logoUrl: string | null
  isCaptain: boolean
  memberCount: number
  tournament: { id: string } | null
  registrations: MyTeamRegistration[]
}

const { success, alert } = useGameToast()
const { data: teamsResponse, refresh: refreshTeams } = await useFetch<{ data: MyTeam[] }>('/api/teams')

const myTeams = computed<MyTeam[]>(() => teamsResponse.value?.data || [])
const captainedTeams = computed(() => myTeams.value.filter(team => team.isCaptain))

function registrationOf(team: MyTeam) {
  return team.registrations.find(registration => registration.tournament.id === tournamentId.value) || null
}

function isEngaged(team: MyTeam) {
  return team.tournament?.id === tournamentId.value
}

const registerableTeams = computed(() => captainedTeams.value.filter(team => !registrationOf(team) && !isEngaged(team)))

const registeredTeams = computed(() => captainedTeams.value
  .map(team => ({ team, registration: registrationOf(team), engaged: isEngaged(team) }))
  .filter(entry => entry.registration || entry.engaged))

const registerOptions = computed(() => registerableTeams.value.map(team => ({
  value: team.id,
  label: `${team.name} — ${team.memberCount} joueur${team.memberCount > 1 ? 's' : ''}`
})))

const selectedTeamId = ref('')
const registering = ref(false)

const REGISTRATION_STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente de validation par l’organisation',
  APPROVED: 'Inscription acceptée',
  REJECTED: 'Inscription refusée'
}

async function registerSelectedTeam() {
  if (!selectedTeamId.value) {
    alert('Sélectionne l’équipe à inscrire.')
    return
  }
  registering.value = true
  try {
    await $fetch(`/api/tournaments/${encodeURIComponent(tournamentId.value)}/register`, {
      method: 'POST',
      body: { teamId: selectedTeamId.value }
    })
    success('Demande d’inscription envoyée : l’organisation du club la validera.')
    selectedTeamId.value = ''
    await Promise.all([refreshTeams(), refresh()])
  } catch (registrationError: unknown) {
    const failure = registrationError as { data?: { statusMessage?: string } }
    alert(failure?.data?.statusMessage || 'Impossible d’inscrire cette équipe.')
  } finally {
    registering.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-10 sm:py-14 lg:px-8">
    <NuxtLink
      to="/tournois"
      class="tournoi-back"
    >
      <UIcon
        name="i-lucide-arrow-left"
        class="h-4 w-4"
        aria-hidden="true"
      />
      Tous les tournois
    </NuxtLink>

    <!-- Chargement -->
    <div
      v-if="pending"
      class="mt-6 space-y-5"
      aria-hidden="true"
    >
      <USkeleton class="h-44 rounded-2xl" />
      <USkeleton class="h-64 rounded-2xl" />
      <USkeleton class="h-64 rounded-2xl" />
    </div>

    <!-- Erreur réseau -->
    <div
      v-else-if="error"
      class="surface-solid clip-corner mt-6 p-8 text-center"
    >
      <UIcon
        name="i-lucide-circle-question-mark"
        class="mx-auto h-8 w-8 text-accent-otaku"
        aria-hidden="true"
      />
      <p class="mt-3 text-sm text-muted">
        Impossible de charger ce tournoi pour l’instant.
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

    <!-- Introuvable / non divulgué -->
    <div
      v-else-if="!found"
      class="surface-solid clip-corner mt-6 p-10 text-center"
    >
      <UIcon
        name="i-lucide-circle-slash"
        class="mx-auto h-9 w-9 text-accent-otaku"
        aria-hidden="true"
      />
      <p
        class="mt-4 font-display text-lg font-bold"
        style="color: var(--text-color);"
      >
        Tournoi introuvable
      </p>
      <p class="mx-auto mt-2 max-w-md text-sm text-muted">
        Ce tournoi n’existe pas ou n’est plus accessible.
      </p>
      <UButton
        to="/tournois"
        class="mt-5"
        color="primary"
        variant="soft"
        icon="i-lucide-arrow-left"
        label="Retour à la liste"
      />
    </div>

    <template v-else-if="header">
      <!-- En-tête du tournoi -->
      <header class="surface-solid clip-corner mt-6 p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="text-xs uppercase tracking-[0.28em] text-accent-otaku">
              {{ header.game }}
            </p>
            <h1
              class="mt-2 font-display text-3xl font-black sm:text-4xl"
              style="color: var(--text-color);"
            >
              {{ header.name }}
            </h1>
            <RichTextContent
              v-if="header.description"
              class="mt-3 max-w-3xl text-sm text-muted"
              :content="header.description"
              label="Description du tournoi"
            />
          </div>

          <div class="flex flex-col items-start gap-2 sm:items-end">
            <span
              class="tournoi-etat"
              :class="`tournoi-etat--${etat}`"
            >
              <UIcon
                :name="etatMeta.icon"
                class="h-3 w-3"
                aria-hidden="true"
              />
              {{ etatMeta.label }}
            </span>
            <GamingStatusBadge
              v-if="header.status && header.status !== 'draft'"
              :status="header.status"
            />
          </div>
        </div>

        <dl class="tournoi-hero__meta">
          <div>
            <dt>Format</dt>
            <dd>{{ header.format || 'À confirmer' }}</dd>
          </div>
          <div>
            <dt>Dates</dt>
            <dd>{{ formatRange(header) }}</dd>
          </div>
          <div>
            <dt>Équipes</dt>
            <dd>{{ teamsLabel(header) }}</dd>
          </div>
          <div>
            <dt>Matchs</dt>
            <dd>{{ header.matchCount }}</dd>
          </div>
        </dl>
      </header>

      <!-- Accès limité (tournoi non public partagé par lien) -->
      <div
        v-if="restricted"
        class="tournoi-banner tournoi-banner--info mt-5"
      >
        <UIcon
          name="i-lucide-lock"
          class="h-5 w-5"
          aria-hidden="true"
        />
        <div>
          <p class="tournoi-banner__title">
            Fiche non publique
          </p>
          <p class="tournoi-banner__text">
            Ce tournoi n’est pas publié dans la liste : seuls son nom, ses dates et son format
            sont affichés. Les équipes, le bracket et le classement ne sont pas divulgués.
          </p>
        </div>
      </div>

      <!-- Tournoi terminé : plus aucune inscription (état cohérent). -->
      <div
        v-else-if="etat === 'finished'"
        class="tournoi-banner tournoi-banner--closed mt-5"
      >
        <UIcon
          name="i-lucide-flag"
          class="h-5 w-5"
          aria-hidden="true"
        />
        <div>
          <p class="tournoi-banner__title">
            Tournoi terminé
          </p>
          <p class="tournoi-banner__text">
            Les inscriptions sont closes : ce tournoi est terminé. Le bracket et les résultats
            restent consultables ci-dessous.
          </p>
        </div>
      </div>

      <!-- Inscriptions -->
      <div
        v-else-if="header.registrationOpen"
        class="tournoi-banner tournoi-banner--open mt-5"
      >
        <UIcon
          name="i-lucide-ticket"
          class="h-5 w-5"
          aria-hidden="true"
        />
        <div>
          <p class="tournoi-banner__title">
            Inscriptions ouvertes
          </p>
          <p class="tournoi-banner__text">
            Les équipes peuvent s’inscrire à ce tournoi. En tant que capitaine, tu peux
            engager la tienne directement ci-dessous.
          </p>
        </div>
      </div>

      <div
        v-else
        class="tournoi-banner tournoi-banner--closed mt-5"
      >
        <UIcon
          name="i-lucide-lock"
          class="h-5 w-5"
          aria-hidden="true"
        />
        <div>
          <p class="tournoi-banner__title">
            Inscriptions fermées
          </p>
          <p class="tournoi-banner__text">
            Les inscriptions ne sont pas ouvertes pour ce tournoi : les équipes engagées sont
            déjà fixées. Tu peux suivre le bracket et les résultats ci-dessous.
          </p>
        </div>
      </div>

      <!-- Inscription en ligne : « S'inscrire avec mon équipe » -->
      <!-- Masquée pour un tournoi terminé : aucun appel à l'inscription. -->
      <section
        v-if="etat !== 'finished' && header.registrationOpen && detail"
        class="tournoi-register surface-solid clip-corner mt-5"
        aria-label="Inscription en ligne"
      >
        <div class="tournoi-register__head">
          <p class="tournoi-register__title">
            <UIcon
              name="i-lucide-shield-plus"
              aria-hidden="true"
            />
            S’inscrire avec mon équipe
          </p>
          <p class="tournoi-register__hint">
            La demande est validée par l’organisation du club avant l’entrée dans le bracket.
          </p>
        </div>

        <p
          v-if="!captainedTeams.length"
          class="tournoi-register__empty"
        >
          Tu n’es capitaine d’aucune équipe pour l’instant.
          <NuxtLink
            to="/equipes"
            class="tournoi-register__link"
          >
            Créer mon équipe
          </NuxtLink>
        </p>

        <template v-else>
          <div
            v-if="registerableTeams.length"
            class="tournoi-register__form"
          >
            <AppSelect
              v-model="selectedTeamId"
              :options="registerOptions"
              label="Mon équipe"
              icon="i-lucide-shield"
              placeholder="Choisir une équipe"
            />
            <UButton
              color="primary"
              icon="i-lucide-send"
              label="Inscrire mon équipe"
              :loading="registering"
              @click="registerSelectedTeam"
            />
          </div>
          <p
            v-else
            class="tournoi-register__empty"
          >
            Tu as déjà engagé toutes tes équipes dans ce tournoi.
          </p>

          <ul
            v-if="registeredTeams.length"
            class="tournoi-register__list"
          >
            <li
              v-for="entry in registeredTeams"
              :key="`reg-${entry.team.id}`"
            >
              <span class="tournoi-register__team">{{ entry.team.name }}</span>
              <span class="tournoi-register__status">
                <UIcon
                  name="i-lucide-clock"
                  aria-hidden="true"
                />
                {{ entry.engaged ? 'Équipe engagée dans ce tournoi' : (REGISTRATION_STATUS_LABELS[entry.registration?.status || ''] || 'Inscription enregistrée') }}
              </span>
            </li>
          </ul>

          <p class="tournoi-register__note">
            Une autre équipe à engager ?
            <NuxtLink
              to="/equipes"
              class="tournoi-register__link"
            >
              Gérer mes équipes
            </NuxtLink>
          </p>
        </template>
      </section>

      <template v-if="detail">
        <!-- Bracket -->
        <section class="surface-solid clip-corner mt-6 p-5">
          <div class="tournoi-section__head">
            <p class="tournoi-section__title">
              <UIcon
                name="i-lucide-git-branch"
                class="h-4 w-4"
                aria-hidden="true"
              />
              Bracket
            </p>
            <p class="tournoi-section__hint">
              Le vainqueur apparaît en rouge, le match en cours est encadré.
            </p>
          </div>

          <div class="mt-4">
            <GamingBracket
              :matches="matches"
              :interactive="false"
            />
          </div>
        </section>

        <!-- Classement -->
        <section class="surface-solid clip-corner mt-6 p-5">
          <GamingStandingsTable
            :teams="teams"
            :matches="matches"
          />
        </section>

        <!-- Matchs -->
        <section class="surface-solid clip-corner mt-6 p-5">
          <div class="tournoi-section__head">
            <p class="tournoi-section__title">
              <UIcon
                name="i-lucide-swords"
                class="h-4 w-4"
                aria-hidden="true"
              />
              Tous les matchs
            </p>
            <p class="tournoi-section__hint">
              {{ header.matchCount }} match<span v-if="header.matchCount > 1">s</span> au programme
            </p>
          </div>

          <div
            v-if="!matches.length"
            class="tournoi-empty mt-4"
          >
            Aucun match n’est encore programmé pour ce tournoi.
          </div>

          <div
            v-else
            class="mt-4 space-y-5"
          >
            <div
              v-for="group in matchGroups"
              :key="group.round"
            >
              <p class="tournoi-group__label">
                {{ group.label }}
              </p>
              <ul class="tournoi-matches">
                <li
                  v-for="match in group.matches"
                  :key="match.id"
                  class="tournoi-match"
                >
                  <div class="tournoi-match__head">
                    <span class="tournoi-match__number">
                      Match {{ match.position }}
                    </span>
                    <GamingStatusBadge :status="match.status" />
                  </div>
                  <GamingVersus
                    orientation="row"
                    size="md"
                    :home-team="match.homeTeam"
                    :away-team="match.awayTeam"
                    :score-home="match.scoreHome"
                    :score-away="match.scoreAway"
                    :status="match.status"
                  />
                </li>
              </ul>
            </div>
          </div>
        </section>
      </template>
    </template>
  </div>
</template>

<style scoped>
.tournoi-back {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--muted-color);
  text-decoration: none;
}

.tournoi-back:hover {
  color: var(--primary-color);
}

/* ---------- En-tête ---------- */
.tournoi-etat {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: 1px solid var(--border-color);
  border-radius: 9999px;
  padding: 0.2rem 0.6rem;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  color: var(--muted-color);
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
}

.tournoi-hero__meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: 0.75rem;
  margin-top: 1.5rem;
  border-top: 1px solid var(--border-color);
  padding-top: 1rem;
}

.tournoi-hero__meta dt {
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted-color);
}

.tournoi-hero__meta dd {
  margin-top: 0.2rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-color);
}

/* ---------- Bandeaux ---------- */
.tournoi-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 0.85rem;
  padding: 0.9rem 1.1rem;
  color: var(--text-color);
}

.tournoi-banner__title {
  font-size: 0.9rem;
  font-weight: 700;
}

.tournoi-banner__text {
  margin-top: 0.2rem;
  font-size: 0.83rem;
  color: var(--muted-color);
}

.tournoi-banner--open {
  border-color: rgba(var(--primary-color-rgb), 0.45);
  background: rgba(var(--primary-color-rgb), 0.08);
}

.tournoi-banner--open .tournoi-banner__title,
.tournoi-banner--open :deep(svg) {
  color: var(--primary-color);
}

.tournoi-banner--closed {
  border-style: dashed;
  background: rgba(var(--accent-color-rgb), 0.04);
}

.tournoi-banner--closed .tournoi-banner__title {
  color: var(--accent-color);
}

.tournoi-banner--info {
  background: rgba(var(--accent-color-rgb), 0.06);
}

/* ---------- Sections ---------- */
.tournoi-section__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.tournoi-section__title {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-family: var(--font-display);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-color);
}

.tournoi-section__title :deep(svg) {
  color: var(--accent-color);
}

.tournoi-section__hint {
  font-size: 0.74rem;
  color: var(--muted-color);
}

.tournoi-group__label {
  margin-bottom: 0.5rem;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--accent-color);
}

.tournoi-matches {
  display: grid;
  gap: 0.6rem;
  grid-template-columns: repeat(auto-fill, minmax(19rem, 1fr));
}

.tournoi-match {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.35rem;
  border: 1px solid rgba(var(--primary-color-rgb), 0.16);
  border-radius: 0.7rem;
  background: linear-gradient(180deg, rgba(var(--primary-color-rgb), 0.03), var(--panel-color-solid));
  padding: 0.6rem 0.7rem;
}

.tournoi-match__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.tournoi-match__number {
  font-family: var(--font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted-color);
}

.tournoi-empty {
  border: 1px dashed rgba(var(--primary-color-rgb), 0.3);
  border-radius: 0.7rem;
  padding: 1.25rem;
  text-align: center;
  font-size: 0.85rem;
  color: var(--muted-color);
}

/* ---------- Inscription en ligne ---------- */
.tournoi-register {
  border: 1px solid rgba(var(--primary-color-rgb), 0.34);
  background: linear-gradient(180deg, rgba(var(--primary-color-rgb), 0.08), var(--panel-color-solid));
  padding: 1rem 1.1rem;
}

.tournoi-register__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.tournoi-register__title {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-family: var(--font-display);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-color);
}

.tournoi-register__title svg {
  height: 1rem;
  width: 1rem;
  color: var(--primary-color);
}

.tournoi-register__hint {
  font-size: 0.74rem;
  color: var(--muted-color);
}

.tournoi-register__form {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.75rem;
  margin-top: 0.85rem;
}

.tournoi-register__form > :first-child {
  min-width: 14rem;
  flex: 1 1 18rem;
}

.tournoi-register__empty,
.tournoi-register__note {
  margin-top: 0.7rem;
  font-size: 0.82rem;
  color: var(--muted-color);
}

.tournoi-register__link {
  color: var(--primary-color);
  font-weight: 600;
  text-decoration: none;
}

.tournoi-register__link:hover {
  text-decoration: underline;
}

.tournoi-register__list {
  display: grid;
  gap: 0.4rem;
  margin-top: 0.85rem;
}

.tournoi-register__list li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  border-top: 1px solid var(--border-color);
  padding-top: 0.45rem;
}

.tournoi-register__team {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--text-color);
}

.tournoi-register__status {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin-left: auto;
  border-radius: 9999px;
  border: 1px solid var(--primary-color);
  padding: 0.12rem 0.6rem;
  font-size: 0.72rem;
  color: var(--primary-color);
}

.tournoi-register__status svg {
  height: 0.8rem;
  width: 0.8rem;
}
</style>
