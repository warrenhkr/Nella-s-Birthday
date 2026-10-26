<script setup lang="ts">
// Rendu du bracket par tours. Le bracket peut être profond (32 équipes) :
// colonnes scrollables horizontalement sur mobile (snap), pleine largeur sur
// écran large. Chaque affrontement est rendu par GamingVersus (badge VS stylé,
// scores, vainqueur mis en valeur) au lieu du couple de lignes « vs » brut.
//
// Le composant est utilisé par le cockpit ADMIN (interactive par défaut : le
// nœud ouvre le panneau de contrôle du match) et par la page MEMBRE
// (`:interactive="false"` : nœud non cliquable, aucune action d'écriture).
type BracketTeam = { name: string, seed: number | null }
type BracketMatch = {
  id: string
  round: number
  position: number
  status: string
  scoreHome: number | null
  scoreAway: number | null
  homeTeam: BracketTeam | null
  awayTeam: BracketTeam | null
}

const props = withDefaults(defineProps<{
  matches: BracketMatch[]
  interactive?: boolean
}>(), {
  interactive: true
})

const emit = defineEmits<{ select: [match: BracketMatch] }>()

const totalRounds = computed(() => props.matches.reduce((max, match) => Math.max(max, match.round), 0))

// Nombre de participants déduit des matchs (les noms d'équipe sont uniques dans
// un tournoi : contrainte @@unique([tournamentId, name]) côté base). Sert à
// calculer le nombre de tours attendu : ceil(log2(n)).
const participantCount = computed(() => {
  const names = new Set<string>()
  for (const match of props.matches) {
    if (match.homeTeam) names.add(match.homeTeam.name)
    if (match.awayTeam) names.add(match.awayTeam.name)
  }
  return names.size
})

const expectedRounds = computed(() => Math.max(1, Math.ceil(Math.log2(Math.max(participantCount.value, 2)))))

// Un bracket incomplet (l'API ne génère que le premier tour) ne doit pas
// s'afficher comme une finale : on numérote alors les tours sur le total attendu.
const bracketComplete = computed(() => totalRounds.value >= expectedRounds.value)

const rounds = computed(() => {
  const buckets = new Map<number, BracketMatch[]>()
  for (const match of props.matches) {
    const bucket = buckets.get(match.round)
    if (bucket) bucket.push(match)
    else buckets.set(match.round, [match])
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([round, matches]) => ({
      round,
      label: label(round),
      matches: [...matches].sort((a, b) => a.position - b.position)
    }))
})

function label(round: number) {
  if (!bracketComplete.value) return `Tour ${round} / ${expectedRounds.value}`
  const fromEnd = totalRounds.value - round
  if (fromEnd === 0) return 'Finale'
  if (fromEnd === 1) return 'Demi-finales'
  if (fromEnd === 2) return 'Quarts de finale'
  if (fromEnd === 3) return 'Huitièmes'
  return `Tour ${round}`
}

function decided(match: BracketMatch) {
  return match.status === 'completed' && match.scoreHome !== null && match.scoreAway !== null && match.scoreHome !== match.scoreAway
}

function isLive(match: BracketMatch) {
  const status = (match.status || '').trim().toLowerCase()
  return status === 'live' || status === 'in_progress'
}

function matchLabel(match: BracketMatch) {
  const home = match.homeTeam?.name || 'équipe à déterminer'
  const away = match.awayTeam?.name || 'équipe à déterminer'
  const live = isLive(match) ? ', en direct' : ''
  const done = decided(match) ? ', terminé' : ''
  return `Match ${label(match.round)}, ${home} contre ${away}${live}${done}`
}

function onSelect(match: BracketMatch) {
  if (!props.interactive) return
  emit('select', match)
}
</script>

