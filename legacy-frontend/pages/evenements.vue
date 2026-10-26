<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { success, info, alert } = useGameToast()
const { playSfx } = useSoundManager()

const selectedFilter = ref('Tous')
const selectedPeriod = ref<'upcoming' | 'past'>('upcoming')

type ClubEvent = {
  id: string
  title: string
  description: string | null
  date: string
  place: string
  status: string
  pole: string
  type: string
  imageUrl: string | null
  attendeeCount: number
  endDate: string | null
  capacity: number | null
  price: number
  isFree: boolean
  paymentInstructions: string | null
  statusCode: string
  registered?: boolean
  galleryMedia?: GalleryMedia[]
}
type GalleryMedia = {
  id: string
  title: string | null
  url: string
  sourceUrl: string | null
  mediaType: 'IMAGE' | 'YOUTUBE_VIDEO' | 'VIDEO'
  youtubeId: string | null
  eventDate: string | null
}

const { data: eventsResponse, pending, error, refresh } = await useFetch<{ data: ClubEvent[] }>('/api/events')
const events = ref<ClubEvent[]>([])
const contactPhones = reactive<Record<string, string>>({})
const paymentMessages = reactive<Record<string, string>>({})
const selectedEvent = ref<ClubEvent | null>(null)
const eventModalOpen = ref(false)
const eventDetailPending = ref(false)
const currentPage = ref(1)
const eventsPerPage = 6
const imagePreviewUrl = ref<string | null>(null)
const imagePreviewOpen = ref(false)
watch(eventsResponse, (response) => {
  events.value = response?.data || []
}, { immediate: true })

const filters = ['Tous', 'Anime', 'Manga', 'Gaming', 'Danse', 'K-Drama', 'Culture']

const filteredEvents = computed(() =>
  events.value
    .filter(event => selectedPeriod.value === 'past' ? ['completed', 'cancelled', 'postponed'].includes(event.statusCode) : ['upcoming', 'ongoing', 'full'].includes(event.statusCode))
    .filter(event => selectedFilter.value === 'Tous' ? true : (event.type || event.pole).split(',').map(type => type.trim().toLowerCase()).includes(selectedFilter.value.toLowerCase()))
)
const totalPages = computed(() => Math.max(1, Math.ceil(filteredEvents.value.length / eventsPerPage)))
const paginatedEvents = computed(() => filteredEvents.value.slice((currentPage.value - 1) * eventsPerPage, currentPage.value * eventsPerPage))

watch([selectedFilter, selectedPeriod], () => { currentPage.value = 1 })
watch(filteredEvents, () => { if (currentPage.value > totalPages.value) currentPage.value = totalPages.value })

function formatEventDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value))
}

async function toggleParticipation(eventId: string) {
  const event = events.value.find(item => item.id === eventId)
  if (!event) return

  const nowRegistered = !event.registered

  try {
    const response = await $fetch<{ data?: { paymentInstructions?: string | null } }>(`/api/events/${event.id}/attend`, {
      method: 'POST',
      body: {
        action: nowRegistered ? 'register' : 'cancel',
        contactPhone: contactPhones[event.id] || undefined
      }
    })
    event.registered = nowRegistered
    event.attendeeCount += nowRegistered ? 1 : -1
    playSfx(nowRegistered ? 'success' : 'click')

    if (nowRegistered) success(`Inscription confirmée : ${event.title}`)
    else info(`Inscription annulée : ${event.title}`)
    if (nowRegistered && response.data?.paymentInstructions) paymentMessages[event.id] = response.data.paymentInstructions
  } catch (error: unknown) {
    alert(getApiErrorMessage(error, 'Connecte-toi pour participer à un événement.'))
  }
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = error.data
    if (typeof data === 'object' && data !== null && 'statusMessage' in data && typeof data.statusMessage === 'string') {
      return data.statusMessage
    }
  }

  return fallback
}

function selectFilter(filter: string) {
  selectedFilter.value = filter
  playSfx('click')
}

async function retryEvents() {
  await refresh()
}

