<script setup lang="ts">
const {
  isMuted,
  bgmAvailable,
  bgmVolume,
  toggleMute,
  setBgmVolume,
  playSfx
} = useSoundManager()
const audioWidget = ref<HTMLElement | null>(null)
const showControls = ref(false)

function handleClick() {
  // On joue le clic AVANT le toggle : s'il vient d'activer le son,
  // ce clic sert aussi de confirmation audio immédiate.
  const willUnmute = isMuted.value
  toggleMute()
  if (willUnmute) playSfx('click')
}

function toggleAudio() {
  handleClick()
  showControls.value = !isMuted.value
}

function closeOnOutsideClick(event: PointerEvent) {
  if (audioWidget.value && event.target instanceof Node && !audioWidget.value.contains(event.target)) {
    showControls.value = false
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', closeOnOutsideClick)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', closeOnOutsideClick)
})
</script>

<template>
  <!-- Sans musique de fond disponible (assets absents, réseau coupé), le bouton
       de son ne piloterait rien : il est masqué plutôt que laissé inerte. -->
  <div v-if="bgmAvailable" ref="audioWidget">
    <button
      type="button"
      class="audio-toggle"
      :class="{ 'audio-toggle--active': !isMuted }"
      :aria-label="isMuted ? 'Activer le son' : 'Couper le son'"
      :title="isMuted ? 'Activer le son' : 'Couper le son'"
      :aria-expanded="showControls"
      @click="toggleAudio"
    >
      <UIcon :name="isMuted ? 'i-lucide-volume-x' : 'i-lucide-volume-2'" class="h-5 w-5" />
      <span class="audio-toggle__ring" aria-hidden="true" />
    </button>

    <div
      v-if="showControls"
      class="audio-controls surface-solid"
      role="group"
      aria-label="Réglage du volume"
    >
      <label class="audio-controls__label">
        <span>Volume</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="bgmVolume"
          aria-label="Volume du son"
          @input="setBgmVolume(Number(($event.target as HTMLInputElement).value))"
        >
      </label>
    </div>
  </div>
</template>

<style scoped>
.audio-toggle {
  position: fixed;
  bottom: max(1rem, env(safe-area-inset-bottom));
  right: max(1rem, env(safe-area-inset-right));
  z-index: 1700;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border-radius: 9999px;
  color: var(--text-color);
  background: var(--panel-color);
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.25s ease, border-color 0.25s ease;
  will-change: transform;
}

.audio-toggle:hover {
  transform: translateY(-2px);
}

.audio-toggle:active {
  transform: scale(0.93);
}

.audio-toggle--active {
  border-color: rgba(var(--accent-color-rgb), 0.6);
  box-shadow: 0 0 18px -2px rgba(var(--accent-color-rgb), 0.55);
  color: var(--accent-color);
}

.audio-toggle__ring {
  position: absolute;
  inset: -4px;
  border-radius: inherit;
  border: 1px solid rgba(var(--accent-color-rgb), 0.35);
  opacity: 0;
  transition: opacity 0.25s ease;
  pointer-events: none;
}

.audio-controls {
  position: fixed;
  right: max(1rem, env(safe-area-inset-right));
  bottom: calc(max(1rem, env(safe-area-inset-bottom)) + 4rem);
  z-index: 1700;
  width: 13rem;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
}

.audio-controls__label {
  display: grid;
  gap: 0.35rem;
  color: var(--text-color);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.audio-controls__label + .audio-controls__label {
  margin-top: 0.7rem;
}

.audio-controls input {
  width: 100%;
  accent-color: var(--accent-color);
}

.audio-toggle--active .audio-toggle__ring {
  opacity: 1;
}

@media (max-width: 640px) {
  .audio-toggle {
    right: max(0.85rem, env(safe-area-inset-right));
    bottom: calc(max(0.75rem, env(safe-area-inset-bottom)) + 4.25rem);
  }

  .audio-controls {
    right: max(0.85rem, env(safe-area-inset-right));
    bottom: calc(max(0.75rem, env(safe-area-inset-bottom)) + 8.25rem);
  }
}

@media (prefers-reduced-motion: reduce) {
  .audio-toggle {
    transition: none;
  }
}
</style>
