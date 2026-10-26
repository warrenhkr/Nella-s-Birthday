<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

type EventType = 'anime' | 'manga' | 'gaming' | 'danse' | 'k-drama' | 'culture'
type ClubEvent = {
  id: string
  title: string
  description: string | null
  date: string
  place: string
  pole: string
  type: string
  status: string
  attendeeCount: number
  capacity: number | null
  price: number
  isFree: boolean
  imageUrl: string | null
  endDate: string | null
  paymentInstructions?: string | null
}

type ImportBatch = {
  id: string
  filename: string
  format: string
  status: string
  rows: Array<Record<string, string>>
  createdAt: string
  expiresAt: string
}

const { success, alert } = useGameToast()
const { data: response, pending, error, refresh } = await useFetch<{ data: ClubEvent[] }>('/api/events')
const { data: importResponse, refresh: refreshImports } = await useFetch<{ data: ImportBatch[] }>('/api/admin/imports')
const importBatches = computed(() => importResponse.value?.data || [])
const reviewingImportId = ref<string | null>(null)
const reviewingRows = ref<Array<Record<string, string>>>([])
const events = computed(() => response.value?.data || [])
const submitting = ref(false)
const form = reactive({
  title: '',
  description: '',
  location: '',
  type: 'anime' as EventType,
  status: 'upcoming' as 'upcoming' | 'cancelled' | 'postponed',
  startDate: '',
  endDate: '',
  imageUrl: '',
  capacity: null as number | null,
  isFree: true,
  price: 0,
  paymentInstructions: ''
})
const descriptionEmpty = ref(true)
const deletingEventId = ref<string | null>(null)
// Boîte de dialogue de suppression d'un événement, avec choix explicite
// sur les médias (photos/vidéos) : le nombre réel est demandé AVANT
// l'ouverture, pour proposer « Supprimer aussi ses N photos ».
const deleteModalOpen = ref(false)
const deleteTarget = ref<ClubEvent | null>(null)
const deleteMediaCount = ref(0)
const deleteWithMedia = ref(false)
const deleteCountLoading = ref(false)
const deletePending = ref(false)
const bulkDeleting = ref(false)
const editingEventId = ref<string | null>(null)
const selectedEventIds = ref<string[]>([])
const currentEventPage = ref(1)
const eventsPerPage = 6

const eventTypes: Array<{ label: string, value: EventType }> = [
  { label: 'Anime', value: 'anime' },
  { label: 'Manga', value: 'manga' },
  { label: 'Gaming', value: 'gaming' },
  { label: 'Danse', value: 'danse' },
  { label: 'K-Drama', value: 'k-drama' },
  { label: 'Culture', value: 'culture' }
]

const totalEventPages = computed(() => Math.max(1, Math.ceil(events.value.length / eventsPerPage)))
const paginatedEvents = computed(() => {
  const start = (currentEventPage.value - 1) * eventsPerPage
  return events.value.slice(start, start + eventsPerPage)
})
const visibleEventIds = computed(() => paginatedEvents.value.map(event => event.id))
const selectedEventsCount = computed(() => selectedEventIds.value.length)
const allVisibleSelected = computed(() => {
  if (!visibleEventIds.value.length) return false
  return visibleEventIds.value.every(id => selectedEventIds.value.includes(id))
})

watch(events, () => {
  if (currentEventPage.value > totalEventPages.value) currentEventPage.value = totalEventPages.value
}, { flush: 'post' })

function goToEventPage(page: number) {
  currentEventPage.value = Math.min(Math.max(page, 1), totalEventPages.value)
  const eventsList = document.querySelector('#events-list')
  const top = eventsList ? eventsList.getBoundingClientRect().top + window.scrollY - 24 : 0
  window.scrollTo({ top, behavior: 'smooth' })
}

