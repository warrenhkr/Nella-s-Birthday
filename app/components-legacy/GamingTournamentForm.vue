<script setup lang="ts">
// Formulaire de création d'un tournoi, dans un panneau latéral (USlideover).
// Servira d'assistant minimal : validation en direct de la liste d'équipes,
// aperçu du seeding généré, message d'erreur serveur remonté tel quel.
// Nouvelle compatibilité : l'admin peut maintenant créer un tournoi
// soit à partir d'équipes déjà connues du roster, soit en mode ouvert
// avec inscription publique et limite de participants.
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ created: [] }>()

const { success, alert } = useGameToast()
const { playSfx } = useSoundManager()

type KnownTeam = {
  id: string
  name: string
  logoUrl: string | null
  description: string | null
  captainId: string | null
  tournamentId: string | null
  seed: number | null
  memberCount: number
  members: Array<{ id: string, userId: string, role: string, joinedAt: string | null, pseudo: string | null, nom: string | null, prenom: string | null }>
}

type TournamentMode = 'known' | 'open'

const form = reactive({ name: '', game: '', teams: '', status: 'draft' })
const submitting = ref(false)
const showErrors = ref(false)
const mode = ref<TournamentMode>('known')
const selectedTeamIds = ref<string[]>([])
const registrationOpen = ref(false)
const maxTeams = ref<number | null>(null)
const visibility = ref<'DRAFT' | 'UNLISTED' | 'PUBLIC'>('DRAFT')

const { data: teamFetch } = await useFetch<{ data: KnownTeam[] }>(() => '/api/teams/admin', {
  server: false,
  lazy: false,
  default: () => ({ data: [] })
})
const knownTeams = computed(() => teamFetch.value?.data || [])

// ── Mode par défaut utilisable ───────────────────────────────────────────────
// Le mode « Équipes connues » suppose un roster : sur une plateforme neuve
// (aucune équipe enregistrée) il rend le formulaire IMPOSSIBLE à valider — le
// bouton « Créer le tournoi » ne renvoyait qu'un message d'erreur, sans jamais
// appeler l'API. On bascule donc d'office en mode ouvert, seul mode que l'API
// accepte sans plateau (`server/api/tournaments/index.post.ts` : les équipes
// s'inscrivent ensuite depuis /tournois/[id]). Dès que le roster existe, le
// mode connu reste le défaut.
watch(computed(() => knownTeams.value.length > 0), (rosterDisponible) => {
  if (!rosterDisponible && mode.value === 'known' && selectedTeamIds.value.length === 0) {
    mode.value = 'open'
  }
}, { immediate: true })

// Une équipe déjà rattachée à un tournoi est refusée par l'API (409) : on
// l'affiche mais elle n'est pas sélectionnable, pour ne jamais proposer une
// sélection que le serveur rejettera.
const engagedTeamsCount = computed(() => knownTeams.value.filter(team => Boolean(team.tournamentId)).length)

// Message du sélecteur de roster : on explique POURQUOI une équipe n'est pas
// cochable plutôt que de laisser l'utilisateur buter sur un refus du serveur.
const knownTeamsHint = computed(() => {
  if (!engagedTeamsCount.value) return 'Sélectionne au moins 2 équipes déjà présentes dans le roster du club.'
  const plusieurs = engagedTeamsCount.value > 1
  return `Sélectionne au moins 2 équipes du roster. ${engagedTeamsCount.value} équipe${plusieurs ? 's sont déjà engagées' : ' est déjà engagée'} dans un autre tournoi : elle${plusieurs ? 's ne sont' : ' n’est'} pas sélectionnable${plusieurs ? 's' : ''}.`
})

const gamePresets = ['FIFA', 'eFootball', 'Tekken', 'Street Fighter', 'Mario Kart', 'Super Smash Bros.', 'Call of Duty', 'Valorant']

// Statuts métier contrôlés : on garde uniquement les statuts réellement
// utiles sur le cycle de vie d’un tournoi.
const statusOptions = [
  { value: 'draft', label: 'Brouillon' },
  { value: 'registration_open', label: 'Inscriptions ouvertes' },
  { value: 'checkin', label: 'Contrôle des équipes' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'completed', label: 'Terminé' },
  { value: 'cancelled', label: 'Annulé' }
]

