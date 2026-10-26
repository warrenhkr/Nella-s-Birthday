<script setup lang="ts">
import { canUseAdminScope, type AdminScope } from '#shared/admin-scopes'

const { user } = useAuth()
const route = useRoute()

type QuickLink = {
  to: string
  label: string
  icon: string
  // Périmètres qui ouvrent ce raccourci (voir shared/admin-scopes.ts).
  // Un ADMIN dont `adminScopes` est vide garde TOUS les raccourcis (compatibilité).
  scopes: AdminScope[]
}

// Espace boutique : partagé par le gestionnaire boutique ET l'administrateur
// intermédiaire (mêmes droits, donc mêmes raccourcis). Le rôle ADMIN n'y a pas
// accès (règle métier), ces liens ne passent donc jamais par le filtre de
// périmètre : `scopes: []`.
const shopLinks: QuickLink[] = [
  { to: '/boutique-dashboard', label: 'Boutique', icon: 'i-lucide-store', scopes: [] },
  { to: '/boutique-produits', label: 'Produits', icon: 'i-lucide-package-plus', scopes: [] },
  { to: '/boutique-catalogue', label: 'Catalogue', icon: 'i-lucide-package-search', scopes: [] }
]

const overviewLink: QuickLink = {
  to: '/dashboard',
  label: 'Administration',
  icon: 'i-lucide-layout-dashboard',
  scopes: ['membres', 'supervision']
}

const adminLinks: QuickLink[] = [
  { to: '/dashboard-evenementiel', label: 'Événementiel', icon: 'i-lucide-calendar-plus', scopes: ['evenementiel'] },
  { to: '/dashboard-communication', label: 'Communication', icon: 'i-lucide-megaphone', scopes: ['communication'] },
  { to: '/dashboard-gaming', label: 'Gaming', icon: 'i-lucide-gamepad-2', scopes: ['gaming'] },
  { to: '/dashboard-moderation', label: 'Modération', icon: 'i-lucide-shield-check', scopes: ['moderation'] },
  { to: '/dashboard-moderation#publier', label: 'Publier un souvenir', icon: 'i-lucide-image-plus', scopes: ['moderation'] }
]

const links = computed<QuickLink[]>(() => {
  const role = user.value?.role ?? ''
  const adminScopes = user.value?.adminScopes ?? []

  if (role === 'SHOP_MANAGER') {
    return [
      ...shopLinks,
      { to: '/espace-membre', label: 'Mon espace', icon: 'i-lucide-user-round', scopes: [] }
    ]
  }

  if (role === 'SUPER_ADMIN') {
    return [
      { to: '/dashboard-super-admin', label: 'Super-admin', icon: 'i-lucide-crown', scopes: [] },
      { to: '/dashboard-super-admin#signalements', label: 'Signalements', icon: 'i-lucide-flag', scopes: [] }
    ]
  }

  // L'administrateur intermédiaire cumule l'administration du club ET la
  // boutique : il doit voir les DEUX jeux de raccourcis. (Régression corrigée le
  // 11/09/2026 : la première version remplaçait ses liens admin par les liens
  // boutique, si bien qu'il n'avait plus aucun accès visible à Événementiel,
  // Communication, Gaming et Modération.) Il n'est jamais limité par un
  // périmètre.
  if (role === 'INTERMEDIATE_ADMIN') {
    return [
      overviewLink,
      ...adminLinks,
      ...shopLinks
    ]
  }

  // ADMIN : un administrateur à périmètre ne voit QUE les entrées de ses
  // périmètres. Un administrateur sans périmètre voit tout (comportement
  // historique préservé).
  return [overviewLink, ...adminLinks]
    .filter(link => canUseAdminScope(role, adminScopes, link.scopes))
})

// Trop de liens sur un téléphone = barre illisible et zones tactiles trop
// étroites. On n'en affiche que trois, les autres passent dans un panneau
// « Plus » (le bouton à trois points), qui reste accessible au pouce.
const MAX_VISIBLE = 3