async function openEventDetails(event: ClubEvent) {
  selectedEvent.value = event
  eventModalOpen.value = true
  eventDetailPending.value = true
  try {
    const response = await $fetch<{ data: ClubEvent }>(`/api/events/${event.id}`)
    selectedEvent.value = response.data
  } catch (error: unknown) {
    alert(getApiErrorMessage(error, 'Impossible de charger les détails de cet événement.'))
  } finally {
    eventDetailPending.value = false
  }
}

function handleEventKeydown(event: KeyboardEvent, clubEvent: ClubEvent) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    openEventDetails(clubEvent)
  }
}

function openImagePreview(url: string) {
  imagePreviewUrl.value = url
  imagePreviewOpen.value = true
}
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-10 sm:py-16 lg:px-8">
    <div class="mb-10">
      <p class="text-xs uppercase tracking-[0.28em] text-brand">
        Événements
      </p>
      <h1
        class="mt-3 font-display text-4xl font-black"
        style="color: var(--text-color);"
      >
        Agenda du club
      </h1>
    </div>

    <div class="mb-6 flex flex-wrap gap-2">
      <button
        type="button"
        class="pole-filter"
        :class="{ 'pole-filter--active': selectedPeriod === 'upcoming' }"
        @click="selectedPeriod = 'upcoming'"
      >
        Prochains événements
      </button>
      <button
        type="button"
        class="pole-filter"
        :class="{ 'pole-filter--active': selectedPeriod === 'past' }"
        @click="selectedPeriod = 'past'"
      >
        Événements passés
      </button>
    </div>

    <div class="mb-6 flex flex-wrap gap-2">
      <button
        v-for="filter in filters"
        :key="filter"
        type="button"
        class="pole-filter"
        :class="{ 'pole-filter--active': selectedFilter === filter }"
        @click="selectFilter(filter)"
      >
        {{ filter }}
      </button>
    </div>

    <div
      v-if="pending"
      class="space-y-5"
    >
      <USkeleton
        v-for="index in 4"
        :key="index"
        class="h-32"
      />
    </div>

    <div
      v-else-if="error"
      class="event-card surface-solid text-center"
    >
      <p class="text-sm text-muted">
        Les événements sont temporairement indisponibles.
      </p>
      <UButton
        class="mt-4"
        color="primary"
        variant="soft"
        label="Réessayer"
        @click="retryEvents"
      />
    </div>

    <div
      v-else-if="filteredEvents.length === 0"
      class="event-card surface-solid text-center text-muted"
    >
      Aucun événement ne correspond à ce filtre.
    </div>

    <div
      v-else
      class="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
    >
      <div
        v-for="event in paginatedEvents"
        :key="event.id"
        class="event-card surface-solid clip-corner flex h-full flex-col"
        role="button"
        tabindex="0"
        @click="openEventDetails(event)"
        @keydown="handleEventKeydown($event, event)"
      >
        <div class="event-card__image-frame">
          <img
            v-if="event.imageUrl"
            :src="event.imageUrl"
            :alt="event.title"
            class="event-card__image"
            loading="lazy"
          >
          <span v-else class="event-card__image-empty">Aucune image</span>
        </div>
        <div class="flex flex-1 flex-col gap-4">
          <div>
            <div
              class="text-2xl font-semibold"
              style="color: var(--text-color);"
            >
              {{ event.title }}
            </div>
            <div class="mt-2 text-muted">
              {{ formatEventDate(event.date) }} • {{ event.place }}
            </div>
            <div class="mt-2 text-xs uppercase tracking-[0.2em] text-accent-otaku">
              {{ event.type || event.pole }}
            </div>
            <RichTextContent
              v-if="event.description"
              :content="event.description"
              as="div"
              :label="`Description : ${event.title}`"
              class="mt-3 text-sm text-muted"
            />
            <div class="mt-2 text-xs text-muted">
              {{ event.attendeeCount }} participant(s)<span v-if="event.capacity"> / {{ event.capacity }}</span>
              · {{ event.isFree ? 'Gratuit' : `${event.price} FCFA` }}
            </div>
            <p
              v-if="event.endDate"
              class="mt-1 text-xs text-muted"
            >
              Fin : {{ formatEventDate(event.endDate) }}
            </p>
            <div
              v-if="!event.isFree && !event.registered"
              class="mt-3 max-w-sm"
            >
              <UInput
                v-model="contactPhones[event.id]"
                class="event-contact-input"
                placeholder="Téléphone pour le paiement"
                type="tel"
                @click.stop
              />
            </div>
            <div
              v-if="paymentMessages[event.id] || (event.registered && event.paymentInstructions)"
              class="mt-3 rounded-lg border border-brand/30 bg-brand/5 p-3 text-sm"
            >
              <strong class="text-brand">Paiement</strong>
              <p class="mt-1 whitespace-pre-line text-muted">
                {{ paymentMessages[event.id] || event.paymentInstructions }}
              </p>
            </div>
          </div>

          <div class="mt-auto flex flex-wrap items-center gap-3 pt-4">
            <UBadge
              class="event-status-badge"
              color="primary"
              variant="soft"
            >
              {{ event.status }}
            </UBadge>
            <UButton
              v-if="event.statusCode === 'completed' || event.statusCode === 'cancelled' || event.statusCode === 'postponed'"
              class="event-secondary-button"
              color="neutral"
              variant="soft"
              label="Voir les médias"
              @click.stop="openEventDetails(event)"
            />
            <UButton
              class="event-primary-button"
              color="primary"
              variant="solid"
              :label="event.registered ? 'Se désinscrire' : event.statusCode === 'full' ? 'Complet' : 'Je participe'"
              :disabled="event.statusCode === 'full' || event.statusCode === 'completed' || event.statusCode === 'cancelled'"
              @click.stop="toggleParticipation(event.id)"
            />
          </div>
        </div>
      </div>
    </div>
    <AppPagination
      :current-page="currentPage"
      :total-pages="totalPages"
      :item-count="filteredEvents.length"
      item-label="événement"
      @page-change="(page) => (currentPage = page)"
    />
  </div>
  <UModal
    v-model:open="eventModalOpen"
    :title="selectedEvent?.title || 'Détails de l’événement'"
    :ui="{ content: 'event-modal max-w-5xl', overlay: 'event-modal-overlay' }"
  >
    <template #body>
      <div v-if="selectedEvent" class="event-modal-body space-y-5">
        <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <UBadge class="event-status-badge" color="primary" variant="soft">{{ selectedEvent.status }}</UBadge>
              <span class="text-xs uppercase tracking-[0.16em] text-accent-otaku">{{ selectedEvent.type || selectedEvent.pole }}</span>
            </div>
            <p class="mt-3 text-sm text-muted">{{ formatEventDate(selectedEvent.date) }} · {{ selectedEvent.place }}</p>
            <p v-if="selectedEvent.endDate" class="mt-1 text-sm text-muted">Fin : {{ formatEventDate(selectedEvent.endDate) }}</p>
            <RichTextContent
              v-if="selectedEvent.description"
              :content="selectedEvent.description"
              :label="`Description : ${selectedEvent.title}`"
              class="mt-4 text-sm text-muted"
            />
          </div>
          <img v-if="selectedEvent.imageUrl" :src="selectedEvent.imageUrl" :alt="selectedEvent.title" class="h-40 w-full rounded-lg object-cover">
        </div>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div class="event-stat-card"><p class="text-xs text-muted">Participants</p><p class="mt-1 text-lg font-bold">{{ selectedEvent.attendeeCount }}<span v-if="selectedEvent.capacity" class="text-sm font-normal text-muted"> / {{ selectedEvent.capacity }}</span></p></div>
          <div class="event-stat-card"><p class="text-xs text-muted">Tarif</p><p class="mt-1 text-sm font-semibold">{{ selectedEvent.isFree ? 'Gratuit' : `${selectedEvent.price} FCFA` }}</p></div>
          <div class="event-stat-card sm:col-span-2"><p class="text-xs text-muted">Types</p><p class="mt-1 text-sm font-semibold">{{ selectedEvent.type || selectedEvent.pole }}</p></div>
        </div>
        <div v-if="eventDetailPending" class="grid gap-4 sm:grid-cols-2"><USkeleton v-for="index in 2" :key="index" class="h-48" /></div>
        <div v-else-if="selectedEvent.galleryMedia?.length" class="grid gap-4 sm:grid-cols-2">
          <article v-for="media in selectedEvent.galleryMedia" :key="media.id" class="event-media-card">
            <YoutubeEmbed v-if="media.mediaType === 'YOUTUBE_VIDEO' && media.youtubeId" :video-id="media.youtubeId" :title="media.title || selectedEvent.title" />
            <VideoEmbed v-else-if="media.mediaType === 'VIDEO'" :url="media.url" :source-url="media.sourceUrl || undefined" :title="media.title || selectedEvent.title" />
            <button v-else type="button" class="event-media-image-button" @click="openImagePreview(media.url)">
              <img :src="media.url" :alt="media.title || selectedEvent.title" class="h-56 w-full object-cover" loading="lazy">
            </button>
            <p class="p-3 text-sm font-medium" style="color: var(--text-color);">{{ media.title || 'Média de l’événement' }}</p>
          </article>
        </div>
        <p v-else-if="!eventDetailPending" class="event-empty-state">Aucun média publié pour cet événement.</p>
        <div class="flex flex-wrap justify-end gap-2">
          <UButton class="event-secondary-button" color="neutral" variant="soft" label="Voir dans la galerie" @click="navigateTo({ path: '/galerie', query: { eventId: selectedEvent.id } })" />
          <UButton v-if="selectedEvent.statusCode !== 'completed' && selectedEvent.statusCode !== 'cancelled' && selectedEvent.statusCode !== 'full'" class="event-primary-button" color="primary" :label="selectedEvent.registered ? 'Se désinscrire' : 'Je participe'" @click="toggleParticipation(selectedEvent.id)" />
        </div>
      </div>
    </template>
  </UModal>
  <UModal v-model:open="imagePreviewOpen" :title="selectedEvent?.title || 'Image de l’événement'" :ui="{ content: 'event-image-modal max-w-6xl' }">
    <template #body>
      <img v-if="imagePreviewUrl" :src="imagePreviewUrl" :alt="selectedEvent?.title || 'Image de l’événement'" class="event-image-preview">
    </template>
  </UModal>
