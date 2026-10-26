<script setup lang="ts">
// ============================================================
// GamingRegistrationsPanel — validation des inscriptions en ligne.
//
// Réservé à l'organisation (PATCH /api/tournaments/:id/registrations).
// Une demande APPROVED rattache l'équipe au tournoi : elle rejoint la
// liste des équipes et pourra être seedée depuis le cockpit.
// ============================================================

type RegistrationMember = {
  userId: string
  role: string
  pseudo: string
  nom: string | null
  prenom: string | null
}

type RegistrationRow = {
  id: string
  status: string
  message: string | null
  createdAt: string
  team: {
    id: string
    name: string
    logoUrl: string | null
    description: string | null
    seed: number | null
    tournamentId: string | null
    captainPseudo: string | null
    memberCount: number
    members: RegistrationMember[]
  }
}

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{ tournament: { id: string, name: string, game: string } | null }>()
const emit = defineEmits<{ updated: [] }>()

const { success, alert } = useGameToast()
const { playSfx } = useSoundManager()

const rows = ref<RegistrationRow[]>([])
const loading = ref(false)
const actingId = ref<string | null>(null)

const pendingRows = computed(() => rows.value.filter(row => row.status === 'PENDING'))
const decidedRows = computed(() => rows.value.filter(row => row.status !== 'PENDING'))

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  APPROVED: 'Acceptée',
  REJECTED: 'Refusée'
}

async function load() {
  const tournamentId = props.tournament?.id
  if (!tournamentId) {
    rows.value = []
    return
  }
  loading.value = true
  try {
    const response = await $fetch<{ data: { registrations: RegistrationRow[] } }>(
      `/api/tournaments/${encodeURIComponent(tournamentId)}/registrations`
    )
    rows.value = response.data.registrations
  } catch {
    rows.value = []
    alert('Impossible de charger les demandes d’inscription.')
  } finally {
    loading.value = false
  }
}

async function decide(row: RegistrationRow, status: 'APPROVED' | 'REJECTED') {
  const tournamentId = props.tournament?.id
  if (!tournamentId) return
  actingId.value = row.id
  try {
    await $fetch(`/api/tournaments/${encodeURIComponent(tournamentId)}/registrations`, {
      method: 'PATCH',
      body: { registrationId: row.id, status }
    })
    playSfx('success')
    success(status === 'APPROVED'
      ? `« ${row.team.name} » rejoint le tournoi.`
      : `Demande de « ${row.team.name} » refusée.`)
    await load()
    emit('updated')
  } catch (decisionError: unknown) {
    playSfx('error')
    const data = (decisionError as { data?: { statusMessage?: string } })?.data
    alert(data?.statusMessage || 'Impossible d’enregistrer cette décision.')
  } finally {
    actingId.value = null
  }
}

function memberLabel(member: RegistrationMember) {
  const fullName = [member.prenom, member.nom].filter(Boolean).join(' ')
  return fullName ? `${member.pseudo} (${fullName})` : member.pseudo
}

watch(open, (value) => {
  if (value) load()
})

watch(() => props.tournament?.id, (value) => {
  if (value && open.value) load()
})
</script>

