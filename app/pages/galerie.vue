<script setup lang="ts">
import { media, type MediaAsset } from '../data/media'

type MediaFilter = 'all' | 'photo' | 'video'

const activeFilter = ref<MediaFilter>('all')
const selectedMedia = ref<MediaAsset | null>(null)

const filteredMedia = computed(() => activeFilter.value === 'all'
  ? media
  : media.filter(asset => asset.type === activeFilter.value))

const photoCount = computed(() => media.filter(asset => asset.type === 'photo').length)
const videoCount = computed(() => media.filter(asset => asset.type === 'video').length)

function openMedia(asset: MediaAsset) {
  selectedMedia.value = asset
}

function closeMedia() {
  selectedMedia.value = null
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeMedia()
}

function captionFor(asset: MediaAsset, index: number) {
  if (asset.caption) return asset.caption
  const position = String(index + 1).padStart(2, '0')
  return `${asset.type === 'photo' ? 'Souvenir photo' : 'Instant vidéo'} ${position}`
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))

useHead({
  title: 'Galerie • Osnella Sènami',
  meta: [{ name: 'description', content: 'Photos et vidéos des souvenirs d’Osnella Sènami.' }]
})
</script>

<template>
  <main class="theme-page gallery-page">
    <header class="gallery-header">
      <p class="gallery-eyebrow">Les souvenirs en images</p>
      <h1>La galerie d’Osnella Sènami</h1>
      <p class="gallery-intro">Des petits instants à revoir, à garder et à célébrer.</p>

      <div class="gallery-counts" aria-label="Contenu de la galerie">
        <span><strong>{{ photoCount }}</strong> photos</span>
        <span aria-hidden="true">·</span>
        <span><strong>{{ videoCount }}</strong> vidéos</span>
      </div>
    </header>

    <section class="gallery-content" aria-label="Médias">
      <div class="gallery-toolbar">
        <div class="gallery-filters" role="group" aria-label="Filtrer les médias">
          <button
            v-for="filter in [
              { id: 'all', label: 'Tout', count: media.length },
              { id: 'photo', label: 'Photos', count: photoCount },
              { id: 'video', label: 'Vidéos', count: videoCount }
            ]"
            :key="filter.id"
            type="button"
            :aria-pressed="activeFilter === filter.id"
            :class="{ 'is-active': activeFilter === filter.id }"
            @click="activeFilter = filter.id as MediaFilter"
          >
            {{ filter.label }} <span>{{ filter.count }}</span>
          </button>
        </div>
      </div>

      <div v-if="filteredMedia.length" class="gallery-grid">
        <article v-for="(asset, index) in filteredMedia" :key="asset.id" class="gallery-item">
          <button
            v-if="asset.type === 'photo'"
            type="button"
            class="gallery-photo-button"
            :aria-label="`Ouvrir ${captionFor(asset, index)}`"
            @click="openMedia(asset)"
          >
            <NuxtImg
              :src="asset.src"
              :alt="captionFor(asset, index)"
              :width="asset.width ?? 720"
              :height="asset.height ?? 1280"
              loading="lazy"
              sizes="640:100vw 1024:50vw 1920:33vw"
            />
            <span class="gallery-open-hint"><UIcon name="i-lucide-expand" /> Agrandir</span>
          </button>

          <div v-else class="gallery-video-preview">
            <VideoPlayer
              :src="asset.src"
              :poster="asset.poster"
              :label="captionFor(asset, index)"
            />
          </div>

          <div class="gallery-caption">
            <div>
              <p>{{ captionFor(asset, index) }}</p>
              <span>{{ asset.type === 'photo' ? 'Photo' : 'Vidéo' }}</span>
            </div>
          </div>
        </article>
      </div>

      <div v-else class="gallery-empty">
        <UIcon name="i-lucide-images" />
        <p>Aucun média dans cette catégorie pour le moment.</p>
      </div>
    </section>

    <Teleport to="body">
      <div v-if="selectedMedia" class="gallery-lightbox" @click.self="closeMedia">
        <section class="gallery-lightbox__panel" role="dialog" aria-modal="true" :aria-label="captionFor(selectedMedia, 0)">
          <button type="button" class="gallery-lightbox__close" aria-label="Fermer l’aperçu" @click="closeMedia">
            <UIcon name="i-lucide-x" />
          </button>
          <NuxtImg
            v-if="selectedMedia.type === 'photo'"
            :src="selectedMedia.src"
            :alt="captionFor(selectedMedia, 0)"
            :width="selectedMedia.width ?? 720"
            :height="selectedMedia.height ?? 1280"
            sizes="1024:100vw 1920:80vw"
          />
          <VideoPlayer
            v-else
            :src="selectedMedia.src"
            :poster="selectedMedia.poster"
            autoplay
            :label="captionFor(selectedMedia, 0)"
          />
          <p>{{ selectedMedia.caption || selectedMedia.file }}</p>
        </section>
      </div>
    </Teleport>
  </main>
</template>

<style scoped>
.gallery-page {
  min-height: 100vh;
  padding: 3.5rem max(1rem, calc((100vw - 72rem) / 2)) 7rem;
}

.gallery-header {
  max-width: 48rem;
  margin: 0 auto 2.5rem;
  text-align: center;
}

