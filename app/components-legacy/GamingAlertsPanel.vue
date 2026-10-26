<script setup lang="ts">
// Points de vigilance dérivés des données saisies (aucun incident n'est stocké
// côté serveur aujourd'hui : tout est recalculé localement à partir des matchs
// et des équipes renvoyés par l'API). Objectif : rendre visibles les situations
// qui exigent une décision (résultat incomplet, égalité non départagée,
// bracket incohérent) avant qu'elles ne bloquent le tournoi.
type AlertSeverity = 'info' | 'warn' | 'danger'

type AlertItem = {
  key: string
  severity: AlertSeverity
  title: string
  detail: string
  matchId?: string
}

type AlertTeam = { id: string, name: string, seed: number | null }
type AlertMatch = {
  id: string
  round: number
  position: number
  status: string
  scoreHome: number | null
  scoreAway: number | null
  homeTeam: { id: string, name: string } | null
  awayTeam: { id: string, name: string } | null
}

const props = defineProps<{
  teams: AlertTeam[]
  matches: AlertMatch[]
}>()

const emit = defineEmits<{ focus: [matchId: string | undefined] }>()

const MAX_VISIBLE = 8

function describe(match: AlertMatch) {
  const home = match.homeTeam?.name || 'place vide'
  const away = match.awayTeam?.name || 'place vide'
  return `Tour ${match.round}, match ${match.position} — ${home} vs ${away}`
}

const alerts = computed<AlertItem[]>(() => {
  const list: AlertItem[] = []

  for (const match of props.matches) {
    if (match.status === 'completed' && (match.scoreHome === null || match.scoreAway === null)) {
      list.push({
        key: `incomplete-${match.id}`,
        severity: 'danger',
        title: 'Match terminé sans score complet',
        detail: `${describe(match)} : le statut est « terminé » mais un score est vide. Ce match est ignoré par le classement.`,
        matchId: match.id
      })
    }

    if (match.status === 'completed' && match.scoreHome !== null && match.scoreAway !== null && match.scoreHome === match.scoreAway) {
      list.push({
        key: `draw-${match.id}`,
        severity: 'danger',
        title: 'Égalité non départagée',
        detail: `${describe(match)} : en élimination directe une égalité ne désigne pas de vainqueur. Départage ou forfait à enregistrer.`,
        matchId: match.id
      })
    }

    if (match.status === 'live' && match.scoreHome === null && match.scoreAway === null) {
      list.push({
        key: `live-${match.id}`,
        severity: 'warn',
        title: 'Match en direct sans score',
        detail: `${describe(match)} : marqué « en direct » mais aucun score saisi pour l’instant.`,
        matchId: match.id
      })
    }
  }

  const emptySlots = props.matches.filter(match => match.status !== 'completed' && (!match.homeTeam || !match.awayTeam)).length
  if (emptySlots > 0) {
    list.push({
      key: 'empty-slots',
      severity: 'info',
      title: `${emptySlots} place${emptySlots > 1 ? 's' : ''} non attribuée${emptySlots > 1 ? 's' : ''}`,
      detail: 'Des matchs attendent une équipe (bye du premier tour ou tour précédent encore à jouer). Aucune saisie n’est possible tant que les deux camps ne sont pas connus.'
    })
  }

  const rounds = new Map<number, number>()
  for (const match of props.matches) rounds.set(match.round, (rounds.get(match.round) || 0) + 1)
  const sortedRounds = [...rounds.entries()].sort((a, b) => a[0] - b[0])
  for (let index = 1; index < sortedRounds.length; index += 1) {
    const previous = sortedRounds[index - 1]
    const current = sortedRounds[index]
    if (!previous || !current) continue
    const expected = Math.ceil(previous[1] / 2)
    if (current[1] !== expected) {
      list.push({
        key: `round-${current[0]}`,
        severity: 'warn',
        title: `Bracket incohérent au tour ${current[0]}`,
        detail: `Le tour ${previous[0]} compte ${previous[1]} match${previous[1] > 1 ? 's' : ''} ; le tour suivant en compte ${current[1]} au lieu de ${expected}. Un tour doit diviser le précédent par deux (arrondi supérieur).`
      })
    }
  }

  const withoutSeed = props.teams.filter(team => team.seed === null).length
  if (withoutSeed > 0) {
    list.push({
      key: 'seed-missing',
      severity: 'warn',
      title: `${withoutSeed} équipe${withoutSeed > 1 ? 's' : ''} sans tête de série`,
      detail: 'Une équipe sans seed n’a pas de position définie : passe par l’onglet Seeding pour figer l’ordre avant de lancer les matchs.'
    })
  }

  if (!props.matches.length) {
    list.push({
      key: 'no-match',
      severity: 'info',
      title: 'Aucun match généré',
      detail: 'Ce tournoi n’a pas encore d’appariements.'
    })
  }

  return list.sort((a, b) => {
    const order: Record<AlertSeverity, number> = { danger: 0, warn: 1, info: 2 }
    return order[a.severity] - order[b.severity]
  })
})