<template>
  <USlideover
    v-model:open="open"
    title="Inscriptions au tournoi"
    description="Valide ou refuse les équipes qui demandent à entrer dans le tournoi."
    :ui="{ content: 'gaming-registrations-panel', overlay: 'gaming-registrations-panel-overlay' }"
  >
    <template #body>
      <div class="space-y-5">
        <div class="gaming-reg-head surface-solid clip-corner">
          <p class="gaming-reg-head__game">
            {{ tournament?.game }}
          </p>
          <p class="gaming-reg-head__name">
            {{ tournament?.name }}
          </p>
          <p class="gaming-reg-head__count">
            {{ pendingRows.length }} demande<span v-if="pendingRows.length > 1">s</span> en attente
          </p>
        </div>

        <div
          v-if="loading"
          class="space-y-3"
        >
          <USkeleton class="h-24" />
          <USkeleton class="h-24" />
        </div>

        <p
          v-else-if="!rows.length"
          class="text-sm text-muted"
        >
          Aucune demande d’inscription pour ce tournoi. Ouvre les inscriptions
          (visibilité « Non listé » ou « Public » + inscriptions activées) pour que les
          capitaines puissent inscrire leur équipe.
        </p>

        <template v-else>
          <section class="space-y-3">
            <p class="gaming-reg-title">
              À traiter
            </p>
            <p
              v-if="!pendingRows.length"
              class="text-sm text-muted"
            >
              Toutes les demandes ont été traitées.
            </p>
            <article
              v-for="row in pendingRows"
              :key="row.id"
              class="gaming-reg-card surface-solid clip-corner"
            >
              <div class="gaming-reg-card__head">
                <img
                  v-if="row.team.logoUrl"
                  :src="row.team.logoUrl"
                  :alt="`Logo de ${row.team.name}`"
                  class="gaming-reg-card__logo"
                >
                <div class="min-w-0">
                  <p class="gaming-reg-card__name">
                    {{ row.team.name }}
                  </p>
                  <p class="gaming-reg-card__meta">
                    {{ row.team.memberCount }} joueur<span v-if="row.team.memberCount > 1">s</span>
                    <span v-if="row.team.captainPseudo"> · capitaine {{ row.team.captainPseudo }}</span>
                  </p>
                </div>
              </div>

              <RichTextContent
                v-if="row.team.description"
                class="gaming-reg-card__desc"
                :content="row.team.description"
                :label="`Présentation de l’équipe ${row.team.name}`"
              />

              <p
                v-if="row.message"
                class="gaming-reg-card__message"
              >
                <UIcon
                  name="i-lucide-message-square"
                  aria-hidden="true"
                />
                {{ row.message }}
              </p>

              <ul class="gaming-reg-card__roster">
                <li
                  v-for="member in row.team.members"
                  :key="member.userId"
                >
                  <UIcon
                    :name="member.role === 'CAPTAIN' ? 'i-lucide-crown' : 'i-lucide-user-round'"
                    aria-hidden="true"
                  />
                  {{ memberLabel(member) }}
                </li>
              </ul>

              <div class="gaming-reg-card__actions">
                <UButton
                  color="primary"
                  size="sm"
                  icon="i-lucide-check"
                  label="Accepter"
                  :loading="actingId === row.id"
                  @click="decide(row, 'APPROVED')"
                />
                <UButton
                  color="error"
                  variant="soft"
                  size="sm"
                  icon="i-lucide-x"
                  label="Refuser"
                  :disabled="actingId === row.id"
                  @click="decide(row, 'REJECTED')"
                />
              </div>
            </article>
          </section>

          <section
            v-if="decidedRows.length"
            class="space-y-3"
          >
            <p class="gaming-reg-title">
              Historique
            </p>
            <ul class="gaming-reg-history">
              <li
                v-for="row in decidedRows"
                :key="row.id"
                class="gaming-reg-history__row"
              >
                <span>{{ row.team.name }}</span>
                <span
                  class="gaming-reg-status"
                  :class="`gaming-reg-status--${row.status.toLowerCase()}`"
                >
                  {{ STATUS_LABELS[row.status] || row.status }}
                </span>
                <UButton
                  v-if="row.status === 'REJECTED'"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  icon="i-lucide-rotate-ccw"
                  label="Accepter"
                  :loading="actingId === row.id"
                  @click="decide(row, 'APPROVED')"
                />
              </li>
            </ul>
          </section>
        </template>
      </div>
    </template>

    <template #footer="{ close }">
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton
          color="neutral"
          variant="soft"
          label="Fermer"
          @click="close()"
        />
      </div>
    </template>
  </USlideover>
</template>

<style scoped>
.gaming-reg-head {
  border: 1px solid rgba(var(--primary-color-rgb), 0.24);
  padding: 0.8rem 0.9rem;
}

.gaming-reg-head__game {
  font-size: 0.68rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent-color);
}

.gaming-reg-head__name {
  margin-top: 0.25rem;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-color);
}

.gaming-reg-head__count {
  margin-top: 0.3rem;
  font-size: 0.78rem;
  color: var(--muted-color);
}

.gaming-reg-title {
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent-color);
}

.gaming-reg-card {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  border: 1px solid rgba(var(--primary-color-rgb), 0.2);
  padding: 0.9rem;
}

.gaming-reg-card__head {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.gaming-reg-card__logo {
  height: 2.75rem;
  width: 2.75rem;
  flex: none;
  border-radius: 0.6rem;
  object-fit: cover;
  border: 1px solid var(--border-color);
}

.gaming-reg-card__name {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-color);
}

.gaming-reg-card__meta,
.gaming-reg-card__desc,
.gaming-reg-card__message {
  font-size: 0.8rem;
  color: var(--muted-color);
}

.gaming-reg-card__message {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
}

.gaming-reg-card__message svg {
  height: 0.9rem;
  width: 0.9rem;
  flex: none;
  margin-top: 0.1rem;
  color: var(--accent-color);
}

.gaming-reg-card__roster {
  display: grid;
  gap: 0.25rem;
  border-top: 1px dashed var(--border-color);
  padding-top: 0.55rem;
  font-size: 0.8rem;
  color: var(--text-color);
}

.gaming-reg-card__roster li {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.gaming-reg-card__roster svg {
  height: 0.9rem;
  width: 0.9rem;
  flex: none;
  color: var(--primary-color);
}

.gaming-reg-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.gaming-reg-history {
  display: grid;
  gap: 0.35rem;
}

.gaming-reg-history__row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  border-bottom: 1px solid var(--border-color);
  padding: 0.4rem 0;
  font-size: 0.82rem;
  color: var(--text-color);
}

.gaming-reg-status {
  margin-left: auto;
  border-radius: 9999px;
  border: 1px solid var(--border-color);
  padding: 0.1rem 0.55rem;
  font-size: 0.7rem;
  color: var(--muted-color);
}

.gaming-reg-status--approved {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.gaming-reg-status--rejected {
  border-style: dashed;
}

/* Tokens du thème reposés sur le panneau téléporté (variables CSS du site). */
:global(.gaming-registrations-panel) {
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

:global(.gaming-registrations-panel-overlay) {
  background: color-mix(in srgb, var(--primary-color) 55%, transparent) !important;
  backdrop-filter: blur(8px);
}
</style>
