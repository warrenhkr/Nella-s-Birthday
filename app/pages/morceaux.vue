<script setup lang="ts">
type Track = {
  title: string
  artist?: string
  spotifyId: string
  cover: string
}

const tracks = ref<Track[]>([
  {
    title: 'MINIMUM',
    artist: 'SK07, Depelym',
    spotifyId: '5FGx7yCMBzTsI2a73sQGJd',
    cover: 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02d6803e53897d10cee9d432da'
  },
  {
    title: 'Caméléon',
    artist: 'Tiakola',
    spotifyId: '2zi3rXvURh2kGUBKC3TBN0',
    cover: 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02df0dc3baa35a92fc787e6e33'
  },
  {
    title: 'Jet Lag',
    artist: 'Tiakola',
    spotifyId: '5CYfZNnRoSRzMwaLyl4ey1',
    cover: 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02df0dc3baa35a92fc787e6e33'
  },
  {
    title: 'Best',
    artist: 'Tiakola feat. Rema',
    spotifyId: '2oVib8c5Z46aiAwNj8Vcbq',
    cover: 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02df0dc3baa35a92fc787e6e33'
  },
  {
    title: 'TONY MONTANA',
    artist: 'El Mvnolo',
    spotifyId: '2Y8yw5DNguXsFjmLeI2XGu',
    cover: 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02ab2ebab1cf150c913f9dcfa1'
  },
  {
    title: 'Charm',
    artist: 'Rema',
    spotifyId: '1iBWjQ9af9NnUd5xnQDB3k',
    cover: 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02963265801aa5c9740ad159b7'
  },
  {
    title: 'Grand bain',
    artist: 'Ninho et Dadju',
    spotifyId: '0NNORwl6Oyqvya5SeIBXt8',
    cover: 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e0273d89ce0b57be1bd78073494'
  },
  {
    title: 'Doucement',
    artist: 'Fally et Joé',
    spotifyId: '7uI5NaK5Q3S8wWO8cl5yjK',
    cover: 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e0211776a43f15f712fdda0d6f8'
  },
  {
    title: 'Free Mind',
    artist: 'Tems',
    spotifyId: '2mzM4Y0Rnx2BDZqRnhQ5Q6',
    cover: 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e020ab4d3e1c0b5c5e453287a4c'
  },
  {
    title: 'Piano',
    artist: 'Werenoi feat. Gims',
    spotifyId: '3esy9uZfjvqBK76Uomxaqw',
    cover: 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02cf93822043c831857ed3b6b4'
  },
  {
    title: 'Shawty',
    artist: 'Ronisia feat. LaMano',
    spotifyId: '3nkVSeaL5M6II2uHQHRuYM',
    cover: 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02ccf06da6556f90e6e48e6f9f'
  },
  {
    title: 'MON BÉBÉ',
    artist: 'RnBoi feat. Ayra Starr',
    spotifyId: '4mfloKPJmGAOkTxCxQPujM',
    cover: 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e023174b0e35155c61e7b02a0c4'
  },
  {
    title: 'Honey Honey',
    spotifyId: '1NX7EOqKo7KW3YmquIAa29',
    cover: 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02d1bd4b6feb5686af252f22aa'
  },
  {
    title: 'Macarena',
    artist: 'Damso',
    spotifyId: '2ewjMyCbNv2X1dB2qIDCwD',
    cover: 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02d8ab9910c70f649f1498ff61'
  }
])
const isAddDialogOpen = ref(false)
const isSubmitting = ref(false)
const spotifyUrl = ref('')
const addError = ref('')
const loadError = ref('')

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = error.data
    if (typeof data === 'object' && data !== null && 'statusMessage' in data && typeof data.statusMessage === 'string') {
      return data.statusMessage
    }
  }

  return error instanceof Error ? error.message : fallback
}

