<script setup lang="ts">
import NotificationCenter from '~/components-legacy/NotificationCenter.vue'
import { adminScopeLabels, canUseAdminScope, normalizeAdminScopes, type AdminScope } from '#shared/admin-scopes'
import { poleLabelsOf, polesToText } from '#shared/poles'

definePageMeta({ middleware: 'admin' })

const { user } = useAuth()
const { success, alert } = useGameToast()

type DashboardMission = {
  id: string
  title: string
  status: string
}

type DashboardStats = {
  total_users: number
  total_events: number
  total_products: number
  total_revenue: number
  active_members: number
  active_bookings: number
  recent_signups: Array<{
    id: string
    pseudo: string
    email: string
    pole: string | null
    /** Multi-pôles : union « poles + pole ». */
    poles?: string[]
    createdAt: string
  }>
  missions: DashboardMission[]
}

type AdminAccount = {
  id: string
  email: string
  pseudo: string
  role: 'ADMIN' | 'INTERMEDIATE_ADMIN' | 'SHOP_MANAGER'
  isActive: boolean
  pole: string | null
  /** Multi-pôles : union « poles + pole ». */
  poles?: string[]
  adminScopes: string[]
  nom: string | null
  prenom: string | null
  telephone: string | null
  universite: string | null
  faculte: string | null
  filiere: string | null
  createdAt: string
}

type ManagedAccount = {
  id: string
  email: string
  pseudo: string
  role: 'ADMIN' | 'INTERMEDIATE_ADMIN' | 'SHOP_MANAGER' | 'MEMBER'
  isActive: boolean
  pole: string | null
  /** Multi-pôles : union « poles + pole ». */
  poles?: string[]
  nom: string | null
  prenom: string | null
  telephone: string | null
  universite: string | null
  faculte: string | null
  filiere: string | null
}

type OtakuCardReview = {
  id: string
  displayName: string
  imageUrl: string | null
  favoriteAnime: string | null
  favoriteManga: string | null
  favoriteAnimes: string[]
  favoriteMangas: string[]
  favoriteGame: string | null
  bio: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  user: { pseudo: string, email: string, pole: string | null, nom: string | null, prenom: string | null, telephone: string | null, situation: string | null, pays: string | null, profession: string | null, universite: string | null, faculte: string | null, filiere: string | null }
}

const defaultMissions: DashboardMission[] = [
  { id: 'communication', title: 'Préparer la prochaine campagne de communication', status: 'À venir' },
  { id: 'validation', title: 'Valider les cartes des nouveaux membres', status: 'En cours' },
  { id: 'boutique', title: 'Traiter les nouvelles commandes boutique', status: 'À traiter' }
]

const { data: statsResponse, pending, error, refresh: refreshStats } = await useFetch<{ data: DashboardStats }>('/api/admin/stats')
const stats = computed(() => statsResponse.value?.data ?? {
  total_users: 0,
  total_events: 0,
  total_products: 0,
  total_revenue: 0,
  active_members: 0,
  active_bookings: 0,
  recent_signups: [],
  missions: defaultMissions
})

// KPI : icône + libellé + valeur + repère, tous basés sur /api/admin/stats.
const statCards = computed(() => [
  { key: 'members', title: 'Membres', value: String(stats.value?.total_users || 0), icon: 'i-lucide-users', hint: 'Comptes enregistrés' },
  { key: 'events', title: 'Événements', value: String(stats.value?.total_events || 0), icon: 'i-lucide-calendar', hint: 'Créés au total' },
  { key: 'products', title: 'Produits', value: String(stats.value?.total_products || 0), icon: 'i-lucide-package', hint: 'Au catalogue boutique' },
  { key: 'bookings', title: 'Participations', value: String(stats.value?.active_bookings || 0), icon: 'i-lucide-clipboard-check', hint: 'Réservations confirmées' }
])

const missions = computed(() => stats.value?.missions?.length ? stats.value.missions : defaultMissions)

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(new Date(value))
}

async function retryStats() {
  await refreshStats()
}