</template>

<style scoped>
.pole-filter {
  border-radius: 9999px;
  padding: 0.4rem 0.9rem;
  min-height: 2.4rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-color);
  background: transparent;
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, transform 0.15s ease;
}

.pole-filter:hover {
  border-color: rgba(var(--primary-color-rgb), 0.5);
  transform: translateY(-1px);
}

/* Fond primaire translucide + texte du thème : lisible dans les 4 combinaisons.
   Avant : color:var(--bg-color) sur fond rouge = texte quasi noir sur rouge en
   thème dark (--bg-color y vaut #05050a / #16080c). */
.pole-filter--active {
  color: var(--text-color);
  background: rgba(var(--primary-color-rgb), 0.18);
  border-color: var(--primary-color);
  font-weight: 600;
}

.event-card {
  min-width: 0;
  padding: 1.5rem;
  cursor: pointer;
  border: 1px solid rgba(var(--primary-color-rgb), 0.18);
  background: linear-gradient(180deg, rgba(var(--primary-color-rgb), 0.03), rgba(var(--accent-color-rgb), 0.02), var(--panel-color-solid));
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.event-card__image-frame {
  display: grid;
  height: 12rem;
  overflow: hidden;
  place-items: center;
  border-radius: 0.75rem;
  background: linear-gradient(135deg, rgba(var(--primary-color-rgb), 0.12), rgba(var(--accent-color-rgb), 0.1));
}

.event-card__image {
  height: 100%;
  width: 100%;
  object-fit: cover;
}

.event-card__image-empty {
  color: var(--muted-color);
  font-size: 0.8rem;
}

.event-pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem 1rem;
  margin-top: 1.5rem;
  color: var(--muted-color);
}

