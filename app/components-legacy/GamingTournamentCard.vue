<script setup lang="ts">
// Carte de tournoi du cockpit organisateur.
// Les indicateurs (avancement, prochain match, champion, meilleur bilan) sont
// tous DÉRIVÉS des données réelles renvoyées par /api/tournaments :
// aucune valeur inventée, aucun champ qui n'existe pas en base.
type CardTeam = { id: string, name: string, seed: number | null }
type CardMatch = {
  id: string
  round: number
  position: number
  status: string
  scoreHome: number | null
  scoreAway: number | null
  homeTeam: { name: string } | null
  awayTeam: { name: string } | null
}

const props = defineProps<{
  tournament: {
    id: string
    name: string
    game: string
    status: string
    visibility?: string
    registrationOpen?: boolean
    teams: CardTeam[]
    matches: CardMatch[]
  }
}>()

// État de publication, rappelé sur la carte : un tournoi resté en 'DRAFT'
// n'est visible par aucun membre, même s'il a des équipes et des matchs.
function visibilityMeta(value?: string) {
  if (value === 'PUBLIC') return { label: 'Public', icon: 'i-lucide-eye' }
  if (value === 'UNLISTED') return { label: 'Non listé', icon: 'i-lucide-link' }
  return { label: 'Brouillon', icon: 'i-lucide-eye-off' }
}

const visibility = computed(() => visibilityMeta(props.tournament.visibility))
const isPublished = computed(() => props.tournament.visibility === 'PUBLIC')

const totalMatches = computed(() => props.tournament.matches.length)

const playedMatches = computed(() => props.tournament.matches.filter(match => match.status === 'completed' && match.scoreHome !== null && match.scoreAway !== null).length)

const liveMatches = computed(() => props.tournament.matches.filter(match => match.status === 'live').length)

const progress = computed(() => totalMatches.value === 0 ? 0 : Math.round((playedMatches.value / totalMatches.value) * 100))

const finalRound = computed(() => props.tournament.matches.reduce((max, match) => Math.max(max, match.round), 0))

// Nombre de tours attendu pour l'effectif engagé : ceil(log2(n)). L'API ne
// génère que le premier tour : tant que le bracket est incomplet, la carte
// n'annonce ni finale ni champion (sinon un tour 1 à 4 équipes passerait
// pour une finale).
const expectedRounds = computed(() => Math.max(1, Math.ceil(Math.log2(Math.max(props.tournament.teams.length, 2)))))
const bracketComplete = computed(() => finalRound.value >= expectedRounds.value)

// Champion : le tournoi n'a un vainqueur que si le dernier tour ne contient
// qu'un match, terminé, avec un écart de score.
const champion = computed(() => {
  if (!finalRound.value || !bracketComplete.value) return null
  const finals = props.tournament.matches.filter(match => match.round === finalRound.value)
  if (finals.length !== 1) return null
  const final = finals[0]
  if (!final || final.status !== 'completed' || final.scoreHome === null || final.scoreAway === null) return null
  if (final.scoreHome === final.scoreAway) return null
  return final.scoreHome > final.scoreAway ? final.homeTeam?.name ?? null : final.awayTeam?.name ?? null
})

// Meilleur bilan : nombre de victoires par équipe sur les matchs terminés.
const bestRecord = computed(() => {
  const wins = new Map<string, number>()
  for (const match of props.tournament.matches) {
    if (match.status !== 'completed' || match.scoreHome === null || match.scoreAway === null) continue
    if (match.scoreHome === match.scoreAway) continue
    const winner = match.scoreHome > match.scoreAway ? match.homeTeam?.name : match.awayTeam?.name
    if (!winner) continue
    wins.set(winner, (wins.get(winner) || 0) + 1)
  }
  const ranked = [...wins.entries()].sort((a, b) => b[1] - a[1])
  return ranked[0] ? { name: ranked[0][0], wins: ranked[0][1] } : null
})

const nextMatch = computed(() =>
  props.tournament.matches.find(match => match.status !== 'completed' && match.homeTeam && match.awayTeam) ?? null
)

const roundLabel = computed(() => {
  const round = nextMatch.value?.round
  if (!round) return ''
  if (!bracketComplete.value) return `Tour ${round} / ${expectedRounds.value}`
  const fromEnd = finalRound.value - round
  if (fromEnd === 0) return 'Finale'
  if (fromEnd === 1) return 'Demi-finales'
  return `Tour ${round}`
})

const to = computed(() => `/gaming-tournoi-${props.tournament.id}`)
</script>

