<script setup lang="ts">
// ============================================================
// /equipes — « Mes équipes » (côté MEMBRE).
//
// Lot 3 gaming : un membre crée son équipe (nom, photo, description),
// devient son CAPTAIN, puis l'inscrit aux tournois ouverts.
//
// Garde : `middleware: 'auth'` (membre connecté), PAS 'admin'.
// L'API ne renvoie QUE les équipes dont l'appelant fait partie.
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

type Team = {
  id: string
  name: string
  seed: number | null
  logoUrl: string | null
  description: string | null
  isCaptain: boolean
  memberCount: number
  tournament: TeamTournament | null
  members: TeamMember[]
  registrations: TeamRegistration[]
}

const { success, alert } = useGameToast()
const { playSfx } = useSoundManager()

const { data: response, pending, error, refresh } = await useFetch<{ data: Team[] }>('/api/teams')
const teams = computed<Team[]>(() => response.value?.data || [])

const createOpen = ref(false)
const submitting = ref(false)
const form = reactive({
  name: '',
  description: '',
  logoUrl: null as string | null
})

const REGISTRATION_LABELS: Record<string, string> = {
  PENDING: 'Inscription en attente',
  APPROVED: 'Inscription acceptée',
  REJECTED: 'Inscription refusée'
}

function registrationFor(team: Team) {
  return team.registrations[0] || null
}

function memberLabel(member: TeamMember) {
  const fullName = [member.prenom, member.nom].filter(Boolean).join(' ')
  return fullName ? `${member.pseudo} (${fullName})` : member.pseudo
}

function getApiErrorMessage(errorValue: unknown, fallback: string) {
  if (typeof errorValue === 'object' && errorValue !== null && 'data' in errorValue) {
    const data = errorValue.data
    if (typeof data === 'object' && data !== null && 'statusMessage' in data && typeof data.statusMessage === 'string') return data.statusMessage
  }
  return fallback
}

function openCreate() {
  Object.assign(form, { name: '', description: '', logoUrl: null })
  createOpen.value = true
  playSfx('popup')
}

const nameError = computed(() => {
  const length = form.name.trim().length
  if (length === 0) return ''
  if (length < 2 || length > 60) return 'Le nom doit faire entre 2 et 60 caractères.'
  return ''
})

