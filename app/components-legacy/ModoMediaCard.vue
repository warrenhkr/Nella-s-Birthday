<script setup lang="ts">
type ModoStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FLAGGED'
type MediaSource = 'CLOUDINARY' | 'DIRECT' | 'YOUTUBE' | 'TERABOX'
type ModoAction = 'approve' | 'reject' | 'flag' | 'remove'

type MediaItem = {
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

const props = withDefaults(defineProps<{
  media: MediaItem
  view?: 'grid' | 'list'
  busyAction?: ModoAction | null
}>(), { view: 'grid', busyAction: null })

const emit = defineEmits<{
  approve: [media: MediaItem]
  reject: [media: MediaItem]
  flag: [media: MediaItem]
  remove: [media: MediaItem]
}>()

const isBusy = computed(() => props.busyAction !== null)
const previewOpen = ref(false)

function openPreview() {
  if (props.media.isVideo) return
  previewOpen.value = true
}
</script>

<template>
  <article
    class="modo-media surface-solid"
    :class="[`modo-media--${view}`, { 'modo-media--busy': isBusy }]"
  >
    <div class="modo-media__thumb">
      <VideoEmbed
        v-if="media.isVideo"
        :url="media.url"
        :source-url="media.url"
        :title="media.title"
        :poster-url="media.thumbUrl || undefined"
        preload="metadata"
        class="modo-media__video"
      />
      <button
        v-else-if="media.thumbUrl"
        type="button"
        class="modo-media__image-trigger"
        :aria-label="`Afficher ${media.title} en grand écran`"
        @click="openPreview"
      >
        <img
          :src="media.thumbUrl"
          :alt="media.title"
          loading="lazy"
          class="modo-media__img"
        >
      </button>
      <div
        v-else
        class="modo-media__placeholder"
        aria-hidden="true"
      >
        <UIcon name="i-lucide-film" />
        <span>{{ media.typeLabel }}</span>
      </div>
      <span
        v-if="media.isVideo && media.thumbUrl"
        class="modo-media__play"
        aria-hidden="true"
      >
        <UIcon name="i-lucide-play" />
      </span>
    </div>

    <UModal
      v-if="!media.isVideo"
      v-model:open="previewOpen"
      :title="media.title || 'Image de la galerie'"
      :ui="{ content: 'event-image-modal max-w-6xl' }"
    >
      <template #body>
        <img
          :src="media.url"
          :alt="media.title || 'Image agrandie de la galerie'"
          class="modo-media__preview-img"
        >
      </template>
    </UModal>

    <div class="modo-media__body">
      <h3 class="modo-media__title">
        {{ media.title }}
      </h3>

      <div class="modo-media__badges">
        <UBadge
          color="neutral"
          variant="soft"
          size="sm"
          :icon="media.isVideo ? 'i-lucide-video' : 'i-lucide-image'"
        >
          {{ media.typeLabel }}
        </UBadge>
        <UBadge
          color="neutral"
          variant="soft"
          size="sm"
          icon="i-lucide-database"
        >
          {{ media.sourceLabel }}
        </UBadge>
        <ModoStatusBadge
          :status="media.status"
          size="sm"
        />
      </div>

      <p class="modo-media__meta">
        <span class="modo-media__meta-item">
          <UIcon
            name="i-lucide-calendar"
            aria-hidden="true"
          />
          {{ media.eventLabel }}
        </span>
        <span class="modo-media__meta-item">
          <UIcon
            name="i-lucide-clock"
            aria-hidden="true"
          />
          {{ media.dateLabel }}
        </span>
      </p>

      <div class="modo-media__actions">
        <UButton
          size="xs"
          color="success"
          variant="soft"
          icon="i-lucide-check"
          label="Approuver"
          :disabled="isBusy || media.status === 'APPROVED'"
          :loading="busyAction === 'approve'"
          @click="emit('approve', media)"
        />
        <UButton
          size="xs"
          color="error"
          variant="soft"
          icon="i-lucide-x"
          label="Rejeter"
          :disabled="isBusy || media.status === 'REJECTED'"
          :loading="busyAction === 'reject'"
          @click="emit('reject', media)"
        />
        <UButton
          size="xs"
          color="warning"
          variant="soft"
          :icon="media.status === 'FLAGGED' ? 'i-lucide-flag-off' : 'i-lucide-flag'"
          :label="media.status === 'FLAGGED' ? 'Retirer le signalement' : 'Signaler'"
          :disabled="isBusy"
          :loading="busyAction === 'flag'"
          @click="emit('flag', media)"
        />
        <UButton
          v-if="media.isVideo"
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-external-link"
          label="Ouvrir"
          :href="media.url"
          target="_blank"
          rel="noopener noreferrer"
        />
        <UButton
          size="xs"
          color="error"
          variant="ghost"
          icon="i-lucide-trash-2"
          label="Retirer"
          :disabled="isBusy"
          :loading="busyAction === 'remove'"
          @click="emit('remove', media)"
        />
      </div>
    </div>
  </article>
</template>

<style scoped>
.modo-media {
  display: flex;
  min-width: 0;
  overflow: hidden;
  transition: border-color 0.18s ease, opacity 0.18s ease, transform 0.18s ease;
}

.modo-media--busy {
  opacity: 0.62;
  pointer-events: none;
}

/* Grille : aperçu en haut, contenu en dessous. */
.modo-media--grid {
  flex-direction: column;
}

.modo-media--grid .modo-media__thumb {
  aspect-ratio: 16 / 10;
  width: 100%;
}

/* Liste : aperçu à gauche, contenu à droite (lisible sur large écran). */
.modo-media--list {
  flex-direction: row;
}

.modo-media--list .modo-media__thumb {
  width: 12rem;
  flex: 0 0 12rem;
}

.modo-media__thumb {
  position: relative;
  overflow: hidden;
  background: rgba(var(--primary-color-rgb), 0.08);
  border-bottom: 1px solid var(--border-color);
}

.modo-media--list .modo-media__thumb {
  border-bottom: none;
  border-right: 1px solid var(--border-color);
}

.modo-media__image-trigger {
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: zoom-in;
}

.modo-media__image-trigger:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}

.modo-media__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.modo-media__preview-img {
  display: block;
  max-width: min(74vw, 960px);
  max-height: min(72vh, 720px);
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: var(--radius-md);
  background: var(--background-color);
}

.modo-media__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  width: 100%;
  height: 100%;
  min-height: 8rem;
  color: var(--muted-color);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.modo-media__placeholder :deep(svg),
.modo-media__placeholder :deep(.iconify) {
  font-size: 2rem;
  color: var(--primary-color);
}

.modo-media__play {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-color);
  background: rgba(0, 0, 0, 0.32);
  font-size: 2rem;
}

.modo-media__body {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  min-width: 0;
  padding: 0.9rem;
}

.modo-media__title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-color);
  overflow-wrap: anywhere;
}

.modo-media__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.modo-media__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.9rem;
  font-size: 0.75rem;
  color: var(--muted-color);
}

.modo-media__meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-width: 0;
}

.modo-media__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: auto;
  padding-top: 0.35rem;
}

@media (max-width: 560px) {
  .modo-media--list {
    flex-direction: column;
  }

  .modo-media--list .modo-media__thumb {
    width: 100%;
    flex-basis: auto;
    aspect-ratio: 16 / 10;
    border-right: none;
    border-bottom: 1px solid var(--border-color);
  }
}
</style>
