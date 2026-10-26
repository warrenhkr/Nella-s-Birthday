<script setup lang="ts">
// ============================================================
// /equipes/:id — fiche d'une équipe (côté MEMBRE).
//
// Affiche la photo, la présentation, le CAPITAINE et le roster complet,
// ainsi que les tournois visés (demandes d'inscription). Le capitaine peut
// modifier l'équipe (PATCH /api/teams/:id) et recruter
// (POST /api/teams/:id/members). Le reste du roster est en lecture seule.
//
// Garde : `middleware: 'auth'` (membre connecté), PAS 'admin'.
// ============================================================
definePageMeta({ middleware: 'auth' })

type TeamTournament = {
  id: string
  name: string
  game: string
  visibility: string
  status: string
  startDate?: string | null
}

type TeamRegistration = {
  id: string
  status: string
  message: string | null
  createdAt: string
  tournament: TeamTournament
}

type TeamMember = {
  id: string
  userId: string
  role: string
  joinedAt: string
  pseudo: string
  nom: string | null
  prenom: string | null
}

type TeamDetail = {
  id: string
  name: string
  seed: number | null
  logoUrl: string | null
  description: string | null
  isCaptain: boolean
  isAdmin: boolean
  matchCount: number
  tournament: TeamTournament | null
  members: TeamMember[]
  registrations: TeamRegistration[]
}

const route = useRoute()
const teamId = computed(() => String(route.params.id || ''))

const { success, alert } = useGameToast()
const { playSfx } = useSoundManager()

const { data: response, pending, error, refresh } = await useFetch<{ data: TeamDetail }>(
  () => `/api/teams/${encodeURIComponent(teamId.value)}`,
  { watch: [teamId] }
)

const team = computed<TeamDetail | null>(() => response.value?.data || null)
const notFound = computed(() => !pending.value && !error.value && !team.value)

const REGISTRATION_LABELS: Record<string, string> = {
  PENDING: 'En attente de validation',
  APPROVED: 'Acceptée',
  REJECTED: 'Refusée'
}

function memberLabel(member: TeamMember) {
  const fullName = [member.prenom, member.nom].filter(Boolean).join(' ')
  return fullName ? `${member.pseudo} (${fullName})` : member.pseudo
}

const captains = computed(() => (team.value?.members || []).filter(member => member.role === 'CAPTAIN'))
const players = computed(() => (team.value?.members || []).filter(member => member.role !== 'CAPTAIN'))

function getApiErrorMessage(errorValue: unknown, fallback: string) {
  if (typeof errorValue === 'object' && errorValue !== null && 'data' in errorValue) {
    const failure = errorValue.data
    if (typeof failure === 'object' && failure !== null && 'statusMessage' in failure && typeof failure.statusMessage === 'string') return failure.statusMessage
  }
  return fallback
}

// ---------- Édition (capitaine) ----------
const editOpen = ref(false)
const saving = ref(false)
const editForm = reactive({ name: '', description: '', logoUrl: null as string | null })

function openEdit() {
  if (!team.value) return
  Object.assign(editForm, {
    name: team.value.name,
    description: team.value.description || '',
    logoUrl: team.value.logoUrl
  })
  editOpen.value = true
  playSfx('popup')
}

const editNameError = computed(() => {
  const length = editForm.name.trim().length
  if (length === 0) return ''
  if (length < 2 || length > 60) return 'Le nom doit faire entre 2 et 60 caractères.'
  return ''
})