const { data: adminsResponse, pending: adminsPending, error: adminsError, refresh: refreshAdmins } = await useFetch<{ data: AdminAccount[] }>('/api/admin/admins', {
  immediate: false
})
const admins = computed(() => adminsResponse.value?.data || [])
const { data: accountsResponse, pending: accountsPending, error: accountsError, refresh: refreshAccounts } = await useFetch<{ data: ManagedAccount[] }>('/api/admin/accounts', {
  immediate: false
})
const managedAccounts = computed(() => accountsResponse.value?.data || [])
const accountSearch = ref('')
const accountsPerPage = 6
const accountsPage = ref(1)
const filteredManagedAccounts = computed(() => {
  const query = accountSearch.value.trim().toLowerCase()
  if (!query) return managedAccounts.value
  return managedAccounts.value.filter(account => [
    account.pseudo,
    account.email,
    account.nom,
    account.prenom,
    account.telephone,
    account.universite,
    account.faculte,
    account.filiere,
    poleLabelsOf(account).join(' '),
    account.pole,
    account.role
  ].some(value => value?.toLowerCase().includes(query)))
})
const totalAccountPages = computed(() => Math.max(1, Math.ceil(filteredManagedAccounts.value.length / accountsPerPage)))
const paginatedManagedAccounts = computed(() => {
  const startIndex = (accountsPage.value - 1) * accountsPerPage
  return filteredManagedAccounts.value.slice(startIndex, startIndex + accountsPerPage)
})
watch(accountSearch, () => { accountsPage.value = 1 })
watch(filteredManagedAccounts, () => { if (accountsPage.value > totalAccountPages.value) accountsPage.value = totalAccountPages.value })
const updatingShopManagerId = ref<string | null>(null)
const updatingAdminId = ref<string | null>(null)
const removingAdminId = ref<string | null>(null)
const { data: cardsResponse, pending: cardsPending, error: cardsError, refresh: refreshCards } = await useFetch<{ data: OtakuCardReview[] }>('/api/admin/cards', {
  immediate: false
})
const otakuCards = computed(() => cardsResponse.value?.data || [])
const cardSearch = ref('')
const cardsPageSize = 6
const cardsPage = ref(1)
const filteredOtakuCards = computed(() => {
  const query = cardSearch.value.trim().toLowerCase()
  if (!query) return otakuCards.value
  return otakuCards.value.filter(card => [
    card.displayName,
    card.user?.pseudo,
    card.user?.email,
    card.user?.nom,
    card.user?.prenom,
    card.user?.telephone,
    card.user?.situation,
    card.user?.pays,
    card.user?.profession,
    card.user?.universite,
    card.user?.faculte,
    card.user?.filiere,
    card.favoriteAnime,
    card.favoriteManga,
    card.favoriteGame,
    card.bio
  ].some(value => value?.toLowerCase().includes(query)))
})
const totalCardPages = computed(() => Math.max(1, Math.ceil(filteredOtakuCards.value.length / cardsPageSize)))
const paginatedOtakuCards = computed(() => {
  const startIndex = (cardsPage.value - 1) * cardsPageSize
  return filteredOtakuCards.value.slice(startIndex, startIndex + cardsPageSize)
})
watch(cardSearch, () => { cardsPage.value = 1 })
watch(filteredOtakuCards, () => { if (cardsPage.value > totalCardPages.value) cardsPage.value = totalCardPages.value })
const adminEmail = ref('')
const adminPseudo = ref('')
const adminPassword = ref('')
const adminPole = ref('')
// Typé `string` volontairement : AppSelect émet une chaîne (comme les autres
// sélecteurs du site), l'API valide ensuite l'enum.
const adminRole = ref<string>('ADMIN')
const adminSubmitting = ref(false)
// Périmètres choisis pour le nouvel administrateur (liste vide = administrateur
// complet, comportement historique).
const adminScopes = ref<AdminScope[]>([])
// Édition des périmètres d'un administrateur existant.
const scopeEditorFor = ref<string | null>(null)
const scopeDraft = ref<AdminScope[]>([])
const savingScopesId = ref<string | null>(null)
const reviewingCardId = ref<string | null>(null)

// Le super-admin choisit tous les rôles ; l'administrateur intermédiaire peut
// désormais NOMMER DES ADMINISTRATEURS à périmètre (demande client), comme
// l'autorise déjà /api/admin/admins ; l'administrateur simple (ADMIN) reste
// limité à la création de gestionnaires boutique (comportement inchangé).
const adminRoleOptions = computed(() => {
  const options: Array<{ value: string, label: string }> = []
  if (user.value?.role === 'SUPER_ADMIN') {
    options.push({ value: 'ADMIN', label: 'Administrateur' })
    options.push({ value: 'INTERMEDIATE_ADMIN', label: 'Administrateur intermédiaire' })
  } else if (user.value?.role === 'INTERMEDIATE_ADMIN') {
    options.push({ value: 'ADMIN', label: 'Administrateur (périmètre limité)' })
  }
  options.push({ value: 'SHOP_MANAGER', label: 'Gestionnaire boutique' })
  return options
})

// Garantit qu'un rôle par défaut reste valide une fois le rôle courant connu.
watch(adminRoleOptions, (options) => {
  if (options.length && !options.some(option => option.value === adminRole.value)) {
    adminRole.value = options[0]!.value
  }
}, { immediate: true })

// Options du sélecteur de rôle d'un compte existant (mêmes règles qu'avant).
const accountRoleOptions = computed(() => {
  const options: Array<{ value: string, label: string }> = [
    { value: 'MEMBER', label: 'Membre' },
    { value: 'SHOP_MANAGER', label: 'Gestionnaire boutique' }
  ]
  if (user.value?.role === 'INTERMEDIATE_ADMIN' || user.value?.role === 'SUPER_ADMIN') {
    options.push({ value: 'ADMIN', label: 'Administrateur' })
  }
  if (user.value?.role === 'SUPER_ADMIN') {
    options.push({ value: 'INTERMEDIATE_ADMIN', label: 'Administrateur intermédiaire' })
  }
  return options
})

const cardStatusMeta: Record<OtakuCardReview['status'], { label: string, color: 'warning' | 'success' | 'error', icon: string }> = {
  PENDING: { label: 'En attente', color: 'warning', icon: 'i-lucide-clock' },
  APPROVED: { label: 'Validée', color: 'success', icon: 'i-lucide-circle-check' },
  REJECTED: { label: 'Refusée', color: 'error', icon: 'i-lucide-circle-x' }
}

async function loadAdmins() {
  if (user.value?.role === 'SUPER_ADMIN' || user.value?.role === 'INTERMEDIATE_ADMIN') await refreshAdmins()
}

async function retryAdmins() {
  await refreshAdmins()
}

async function updateShopManagerRole(account: ManagedAccount, role: ManagedAccount['role']) {
  if (role === account.role) return
  updatingShopManagerId.value = account.id
  try {
    await $fetch(`/api/admin/accounts/${account.id}`, {
      method: 'PATCH',
      body: { role }
    })
    await refreshAccounts()
    if (user.value?.role === 'SUPER_ADMIN' || user.value?.role === 'INTERMEDIATE_ADMIN') await refreshAdmins()
    success(
      role === 'SHOP_MANAGER'
        ? `${account.pseudo} est maintenant gestionnaire boutique.`
        : role === 'ADMIN'
          ? `${account.pseudo} est maintenant administrateur.`
          : role === 'INTERMEDIATE_ADMIN'
            ? `${account.pseudo} est maintenant administrateur intermédiaire.`
            : 'Rôle spécial retiré.'
    )
  } catch (error: unknown) {
    alert(getApiErrorMessage(error, 'Impossible de modifier ce rôle.'))
  } finally {
    updatingShopManagerId.value = null
  }
}

