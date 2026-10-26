<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

// ============================================================
// Modération — volet médias de la galerie
// Les API serveur existantes sont réutilisées telles quelles :
//   GET    /api/admin/gallery        → tous les médias (publiés ou non)
//   PATCH  /api/admin/gallery/:id    → isPublished (approuver/rejeter)
//   DELETE /api/admin/gallery/:id    → retirer un média
//   + POST /api/admin/gallery, /bulk → publication
// ============================================================

type MediaType = 'IMAGE' | 'YOUTUBE_VIDEO' | 'VIDEO'
type MediaSource = 'CLOUDINARY' | 'DIRECT' | 'YOUTUBE' | 'TERABOX'
type ModoStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FLAGGED'
type MediaTypeFilter = 'ALL' | 'IMAGE' | 'VIDEO'
type SourceFilter = 'ALL' | MediaSource
type StatusFilter = 'ALL' | ModoStatus
type ModoAction = 'approve' | 'reject' | 'flag' | 'remove'

type GalleryMedia = {
  id: string
  title: string | null
  url: string
  sourceUrl: string | null
  publicId: string | null
  mediaType: MediaType
  youtubeId: string | null
  category: string | null
  eventId: string | null
  eventTag: string | null
  eventDate: string | null
  createdAt: string
  isPublished: boolean
}

type ModoMediaItem = {
  id: string
  title: string
  url: string
  thumbUrl: string
  youtubeId: string | null
  eventLabel: string
  typeLabel: string
  isVideo: boolean
  source: MediaSource
  sourceLabel: string
  status: ModoStatus
  dateLabel: string
  isPublished: boolean
}

type MediaFilters = {
  query: string
  event: string
  type: MediaTypeFilter
  source: SourceFilter
  status: StatusFilter
}

const { success, alert } = useGameToast()

// ------------------------------------------------------------
// Volet 1 — Médias
// ------------------------------------------------------------
const { data: galleryResponse, pending: mediaPending, error: galleryError, refresh: refreshGallery } = await useFetch<{ data: GalleryMedia[] }>('/api/admin/gallery')

// Événements réels du club : servent au filtre « par événement » ET au
// sélecteur du formulaire de publication. Sans ça, un média ne pouvait
// être rattaché qu'à un simple texte libre (eventTag) et le filtre
// affichait un id tronqué au lieu du nom de l'événement.
const { data: eventsResponse } = await useFetch<{ data: Array<{ id: string, title: string }> }>('/api/events')
const nomsEvenements = computed(() => {
  const map = new Map<string, string>()
  for (const e of eventsResponse.value?.data ?? []) map.set(e.id, e.title)
  return map
})
const optionsEvenements = computed(() =>
  [...nomsEvenements.value.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label))
)
function hasUsableMediaUrl(value: string | null | undefined) {
  if (typeof value !== 'string') return false
  const normalized = value.trim()
  return normalized.length > 0 && !/^null$/i.test(normalized) && !/^undefined$/i.test(normalized)
}

function normalizeMediaDisplayUrl(value: string | null | undefined, mediaType: MediaType): string {
  if (!value || !hasUsableMediaUrl(value)) return ''

  try {
    const parsed = new URL(value)
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase()
    if (host !== 'u.pcloud.link' && !host.endsWith('.pcloud.com')) return value
    return `/api/media/proxy?url=${encodeURIComponent(value)}&type=${mediaType === 'IMAGE' ? 'IMAGE' : 'VIDEO'}`
  } catch {
    return value
  }
}

const galleryMedia = computed<GalleryMedia[]>(() =>
  (galleryResponse.value?.data ?? []).filter(media => hasUsableMediaUrl(media.url) || hasUsableMediaUrl(media.sourceUrl))
)

