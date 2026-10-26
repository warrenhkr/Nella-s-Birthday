<script setup lang="ts">
import { ANALYSTE_GAMES } from '../lot-analyste-entreprise/app/data/analyste-jeux'

const { theme, toggleTheme, hydrate } = useThemeStore()
const entryCompleted = ref(false)
const route = useRoute()
const soundManager = useSoundManager()
const isAnalystExperience = computed(() => route.path.startsWith('/analyste')
  || route.query.categorie === 'analyste'
  || ANALYSTE_GAMES.some(game => game.slug === String(route.query.game ?? '')))
let siteRevealObserver: IntersectionObserver | null = null
let siteRevealRoot: Element | null = null

const themeLabel = computed(() => theme.value === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre')
const themeTransitionDuration = 1600
const isThemeTransitioning = ref(false)

function toggleThemeWithTransition() {
  if (!import.meta.client) return

  const root = document.documentElement

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    toggleTheme()
    return
  }

  isThemeTransitioning.value = true

  const cleanup = () => {
    root.classList.remove('theme-soft-transition')
    root.classList.remove('theme-transition-instant')
    isThemeTransitioning.value = false
  }

  const viewTransitionDocument = document as Document & {
    startViewTransition?: (callback: () => void) => { finished: Promise<void> }
  }

  if (viewTransitionDocument.startViewTransition) {
    root.classList.add('theme-transition-instant')
    const transition = viewTransitionDocument.startViewTransition(toggleTheme)
    void transition.finished.then(cleanup, cleanup)
    return
  }

  root.classList.add('theme-soft-transition')
  toggleTheme()
  window.setTimeout(cleanup, themeTransitionDuration)
}

function enterSite() {
  entryCompleted.value = true
  soundManager.unlockAudio(false)
  if (!soundManager.isMuted.value) soundManager.playBgm()
  void nextTick().then(observeSiteReveals)
}

function observeSiteReveals() {
  if (!import.meta.client || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return

  siteRevealRoot = document.querySelector('#__nuxt')
  if (!siteRevealRoot) return

  const pendingRevealTargets = new WeakSet<Element>()

  siteRevealObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting || pendingRevealTargets.has(entry.target)) continue

      const target = entry.target
      pendingRevealTargets.add(target)
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!target.isConnected) return
        target.classList.add('site-reveal-visible')
        siteRevealObserver?.unobserve(target)
      }))
    }
  }, { threshold: 0.01, rootMargin: '0px 0px -14% 0px' })

  collectSiteRevealTargets()
}

function collectSiteRevealTargets() {
  if (!siteRevealRoot || !siteRevealObserver) return

  const pages = siteRevealRoot.querySelectorAll<HTMLElement>('main.theme-page')
  const revealVariants = ['rise', 'drift-left', 'drift-right', 'soft-scale'] as const

  for (const page of pages) {
    const targets = page.classList.contains('theme-page--anniversaire')
      ? page.querySelectorAll<HTMLElement>(':scope > section:not(.birthday-hero)')
      : page.querySelectorAll<HTMLElement>('.birthday-copy, h1, h2, h3, p, figure, img, article, [class*="-card"], [class*="__card"]')
    page.classList.add('site-reveal-ready')

    targets.forEach((target, index) => {
      if (target.hasAttribute('data-site-reveal') || target.closest('[data-reveal], [data-site-reveal], .journey-hero')) return
      target.setAttribute('data-site-reveal', '')
      target.dataset.siteRevealVariant = page.classList.contains('theme-page--anniversaire')
        ? 'rise'
        : revealVariants[index % revealVariants.length] ?? 'rise'
      target.style.setProperty('--site-reveal-delay', `${(index % revealVariants.length) * 45}ms`)
      siteRevealObserver?.observe(target)
    })
  }
}

onMounted(() => {
  hydrate()
  soundManager.hydrateMuteState()
})

watch(() => route.fullPath, () => {
  if (!entryCompleted.value || !siteRevealObserver) return
  void nextTick(collectSiteRevealTargets)
}, { flush: 'post' })

onUnmounted(() => {
  siteRevealObserver?.disconnect()
  siteRevealRoot = null
})

useHead({
  title: 'Osnella Sènami',
  htmlAttrs: { lang: 'fr' },
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    { rel: 'apple-touch-icon', href: '/favicon.svg' },
    { rel: 'mask-icon', href: '/favicon.svg', color: '#c94e7b' }
  ],
  meta: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { name: 'theme-color', content: '#fff8fb' },
    { name: 'description', content: 'Une histoire d’anniversaire créée avec tendresse pour Osnella Sènami.' },
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: 'Osnella Sènami' },
    { property: 'og:title', content: 'Osnella Sènami • Une histoire pour toi' },
    { property: 'og:description', content: 'Des souvenirs, des mots doux, des jeux et une surprise pour célébrer Osnella Sènami.' },
    { property: 'og:image', content: '/favicon.svg' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: 'Osnella Sènami • Une histoire pour toi' },
    { name: 'twitter:description', content: 'Des souvenirs, des mots doux, des jeux et une surprise pour célébrer Osnella Sènami.' },
    { name: 'twitter:image', content: '/favicon.svg' }
  ]
})
</script>

<template>
  <UApp>
    <FloatingIcons v-if="entryCompleted && route.path !== '/'" :theme-tone="isAnalystExperience" />
    <FloatingNav v-if="entryCompleted && route.path !== '/'" />

    <div
      class="site-content"
      :class="{ 'site-content--with-nav': entryCompleted && route.path !== '/' }"
      :inert="!entryCompleted"
      :aria-hidden="!entryCompleted"
    >
      <NuxtPage />
    </div>

    <EntryGate
      v-if="!entryCompleted"
      @enter="enterSite"
    />
    <AudioToggle v-if="entryCompleted" />

    <button
      v-if="entryCompleted"
      type="button"
      class="theme-toggle"
      :aria-label="themeLabel"
      :title="themeLabel"
      :disabled="isThemeTransitioning"
      @click="toggleThemeWithTransition"
    >
      <UIcon
        :name="theme === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'"
        class="theme-toggle__icon"
      />
    </button>
  </UApp>
</template>

<style scoped>
.site-content--with-nav {
  padding-bottom: calc(5.5rem + env(safe-area-inset-bottom));
}

.theme-toggle {
  position: fixed;
  left: max(1rem, env(safe-area-inset-left));
  bottom: max(1rem, env(safe-area-inset-bottom));
  z-index: 120;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border: 1px solid var(--border-color);
  border-radius: 9999px;
  background: var(--panel-color-solid);
  color: var(--text-color);
  box-shadow: 0 12px 28px -18px rgba(0, 0, 0, 0.34);
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
}

.theme-toggle:disabled {
  cursor: wait;
}

.theme-toggle:hover,
.theme-toggle:focus-visible {
  transform: translateY(-2px);
  border-color: rgba(var(--primary-color-rgb), 0.4);
  background: rgba(var(--primary-color-rgb), 0.08);
}

.theme-toggle:active {
  transform: scale(0.96);
}

.theme-toggle__icon {
  width: 1.2rem;
  height: 1.2rem;
}

@media (max-width: 640px) {
  .theme-toggle {
    left: max(0.85rem, env(safe-area-inset-left));
    bottom: calc(max(0.75rem, env(safe-area-inset-bottom)) + 4.25rem);
  }
}
</style>
