<script setup lang="ts">
import { adminHomeFor } from '#shared/admin-scopes'

const { theme, toggleTheme } = useThemeStore()
const { user, logout } = useAuth()
const route = useRoute()
const isMobileMenuOpen = ref(false)

/** Entrée de navigation principale. */
type LienNav = { to: string, label: string }

const links = computed<LienNav[]>(() => {
  const publicLinks: LienNav[] = [
    { to: '/', label: 'Accueil' },
    { to: '/communaute', label: 'Communauté' },
    { to: '/evenements', label: 'Événements' },
    { to: '/tournois', label: 'Tournois' },
    { to: '/boutique', label: 'Boutique' },
    { to: '/galerie', label: 'Galerie' }
  ]
  // Point d'entrée de l'espace admin : un administrateur à périmètre est
  // conduit directement à SON espace (son périmètre), les autres à /dashboard.
  const adminHome = user.value?.role === 'ADMIN'
    ? adminHomeFor(user.value?.adminScopes ?? [])
    : '/dashboard'
  // Le SHOP_MANAGER n'a PAS de lien ici : son point d'entrée est porté plus bas
  // par `shopLink` (sinon « Gestion boutique » apparaissait deux fois dans la nav).
  const roleLink = user.value?.role === 'SUPER_ADMIN'
    ? { to: '/dashboard-super-admin#signalements', label: 'Super-administration' }
    : ['ADMIN', 'INTERMEDIATE_ADMIN'].includes(user.value?.role || '')
        ? { to: adminHome, label: 'Administration' }
        : null
  // La gestion boutique est proposée au SHOP_MANAGER et à l'INTERMEDIATE_ADMIN
  // (mêmes droits) : sans ce lien, un admin intermédiaire n'avait aucun accès
  // visible au back-office boutique depuis la navigation principale.
  const shopLink = ['SHOP_MANAGER', 'INTERMEDIATE_ADMIN'].includes(user.value?.role || '')
    ? { to: '/boutique-dashboard', label: 'Gestion boutique' }
    : null
  const memberLink = user.value ? { to: '/espace-membre', label: 'Mon espace' } : null
  const teamLink = user.value ? { to: '/equipes', label: 'Équipes' } : null
  const reportLink = user.value?.role === 'MEMBER'
    ? { to: '/espace-membre#signalements', label: 'Signaler un problème' }
    : null

  // Dédoublonnage par destination : deux entrées ne peuvent pas pointer vers la
  // même page (c'est ce qui produisait « Gestion boutique » en double).
  const candidats: Array<LienNav | null> = [
    ...publicLinks,
    memberLink,
    teamLink,
    reportLink,
    roleLink,
    shopLink
  ]
  const destinations = new Set<string>()
  return candidats.filter((lien): lien is LienNav => {
    if (!lien || destinations.has(lien.to)) return false
    destinations.add(lien.to)
    return true
  })
})

function isActive(to: string) {
  const path = to.split('#')[0] || '/'
  return path === '/' ? route.path === '/' : route.path.startsWith(path)
}

function closeMobileMenu() {
  isMobileMenuOpen.value = false
}

watch(() => route.fullPath, closeMobileMenu)

const WAVE_DURATION = 700

function toggleThemeWithTransition(event: MouseEvent) {
  if (!import.meta.client) return
  const trigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  const triggerBounds = trigger?.getBoundingClientRect()
  const x = triggerBounds ? triggerBounds.left + triggerBounds.width / 2 : event.clientX
  const y = triggerBounds ? triggerBounds.top + triggerBounds.height / 2 : event.clientY
  const endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    toggleTheme()
    return
  }
  const wave = document.createElement('div')
  wave.className = 'nav-theme-wave'
  wave.style.left = `${x}px`
  wave.style.top = `${y}px`
  wave.style.setProperty('--wave-size', `${endRadius * 2}px`)
  document.body.appendChild(wave)
  toggleTheme()
  window.setTimeout(() => wave.remove(), WAVE_DURATION + 100)
}
</script>

