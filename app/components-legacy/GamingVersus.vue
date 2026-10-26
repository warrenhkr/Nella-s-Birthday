<script setup lang="ts">
// ============================================================
// GamingVersus — l'affichage « VS » officiel du module gaming.
//
// Remplace le texte brut « vs » (bracket, listes de matchs) par un
// affrontement lisible : deux camps, un badge VS central stylé avec le
// thème rouge, les scores quand ils existent, et un état clair (« À venir »,
// « En direct », « Terminé », « Égalité ») quand le match n'est pas joué.
//
// Deux dispositions :
//   - orientation="row"   : camp | VS | camp (listes de matchs, cartes) ;
//   - orientation="stack" : camp / VS / camp (colonnes étroites du bracket).
//
// En dessous de 30rem, la disposition « row » se replie automatiquement en
// « stack » (CSS) : le VS reste lisible sur mobile, sans écrasement des noms.
//
// Thème : uniquement les variables CSS du site (var(--primary-color)…), donc
// les 4 combinaisons sombre/clair × persona/cyberpunk sont respectées.
// ============================================================

type VersusTeam = { id?: string, name: string, seed?: number | null } | null

const props = withDefaults(defineProps<{
  homeTeam?: VersusTeam
  awayTeam?: VersusTeam
  scoreHome?: number | null
  scoreAway?: number | null
  status?: string | null
  orientation?: 'row' | 'stack'
  size?: 'sm' | 'md' | 'lg'
  showSeed?: boolean
  showState?: boolean
  showWinnerIcon?: boolean
  ariaLabel?: string
}>(), {
  homeTeam: null,
  awayTeam: null,
  scoreHome: null,
  scoreAway: null,
  status: 'scheduled',
  orientation: 'row',
  size: 'md',
  showSeed: true,
  showState: true,
  showWinnerIcon: true
})

const normalizedStatus = computed(() => (props.status || 'scheduled').trim().toLowerCase())

const isLive = computed(() => normalizedStatus.value === 'live' || normalizedStatus.value === 'in_progress')

const hasScore = computed(() => props.scoreHome !== null && props.scoreAway !== null)

// Un match n'est « décidé » que s'il est terminé ET que les scores diffèrent :
// on n'invente jamais un vainqueur sur un match nul ou non saisi.
const decided = computed(() =>
  normalizedStatus.value === 'completed' && hasScore.value && props.scoreHome !== props.scoreAway
)

const isDraw = computed(() =>
  normalizedStatus.value === 'completed' && hasScore.value && props.scoreHome === props.scoreAway
)

// Équipe manquante : le tour suivant attend encore son qualifié.
const pending = computed(() => !props.homeTeam || !props.awayTeam)

const winner = computed<'home' | 'away' | null>(() => {
  if (!decided.value) return null
  return (props.scoreHome as number) > (props.scoreAway as number) ? 'home' : 'away'
})

function isWinner(side: 'home' | 'away') {
  return winner.value === side
}

function isLoser(side: 'home' | 'away') {
  return decided.value && winner.value !== side
}

const stateLabel = computed(() => {
  if (isLive.value) return 'En direct'
  if (decided.value) return 'Terminé'
  if (isDraw.value) return 'Égalité'
  if (pending.value) return 'À déterminer'
  return 'À venir'
})

function scoreLabel(score: number | null | undefined) {
  return score === null || score === undefined ? '–' : String(score)
}

const rootLabel = computed(() => props.ariaLabel
  || `${props.homeTeam?.name || 'équipe à déterminer'} contre ${props.awayTeam?.name || 'équipe à déterminer'}, ${stateLabel.value.toLowerCase()}`)
</script>

<template>
  <div
    class="gvs"
    :class="[
      `gvs--${orientation}`,
      `gvs--${size}`,
      {
        'gvs--live': isLive,
        'gvs--done': decided || isDraw,
        'gvs--pending': pending
      }
    ]"
    role="group"
    :aria-label="rootLabel"
  >
    <!-- Camp domicile -->
    <div
      class="gvs__team gvs__team--home"
      :class="{ 'gvs__team--winner': isWinner('home'), 'gvs__team--loser': isLoser('home') }"
    >
      <span
        v-if="showSeed"
        class="gvs__seed"
      >{{ homeTeam?.seed ?? '–' }}</span>
      <span class="gvs__name">
        <UIcon
          v-if="showWinnerIcon && isWinner('home')"
          name="i-lucide-crown"
          class="gvs__crown"
          aria-hidden="true"
        />
        <span class="gvs__name-text">{{ homeTeam?.name || 'À déterminer' }}</span>
      </span>
      <span
        v-if="hasScore"
        class="gvs__score"
      >{{ scoreLabel(scoreHome) }}</span>
    </div>

    <!-- Badge VS central -->
    <div class="gvs__center">
      <span
        class="gvs__badge"
        aria-hidden="true"
      >VS</span>
      <span
        v-if="showState"
        class="gvs__state"
      >
        <span
          v-if="isLive"
          class="gvs__state-dot"
          aria-hidden="true"
        />
        {{ stateLabel }}
      </span>
    </div>

    <!-- Camp extérieur -->
    <div
      class="gvs__team gvs__team--away"
      :class="{ 'gvs__team--winner': isWinner('away'), 'gvs__team--loser': isLoser('away') }"
    >
      <span
        v-if="showSeed"
        class="gvs__seed"
      >{{ awayTeam?.seed ?? '–' }}</span>
      <span class="gvs__name">
        <UIcon
          v-if="showWinnerIcon && isWinner('away')"
          name="i-lucide-crown"
          class="gvs__crown"
          aria-hidden="true"
        />
        <span class="gvs__name-text">{{ awayTeam?.name || 'À déterminer' }}</span>
      </span>
      <span
        v-if="hasScore"
        class="gvs__score"
      >{{ scoreLabel(scoreAway) }}</span>
    </div>
  </div>