.event-stat-card,
.event-media-card,
.event-empty-state {
  border: 1px solid rgba(var(--primary-color-rgb), 0.18);
  background: rgba(var(--primary-color-rgb), 0.03);
  border-radius: 0.75rem;
}

.event-stat-card {
  padding: 0.75rem 0.875rem;
}

.event-media-card {
  overflow: hidden;
  background: linear-gradient(180deg, rgba(var(--primary-color-rgb), 0.04), rgba(var(--accent-color-rgb), 0.02), var(--panel-color-solid));
}

.event-empty-state {
  border-style: dashed;
  padding: 1.25rem;
  text-align: center;
  font-size: 0.875rem;
  color: var(--muted-color);
}

.event-media-image-button {
  display: block;
  width: 100%;
  cursor: zoom-in;
  border: 0;
  padding: 0;
  background: transparent;
}

.event-image-preview {
  display: block;
  max-height: 75vh;
  width: 100%;
  object-fit: contain;
  border-radius: 0.75rem;
}

.event-card:hover,
.event-card:focus-visible {
  border-color: var(--primary-color);
  background: linear-gradient(180deg, rgba(var(--primary-color-rgb), 0.06), var(--panel-color-solid));
  box-shadow: 0 14px 34px -18px rgba(var(--primary-color-rgb), 0.72);
  outline: none;
  transform: translateY(-4px);
}