async function submit() {
  if (nameError.value || form.name.trim().length < 2) {
    playSfx('error')
    alert(nameError.value || 'Donne un nom à ton équipe (2 caractères minimum).')
    return
  }

  submitting.value = true
  try {
    await $fetch('/api/teams', {
      method: 'POST',
      body: {
        name: form.name.trim(),
        description: form.description.trim() || null,
        logoUrl: form.logoUrl || null
      }
    })
    playSfx('success')
    success(`Équipe « ${form.name.trim()} » créée : tu en es le capitaine.`)
    createOpen.value = false
    await refresh()
  } catch (creationError: unknown) {
    playSfx('error')
    alert(getApiErrorMessage(creationError, 'Impossible de créer cette équipe.'))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-10 pb-32 sm:py-14 lg:px-8">
    <header class="mb-8">
      <p class="text-xs uppercase tracking-[0.28em] text-accent-otaku">
        Gaming
      </p>
      <h1
        class="mt-3 font-display text-4xl font-black"
        style="color: var(--text-color);"
      >
        Mes équipes
      </h1>
      <p class="mt-3 max-w-3xl text-sm text-muted">
        Crée ton équipe, invite tes coéquipiers et inscris-la aux tournois du club
        dont les inscriptions sont ouvertes. Tu deviens capitaine de l’équipe que tu crées.
      </p>
      <div class="mt-5 flex flex-wrap gap-2">
        <UButton
          color="primary"
          icon="i-lucide-plus"
          label="Créer une équipe"
          @click="openCreate"
        />
        <NuxtLink
          to="/tournois"
          class="equipe-link"
        >
          <UIcon
            name="i-lucide-trophy"
            aria-hidden="true"
          />
          Voir les tournois
        </NuxtLink>
      </div>
    </header>

    <div
      v-if="error"
      class="equipe-state surface-solid clip-corner"
      role="alert"
    >
      <UIcon
        name="i-lucide-circle-question-mark"
        class="equipe-state__icon"
        aria-hidden="true"
      />
      <p class="equipe-state__title">
        Impossible de charger tes équipes
      </p>
      <p class="equipe-state__text">
        Réessaie dans un instant, ou reconnecte-toi si ta session a expiré.
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
      v-else-if="pending"
      class="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
      aria-hidden="true"
    >
      <USkeleton
        v-for="index in 3"
        :key="index"
        class="h-52 rounded-2xl"
      />
    </div>

    <div
      v-else-if="!teams.length"
      class="equipe-state surface-solid clip-corner"
    >
      <UIcon
        name="i-lucide-shield"
        class="equipe-state__icon"
        aria-hidden="true"
      />
      <p class="equipe-state__title">
        Aucune équipe pour l’instant
      </p>
      <p class="equipe-state__text">
        Une équipe, c’est un nom, une photo et un roster. Crée la tienne :
        tu pourras ensuite l’inscrire en un clic aux tournois ouverts.
      </p>
      <UButton
        class="mt-5"
        color="primary"
        icon="i-lucide-plus"
        label="Créer mon équipe"
        @click="openCreate"
      />
    </div>

    <div
      v-else
      class="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
    >
      <NuxtLink
        v-for="team in teams"
        :key="team.id"
        :to="`/equipes/${team.id}`"
        class="equipe-card surface-solid clip-corner"
      >
        <div class="equipe-card__head">
          <img
            v-if="team.logoUrl"
            :src="team.logoUrl"
            :alt="`Logo de ${team.name}`"
            class="equipe-card__logo"
          >
          <span
            v-else
            class="equipe-card__logo equipe-card__logo--empty"
            aria-hidden="true"
          >
            <UIcon name="i-lucide-shield" />
          </span>
          <div class="min-w-0">
            <p class="equipe-card__name">
              {{ team.name }}
            </p>
            <p class="equipe-card__meta">
              {{ team.memberCount }} joueur<span v-if="team.memberCount > 1">s</span>
              <span v-if="team.isCaptain"> · tu es capitaine</span>
            </p>
          </div>
        </div>

        <RichTextContent
          v-if="team.description"
          class="equipe-card__desc"
          :content="team.description"
          :label="`Présentation de l’équipe ${team.name}`"
        />

        <ul class="equipe-card__roster">
          <li
            v-for="member in team.members.slice(0, 4)"
            :key="member.id"
          >
            <UIcon
              :name="member.role === 'CAPTAIN' ? 'i-lucide-crown' : 'i-lucide-user-round'"
              aria-hidden="true"
            />
            {{ memberLabel(member) }}
          </li>
          <li
            v-if="team.members.length > 4"
            class="equipe-card__more"
          >
            + {{ team.members.length - 4 }} autre<span v-if="team.members.length - 4 > 1">s</span>
          </li>
        </ul>

        <div class="equipe-card__foot">
          <span
            v-if="registrationFor(team)"
            class="equipe-badge"
            :class="`equipe-badge--${(registrationFor(team)?.status || '').toLowerCase()}`"
          >
            {{ REGISTRATION_LABELS[registrationFor(team)?.status || ''] || 'Inscription' }}
          </span>
          <span
            v-else
            class="equipe-badge"
          >
            Aucune inscription en cours
          </span>

          <span class="equipe-card__cta">
            Gérer
            <UIcon
              name="i-lucide-chevron-right"
              aria-hidden="true"
            />
          </span>
        </div>
      </NuxtLink>
    </div>

    <USlideover
      v-model:open="createOpen"
      title="Nouvelle équipe"
      description="Nom, photo et présentation. Tu en deviendras le capitaine."
      :ui="{ content: 'equipe-panel', overlay: 'equipe-panel-overlay' }"
    >
      <template #body>
        <form
          id="equipe-create-form"
          class="space-y-5"
          @submit.prevent="submit"
        >
          <UFormField
            label="Nom de l’équipe"
            required
            :error="nameError || undefined"
          >
            <UInput
              v-model="form.name"
              placeholder="Les Otakus"
              autocomplete="off"
            />
          </UFormField>

          <UFormField label="Présentation">
            <ClientOnly>
              <RichTextEditor
                v-model="form.description"
                :max-characters="1000"
                :min-height="120"
                aria-label="Présentation de l’équipe"
                placeholder="Jeu principal, niveau, ambiance…"
              />
              <template #fallback>
                <UTextarea
                  v-model="form.description"
                  :rows="4"
                  aria-label="Présentation de l’équipe"
                  placeholder="Jeu principal, niveau, ambiance…"
                />
              </template>
            </ClientOnly>
          </UFormField>

          <UFormField
            label="Photo d’équipe"
            hint="JPG, PNG ou WebP — 5 Mo maximum."
          >
            <ImageUpload
              v-model="form.logoUrl"
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
            form="equipe-create-form"
            color="primary"
            icon="i-lucide-plus"
            :loading="submitting"
            label="Créer l’équipe"
          />
        </div>
      </template>
    </USlideover>
  </div>
</template>

<style scoped>
.equipe-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border-radius: 9999px;
  border: 1px solid var(--border-color);
  padding: 0.45rem 0.9rem;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--text-color);
  text-decoration: none;
  transition: border-color 0.18s ease, transform 0.15s ease;
}