</template>

<style scoped>
.gvs {
  display: grid;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
  color: var(--text-color);
}

.gvs--row {
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
}

.gvs--stack {
  grid-template-columns: minmax(0, 1fr);
  gap: 0.2rem;
}

/* ---------- Camps ---------- */
.gvs__team {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
  padding: 0.3rem 0.5rem;
  border: 1px solid transparent;
  border-radius: 0.55rem;
  font-size: 0.85rem;
  transition: border-color 0.18s ease, background-color 0.18s ease, opacity 0.18s ease;
}

.gvs--row .gvs__team--home {
  text-align: right;
}

.gvs--row .gvs__team--home .gvs__name {
  justify-content: flex-end;
}

.gvs__seed {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--muted-color);
}

.gvs__name {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  min-width: 0;
}

.gvs__name-text {
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  color: var(--text-color);
}

.gvs__score {
  min-width: 1.5rem;
  border-radius: 0.35rem;
  background: rgba(var(--primary-color-rgb), 0.09);
  padding: 0.05rem 0.35rem;
  text-align: center;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  color: var(--text-color);
}

.gvs__crown {
  width: 0.75rem;
  height: 0.75rem;
  flex: none;
  color: var(--primary-color);
}

/* Vainqueur mis en valeur (texte + icône : jamais la couleur seule). */
.gvs__team--winner {
  border-color: rgba(var(--primary-color-rgb), 0.45);
  background: rgba(var(--primary-color-rgb), 0.08);
}

.gvs__team--winner .gvs__name-text,
.gvs__team--winner .gvs__score {
  color: var(--primary-color);
  font-weight: 800;
}

.gvs__team--winner .gvs__score {
  background: rgba(var(--primary-color-rgb), 0.18);
}

.gvs__team--loser {
  opacity: 0.68;
}

/* ---------- Badge VS central ---------- */
.gvs__center {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0 0.15rem;
}

.gvs__badge {
  display: grid;
  place-items: center;
  min-width: 2.15rem;
  height: 2.15rem;
  padding: 0 0.4rem;
  border: 1px solid rgba(var(--primary-color-rgb), 0.55);
  border-radius: 0.75rem;
  background: linear-gradient(150deg, rgba(var(--primary-color-rgb), 0.22), rgba(var(--accent-color-rgb), 0.12));
  box-shadow: 0 0 20px -9px rgba(var(--primary-color-rgb), 0.95), inset 0 0 14px -9px rgba(var(--accent-color-rgb), 0.9);
  font-family: var(--font-display);
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.1em;
  color: var(--primary-color);
}

.gvs__state {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted-color);
  white-space: nowrap;
}

.gvs__state-dot {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 9999px;
  background: var(--primary-color);
  animation: gvs-pulse 1.4s ease-in-out infinite;
}

@keyframes gvs-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.3; transform: scale(0.7); }
}

/* ---------- États ---------- */
.gvs--live .gvs__team {
  border-color: rgba(var(--primary-color-rgb), 0.4);
}

.gvs--live .gvs__state {
  color: var(--primary-color);
  font-weight: 700;
}

.gvs--done .gvs__badge {
  border-color: rgba(var(--accent-color-rgb), 0.5);
  background: linear-gradient(150deg, rgba(var(--accent-color-rgb), 0.2), rgba(var(--primary-color-rgb), 0.12));
}

.gvs--done .gvs__state {
  color: var(--accent-color);
}

.gvs--pending .gvs__team {
  border-style: dashed;
  border-color: rgba(var(--primary-color-rgb), 0.25);
}

.gvs--pending .gvs__name-text {
  color: var(--muted-color);
  font-style: italic;
  font-weight: 500;
}

/* ---------- Tailles ---------- */
.gvs--sm .gvs__team {
  padding: 0.15rem 0.3rem;
  font-size: 0.8rem;
}

.gvs--sm .gvs__badge {
  min-width: 1.5rem;
  height: 1.5rem;
  border-radius: 0.5rem;
  font-size: 0.6rem;
}

.gvs--sm .gvs__state {
  font-size: 0.55rem;
}

.gvs--lg .gvs__team {
  padding: 0.5rem 0.75rem;
  font-size: 1rem;
}

.gvs--lg .gvs__badge {
  min-width: 2.75rem;
  height: 2.75rem;
  font-size: 0.9rem;
}

@media (prefers-reduced-motion: reduce) {
  .gvs__state-dot { animation: none; }
}

/* Repli automatique sur mobile : « row » devient « stack » sous 30rem. */
@media (max-width: 30rem) {
  .gvs--row {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.2rem;
  }

  .gvs--row .gvs__team--home {
    text-align: left;
  }

  .gvs--row .gvs__team--home .gvs__name {
    justify-content: flex-start;
  }
}
</style>
