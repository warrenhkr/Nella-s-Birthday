<script setup lang="ts">
// Panneau de contrôle d'un match : statut, scores, forfait et remise à zéro.
// Toutes les écritures passent par PATCH /api/tournaments/:id/matches/:matchId
// (statut + scoreHome + scoreAway), seul contrat accepté par l'API actuelle.
type ControlTeam = { name: string, seed: number | null }

const props = defineProps<{
  tournamentId: string
  match: {
    id: string
    round: number
    position: number
    status: string
    scoreHome: number | null
    scoreAway: number | null
    homeTeam: ControlTeam | null
    awayTeam: ControlTeam | null
  }
}>()

const emit = defineEmits<{ updated: [] }>()

const { success, alert } = useGameToast()
const { playSfx } = useSoundManager()

const draft = reactive({
  status: 'scheduled',
  scoreHome: null as number | null,
  scoreAway: null as number | null
})
const saving = ref(false)
const forfeitTeam = ref<string>('')

watch(() => props.match, (match) => {
  Object.assign(draft, {
    status: match.status || 'scheduled',
    scoreHome: match.scoreHome,
    scoreAway: match.scoreAway
  })
  forfeitTeam.value = ''
}, { immediate: true, deep: true })

const homeName = computed(() => props.match.homeTeam?.name || 'À déterminer')
const awayName = computed(() => props.match.awayTeam?.name || 'À déterminer')
const bothTeamsKnown = computed(() => Boolean(props.match.homeTeam && props.match.awayTeam))

// Un champ numérique laissé vide renvoie une chaîne vide avec v-model.number :
// on normalise en entier positif ou null, sinon l'API (Zod) refuse la requête.
function normalizeScore(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.max(0, Math.trunc(parsed))
}

const homeScore = computed(() => normalizeScore(draft.scoreHome))
const awayScore = computed(() => normalizeScore(draft.scoreAway))

const scoresFilled = computed(() => homeScore.value !== null && awayScore.value !== null)
const isDraw = computed(() => scoresFilled.value && homeScore.value === awayScore.value)

const winnerName = computed(() => {
  if (!scoresFilled.value || isDraw.value) return null
  return (homeScore.value as number) > (awayScore.value as number) ? homeName.value : awayName.value
})

const blockedReason = computed(() => {
  if (!bothTeamsKnown.value) return 'Ce match attend encore une équipe : aucune saisie possible.'
  if (draft.status === 'completed' && !scoresFilled.value) return 'Renseigne les deux scores avant de clôturer ce match.'
  if (draft.status === 'completed' && isDraw.value) return 'Match à égalité : en élimination directe, un nul ne peut pas clôturer. Départage ou forfait requis.'
  return null
})

const roundLabel = computed(() => `Tour ${props.match.round} · match ${props.match.position}`)

function getApiErrorMessage(errorValue: unknown, fallback: string) {
  if (typeof errorValue === 'object' && errorValue !== null && 'data' in errorValue) {
    const data = errorValue.data
    if (typeof data === 'object' && data !== null && 'statusMessage' in data && typeof data.statusMessage === 'string') return data.statusMessage
  }
  return fallback
}

async function persist(message: string) {
  if (blockedReason.value) {
    playSfx('error')
    alert(blockedReason.value)
    return false
  }

  saving.value = true
  try {
    await $fetch(`/api/tournaments/${props.tournamentId}/matches/${props.match.id}`, {
      method: 'PATCH',
      body: {
        status: draft.status,
        scoreHome: homeScore.value,
        scoreAway: awayScore.value
      }
    })
    playSfx('success')
    success(message)
    emit('updated')
    return true
  } catch (patchError: unknown) {
    playSfx('error')
    alert(getApiErrorMessage(patchError, 'Impossible de mettre à jour ce match.'))
    return false
  } finally {
    saving.value = false
  }
}

async function save() {
  const done = await persist('Match mis à jour.')
  if (done) playSfx('click')
}

async function startMatch() {
  draft.status = 'live'
  await persist('Match démarré (en direct).')
}

async function finishMatch() {
  const home = homeScore.value
  const away = awayScore.value
  if (home === null || away === null || home === away) {
    alert('Saisis un score décisif avant de clôturer le match.')
    return
  }
  draft.status = 'completed'
  await persist('Match clôturé.')
}

async function resetMatch() {
  if (!window.confirm('Remettre ce match à zéro (scores effacés, statut « planifié ») ?')) return
  draft.scoreHome = null
  draft.scoreAway = null
  draft.status = 'scheduled'
  await persist('Match réinitialisé.')
}

// Forfait : le scoreline est FIGÉ et plafonné (2-0 sur un format au meilleur des 3).
// Jamais un score inventé : un forfait à 5-0 fausserait un classement au goal-average.
async function applyForfeit() {
  if (!forfeitTeam.value) {
    alert('Choisis l’équipe déclarée forfait.')
    return
  }
  const loser = forfeitTeam.value === 'home' ? homeName.value : awayName.value
  if (!window.confirm(`Enregistrer le forfait de « ${loser} » sur le scoreline fixe 2-0 ?`)) return

  draft.scoreHome = forfeitTeam.value === 'home' ? 0 : 2
  draft.scoreAway = forfeitTeam.value === 'home' ? 2 : 0
  draft.status = 'completed'
  await persist(`Forfait de ${loser} enregistré (scoreline fixe 2-0).`)
}
</script>