const SOURCE_LABELS: Record<MediaSource, string> = {
  CLOUDINARY: 'Cloudinary',
  DIRECT: 'Lien direct',
  YOUTUBE: 'YouTube',
  TERABOX: 'Terabox'
}
const TYPE_LABELS: Record<MediaType, string> = {
  IMAGE: 'Image',
  YOUTUBE_VIDEO: 'Vidéo YouTube',
  VIDEO: 'Vidéo'
}
const EMPTY_COUNTS: Record<ModoStatus, number> = { PENDING: 0, APPROVED: 0, REJECTED: 0, FLAGGED: 0 }

// Décisions de modération non persistables côté serveur (GalleryImage n'a que
// `isPublished`) : « rejeté » et « signalé » sont mémorisés localement afin de
// rester visibles après rechargement. Voir le rapport (limite connue).
const STATUS_STORAGE_KEY = 'otaku:modo:media-status'
const localStatus = ref<Record<string, 'REJECTED' | 'FLAGGED'>>({})

onMounted(() => {
  try {
    const raw = localStorage.getItem(STATUS_STORAGE_KEY)
    if (raw) localStatus.value = JSON.parse(raw) as Record<string, 'REJECTED' | 'FLAGGED'>
  } catch {
    localStatus.value = {}
  }
})

function persistLocalStatus() {
  if (import.meta.server) return
  try {
    localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(localStatus.value))
  } catch {
    // Stockage indisponible (navigation privée) : l'état reste en mémoire.
  }
}

function clearLocalStatus(id: string) {
  localStatus.value = Object.fromEntries(
    Object.entries(localStatus.value).filter(([key]) => key !== id)
  ) as Record<string, 'REJECTED' | 'FLAGGED'>
}

function resolveSource(media: GalleryMedia): MediaSource {
  const blob = `${media.url || ''} ${media.sourceUrl || ''}`.toLowerCase()
  if (media.mediaType === 'YOUTUBE_VIDEO' || media.youtubeId || blob.includes('youtube.com') || blob.includes('youtu.be')) return 'YOUTUBE'
  if (media.publicId || blob.includes('cloudinary')) return 'CLOUDINARY'
  if (blob.includes('terabox.com') || blob.includes('1024terabox.com') || blob.includes('terabox')) return 'TERABOX'
  return 'DIRECT'
}

function resolveEventLabel(media: GalleryMedia): string {
  if (media.eventId) {
    const nom = nomsEvenements.value.get(media.eventId)
    if (nom) return nom
    return `Événement ${media.eventId.slice(0, 6)}`
  }
  const tag = media.eventTag?.trim()
  if (tag) return tag
  return 'Sans événement'
}

function resolveStatus(media: GalleryMedia): ModoStatus {
  const local = localStatus.value[media.id]
  if (local === 'FLAGGED') return 'FLAGGED'
  if (local === 'REJECTED') return 'REJECTED'
  return media.isPublished ? 'APPROVED' : 'PENDING'
}