.event-card:focus-visible {
  box-shadow: 0 0 0 3px rgba(var(--primary-color-rgb), 0.24), 0 14px 34px -18px rgba(var(--primary-color-rgb), 0.72);
}

/* Tokens réellement lus par Nuxt UI v4. Les anciens --ui-primary / --ui-secondary
   n'existent pas en v4 : ils étaient inertes, et c'est ce qui laissait
   color="secondary" (bouton "Voir les médias") sur le bleu par défaut.
   La teinte de marque vient du pont --ui-color-primary-500 défini dans main.css. */
.event-status-badge,
.event-primary-button,
.event-secondary-button,
.event-pagination-button,
.event-contact-input {
  --ui-border: rgba(var(--primary-color-rgb), 0.24);
}

:deep(.event-primary-button) {
  /* Dégradé 100% thème (primaire -> accent). La couleur du texte n'est plus
     figée en #fff : au variant "solid", Nuxt UI pose --ui-text-inverted. */
  background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
  border-color: rgba(var(--primary-color-rgb), 0.3);
}

:deep(.event-primary-button:hover) {
  background: linear-gradient(135deg, var(--accent-color), var(--primary-color));
}

:deep(.event-secondary-button) {
  border-color: rgba(var(--primary-color-rgb), 0.2);
  color: var(--text-color);
}

:deep(.event-pagination-button) {
  border-color: rgba(var(--primary-color-rgb), 0.2);
}

/* UInput v4 (4.10) ne rend aucune classe .input : le champ porte
   data-slot="base" et il est déjà harmonisé globalement par
   .app-shell [data-slot="base"] dans main.css. Les règles supprimées ici
   ne matchaient donc rien (code mort). */

/* La modale est téléportée hors de .app-shell : elle n'hérite donc pas du pont
   de tokens posé sur .app-shell (main.css) et Nuxt UI v4 y applique ses valeurs
   par défaut (fonds clairs, neutres, insensibles au thème de l'app).
   On repose les mêmes tokens ici, mais uniquement avec des variables du thème,
   ce qui couvre les 4 combinaisons dark/light x persona/cyberpunk.
   --bg-color-soft est la seule surface opaque du thème (main.css) : c'est la
   valeur correcte pour le panneau d'une modale. */
:global(.event-modal) {
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

:global(.event-modal-overlay) {
  /* Voile dérivé du primaire : assombrit dans les deux thèmes et reste dans la
     palette, sans couleur figée ni token Nuxt UI par défaut (fonds neutres). */
  background: color-mix(in srgb, var(--primary-color) 55%, transparent) !important;
  backdrop-filter: blur(8px);
}

:global(.event-modal-body) {
  color: var(--text-color);
  background: var(--bg-color-soft);
}

</style>