<template>
  <div class="space-y-5">
    <div class="gaming-match-head">
      <div>
        <p class="gaming-eyebrow">
          {{ roundLabel }}
        </p>
        <p class="gaming-match-head__teams">
          {{ homeName }} <span class="gaming-match-head__vs">vs</span> {{ awayName }}
        </p>
      </div>
      <GamingStatusBadge :status="draft.status" />
    </div>

    <div
      v-if="!bothTeamsKnown"
      class="gaming-match-warning"
    >
      <UIcon
        name="i-lucide-hourglass"
        aria-hidden="true"
      />
      Une des deux places est encore vide (équipe à déterminer par le tour précédent).
    </div>

    <div class="gaming-score">
      <div class="gaming-score__side">
        <p class="gaming-score__team">
          {{ homeName }}
        </p>
        <UInput
          v-model.number="draft.scoreHome"
          type="number"
          min="0"
          :aria-label="`Score de ${homeName}`"
        />
      </div>
      <span class="gaming-score__separator">–</span>
      <div class="gaming-score__side">
        <p class="gaming-score__team">
          {{ awayName }}
        </p>
        <UInput
          v-model.number="draft.scoreAway"
          type="number"
          min="0"
          :aria-label="`Score de ${awayName}`"
        />
      </div>
    </div>

    <UFormField label="Statut du match">
      <AppSelect
        v-model="draft.status"
        icon="i-lucide-activity"
        aria-label="Statut du match"
        :options="[
          { label: 'Planifié', value: 'scheduled' },
          { label: 'En direct', value: 'live' },
          { label: 'Terminé', value: 'completed' }
        ]"
      />
    </UFormField>

    <p
      v-if="blockedReason"
      class="gaming-hint gaming-hint--blocked"
    >
      <UIcon
        name="i-lucide-triangle-alert"
        aria-hidden="true"
      />
      {{ blockedReason }}
    </p>
    <p
      v-else-if="winnerName"
      class="gaming-hint"
    >
      <UIcon
        name="i-lucide-trophy"
        aria-hidden="true"
      />
      Vainqueur retenu : <strong>{{ winnerName }}</strong>
    </p>

    <div class="flex flex-wrap gap-2">
      <UButton
        color="primary"
        icon="i-lucide-save"
        label="Enregistrer"
        :loading="saving"
        :disabled="Boolean(blockedReason)"
        @click="save"
      />
      <UButton
        color="primary"
        variant="soft"
        icon="i-lucide-play"
        label="Démarrer"
        :disabled="saving || !bothTeamsKnown || draft.status === 'live'"
        @click="startMatch"
      />
      <UButton
        color="primary"
        variant="soft"
        icon="i-lucide-flag"
        label="Clôturer"
        :disabled="saving || !bothTeamsKnown || draft.status === 'completed'"
        @click="finishMatch"
      />
      <UButton
        color="neutral"
        variant="soft"
        icon="i-lucide-undo-2"
        label="Remettre à zéro"
        :disabled="saving || (draft.status === 'scheduled' && !scoresFilled)"
        @click="resetMatch"
      />
    </div>

    <div class="gaming-forfeit surface-solid clip-corner">
      <p class="gaming-eyebrow">
        Forfait / walkover
      </p>
      <p class="mt-1 text-sm text-muted">
        Le forfait s’enregistre sur un scoreline fixe et plafonné (2-0, format au meilleur des 3) : jamais un score libre,
        sinon un forfait pèserait plus qu’une victoire dans un classement à la différence de points.
      </p>
      <div class="mt-3 flex flex-wrap items-end gap-2">
        <div class="min-w-48">
          <UFormField label="Équipe déclarée forfait">
            <AppSelect
              v-model="forfeitTeam"
              icon="i-lucide-ban"
              aria-label="Équipe déclarée forfait"
              :disabled="!bothTeamsKnown"
            >
              <option value="">
                Choisir…
              </option>
              <option value="home">
                {{ homeName }}
              </option>
              <option value="away">
                {{ awayName }}
              </option>
            </AppSelect>
          </UFormField>
        </div>
        <UButton
          color="error"
          variant="soft"
          icon="i-lucide-ban"
          label="Enregistrer le forfait (2-0)"
          :disabled="saving || !bothTeamsKnown || !forfeitTeam"
          @click="applyForfeit"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.gaming-eyebrow {
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent-color);
}

.gaming-match-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.75rem;
}

.gaming-match-head__teams {
  margin-top: 0.25rem;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-color);
}

.gaming-match-head__vs {
  color: var(--muted-color);
  font-weight: 500;
}

.gaming-match-warning,
.gaming-hint {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  font-size: 0.82rem;
  color: var(--muted-color);
}

.gaming-match-warning,
.gaming-hint--blocked {
  border: 1px dashed rgba(var(--primary-color-rgb), 0.4);
  background: rgba(var(--primary-color-rgb), 0.06);
  padding: 0.6rem 0.75rem;
  color: var(--text-color);
}

.gaming-match-warning svg,
.gaming-hint svg {
  height: 1rem;
  width: 1rem;
  flex: none;
  margin-top: 0.1rem;
  color: var(--primary-color);
}

.gaming-score {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 0.75rem;
}

.gaming-score__side {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.4rem;
}

.gaming-score__team {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.82rem;
  color: var(--muted-color);
}

.gaming-score__separator {
  font-family: var(--font-display);
  font-size: 1.5rem;
  color: var(--muted-color);
}

.gaming-forfeit {
  border: 1px dashed rgba(var(--primary-color-rgb), 0.3);
  padding: 0.9rem;
}
</style>