function resolveThumb(media: GalleryMedia): string {
  if (media.mediaType === 'YOUTUBE_VIDEO' && media.youtubeId) return `https://i.ytimg.com/vi/${media.youtubeId}/hqdefault.jpg`
  if (media.mediaType === 'IMAGE') {
    const url = hasUsableMediaUrl(media.url) ? media.url : (hasUsableMediaUrl(media.sourceUrl) ? media.sourceUrl! : '')
    return normalizeMediaDisplayUrl(url, 'IMAGE')
  }
  return ''
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
function resolveDateLabel(media: GalleryMedia): string {
  const raw = media.eventDate || media.createdAt
  if (!raw) return 'Date inconnue'
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return 'Date inconnue'
  return dateFormatter.format(date)
}

const mediaItems = computed<ModoMediaItem[]>(() => galleryMedia.value.map((media) => {
  const source = resolveSource(media)
  return {
    id: media.id,
    title: media.title?.trim() || 'Média sans titre',
    url: normalizeMediaDisplayUrl(media.url, media.mediaType === 'IMAGE' ? 'IMAGE' : 'VIDEO'),
    thumbUrl: resolveThumb(media),
    youtubeId: media.youtubeId,
    eventLabel: resolveEventLabel(media),
    typeLabel: TYPE_LABELS[media.mediaType] || 'Média',
    isVideo: media.mediaType !== 'IMAGE',
    source,
    sourceLabel: SOURCE_LABELS[source],
    status: resolveStatus(media),
    dateLabel: resolveDateLabel(media),
    isPublished: media.isPublished
  }
}))

const filters = ref<MediaFilters>({ query: '', event: '', type: 'ALL', source: 'ALL', status: 'ALL' })
function resetFilters() {
  filters.value = { query: '', event: '', type: 'ALL', source: 'ALL', status: 'ALL' }
}

const eventOptions = computed(() => {
  const labels = new Set<string>()
  mediaItems.value.forEach(item => labels.add(item.eventLabel))
  return [...labels].sort((a, b) => a.localeCompare(b, 'fr'))
})

const statusCounts = computed<Record<ModoStatus, number>>(() => {
  const counts = { ...EMPTY_COUNTS }
  mediaItems.value.forEach((item) => {
    counts[item.status] += 1
  })
  return counts
})

const filteredMedia = computed(() => {
  const query = filters.value.query.trim().toLowerCase()
  return mediaItems.value.filter((item) => {
    if (filters.value.event && item.eventLabel !== filters.value.event) return false
    if (filters.value.type !== 'ALL' && (item.isVideo ? 'VIDEO' : 'IMAGE') !== filters.value.type) return false
    if (filters.value.source !== 'ALL' && item.source !== filters.value.source) return false
    if (filters.value.status !== 'ALL' && item.status !== filters.value.status) return false
    if (query) {
      const haystack = `${item.title} ${item.eventLabel} ${item.sourceLabel} ${item.typeLabel}`.toLowerCase()
      if (!haystack.includes(query)) return false
    }
    return true
  })
})

const mediaPerPage = 12
const mediaPage = ref(1)
const totalMediaPages = computed(() => Math.max(1, Math.ceil(filteredMedia.value.length / mediaPerPage)))
const paginatedFilteredMedia = computed(() => {
  const start = (mediaPage.value - 1) * mediaPerPage
  return filteredMedia.value.slice(start, start + mediaPerPage)
})

watch(() => filters.value, () => {
  mediaPage.value = 1
}, { deep: true })

watch(filteredMedia, () => {
  if (mediaPage.value > totalMediaPages.value) mediaPage.value = totalMediaPages.value
})

const viewMode = ref<'grid' | 'list'>('grid')
const busyId = ref<string | null>(null)
const busyAction = ref<ModoAction | null>(null)
function isBusy(id: string) {
  return busyId.value === id
}

async function approveMedia(media: ModoMediaItem) {
  if (busyId.value) return
  busyId.value = media.id
  busyAction.value = 'approve'
  try {
    if (!media.isPublished) {
      await $fetch(`/api/admin/gallery/${media.id}`, { method: 'PATCH', body: { isPublished: true } })
    }
    clearLocalStatus(media.id)
    persistLocalStatus()
    await refreshGallery()
    success('Média approuvé et publié.')
  } catch {
    alert('Impossible d’approuver ce média.')
  } finally {
    busyId.value = null
    busyAction.value = null
  }
}

async function rejectMedia(media: ModoMediaItem) {
  if (busyId.value) return
  busyId.value = media.id
  busyAction.value = 'reject'
  try {
    if (media.isPublished) {
      await $fetch(`/api/admin/gallery/${media.id}`, { method: 'PATCH', body: { isPublished: false } })
    }
    localStatus.value[media.id] = 'REJECTED'
    persistLocalStatus()
    await refreshGallery()
    success('Média rejeté et masqué du public.')
  } catch {
    alert('Impossible de rejeter ce média.')
  } finally {
    busyId.value = null
    busyAction.value = null
  }
}

function flagMedia(media: ModoMediaItem) {
  if (busyId.value) return
  busyId.value = media.id
  busyAction.value = 'flag'
  try {
    if (localStatus.value[media.id] === 'FLAGGED') {
      clearLocalStatus(media.id)
      success('Signalement retiré.')
    } else {
      localStatus.value[media.id] = 'FLAGGED'
      success('Média signalé pour vérification.')
    }
    persistLocalStatus()
  } finally {
    busyId.value = null
    busyAction.value = null
  }
}

async function deleteMedia(media: ModoMediaItem) {
  if (busyId.value) return
  if (!window.confirm(`Retirer définitivement « ${media.title} » de la galerie ?`)) return
  busyId.value = media.id
  busyAction.value = 'remove'
  try {
    await $fetch(`/api/admin/gallery/${media.id}`, { method: 'DELETE' })
    clearLocalStatus(media.id)
    persistLocalStatus()
    await refreshGallery()
    success('Média retiré de la galerie.')
  } catch {
    alert('Impossible de retirer ce média.')
  } finally {
    busyId.value = null
    busyAction.value = null
  }
}

// ------------------------------------------------------------
// Publication d'un souvenir (formulaire existant)
// ------------------------------------------------------------
const galleryTitle = ref('')
const galleryCategory = ref('')
const galleryEventDate = ref('')
const galleryEventTag = ref('')
// Événement réel rattaché au média (facultatif) : c'est lui qui permet
// le filtrage fiable par événement dans la modération.
const galleryEventId = ref('')
const galleryYoutubeUrl = ref('')
const galleryVideoUrl = ref('')
const galleryMediaType = ref<'IMAGE' | 'YOUTUBE_VIDEO' | 'VIDEO'>('IMAGE')
const galleryPending = ref(false)
const galleryImageUrls = ref('')
const galleryVideoUrls = ref('')
const galleryUploadErrors = ref<string[]>([])

async function createGalleryMedia(uploaded: { url: string, public_id?: string }, mediaType = galleryMediaType.value) {
  if (!galleryTitle.value.trim() || !galleryCategory.value.trim() || !galleryEventDate.value) {
    alert('Le titre, la catégorie et la date sont obligatoires.')
    return
  }
  galleryPending.value = true
  try {
    await $fetch('/api/admin/gallery', {
      method: 'POST',
      body: {
        title: galleryTitle.value.trim(),
        category: galleryCategory.value.trim(),
        eventDate: galleryEventDate.value ? new Date(`${galleryEventDate.value}T00:00:00.000Z`).toISOString() : null,
        eventTag: galleryEventTag.value.trim() || null,
        eventId: galleryEventId.value || null,
        url: mediaType === 'IMAGE' || mediaType === 'VIDEO' ? uploaded.url : null,
        publicId: uploaded.public_id || null,
        mediaType,
        youtubeUrl: mediaType === 'YOUTUBE_VIDEO' ? galleryYoutubeUrl.value.trim() : null,
        videoUrl: mediaType === 'VIDEO' ? uploaded.url || galleryVideoUrl.value.trim() : null
      }
    })
    galleryTitle.value = ''
    galleryCategory.value = ''
    galleryEventDate.value = ''
    galleryEventTag.value = ''
    galleryEventId.value = ''
    galleryYoutubeUrl.value = ''
    galleryVideoUrl.value = ''
  } catch {
    throw new Error('Impossible de publier ce média.')
  }
}

async function publishGalleryImage(uploaded: { url: string, public_id?: string }) {
  galleryPending.value = true
  try {
    await createGalleryMedia(uploaded)
    galleryTitle.value = ''
    galleryCategory.value = ''
    galleryEventDate.value = ''
    galleryEventTag.value = ''
    galleryEventId.value = ''
    await refreshGallery()
    success('Média publié dans la galerie.')
  } catch {
    alert('Impossible de publier ce média.')
  } finally {
    galleryPending.value = false
  }
}

async function publishYoutubeVideo() {
  if (!galleryYoutubeUrl.value.trim()) {
    alert('Ajoute une URL YouTube.')
    return
  }
  await publishGalleryImage({ url: '', public_id: undefined })
}

async function publishOtherVideo() {
  if (!galleryVideoUrl.value.trim()) {
    alert('Ajoute une URL pCloud, Terabox ou Vimeo/Dailymotion/Twitch.')
    return
  }
  await publishGalleryImage({ url: '', public_id: undefined })
}

async function publishGalleryLinks() {
  const imageUrls = galleryImageUrls.value.split(/[|\n,]/).map(value => value.trim()).filter(Boolean)
  const videoUrls = galleryVideoUrls.value.split(/[|\n,]/).map(value => value.trim()).filter(Boolean)
  if (!imageUrls.length && !videoUrls.length) {
    alert('Ajoute au moins un lien image, dossier ou vidéo.')
    return
  }
  if (!galleryTitle.value.trim() || !galleryCategory.value.trim() || !galleryEventDate.value) {
    alert('Le titre, la catégorie et la date sont obligatoires.')
    return
  }

  galleryPending.value = true
  galleryUploadErrors.value = []
  try {
    const result = await $fetch<{ created: number, rejected: number, errors: string[] }>('/api/admin/gallery/bulk', {
      method: 'POST',
      body: {
        title: galleryTitle.value.trim(),
        category: galleryCategory.value.trim(),
        eventDate: new Date(`${galleryEventDate.value}T00:00:00.000Z`).toISOString(),
        eventTag: galleryEventTag.value.trim() || null,
        eventId: galleryEventId.value || null,
        imageUrls,
        videoUrls
      }
    })
    galleryUploadErrors.value = result.errors
    galleryImageUrls.value = ''
    galleryVideoUrls.value = ''
    await refreshGallery()
    if (result.created) success(`${result.created} média(s) publié(s) dans la galerie.`)
    if (result.rejected) alert(`${result.rejected} lien(s) n’ont pas pu être importé(s).`)
  } catch (error: unknown) {
    alert(error instanceof Error ? error.message : 'Import média impossible.')
  } finally {
    galleryPending.value = false
  }
}

// ============================================================
// ONGLETS DE TRAVAIL
// La page de modération est scindée en onglets pour qu’une action reste
// accessible en un clic. Les sections restent montées (v-show) : aucun
// contenu n’est retiré et aucun appel API ne change.
// ============================================================
type ModoTab = 'medias' | 'publier'

const modoTabs: Array<{ value: ModoTab, label: string, icon: string }> = [
  { value: 'medias', label: 'Médias', icon: 'i-lucide-images' },
  { value: 'publier', label: 'Publier un souvenir', icon: 'i-lucide-cloud-upload' }
]

const activeTab = ref<ModoTab>('medias')

// Repères chiffrés : volume de médias visibles dans l’onglet de modération.
const tabCounts = computed<Partial<Record<ModoTab, number>>>(() => ({
  medias: mediaItems.value.length
}))

function selectTab(value: ModoTab) {
  activeTab.value = value
  if (import.meta.client) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${value}`)
  }
}

onMounted(() => {
  const hash = window.location.hash.replace(/^#/, '')
  if (modoTabs.some(tab => tab.value === hash)) activeTab.value = hash as ModoTab
})

const anyPending = computed(() => mediaPending.value)
async function refreshAll() {
  await refreshGallery()
}
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-16 lg:px-8">
    <div class="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs uppercase tracking-[0.28em] text-brand">
          Modération
        </p>
        <h1
          class="mt-3 font-display text-4xl font-black"
          style="color: var(--text-color);"
        >
          Protéger l’espace communautaire
        </h1>
        <p class="mt-2 text-sm text-muted">
          Examine les médias du club et garde les contenus conformes à l’esprit du club.
        </p>
      </div>
      <UButton
        color="neutral"
        variant="soft"
        icon="i-lucide-refresh-cw"
        label="Actualiser"
        :loading="anyPending"
        @click="refreshAll"
      />
    </div>

    <!-- Barre d’onglets : une action = un clic -->
    <div
      class="otaku-tabs mt-8"
      role="tablist"
      aria-label="Sections de la modération"
    >
      <button
        v-for="tab in modoTabs"
        :key="tab.value"
        type="button"
        role="tab"
        class="otaku-tab"
        :class="{ 'otaku-tab--active': activeTab === tab.value }"
        :aria-selected="activeTab === tab.value"
        @click="selectTab(tab.value)"
      >
        <UIcon
          :name="tab.icon"
          class="otaku-tab__icon"
          aria-hidden="true"
        />
        {{ tab.label }}
        <span
          v-if="tabCounts[tab.value] !== undefined"
          class="otaku-tab__count"
        >{{ tabCounts[tab.value] }}</span>
      </button>
    </div>
    <!-- Onglet : Médias -->
    <div
      v-show="activeTab === 'medias'"
      role="tabpanel"
      aria-label="Médias"
    >
      <!-- ============================================================
           MÉDIAS — filtre + traitement
           ============================================================ -->
      <section>
        <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p class="text-xs uppercase tracking-[0.2em] text-brand">
              Modération des médias
            </p>
            <h2
              class="mt-2 text-2xl font-semibold"
              style="color: var(--text-color);"
            >
              Identifier et traiter les médias
            </h2>
            <p class="mt-1 text-sm text-muted">
              Filtre par événement, type, source et statut, puis approuve, rejette ou signale chaque média.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <UButton
              size="sm"
              :color="viewMode === 'grid' ? 'primary' : 'neutral'"
              :variant="viewMode === 'grid' ? 'soft' : 'ghost'"
              icon="i-lucide-layout-grid"
              label="Grille"
              @click="viewMode = 'grid'"
            />
            <UButton
              size="sm"
              :color="viewMode === 'list' ? 'primary' : 'neutral'"
              :variant="viewMode === 'list' ? 'soft' : 'ghost'"
              icon="i-lucide-list"
              label="Liste"
              @click="viewMode = 'list'"
            />
          </div>
        </div>

        <ModoMediaFilters
          v-model:filters="filters"
          class="mt-5"
          :events="eventOptions"
          :counts="statusCounts"
          :total="mediaItems.length"
          :filtered="filteredMedia.length"
          @reset="resetFilters"
        />

        <div
          v-if="galleryError"
          class="surface-solid clip-corner mt-5 flex flex-col items-center gap-3 p-6 text-center text-muted"
        >
          Impossible de charger les médias à modérer.
          <UButton
            color="primary"
            label="Réessayer"
            @click="refreshGallery()"
          />
        </div>

        <div
          v-else-if="mediaPending"
          class="modo-grid mt-5"
        >
          <USkeleton
            v-for="index in 6"
            :key="index"
            class="h-64"
          />
        </div>

        <ModoEmptyState
          v-else-if="mediaItems.length === 0"
          class="mt-5"
          mode="empty"
        />

        <ModoEmptyState
          v-else-if="filteredMedia.length === 0"
          class="mt-5"
          mode="no-match"
          @reset="resetFilters"
        />

        <div
          v-else
          :class="viewMode === 'grid' ? 'modo-grid mt-5' : 'modo-list mt-5'"
        >
          <ModoMediaCard
            v-for="item in paginatedFilteredMedia"
            :key="item.id"
            :media="item"
            :view="viewMode"
            :busy-action="isBusy(item.id) ? busyAction : null"
            @approve="approveMedia"
            @reject="rejectMedia"
            @flag="flagMedia"
            @remove="deleteMedia"
          />
        </div>

        <AppPagination
          :current-page="mediaPage"
          :total-pages="totalMediaPages"
          :item-count="filteredMedia.length"
          item-label="média"
          @page-change="(page) => (mediaPage = page)"
        />
      </section>
    </div>

    <!-- Onglet : Publier un souvenir -->
    <div
      v-show="activeTab === 'publier'"
      role="tabpanel"
      aria-label="Publier un souvenir"
    >
      <!-- ============================================================
           PUBLICATION D'UN SOUVENIR
           ============================================================ -->
      <section class="mt-12 surface-solid clip-corner p-6">
        <p class="text-xs uppercase tracking-[0.2em] text-brand">
          Galerie
        </p>
        <h2
          class="mt-2 text-2xl font-semibold"
          style="color: var(--text-color);"
        >
          Publier un souvenir du club
        </h2>
        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <UInput
            v-model="galleryTitle"
            required
            placeholder="Nom du média (obligatoire)"
          />
          <UInput
            v-model="galleryCategory"
            required
            placeholder="Catégorie obligatoire"
          />
          <UInput
            v-model="galleryEventTag"
            placeholder="Tag d'événement (facultatif)"
          />
          <AppSelect
            v-model="galleryEventId"
            :options="[{ value: '', label: 'Aucun événement rattaché' }, ...optionsEvenements]"
            icon="i-lucide-calendar-check"
            aria-label="Rattacher à un événement (facultatif)"
            class="w-full"
          />
          <input
            v-model="galleryEventDate"
            required
            type="date"
            class="modo-control"
            aria-label="Date de l'événement (facultatif)"
          >
        </div>
        <div class="mt-4 rounded-xl border border-dashed border-default/80 bg-default/30 p-4 text-sm text-muted">
          <p
            class="font-medium"
            style="color: var(--text-color);"
          >
            Règle pour les imports de médias lourds
          </p>
          <ul class="mt-2 space-y-1 list-disc pl-5">
            <li>Colle un lien par ligne dans la zone Images : liens directs d'image, dossiers publics pCloud ou Terabox, dossiers Google Drive. Sources images : <strong>pCloud</strong> (publink de dossier) et <strong>Terabox</strong> (partage public).</li>
            <li>Colle les liens vidéo dans la zone Vidéos : sources vidéo <strong>pCloud</strong>, <strong>YouTube</strong> et <strong>Terabox</strong> (et, pour l'historique déjà en base, Vimeo, Dailymotion, Twitch, Google Drive). Aucun fichier vidéo n'est envoyé sur Cloudinary.</li>
            <li>Les dossiers publics sont parcourus automatiquement pour ajouter leurs images à la galerie ; les liens invalides sont signalés sans bloquer les autres.</li>
          </ul>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <UButton
            color="primary"
            :variant="galleryMediaType === 'IMAGE' ? 'solid' : 'soft'"
            label="Photo"
            @click="galleryMediaType = 'IMAGE'"
          />
          <UButton
            color="primary"
            :variant="galleryMediaType === 'YOUTUBE_VIDEO' ? 'solid' : 'soft'"
            label="Vidéo YouTube"
            @click="galleryMediaType = 'YOUTUBE_VIDEO'"
          />
          <UButton
            color="primary"
            :variant="galleryMediaType === 'VIDEO' ? 'solid' : 'soft'"
            label="Autre vidéo"
            @click="galleryMediaType = 'VIDEO'"
          />
        </div>
        <UInput
          v-if="galleryMediaType === 'YOUTUBE_VIDEO'"
          v-model="galleryYoutubeUrl"
          class="mt-3"
          placeholder="URL de la vidéo YouTube"
          type="url"
        />
        <UInput
          v-if="galleryMediaType === 'VIDEO'"
          v-model="galleryVideoUrl"
          class="mt-3"
          placeholder="URL pCloud, Terabox ou Vimeo/Dailymotion/Twitch"
          type="url"
        />
        <ImageUpload
          v-if="galleryMediaType === 'IMAGE'"
          class="mt-4"
          label="Photo du média"
          :disabled="galleryPending"
          @uploaded="publishGalleryImage"
        />
        <div class="mt-4 grid gap-4 md:grid-cols-2">
          <div class="rounded-xl border border-default bg-default/20 p-4">
            <label
              class="block text-sm font-medium"
              style="color: var(--text-color);"
              for="gallery-image-links"
            >
              Images et dossiers
            </label>
            <p class="mt-1 text-xs text-muted">
              Un lien par ligne. Les dossiers publics pCloud ou Terabox (et Google Drive) sont parcourus automatiquement. Les liens vidéo sont basculés vers les vidéos ; un lien mort ou non reconnu est signalé ci-dessous.
            </p>
            <UTextarea
              id="gallery-image-links"
              v-model="galleryImageUrls"
              class="mt-3 w-full"
              :rows="6"
              placeholder="https://exemple.com/photo.webp&#10;https://u.pcloud.link/publink/show?code=XXXX&#10;https://1024terabox.com/s/1UTBOwOd7_Rl2eXXPgqmlAg"
              @update:model-value="galleryUploadErrors = []"
            />
          </div>
          <div class="rounded-xl border border-default bg-default/20 p-4">
            <label
              class="block text-sm font-medium"
              style="color: var(--text-color);"
              for="gallery-video-links"
            >
              Vidéos par liens
            </label>
            <p class="mt-1 text-xs text-muted">
              Sources vidéo : <strong>pCloud</strong>, <strong>YouTube</strong> et <strong>Terabox</strong> (plus Vimeo, Dailymotion, Twitch ou Google Drive pour les liens déjà en base). Un publink pCloud peut désigner un dossier : un média est créé par fichier. Aucun fichier vidéo n’est envoyé sur Cloudinary.
            </p>
            <UTextarea
              id="gallery-video-links"
              v-model="galleryVideoUrls"
              class="mt-3 w-full"
              :rows="6"
              placeholder="https://youtu.be/...&#10;https://u.pcloud.link/publink/show?code=XXXX&#10;https://1024terabox.com/s/1UTBOwOd7_Rl2eXXPgqmlAg"
              @update:model-value="galleryUploadErrors = []"
            />
          </div>
        </div>
        <div class="mt-4 flex flex-wrap items-center gap-3">
          <UButton
            color="primary"
            :loading="galleryPending"
            label="Importer les liens dans la galerie"
            @click="publishGalleryLinks"
          />
          <span class="text-xs text-muted">Les images directes et les images découvertes dans les dossiers seront publiées comme photos.</span>
        </div>
        <ul
          v-if="galleryUploadErrors.length"
          class="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-500"
        >
          <li
            v-for="uploadError in galleryUploadErrors"
            :key="uploadError"
          >
            {{ uploadError }}
          </li>
        </ul>
        <UButton
          v-if="galleryMediaType === 'YOUTUBE_VIDEO'"
          class="mt-4"
          color="primary"
          :loading="galleryPending"
          label="Publier la vidéo YouTube"
          @click="publishYoutubeVideo"
        />
        <UButton
          v-if="galleryMediaType === 'VIDEO'"
          class="mt-4"
          color="primary"
          :loading="galleryPending"
          label="Publier la vidéo"
          @click="publishOtherVideo"
        />
      </section>
    </div>
  </div>
</template>

<style scoped>
.modo-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}

.modo-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.modo-control {
  width: 100%;
  min-height: 2.6rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 0.6rem;
  background: rgba(var(--primary-color-rgb), 0.06);
  color: var(--text-color);
}

.modo-control:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(var(--primary-color-rgb), 0.14);
}
/* ---- Onglets de travail : une action = un clic, cible tactile 44 px ---- */
.otaku-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.otaku-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 2.75rem;
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 9999px;
  background: transparent;
  color: var(--text-color);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, transform 0.15s ease;
}

.otaku-tab:hover {
  border-color: rgba(var(--primary-color-rgb), 0.5);
  transform: translateY(-1px);
}

.otaku-tab--active {
  background: rgba(var(--primary-color-rgb), 0.18);
  border-color: var(--primary-color);
  font-weight: 600;
}

.otaku-tab__icon {
  height: 1rem;
  width: 1rem;
  color: var(--accent-color);
}

.otaku-tab--active .otaku-tab__icon {
  color: var(--primary-color);
}

.otaku-tabs + [role='tabpanel'] {
  margin-top: 1.5rem;
  margin-bottom: 2rem;
}

[role='tabpanel'] + [role='tabpanel'] {
  margin-top: 1.5rem;
}

.otaku-tab__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.35rem;
  padding: 0 0.35rem;
  border-radius: 9999px;
  background: rgba(var(--primary-color-rgb), 0.14);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1.4;
  color: var(--primary-color);
}
</style>