async function loadSharedTracks() {
  try {
    const response = await $fetch<{ tracks: Track[] }>('/api/shared-songs')
    const existingIds = new Set(tracks.value.map(track => track.spotifyId))
    tracks.value.push(...response.tracks.filter(track => !existingIds.has(track.spotifyId)))
  } catch (error) {
    loadError.value = getErrorMessage(error, 'Les chansons partagées sont momentanément indisponibles.')
  }
}

function openAddDialog() {
  addError.value = ''
  isAddDialogOpen.value = true
}

function closeAddDialog() {
  if (isSubmitting.value) return
  isAddDialogOpen.value = false
}

async function addTrack() {
  if (isSubmitting.value) return

  isSubmitting.value = true
  addError.value = ''

  try {
    const response = await $fetch<{ track: Track, alreadyExists: boolean }>('/api/shared-songs', {
      method: 'POST',
      body: { url: spotifyUrl.value }
    })

    if (response.alreadyExists) {
      addError.value = 'Cette chanson est déjà dans la liste partagée.'
      return
    }

    if (!tracks.value.some(track => track.spotifyId === response.track.spotifyId)) {
      tracks.value.unshift(response.track)
    }

    spotifyUrl.value = ''
    isAddDialogOpen.value = false
    loadError.value = ''
  } catch (error) {
    addError.value = getErrorMessage(error, 'Impossible d’ajouter cette chanson. Réessaie.')
  } finally {
    isSubmitting.value = false
  }
}

onMounted(() => {
  void loadSharedTracks()
})

useHead({
  title: 'Tes chansons • Osnella Sènami',
  meta: [{ name: 'description', content: 'La bande-son d’Osnella Sènami : quelques chansons à écouter sur Spotify.' }]
})
</script>

