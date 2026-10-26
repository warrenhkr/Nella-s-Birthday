<script setup lang="ts">
// ============================================================
// Classement provisoire d'un tournoi, rendu par UTable (@nuxt/ui v4,
// actuellement utilisé nulle part dans le projet).
//
// Le CALCUL reste inchangé et honnête : il est fait dans le navigateur à
// partir des matchs déjà saisis (victoire 3 / nul 1 / défaite 0). Aucune
// valeur n'est inventée — un match non terminé ou sans score n'entre pas
// dans le calcul, et le titre précise qu'il s'agit d'un calcul local (la
// persistance serveur, hors périmètre de ce lot, reste à faire).
//
// Présentation soignée : médaille sur le top 3, couronne du leader dès
// qu'un match est joué, victoires / nuls / défaites, buts pour / contre,
// différence signée et points mis en avant. Thème : uniquement les
// variables CSS du site.
// ============================================================
type StandingTeam = { id: string, name: string, seed: number | null }
type StandingMatch = {
  status: string
  scoreHome: number | null
  scoreAway: number | null
  homeTeam: { id: string, name: string } | null
  awayTeam: { id: string, name: string } | null
}

type Row = {
  id: string
  name: string
  seed: number | null
  rank: number
  played: number
  wins: number
  draws: number
  losses: number
  scored: number
  conceded: number
  diff: number
  points: number
}

const props = defineProps<{
  teams: StandingTeam[]
  matches: StandingMatch[]
}>()

const rows = computed<Row[]>(() => {
  const table = new Map<string, Omit<Row, 'rank' | 'diff'>>()
  for (const team of props.teams) {
    table.set(team.id, {
      id: team.id,
      name: team.name,
      seed: team.seed,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      scored: 0,
      conceded: 0,
      points: 0
    })
  }

  for (const match of props.matches) {
    if (match.status !== 'completed' || match.scoreHome === null || match.scoreAway === null) continue
    if (!match.homeTeam || !match.awayTeam) continue
    const home = table.get(match.homeTeam.id)
    const away = table.get(match.awayTeam.id)
    if (!home || !away) continue

    home.played += 1
    away.played += 1
    home.scored += match.scoreHome
    home.conceded += match.scoreAway
    away.scored += match.scoreAway
    away.conceded += match.scoreHome

    if (match.scoreHome > match.scoreAway) {
      home.wins += 1
      home.points += 3
      away.losses += 1
    } else if (match.scoreAway > match.scoreHome) {
      away.wins += 1
      away.points += 3
      home.losses += 1
    } else {
      home.draws += 1
      away.draws += 1
      home.points += 1
      away.points += 1
    }
  }

  return [...table.values()]
    .map(row => ({ ...row, diff: row.scored - row.conceded, rank: 0 }))
    .sort((a, b) =>
      b.points - a.points
      || b.diff - a.diff
      || b.scored - a.scored
      || a.name.localeCompare(b.name, 'fr')
    )
    .map((row, index) => ({ ...row, rank: index + 1 }))
})

const hasResults = computed(() => rows.value.some(row => row.played > 0))

// Ligne du leader mise en valeur, uniquement quand un match a réellement été
// joué (on ne couronne personne sur un classement vide).
const tableMeta = computed(() => ({
  class: {
    tr: (row: { original: Row }) =>
      row.original.rank === 1 && hasResults.value ? 'gaming-standings__leader' : ''
  }
}))

// Colonnes numériques : contenu centré (les <td> de UTable ne portent aucune
// classe d'alignement, l'alignement est donc entièrement maîtrisé ici).
function numericColumn(key: keyof Row, header: string) {
  return {
    accessorKey: key,
    header,
    meta: { class: { th: 'gaming-standings__num' } },
    cell: ({ getValue }: { getValue: () => unknown }) => h(
      'span',
      { class: 'gaming-standings__cellnum' },
      String(getValue() ?? '')
    )
  }
}

const columns = [
  { accessorKey: 'rank', header: '#', meta: { class: { th: 'gaming-standings__num' } } },
  { accessorKey: 'name', header: 'Équipe' },
  numericColumn('played', 'J'),
  numericColumn('wins', 'V'),
  numericColumn('draws', 'N'),
  numericColumn('losses', 'D'),
  numericColumn('scored', 'BP'),
  numericColumn('conceded', 'BC'),
  {
    accessorKey: 'diff',
    header: 'Diff',
    meta: { class: { th: 'gaming-standings__num' } }
  },
  {
    accessorKey: 'points',
    header: 'Pts',
    meta: { class: { th: 'gaming-standings__num' } }
  }
]

function diffLabel(value: number) {
  return value > 0 ? `+${value}` : String(value)
}

function diffClass(value: number) {
  if (value > 0) return 'gaming-standings__diff gaming-standings__diff--up'
  if (value < 0) return 'gaming-standings__diff gaming-standings__diff--down'
  return 'gaming-standings__diff'
}