async function retryCards() {
  await refreshCards()
}

async function reviewCard(card: OtakuCardReview, status: OtakuCardReview['status']) {
  reviewingCardId.value = card.id
  try {
    await $fetch(`/api/admin/cards/${card.id}`, { method: 'PATCH', body: { status } })
    await refreshCards()
    success(status === 'APPROVED' ? 'Carte validée.' : status === 'REJECTED' ? 'Carte refusée.' : 'Carte remise en attente.')
  } catch {
    alert('Impossible de modifier cette carte.')
  } finally {
    reviewingCardId.value = null
  }
}

async function toggleAdmin(admin: AdminAccount) {
  updatingAdminId.value = admin.id
  try {
    await $fetch(`/api/admin/admins/${admin.id}`, {
      method: 'PATCH',
      body: { isActive: !admin.isActive }
    })
    if (user.value?.role === 'SUPER_ADMIN' || user.value?.role === 'INTERMEDIATE_ADMIN') await refreshAdmins()
    success(admin.isActive ? 'Administrateur désactivé.' : 'Administrateur réactivé.')
  } catch {
    alert('Impossible de modifier cet administrateur.')
  } finally {
    updatingAdminId.value = null
  }
}

async function removeAdmin(admin: AdminAccount) {
  if (!window.confirm(`Supprimer définitivement ${admin.pseudo} ?`)) return
  removingAdminId.value = admin.id
  try {
    await $fetch(`/api/admin/admins/${admin.id}`, { method: 'DELETE' })
    await refreshAdmins()
    success('Administrateur supprimé.')
  } catch {
    alert('Impossible de supprimer cet administrateur.')
  } finally {
    removingAdminId.value = null
  }
}

async function createAdmin() {
  if (!adminEmail.value || !adminPseudo.value || adminPassword.value.length < 8) {
    alert('Renseigne un email, un pseudo et un mot de passe de 8 caractères minimum.')
    return
  }

  adminSubmitting.value = true
  try {
    await $fetch('/api/admin/admins', {
      method: 'POST',
      body: {
        email: adminEmail.value,
        pseudo: adminPseudo.value,
        password: adminPassword.value,
        pole: adminPole.value || undefined,
        role: adminRole.value,
        // Périmètres : uniquement pour un compte administrateur. Liste vide =
        // administrateur complet (comportement historique).
        ...(adminRole.value === 'ADMIN' ? { adminScopes: adminScopes.value } : {})
      }
    })
    adminEmail.value = ''
    adminPseudo.value = ''
    adminPassword.value = ''
    adminPole.value = ''
    adminScopes.value = []
    adminRole.value = adminRoleOptions.value[0]?.value || 'SHOP_MANAGER'
    await refreshAdmins()
    success('Administrateur créé.')
  } catch (error: unknown) {
    alert(getApiErrorMessage(error, 'Impossible de créer cet administrateur.'))
  } finally {
    adminSubmitting.value = false
  }
}

// ---------------------------------------------------------------------------
// Périmètres d'un administrateur existant (voir shared/admin-scopes.ts) :
// l'ADMIN_INTERMÉDIAIRE (et le SUPER_ADMIN) peut restreindre ou élargir les
// domaines confiés à un administrateur qu'il gère. L'API applique les mêmes
// règles de délégation (pas d'auto-modification, pas de périmètre sur un
// compte non-ADMIN).
// ---------------------------------------------------------------------------
function toggleScopeEditor(admin: AdminAccount) {
  if (scopeEditorFor.value === admin.id) {
    scopeEditorFor.value = null
    return
  }
  scopeEditorFor.value = admin.id
  scopeDraft.value = normalizeAdminScopes(admin.adminScopes)
}

async function saveAdminScopes(admin: AdminAccount) {
  savingScopesId.value = admin.id
  try {
    await $fetch(`/api/admin/accounts/${admin.id}`, {
      method: 'PATCH',
      body: { adminScopes: scopeDraft.value }
    })
    await refreshAdmins()
    scopeEditorFor.value = null
    success(
      scopeDraft.value.length
        ? `Périmètres de ${admin.pseudo} : ${adminScopeLabels(scopeDraft.value)}.`
        : `${admin.pseudo} est de nouveau administrateur complet.`
    )
  } catch (error: unknown) {
    alert(getApiErrorMessage(error, 'Impossible de modifier les périmètres.'))
  } finally {
    savingScopesId.value = null
  }
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = error.data
    if (typeof data === 'object' && data !== null && 'statusMessage' in data && typeof data.statusMessage === 'string') return data.statusMessage
  }
  return fallback
}

// ============================================================
// ONGLETS DE TRAVAIL
// La page d’administration est scindée en onglets pour qu’une action
// reste accessible en un clic. Chaque section garde sa condition d’accès
// (rôle) et reste montée (v-show) : rien n’est retiré, aucun appel API
// ne change.
// ============================================================
type DashboardTab = 'overview' | 'cards' | 'admins' | 'accounts'

const dashboardTabs: Array<{ value: DashboardTab, label: string, icon: string }> = [
  { value: 'overview', label: 'Vue d’ensemble', icon: 'i-lucide-layout-dashboard' },
  { value: 'cards', label: 'Cartes membres', icon: 'i-lucide-id-card' },
  { value: 'admins', label: 'Administrateurs', icon: 'i-lucide-shield' },
  { value: 'accounts', label: 'Comptes', icon: 'i-lucide-users' }
]

// Rôles autorisés à administrer le club (règle historique).
const hasAdminRole = computed(() => ['ADMIN', 'INTERMEDIATE_ADMIN', 'SUPER_ADMIN'].includes(user.value?.role ?? ''))