<template>
  <div
    v-if="!matches.length"
    class="gaming-bracket-empty"
  >
    Aucun match pour l’instant : les appariements apparaissent après la création du tournoi.
  </div>
  <div
    v-else
    class="gaming-bracket-wrap"
  >
    <p class="gaming-bracket-hint">
      <UIcon
        name="i-lucide-move-horizontal"
        class="gaming-bracket-hint__icon"
        aria-hidden="true"
      />
      Fais glisser horizontalement pour parcourir les tours.
    </p>

    <div
      class="gaming-bracket"
      role="list"
      aria-label="Bracket du tournoi"
    >
      <section
        v-for="column in rounds"
        :key="column.round"
        class="gaming-bracket__column"
        role="listitem"
      >
        <header class="gaming-bracket__head">
          <p class="gaming-bracket__label">
            {{ column.label }}
          </p>
          <span class="gaming-bracket__count">{{ column.matches.length }} match<span v-if="column.matches.length > 1">s</span></span>
        </header>

        <component
          :is="interactive ? 'button' : 'div'"
          v-for="match in column.matches"
          :key="match.id"
          :type="interactive ? 'button' : null"
          class="gaming-node"
          :class="{
            'gaming-node--live': isLive(match),
            'gaming-node--done': decided(match),
            'gaming-node--waiting': !match.homeTeam || !match.awayTeam,
            'gaming-node--static': !interactive
          }"
          :aria-label="interactive ? matchLabel(match) : undefined"
          @click="onSelect(match)"
        >
          <GamingVersus
            orientation="stack"
            size="sm"
            :show-state="false"
            :home-team="match.homeTeam"
            :away-team="match.awayTeam"
            :score-home="match.scoreHome"
            :score-away="match.scoreAway"
            :status="match.status"
          />
          <span class="gaming-node__foot">
            <GamingStatusBadge :status="match.status" />
            <span
              v-if="match.homeTeam && match.awayTeam"
              class="gaming-node__meta"
            >
              Match {{ match.position }}
            </span>
          </span>
        </component>
      </section>
    </div>
  </div>
</template>

<style scoped>
.gaming-bracket-wrap {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.5rem;
}

/* Indice de défilement : utile uniquement quand les tours débordent (mobile). */
.gaming-bracket-hint {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.7rem;
  color: var(--muted-color);
}

.gaming-bracket-hint__icon {
  width: 0.9rem;
  height: 0.9rem;
  color: var(--accent-color);
}

.gaming-bracket {
  display: flex;
  min-width: 0;
  gap: 1rem;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  padding-bottom: 0.6rem;
  scroll-padding-left: 0.25rem;
  scroll-snap-type: x proximity;
  scrollbar-color: rgba(var(--primary-color-rgb), 0.5) transparent;
  scrollbar-width: thin;
  -webkit-overflow-scrolling: touch;
}

.gaming-bracket__column {
  display: flex;
  min-width: 15.5rem;
  flex: 1 0 15.5rem;
  flex-direction: column;
  gap: 0.7rem;
  scroll-snap-align: start;
}

.gaming-bracket__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.4rem;
}

.gaming-bracket__label {
  font-family: var(--font-display);
  font-size: 0.8rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-color);
}

.gaming-bracket__count {
  font-size: 0.7rem;
  color: var(--muted-color);
}

.gaming-node {
  position: relative;
  display: flex;
  min-height: 5.5rem;
  cursor: pointer;
  flex-direction: column;
  gap: 0.45rem;
  border: 1px solid rgba(var(--primary-color-rgb), 0.18);
  border-radius: 0.6rem;
  background: linear-gradient(180deg, rgba(var(--primary-color-rgb), 0.03), var(--panel-color-solid));
  padding: 0.55rem 0.6rem;
  text-align: left;
  color: var(--text-color);
  transition: border-color 0.18s ease, transform 0.15s ease;
}

.gaming-node:hover,
.gaming-node:focus-visible {
  border-color: var(--primary-color);
  outline: none;
  transform: translateY(-2px);
}

/* Page membre : nœud informatif, aucune action possible. */
.gaming-node--static {
  cursor: default;
}

.gaming-node--static:hover {
  transform: none;
}

/* Match en cours : liseré supérieur animé + bordure marquée. */
.gaming-node--live {
  border-color: rgba(var(--primary-color-rgb), 0.6);
  box-shadow: 0 0 0 1px rgba(var(--primary-color-rgb), 0.28);
}

.gaming-node--live::before {
  position: absolute;
  top: -1px;
  right: -1px;
  left: -1px;
  height: 3px;
  border-radius: 0.6rem 0.6rem 0 0;
  background: linear-gradient(90deg, transparent, var(--primary-color), transparent);
  content: '';
  animation: gaming-node-live 1.8s ease-in-out infinite;
}

.gaming-node--done {
  border-color: rgba(var(--accent-color-rgb), 0.36);
}

.gaming-node--waiting {
  border-style: dashed;
}

.gaming-node__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  margin-top: auto;
}

.gaming-node__meta {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  color: var(--muted-color);
}

@keyframes gaming-node-live {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
}

@keyframes gaming-node-live-motion {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
}

.gaming-bracket-empty {
  border: 1px dashed rgba(var(--primary-color-rgb), 0.3);
  border-radius: 0.6rem;
  padding: 1.25rem;
  text-align: center;
  font-size: 0.875rem;
  color: var(--muted-color);
}

@media (prefers-reduced-motion: reduce) {
  .gaming-node--live::before { animation: none; }
}

@media (min-width: 1024px) {
  .gaming-bracket__column {
    flex: 1 1 0;
  }

  .gaming-bracket-hint {
    display: none;
  }
}
</style>
