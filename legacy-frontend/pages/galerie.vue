<script setup lang="ts">
type GalleryImage = {
  id: string
  title: string | null
  url: string
  sourceUrl: string | null
  mediaType: 'IMAGE' | 'YOUTUBE_VIDEO' | 'VIDEO'
  youtubeId: string | null
  category: string | null
  eventDate: string | null
  eventTag: string | null
  eventId: string | null
  createdAt: string
}

const route = useRoute()
const { data: galleryResponse, pending } = await useFetch<{ data: GalleryImage[] }>('/api/galerie')
const images = computed(() => galleryResponse.value?.data || [])
const mediaFilter = ref<'ALL' | 'IMAGE' | 'YOUTUBE_VIDEO' | 'VIDEO'>('ALL')
const eventFilter = ref('ALL')
const yearFilter = ref('ALL')
const currentPage = ref(1)
const mediaPerPage = 9
const imagePreviewOpen = ref(false)
const imagePreviewUrl = ref<string | null>(null)
const eventOptions = computed(() => [...new Set(images.value.map(image => image.eventTag).filter((tag): tag is string => Boolean(tag)))])
const yearOptions = computed(() => [...new Set(images.value.map(image => image.eventDate ? new Date(image.eventDate).getFullYear().toString() : null).filter((year): year is string => Boolean(year)))].sort().reverse())

const forcedEventId = computed(() => typeof route.query.eventId === 'string' ? route.query.eventId : null)
const forcedEventTag = computed(() => typeof route.query.eventTag === 'string' ? route.query.eventTag : null)

if (forcedEventId.value) {
  eventFilter.value = 'ALL'
}
if (forcedEventTag.value) {
  eventFilter.value = forcedEventTag.value
}

const filteredImages = computed(() => images.value.filter((image) => {
  const matchesType = mediaFilter.value === 'ALL' || (mediaFilter.value === 'VIDEO' ? ['VIDEO', 'YOUTUBE_VIDEO'].includes(image.mediaType) : image.mediaType === mediaFilter.value)
  const matchesEvent =
    (forcedEventId.value ? image.eventId === forcedEventId.value : true) &&
    (forcedEventTag.value ? image.eventTag === forcedEventTag.value : true) &&
    (eventFilter.value === 'ALL' ? true : image.eventTag === eventFilter.value)
  const matchesYear = yearFilter.value === 'ALL' || (image.eventDate && new Date(image.eventDate).getFullYear().toString() === yearFilter.value)
  return matchesType && matchesEvent && matchesYear
}))
const totalPages = computed(() => Math.max(1, Math.ceil(filteredImages.value.length / mediaPerPage)))
const paginatedImages = computed(() => filteredImages.value.slice((currentPage.value - 1) * mediaPerPage, currentPage.value * mediaPerPage))
watch([mediaFilter, eventFilter, yearFilter], () => { currentPage.value = 1 })
watch(filteredImages, () => { if (currentPage.value > totalPages.value) currentPage.value = totalPages.value })