<template>
  <main class="theme-page tracks-page">
    <header class="tracks-header">
      <p class="tracks-eyebrow">
        Ta bande-son
      </p>
      <h1>Tes <span>chansons</span></h1>
      <p class="tracks-note">
        Un clic sur une carte ouvre la chanson complète dans Spotify.
      </p>
      <p
        v-if="loadError"
        class="tracks-message"
        role="status"
      >
        {{ loadError }}
      </p>
    </header>

    <section
      class="tracks-grid"
      aria-label="Chansons à écouter"
    >
      <a
        v-for="track in tracks"
        :key="track.spotifyId"
        class="track-card"
        :href="`https://open.spotify.com/track/${track.spotifyId}`"
        target="_blank"
        rel="noopener noreferrer"
        :aria-label="`Écouter ${track.title}${track.artist ? ` de ${track.artist}` : ''} sur Spotify`"
      >
        <div
          class="track-artwork"
        >
          <img
            class="track-cover"
            :src="track.cover"
            :alt="`Pochette de ${track.title}`"
            loading="lazy"
            width="300"
            height="300"
          >
          <span
            class="track-artwork__play"
            aria-hidden="true"
          >
            <UIcon name="i-lucide-play" />
          </span>
        </div>
        <span class="track-title">{{ track.title }}</span>
        <span
          v-if="track.artist"
          class="track-artist"
        >
          {{ track.artist }}
        </span>
        <span class="track-link">
          Ouvrir dans Spotify
          <UIcon name="i-lucide-arrow-up-right" />
        </span>
      </a>
      <button
        class="track-card track-card--add"
        type="button"
        @click="openAddDialog"
      >
        <span class="track-artwork track-artwork--add">
          <UIcon
            name="i-lucide-plus"
            aria-hidden="true"
          />
        </span>
        <span class="track-title">Ajouter une chanson</span>
        <span class="track-artist">Colle un lien Spotify</span>
        <span class="track-link">Ajouter à la liste partagée</span>
      </button>
    </section>

    <Teleport to="body">
      <div
        v-if="isAddDialogOpen"
        class="track-dialog"
        @click.self="closeAddDialog"
      >
        <section
          class="track-dialog__panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-track-title"
        >
          <button
            class="track-dialog__close"
            type="button"
            aria-label="Fermer"
            :disabled="isSubmitting"
            @click="closeAddDialog"
          >
            <UIcon name="i-lucide-x" />
          </button>
          <p class="tracks-eyebrow">
            À toi de choisir
          </p>
          <h2 id="add-track-title">
            Ajouter une chanson
          </h2>
          <p class="track-dialog__description">
            Colle un lien Spotify. Sa pochette et ses informations apparaîtront dans la liste pour tous.
          </p>
          <form
            class="track-form"
            @submit.prevent="addTrack"
          >
            <label for="spotify-track-url">Lien Spotify de la chanson</label>
            <input
              id="spotify-track-url"
              v-model="spotifyUrl"
              type="url"
              inputmode="url"
              autocomplete="url"
              placeholder="https://open.spotify.com/track/…"
              required
            >
            <p
              v-if="addError"
              class="track-form__error"
              role="alert"
            >
              {{ addError }}
            </p>
            <div class="track-form__actions">
              <button
                class="track-form__cancel"
                type="button"
                :disabled="isSubmitting"
                @click="closeAddDialog"
              >
                Annuler
              </button>
              <button
                class="track-form__submit"
                type="submit"
                :disabled="isSubmitting"
              >
                <UIcon
                  v-if="isSubmitting"
                  name="i-lucide-loader-circle"
                  class="track-form__spinner"
                  aria-hidden="true"
                />
                {{ isSubmitting ? 'Ajout…' : 'Ajouter' }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </Teleport>
  </main>
</template>

<style scoped>
.tracks-page {
  min-height: 100vh;
  padding: 4.5rem max(1rem, calc((100vw - 72rem) / 2)) 7rem;
}

.tracks-header {
  margin: 0 auto 3rem;
  text-align: center;
}

.tracks-eyebrow {
  color: var(--accent-color);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.3em;
  text-transform: uppercase;
}

.tracks-header h1 {
  margin-top: 0.65rem;
  color: var(--text-color);
  font-family: var(--font-display);
  font-size: clamp(2.6rem, 6vw, 3.5rem);
  line-height: 1.1;
}

.tracks-header h1 span {
  color: var(--primary-color);
  font-style: italic;
}

.tracks-note {
  display: inline-block;
  margin-top: 1.6rem;
  padding: 0.55rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  color: var(--muted-color);
  font-size: 0.82rem;
}

.tracks-message {
  margin: 1rem auto 0;
  color: var(--muted-color);
  font-size: 0.82rem;
}

.tracks-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2rem 1.25rem;
  max-width: 72rem;
  margin: 0 auto;
}

.track-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  color: inherit;
  text-decoration: none;
}

