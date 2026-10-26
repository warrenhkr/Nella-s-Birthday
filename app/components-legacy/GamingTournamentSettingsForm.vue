<script lang="ts">
// Type partagé : déclaré hors de <script setup> (qui ne peut pas exporter).
export type SettingsTournament = {
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
}
</script>

<script setup lang="ts">
// ============================================================
// GamingTournamentSettingsForm — réglages de PUBLICATION d'un tournoi.
//
// Panneau latéral branché sur PATCH /api/tournaments/:id. C'est ici que
// l'organisation décide :
//   * la VISIBILITÉ — 'DRAFT' (invisible), 'UNLISTED' (partage par lien),
//     'PUBLIC' (affiché dans /tournois). Sans publication, aucun tournoi
//     n'apparaît côté membre.
//   * l'ouverture des INSCRIPTIONS en ligne (`registrationOpen`) ;
//   * le nombre maximal d'équipes (`maxTeams`) ;
//   * le format, la description et les dates affichés sur la fiche membre.
//
// Thème : uniquement les variables CSS du site, AppSelect pour le
// sélecteur (composant unique), icônes Lucide.
// ============================================================

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{ tournament: SettingsTournament | null }>()
const emit = defineEmits<{ updated: [] }>()

const { success, alert } = useGameToast()
const { playSfx } = useSoundManager()

const visibilityOptions = [
  { value: 'DRAFT', label: 'Brouillon — invisible pour les membres' },
  { value: 'UNLISTED', label: 'Non listé — accessible par le lien direct' },
  { value: 'PUBLIC', label: 'Public — affiché dans la liste des tournois' }
]

// Statuts métier contrôlés pour la publication et le suivi du tournoi.
// Le cycle visible reste lisible sans mélange entre statut interne,
// publication et mode d’inscription.
const BASE_STATUS_OPTIONS = [
  { value: 'draft', label: 'Brouillon' },
  { value: 'registration_open', label: 'Inscriptions ouvertes' },
  { value: 'checkin', label: 'Contrôle des équipes' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'completed', label: 'Terminé' },
  { value: 'cancelled', label: 'Annulé' }
]

const statusHelpMap: Record<string, string> = {
  draft: 'Brouillon : le tournoi est encore en préparation. Il n’est pas prêt à être publié ni lancé.',
  registration_open: 'Inscriptions ouvertes : les équipes peuvent encore s’inscrire au tournoi.',
  checkin: 'Contrôle des équipes : on vérifie que les équipes présentes sont bien celles attendues avant le début.',
  in_progress: 'En cours : le tournoi est lancé et les affrontements ont commencé.',
  completed: 'Terminé : le tournoi est clôturé avec un résultat final.',
  cancelled: 'Annulé : le tournoi est arrêté et ne continue pas.'
}

const selectedStatusHelp = computed(() => statusHelpMap[form.status] || 'Statut du tournoi : état actuel du tournoi.')

const ARCHIVE_STATUSES = ['completed', 'cancelled']

const form = reactive({
  status: 'draft',
  visibility: 'DRAFT',
  registrationOpen: false,
  maxTeams: '' as string,
  format: '',
  description: '',
  startDate: '',
  endDate: ''
})

const submitting = ref(false)

const isArchiveStatus = computed(() => ARCHIVE_STATUSES.includes(form.status))

// Un tournoi terminé/archivé n'accepte plus d'inscription : on ferme le
// drapeau automatiquement pour rester cohérent avec la fiche publique.
watch(() => form.status, (value) => {
  if (ARCHIVE_STATUSES.includes(value)) form.registrationOpen = false
})

// On garde la valeur courante en tête si elle sort de la liste connue, pour ne
// jamais écraser un statut existant lors d'un enregistrement.
const statusOptions = computed(() => {
  const current = (form.status || '').trim()
  if (current && !BASE_STATUS_OPTIONS.some(option => option.value === current)) {
    return [{ value: current, label: `${current} (valeur actuelle)` }, ...BASE_STATUS_OPTIONS]
  }
  return BASE_STATUS_OPTIONS
})