async function saveEdit() {
  if (!team.value) return
  if (editNameError.value || editForm.name.trim().length < 2) {
    playSfx('error')
    alert(editNameError.value || 'Donne un nom à ton équipe (2 caractères minimum).')
    return
  }
  saving.value = true
  try {
    const response = await fetch(`/api/teams/${encodeURIComponent(team.value.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        logoUrl: editForm.logoUrl || null
      })
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      const message = payload?.statusMessage || 'Impossible d’enregistrer ces modifications.'
      throw new Error(message)
    }

    playSfx('success')
    success('Équipe mise à jour.')
    editOpen.value = false
    await refresh()
  } catch (saveError: unknown) {
    playSfx('error')
    alert(getApiErrorMessage(saveError, 'Impossible d’enregistrer ces modifications.'))
  } finally {
    saving.value = false
  }
}

// ---------- Roster (capitaine) ----------
const memberOpen = ref(false)
const addingMember = ref(false)
const memberForm = reactive({ identifier: '', role: 'PLAYER' })

const memberRoleOptions = [
  { value: 'PLAYER', label: 'Joueur' },
  { value: 'CAPTAIN', label: 'Capitaine (co-capitaine)' }
]

function openMember() {
  Object.assign(memberForm, { identifier: '', role: 'PLAYER' })
  memberOpen.value = true
  playSfx('popup')
}

async function addMember() {
  if (!team.value) return
  const identifier = memberForm.identifier.trim()
  if (identifier.length < 2) {
    playSfx('error')
    alert('Indique le pseudo (ou l’email) du membre à ajouter.')
    return
  }
  addingMember.value = true
  try {
    await $fetch(`/api/teams/${encodeURIComponent(team.value.id)}/members`, {
      method: 'POST',
      body: { identifier, role: memberForm.role }
    })
    playSfx('success')
    success(`${identifier} rejoint le roster.`)
    memberOpen.value = false
    await refresh()
  } catch (memberError: unknown) {
    playSfx('error')
    alert(getApiErrorMessage(memberError, 'Impossible d’ajouter ce membre.'))
  } finally {
    addingMember.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-10 pb-32 sm:py-14 lg:px-8">
    <NuxtLink
      to="/equipes"
      class="equipe-back"
    >
      <UIcon
        name="i-lucide-arrow-left"
        class="h-4 w-4"
        aria-hidden="true"
      />
      Mes équipes
    </NuxtLink>

    <div
      v-if="pending"
      class="mt-6 space-y-5"
      aria-hidden="true"
    >
      <USkeleton class="h-40 rounded-2xl" />
      <USkeleton class="h-56 rounded-2xl" />
    </div>

    <div
      v-else-if="error"
      class="equipe-state surface-solid clip-corner mt-6"
    >
      <UIcon
        name="i-lucide-circle-question-mark"
        class="equipe-state__icon"
        aria-hidden="true"
      />
      <p class="equipe-state__title">
        Impossible de charger cette équipe
      </p>
      <p class="equipe-state__text">
        Tu n’as peut-être pas accès à cette équipe, ou le serveur n’a pas répondu.
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

    <div
      v-else-if="notFound"
      class="equipe-state surface-solid clip-corner mt-6"
    >
      <UIcon
        name="i-lucide-shield-off"
        class="equipe-state__icon"
        aria-hidden="true"
      />
      <p class="equipe-state__title">
        Équipe introuvable
      </p>
      <p class="equipe-state__text">
        Cette équipe n’existe pas ou tu n’en fais pas partie.
      </p>
      <UButton
        to="/equipes"
        class="mt-4"
        color="primary"
        variant="soft"
        icon="i-lucide-arrow-left"
        label="Retour à mes équipes"
      />
    </div>

    <template v-else-if="team">
      <header class="equipe-hero surface-solid clip-corner mt-5">
        <div class="equipe-hero__identity">
          <img
            v-if="team.logoUrl"
            :src="team.logoUrl"
            :alt="`Logo de ${team.name}`"
            class="equipe-hero__logo"
          >
          <span
            v-else
            class="equipe-hero__logo equipe-hero__logo--empty"
            aria-hidden="true"
          >
            <UIcon name="i-lucide-shield" />
          </span>
          <div class="min-w-0">
            <p class="text-xs uppercase tracking-[0.28em] text-accent-otaku">
              Équipe
            </p>
            <h1
              class="mt-2 font-display text-3xl font-black sm:text-4xl"
              style="color: var(--text-color);"
            >
              {{ team.name }}
            </h1>
            <p class="equipe-hero__meta">
              {{ team.members.length }} membre<span v-if="team.members.length > 1">s</span>
              <span v-if="team.seed"> · seed {{ team.seed }}</span>
              <span v-if="team.matchCount"> · {{ team.matchCount }} match<span v-if="team.matchCount > 1">s</span></span>
            </p>
          </div>
        </div>

        <div class="equipe-hero__actions">
          <UButton
            v-if="team.isCaptain"
            color="primary"
            icon="i-lucide-pencil"
            label="Modifier l’équipe"
            @click="openEdit"
          />
          <UButton
            v-if="team.isCaptain"
            color="neutral"
            variant="soft"
            icon="i-lucide-user-plus"
            label="Ajouter un membre"
            @click="openMember"
          />
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-refresh-cw"
            label="Actualiser"
            @click="refresh()"
          />
        </div>

        <RichTextContent
          v-if="team.description"
          class="equipe-hero__desc"
          :content="team.description"
          :label="`Présentation de l’équipe ${team.name}`"
        />
      </header>

      <div class="mt-6 grid gap-6 lg:grid-cols-3">
        <section class="equipe-block surface-solid clip-corner lg:col-span-2">
          <div class="equipe-block__head">
            <p class="equipe-block__title">
              <UIcon
                name="i-lucide-users"
                aria-hidden="true"
              />
              Roster
            </p>
            <p class="equipe-block__hint">
              Le capitaine commande l’équipe et peut inscrire le roster aux tournois.
            </p>
          </div>

          <ul class="equipe-roster">
            <li
              v-for="member in captains"
              :key="member.id"
              class="equipe-roster__row equipe-roster__row--captain"
            >
              <UIcon
                name="i-lucide-crown"
                class="equipe-roster__icon"
                aria-hidden="true"
              />
              <span class="equipe-roster__name">{{ memberLabel(member) }}</span>
              <span class="equipe-roster__role">Capitaine</span>
            </li>
            <li
              v-for="member in players"
              :key="member.id"
              class="equipe-roster__row"
            >
              <UIcon
                name="i-lucide-user-round"
                class="equipe-roster__icon"
                aria-hidden="true"
              />
              <span class="equipe-roster__name">{{ memberLabel(member) }}</span>
              <span class="equipe-roster__role">Joueur</span>
            </li>
          </ul>
        </section>

        <section class="equipe-block surface-solid clip-corner">
          <div class="equipe-block__head">
            <p class="equipe-block__title">
              <UIcon
                name="i-lucide-trophy"
                aria-hidden="true"
              />
              Tournois
            </p>
          </div>

          <p
            v-if="team.tournament"
            class="equipe-tournament"
          >
            <span class="equipe-tournament__label">Équipe engagée</span>
            <NuxtLink
              :to="`/tournois/${team.tournament.id}`"
              class="equipe-tournament__name"
            >
              {{ team.tournament.name }}
            </NuxtLink>
            <span class="equipe-tournament__game">{{ team.tournament.game }}</span>
          </p>

          <p
            v-if="!team.registrations.length"
            class="equipe-block__empty"
          >
            Aucune demande d’inscription pour l’instant.
            <NuxtLink
              to="/tournois"
              class="equipe-inline-link"
            >
              Voir les tournois ouverts
            </NuxtLink>
          </p>

          <ul
            v-else
            class="equipe-registrations"
          >
            <li
              v-for="registration in team.registrations"
              :key="registration.id"
              class="equipe-registrations__row"
            >
              <NuxtLink
                :to="`/tournois/${registration.tournament.id}`"
                class="equipe-tournament__name"
              >
                {{ registration.tournament.name }}
              </NuxtLink>
              <span
                class="equipe-badge"
                :class="`equipe-badge--${registration.status.toLowerCase()}`"
              >
                {{ REGISTRATION_LABELS[registration.status] || registration.status }}
              </span>
            </li>
          </ul>
        </section>
      </div>
    </template>

    <USlideover
      v-model:open="editOpen"
      title="Modifier l’équipe"
      description="Nom, présentation et photo d’équipe."
      :ui="{ content: 'equipe-panel', overlay: 'equipe-panel-overlay' }"
    >
      <template #body>
        <form
          id="equipe-edit-form"
          class="space-y-5"
          @submit.prevent="saveEdit"
        >
          <UFormField
            label="Nom de l’équipe"
            required
            :error="editNameError || undefined"
          >
            <UInput
              v-model="editForm.name"
              autocomplete="off"
            />
          </UFormField>

          <UFormField label="Présentation">
            <ClientOnly>
              <RichTextEditor
                v-model="editForm.description"
                :max-characters="1000"
                :min-height="120"
                aria-label="Présentation de l’équipe"
              />
              <template #fallback>
                <UTextarea
                  v-model="editForm.description"
                  :rows="4"
                  aria-label="Présentation de l’équipe"
                />
              </template>
            </ClientOnly>
          </UFormField>

          <UFormField
            label="Photo d’équipe"
            hint="JPG, PNG ou WebP — 5 Mo maximum."
          >
            <ImageUpload
              v-model="editForm.logoUrl"
              label="Photo d’équipe"
              description="JPG, PNG ou WebP, 5 Mo maximum"
            />
          </UFormField>
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
            form="equipe-edit-form"
            color="primary"
            icon="i-lucide-save"
            :loading="saving"
            label="Enregistrer"
          />
        </div>
      </template>
    </USlideover>

    <USlideover
      v-model:open="memberOpen"
      title="Ajouter un membre"
      description="Le membre est ajouté par son pseudo ou son email exact."
      :ui="{ content: 'equipe-panel', overlay: 'equipe-panel-overlay' }"
    >
      <template #body>
        <form
          id="equipe-member-form"
          class="space-y-5"
          @submit.prevent="addMember"
        >
          <UFormField
            label="Pseudo ou email du membre"
            required
            hint="Le compte doit déjà exister sur le site."
          >
            <UInput
              v-model="memberForm.identifier"
              placeholder="otaku_du_229 ou pseudo@exemple.com"
              autocomplete="off"
            />
          </UFormField>

          <UFormField label="Rôle">
            <AppSelect
              v-model="memberForm.role"
              :options="memberRoleOptions"
              icon="i-lucide-shield"
              aria-label="Rôle du membre ajouté"
            />
          </UFormField>
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
            form="equipe-member-form"
            color="primary"
            icon="i-lucide-user-plus"
            :loading="addingMember"
            label="Ajouter au roster"
          />
        </div>
      </template>
    </USlideover>
  </div>
</template>

<style scoped>
.equipe-back {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--muted-color);
  text-decoration: none;
}

.equipe-back:hover {
  color: var(--primary-color);
}

.equipe-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  border-style: dashed;
  border-color: rgba(var(--primary-color-rgb), 0.3);
  padding: 2.5rem 1.25rem;
  text-align: center;
}

.equipe-state__icon {
  height: 2.25rem;
  width: 2.25rem;
  color: var(--accent-color);
}

.equipe-state__title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-color);
}

.equipe-state__text {
  max-width: 40rem;
  font-size: 0.875rem;
  color: var(--muted-color);
}

.equipe-hero {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid rgba(var(--primary-color-rgb), 0.22);
  padding: 1.25rem;
}

.equipe-hero__identity {
  display: flex;
  align-items: center;
  gap: 1rem;
  min-width: 0;
}

.equipe-hero__logo {
  height: 4.5rem;
  width: 4.5rem;
  flex: none;
  border-radius: 1rem;
  object-fit: cover;
  border: 1px solid var(--border-color);
}

.equipe-hero__logo--empty {
  display: grid;
  place-items: center;
  background: rgba(var(--primary-color-rgb), 0.08);
  color: var(--accent-color);
}

.equipe-hero__logo--empty svg {
  height: 2rem;
  width: 2rem;
}

.equipe-hero__meta {
  margin-top: 0.4rem;
  font-size: 0.8rem;
  color: var(--muted-color);
}

.equipe-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.equipe-hero__desc {
  flex: 1 1 100%;
  border-top: 1px solid var(--border-color);
  padding-top: 0.8rem;
  font-size: 0.88rem;
  white-space: pre-line;
  color: var(--text-color);
}

.equipe-block {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  border: 1px solid rgba(var(--primary-color-rgb), 0.18);
  padding: 1.1rem;
}

.equipe-block__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.equipe-block__title {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent-color);
}

.equipe-block__title svg {
  height: 0.95rem;
  width: 0.95rem;
}

.equipe-block__hint,
.equipe-block__empty {
  font-size: 0.78rem;
  color: var(--muted-color);
}

.equipe-inline-link {
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 600;
}

.equipe-roster {
  display: grid;
  gap: 0.4rem;
}

.equipe-roster__row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  border: 1px solid var(--border-color);
  padding: 0.5rem 0.7rem;
  font-size: 0.85rem;
  color: var(--text-color);
}

.equipe-roster__row--captain {
  border-color: var(--primary-color);
  background: rgba(var(--primary-color-rgb), 0.1);
}

.equipe-roster__icon {
  height: 1rem;
  width: 1rem;
  flex: none;
  color: var(--primary-color);
}

.equipe-roster__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.equipe-roster__role {
  margin-left: auto;
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted-color);
}

.equipe-tournament {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  border: 1px solid var(--border-color);
  padding: 0.7rem;
}

.equipe-tournament__label {
  font-size: 0.68rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted-color);
}

.equipe-tournament__name {
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--primary-color);
  text-decoration: none;
}

.equipe-tournament__game {
  font-size: 0.75rem;
  color: var(--muted-color);
}

.equipe-registrations {
  display: grid;
  gap: 0.5rem;
}

.equipe-registrations__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.4rem;
}

.equipe-badge {
  margin-left: auto;
  border-radius: 9999px;
  border: 1px dashed var(--border-color);
  padding: 0.12rem 0.55rem;
  font-size: 0.7rem;
  color: var(--muted-color);
}

.equipe-badge--pending {
  border-style: solid;
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.equipe-badge--approved {
  border-style: solid;
  border-color: var(--primary-color);
  background: rgba(var(--primary-color-rgb), 0.16);
  color: var(--text-color);
}

/* Tokens du thème reposés sur le panneau téléporté (variables du site uniquement). */
:global(.equipe-panel) {
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

:global(.equipe-panel-overlay) {
  background: color-mix(in srgb, var(--primary-color) 55%, transparent) !important;
  backdrop-filter: blur(8px);
}
</style>