const visible = computed(() => alerts.value.slice(0, MAX_VISIBLE))
const hiddenCount = computed(() => Math.max(0, alerts.value.length - visible.value.length))
</script>

<template>
  <section class="space-y-3">
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <p class="gaming-eyebrow">
        Points de vigilance
      </p>
      <p class="text-xs text-muted">
        Détections calculées localement à partir des matchs saisis.
      </p>
    </div>

    <p
      v-if="!alerts.length"
      class="gaming-alert gaming-alert--clear"
    >
      <UIcon
        name="i-lucide-shield-check"
        class="gaming-alert__icon"
        aria-hidden="true"
      />
      <span>
        <strong>Aucun point de vigilance.</strong>
        Les résultats saisis sont cohérents : poursuis le tournoi.
      </span>
    </p>

    <ul
      v-else
      class="gaming-alert-list"
    >
      <li
        v-for="alert in visible"
        :key="alert.key"
        class="gaming-alert"
        :class="`gaming-alert--${alert.severity}`"
      >
        <UIcon
          :name="alert.severity === 'danger' ? 'i-lucide-triangle-alert' : alert.severity === 'warn' ? 'i-lucide-clock-alert' : 'i-lucide-info'"
          class="gaming-alert__icon"
          aria-hidden="true"
        />
        <span class="gaming-alert__body">
          <strong class="gaming-alert__title">{{ alert.title }}</strong>
          <span class="gaming-alert__detail">{{ alert.detail }}</span>
        </span>
        <UButton
          v-if="alert.matchId"
          class="gaming-alert__action"
          color="neutral"
          variant="soft"
          size="xs"
          icon="i-lucide-sliders-horizontal"
          label="Contrôler"
          @click="emit('focus', alert.matchId)"
        />
      </li>
    </ul>

    <p
      v-if="hiddenCount"
      class="text-xs text-muted"
    >
      + {{ hiddenCount }} autre<span v-if="hiddenCount > 1">s</span> point<span v-if="hiddenCount > 1">s</span> de vigilance non affiché<span v-if="hiddenCount > 1">s</span>.
    </p>
  </section>
</template>

<style scoped>
.gaming-eyebrow {
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent-color);
}

.gaming-alert-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.gaming-alert {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  border: 1px solid var(--border-color);
  background: rgba(var(--primary-color-rgb), 0.04);
  padding: 0.7rem 0.8rem;
  font-size: 0.82rem;
  color: var(--text-color);
}

.gaming-alert__icon {
  height: 1.05rem;
  width: 1.05rem;
  flex: none;
  margin-top: 0.1rem;
  color: var(--muted-color);
}

.gaming-alert__body {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.15rem;
}

.gaming-alert__title {
  font-weight: 700;
}

.gaming-alert__detail {
  color: var(--muted-color);
}

.gaming-alert__action {
  flex: none;
}

.gaming-alert--danger {
  border-color: rgba(var(--primary-color-rgb), 0.5);
  background: rgba(var(--primary-color-rgb), 0.1);
}

.gaming-alert--danger .gaming-alert__icon {
  color: var(--primary-color);
}

.gaming-alert--warn {
  border-style: dashed;
  border-color: rgba(var(--accent-color-rgb), 0.45);
}

.gaming-alert--warn .gaming-alert__icon {
  color: var(--accent-color);
}

.gaming-alert--clear {
  border-style: dashed;
  border-color: rgba(var(--accent-color-rgb), 0.4);
  align-items: center;
}

.gaming-alert--clear .gaming-alert__icon {
  color: var(--accent-color);
}
</style>