function rankClass(rank: number) {
  if (rank === 1) return 'gaming-rank gaming-rank--first'
  if (rank === 2) return 'gaming-rank gaming-rank--second'
  if (rank === 3) return 'gaming-rank gaming-rank--third'
  return 'gaming-rank'
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <p class="gaming-eyebrow">
        Classement provisoire
      </p>
      <p class="text-xs text-muted">
        Victoire 3 · nul 1 · défaite 0 — calculé à partir des matchs terminés.
      </p>
    </div>

    <div
      v-if="!rows.length"
      class="gaming-table-empty"
    >
      Aucune équipe dans ce tournoi.
    </div>

    <div
      v-else
      class="gaming-table-wrap"
    >
      <UTable
        :data="rows"
        :columns="columns"
        :meta="tableMeta"
        caption="Classement provisoire des équipes du tournoi"
        :ui="{
          base: 'gaming-standings__base',
          th: 'gaming-standings__th',
          td: 'gaming-standings__td',
          tbody: 'gaming-standings__body'
        }"
      >
        <!-- Position : médaille pour le top 3, couronne du leader si des matchs sont joués -->
        <template #rank-cell="{ row }">
          <span :class="rankClass(row.original.rank)">
            <UIcon
              v-if="row.original.rank <= 3"
              name="i-lucide-medal"
              class="gaming-rank__icon"
              aria-hidden="true"
            />
            <span class="gaming-rank__value">{{ row.original.rank }}</span>
          </span>
        </template>

        <!-- Équipe : seed + nom + couronne du leader -->
        <template #name-cell="{ row }">
          <span class="gaming-team">
            <span class="gaming-team__seed">{{ row.original.seed ?? '–' }}</span>
            <span class="gaming-team__name">{{ row.original.name }}</span>
            <UIcon
              v-if="row.original.rank === 1 && hasResults"
              name="i-lucide-crown"
              class="gaming-team__crown"
              aria-hidden="true"
            />
          </span>
        </template>

        <!-- Différence signée -->
        <template #diff-cell="{ row }">
          <span :class="diffClass(row.original.diff)">
            {{ diffLabel(row.original.diff) }}
          </span>
        </template>

        <!-- Points mis en avant -->
        <template #points-cell="{ row }">
          <span class="gaming-standings__points">{{ row.original.points }}</span>
        </template>
      </UTable>
    </div>

    <p
      v-if="rows.length && !hasResults"
      class="text-xs text-muted"
    >
      Le classement se remplira dès le premier match terminé avec un score.
    </p>
  </div>
</template>

<style scoped>
.gaming-eyebrow {
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent-color);
}

.gaming-table-wrap {
  overflow: hidden;
  border: 1px solid rgba(var(--primary-color-rgb), 0.18);
  border-radius: 0.75rem;
}

.gaming-table-wrap :deep(.gaming-standings__base) {
  min-width: 34rem;
}

/* En-tête compact, typographie du site */
.gaming-table-wrap :deep(.gaming-standings__th) {
  padding: 0.6rem 0.7rem;
  font-size: 0.66rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted-color);
  background: rgba(var(--primary-color-rgb), 0.05);
}

.gaming-table-wrap :deep(.gaming-standings__td) {
  padding: 0.55rem 0.7rem;
  font-size: 0.82rem;
  color: var(--text-color);
}

/* Les colonnes numériques sont centrées : l'en-tête ET la cellule. */
.gaming-table-wrap :deep(.gaming-standings__num) {
  text-align: center;
}

.gaming-table-wrap :deep(.gaming-standings__cellnum) {
  display: block;
  text-align: center;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.gaming-table-wrap :deep(.gaming-standings__leader) {
  background: rgba(var(--primary-color-rgb), 0.06);
}

/* ---------- Position + médaille ---------- */
.gaming-rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  border-radius: 0.5rem;
  padding: 0.1rem 0.4rem;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--muted-color);
}

.gaming-rank__icon {
  width: 0.95rem;
  height: 0.95rem;
}

.gaming-rank--first {
  border: 1px solid rgba(var(--primary-color-rgb), 0.55);
  background: rgba(var(--primary-color-rgb), 0.16);
  color: var(--primary-color);
  font-weight: 700;
}

.gaming-rank--second {
  border: 1px solid rgba(var(--accent-color-rgb), 0.45);
  background: rgba(var(--accent-color-rgb), 0.12);
  color: var(--accent-color);
  font-weight: 700;
}

.gaming-rank--third {
  border: 1px solid var(--border-color);
  background: rgba(var(--primary-color-rgb), 0.05);
  color: var(--muted-color);
  font-weight: 600;
}

/* ---------- Équipe ---------- */
.gaming-team {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
}

.gaming-team__seed {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--muted-color);
}

.gaming-team__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.gaming-team__crown {
  width: 0.85rem;
  height: 0.85rem;
  flex: none;
  color: var(--primary-color);
}

/* ---------- Différence + points ---------- */
.gaming-standings__diff {
  display: block;
  text-align: center;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  color: var(--muted-color);
}

.gaming-standings__diff--up {
  color: var(--primary-color);
  font-weight: 700;
}

.gaming-standings__diff--down {
  opacity: 0.75;
}

.gaming-standings__points {
  display: block;
  text-align: center;
  font-family: var(--font-mono);
  font-weight: 800;
  color: var(--primary-color);
}

.gaming-table-empty {
  border: 1px dashed rgba(var(--primary-color-rgb), 0.3);
  border-radius: 0.75rem;
  padding: 1.25rem;
  text-align: center;
  font-size: 0.875rem;
  color: var(--muted-color);
}
</style>