async function refreshEvents() {
  await refresh()
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function toLocalDateTime(value: string) {
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function resetForm() {
  Object.assign(form, { title: '', description: '', location: '', type: 'anime', status: 'upcoming', startDate: '', endDate: '', imageUrl: '', capacity: null, isFree: true, price: 0, paymentInstructions: '' })
  editingEventId.value = null
  descriptionEmpty.value = true
}

function editEvent(clubEvent: ClubEvent) {
  editingEventId.value = clubEvent.id
  Object.assign(form, {
    title: clubEvent.title,
    description: clubEvent.description || '',
    location: clubEvent.place,
    type: (clubEvent.type.toLowerCase() as EventType) || 'anime',
    status: clubEvent.status.toLowerCase().includes('annulé') ? 'cancelled' : clubEvent.status.toLowerCase().includes('reporté') ? 'postponed' : 'upcoming',
    startDate: toLocalDateTime(clubEvent.date),
    endDate: clubEvent.endDate ? toLocalDateTime(clubEvent.endDate) : '',
    imageUrl: clubEvent.imageUrl || '',
    capacity: clubEvent.capacity,
    isFree: clubEvent.isFree,
    price: clubEvent.price,
    paymentInstructions: clubEvent.paymentInstructions || ''
  })
  descriptionEmpty.value = !clubEvent.description
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function saveEvent() {
  submitting.value = true
  try {
    await $fetch(editingEventId.value ? `/api/events/${editingEventId.value}` : '/api/events', {
      method: editingEventId.value ? 'PATCH' : 'POST',
      body: {
        title: form.title,
        description: form.description,
        location: form.location,
        pole: form.type,
        type: form.type,
        status: form.status,
        start_date: new Date(form.startDate).toISOString(),
        end_date: new Date(form.endDate).toISOString(),
        image_url: form.imageUrl || undefined,
        max_attendees: form.capacity || undefined,
        is_free: form.isFree,
        price: form.isFree ? 0 : form.price,
        payment_instructions: form.isFree ? undefined : form.paymentInstructions
      }
    })
    resetForm()
    await refresh()
    success(editingEventId.value ? 'Événement mis à jour.' : 'Événement créé.')
  } catch (creationError: unknown) {
    alert(getApiErrorMessage(creationError, 'Impossible de créer cet événement.'))
  } finally {
    submitting.value = false
  }
}

// Suppression d'un événement : on demande D'ABORD le nombre réel de médias,
// puis on ouvre une confirmation qui laisse le choix. Sans la case cochée,
// les photos/vidéos sont CONSERVÉES (souvenirs irremplaçables du club).
async function deleteEvent(clubEvent: ClubEvent) {
  deleteTarget.value = clubEvent
  deleteMediaCount.value = 0
  deleteWithMedia.value = false
  deleteCountLoading.value = true
  deleteModalOpen.value = true

  try {
    const result = await $fetch<{ status: number, count: number }>(`/api/admin/events/${clubEvent.id}/media-count`)
    deleteMediaCount.value = Number(result?.count) || 0
  } catch (countError: unknown) {
    // Le comptage a échoué : la suppression reste possible, sans case média.
    deleteMediaCount.value = 0
    alert(getApiErrorMessage(countError, 'Impossible de compter les photos de cet événement.'))
  } finally {
    deleteCountLoading.value = false
  }
}

function closeDeleteModal() {
  if (deletePending.value) return
  deleteModalOpen.value = false
  deleteTarget.value = null
  deleteWithMedia.value = false
}

async function confirmDeleteEvent() {
  const cible = deleteTarget.value
  if (!cible) return

  const avecMedias = deleteWithMedia.value && deleteMediaCount.value > 0
  deletePending.value = true
  deletingEventId.value = cible.id
  try {
    const result = await $fetch<{ message?: string, mediasSupprimes?: number }>(
      `/api/admin/events/${cible.id}${avecMedias ? '?avecMedias=true' : ''}`,
      { method: 'DELETE' }
    )
    deleteModalOpen.value = false
    deleteTarget.value = null
    deleteWithMedia.value = false
    await refresh()
    if (avecMedias) {
      success(result?.message || `Événement supprimé, ${result?.mediasSupprimes ?? 0} média(s) supprimé(s).`)
    } else {
      success('Événement supprimé. Les photos et vidéos ont été conservées.')
    }
  } catch (deleteError: unknown) {
    alert(getApiErrorMessage(deleteError, 'Impossible de supprimer cet événement.'))
  } finally {
    deletePending.value = false
    deletingEventId.value = null
  }
}

function toggleSelectEvent(eventId: string) {
  const exists = selectedEventIds.value.includes(eventId)
  if (exists) {
    selectedEventIds.value = selectedEventIds.value.filter(id => id !== eventId)
  } else {
    selectedEventIds.value = [...selectedEventIds.value, eventId]
  }
}

function toggleSelectVisibleEvents() {
  if (allVisibleSelected.value) {
    selectedEventIds.value = selectedEventIds.value.filter(id => !visibleEventIds.value.includes(id))
    return
  }

  selectedEventIds.value = [...new Set([...selectedEventIds.value, ...visibleEventIds.value])]
}

async function deleteSelectedEvents() {
  if (!selectedEventIds.value.length) return
  if (!window.confirm(`Supprimer définitivement ${selectedEventIds.value.length} événement(s) sélectionné(s) ?`)) return

  bulkDeleting.value = true
  try {
    const result = await $fetch<{ deletedCount: number, message: string }>('/api/admin/events/bulk-delete', {
      method: 'POST',
      body: { ids: selectedEventIds.value }
    })
    selectedEventIds.value = []
    await refresh()
    success(result.message || `${result.deletedCount} événement(s) supprimé(s).`)
  } catch (deleteError: unknown) {
    alert(getApiErrorMessage(deleteError, 'Impossible de supprimer les événements sélectionnés.'))
  } finally {
    bulkDeleting.value = false
  }
}

function downloadAttendees(eventId: string, format: 'names' | 'names-phones' | 'names-txt') {
  window.open(`/api/admin/events/${eventId}/attendees?format=${format}`, '_blank')
}

async function copyAttendeeNames(eventId: string) {
  try {
    const names = await $fetch<string>(`/api/admin/events/${eventId}/attendees?format=names-txt`)
    await navigator.clipboard.writeText(names)
    success('Les noms des participants ont été copiés.')
  } catch (copyError: unknown) {
    alert(getApiErrorMessage(copyError, 'Impossible de copier les noms des participants.'))
  }
}

function getApiErrorMessage(errorValue: unknown, fallback: string) {
  if (typeof errorValue === 'object' && errorValue !== null && 'data' in errorValue) {
    const data = errorValue.data
    if (typeof data === 'object' && data !== null && 'statusMessage' in data && typeof data.statusMessage === 'string') return data.statusMessage
  }
  return fallback
}

async function deleteImportBatch(batch: ImportBatch) {
  if (!window.confirm(`Supprimer le document « ${batch.filename} » ?`)) return
  try {
    await $fetch(`/api/admin/imports/${batch.id}`, { method: 'DELETE' })
    await refreshImports()
    success('Document d’import supprimé.')
  } catch {
    alert('Impossible de supprimer ce document d’import.')
  }
}

function reviewImport(batch: ImportBatch) {
  reviewingImportId.value = reviewingImportId.value === batch.id ? null : batch.id
  reviewingRows.value = batch.rows.map(row => ({ ...row }))
}

async function saveImportReview(batch: ImportBatch) {
  try {
    await $fetch(`/api/admin/imports/${batch.id}`, { method: 'PATCH', body: { rows: reviewingRows.value } })
    await refreshImports()
    success('Corrections du document enregistrées.')
  } catch {
    alert('Impossible d’enregistrer les corrections du document.')
  }
}

async function repairImport(batch: ImportBatch) {
  try {
    const result = await $fetch<{ repaired: number, merged: number, mediaCreated: number, warnings: string[] }>(`/api/admin/imports/${batch.id}/repair`, { method: 'POST' })
    await refreshEvents()
    await refreshImports()
    success(`${result.repaired} événement(s) réparé(s), ${result.mediaCreated} média(s) ajouté(s), ${result.merged} doublon(s) regroupé(s).`)
    if (result.warnings.length) alert(result.warnings.slice(0, 3).join(' '))
  } catch (error: unknown) {
    alert(getApiErrorMessage(error, 'Impossible de réparer cet import.'))
  }
}
</script>

<template>
  <div class="event-dashboard mx-auto max-w-7xl px-4 py-10 pb-32 sm:py-16 lg:px-8">
    <section class="mb-8 surface-solid clip-corner p-5">
      <p class="text-xs uppercase tracking-[0.2em] text-brand">
        Import à gros volume
      </p>
      <h2
        class="mt-2 text-2xl font-semibold"
        style="color: var(--text-color);"
      >
        Guide des imports d’événements historiques
      </h2>
      <div class="mt-4 grid gap-4 md:grid-cols-3">
        <div>
          <h3
            class="font-semibold"
            style="color: var(--text-color);"
          >
            Format CSV
          </h3>
          <p class="mt-1 text-sm text-muted">
            Un CSV est un tableau texte exporté depuis Excel ou Sheets. Télécharge le modèle CSV ou Excel, remplis une ligne par événement, puis sélectionne le fichier ci-dessous.
          </p>
        </div>
        <div>
          <h3
            class="font-semibold"
            style="color: var(--text-color);"
          >
            Images et vidéos
          </h3>
          <p class="mt-1 text-sm text-muted">
            Les images doivent être déjà uploadées puis ajoutées par URL. Pour les vidéos, colle des liens YouTube valides dans la colonne youtube_urls.
          </p>
        </div>
        <div>
          <h3
            class="font-semibold"
            style="color: var(--text-color);"
          >
            Contrôle des lignes
          </h3>
          <p class="mt-1 text-sm text-muted">
            Les colonnes obligatoires sont titre, description, lieu, type, date début et date fin. Le système prévisualise les lignes, repère les doublons et n’insère que les lignes conformes.
          </p>
        </div>
      </div>
    </section>
    <EventBulkImport
      class="mb-8"
      @imported="refreshEvents"
    />
    <section
      v-if="importBatches.length"
      class="mb-10 surface-solid clip-corner p-5"
    >
      <p class="text-xs uppercase tracking-[0.2em] text-brand">
        Documents récents
      </p>
      <h2
        class="mt-2 text-xl font-semibold"
        style="color: var(--text-color);"
      >
        Relecture des imports soumis
      </h2>
      <p class="mt-1 text-sm text-muted">
        Les snapshots restent visibles 30 jours maximum, puis sont supprimés automatiquement. Tu peux aussi les supprimer immédiatement.
      </p>
      <div class="mt-4 space-y-2">
        <div
          v-for="batch in importBatches"
          :key="batch.id"
          class="rounded-lg border border-default p-3"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p
                class="font-medium"
                style="color: var(--text-color);"
              >
                {{ batch.filename }}
              </p>
              <p class="text-xs text-muted">
                {{ batch.format.toUpperCase() }} · {{ batch.status }} · suppression le {{ new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(batch.expiresAt)) }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <UButton
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                label="Supprimer"
                @click="deleteImportBatch(batch)"
              />
              <UButton
                color="primary"
                variant="soft"
                icon="i-lucide-wrench"
                label="Réparer médias/doublons"
                @click="repairImport(batch)"
              />
              <UButton
                color="neutral"
                variant="soft"
                icon="i-lucide-pencil"
                :label="reviewingImportId === batch.id ? 'Fermer' : 'Relire et modifier'"
                @click="reviewImport(batch)"
              />
            </div>
          </div>
          <div
            v-if="reviewingImportId === batch.id"
            class="mt-3 overflow-x-auto rounded-lg border border-default p-3"
          >
            <div class="flex min-w-[760px] gap-2 pb-2 text-xs font-semibold text-muted">
              <span class="w-10">#</span><span class="min-w-48">Titre</span><span class="min-w-64">Date début</span><span class="min-w-64">URL médias</span>
            </div>
            <div
              v-for="(row, index) in reviewingRows"
              :key="index"
              class="flex min-w-[760px] gap-2 border-t border-default py-2"
            >
              <span class="w-10 pt-2 text-xs text-muted">{{ index + 2 }}</span>
              <UInput
                v-model="row.title"
                class="min-w-48"
                size="sm"
              />
              <UInput
                v-model="row.start_date"
                class="min-w-64"
                size="sm"
              />
              <UInput
                v-model="row.video_urls"
                class="min-w-64"
                size="sm"
              />
            </div>
            <UButton
              class="mt-3"
              color="primary"
              icon="i-lucide-save"
              label="Enregistrer les corrections"
              @click="saveImportReview(batch)"
            />
          </div>
        </div>
      </div>
    </section>
    <div class="mb-10">
      <p class="text-xs uppercase tracking-[0.28em] text-brand">
        Événementiel
      </p>
      <h1
        class="mt-3 font-display text-4xl font-black"
        style="color: var(--text-color);"
      >
        Programmer les activités du club
      </h1>
      <p class="mt-2 text-sm text-muted">
        Chaque rendez-vous reçoit un type clair, dont le gaming reste une activité parmi les autres.
      </p>
    </div>

    <div class="space-y-8">
      <form
        class="surface-solid clip-corner max-w-5xl space-y-4 p-6"
        @submit.prevent="saveEvent"
      >
        <h2
          class="text-xl font-semibold"
          style="color: var(--text-color);"
        >
          {{ editingEventId ? 'Modifier l’événement' : 'Nouvel événement' }}
        </h2>
        <UInput
          v-model="form.title"
          required
          placeholder="Titre"
        />
        <ClientOnly>
          <RichTextEditor
            v-model="form.description"
            aria-label="Résumé de l’événement"
            placeholder="Description (10 caractères minimum)"
            @update:empty="descriptionEmpty = $event"
          />
          <template #fallback>
            <UTextarea
              v-model="form.description"
              required
              aria-label="Résumé de l’événement"
              placeholder="Description (10 caractères minimum)"
            />
          </template>
        </ClientOnly>
        <UInput
          v-model="form.location"
          required
          placeholder="Lieu"
        />
        <select
          v-model="form.type"
          class="event-select"
          aria-label="Type d'événement"
        >
          <option
            v-for="eventType in eventTypes"
            :key="eventType.value"
            :value="eventType.value"
          >
            {{ eventType.label }}
          </option>
        </select>
        <select
          v-model="form.status"
          class="event-select"
          aria-label="Statut éditorial de l'événement"
        >
          <option value="upcoming">
            À venir
          </option>
          <option value="cancelled">
            Annulé
          </option>
          <option value="postponed">
            Reporté
          </option>
        </select>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block text-sm text-muted">
            Heure de début
            <UInput
              v-model="form.startDate"
              required
              type="datetime-local"
              placeholder="Date et heure de début"
            />
          </label>
          <label class="block text-sm text-muted">
            Heure de fin
            <UInput
              v-model="form.endDate"
              required
              type="datetime-local"
              placeholder="Date et heure de fin"
            />
          </label>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <UInput
            v-model.number="form.capacity"
            min="1"
            type="number"
            placeholder="Nombre de places (optionnel)"
          />
          <label class="flex items-center gap-2 text-sm text-muted">
            <input
              v-model="form.isFree"
              type="checkbox"
            >
            Événement gratuit
          </label>
        </div>
        <div
          v-if="!form.isFree"
          class="space-y-3"
        >
          <UInput
            v-model.number="form.price"
            type="number"
            min="0.01"
            step="0.01"
            required
            placeholder="Prix"
          />
          <UTextarea
            v-model="form.paymentInstructions"
            required
            placeholder="Instructions de paiement après inscription"
          />
        </div>
        <ImageUpload
          v-model="form.imageUrl"
          label="Image de l’événement"
        />
        <UButton
          type="submit"
          color="primary"
          :loading="submitting"
          :disabled="descriptionEmpty"
          :label="editingEventId ? 'Enregistrer les modifications' : 'Créer l’événement'"
        />
        <UButton
          v-if="editingEventId"
          type="button"
          color="neutral"
          variant="soft"
          label="Annuler l’édition"
          @click="resetForm"
        />
      </form>

      <section
        id="events-list"
        class="space-y-5"
      >
        <div class="flex flex-col gap-3 border-b border-default pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="text-xs uppercase tracking-[0.2em] text-brand">
              Catalogue des événements
            </p>
            <h2
              class="mt-1 text-2xl font-semibold"
              style="color: var(--text-color);"
            >
              Événements enregistrés
            </h2>
            <p class="mt-1 text-sm text-muted">
              {{ events.length }} événement(s) · {{ eventsPerPage }} par page
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              v-if="visibleEventIds.length"
              :label="allVisibleSelected ? 'Désélectionner la page' : 'Sélectionner la page'"
              color="neutral"
              variant="soft"
              @click="toggleSelectVisibleEvents"
            />
            <UButton
              v-if="selectedEventsCount > 0"
              :label="`Supprimer la sélection (${selectedEventsCount})`"
              color="error"
              variant="soft"
              :loading="bulkDeleting"
              @click="deleteSelectedEvents"
            />
            <AppPagination
              :current-page="currentEventPage"
              :total-pages="totalEventPages"
              :item-count="events.length"
              item-label="événement"
              @page-change="goToEventPage"
            />
          </div>
        </div>
        <div
          v-if="pending"
          class="space-y-4"
        >
          <USkeleton
            v-for="index in 3"
            :key="index"
            class="h-28"
          />
        </div>
        <div
          v-else-if="error"
          class="surface-solid p-6 text-center text-muted"
        >
          Impossible de charger les événements.
          <UButton
            class="mt-4"
            color="primary"
            label="Réessayer"
            @click="refreshEvents"
          />
        </div>
        <div
          v-else
          class="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
        >
          <article
            v-for="clubEvent in paginatedEvents"
            :key="clubEvent.id"
            class="surface-solid clip-corner flex h-full flex-col p-5"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <label class="flex items-center gap-2 text-xs text-muted">
                  <input
                    type="checkbox"
                    :checked="selectedEventIds.includes(clubEvent.id)"
                    @change="toggleSelectEvent(clubEvent.id)"
                  >
                  Sélectionner
                </label>
                <h2
                  class="line-clamp-2 text-lg font-semibold"
                  style="color: var(--text-color);"
                >
                  {{ clubEvent.title }}
                </h2>
                <p class="mt-1 text-sm text-muted">
                  {{ formatDate(clubEvent.date) }} · {{ clubEvent.place }}
                </p>
              </div>
              <UBadge
                color="primary"
                variant="soft"
              >
                {{ clubEvent.type || clubEvent.pole }}
              </UBadge>
            </div>
            <img
              v-if="clubEvent.imageUrl"
              :src="clubEvent.imageUrl"
              :alt="clubEvent.title"
              class="mt-4 h-40 w-full rounded-lg object-cover"
              loading="lazy"
            >
            <RichTextContent
              v-if="clubEvent.description"
              class="mt-4 line-clamp-3 text-sm text-muted"
              :content="clubEvent.description"
              :label="`Description : ${clubEvent.title}`"
            />
            <div class="mt-4 grid grid-cols-2 gap-2">
              <div class="rounded-lg border border-default bg-default/20 p-3">
                <p class="text-xs uppercase tracking-wide text-muted">
                  Participants
                </p>
                <p
                  class="mt-1 text-xl font-bold"
                  style="color: var(--text-color);"
                >
                  {{ clubEvent.attendeeCount }}<span
                    v-if="clubEvent.capacity"
                    class="text-sm font-normal text-muted"
                  > / {{ clubEvent.capacity }}</span>
                </p>
                <p class="text-xs text-muted">
                  inscription(s) confirmée(s)
                </p>
              </div>
              <div class="rounded-lg border border-default bg-default/20 p-3">
                <p class="text-xs uppercase tracking-wide text-muted">
                  État
                </p>
                <p
                  class="mt-2 text-sm font-semibold"
                  style="color: var(--text-color);"
                >
                  {{ clubEvent.status }}
                </p>
                <p class="mt-1 text-xs text-muted">
                  {{ clubEvent.isFree ? 'Gratuit' : `${clubEvent.price} FCFA` }}
                </p>
              </div>
            </div>
            <div class="mt-auto pt-5">
              <div class="flex flex-wrap gap-2">
                <UButton
                  size="xs"
                  variant="soft"
                  label="Télécharger les noms"
                  @click="downloadAttendees(clubEvent.id, 'names')"
                />
                <UButton
                  size="xs"
                  variant="soft"
                  label="Noms + numéros"
                  @click="downloadAttendees(clubEvent.id, 'names-phones')"
                />
                <UButton
                  size="xs"
                  variant="soft"
                  label="Exporter TXT"
                  @click="downloadAttendees(clubEvent.id, 'names-txt')"
                />
                <UButton
                  size="xs"
                  variant="soft"
                  label="Copier les noms"
                  @click="copyAttendeeNames(clubEvent.id)"
                />
                <UButton
                  size="xs"
                  color="primary"
                  variant="soft"
                  label="Modifier"
                  @click="editEvent(clubEvent)"
                />
                <UButton
                  size="xs"
                  color="error"
                  variant="soft"
                  label="Supprimer"
                  :loading="deletingEventId === clubEvent.id"
                  @click="deleteEvent(clubEvent)"
                />
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>

    <!-- Confirmation de suppression : choix explicite sur les médias. -->
    <UModal
      v-model:open="deleteModalOpen"
      :title="deleteTarget ? `Supprimer « ${deleteTarget.title} » ?` : 'Supprimer cet événement ?'"
      :ui="{ content: 'max-w-lg' }"
    >
      <template #body>
        <div
          v-if="deleteTarget"
          class="space-y-4"
        >
          <p
            v-if="deleteCountLoading"
            class="text-sm text-muted"
          >
            Vérification des photos et vidéos rattachées à cet événement…
          </p>
          <template v-else>
            <p class="text-sm text-muted">
              <template v-if="deleteMediaCount > 0">
                Cet événement contient
                <strong style="color: var(--text-color);">{{ deleteMediaCount }} photo(s) et vidéo(s)</strong>.
              </template>
              <template v-else>
                Aucune photo ni vidéo n’est rattachée à cet événement.
              </template>
            </p>

            <div
              v-if="deleteMediaCount > 0"
              class="rounded-lg border border-default p-3"
            >
              <label
                class="flex items-start gap-3 text-sm"
                style="color: var(--text-color);"
              >
                <input
                  v-model="deleteWithMedia"
                  type="checkbox"
                  class="mt-0.5"
                >
                <span>
                  Supprimer aussi ses {{ deleteMediaCount }} photos et vidéos
                </span>
              </label>
              <p class="mt-2 text-xs text-muted">
                Si tu laisses cette case décochée, les photos et vidéos sont
                <strong style="color: var(--text-color);">conservées</strong> :
                ce sont des souvenirs irremplaçables. L’événement disparaît,
                mais ses médias restent dans la galerie du club.
              </p>
            </div>

            <p
              v-else
              class="text-xs text-muted"
            >
              La suppression de l’événement n’effacera aucun média — il n’y en a aucun rattaché.
            </p>

            <UAlert
              v-if="deleteWithMedia && deleteMediaCount > 0"
              color="error"
              variant="soft"
              icon="i-lucide-triangle-alert"
              title="Suppression définitive des médias"
              :description="`${deleteMediaCount} photo(s)/vidéo(s) seront définitivement retirées de la galerie. Cette action est irréversible.`"
            />
          </template>
        </div>
      </template>

      <template #footer>
        <div class="flex w-full flex-wrap justify-end gap-2">
          <UButton
            color="neutral"
            variant="soft"
            label="Annuler"
            :disabled="deletePending"
            @click="closeDeleteModal"
          />
          <UButton
            color="error"
            icon="i-lucide-trash-2"
            :loading="deletePending"
            :disabled="deleteCountLoading || deletePending"
            :label="deleteWithMedia && deleteMediaCount > 0 ? `Supprimer tout (${deleteMediaCount} médias inclus)` : 'Supprimer l’événement'"
            @click="confirmDeleteEvent"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.event-select {
  width: 100%;
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  background: var(--surface-color);
  color: var(--text-color);
  padding: 0.6rem 0.75rem;
}

.event-dashboard form,
.event-dashboard section,
.event-dashboard article {
  min-width: 0;
}

@media (max-width: 640px) {
  .event-dashboard h1 {
    font-size: 2.25rem;
    line-height: 1.1;
  }

  .event-dashboard article > div:first-child {
    align-items: flex-start;
  }

  .event-dashboard article .flex {
    max-width: 100%;
  }
}
</style>
