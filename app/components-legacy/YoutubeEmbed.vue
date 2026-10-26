<script setup lang="ts">
declare global {
  interface Window {
    YT?: {
      Player: new (element: HTMLElement, options: Record<string, any>) => any
      PlayerState: {
        PLAYING: number
      }
    }
  }
}

const props = defineProps<{
  videoId: string
  title?: string
}>()

const active = ref(false)
const isPlaying = ref(false)
const isMuted = ref(false)
const captionsEnabled = ref(true)
const quality = ref<string>('auto')
const playerContainer = ref<HTMLElement | null>(null)
const playerRef = ref<any>(null)
const currentTime = ref(0)
const duration = ref(0)
const isFullscreen = ref(false)

const thumbnailUrl = computed(() => `https://i.ytimg.com/vi/${encodeURIComponent(props.videoId)}/hqdefault.jpg`)
const qualityOptions = [
  { label: 'Auto', value: 'auto' },
  { label: '1080p', value: 'hd1080' },
  { label: '720p', value: 'hd720' },
  { label: 'Large', value: 'large' },
  { label: 'Moyen', value: 'medium' },
  { label: 'Petit', value: 'small' }
] as const

function formatTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0:00'
  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function ensureYoutubeApi(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve()
    if (window.YT && window.YT.Player) return resolve()

    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]')
    if (existing) {
      const timer = window.setInterval(() => {
        if (window.YT && window.YT.Player) {
          window.clearInterval(timer)
          resolve()
        }
      }, 200)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    const onReady = () => resolve()
    ;(window as any).onYouTubeIframeAPIReady = () => {
      onReady()
    }
    document.head.appendChild(script)
  })
}

async function initializePlayer() {
  if (!playerContainer.value || playerRef.value) return
  await ensureYoutubeApi()

  if (!window.YT || !window.YT.Player) return

  const currentQuality = quality.value === 'auto' ? 'default' : quality.value
  playerRef.value = new window.YT.Player(playerContainer.value, {
    videoId: props.videoId,
    playerVars: {
      autoplay: 1,
      rel: 0,
      playsinline: 1,
      modestbranding: 1,
      controls: 1,
      cc_load_policy: captionsEnabled.value ? 1 : 0,
      cc_lang_pref: 'fr',
      iv_load_policy: 3,
      fs: 1,
      hl: 'fr',
      origin: window.location.origin
    },
    events: {
      onReady: (event: any) => {
        isPlaying.value = true
        isMuted.value = event.target.isMuted()
        duration.value = event.target.getDuration?.() || 0
        currentTime.value = event.target.getCurrentTime?.() || 0
        if (currentQuality && typeof event.target.setPlaybackQuality === 'function') {
          event.target.setPlaybackQuality(currentQuality)
        }
      },
      onStateChange: (event: any) => {
        const state = event.data
        const playerState = window.YT?.PlayerState
        isPlaying.value = state === playerState?.PLAYING
        if (typeof event.target.getCurrentTime === 'function') {
          currentTime.value = event.target.getCurrentTime()
        }
        if (typeof event.target.getDuration === 'function') {
          duration.value = event.target.getDuration()
        }
      }
    }
  })
}

async function activatePlayer() {
  active.value = true
  await nextTick()
  await initializePlayer()
}

function togglePlay() {
  if (!playerRef.value) return

  if (isPlaying.value) {
    playerRef.value.pauseVideo()
    isPlaying.value = false
  } else {
    playerRef.value.playVideo()
    isPlaying.value = true
  }
}

function toggleMute() {
  if (!playerRef.value) return
  if (isMuted.value) {
    playerRef.value.unMute()
    isMuted.value = false
  } else {
    playerRef.value.mute()
    isMuted.value = true
  }
}

function seekBy(deltaSeconds: number) {
  if (!playerRef.value) return
  const current = playerRef.value.getCurrentTime?.() || 0
  const nextValue = Math.max(0, Math.min(duration.value || current + deltaSeconds, current + deltaSeconds))
  playerRef.value.seekTo(nextValue, true)
  currentTime.value = nextValue
}

function handleDoubleClick(event: MouseEvent) {
  if (!active.value || !playerRef.value) return
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const relativeX = event.clientX - rect.left
  seekBy(relativeX > rect.width / 2 ? 5 : -5)
}

function toggleCaptions() {
  captionsEnabled.value = !captionsEnabled.value
  if (playerRef.value) {
    playerRef.value.destroy()
    playerRef.value = null
  }
  nextTick(() => initializePlayer())
}

function applyQuality() {
  if (!playerRef.value || !playerRef.value.setPlaybackQuality) return
  const preferredQuality = quality.value === 'auto' ? 'default' : quality.value
  playerRef.value.setPlaybackQuality(preferredQuality)
}

async function toggleFullscreen() {
  const target = playerContainer.value?.closest('.youtube-frame') as HTMLElement | null
  if (!target) return

  if (document.fullscreenElement) {
    await document.exitFullscreen()
    isFullscreen.value = false
    return
  }

  try {
    await target.requestFullscreen()
    isFullscreen.value = true
  } catch {
    isFullscreen.value = false
  }
}