<template>
  <NuxtLink
    :to="to"
    class="gaming-card surface-solid clip-corner"
    :aria-label="`Ouvrir le cockpit du tournoi ${tournament.name}`"
  >
    <div class="gaming-card__head">
      <GamingStatusBadge :status="tournament.status" />
      <span class="gaming-card__game">{{ tournament.game }}</span>
    </div>

    <div class="gaming-card__flags">
      <span
        class="gaming-card__flag"
        :class="{ 'gaming-card__flag--public': isPublished }"
      >
        <UIcon
          :name="visibility.icon"
          class="gaming-card__flag-icon"
          aria-hidden="true"
        />
        {{ visibility.label }}
      </span>
      <span
        v-if="tournament.registrationOpen"
        class="gaming-card__flag gaming-card__flag--public"
      >
        <UIcon
          name="i-lucide-ticket"
          class="gaming-card__flag-icon"
          aria-hidden="true"
        />
        Inscriptions ouvertes
      </span>
    </div>

    <h3 class="gaming-card__title">
      {{ tournament.name }}
    </h3>

    <p class="gaming-card__meta">
      {{ tournament.teams.length }} équipe<span v-if="tournament.teams.length > 1">s</span>
      · {{ totalMatches }} match<span v-if="totalMatches > 1">s</span>
      <span v-if="liveMatches"> · {{ liveMatches }} en direct</span>
    </p>

    <div class="gaming-card__progress">
      <UProgress
        color="primary"
        size="sm"
        :model-value="progress"
      />
      <p class="gaming-card__progress-label">
        {{ playedMatches }} / {{ totalMatches }} matchs terminés ({{ progress }} %)
      </p>
    </div>

    <div class="gaming-card__facts">
      <p
        v-if="champion"
        class="gaming-card__fact gaming-card__fact--done"
      >
        <UIcon
          name="i-lucide-trophy"
          class="gaming-card__icon"
          aria-hidden="true"
        />
        Champion : <strong>{{ champion }}</strong>
      </p>
      <p
        v-else-if="nextMatch"
        class="gaming-card__fact"
      >
        <UIcon
          name="i-lucide-swords"
          class="gaming-card__icon"
          aria-hidden="true"
        />
        {{ roundLabel }} — {{ nextMatch.homeTeam?.name }} vs {{ nextMatch.awayTeam?.name }}
      </p>
      <p
        v-else-if="bestRecord"
        class="gaming-card__fact"
      >
        <UIcon
          name="i-lucide-medal"
          class="gaming-card__icon"
          aria-hidden="true"
        />
        Meilleur bilan : <strong>{{ bestRecord.name }}</strong> ({{ bestRecord.wins }} victoire<span v-if="bestRecord.wins > 1">s</span>)
      </p>
      <p
        v-else
        class="gaming-card__fact"
      >
        <UIcon
          name="i-lucide-circle-dashed"
          class="gaming-card__icon"
          aria-hidden="true"
        />
        Aucun match joué pour l’instant.
      </p>
    </div>

    <span class="gaming-card__cta">
      Ouvrir le cockpit
      <UIcon
        name="i-lucide-arrow-right"
        class="gaming-card__cta-icon"
        aria-hidden="true"
      />
    </span>
  </NuxtLink>
</template>

<style scoped>
.gaming-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.25rem;
  border: 1px solid rgba(var(--primary-color-rgb), 0.18);
  background: linear-gradient(180deg, rgba(var(--primary-color-rgb), 0.03), rgba(var(--accent-color-rgb), 0.02), var(--panel-color-solid));
  color: var(--text-color);
  text-decoration: none;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.gaming-card:hover,
.gaming-card:focus-visible {
  border-color: var(--primary-color);
  box-shadow: 0 14px 34px -18px rgba(var(--primary-color-rgb), 0.72);
  outline: none;
  transform: translateY(-4px);
}

.gaming-card:focus-visible {
  box-shadow: 0 0 0 3px rgba(var(--primary-color-rgb), 0.24), 0 14px 34px -18px rgba(var(--primary-color-rgb), 0.72);
}

.gaming-card__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.gaming-card__game {
  font-size: 0.7rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--accent-color);
}

.gaming-card__flags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.gaming-card__flag {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border-radius: 9999px;
  border: 1px dashed var(--border-color);
  padding: 0.1rem 0.55rem;
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--muted-color);
}

.gaming-card__flag--public {
  border-style: solid;
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.gaming-card__flag-icon {
  height: 0.8rem;
  width: 0.8rem;
}

.gaming-card__title {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text-color);
}

.gaming-card__meta,
.gaming-card__progress-label {
  font-size: 0.8rem;
  color: var(--muted-color);
}

.gaming-card__progress {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.gaming-card__facts {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-height: 1.6rem;
}

.gaming-card__fact {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.82rem;
  color: var(--text-color);
}

.gaming-card__icon {
  height: 1rem;
  width: 1rem;
  flex: none;
  color: var(--accent-color);
}

.gaming-card__fact--done {
  color: var(--primary-color);
}

.gaming-card__fact--done .gaming-card__icon {
  color: var(--primary-color);
}

.gaming-card__cta {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: auto;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--primary-color);
}

.gaming-card__cta-icon {
  height: 1rem;
  width: 1rem;
  transition: transform 0.2s ease;
}

.gaming-card:hover .gaming-card__cta-icon {
  transform: translateX(4px);
}
</style>