const modeHelpMap = {
  known: 'Mode “Équipes connues” : le tournoi se construit à partir du roster du club, c’est-à-dire la liste des équipes déjà enregistrées et validées dans la plateforme. Tu sélectionnes ces équipes existantes pour créer le plateau.',
  open: 'Mode “Ouvert aux inscriptions” : le tournoi accepte des équipes nouvelles ou extérieures. Tu ouvres ensuite les inscriptions, fixes une limite d’équipes et la liste des équipes est saisie ou collectée via les demandes.'
}

const modeHelp = computed(() => modeHelpMap[mode.value])

const statusHelpMap: Record<string, string> = {
  draft: 'Brouillon : le tournoi est encore en préparation. Il n’est pas prêt à être publié ni lancé.',
  registration_open: 'Inscriptions ouvertes : les équipes peuvent encore s’inscrire au tournoi.',
  checkin: 'Contrôle des équipes : on vérifie que les équipes présentes sont bien celles attendues avant le début.',
  in_progress: 'En cours : le tournoi est lancé et les affrontements ont commencé.',
  completed: 'Terminé : le tournoi est clôturé avec un résultat final.',
  cancelled: 'Annulé : le tournoi est arrêté et ne continue pas.'
}

const selectedStatusHelp = computed(() => statusHelpMap[form.status] || 'Statut du tournoi : état actuel du tournoi.')

const visibilityOptions = [
  { value: 'DRAFT', label: 'Brouillon — invisible' },
  { value: 'UNLISTED', label: 'Non listé — partage par lien' },
  { value: 'PUBLIC', label: 'Public — visible dans /tournois' }
]

// Statut « terminal » : le tournoi est déjà joué (ou annulé). Dans ce cas,
// la liste d'équipes n'est plus obligatoire (on enregistre une archive).
const ARCHIVE_STATUSES = ['completed', 'cancelled']
const isArchiveStatus = computed(() => ARCHIVE_STATUSES.includes(form.status))

const parsedTeams = computed(() => {
  const lines = form.teams.split('\n').map(line => line.trim()).filter(Boolean)
  const unique = [...new Set(lines)]
  return {
    lines,
    unique,
    duplicates: lines.length - unique.length,
    tooShort: unique.filter(name => name.length < 2),
    tooLong: unique.filter(name => name.length > 80)
  }
})

const errors = computed(() => {
  const list: string[] = []
  if (form.name.trim().length < 3) list.push('Le nom du tournoi doit faire au moins 3 caractères.')
  if (form.game.trim().length < 2) list.push('Indique le jeu (2 caractères minimum).')
  if (mode.value === 'known') {
    if (selectedTeamIds.value.length < 2) list.push('Choisis au moins deux équipes connues.')
  } else {
    if (!registrationOpen.value) list.push('Le mode ouvert doit activer les inscriptions en ligne.')
    if ((maxTeams.value ?? 0) < 2) list.push('La limite d’équipes du mode ouvert doit être au moins 2.')
    // Règle de plateau ALIGNÉE sur l'API : zéro équipe est accepté quand les
    // inscriptions en ligne sont ouvertes (le plateau se remplit depuis
    // /tournois/[id]) ; une seule équipe est toujours refusée, exactement comme
    // côté serveur. Le mode connu, lui, ne se valide qu'avec des équipes du
    // roster (voir la branche ci-dessus).
    const uniqueTeams = parsedTeams.value.unique
    const plateauObligatoire = !registrationOpen.value && !isArchiveStatus.value
    if (uniqueTeams.length === 1 || (plateauObligatoire && uniqueTeams.length === 0)) {
      list.push('Soit aucune équipe (les équipes s’inscrivent en ligne), soit au moins deux équipes distinctes.')
    }
    if (uniqueTeams.length > 32) list.push('32 équipes maximum par tournoi.')
    if (parsedTeams.value.tooShort.length) list.push(`Nom trop court : ${parsedTeams.value.tooShort.join(', ')}.`)
    if (parsedTeams.value.tooLong.length) list.push('Les noms d’équipe sont limités à 80 caractères.')
  }
  return list
})