.track-card--add {
  padding: 0;
  border: 0;
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.track-artwork {
  position: relative;
  display: grid;
  aspect-ratio: 1;
  overflow: hidden;
  place-items: center;
  border-radius: 0.7rem;
  background: #30262e;
  box-shadow: 0 1rem 2rem -1.4rem rgba(14, 8, 18, 0.8);
  isolation: isolate;
  transition: transform 220ms ease, box-shadow 220ms ease;
}

.track-artwork--add {
  border: 1px dashed var(--border-color);
  background: color-mix(in srgb, var(--panel-color-solid) 84%, var(--primary-color));
  color: var(--primary-color);
  transition: border-color 220ms ease, transform 220ms ease, box-shadow 220ms ease;
}

.track-artwork--add :deep(svg) {
  width: 3rem;
  height: 3rem;
  stroke-width: 1.5;
}

.track-cover {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.track-artwork__play {
  position: absolute;
  right: 1rem;
  bottom: 1rem;
  display: grid;
  width: 2.8rem;
  height: 2.8rem;
  place-items: center;
  border-radius: 50%;
  background: #1ed760;
  color: #111;
  opacity: 0;
  transform: translateY(0.4rem);
  transition: opacity 180ms ease, transform 180ms ease;
}

.track-artwork__play :deep(svg) {
  width: 1.15rem;
  height: 1.15rem;
  fill: currentColor;
}

.track-title {
  margin-top: 0.65rem;
  color: var(--text-color);
  font-size: 0.9rem;
  font-weight: 700;
}

.track-artist,
.track-link {
  margin-top: 0.35rem;
  color: var(--muted-color);
  font-size: 0.76rem;
}

.track-link {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.7rem;
}

.track-link :deep(svg) {
  width: 0.85rem;
  height: 0.85rem;
}

.track-card:hover .track-artwork,
.track-card:focus-visible .track-artwork {
  box-shadow: 0 1.2rem 2.2rem -1.2rem rgba(14, 8, 18, 0.9);
  transform: translateY(-0.25rem);
}

.track-card--add:hover .track-artwork--add,
.track-card--add:focus-visible .track-artwork--add {
  border-color: var(--primary-color);
}

.track-card:hover .track-artwork__play,
.track-card:focus-visible .track-artwork__play {
  opacity: 1;
  transform: translateY(0);
}

.track-card:focus-visible {
  border-radius: 0.75rem;
  outline: 2px solid var(--primary-color);
  outline-offset: 0.35rem;
}

.track-dialog {
  position: fixed;
  z-index: 200;
  inset: 0;
  display: grid;
  padding: 1rem;
  place-items: center;
  background: rgba(18, 13, 21, 0.62);
  backdrop-filter: blur(8px);
}

.track-dialog__panel {
  position: relative;
  width: min(100%, 30rem);
  padding: 2rem;
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: var(--panel-color-solid);
  box-shadow: 0 1.5rem 4rem rgba(14, 8, 18, 0.28);
}

.track-dialog__close {
  position: absolute;
  top: 0.85rem;
  right: 0.85rem;
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--muted-color);
  cursor: pointer;
}

.track-dialog__close:hover {
  background: color-mix(in srgb, var(--primary-color) 10%, transparent);
  color: var(--primary-color);
}

.track-dialog__panel h2 {
  margin-top: 0.4rem;
  color: var(--text-color);
  font-family: var(--font-display);
  font-size: 1.65rem;
}

.track-dialog__description {
  margin-top: 0.5rem;
  color: var(--muted-color);
  font-size: 0.88rem;
  line-height: 1.55;
}

.track-form {
  display: grid;
  gap: 0.7rem;
  margin-top: 1.5rem;
}

.track-form label {
  color: var(--text-color);
  font-size: 0.82rem;
  font-weight: 700;
}

.track-form input {
  width: 100%;
  padding: 0.8rem 0.9rem;
  border: 1px solid var(--border-color);
  border-radius: 0.55rem;
  outline: none;
  background: var(--panel-color-solid);
  color: var(--text-color);
}

.track-form input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-color) 16%, transparent);
}

.track-form__error {
  color: #b42318;
  font-size: 0.82rem;
}

.track-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.65rem;
  margin-top: 0.5rem;
}

.track-form__actions button {
  display: inline-flex;
  min-height: 2.6rem;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.55rem 1rem;
  border-radius: 999px;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 700;
  cursor: pointer;
}

.track-form__actions button:disabled {
  cursor: wait;
  opacity: 0.65;
}

.track-form__cancel {
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-color);
}

.track-form__submit {
  border: 1px solid var(--primary-color);
  background: var(--primary-color);
  color: white;
}

.track-form__spinner {
  animation: track-spin 1s linear infinite;
}

@keyframes track-spin {
  to { transform: rotate(360deg); }
}

@media (min-width: 640px) {
  .tracks-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 1.75rem;
  }
}

@media (min-width: 900px) {
  .tracks-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    column-gap: 2.25rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .track-artwork,
  .track-artwork__play,
  .track-artwork--add {
    transition: none;
  }

  .track-form__spinner {
    animation: none;
  }
}
</style>