.equipe-link:hover {
  border-color: var(--primary-color);
  transform: translateY(-1px);
}

.equipe-link svg {
  height: 1rem;
  width: 1rem;
  color: var(--accent-color);
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
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-color);
}

.equipe-state__text {
  max-width: 40rem;
  font-size: 0.875rem;
  color: var(--muted-color);
}

.equipe-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.7rem;
  padding: 1.15rem;
  border: 1px solid rgba(var(--primary-color-rgb), 0.18);
  background: linear-gradient(180deg, rgba(var(--primary-color-rgb), 0.04), var(--panel-color-solid));
  color: var(--text-color);
  text-decoration: none;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.2s ease;
}

.equipe-card:hover,
.equipe-card:focus-visible {
  outline: none;
  transform: translateY(-3px);
  border-color: var(--primary-color);
  box-shadow: 0 18px 34px -26px rgba(var(--primary-color-rgb), 0.95);
}

.equipe-card__head {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.equipe-card__logo {
  height: 3rem;
  width: 3rem;
  flex: none;
  border-radius: 0.7rem;
  object-fit: cover;
  border: 1px solid var(--border-color);
}

.equipe-card__logo--empty {
  display: grid;
  place-items: center;
  background: rgba(var(--primary-color-rgb), 0.08);
  color: var(--accent-color);
}

.equipe-card__logo--empty svg {
  height: 1.4rem;
  width: 1.4rem;
}

.equipe-card__name {
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--text-color);
}

.equipe-card__meta {
  margin-top: 0.1rem;
  font-size: 0.75rem;
  color: var(--muted-color);
}

.equipe-card__desc {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  font-size: 0.82rem;
  color: var(--muted-color);
}

.equipe-card__roster {
  display: grid;
  gap: 0.2rem;
  font-size: 0.8rem;
  color: var(--text-color);
}

.equipe-card__roster li {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.equipe-card__roster svg {
  height: 0.85rem;
  width: 0.85rem;
  flex: none;
  color: var(--primary-color);
}

.equipe-card__more {
  color: var(--muted-color);
  font-size: 0.75rem;
}

.equipe-card__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: auto;
  border-top: 1px solid var(--border-color);
  padding-top: 0.7rem;
}

.equipe-badge {
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

.equipe-card__cta {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin-left: auto;
  font-size: 0.74rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--primary-color);
}

.equipe-card__cta svg {
  height: 0.95rem;
  width: 0.95rem;
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
