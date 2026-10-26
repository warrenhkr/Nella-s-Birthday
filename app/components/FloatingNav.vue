<script setup lang="ts">
const links = [
  { to: '/anniversaire', label: 'Anniversaire', icon: 'i-lucide-heart', charm: 'i-lucide-sparkles' },
  { to: '/souvenirs', label: 'Souvenirs', icon: 'i-lucide-camera', charm: 'i-lucide-heart' },
  { to: '/voyage', label: 'Le voyage', icon: 'i-lucide-film', charm: 'i-lucide-sparkles' },
  { to: '/lettres', label: 'Chaque lettre', icon: 'i-lucide-spell-check', charm: 'i-lucide-sparkles' },
  { to: '/galerie', label: 'Galerie', icon: 'i-lucide-images', charm: 'i-lucide-heart' },
  { to: '/morceaux', label: 'Morceaux', icon: 'i-lucide-music-2', charm: 'i-lucide-heart' },
  { to: '/algos', label: 'Algorithmes', icon: 'i-lucide-wand-sparkles', charm: 'i-lucide-heart' },
  { to: '/analyste', label: 'Ressources analyste', icon: 'i-lucide-briefcase-business', charm: 'i-lucide-sparkles' },
  { to: '/jeu', label: 'Jeux', icon: 'i-lucide-gamepad-2', charm: 'i-lucide-sparkles' },
  { to: '/surprise', label: 'Surprise', icon: 'i-lucide-gift', charm: 'i-lucide-heart' }
]
</script>

<template>
  <nav class="floating-nav" aria-label="Navigation principale">
    <NuxtLink
      v-for="link in links"
      :key="link.to"
      :to="link.to"
      :prefetch-on="{ visibility: false, interaction: true }"
      class="floating-nav__link"
      :aria-label="link.label"
      :title="link.label"
    >
      <UIcon class="floating-nav__icon" :name="link.icon" aria-hidden="true" />
      <span class="floating-nav__charm" aria-hidden="true">
        <UIcon :name="link.charm" />
      </span>
      <span class="floating-nav__tooltip">{{ link.label }}</span>
    </NuxtLink>
  </nav>
</template>

<style scoped>
.floating-nav {
  position: fixed;
  z-index: 100;
  right: 50%;
  bottom: max(0.75rem, env(safe-area-inset-bottom));
  display: flex;
  gap: 0.25rem;
  padding: 0.4rem;
  border: 1px solid var(--border-color);
  border-radius: 9999px;
  background: var(--panel-color-solid);
  box-shadow: 0 0.5rem 2rem rgba(43, 32, 53, 0.16);
  transform: translateX(50%);
  backdrop-filter: blur(16px);
}

.floating-nav__link {
  position: relative;
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  place-items: center;
  border-radius: 50%;
  color: var(--muted-color);
  transition: background-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

@media (max-width: 640px) {
  .floating-nav {
    max-width: calc(100vw - 1rem);
    overflow-x: auto;
    scrollbar-width: none;
  }

  .floating-nav::-webkit-scrollbar { display: none; }
  .floating-nav__link { flex: 0 0 2.75rem; }
}

.floating-nav__link:hover,
.floating-nav__link:focus-visible,
.floating-nav__link.router-link-active {
  color: var(--primary-color);
  background: rgba(var(--primary-color-rgb), 0.1);
}

.floating-nav__link:active {
  transform: scale(0.92);
}

.floating-nav__icon :deep(svg) {
  width: 1.2rem;
  height: 1.2rem;
}

.floating-nav__charm {
  position: absolute;
  top: 0.12rem;
  right: 0.22rem;
  display: grid;
  width: 0.8rem;
  height: 0.8rem;
  place-items: center;
  color: var(--accent-color);
  transform: rotate(12deg);
  transition: transform 0.2s ease;
}

.floating-nav__charm :deep(svg) {
  width: 0.72rem;
  height: 0.72rem;
  fill: color-mix(in srgb, var(--accent-color) 16%, transparent);
}

.floating-nav__link:hover .floating-nav__charm,
.floating-nav__link:focus-visible .floating-nav__charm,
.floating-nav__link.router-link-active .floating-nav__charm {
  transform: rotate(-12deg) scale(1.18);
}

.floating-nav__tooltip {
  position: absolute;
  right: 50%;
  bottom: calc(100% + 0.6rem);
  padding: 0.35rem 0.55rem;
  border-radius: 0.4rem;
  color: var(--text-color);
  background: var(--panel-color-solid);
  box-shadow: 0 0.2rem 0.8rem rgba(43, 32, 53, 0.12);
  font-size: 0.75rem;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transform: translate(50%, 0.2rem);
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.floating-nav__link:hover .floating-nav__tooltip,
.floating-nav__link:focus-visible .floating-nav__tooltip {
  opacity: 1;
  transform: translate(50%, 0);
}

@media (prefers-reduced-motion: reduce) {
  .floating-nav__link,
  .floating-nav__tooltip,
  .floating-nav__charm {
    transition: none;
  }
}
</style>