const primaryLinks = computed(() => links.value.slice(0, MAX_VISIBLE))
const overflowLinks = computed(() => links.value.slice(MAX_VISIBLE))
const hasOverflow = computed(() => overflowLinks.value.length > 0)

const showMore = ref(false)

// Fermer le panneau dès qu'on navigue (sinon il resterait ouvert par-dessus la
// page suivante).
watch(() => route.fullPath, () => { showMore.value = false })

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') showMore.value = false
}
</script>

<template>
  <nav class="admin-quick-nav" aria-label="Navigation des espaces admin">
    <NuxtLink
      v-for="link in primaryLinks"
      :key="link.to"
      :to="link.to"
      prefetch
      class="admin-quick-link"
    >
      <UIcon :name="link.icon" class="h-5 w-5" />
      <span>{{ link.label }}</span>
    </NuxtLink>

    <button
      v-if="hasOverflow"
      type="button"
      class="admin-quick-link admin-quick-link--button"
      :aria-expanded="showMore"
      aria-controls="admin-quick-more"
      :aria-label="`Voir les ${overflowLinks.length} autres espaces`"
      @click="showMore = !showMore"
    >
      <UIcon :name="showMore ? 'i-lucide-x' : 'i-lucide-ellipsis'" class="h-5 w-5" />
      <span>Plus</span>
    </button>
  </nav>

  <div
    v-if="showMore"
    class="admin-quick-more-backdrop"
    @click.self="showMore = false"
    @keydown="onKeydown"
  >
    <div
      id="admin-quick-more"
      class="admin-quick-more"
      role="menu"
      aria-label="Autres espaces"
    >
      <p class="admin-quick-more__title">
        Autres espaces
      </p>
      <NuxtLink
        v-for="link in overflowLinks"
        :key="link.to"
        :to="link.to"
        prefetch
        class="admin-quick-more__link"
        role="menuitem"
        @click="showMore = false"
      >
        <UIcon :name="link.icon" class="h-4 w-4" />
        <span>{{ link.label }}</span>
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.admin-quick-nav {
  position: fixed;
  z-index: 40;
  right: 0;
  bottom: 0;
  left: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(4.5rem, 1fr));
  gap: 0.25rem;
  padding: 0.5rem max(0.75rem, env(safe-area-inset-right)) max(0.5rem, env(safe-area-inset-bottom)) max(0.75rem, env(safe-area-inset-left));
  border-top: 1px solid var(--border-color);
  background: rgba(126, 18, 18, 0.88);
  color: #fff1f2;
  box-shadow: 0 -10px 24px -18px rgba(0, 0, 0, 0.7);
}

.admin-quick-link {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  padding: 0.4rem 0.15rem;
  color: #ffe4e6;
  font-size: 0.68rem;
  text-align: center;
}

.admin-quick-link span {
  overflow: hidden;
  max-width: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-quick-link:hover,
.admin-quick-link.router-link-active {
  color: #ffffff;
  background: rgba(220, 38, 38, 0.45);
}

.admin-quick-link--button {
  border: 0;
  background: transparent;
  cursor: pointer;
}

/* ---- Panneau « Plus » (le bouton à trois points) ---- */
.admin-quick-more-backdrop {
  position: fixed;
  z-index: 45;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0 0.75rem 4.75rem;
  background: rgba(0, 0, 0, 0.45);
}

.admin-quick-more {
  display: grid;
  width: 100%;
  max-width: 26rem;
  gap: 0.35rem;
  padding: 0.9rem;
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  background: rgba(126, 18, 18, 0.97);
  color: #fff1f2;
  box-shadow: 0 -12px 30px -12px rgba(0, 0, 0, 0.7);
}

.admin-quick-more__title {
  font-size: 0.68rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #fecdd3;
}

.admin-quick-more__link {
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.7rem;
  border-radius: 0.6rem;
  font-size: 0.9rem;
  color: #ffe4e6;
}

.admin-quick-more__link:hover,
.admin-quick-more__link.router-link-active {
  color: #ffffff;
  background: rgba(220, 38, 38, 0.45);
}
</style>
