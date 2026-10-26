<script setup lang="ts">
import { playVideo, playVideoOnSurface } from '../utils/video'

defineProps<{
  src: string
  poster?: string
  label: string
  autoplay?: boolean
}>()

const videoElement = ref<HTMLVideoElement | null>(null)
const isPlaying = ref(false)

function togglePlayback() {
  const video = videoElement.value
  if (!video) return

  if (video.paused) {
    playVideo(video)
  } else {
    video.pause()
  }
}
</script>

<template>
  <div class="video-player">
    <video
      ref="videoElement"
      class="video-player__video"
      :src="src"
      :poster="poster"
      :aria-label="label"
      controls
      playsinline
      preload="none"
      :autoplay="autoplay"
      @click="playVideoOnSurface"
      @play="isPlaying = true"
      @pause="isPlaying = false"
      @ended="isPlaying = false"
    />
    <button
      class="video-player__play"
      :class="{ 'is-playing': isPlaying }"
      type="button"
      :aria-label="`${isPlaying ? 'Mettre en pause' : 'Lire'} ${label}`"
      @click.stop="togglePlayback"
    >
      <UIcon
        :name="isPlaying ? 'i-lucide-pause' : 'i-lucide-play'"
        aria-hidden="true"
      />
    </button>
  </div>
</template>

<style scoped>
.video-player {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.video-player__video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

:global(video::-webkit-media-controls-overlay-play-button),
:global(video::-webkit-media-controls-start-playback-button),
:global(video::-webkit-media-controls-play-button) {
  display: none;
}

.video-player__play {
  position: absolute;
  top: 50%;
  left: 50%;
  display: grid;
  width: 3.25rem;
  height: 3.25rem;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 50%;
  background: rgba(22, 14, 31, 0.76);
  color: white;
  cursor: pointer;
  transform: translate(-50%, -50%);
  transition: background-color 180ms ease, scale 180ms ease;
}

.video-player__play:hover {
  background: rgba(22, 14, 31, 0.94);
  scale: 1.08;
}

.video-player__play.is-playing {
  opacity: 0;
  transition: opacity 180ms ease, background-color 180ms ease, scale 180ms ease;
}

.video-player:hover .video-player__play.is-playing,
.video-player__play.is-playing:focus-visible {
  opacity: 1;
}

.video-player__play :deep(svg) {
  width: 1.35rem;
  height: 1.35rem;
  margin-left: 0.12rem;
}

.video-player__play:focus-visible {
  outline: 3px solid var(--accent-color);
  outline-offset: 3px;
}
</style>