const valid = computed(() => errors.value.length === 0)
const canSubmit = computed(() => submitting.value === false)

function reset() {
  Object.assign(form, { name: '', game: '', teams: '', status: 'draft' })
  // Retour à l'état initial : le mode par défaut reste celui qui est utilisable
  // avec le roster courant (voir le watcher au-dessus).
  mode.value = knownTeams.value.length > 0 ? 'known' : 'open'
  selectedTeamIds.value = []
  registrationOpen.value = false
  maxTeams.value = null
  visibility.value = 'DRAFT'
  showErrors.value = false
}

function getApiErrorMessage(errorValue: unknown, fallback: string) {
  if (typeof errorValue === 'object' && errorValue !== null && 'data' in errorValue) {
    const data = errorValue.data
    if (typeof data === 'object' && data !== null && 'statusMessage' in data && typeof data.statusMessage === 'string') return data.statusMessage
  }
  return fallback
}

async function submit() {
  showErrors.value = true
  if (!valid.value) {
    alert(errors.value[0] || 'Formulaire incomplet.')
    return
  }

  submitting.value = true
  try {
    const archive = isArchiveStatus.value
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      game: form.game.trim(),
      status: form.status,
      visibility: visibility.value,
      registrationOpen: registrationOpen.value,
      maxTeams: mode.value === 'open' ? (maxTeams.value ?? null) : null,
      teams: mode.value === 'known' ? [] : parsedTeams.value.unique,
      teamIds: mode.value === 'known' ? selectedTeamIds.value : []
    }

    await $fetch('/api/tournaments', {
      method: 'POST',
      body
    })

    playSfx('success')
    if (archive && mode.value === 'open' && parsedTeams.value.unique.length === 0) {
      success(`Tournoi « ${form.name.trim()} » enregistré comme terminé (aucun plateau). Publie-le pour l’afficher dans les archives.`)
    } else if (mode.value === 'known') {
      success(`Tournoi créé avec ${selectedTeamIds.value.length} équipes connues.`)
    } else if (parsedTeams.value.unique.length === 0) {
      // Plateau vide assumé : les équipes viendront par les inscriptions en ligne.
      success(`Tournoi « ${form.name.trim()} » créé. Les équipes s’inscriront depuis la fiche du tournoi.`)
    } else {
      success(`Tournoi créé avec ${parsedTeams.value.unique.length} équipes. Le premier tour est généré.`)
    }
    reset()
    open.value = false
    emit('created')
  } catch (creationError: unknown) {
    playSfx('error')
    alert(getApiErrorMessage(creationError, 'Impossible de créer le tournoi.'))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <USlideover
    v-model:open="open"
    title="Nouveau tournoi"
    description="Choisis le statut : un tournoi en cours, ou l’archive d’un tournoi déjà terminé."
    :ui="{ content: 'gaming-panel', overlay: 'gaming-panel-overlay' }"
  >
    <template #body>
      <form
        id="gaming-tournament-form"
        class="space-y-5"
        @submit.prevent="submit"
      >
        <UFormField
          label="Nom du tournoi"
          required
        >
          <UInput
            v-model="form.name"
            placeholder="Coupe Otaku — Tekken 8"
            autocomplete="off"
          />
        </UFormField>

        <UFormField
          label="Jeu"
          required
          hint="Choisis une suggestion ou écris le titre exact."
        >
          <UInput
            v-model="form.game"
            placeholder="Tekken"
            autocomplete="off"
          />
          <div class="mt-2 flex flex-wrap gap-2">
            <button
              v-for="preset in gamePresets"
              :key="preset"
              type="button"
              class="gaming-chip"
              :class="{ 'gaming-chip--active': form.game.trim() === preset }"
              @click="form.game = preset"
            >
              {{ preset }}
            </button>
          </div>
        </UFormField>

        <UFormField
          label="Statut"
          hint="Choisis l’état du tournoi : préparation, inscriptions, contrôle, jeu, fin ou annulation."
        >
          <AppSelect
            v-model="form.status"
            :options="statusOptions"
            icon="i-lucide-flag"
            aria-label="Statut du tournoi"
          />
          <div class="mt-3 rounded-xl border border-default bg-black/5 px-3 py-2 text-xs text-muted">
            <span class="font-semibold text-(--text-color)">
              {{ statusOptions.find(option => option.value === form.status)?.label || 'Statut' }}
            </span>
            <span class="mt-1 block">
              {{ selectedStatusHelp }}
            </span>
          </div>
        </UFormField>

        <UFormField
          label="Mode"
          hint="Choisis le mode de construction du tournoi : plateau connu ou inscription ouverte."
        >
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="gaming-chip"
              :class="{ 'gaming-chip--active': mode === 'known' }"
              :disabled="!knownTeams.length"
              @click="mode = 'known'"
            >
              Équipes connues
            </button>
            <button
              type="button"
              class="gaming-chip"
              :class="{ 'gaming-chip--active': mode === 'open' }"
              @click="mode = 'open'"
            >
              Ouvert aux inscriptions
            </button>
          </div>
          <div class="mt-3 rounded-xl border border-default bg-black/5 px-3 py-2 text-xs text-muted">
            <span class="font-semibold text-(--text-color)">
              {{ mode === 'known' ? 'Plateau connu' : 'Inscriptions ouvertes' }}
            </span>
            <span class="mt-1 block">
              {{ modeHelp }}
            </span>
          </div>
        </UFormField>

        <UFormField
          v-if="mode === 'known'"
          label="Équipes connues"
          :required="!isArchiveStatus"
          :hint="knownTeamsHint"
        >
          <div class="grid grid-cols-1 gap-2 max-h-52 overflow-auto rounded-xl border border-white/10 p-2">
            <label
              v-for="team in knownTeams"
              :key="team.id"
              class="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-white/5"
              :class="{ 'opacity-50': team.tournamentId }"
            >
              <input
                v-model="selectedTeamIds"
                :value="team.id"
                type="checkbox"
                class="rounded"
                :disabled="Boolean(team.tournamentId)"
              />
              <span class="font-medium">{{ team.name }}</span>
              <span class="text-xs opacity-70">({{ team.memberCount }} membre{{ team.memberCount > 1 ? 's' : '' }})</span>
              <span
                v-if="team.tournamentId"
                class="text-xs opacity-70"
              >
                — déjà engagée dans un tournoi
              </span>
            </label>
            <p v-if="!knownTeams.length" class="text-sm opacity-70">
              Aucun roster d’équipe n’est encore visible : utilise le mode « Ouvert aux inscriptions »,
              seul mode qui permet de créer un tournoi sans équipe déjà enregistrée — les équipes
              s’inscriront ensuite depuis la fiche du tournoi.
            </p>
          </div>
        </UFormField>

        <UFormField
          v-else
          label="Équipes ou joueurs"
          :required="!isArchiveStatus && !registrationOpen"
          :hint="isArchiveStatus
            ? 'Facultatif pour une archive : laisse vide si le plateau n’est plus connu.'
            : 'Une équipe par ligne (2 à 32). Les doublons sont retirés automatiquement. Laisse vide si les inscriptions en ligne doivent remplir le plateau : l’API accepte un tournoi sans plateau.'"
        >
          <UTextarea
            v-model="form.teams"
            :rows="6"
            placeholder="Alpha&#10;Bravo&#10;Charlie&#10;Delta"
          />
        </UFormField>

        <UFormField
          v-if="mode === 'open'"
          label="Visibilité"
          hint="Varie la publication publique du tournoi."
        >
          <AppSelect
            v-model="visibility"
            :options="visibilityOptions"
            icon="i-lucide-eye"
            aria-label="Visibilité du tournoi"
          />
        </UFormField>

        <UFormField
          v-if="mode === 'open'"
          label="Inscriptions"
          hint="Ouvre les inscriptions en ligne pour les équipes extérieures."
        >
          <div class="flex flex-wrap items-center gap-3">
            <USwitch
              v-model="registrationOpen"
              color="primary"
              label="Inscriptions en ligne ouvertes"
            />
            <UInput
              v-model="maxTeams"
              type="number"
              min="2"
              max="128"
              placeholder="16"
              autocomplete="off"
            />
          </div>
        </UFormField>

        <div class="gaming-preview surface-solid clip-corner">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="gaming-preview__title">
              Aperçu du seeding
            </p>
            <p class="gaming-preview__count">
              {{ parsedTeams.unique.length }} équipe<span v-if="parsedTeams.unique.length > 1">s</span> retenue<span v-if="parsedTeams.unique.length > 1">s</span>
            </p>
          </div>
          <p
            v-if="parsedTeams.duplicates > 0"
            class="gaming-preview__note"
          >
            {{ parsedTeams.duplicates }} doublon<span v-if="parsedTeams.duplicates > 1">s</span> ignoré<span v-if="parsedTeams.duplicates > 1">s</span>.
          </p>
          <ol
            v-if="parsedTeams.unique.length"
            class="gaming-preview__list"
          >
            <li
              v-for="(team, index) in parsedTeams.unique.slice(0, 32)"
              :key="`${team}-${index}`"
              class="gaming-preview__item"
            >
              <span class="gaming-preview__seed">{{ index + 1 }}</span>
              <span>{{ team }}</span>
            </li>
          </ol>
          <p
            v-else
            class="gaming-preview__note"
          >
            Aucune équipe détectée pour le moment.
          </p>
          <p class="gaming-preview__note">
            Le premier tour apparie les équipes dans cet ordre : 1 contre 2, 3 contre 4, etc.
            Réordonne ensuite le seeding depuis le cockpit du tournoi.
          </p>
        </div>

        <UAlert
          v-if="showErrors && errors.length"
          color="error"
          variant="soft"
          icon="i-lucide-triangle-alert"
          title="Il reste des points à corriger"
          :description="errors.join(' ')"
        />
      </form>
    </template>

    <template #footer="{ close }">
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton
          color="neutral"
          variant="soft"
          label="Annuler"
          @click="close()"
        />
        <UButton
          type="submit"
          form="gaming-tournament-form"
          color="primary"
          icon="i-lucide-plus"
          :loading="submitting"
          :disabled="!canSubmit"
          label="Créer le tournoi"
        />
      </div>
    </template>
  </USlideover>
</template>

<style scoped>
.gaming-chip {
  border-radius: 9999px;
  border: 1px solid var(--border-color);
  padding: 0.25rem 0.7rem;
  font-size: 0.72rem;
  color: var(--text-color);
  background: transparent;
  cursor: pointer;
  transition: border-color 0.18s ease, background-color 0.18s ease;
}

.gaming-chip:hover {
  border-color: rgba(var(--primary-color-rgb), 0.5);
  transform: translateY(-1px);
}

/* Puce impossible à choisir : le mode n'est pas utilisable en l'état
   (ex. « Équipes connues » sans aucun roster). */
.gaming-chip:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.gaming-chip:disabled:hover {
  border-color: var(--border-color);
  transform: none;
}

.gaming-chip--active {
  border-color: var(--primary-color);
  background: rgba(var(--primary-color-rgb), 0.18);
  font-weight: 600;
}

.gaming-preview {
  border: 1px dashed rgba(var(--primary-color-rgb), 0.3);
  padding: 0.9rem;
}

.gaming-preview__title {
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent-color);
}

.gaming-preview__count {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-color);
}

.gaming-preview__note {
  margin-top: 0.35rem;
  font-size: 0.75rem;
  color: var(--muted-color);
}

.gaming-preview__list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.6rem;
}

.gaming-preview__item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid rgba(var(--primary-color-rgb), 0.22);
  background: rgba(var(--primary-color-rgb), 0.06);
  padding: 0.15rem 0.5rem;
  font-size: 0.75rem;
  color: var(--text-color);
}

.gaming-preview__seed {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--accent-color);
}

/* Le panneau de la modale est téléporté hors de .app-shell : il n'hérite donc
   pas du pont de tokens posé dans main.css. On repose les mêmes tokens avec les
   variables du thème uniquement (donc valables dans les 4 combinaisons). */
:global(.gaming-panel) {
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

:global(.gaming-panel-overlay) {
  background: color-mix(in srgb, var(--primary-color) 55%, transparent) !important;
  backdrop-filter: blur(8px);
}
</style>
