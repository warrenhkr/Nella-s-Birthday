<script setup lang="ts">
withDefaults(defineProps<{
  compact?: boolean
}>(), {
  compact: false
})
</script>

<template>
  <span
    class="app-logo"
    :class="{ 'app-logo--compact': compact }"
    aria-label="Logo du Club Otaku ENEAM"
  >
    <img
      src="/logo-club-otaku.jpg"
      alt="Club Otaku ENEAM"
      class="app-logo__image"
    >
  </span>
</template>

<style scoped>
.app-logo {
  position: relative;
  display: inline-flex;
  width: 4rem;
  height: 4rem;
  flex: 0 0 auto;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--primary-color) 35%, transparent);
  border-radius: 0.85rem;
  background: var(--bg-color-soft);
  box-shadow: 0 0.4rem 1.2rem rgba(var(--primary-color-rgb), 0.16);
}

.app-logo--compact {
  width: 2.6rem;
  height: 2.6rem;
  border-radius: 0.65rem;
}

.app-logo__image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