// PÉRIMÈTRES : un administrateur limité ne voit que les onglets de ses
// domaines (shared/admin-scopes.ts). `adminScopes` vide (administrateur complet)
// ou rôle SUPER_ADMIN / ADMIN_INTERMÉDIAIRE = tous les onglets, comme avant.
const canViewScope = (required: AdminScope[]) =>
  canUseAdminScope(user.value?.role ?? '', user.value?.adminScopes ?? [], required)

const canManageCards = computed(() => hasAdminRole.value && canViewScope(['membres']))
const canManageAccounts = computed(() => hasAdminRole.value && canViewScope(['supervision']))
const canManageAdmins = computed(() => (user.value?.role === 'SUPER_ADMIN' || user.value?.role === 'INTERMEDIATE_ADMIN') && canViewScope(['supervision']))

// Nommer un administrateur à périmètre : réservé au SUPER_ADMIN et à
// l'ADMIN_INTERMÉDIAIRE (mêmes règles que /api/admin/admins et
// /api/admin/accounts/[id]).
const canDefineScopes = computed(() => user.value?.role === 'SUPER_ADMIN' || user.value?.role === 'INTERMEDIATE_ADMIN')

// Seuls les onglets autorisés par le rôle ET le périmètre sont proposés, avec
// les mêmes règles que les v-if des sections : aucun accès n’est élargi ni
// retiré (un administrateur sans périmètre voit exactement ce qu’il voyait).
const visibleTabs = computed(() => dashboardTabs.filter((tab) => {
  if (tab.value === 'cards') return canManageCards.value
  if (tab.value === 'accounts') return canManageAccounts.value
  if (tab.value === 'admins') return canManageAdmins.value
  return true
}))

const activeTab = ref<DashboardTab>('overview')

watch(visibleTabs, (tabs) => {
  if (!tabs.some(tab => tab.value === activeTab.value)) activeTab.value = 'overview'
})