function openImagePreview(url: string) {
  imagePreviewUrl.value = url
  imagePreviewOpen.value = true
}
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-16 lg:px-8">
    <div class="mb-10">
      <p class="text-xs uppercase tracking-[0.28em] text-brand">
        Galerie
      </p>
      <h1
        class="mt-3 font-display text-4xl font-black"
        style="color: var(--text-color);"
      >
        Souvenirs du club
      </h1>
    </div>

    <div
      v-if="pending"
      class="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
    >
      <USkeleton
        v-for="index in 6"
        :key="index"
        class="h-80"
      />
    </div>

    <div
      v-if="!pending && images.length"
      class="mb-6 flex flex-wrap gap-2"
    >
      <button
        type="button"
        class="gallery-filter"
        :class="{ 'gallery-filter--active': mediaFilter === 'ALL' }"
        @click="mediaFilter = 'ALL'"
      >
        Tout
      </button>
      <button
        type="button"
        class="gallery-filter"
        :class="{ 'gallery-filter--active': mediaFilter === 'IMAGE' }"
        @click="mediaFilter = 'IMAGE'"
      >
        Photos
      </button>
      <button
        type="button"
        class="gallery-filter"
        :class="{ 'gallery-filter--active': mediaFilter === 'VIDEO' }"
        @click="mediaFilter = 'VIDEO'"
      >
        Vidéos
      </button>
      <AppSelect
        v-model="eventFilter"
        icon="i-lucide-tag"
        size="sm"
        variant="filter"
        aria-label="Filtrer par événement"
        :options="[{ value: 'ALL', label: 'Tous les événements' }, ...eventOptions.map(eventTag => ({ value: eventTag, label: eventTag }))]"
      />
      <AppSelect
        v-model="yearFilter"
        icon="i-lucide-calendar"
        size="sm"
        variant="filter"
        aria-label="Filtrer par année"
        :options="[{ value: 'ALL', label: 'Toutes les années' }, ...yearOptions.map(year => ({ value: year, label: year }))]"
      />
    </div>

    <div
      v-if="!pending && images.length === 0"
      class="album-card surface-solid clip-corner-sm text-center text-muted"
    >
      La galerie sera bientôt alimentée par les médias du club.
    </div>

    <div
      v-if="!pending && filteredImages.length"
      class="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
    >
      <article
        v-for="image in paginatedImages"
        :key="image.id"
        class="album-card surface-solid clip-corner-sm"
      >
        <YoutubeEmbed
          v-if="image.mediaType === 'YOUTUBE_VIDEO' && image.youtubeId"
          :video-id="image.youtubeId"
          :title="image.title || 'Vidéo du Club Otaku'"
          class="album-card__cover"
        />
        <VideoEmbed
          v-else-if="image.mediaType === 'VIDEO'"
          :url="image.url"
          :source-url="image.sourceUrl || undefined"
          :title="image.title || 'Vidéo du Club Otaku'"
          class="album-card__cover"
        />
        <button v-else type="button" class="gallery-image-button" @click="openImagePreview(image.url)">
          <img :src="image.url" :alt="image.title || 'Média du Club Otaku'" class="album-card__cover" loading="lazy">
        </button>
        <div class="mt-4 flex items-center justify-between gap-3">
          <div
            class="text-lg font-semibold"
            style="color: var(--text-color);"
          >
            {{ image.title || 'Média du Club Otaku' }}
          </div>
          <UBadge
            v-if="image.eventTag || image.category"
            color="primary"
            variant="soft"
          >
            {{ image.eventTag || image.category }}
          </UBadge>
        </div>
        <p
          v-if="image.eventDate"
          class="mt-2 text-xs text-muted"
        >
          {{ new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(image.eventDate)) }}
        </p>
      </article>
    </div>
    <AppPagination
      :current-page="currentPage"
      :total-pages="totalPages"
      :item-count="filteredImages.length"
      item-label="média"
      @page-change="(page) => (currentPage = page)"
    />
    <div
      v-if="!pending && filteredImages.length === 0 && images.length > 0"
      class="album-card surface-solid clip-corner-sm text-center text-muted"
    >
      Aucun média ne correspond à ce filtre.
    </div>
  </div>
  <UModal v-model:open="imagePreviewOpen" title="Image de la galerie" :ui="{ content: 'event-image-modal max-w-6xl' }">
    <template #body>
      <img v-if="imagePreviewUrl" :src="imagePreviewUrl" alt="Image agrandie de la galerie" class="gallery-image-preview">
    </template>
  </UModal>
</template>

<style scoped>
.album-card {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding: 1rem;
  overflow: hidden;
  transition: transform 0.2s ease;
}

.gallery-filter {
  border: 1px solid var(--border-color);
  border-radius: 9999px;
  padding: 0.4rem 0.9rem;
  color: var(--text-color);
  background: transparent;
}

.gallery-filter--active {
  color: var(--bg-color);
  background: var(--primary-color);
  border-color: var(--primary-color);
}

.album-card:hover {
  transform: translateY(-3px);
}

.album-card__cover {
  display: block;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  height: 13rem;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border-radius: 0.85rem;
  background: linear-gradient(135deg, rgba(var(--primary-color-rgb), 0.25), rgba(var(--accent-color-rgb), 0.2));
}

.gallery-image-button {
  display: block;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  cursor: zoom-in;
  border: 0;
  padding: 0;
  background: transparent;
}

.gallery-image-preview {
  display: block;
  max-height: 80vh;
  width: 100%;
  object-fit: contain;
}

.gallery-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 1.5rem;
  color: var(--muted-color);
}
</style>