.gallery-eyebrow {
  color: var(--accent-color);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.gallery-header h1 {
  margin-top: 0.9rem;
  color: var(--text-color);
  font-family: var(--font-display);
  font-size: 2.8rem;
  line-height: 1.08;
}

.gallery-intro {
  margin-top: 0.8rem;
  color: var(--muted-color);
  line-height: 1.7;
}

.gallery-counts {
  display: flex;
  justify-content: center;
  gap: 0.55rem;
  margin-top: 1.25rem;
  color: var(--muted-color);
  font-size: 0.82rem;
}

.gallery-counts strong {
  color: var(--primary-color);
}

.gallery-content {
  max-width: 72rem;
  margin: 0 auto;
}

.gallery-toolbar {
  display: flex;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.gallery-filters {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.3rem;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--panel-color);
}

.gallery-filters button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.5rem;
  padding: 0.45rem 0.9rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--muted-color);
  cursor: pointer;
  transition: background-color 200ms ease, color 200ms ease;
}

.gallery-filters button.is-active {
  background: var(--primary-color);
  color: #fff;
}

.gallery-filters span {
  font-size: 0.7rem;
  opacity: 0.75;
}

.gallery-grid {
  columns: 2;
  column-gap: 1rem;
}

.gallery-item {
  break-inside: avoid;
  overflow: hidden;
  margin: 0 0 1rem;
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: var(--panel-color);
  box-shadow: 0 16px 38px -30px rgba(37, 24, 49, 0.6);
  animation: gallery-arrive 500ms both;
}

.gallery-photo-button,
.gallery-video-preview {
  position: relative;
  display: block;
  width: 100%;
  overflow: hidden;
  border: 0;
  background: var(--bg-color-soft);
  cursor: pointer;
}

.gallery-photo-button img,
.gallery-video-preview :deep(.video-player) {
  display: block;
  width: 100%;
  height: auto;
  max-height: 36rem;
  object-fit: cover;
}

.gallery-video-preview :deep(.video-player) {
  aspect-ratio: 9 / 16;
}

.gallery-open-hint {
  position: absolute;
  right: 0.7rem;
  bottom: 0.7rem;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.65rem;
  border-radius: 999px;
  background: rgba(22, 14, 31, 0.72);
  color: white;
  font-size: 0.7rem;
  opacity: 0;
  transition: opacity 180ms ease;
}

.gallery-open-hint :deep(svg),
.gallery-lightbox__close :deep(svg) {
  width: 1rem;
  height: 1rem;
}

.gallery-photo-button:hover .gallery-open-hint,
.gallery-photo-button:focus-visible .gallery-open-hint {
  opacity: 1;
}

.gallery-caption {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.8rem 0.9rem;
}

.gallery-caption p {
  color: var(--text-color);
  font-size: 0.85rem;
  font-weight: 650;
}

.gallery-caption span {
  display: block;
  margin-top: 0.2rem;
  color: var(--muted-color);
  font-size: 0.7rem;
}

.gallery-lightbox__close {
  display: grid;
  flex: 0 0 auto;
  width: 2.5rem;
  height: 2.5rem;
  place-items: center;
  border: 1px solid var(--border-color);
  border-radius: 50%;
  background: var(--panel-color-solid);
  color: var(--text-color);
  cursor: pointer;
}

.gallery-empty {
  display: grid;
  min-height: 15rem;
  place-content: center;
  justify-items: center;
  gap: 1rem;
  color: var(--muted-color);
  text-align: center;
}

.gallery-empty :deep(svg) {
  width: 2rem;
  height: 2rem;
  color: var(--accent-color);
}

.gallery-lightbox {
  position: fixed;
  z-index: 200;
  inset: 0;
  display: grid;
  place-items: center;
  padding: max(1rem, env(safe-area-inset-top)) 1rem max(1rem, env(safe-area-inset-bottom));
  background: rgba(15, 10, 20, 0.88);
  backdrop-filter: blur(12px);
}

.gallery-lightbox__panel {
  position: relative;
  display: grid;
  max-width: min(100%, 70rem);
  max-height: 100%;
  justify-items: center;
  gap: 0.75rem;
  padding: 0.7rem;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 1rem;
  background: rgba(28, 20, 36, 0.96);
  color: white;
}

.gallery-lightbox__panel img,
.gallery-lightbox__panel video {
  display: block;
  max-width: 100%;
  max-height: calc(100dvh - 6rem);
  object-fit: contain;
}

.gallery-lightbox__panel p {
  max-width: 100%;
  overflow-wrap: anywhere;
  color: rgba(255, 255, 255, 0.82);
  font-size: 0.8rem;
}

.gallery-lightbox__close {
  position: absolute;
  z-index: 1;
  top: 1rem;
  right: 1rem;
}

@keyframes gallery-arrive {
  from { opacity: 0; transform: translateY(0.8rem); }
  to { opacity: 1; transform: translateY(0); }
}

@media (min-width: 640px) {
  .gallery-grid { columns: 3; }
}

@media (min-width: 1024px) {
  .gallery-grid { columns: 4; }
}

@media (max-width: 420px) {
  .gallery-page { padding-right: 0.75rem; padding-left: 0.75rem; }
  .gallery-header h1 { font-size: 2.25rem; }
  .gallery-grid { column-gap: 0.65rem; }
  .gallery-item { margin-bottom: 0.65rem; border-radius: 0.75rem; }
  .gallery-caption { padding: 0.65rem; }
}

@media (prefers-reduced-motion: reduce) {
  .gallery-item { animation: none; }
  .gallery-filters button,
  .gallery-open-hint { transition: none; }
}
</style>