<template>
  <nav class="main-nav">
    <div class="main-nav__desktop">
      <NuxtLink
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        prefetch
        class="main-nav-link"
        :class="{ 'main-nav-link--active': isActive(link.to) }"
      >
        {{ link.label }}
      </NuxtLink>
    </div>

    <div class="main-nav__actions">
      <UButton
        :icon="theme === 'dark' ? 'i-lucide-moon' : 'i-lucide-sun'"
        variant="ghost"
        class="main-nav__theme"
        aria-label="Changer de thème"
        @click="toggleThemeWithTransition"
      />
      <button
        type="button"
        class="main-nav__menu-toggle"
        :aria-label="isMobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'"
        :aria-expanded="isMobileMenuOpen"
        aria-controls="main-nav-mobile-menu"
        @click="isMobileMenuOpen = !isMobileMenuOpen"
      >
        <UIcon
          :name="isMobileMenuOpen ? 'i-lucide-x' : 'i-lucide-menu'"
          class="h-5 w-5"
        />
      </button>
    </div>
  </nav>

  <Teleport to="body">
    <Transition name="main-nav-mobile">
      <div
        v-if="isMobileMenuOpen"
        id="main-nav-mobile-menu"
        class="main-nav-mobile"
      >
        <NuxtLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          prefetch
          class="main-nav-mobile__link"
          :class="{ 'main-nav-mobile__link--active': isActive(link.to) }"
          @click="closeMobileMenu"
        >
          <span>{{ link.label }}</span>
          <UIcon name="i-lucide-arrow-up-right" class="h-4 w-4" />
        </NuxtLink>

        <div class="main-nav-mobile__separator" />

        <NuxtLink
          v-if="!user"
          to="/auth"
          class="main-nav-mobile__link main-nav-mobile__link--action"
          @click="closeMobileMenu"
        >
          <span>Se connecter</span>
          <UIcon name="i-lucide-log-in" class="h-4 w-4" />
        </NuxtLink>
        <NuxtLink
          v-if="!user"
          to="/inscription"
          class="main-nav-mobile__link main-nav-mobile__link--action"
          @click="closeMobileMenu"
        >
          <span>S'inscrire</span>
          <UIcon name="i-lucide-user-plus" class="h-4 w-4" />
        </NuxtLink>
        <NuxtLink
          v-else
          to="/espace-membre"
          class="main-nav-mobile__link main-nav-mobile__link--action"
          @click="closeMobileMenu"
        >
          <span>Mon espace</span>
          <UIcon name="i-lucide-user-round" class="h-4 w-4" />
        </NuxtLink>
        <button
          v-if="user"
          type="button"
          class="main-nav-mobile__link main-nav-mobile__link--action"
          @click="logout(); closeMobileMenu()"
        >
          <span>Se déconnecter</span>
          <UIcon name="i-lucide-log-out" class="h-4 w-4" />
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.main-nav {
  position: relative;
  z-index: 9991;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  flex: 1 1 auto;
  min-width: 0;
}

.main-nav__desktop {
  display: none;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  min-width: 0;
  width: 100%;
}

.main-nav__actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 0.5rem;
}

/* Le bouton de thème et le bouton du menu (les deux seuls à droite sur mobile)
   partagent exactement la même taille de cible tactile : 44 px. */
.main-nav__theme {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
}

.main-nav__menu-toggle {
  display: none !important;
  width: 2.75rem;
  height: 2.75rem;
  place-items: center;
  border: 1px solid var(--primary-color);
  border-radius: 0.7rem;
  border-color: var(--primary-color) !important;
  color: var(--primary-color) !important;
  background: rgba(var(--primary-color-rgb), 0.1) !important;
  box-shadow: 0 0 18px -10px rgba(var(--primary-color-rgb), 0.9);
  pointer-events: auto;
}

.main-nav__menu-toggle:hover {
  color: var(--bg-color) !important;
  background: var(--primary-color) !important;
}

.main-nav__theme {
  border-radius: 9999px;
}

.main-nav-link {
  position: relative;
  padding: 0.45rem 0;
  color: var(--text-color);
  font-size: 0.76rem;
  font-weight: 600;
  white-space: nowrap;
  opacity: 0.72;
  transition: color 0.18s ease, opacity 0.18s ease, transform 0.18s ease;
}

.main-nav-link::after {
  position: absolute;
  right: 100%;
  bottom: 0;
  left: 0;
  height: 2px;
  background: var(--primary-color);
  content: '';
  transition: right 0.22s ease;
}

.main-nav-link:hover,
.main-nav-link--active {
  color: var(--primary-color);
  opacity: 1;
  transform: translateY(-1px);
}

.main-nav-link:hover::after,
.main-nav-link--active::after {
  right: 0;
}

.main-nav-mobile {
  position: fixed;
  top: 5.5rem;
  right: 0;
  left: 0;
  z-index: 2147483647;
  display: grid;
  width: 100%;
  gap: 0.35rem;
  padding: 0.55rem;
  border: 1px solid rgba(var(--primary-color-rgb), 0.2);
  border-radius: 1rem;
  background: var(--bg-color-soft);
  box-shadow: 0 18px 40px -24px rgba(30, 10, 15, 0.55);
  backdrop-filter: blur(18px);
  opacity: 1 !important;
  pointer-events: auto;
  isolation: isolate;
}

.main-nav-mobile-enter-active,
.main-nav-mobile-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
  transform-origin: top center;
}

.main-nav-mobile-enter-from,
.main-nav-mobile-leave-to {
  opacity: 0;
  transform: translateY(-0.5rem) scale(0.98);
}

.main-nav-mobile__link {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.8rem 0.9rem;
  border-radius: 0.7rem;
  color: var(--text-color);
  font-size: 0.9rem;
  background: var(--bg-color-soft);
  cursor: pointer;
  pointer-events: auto;
  transition: background-color 0.18s ease, color 0.18s ease;
}

.main-nav-mobile__link:hover,
.main-nav-mobile__link--active {
  color: var(--primary-color);
  background: rgba(var(--primary-color-rgb), 0.09);
}

.main-nav-mobile__link--action {
  background: rgba(var(--primary-color-rgb), 0.06);
}

.main-nav-mobile__separator {
  height: 1px;
  margin: 0.35rem 0;
  background: var(--border-color);
}

@media (min-width: 1024px) {
  .main-nav__desktop {
    display: flex;
  }

  .main-nav-mobile {
    display: none !important;
  }
}

@media (max-width: 1023px) {
  .main-nav {
    flex: 1 1 auto;
    order: 3;
    width: auto;
    min-width: 0;
  }

  .main-nav__desktop {
    display: none !important;
  }

  .main-nav__actions {
    margin-left: auto;
  }

  .main-nav__menu-toggle {
    display: grid !important;
  }
}

@media (max-width: 767px) {
  .main-nav {
    margin-left: auto;
  }
}
</style>