function selectTab(value: DashboardTab) {
  activeTab.value = value
  if (import.meta.client) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${value}`)
  }
}

onMounted(() => {
  const hash = window.location.hash.replace(/^#/, '')
  if (visibleTabs.value.some(tab => tab.value === hash)) activeTab.value = hash as DashboardTab
})

onMounted(loadAdmins)
onMounted(async () => {
  if (canManageAccounts.value) await refreshAccounts()
})
onMounted(async () => {
  if (canManageCards.value) await refreshCards()
})
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 pb-32 pt-10 lg:px-8">
    <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="section-eyebrow">
          Dashboard
        </p>
        <h1 class="section-title">
          Administration du club
        </h1>
        <p class="section-desc">
          Statistiques du club, gestion des comptes et validation des contenus membres.
        </p>
        <!-- Un administrateur à périmètre voit noir sur blanc ce qui lui est
             confié (et donc pourquoi les autres onglets sont absents). -->
        <p
          v-if="user?.role === 'ADMIN' && user?.adminScopes?.length"
          class="mt-2 flex items-center gap-2 text-sm text-muted"
        >
          <UIcon
            name="i-lucide-shield-alert"
            class="h-4 w-4"
            aria-hidden="true"
          />
          <span>Administrateur à périmètre : {{ adminScopeLabels(user.adminScopes) }}.</span>
        </p>
      </div>
      <UButton
        color="neutral"
        variant="soft"
        icon="i-lucide-refresh-cw"
        label="Actualiser les statistiques"
        :loading="pending"
        @click="retryStats"
      />
    </div>

    <NotificationCenter class="mb-8" />
    <!-- Barre d’onglets : une action = un clic -->
    <div
      class="otaku-tabs mb-8"
      role="tablist"
      aria-label="Sections de l’administration"
    >
      <button
        v-for="tab in visibleTabs"
        :key="tab.value"
        type="button"
        role="tab"
        class="otaku-tab"
        :class="{ 'otaku-tab--active': activeTab === tab.value }"
        :aria-selected="activeTab === tab.value"
        @click="selectTab(tab.value)"
      >
        <UIcon
          :name="tab.icon"
          class="otaku-tab__icon"
          aria-hidden="true"
        />
        {{ tab.label }}
      </button>
    </div>

    <!-- Onglet : Vue d’ensemble -->
    <div
      v-show="activeTab === 'overview'"
      role="tabpanel"
      aria-label="Vue d’ensemble"
    >
      <section class="mb-8 surface-solid clip-corner p-6">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-book-open" class="h-4 w-4 text-brand" aria-hidden="true" />
          <p class="section-eyebrow">
            Guide administrateur
          </p>
        </div>
        <h2 class="section-title section-title--sub">
          Piloter le club avec méthode
        </h2>
        <div class="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <h3 class="flex items-center gap-2 font-semibold" style="color: var(--text-color);">
              <UIcon name="i-lucide-shield-check" class="h-4 w-4 text-brand" aria-hidden="true" />
              Tes responsabilités
            </h3>
            <p class="mt-1 text-sm text-muted">
              Valider les cartes, suivre les signalements, coordonner les événements et vérifier que les contenus restent conformes à l’esprit du Club Otaku ENEAM.
            </p>
          </div>
          <div>
            <h3 class="flex items-center gap-2 font-semibold" style="color: var(--text-color);">
              <UIcon name="i-lucide-list-checks" class="h-4 w-4 text-brand" aria-hidden="true" />
              Comment faire
            </h3>
            <p class="mt-1 text-sm text-muted">
              Utilise les boutons de chaque section, actualise après une action et réponds aux signalements depuis le dashboard super-admin ou le support prévu.
            </p>
          </div>
          <div>
            <h3 class="flex items-center gap-2 font-semibold" style="color: var(--text-color);">
              <UIcon name="i-lucide-store" class="h-4 w-4 text-brand" aria-hidden="true" />
              Déléguer la boutique
            </h3>
            <p class="mt-1 text-sm text-muted">
              Dans « Nommer un gestionnaire boutique », choisis un membre puis sélectionne « Gestionnaire boutique ». La personne reçoit immédiatement une notification.
            </p>
          </div>
          <div>
            <h3 class="flex items-center gap-2 font-semibold" style="color: var(--text-color);">
              <UIcon name="i-lucide-lock" class="h-4 w-4 text-brand" aria-hidden="true" />
              Bonnes pratiques
            </h3>
            <p class="mt-1 text-sm text-muted">
              Ne partage jamais les mots de passe, vérifie les informations avant publication et désactive rapidement un compte compromis.
            </p>
          </div>
        </div>
      </section>

      <AdminMembersTable class="mt-8" />

      <div
        v-if="error"
        class="empty-state surface-solid clip-corner mb-6"
      >
        <span class="empty-state__icon" aria-hidden="true">
          <UIcon name="i-lucide-triangle-alert" />
        </span>
        <h2 class="empty-state__title">
          Statistiques indisponibles
        </h2>
        <p class="empty-state__text">
          Accès administrateur requis pour afficher les statistiques du club.
        </p>
        <UButton
          class="mt-4"
          color="primary"
          icon="i-lucide-refresh-cw"
          label="Réessayer"
          @click="retryStats"
        />
      </div>

      <div
        v-if="pending"
        class="grid grid-cols-2 gap-5 lg:grid-cols-4"
      >
        <USkeleton
          v-for="index in 4"
          :key="index"
          class="h-32"
        />
      </div>

      <div
        v-else
        class="mt-6 grid grid-cols-2 gap-5 lg:grid-cols-4"
      >
        <div
          v-for="card in statCards"
          :key="card.key"
          class="stat-card surface-solid clip-corner-sm"
        >
          <div class="flex items-center gap-2">
            <UIcon :name="card.icon" class="h-4 w-4 text-brand" aria-hidden="true" />
            <span class="text-xs uppercase tracking-[0.2em] text-muted">{{ card.title }}</span>
          </div>
          <div class="mt-4 text-3xl font-black text-gradient-otaku">
            {{ card.value }}
          </div>
          <p class="mt-1 text-xs text-muted">
            {{ card.hint }}
          </p>
        </div>
      </div>

      <div class="mt-8 grid gap-6 lg:grid-cols-2">
        <div
          v-if="user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'"
          class="surface-solid clip-corner p-6"
        >
          <h2 class="flex items-center gap-2 text-xl font-semibold" style="color: var(--text-color);">
            <UIcon name="i-lucide-activity" class="h-5 w-5 text-brand" aria-hidden="true" />
            Activité récente
          </h2>
          <ul
            v-if="stats?.recent_signups.length"
            class="mt-5 space-y-4 text-muted"
          >
            <li
              v-for="signup in stats.recent_signups"
              :key="signup.id"
              class="flex items-start gap-2"
            >
              <UIcon name="i-lucide-user-plus" class="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
              <span>{{ signup.pseudo }} a rejoint {{ polesToText(signup, 'le club') }} · {{ formatDate(signup.createdAt) }}</span>
            </li>
          </ul>
          <div v-else class="empty-state-inline mt-5">
            <UIcon name="i-lucide-inbox" class="h-4 w-4" aria-hidden="true" />
            <span>Aucune activité récente.</span>
          </div>
        </div>

        <div class="surface-solid clip-corner p-6">
          <h2 class="flex items-center gap-2 text-xl font-semibold" style="color: var(--text-color);">
            <UIcon name="i-lucide-list-checks" class="h-5 w-5 text-brand" aria-hidden="true" />
            Missions
          </h2>
          <ul
            v-if="missions.length"
            class="mt-5 space-y-4 text-muted"
          >
            <li
              v-for="mission in missions"
              :key="mission.id"
              class="flex flex-wrap items-center gap-2"
            >
              <UIcon name="i-lucide-flag" class="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
              <span>{{ mission.title }}</span>
              <span class="text-xs uppercase tracking-[0.2em] text-accent-otaku">{{ mission.status }}</span>
            </li>
          </ul>
          <div v-else class="empty-state-inline mt-5">
            <UIcon name="i-lucide-inbox" class="h-4 w-4" aria-hidden="true" />
            <span>Aucune mission en cours.</span>
          </div>
        </div>
      </div>

    </div>

    <!-- Onglet : Administrateurs -->
    <div
      v-show="activeTab === 'admins'"
      role="tabpanel"
      aria-label="Administrateurs"
    >
      <section
        v-if="user?.role === 'SUPER_ADMIN' || user?.role === 'INTERMEDIATE_ADMIN'"
        class="surface-solid clip-corner p-6"
      >
        <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="section-eyebrow">
              Super-admin
            </p>
            <h2 class="section-title section-title--sub">
              Gestion des administrateurs
            </h2>
            <p class="section-desc">
              Crée un compte secondaire, limite-le si besoin à une partie de l’administration (périmètres : gaming, événementiel…), puis désactive ou supprime un accès devenu inutile.
            </p>
          </div>
          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-refresh-cw"
            label="Actualiser"
            :loading="adminsPending"
            @click="retryAdmins"
          />
        </div>

        <div class="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <form
            class="space-y-3"
            @submit.prevent="createAdmin"
          >
            <UFormField label="Email" required>
              <UInput
                v-model="adminEmail"
                icon="i-lucide-mail"
                class="w-full"
                type="email"
                placeholder="Email administrateur"
              />
            </UFormField>
            <UFormField label="Pseudo" required>
              <UInput
                v-model="adminPseudo"
                icon="i-lucide-user-cog"
                class="w-full"
                placeholder="Pseudo"
              />
            </UFormField>
            <UFormField label="Mot de passe" hint="8 caractères minimum." required>
              <UInput
                v-model="adminPassword"
                icon="i-lucide-lock"
                class="w-full"
                type="password"
                placeholder="Mot de passe"
              />
            </UFormField>
            <UFormField label="Pôle (optionnel)">
              <UInput
                v-model="adminPole"
                icon="i-lucide-layers"
                class="w-full"
                placeholder="Pôle"
              />
            </UFormField>
            <AppSelect
              v-model="adminRole"
              :options="adminRoleOptions"
              label="Rôle du compte"
              icon="i-lucide-shield"
              aria-label="Rôle du compte"
            />
            <!-- Périmètres : un administrateur peut être limité à une partie de
                 l'administration (ex. gaming seulement). Ne rien cocher =
                 administrateur complet, comme tous les comptes actuels. -->
            <AdminScopePicker
              v-if="adminRole === 'ADMIN'"
              v-model="adminScopes"
              :disabled="adminSubmitting"
            />
            <UButton
              type="submit"
              color="primary"
              icon="i-lucide-user-plus"
              class="w-full"
              :loading="adminSubmitting"
              :disabled="adminSubmitting"
              label="Créer l'administrateur"
            />
          </form>

          <div>
            <div v-if="adminsError" class="empty-state-inline">
              <UIcon name="i-lucide-triangle-alert" class="h-4 w-4" aria-hidden="true" />
              <span>La liste des administrateurs est indisponible.</span>
            </div>
            <div v-else-if="adminsPending" class="space-y-3">
              <USkeleton class="h-20" />
              <USkeleton class="h-20" />
            </div>
            <div v-else-if="admins.length === 0" class="empty-state-inline">
              <UIcon name="i-lucide-user-x" class="h-4 w-4" aria-hidden="true" />
              <span>Aucun administrateur secondaire.</span>
            </div>
            <ul
              v-else
              class="space-y-3"
            >
              <li
                v-for="admin in admins"
                :key="admin.id"
                class="admin-row"
                :class="{ 'admin-row--with-editor': scopeEditorFor === admin.id }"
              >
                <div class="min-w-0">
                  <div
                    class="font-semibold"
                    style="color: var(--text-color);"
                  >
                    {{ admin.pseudo }}
                  </div>
                  <div class="text-sm text-muted">
                    {{ admin.email }} · {{ admin.role === 'SHOP_MANAGER' ? 'Gestionnaire boutique' : admin.role === 'INTERMEDIATE_ADMIN' ? 'Administrateur intermédiaire' : 'Administrateur' }} · {{ admin.pole || 'Aucun pôle' }} — pôles : {{ polesToText(admin, 'non renseignés') }}
                  </div>
                  <div
                    v-if="admin.role === 'ADMIN'"
                    class="mt-1 text-xs"
                  >
                    <UBadge
                      :color="admin.adminScopes?.length ? 'primary' : 'neutral'"
                      variant="soft"
                      :icon="admin.adminScopes?.length ? 'i-lucide-shield-alert' : 'i-lucide-shield-check'"
                    >
                      {{ admin.adminScopes?.length ? `Périmètres : ${adminScopeLabels(admin.adminScopes)}` : 'Administrateur complet' }}
                    </UBadge>
                  </div>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <UButton
                    v-if="admin.role === 'ADMIN' && canDefineScopes"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    icon="i-lucide-shield"
                    :label="scopeEditorFor === admin.id ? 'Fermer' : 'Périmètres'"
                    :disabled="savingScopesId === admin.id"
                    @click="toggleScopeEditor(admin)"
                  />
                  <UBadge
                    :color="admin.isActive ? 'primary' : 'neutral'"
                    variant="soft"
                    :icon="admin.isActive ? 'i-lucide-circle-check' : 'i-lucide-circle-off'"
                  >
                    {{ admin.isActive ? 'ACTIF' : 'INACTIF' }}
                  </UBadge>
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    :icon="admin.isActive ? 'i-lucide-power-off' : 'i-lucide-power'"
                    :label="admin.isActive ? 'Désactiver' : 'Réactiver'"
                    :loading="updatingAdminId === admin.id"
                    :disabled="updatingAdminId === admin.id || removingAdminId === admin.id"
                    @click="toggleAdmin(admin)"
                  />
                  <UButton
                    color="error"
                    variant="ghost"
                    size="sm"
                    icon="i-lucide-trash-2"
                    label="Supprimer"
                    :loading="removingAdminId === admin.id"
                    :disabled="updatingAdminId === admin.id || removingAdminId === admin.id"
                    @click="removeAdmin(admin)"
                  />
                </div>

                <!-- Périmètres de cet administrateur : l'ADMIN_INTERMÉDIAIRE
                     (comme le SUPER_ADMIN) peut restreindre ses domaines ou lui
                     rendre l'accès complet. -->
                <div
                  v-if="scopeEditorFor === admin.id"
                  class="admin-scope-editor"
                >
                  <AdminScopePicker
                    v-model="scopeDraft"
                    :disabled="savingScopesId === admin.id"
                  />
                  <div class="flex flex-wrap items-center gap-2">
                    <UButton
                      color="primary"
                      size="sm"
                      icon="i-lucide-save"
                      label="Enregistrer les périmètres"
                      :loading="savingScopesId === admin.id"
                      :disabled="savingScopesId === admin.id"
                      @click="saveAdminScopes(admin)"
                    />
                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      icon="i-lucide-x"
                      label="Annuler"
                      :disabled="savingScopesId === admin.id"
                      @click="scopeEditorFor = null"
                    />
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

    </div>

    <!-- Onglet : Comptes -->
    <div
      v-show="activeTab === 'accounts'"
      role="tabpanel"
      aria-label="Comptes"
    >
      <section
        v-if="user?.role === 'ADMIN' || user?.role === 'INTERMEDIATE_ADMIN' || user?.role === 'SUPER_ADMIN'"
        class="surface-solid clip-corner p-6"
      >
        <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="section-eyebrow">
              Boutique
            </p>
            <h2 class="section-title section-title--sub">
              Nommer un gestionnaire boutique
            </h2>
            <p class="section-desc">
              Choisis un membre existant pour lui donner ou retirer la responsabilité de la boutique.
            </p>
          </div>
          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-refresh-cw"
            label="Actualiser"
            :loading="accountsPending"
            @click="() => refreshAccounts()"
          />
        </div>

        <div class="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <UInput
            v-model="accountSearch"
            icon="i-lucide-search"
            placeholder="Rechercher un membre..."
            class="max-w-md"
            aria-label="Rechercher un membre"
          />
          <span class="text-xs uppercase tracking-[0.2em] text-muted">
            {{ filteredManagedAccounts.length }} résultat(s)
          </span>
        </div>
        <div v-if="accountsError" class="empty-state-inline mt-5">
          <UIcon name="i-lucide-triangle-alert" class="h-4 w-4" aria-hidden="true" />
          <span>La liste des membres est indisponible.</span>
        </div>
        <div v-else-if="accountsPending" class="mt-5 space-y-3">
          <USkeleton class="h-20" />
          <USkeleton class="h-20" />
          <USkeleton class="h-20" />
        </div>
        <div v-else-if="filteredManagedAccounts.length === 0" class="empty-state-inline mt-5">
          <UIcon name="i-lucide-users" class="h-4 w-4" aria-hidden="true" />
          <span>Aucun membre disponible.</span>
        </div>
        <ul v-else class="mt-5 space-y-3">
          <li v-for="account in paginatedManagedAccounts" :key="account.id" class="admin-row">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-semibold" style="color: var(--text-color);">
                  {{ account.pseudo }}
                </span>
                <UBadge
                  :color="account.role === 'MEMBER' ? 'neutral' : 'primary'"
                  variant="soft"
                  :icon="account.role === 'MEMBER' ? 'i-lucide-user' : 'i-lucide-user-cog'"
                >
                  {{ account.role === 'MEMBER' ? 'Membre' : account.role === 'SHOP_MANAGER' ? 'Gestionnaire boutique' : account.role === 'ADMIN' ? 'Administrateur' : 'Administrateur intermédiaire' }}
                </UBadge>
              </div>
              <div class="text-sm text-muted">
                {{ account.nom || '' }} {{ account.prenom || '' }} · {{ account.email }} · {{ account.telephone || 'Numéro non renseigné' }} · {{ account.universite || 'Formation non renseignée' }} / {{ account.faculte || '—' }} / {{ account.filiere || '—' }} · pôles : {{ polesToText(account, 'aucun') }}
              </div>
            </div>
            <div class="admin-row__action">
              <AppSelect
                :model-value="account.role"
                :options="accountRoleOptions"
                icon="i-lucide-user-cog"
                size="sm"
                variant="filter"
                :aria-label="`Rôle de ${account.pseudo}`"
                :disabled="updatingShopManagerId === account.id || account.id === user?.id || (account.role === 'ADMIN' && user?.role !== 'INTERMEDIATE_ADMIN')"
                @update:model-value="updateShopManagerRole(account, $event as ManagedAccount['role'])"
              />
            </div>
          </li>
        </ul>
        <AppPagination
          :current-page="accountsPage"
          :total-pages="totalAccountPages"
          :item-count="filteredManagedAccounts.length"
          item-label="compte"
          @page-change="(page) => (accountsPage = page)"
        />
      </section>

    </div>

    <!-- Onglet : Cartes membres -->
    <div
      v-show="activeTab === 'cards'"
      role="tabpanel"
      aria-label="Cartes membres"
    >
      <section
        v-if="user?.role === 'ADMIN' || user?.role === 'INTERMEDIATE_ADMIN' || user?.role === 'SUPER_ADMIN'"
        class="surface-solid clip-corner p-6"
      >
        <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="section-eyebrow">
              Communauté
            </p>
            <h2 class="section-title section-title--sub">
              Validation des cartes Otaku
            </h2>
            <p class="section-desc">
              Valide ou refuse les cartes proposées par les membres avant leur publication.
            </p>
          </div>
          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-refresh-cw"
            label="Actualiser"
            :loading="cardsPending"
            @click="retryCards"
          />
        </div>

        <div class="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <UInput
            v-model="cardSearch"
            icon="i-lucide-search"
            placeholder="Rechercher une carte..."
            class="max-w-md"
            aria-label="Rechercher une carte"
          />
          <span class="text-xs uppercase tracking-[0.2em] text-muted">
            {{ filteredOtakuCards.length }} résultat(s)
          </span>
        </div>
        <div v-if="cardsError" class="empty-state-inline mt-5">
          <UIcon name="i-lucide-triangle-alert" class="h-4 w-4" aria-hidden="true" />
          <span>Les cartes sont temporairement indisponibles.</span>
        </div>
        <div v-else-if="cardsPending" class="mt-5 grid gap-4 lg:grid-cols-2">
          <USkeleton class="h-48" />
          <USkeleton class="h-48" />
        </div>
        <div v-else-if="filteredOtakuCards.length === 0" class="empty-state-inline mt-5">
          <UIcon name="i-lucide-id-card" class="h-4 w-4" aria-hidden="true" />
          <span>Aucune carte à examiner.</span>
        </div>
        <div
          v-else
          class="mt-5 grid gap-4 lg:grid-cols-2"
        >
          <article
            v-for="cardItem in paginatedOtakuCards"
            :key="cardItem.id"
            class="admin-row items-start"
          >
            <div class="min-w-0">
              <div
                class="font-semibold"
                style="color: var(--text-color);"
              >
                {{ cardItem.displayName }}
              </div>
              <p class="text-sm text-muted">
                {{ cardItem.user.nom || '' }} {{ cardItem.user.prenom || '' }} · {{ cardItem.user.pseudo }} · {{ cardItem.user.email }} · {{ cardItem.user.telephone || 'Numéro non renseigné' }}
              </p>
              <p class="mt-1 text-xs text-muted">
                <template v-if="cardItem.user.situation === 'PROFESSIONAL'">
                  Profession : {{ cardItem.user.profession || 'Non renseignée' }}
                </template>
                <template v-else>
                  {{ cardItem.user.situation === 'STUDENT_ABROAD' ? `Études · ${cardItem.user.pays || 'Pays non renseigné'}` : 'Études au Bénin' }}
                  · {{ cardItem.user.universite || 'Établissement non renseigné' }}
                  <template v-if="cardItem.user.faculte"> · {{ cardItem.user.faculte }}</template>
                  · {{ cardItem.user.filiere || 'Filière non renseignée' }}
                </template>
              </p>
              <div class="mt-2 text-xs text-muted">
                {{ cardItem.favoriteAnimes.join(' · ') || cardItem.favoriteAnime || 'Anime -' }} · {{ cardItem.favoriteMangas.join(' · ') || cardItem.favoriteManga || 'Manga -' }} · {{ cardItem.favoriteGame || 'Jeu -' }}
              </div>
              <p
                v-if="cardItem.bio"
                class="mt-2 text-sm text-muted"
              >
                {{ cardItem.bio }}
              </p>
            </div>
            <div class="flex flex-col items-end gap-2">
              <UBadge
                :color="cardStatusMeta[cardItem.status].color"
                variant="soft"
                :icon="cardStatusMeta[cardItem.status].icon"
              >
                {{ cardStatusMeta[cardItem.status].label }}
              </UBadge>
              <div class="flex flex-wrap gap-2">
                <UButton
                  size="sm"
                  color="success"
                  variant="soft"
                  icon="i-lucide-check"
                  label="Valider"
                  :loading="reviewingCardId === cardItem.id"
                  :disabled="reviewingCardId === cardItem.id"
                  @click="reviewCard(cardItem, 'APPROVED')"
                />
                <UButton
                  size="sm"
                  color="error"
                  variant="soft"
                  icon="i-lucide-x"
                  label="Refuser"
                  :disabled="reviewingCardId === cardItem.id"
                  @click="reviewCard(cardItem, 'REJECTED')"
                />
              </div>
            </div>
          </article>
        </div>
        <AppPagination
          :current-page="cardsPage"
          :total-pages="totalCardPages"
          :item-count="filteredOtakuCards.length"
          item-label="carte"
          @page-change="(page) => (cardsPage = page)"
        />
      </section>

    </div>
  </div>
</template>

<style scoped>
.section-eyebrow {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--primary-color);
}

.section-title {
  margin-top: 0.3rem;
  font-family: var(--font-display);
  font-size: clamp(1.6rem, 3vw, 2.25rem);
  font-weight: 900;
  color: var(--text-color);
}

.section-title--sub {
  font-size: clamp(1.2rem, 2.3vw, 1.5rem);
  font-weight: 800;
}

.section-desc {
  margin-top: 0.35rem;
  max-width: 62ch;
  font-size: 0.875rem;
  color: var(--muted-color);
}

.stat-card {
  padding: 1.25rem;
  transition: transform 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
}

.admin-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid var(--border-color);
  padding: 0.9rem 1rem;
}

.admin-row__action {
  min-width: 12rem;
}

/* Ligne d'administrateur dont l'éditeur de périmètres est ouvert : le panneau
   de périmètres occupe toute la largeur sous la ligne. */
.admin-row--with-editor {
  flex-wrap: wrap;
}

.admin-scope-editor {
  display: grid;
  flex-basis: 100%;
  gap: 0.6rem;
  margin-top: 0.4rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding: 3rem 1.5rem;
  text-align: center;
}

.empty-state__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3.25rem;
  height: 3.25rem;
  margin-bottom: 0.5rem;
  font-size: 1.75rem;
  color: var(--primary-color);
  background: rgba(var(--primary-color-rgb), 0.12);
  border: 1px solid rgba(var(--primary-color-rgb), 0.28);
  border-radius: 9999px;
}

.empty-state__title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-color);
}

.empty-state__text {
  max-width: 34rem;
  font-size: 0.875rem;
  color: var(--muted-color);
}

.empty-state-inline {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--muted-color);
}

@media (max-width: 640px) {
  .admin-row {
    align-items: stretch;
    flex-direction: column;
  }

  .admin-row > :last-child {
    flex-wrap: wrap;
  }

  .admin-row__action {
    min-width: 0;
  }
}
/* ---- Onglets de travail : une action = un clic, cible tactile 44 px ---- */
.otaku-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.otaku-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 2.75rem;
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 9999px;
  background: transparent;
  color: var(--text-color);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, transform 0.15s ease;
}

.otaku-tab:hover {
  border-color: rgba(var(--primary-color-rgb), 0.5);
  transform: translateY(-1px);
}

.otaku-tab--active {
  background: rgba(var(--primary-color-rgb), 0.18);
  border-color: var(--primary-color);
  font-weight: 600;
}

.otaku-tab__icon {
  height: 1rem;
  width: 1rem;
  color: var(--accent-color);
}

.otaku-tab--active .otaku-tab__icon {
  color: var(--primary-color);
}

.otaku-tabs + [role='tabpanel'] {
  margin-top: 1.25rem;
}

.otaku-tab__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.35rem;
  padding: 0 0.35rem;
  border-radius: 9999px;
  background: rgba(var(--primary-color-rgb), 0.14);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1.4;
  color: var(--primary-color);
}

</style>