watch(() => quality.value, () => {
  applyQuality()
})

watch(
  () => active.value,
  async (value) => {
    if (!value) {
      if (playerRef.value) {
        playerRef.value.destroy()
        playerRef.value = null
      }
      isPlaying.value = false
      currentTime.value = 0
      duration.value = 0
    }
  }
)
</script>

<template>
  <div
    class="youtube-frame"
    :aria-label="title || 'Vidéo YouTube'"
    :class="{ 'youtube-frame--fullscreen': isFullscreen }"
    @dblclick="handleDoubleClick"
  >
    <button
      v-if="!active"
      type="button"
      class="youtube-frame__preview"
      :style="{ backgroundImage: `url(${thumbnailUrl})` }"
      :aria-label="`Lire ${title || 'la vidéo'}`"
      @click="activatePlayer"
    >
      <span class="youtube-frame__play" aria-hidden="true">▶</span>
    </button>

    <div
      v-else
      class="youtube-frame__player-shell"
    >
      <div
        ref="playerContainer"
        class="youtube-frame__player"
      />

      <div class="youtube-frame__controls">
        <div class="youtube-frame__main-controls">
          <button type="button" @click="seekBy(-5)" aria-label="Revenir de 5 secondes">-5s</button>
          <button type="button" @click="togglePlay" aria-label="Lecture / pause">
            {{ isPlaying ? 'Pause' : 'Lire' }}
          </button>
          <button type="button" @click="seekBy(5)" aria-label="Avancer de 5 secondes">+5s</button>
          <button type="button" @click="toggleMute" aria-label="Muet / activer le son">
            {{ isMuted ? 'Unmute' : 'Mute' }}
          </button>
          <button type="button" @click="toggleCaptions" aria-label="Sous-titres">
            {{ captionsEnabled ? 'CC ON' : 'CC OFF' }}
          </button>
          <button type="button" @click="toggleFullscreen" aria-label="Plein écran">
            {{ isFullscreen ? 'Sortir' : 'Plein écran' }}
          </button>
        </div>

        <div class="youtube-frame__meta">
          <span>{{ formatTime(currentTime) }}</span>
          <span class="youtube-frame__separator">/</span>
          <span>{{ formatTime(duration) }}</span>
          <label class="youtube-frame__quality">
            Qualité
            <AppSelect
              v-model="quality"
              icon="i-lucide-monitor"
              size="sm"
              variant="filter"
              aria-label="Qualité de la vidéo"
              :options="[...qualityOptions]"
              @change="applyQuality"
            />
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.youtube-frame {
  position: relative;
  overflow: hidden;
  aspect-ratio: 16 / 9;
  border-radius: 0.85rem;
  border: 1px solid var(--border-color);
  background: linear-gradient(145deg, rgba(var(--primary-color-rgb), 0.12), rgba(0, 0, 0, 0.08));
}

.youtube-frame--fullscreen {
  position: fixed;
  inset: 0;
  z-index: 60;
  border-radius: 0;
  background: rgba(0, 0, 0, 0.95);
  aspect-ratio: auto;
}

.youtube-frame__preview,
.youtube-frame__player-shell,
.youtube-frame__player {
  display: block;
  height: 100%;
  width: 100%;
  border: 0;
}

.youtube-frame__preview {
  position: relative;
  cursor: pointer;
  background-position: center;
  background-size: cover;
}

.youtube-frame__preview::before {
  position: absolute;
  inset: 0;
  content: '';
  background: linear-gradient(135deg, rgba(var(--primary-color-rgb), 0.3), rgba(0, 0, 0, 0.4));
}

.youtube-frame__play {
  position: absolute;
  top: 50%;
  left: 50%;
  display: grid;
  height: 3.75rem;
  width: 3.75rem;
  place-items: center;
  transform: translate(-50%, -50%);
  border: 2px solid rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  color: white;
  background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
  font-size: 1.25rem;
  box-shadow: 0 14px 30px rgba(var(--primary-color-rgb), 0.35);
}

.youtube-frame__player-shell {
  position: relative;
}

.youtube-frame__player {
  height: 100%;
}

.youtube-frame__controls {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.7rem 0.75rem 0.85rem;
  background: linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.8));
  color: white;
}

.youtube-frame__main-controls,
.youtube-frame__meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.youtube-frame__main-controls button,
.youtube-frame__quality select {
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 999px;
  background: rgba(17, 17, 17, 0.7);
  color: white;
  padding: 0.35rem 0.7rem;
  font-size: 0.72rem;
}

.youtube-frame__main-controls button:hover,
.youtube-frame__main-controls button:focus-visible,
.youtube-frame__quality select:hover,
.youtube-frame__quality select:focus-visible {
  border-color: rgba(var(--primary-color-rgb), 0.9);
  background: rgba(var(--primary-color-rgb), 0.22);
  outline: none;
  gap: 0.45rem;
  font-size: 0.72rem;
}

.youtube-frame__quality select {
  padding-right: 1.5rem;
}

.youtube-frame__separator {
  opacity: 0.8;
}
</style>