// '<ISO>' -> 'YYYY-MM-DDTHH:mm' dans le fuseau du navigateur (valeur
// attendue par <input type="datetime-local">).
function toLocalDateTime(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function syncFromTournament() {
  const tournament = props.tournament
  if (!tournament) return
  form.status = tournament.status || 'draft'
  form.visibility = tournament.visibility || 'DRAFT'
  form.registrationOpen = Boolean(tournament.registrationOpen)
  form.maxTeams = tournament.maxTeams === null || tournament.maxTeams === undefined ? '' : String(tournament.maxTeams)
  form.format = tournament.format || ''
  form.description = tournament.description || ''
  form.startDate = toLocalDateTime(tournament.startDate)
  form.endDate = toLocalDateTime(tournament.endDate)
}

watch([() => props.tournament, open], () => {
  if (open.value) syncFromTournament()
})

const visibilityHint = computed(() => {
  if (form.visibility === 'PUBLIC') return 'Le tournoi apparaîtra dans la liste publique des tournois du club.'
  if (form.visibility === 'UNLISTED') return 'Le tournoi n’apparaîtra pas dans la liste : seuls les membres munis du lien pourront y accéder.'
  return 'Le tournoi reste un brouillon : invisible pour tous les membres, même avec le lien.'
})

const maxTeamsError = computed(() => {
  if (form.maxTeams === '') return ''
  const value = Number(form.maxTeams)
  if (!Number.isInteger(value) || value < 2 || value > 128) return 'Entre un entier entre 2 et 128, ou laisse vide.'
  return ''
})

function getApiErrorMessage(errorValue: unknown, fallback: string) {
  if (typeof errorValue === 'object' && errorValue !== null && 'data' in errorValue) {
    const data = errorValue.data
    if (typeof data === 'object' && data !== null && 'statusMessage' in data && typeof data.statusMessage === 'string') return data.statusMessage
  }
  return fallback
}

async function submit() {
  if (!props.tournament) return
  if (maxTeamsError.value) {
    alert(maxTeamsError.value)
    return
  }

  submitting.value = true
  try {
    await $fetch(`/api/tournaments/${encodeURIComponent(props.tournament.id)}`, {
      method: 'PATCH',
      body: {
        status: form.status,
        visibility: form.visibility,
        registrationOpen: form.registrationOpen,
        maxTeams: form.maxTeams === '' ? null : Number(form.maxTeams),
        format: form.format.trim() || null,
        description: form.description.trim() || null,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null
      }
    })
    playSfx('success')
    success(form.visibility === 'PUBLIC' ? 'Tournoi publié.' : 'Réglages du tournoi enregistrés.')
    open.value = false
    emit('updated')
  } catch (saveError: unknown) {
    playSfx('error')
    alert(getApiErrorMessage(saveError, 'Impossible d’enregistrer les réglages du tournoi.'))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <USlideover
    v-model:open="open"
    title="Publication et inscriptions"
    description="Visibilité du tournoi, inscriptions en ligne et informations de la fiche membre."
    :ui="{ content: 'gaming-settings-panel', overlay: 'gaming-settings-panel-overlay' }"
  >
    <template #body>
      <form
        id="gaming-tournament-settings"
        class="space-y-5"
        @submit.prevent="submit"
      >
        <div
          v-if="tournament"
          class="gaming-settings-head surface-solid clip-corner"
        >
          <p class="gaming-settings-head__game">
            {{ tournament.game }}
          </p>
          <p class="gaming-settings-head__name">
            {{ tournament.name }}
          </p>
        </div>

        <UFormField
          label="Statut"
          hint="Un statut se lit en français et décrit l’avancement du tournoi : préparation, inscriptions, contrôle des équipes, cours, terminé ou annulé."
        >
          <AppSelect
            v-model="form.status"
            :options="statusOptions"
            icon="i-lucide-flag"
            aria-label="Statut du tournoi"
          />
          <div class="mt-3 rounded-xl border border-default bg-black/5 px-3 py-2 text-xs text-muted">
            <span class="font-semibold text-(--text-color)">
              {{ BASE_STATUS_OPTIONS.find(option => option.value === form.status)?.label || statusOptions.find(option => option.value === form.status)?.label || 'Statut' }}
            </span>
            <span class="mt-1 block">
              {{ selectedStatusHelp }}
            </span>
          </div>
        </UFormField>

        <UFormField
          label="Visibilité"
          required
          :hint="visibilityHint"
        >
          <AppSelect
            v-model="form.visibility"
            :options="visibilityOptions"
            icon="i-lucide-eye"
            aria-label="Visibilité du tournoi"
          />
        </UFormField>

        <div class="gaming-settings-row">
          <USwitch
            v-model="form.registrationOpen"
            color="primary"
            label="Inscriptions en ligne ouvertes"
            :disabled="isArchiveStatus"
            :description="isArchiveStatus ? 'Un tournoi terminé n’accepte plus d’inscription : la fiche publique masque le formulaire.' : 'Les capitaines peuvent inscrire leur équipe depuis la fiche du tournoi.'"
          />
        </div>

        <UFormField
          label="Équipes maximum"
          :error="maxTeamsError || undefined"
          hint="Vide = pas de limite."
        >
          <UInput
            v-model="form.maxTeams"
            type="number"
            min="2"
            max="128"
            placeholder="16"
            autocomplete="off"
          />
        </UFormField>

        <UFormField
          label="Format"
          hint="Texte libre affiché sur la fiche membre."
        >
          <UInput
            v-model="form.format"
            placeholder="Élimination directe, BO3"
            autocomplete="off"
          />
        </UFormField>

        <UFormField
          label="Description"
          hint="Règlement, horaires, lot à gagner… 2 000 caractères de texte maximum."
        >
          <ClientOnly>
            <RichTextEditor
              v-model="form.description"
              :max-characters="2000"
              aria-label="Description du tournoi"
              placeholder="Règlement, horaires, lot à gagner…"
            />
            <template #fallback>
              <UTextarea
                v-model="form.description"
                :rows="4"
                maxlength="2000"
                aria-label="Description du tournoi"
                placeholder="Règlement, horaires, lot à gagner…"
              />
            </template>
          </ClientOnly>
        </UFormField>

        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Début">
            <UInput
              v-model="form.startDate"
              type="datetime-local"
            />
          </UFormField>
          <UFormField label="Fin">
            <UInput
              v-model="form.endDate"
              type="datetime-local"
            />
          </UFormField>
        </div>

        <UAlert
          v-if="form.visibility === 'PUBLIC'"
          color="primary"
          variant="soft"
          icon="i-lucide-eye"
          title="Publication"
          description="Le tournoi sera visible dans « Tournois » dès l’enregistrement."
        />
        <UAlert
          v-else-if="form.visibility === 'UNLISTED'"
          color="warning"
          variant="soft"
          icon="i-lucide-link"
          title="Lien de partage"
          description="Le tournoi reste hors de la liste : communique l’adresse /tournois/… aux équipes concernées."
        />
        <UAlert
          v-else
          color="error"
          variant="soft"
          icon="i-lucide-eye-off"
          title="Brouillon"
          description="Aucun membre ne verra ce tournoi tant qu’il n’est pas publié."
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
          form="gaming-tournament-settings"
          color="primary"
          icon="i-lucide-save"
          :loading="submitting"
          :disabled="!tournament"
          label="Enregistrer"
        />
      </div>
    </template>
  </USlideover>
</template>

<style scoped>
.gaming-settings-head {
  border: 1px solid rgba(var(--primary-color-rgb), 0.24);
  padding: 0.8rem 0.9rem;
}

.gaming-settings-head__game {
  font-size: 0.68rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent-color);
}

.gaming-settings-head__name {
  margin-top: 0.25rem;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-color);
}

.gaming-settings-row {
  border: 1px dashed rgba(var(--primary-color-rgb), 0.28);
  padding: 0.75rem 0.9rem;
}

/* Le panneau est téléporté hors de .app-shell : on repose les tokens du
   thème (variables CSS du site uniquement) pour rester dans les 4
   combinaisons sombre/clair × persona/cyberpunk. */
:global(.gaming-settings-panel) {
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

:global(.gaming-settings-panel-overlay) {
  background: color-mix(in srgb, var(--primary-color) 55%, transparent) !important;
  backdrop-filter: blur(8px);
}
</style>
