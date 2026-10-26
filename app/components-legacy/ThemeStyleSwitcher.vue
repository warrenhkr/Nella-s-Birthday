<script setup lang="ts">
const { visualStyle, toggleVisualStyle } = useThemeStore()
const route = useRoute()
const isSpecialDashboard = computed(() => route.path.startsWith('/dashboard'))
const isStylePulsing = ref(false)
let pulseTimeout: number | undefined

function changeVisualStyle() {
  isStylePulsing.value = true
  toggleVisualStyle()

  pulseTimeout = window.setTimeout(() => {
    isStylePulsing.value = false
  }, 220)
}

onUnmounted(() => {
  if (pulseTimeout) window.clearTimeout(pulseTimeout)
})
</script>

<template>
  <div
    class="theme-switcher"
    :class="{ 'theme-switcher--dashboard': isSpecialDashboard }"
    role="group"
    aria-label="Réglages visuels"
  >
    <button
      type="button"
      :class="['theme-switcher__button theme-switcher__button--style', isStylePulsing ? 'theme-switcher__button--pulse' : '']"
      :aria-label="visualStyle === 'persona' ? 'Activer le style cyberpunk' : 'Activer le style Persona'"
      :title="visualStyle === 'persona' ? 'Style Cyberpunk' : 'Style Persona'"
      @click="changeVisualStyle"
    >
      <UIcon :name="visualStyle === 'persona' ? 'i-lucide-drama' : 'i-lucide-circuit-board'" class="h-4 w-4" />
    </button>
  </div>
</template>

<style scoped>
.theme-switcher {
  position: fixed;
  right: 1.25rem;
  bottom: 1.25rem;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.4rem;
  border: 1px solid var(--border-color);
  border-radius: 9999px;
  background: var(--panel-color);
  box-shadow: 0 14px 32px -16px rgba(0, 0, 0, 0.55), 0 0 22px -12px rgba(var(--primary-color-rgb), 0.8);
  backdrop-filter: blur(18px);
}

.theme-switcher__button {
  display: grid;
  width: 3.25rem;
  height: 3.25rem;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 9999px;
  color: var(--text-color);
  background: transparent;
  cursor: pointer;
  transition: transform 0.2s ease, color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease;
}

.theme-switcher__button:hover {
  color: var(--primary-color);
  background: rgba(var(--primary-color-rgb), 0.1);
  border-color: rgba(var(--primary-color-rgb), 0.32);
  transform: translateY(-2px);
}

.theme-switcher__button:active { transform: scale(0.92); }

.theme-switcher__button--style {
  width: 2.45rem;
  height: 2.45rem;
  color: var(--accent-color);
}

.theme-switcher__button--pulse { animation: switcher-bubble-pulse 0.22s ease; }

.theme-switcher--dashboard {
  bottom: 5.5rem;
}

@keyframes switcher-bubble-pulse {
  50% { transform: scale(0.86); opacity: 0.7; }
}

@media (max-width: 520px) {
  .theme-switcher {
    right: 0.85rem;
    bottom: 1rem;
  }

  .theme-switcher--dashboard {
    bottom: 5.25rem;
  }
}
</style>
