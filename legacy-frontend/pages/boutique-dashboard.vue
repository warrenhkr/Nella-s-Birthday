<script setup lang="ts">
import { productCategories } from '#shared/product-categories'
import NotificationCenter from '~/components-legacy/NotificationCenter.vue'

definePageMeta({ middleware: 'shop' })

type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED'
type ShopOrder = {
  id: string
  customerName: string
  phone: string
  deliveryNote: string | null
  total: number
  status: OrderStatus
  createdAt: string
  user: { pseudo: string, email: string }
  items: Array<{ name: string, quantity: number, unitPrice: number }>
}

type CatalogProduct = {
  id: string
  name: string
  tag: string
  category: string
  description: string | null
  price: number
  whatsappNumber: string | null
  stock: number
  imageUrl: string | null
  imageUrls: string[]
}

// Avis produit vu par la modération : auteur (pseudo), produit visé, note et
// commentaire. Miroir exact du GET /api/boutique/reviews.
type ProductReview = {
  id: string
  rating: number
  comment: string | null
  createdAt: string
  user: { pseudo: string }
  product: { id: string, name: string }
}

const { success, alert } = useGameToast()

// ============================================================
// COMMANDES
// ============================================================
const { data: response, pending, error, refresh } = await useFetch<{ data: ShopOrder[] }>('/api/boutique/orders')
const orders = computed(() => response.value?.data || [])
const updatingId = ref<string | null>(null)
const pendingStatus = ref<OrderStatus | null>(null)
// Typé `string` volontairement : AppSelect émet une chaîne (comme les autres
// sélecteurs du site), la conversion vers l'enum se fait au moment de filtrer.
const orderFilter = ref<string>('ALL')

const statuses: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED']
// Parcours normal d'une commande, puis l'annulation séparée : le gestionnaire
// voit d'abord la progression, ensuite l'action destructrice.
const statusFlow: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED']
const statusCancel: OrderStatus[] = ['CANCELLED']

// Libellés français des statuts : l'interface est en français, on n'affiche plus
// les valeurs brutes de l'enum Prisma.
const statusLabels: Record<OrderStatus, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  PREPARING: 'En préparation',
  READY: 'Prête',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée'
}

const statusIcons: Record<OrderStatus, string> = {
  PENDING: 'i-lucide-clock',
  CONFIRMED: 'i-lucide-check',
  PREPARING: 'i-lucide-package',
  READY: 'i-lucide-package-check',
  COMPLETED: 'i-lucide-circle-check',
  CANCELLED: 'i-lucide-circle-x'
}

const statusColors: Record<OrderStatus, 'primary' | 'neutral' | 'success' | 'warning' | 'error'> = {
  PENDING: 'warning',
  CONFIRMED: 'primary',
  PREPARING: 'primary',
  READY: 'success',
  COMPLETED: 'success',
  CANCELLED: 'error'
}

const orderFilterOptions = [
  { value: 'ALL', label: 'Toutes les commandes' },
  ...statuses.map(status => ({ value: status, label: statusLabels[status] }))
]

const visibleOrders = computed(() =>
  orderFilter.value === 'ALL'
    ? orders.value
    : orders.value.filter(order => order.status === orderFilter.value)
)

const orderFilterLabel = computed(() =>
  orderFilter.value === 'ALL' ? 'toutes les commandes' : (statusLabels[orderFilter.value as OrderStatus] ?? orderFilter.value)
)

const revenue = computed(() =>
  orders.value
    .filter(order => order.status !== 'CANCELLED')
    .reduce((sum, order) => sum + order.total, 0)
)

const kpis = computed(() => [
  { key: 'total', label: 'Commandes', value: String(orders.value.length), icon: 'i-lucide-receipt', hint: 'Toutes périodes' },
  { key: 'todo', label: 'À traiter', value: String(orders.value.filter(order => order.status === 'PENDING' || order.status === 'CONFIRMED').length), icon: 'i-lucide-clock', hint: 'En attente ou confirmées' },
  { key: 'ready', label: 'Prêtes', value: String(orders.value.filter(order => order.status === 'READY').length), icon: 'i-lucide-package-check', hint: 'À remettre au membre' },
  { key: 'revenue', label: 'Chiffre d’affaires', value: `${revenue.value.toLocaleString()} F`, icon: 'i-lucide-wallet', hint: 'Hors commandes annulées' }
])

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

async function updateStatus(order: ShopOrder, status: OrderStatus) {
  updatingId.value = order.id
  pendingStatus.value = status
  try {
    await $fetch(`/api/boutique/orders/${order.id}`, { method: 'PATCH', body: { status } })
    await refresh()
    // Une annulation restitue le stock : on le signale explicitement au gestionnaire.
    success(status === 'CANCELLED' && order.status !== 'CANCELLED'
      ? 'Commande annulée, stock restitué.'
      : 'Statut de commande mis à jour.')
  } catch (error: unknown) {
    alert(getApiErrorMessage(error, 'Impossible de mettre à jour cette commande.'))
  } finally {
    updatingId.value = null
    pendingStatus.value = null
  }
}

async function retryOrders() {
  await refresh()
}

// ============================================================
// CATALOGUE
// ============================================================
const { data: catalogResponse, pending: catalogPending, refresh: refreshCatalog } = await useFetch<{ data: CatalogProduct[] }>('/api/boutique/catalog')
const catalog = computed(() => catalogResponse.value?.data || [])
const uploadingProductId = ref<string | null>(null)
const creatingProduct = ref(false)
const updatingWhatsappId = ref<string | null>(null)
const savingProductId = ref<string | null>(null)
const deletingProductId = ref<string | null>(null)
const productImages = ref<Array<string | null>>([null, null, null])
const productForm = reactive({
  name: '',
  tag: '',
  category: 'goodies',
  description: '',
  price: 0,
  stock: 0,
  whatsappNumber: ''
})

// Options prêtes pour AppSelect (le seul sélecteur du site).
const categoryOptions = productCategories.map(category => ({ value: category.value, label: category.label }))

// Seuil d'alerte de stock : réglable par le gestionnaire et mémorisé sur son
// navigateur. En dessous (et au-dessus de zéro), le produit est signalé dans
// « Produits du catalogue ».
const lowStockThreshold = useLocalStorage<number>('otaku-shop-low-stock-threshold', 5)

function isLowStock(product: CatalogProduct) {
  return product.stock > 0 && product.stock <= lowStockThreshold.value
}

// Niveau de stock : une seule source de vérité pour la pastille média, le
// résumé chiffré de la carte et l'alerte visuelle. Le seuil est celui réglé
// par le gestionnaire (lowStockThreshold).
type StockLevel = 'in' | 'low' | 'out'

function stockLevel(product: CatalogProduct): StockLevel {
  if (product.stock === 0) return 'out'
  return product.stock <= lowStockThreshold.value ? 'low' : 'in'
}

function stockFactLabel(product: CatalogProduct) {
  const level = stockLevel(product)
  if (level === 'out') return 'Rupture de stock'
  if (level === 'low') return `Stock faible · ${product.stock} restant(s)`
  return `${product.stock} en stock`
}

const lowStockProducts = computed(() => catalog.value.filter(product => isLowStock(product)))
const outOfStockProducts = computed(() => catalog.value.filter(product => product.stock === 0))

async function updateProductImage(product: CatalogProduct, imageUrl: string | null) {
  uploadingProductId.value = product.id
  try {
    // On synchronise `imageUrls` avec l'image principale : sans cela, le
    // carrousel public continuait d'afficher l'ancienne image après un
    // remplacement ou une suppression.
    const secondaryImages = (product.imageUrls || []).filter(url => url && url !== product.imageUrl)
    const imageUrls = (imageUrl ? [imageUrl, ...secondaryImages] : secondaryImages).slice(0, 3)
    await $fetch(`/api/boutique/catalog/${product.id}`, {
      method: 'PATCH',
      body: { imageUrl, imageUrls }
    })
    await refreshCatalog()
    success(imageUrl ? 'Image produit mise à jour.' : 'Image produit supprimée.')
  } catch (error: unknown) {
    alert(getApiErrorMessage(error, 'Impossible de mettre à jour cette image produit.'))
  } finally {
    uploadingProductId.value = null
  }
}

const uploadedProductImages = computed(() => productImages.value.filter((image): image is string => Boolean(image)))

async function updateProductWhatsapp(product: CatalogProduct, value: string) {
  if (value !== '' && !/^\+[1-9]\d{7,14}$/.test(value)) {
    alert('Le numéro doit respecter le format international (+229XXXXXXXX).')
    return
  }

  updatingWhatsappId.value = product.id
  try {
    await $fetch(`/api/boutique/catalog/${product.id}`, {
      method: 'PATCH',
      body: { whatsappNumber: value || null }
    })
    await refreshCatalog()
    success('Numéro WhatsApp produit mis à jour.')
  } catch (error: unknown) {
    alert(getApiErrorMessage(error, 'Impossible de modifier le numéro WhatsApp.'))
  } finally {
    updatingWhatsappId.value = null
  }
}

async function updateProduct(product: CatalogProduct) {
  // L'API refuse un prix nul/négatif : on l'annonce avant l'appel réseau.
  if (!Number.isFinite(product.price) || product.price <= 0) {
    alert('Le prix doit être un montant positif en FCFA.')
    return
  }
  if (!Number.isFinite(product.stock) || product.stock < 0) {
    alert('Le stock doit être une quantité positive ou nulle.')
    return
  }

  savingProductId.value = product.id
  try {
    await $fetch(`/api/boutique/catalog/${product.id}`, {
      method: 'PATCH',
      body: {
        name: product.name,
        tag: product.tag,
        category: product.category,
        description: product.description,
        price: product.price,
        stock: product.stock
      }
    })
    await refreshCatalog()
    success('Produit modifié.')
  } catch (error: unknown) {
    alert(getApiErrorMessage(error, 'Impossible de modifier ce produit.'))
  } finally {
    savingProductId.value = null
  }
}

async function deleteProduct(product: CatalogProduct) {
  if (!window.confirm(`Supprimer ${product.name} ?`)) return
  deletingProductId.value = product.id
  try {
    await $fetch(`/api/boutique/catalog/${product.id}`, { method: 'DELETE' })
    await refreshCatalog()
    success('Produit supprimé.')
  } catch (error: unknown) {
    alert(getApiErrorMessage(error, 'Impossible de supprimer ce produit.'))
  } finally {
    deletingProductId.value = null
  }
}

async function createProduct() {
  if (!productForm.name.trim()) {
    alert('Renseigne le nom du produit.')
    return
  }
  if (uploadedProductImages.value.length === 0) {
    alert('Ajoute au moins une image produit.')
    return
  }
  if (!Number.isFinite(productForm.price) || productForm.price <= 0) {
    alert('Le prix doit être un montant positif en FCFA.')
    return
  }
  creatingProduct.value = true
  try {
    await $fetch('/api/boutique/catalog', {
      method: 'POST',
      body: { ...productForm, whatsappNumber: productForm.whatsappNumber || undefined, imageUrls: uploadedProductImages.value }
    })
    Object.assign(productForm, { name: '', tag: '', category: 'goodies', description: '', price: 0, stock: 0, whatsappNumber: '' })
    productImages.value = [null, null, null]
    await refreshCatalog()
    success('Produit publié dans la boutique.')
  } catch (error: unknown) {
    alert(getApiErrorMessage(error, 'Impossible de publier ce produit.'))
  } finally {
    creatingProduct.value = false
  }
}

// ============================================================
// AVIS PRODUITS (MODÉRATION)
// ============================================================
const { data: reviewsResponse, pending: reviewsPending, error: reviewsError, refresh: refreshReviews } = await useFetch<{ data: ProductReview[] }>('/api/boutique/reviews')
const reviews = computed(() => reviewsResponse.value?.data || [])
const deletingReviewId = ref<string | null>(null)

// Moyenne d'affichage : 0 sans avis (la section n'affiche le résumé que s'il y
// a au moins un avis).
const reviewAverage = computed(() =>
  reviews.value.length
    ? reviews.value.reduce((sum, review) => sum + review.rating, 0) / reviews.value.length
    : 0
)

async function deleteReview(review: ProductReview) {
  if (!window.confirm(`Retirer l’avis de ${review.user.pseudo} sur ${review.product.name} ?`)) return
  deletingReviewId.value = review.id
  try {
    await $fetch(`/api/boutique/reviews/${review.id}`, { method: 'DELETE' })
    await refreshReviews()
    success('Avis supprimé.')
  } catch (error: unknown) {
    alert(getApiErrorMessage(error, 'Impossible de retirer cet avis.'))
  } finally {
    deletingReviewId.value = null
  }
}

async function retryReviews() {
  await refreshReviews()
}

// ============================================================
// ONGLETS DE TRAVAIL
// Chaque grande section de la page devient un onglet afin qu'une
// action reste accessible en un clic. Rien n'est retiré : les
// sections restent montées (v-show) et gardent leurs identifiants
// d'ancre (#commandes, #gestion-produits, #creation-produit…).
// Ces ancres pilotent aussi l'onglet ouvert au chargement.
// ============================================================
type ShopTab = 'commandes' | 'gestion-produits' | 'moderation-avis' | 'creation-produit' | 'import'

const shopTabs: Array<{ value: ShopTab, label: string, icon: string }> = [
  { value: 'commandes', label: 'Commandes', icon: 'i-lucide-receipt' },
  { value: 'gestion-produits', label: 'Produits', icon: 'i-lucide-layout-grid' },
  { value: 'moderation-avis', label: 'Avis', icon: 'i-lucide-star' },
  { value: 'creation-produit', label: 'Ajouter un produit', icon: 'i-lucide-plus' },
  { value: 'import', label: 'Import', icon: 'i-lucide-cloud-upload' }
]

const activeTab = ref<ShopTab>('commandes')

// Repères chiffrés affichés dans la barre : le gestionnaire voit l'état
// des commandes, du catalogue et des avis sans changer d'onglet.
const tabCounts = computed<Partial<Record<ShopTab, number>>>(() => ({
  'commandes': orders.value.length,
  'gestion-produits': catalog.value.length,
  'moderation-avis': reviews.value.length
}))

function selectTab(value: ShopTab) {
  activeTab.value = value
  if (import.meta.client) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${value}`)
  }
}

onMounted(() => {
  const hash = window.location.hash.replace(/^#/, '')
  if (shopTabs.some(tab => tab.value === hash)) activeTab.value = hash as ShopTab
})

function getApiErrorMessage(errorValue: unknown, fallback: string) {
  if (typeof errorValue === 'object' && errorValue !== null && 'data' in errorValue) {
    const data = errorValue.data
    if (typeof data === 'object' && data !== null && 'statusMessage' in data && typeof data.statusMessage === 'string') return data.statusMessage
  }
  return fallback
}
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 pb-24 pt-10 lg:px-8">
    <!-- En-tête + actions principales -->
    <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="section-eyebrow">
          Boutique
        </p>
        <h1 class="section-title">
          Commandes à traiter
        </h1>
        <p class="section-desc">
          Les nouvelles commandes apparaissent ici pour l’équipe boutique. Fais progresser leur statut au fil de la préparation.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <NuxtLink to="/boutique">
          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-store"
            label="Voir la boutique"
          />
        </NuxtLink>
        <NuxtLink to="/boutique-catalogue">
          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-layout-grid"
            label="Gérer le catalogue"
          />
        </NuxtLink>
        <UButton
          color="primary"
          variant="soft"
          icon="i-lucide-refresh-cw"
          label="Actualiser"
          :loading="pending"
          @click="retryOrders"
        />
      </div>
    </div>

    <NotificationCenter class="mt-6" />

    <!-- KPI -->
    <div v-if="pending" class="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <USkeleton
        v-for="index in 4"
        :key="`kpi-${index}`"
        class="h-28"
      />
    </div>
    <div v-else class="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div
        v-for="kpi in kpis"
        :key="kpi.key"
        class="stat-card surface-solid clip-corner-sm p-4"
      >
        <div class="flex items-center gap-2">
          <UIcon :name="kpi.icon" class="h-4 w-4 text-brand" aria-hidden="true" />
          <span class="text-xs uppercase tracking-[0.2em] text-muted">{{ kpi.label }}</span>
        </div>
        <div class="mt-3 text-3xl font-black text-gradient-otaku">
          {{ kpi.value }}
        </div>
        <p class="mt-1 text-xs text-muted">
          {{ kpi.hint }}
        </p>
      </div>
    </div>

    <!-- Barre d'onglets : une action = un clic -->
    <div
      class="otaku-tabs mt-8"
      role="tablist"
      aria-label="Sections de la boutique"
    >
      <button
        v-for="tab in shopTabs"
        :key="tab.value"
        type="button"
        role="tab"
        class="otaku-tab"
        :class="{ 'otaku-tab--active': activeTab === tab.value }"
        :aria-selected="activeTab === tab.value"
        :aria-controls="tab.value"
        @click="selectTab(tab.value)"
      >
        <UIcon
          :name="tab.icon"
          class="otaku-tab__icon"
          aria-hidden="true"
        />
        {{ tab.label }}
        <span
          v-if="tabCounts[tab.value] !== undefined"
          class="otaku-tab__count"
        >{{ tabCounts[tab.value] }}</span>
      </button>
    </div>

    <!-- ============================ COMMANDES ============================ -->
    <section
      id="commandes"
      v-show="activeTab === 'commandes'"
      role="tabpanel"
      aria-label="Commandes"
      class="mt-8"
    >
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="section-eyebrow">
            Suivi
          </p>
          <h2 class="section-title section-title--sub">
            Commandes
          </h2>
          <p class="section-desc">
            Consulte le détail, puis fais évoluer le statut. Une annulation restitue automatiquement le stock.
          </p>
        </div>
        <div class="w-full sm:w-64">
          <AppSelect
            v-model="orderFilter"
            :options="orderFilterOptions"
            icon="i-lucide-filter"
            aria-label="Filtrer les commandes par statut"
            variant="filter"
          />
        </div>
      </div>

      <div v-if="pending" class="mt-5 space-y-4">
        <USkeleton
          v-for="index in 3"
          :key="`order-skeleton-${index}`"
          class="h-40"
        />
      </div>

      <div v-else-if="error" class="empty-state surface-solid clip-corner mt-5">
        <span class="empty-state__icon" aria-hidden="true">
          <UIcon name="i-lucide-triangle-alert" />
        </span>
        <h3 class="empty-state__title">
          Impossible de charger les commandes
        </h3>
        <p class="empty-state__text">
          La liste des commandes n’a pas pu être récupérée. Vérifie ta connexion puis réessaie.
        </p>
        <UButton
          class="mt-4"
          color="primary"
          icon="i-lucide-refresh-cw"
          label="Réessayer"
          @click="retryOrders"
        />
      </div>

      <div v-else-if="!orders.length" class="empty-state surface-solid clip-corner mt-5">
        <span class="empty-state__icon" aria-hidden="true">
          <UIcon name="i-lucide-shopping-cart" />
        </span>
        <h3 class="empty-state__title">
          Aucune commande pour le moment
        </h3>
        <p class="empty-state__text">
          Les commandes passées par les membres s’afficheront ici. En attendant, tu peux préparer le catalogue.
        </p>
        <NuxtLink to="/boutique-catalogue" class="mt-4 inline-block">
          <UButton color="primary" icon="i-lucide-layout-grid" label="Gérer le catalogue" />
        </NuxtLink>
      </div>

      <div v-else-if="!visibleOrders.length" class="empty-state surface-solid clip-corner mt-5">
        <span class="empty-state__icon" aria-hidden="true">
          <UIcon name="i-lucide-filter-x" />
        </span>
        <h3 class="empty-state__title">
          Aucune commande avec ce statut
        </h3>
        <p class="empty-state__text">
          Aucune commande ne correspond au filtre « {{ orderFilterLabel }} ».
        </p>
        <UButton
          class="mt-4"
          color="primary"
          variant="soft"
          icon="i-lucide-filter-x"
          label="Voir toutes les commandes"
          @click="orderFilter = 'ALL'"
        />
      </div>

      <div v-else class="mt-5 space-y-4">
        <article
          v-for="order in visibleOrders"
          :key="order.id"
          class="order-card surface-solid clip-corner p-5"
        >
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-3">
                <h3 class="text-lg font-semibold" style="color: var(--text-color);">
                  {{ order.customerName }}
                </h3>
                <UBadge
                  :color="statusColors[order.status]"
                  variant="soft"
                  :icon="statusIcons[order.status]"
                >
                  {{ statusLabels[order.status] }}
                </UBadge>
              </div>
              <p class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                <span class="inline-flex items-center gap-1.5">
                  <UIcon name="i-lucide-phone" class="h-3.5 w-3.5" aria-hidden="true" />
                  {{ order.phone }}
                </span>
                <span class="inline-flex items-center gap-1.5">
                  <UIcon name="i-lucide-calendar" class="h-3.5 w-3.5" aria-hidden="true" />
                  {{ formatDate(order.createdAt) }}
                </span>
              </p>
              <p class="mt-1 flex items-center gap-1.5 text-sm text-muted">
                <UIcon name="i-lucide-user-check" class="h-3.5 w-3.5" aria-hidden="true" />
                {{ order.user.pseudo }} ({{ order.user.email }})
              </p>
            </div>
            <strong class="flex items-center gap-1.5 text-xl text-accent-otaku">
              <UIcon name="i-lucide-wallet" class="h-5 w-5" aria-hidden="true" />
              {{ order.total.toLocaleString() }} FCFA
            </strong>
          </div>

          <div class="mt-4 grid gap-2 text-sm text-muted sm:grid-cols-2">
            <div
              v-for="item in order.items"
              :key="`${order.id}-${item.name}`"
              class="flex items-center gap-1.5"
            >
              <UIcon name="i-lucide-package" class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span class="truncate">{{ item.quantity }} × {{ item.name }} · {{ item.unitPrice.toLocaleString() }} FCFA</span>
            </div>
          </div>

          <p
            v-if="order.deliveryNote"
            class="mt-4 flex items-start gap-2 border-l-2 border-brand pl-3 text-sm text-muted"
          >
            <UIcon name="i-lucide-message-circle" class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{{ order.deliveryNote }}</span>
          </p>

          <div class="mt-5 flex flex-wrap items-center gap-2">
            <UButton
              v-for="status in statusFlow"
              :key="status"
              color="neutral"
              :variant="order.status === status ? 'solid' : 'outline'"
              size="sm"
              :icon="statusIcons[status]"
              :label="statusLabels[status]"
              :disabled="updatingId === order.id"
              :loading="pendingStatus === status && updatingId === order.id"
              @click="updateStatus(order, status)"
            />
            <span class="status-sep" aria-hidden="true" />
            <UButton
              v-for="status in statusCancel"
              :key="status"
              :color="order.status === status ? 'error' : 'neutral'"
              :variant="order.status === status ? 'solid' : 'outline'"
              size="sm"
              :icon="statusIcons[status]"
              :label="statusLabels[status]"
              :disabled="updatingId === order.id"
              :loading="pendingStatus === status && updatingId === order.id"
              @click="updateStatus(order, status)"
            />
          </div>
        </article>
      </div>
    </section>

    <!-- ======================= PRODUITS / CATALOGUE ====================== -->
    <section
      id="gestion-produits"
      v-show="activeTab === 'gestion-produits'"
      role="tabpanel"
      aria-label="Produits du catalogue"
      class="mt-10"
    >
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="section-eyebrow">
            Catalogue
          </p>
          <h2 class="section-title section-title--sub">
            Produits du catalogue
          </h2>
          <p class="section-desc">
            Corrige le prix, le stock, la catégorie, l’image ou le numéro WhatsApp d’un produit, puis enregistre.
          </p>
        </div>
        <div class="flex flex-wrap items-end gap-2">
          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-refresh-cw"
            label="Actualiser"
            :loading="catalogPending"
            @click="() => refreshCatalog()"
          />
          <NuxtLink to="/boutique-produits">
            <UButton color="primary" icon="i-lucide-plus" label="Ajouter un produit" />
          </NuxtLink>
        </div>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-3">
        <UBadge
          v-if="lowStockProducts.length"
          color="warning"
          variant="soft"
          icon="i-lucide-triangle-alert"
        >
          {{ lowStockProducts.length }} stock(s) faible(s)
        </UBadge>
        <UBadge
          v-if="outOfStockProducts.length"
          color="error"
          variant="soft"
          icon="i-lucide-package-x"
        >
          {{ outOfStockProducts.length }} rupture(s)
        </UBadge>
        <UBadge
          v-if="!lowStockProducts.length && !outOfStockProducts.length && catalog.length"
          color="success"
          variant="soft"
          icon="i-lucide-boxes"
        >
          Stocks sains
        </UBadge>
        <div class="flex items-center gap-2">
          <span class="text-xs text-muted">Seuil d’alerte :</span>
          <UInput
            v-model.number="lowStockThreshold"
            type="number"
            min="1"
            max="99"
            size="sm"
            icon="i-lucide-triangle-alert"
            aria-label="Seuil d'alerte de stock"
            class="w-24"
          />
        </div>
      </div>

      <div v-if="catalogPending && !catalog.length" class="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <USkeleton
          v-for="index in 3"
          :key="`catalog-skeleton-${index}`"
          class="h-96"
        />
      </div>

      <div v-else-if="!catalog.length" class="empty-state surface-solid clip-corner mt-5">
        <span class="empty-state__icon" aria-hidden="true">
          <UIcon name="i-lucide-package" />
        </span>
        <h3 class="empty-state__title">
          Aucun produit à illustrer
        </h3>
        <p class="empty-state__text">
          Le catalogue est vide. Publie un premier produit ci-dessous ou importe un fichier CSV.
        </p>
      </div>

      <div v-else class="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="product in catalog"
          :key="product.id"
          class="product-edit-card surface-solid clip-corner-sm"
        >
          <!-- Visuel + état du stock -->
          <div class="product-edit-card__media">
            <div
              v-if="product.imageUrl"
              class="h-36 w-full rounded-lg bg-cover bg-center"
              :style="{ backgroundImage: `url(${product.imageUrl})` }"
            />
            <div
              v-else
              class="flex h-36 w-full items-center justify-center rounded-lg border border-dashed border-default"
            >
              <UIcon name="i-lucide-image-off" class="h-6 w-6 text-muted" aria-hidden="true" />
            </div>
            <UBadge
              v-if="product.stock === 0"
              class="mt-2"
              color="error"
              variant="soft"
              icon="i-lucide-package-x"
            >
              Rupture de stock
            </UBadge>
            <UBadge
              v-else-if="isLowStock(product)"
              class="mt-2"
              color="warning"
              variant="soft"
              icon="i-lucide-triangle-alert"
            >
              Stock faible (≤ {{ lowStockThreshold }})
            </UBadge>
            <UBadge
              v-else
              class="mt-2"
              color="success"
              variant="soft"
              icon="i-lucide-boxes"
            >
              {{ product.stock }} en stock
            </UBadge>
          </div>

          <!-- Champs modifiables -->
          <div class="mt-4 grid gap-3">
            <UFormField label="Nom">
              <UInput
                v-model="product.name"
                icon="i-lucide-package"
                class="w-full"
                placeholder="Nom du produit"
              />
            </UFormField>
            <UFormField label="Tags">
              <UInput
                v-model="product.tag"
                icon="i-lucide-tags"
                class="w-full"
                placeholder="Tag du produit"
              />
            </UFormField>
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="Prix (FCFA)">
                <UInput
                  v-model.number="product.price"
                  icon="i-lucide-wallet"
                  class="w-full"
                  type="number"
                  min="1"
                  placeholder="Prix"
                />
              </UFormField>
              <UFormField label="Stock">
                <UInput
                  v-model.number="product.stock"
                  icon="i-lucide-boxes"
                  class="w-full"
                  type="number"
                  min="0"
                  placeholder="Stock"
                />
              </UFormField>
            </div>
            <AppSelect
              v-model="product.category"
              :options="categoryOptions"
              label="Catégorie"
              icon="i-lucide-layout-grid"
              size="sm"
              :aria-label="`Catégorie de ${product.name}`"
            />
            <UFormField label="Description">
              <UTextarea
                :model-value="product.description || ''"
                class="w-full"
                :rows="2"
                placeholder="Description du produit"
                @update:model-value="product.description = $event"
              />
            </UFormField>
            <UFormField
              label="WhatsApp de commande"
              hint="Laisse vide pour utiliser le numéro général. Format +229XXXXXXXX."
            >
              <UInput
                :model-value="product.whatsappNumber || ''"
                icon="i-lucide-phone"
                class="w-full"
                placeholder="+229XXXXXXXX"
                :aria-label="`Numéro WhatsApp de ${product.name}`"
                :disabled="updatingWhatsappId === product.id"
                @change="updateProductWhatsapp(product, ($event.target as HTMLInputElement).value)"
              />
            </UFormField>
            <div class="product-edit-card__facts">
              <p class="fact fact--price">
                <UIcon name="i-lucide-wallet" class="h-4 w-4" aria-hidden="true" />
                <span class="fact__amount">{{ product.price.toLocaleString() }}</span>
                <span class="fact__unit">FCFA</span>
              </p>
              <p class="fact" :class="`fact--${stockLevel(product)}`">
                <UIcon
                  :name="stockLevel(product) === 'out'
                    ? 'i-lucide-package-x'
                    : stockLevel(product) === 'low' ? 'i-lucide-triangle-alert' : 'i-lucide-boxes'"
                  class="h-4 w-4"
                  aria-hidden="true"
                />
                {{ stockFactLabel(product) }}
              </p>
            </div>
          </div>

          <!-- Actions -->
          <div class="mt-4 flex flex-wrap gap-2">
            <UButton
              icon="i-lucide-save"
              label="Enregistrer"
              color="primary"
              variant="soft"
              :loading="savingProductId === product.id"
              :disabled="savingProductId === product.id || deletingProductId === product.id"
              @click="updateProduct(product)"
            />
            <UButton
              icon="i-lucide-trash-2"
              label="Supprimer"
              color="error"
              variant="soft"
              :loading="deletingProductId === product.id"
              :disabled="savingProductId === product.id || deletingProductId === product.id"
              @click="deleteProduct(product)"
            />
          </div>

          <div class="mt-4">
            <ImageUpload
              :model-value="product.imageUrl"
              label="Image produit"
              :disabled="uploadingProductId === product.id"
              @update:model-value="updateProductImage(product, $event)"
            />
          </div>
        </article>
      </div>
    </section>

    <!-- ======================= AVIS PRODUITS ======================= -->
    <section
      id="moderation-avis"
      v-show="activeTab === 'moderation-avis'"
      role="tabpanel"
      aria-label="Avis produits"
      class="mt-10"
    >
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="section-eyebrow">
            Modération
          </p>
          <h2 class="section-title section-title--sub">
            Avis produits
          </h2>
          <p class="section-desc">
            Les avis sont visibles sur la boutique publique : tu peux retirer un avis abusif.
          </p>
        </div>
        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-refresh-cw"
          label="Actualiser"
          :loading="reviewsPending"
          @click="() => refreshReviews()"
        />
      </div>

      <div
        v-if="reviews.length"
        class="mt-4 flex flex-wrap items-center gap-3"
      >
        <UBadge
          color="primary"
          variant="soft"
          icon="i-lucide-star"
        >
          {{ reviews.length }} avis · {{ reviewAverage.toFixed(1) }}/5 de moyenne
        </UBadge>
      </div>

      <div v-if="reviewsPending && !reviews.length" class="mt-5 grid gap-3">
        <USkeleton
          v-for="index in 3"
          :key="`reviews-skeleton-${index}`"
          class="h-24"
        />
      </div>

      <div v-else-if="reviewsError" class="empty-state surface-solid clip-corner mt-5">
        <span class="empty-state__icon" aria-hidden="true">
          <UIcon name="i-lucide-message-square" />
        </span>
        <h3 class="empty-state__title">
          Avis indisponibles
        </h3>
        <p class="empty-state__text">
          Impossible de charger les avis produits pour le moment.
        </p>
        <UButton
          class="mt-4"
          color="neutral"
          variant="soft"
          icon="i-lucide-refresh-cw"
          label="Réessayer"
          @click="retryReviews"
        />
      </div>

      <div v-else-if="!reviews.length" class="empty-state surface-solid clip-corner mt-5">
        <span class="empty-state__icon" aria-hidden="true">
          <UIcon name="i-lucide-star" />
        </span>
        <h3 class="empty-state__title">
          Aucun avis pour le moment
        </h3>
        <p class="empty-state__text">
          Les avis laissés par les membres sur les produits de la boutique apparaîtront ici.
        </p>
      </div>

      <div v-else class="mt-5 grid gap-3">
        <article
          v-for="review in reviews"
          :key="review.id"
          class="review-row surface-solid clip-corner-sm"
        >
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="review-row__author">
                <UIcon name="i-lucide-user" class="h-3.5 w-3.5" aria-hidden="true" />
                {{ review.user.pseudo }}
              </span>
              <UBadge color="neutral" variant="soft" icon="i-lucide-package">
                {{ review.product.name }}
              </UBadge>
              <UBadge
                :color="review.rating >= 4 ? 'success' : review.rating >= 3 ? 'warning' : 'error'"
                variant="soft"
                icon="i-lucide-star"
              >
                {{ review.rating }}/5
              </UBadge>
              <span class="text-xs text-muted">{{ formatDate(review.createdAt) }}</span>
            </div>
            <p v-if="review.comment" class="review-row__comment">
              {{ review.comment }}
            </p>
            <p v-else class="review-row__comment review-row__comment--empty">
              Aucun commentaire.
            </p>
          </div>

          <UButton
            class="shrink-0"
            icon="i-lucide-trash-2"
            label="Retirer"
            color="error"
            variant="soft"
            :loading="deletingReviewId === review.id"
            :disabled="deletingReviewId === review.id"
            @click="deleteReview(review)"
          />
        </article>
      </div>
    </section>

    <!-- ======================= CRÉATION DE PRODUIT ======================= -->
    <section
      id="creation-produit"
      v-show="activeTab === 'creation-produit'"
      role="tabpanel"
      aria-label="Ajouter un produit"
      class="mt-10 surface-solid clip-corner p-5"
    >
      <div>
        <p class="section-eyebrow">
          Catalogue
        </p>
        <h2 class="section-title section-title--sub">
          Publier un produit
        </h2>
        <p class="section-desc">
          Renseigne le nom, le tag, la catégorie, le prix, le stock et au moins une image. Le numéro WhatsApp doit respecter le format +229XXXXXXXX.
        </p>
      </div>

      <form
        class="mt-5 grid gap-4 md:grid-cols-2"
        @submit.prevent="createProduct"
      >
        <UFormField label="Nom du produit" required>
          <UInput
            v-model="productForm.name"
            icon="i-lucide-package"
            class="w-full"
            placeholder="Nom du produit"
          />
        </UFormField>
        <UFormField label="Tags" hint="Sépare plusieurs tags par des virgules." required>
          <UInput
            v-model="productForm.tag"
            icon="i-lucide-tags"
            class="w-full"
            placeholder="Ex. nouveau, édition club, Naruto"
          />
        </UFormField>
        <AppSelect
          v-model="productForm.category"
          :options="categoryOptions"
          label="Catégorie"
          icon="i-lucide-layout-grid"
          aria-label="Catégorie du produit"
        />
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Prix (FCFA)" required>
            <UInput
              v-model.number="productForm.price"
              icon="i-lucide-wallet"
              class="w-full"
              type="number"
              min="1"
              placeholder="Prix"
            />
          </UFormField>
          <UFormField label="Stock initial" required>
            <UInput
              v-model.number="productForm.stock"
              icon="i-lucide-boxes"
              class="w-full"
              type="number"
              min="0"
              placeholder="Stock"
            />
          </UFormField>
        </div>
        <UFormField
          label="WhatsApp de commande"
          hint="Format strict obligatoire : +229XXXXXXXX. Les commandes de ce produit ouvriront ce numéro."
        >
          <UInput
            v-model="productForm.whatsappNumber"
            icon="i-lucide-phone"
            class="w-full"
            placeholder="+229XXXXXXXX"
          />
        </UFormField>
        <UFormField label="Description" class="md:col-span-2">
          <ClientOnly>
            <RichTextEditor
              v-model="productForm.description"
              :max-characters="2000"
              aria-label="Description du produit"
              placeholder="Description du produit (optionnel)"
              hint="2 000 caractères de texte maximum. La mise en forme ne compte pas."
            />
            <template #fallback>
              <UTextarea
                v-model="productForm.description"
                class="w-full"
                :rows="4"
                maxlength="2000"
                aria-label="Description du produit"
                placeholder="Description du produit (optionnel)"
              />
            </template>
          </ClientOnly>
        </UFormField>

        <div class="md:col-span-2">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-image" class="h-4 w-4 text-brand" aria-hidden="true" />
            <p class="text-sm font-semibold" style="color: var(--text-color);">
              Image du produit
            </p>
          </div>
          <p class="mt-1 text-xs text-muted">
            Ajoute jusqu’à trois images : elles seront affichées dans un carousel sur la boutique. La première est l’image principale.
          </p>
          <div class="mt-2 grid gap-3 sm:grid-cols-3">
            <ImageUpload
              v-for="(image, index) in productImages"
              :key="index"
              v-model="productImages[index]"
              :label="`Image ${index + 1}`"
              :disabled="creatingProduct"
              :description="index === 0 ? 'Image principale, 5 Mo maximum' : 'Image facultative, 5 Mo maximum'"
            />
          </div>
          <div v-if="productForm.name || uploadedProductImages.length" class="mt-5 rounded-xl border border-default p-4">
            <p class="section-eyebrow">
              Aperçu avant publication
            </p>
            <div class="mt-3 grid gap-4 sm:grid-cols-[8rem_1fr]">
              <img
                v-if="uploadedProductImages[0]"
                :src="uploadedProductImages[0]"
                alt="Aperçu du produit"
                class="h-32 w-full rounded-lg object-cover sm:h-32"
              >
              <div
                v-else
                class="flex h-32 items-center justify-center rounded-lg border border-dashed border-default"
              >
                <UIcon name="i-lucide-image-off" class="h-6 w-6 text-muted" aria-hidden="true" />
              </div>
              <div class="min-w-0">
                <h3 class="text-lg font-semibold" style="color: var(--text-color);">
                  {{ productForm.name || 'Nom du produit' }}
                </h3>
                <RichTextContent
                  v-if="productForm.description"
                  class="mt-1 text-sm text-muted"
                  :content="productForm.description"
                />
                <p
                  v-else
                  class="mt-1 text-sm text-muted"
                >
                  Description du produit
                </p>
                <p class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-bold text-accent-otaku">
                  <span class="inline-flex items-center gap-1.5">
                    <UIcon name="i-lucide-wallet" class="h-4 w-4" aria-hidden="true" />
                    {{ Number(productForm.price || 0).toLocaleString() }} FCFA
                  </span>
                  <span class="inline-flex items-center gap-1.5">
                    <UIcon name="i-lucide-boxes" class="h-4 w-4" aria-hidden="true" />
                    {{ productForm.stock }} en stock
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <UButton
          class="md:col-span-2"
          type="submit"
          color="primary"
          icon="i-lucide-plus"
          :loading="creatingProduct"
          :disabled="creatingProduct"
          label="Publier le produit"
        />
      </form>
    </section>

    <div
      id="import"
      v-show="activeTab === 'import'"
      role="tabpanel"
      aria-label="Import et guides"
    >
      <!-- ===================== IMPORT EN MASSE ===================== -->
      <section class="mt-10 surface-solid clip-corner p-5">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-cloud-upload" class="h-4 w-4 text-brand" aria-hidden="true" />
          <p class="section-eyebrow">
            Import à gros volume
          </p>
        </div>
        <h2 class="section-title section-title--sub">
          Guide des imports catalogue
        </h2>
        <div class="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <h3 class="flex items-center gap-2 font-semibold" style="color: var(--text-color);">
              <UIcon name="i-lucide-file-spreadsheet" class="h-4 w-4 text-brand" aria-hidden="true" />
              CSV simple
            </h3>
            <p class="mt-1 text-sm text-muted">
              Un CSV est un tableau texte exporté depuis Excel ou Sheets. Télécharge le modèle CSV ou Excel, remplis une ligne par produit, puis sélectionne le fichier dans l’import.
            </p>
          </div>
          <div>
            <h3 class="flex items-center gap-2 font-semibold" style="color: var(--text-color);">
              <UIcon name="i-lucide-image" class="h-4 w-4 text-brand" aria-hidden="true" />
              Images par URL
            </h3>
            <p class="mt-1 text-sm text-muted">
              Les photos ne doivent pas être intégrées directement dans le CSV. Prépare d’abord les URL Cloudinary ou les liens d’images valides, puis importe les liens.
            </p>
          </div>
          <div>
            <h3 class="flex items-center gap-2 font-semibold" style="color: var(--text-color);">
              <UIcon name="i-lucide-clipboard-check" class="h-4 w-4 text-brand" aria-hidden="true" />
              Validation avant publication
            </h3>
            <p class="mt-1 text-sm text-muted">
              Les colonnes attendues sont nom, description, catégorie, prix, stock et WhatsApp. Les lignes invalides et doublons sont signalés avant l’insertion ; seules les lignes conformes sont créées.
            </p>
          </div>
        </div>
      </section>

      <ProductBulkImport class="mt-6" @imported="refreshCatalog" />

      <!-- ===================== GUIDE SHOP MANAGER ===================== -->
      <section class="mt-10 surface-solid clip-corner p-5">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-book-open" class="h-4 w-4 text-brand" aria-hidden="true" />
          <p class="section-eyebrow">
            Guide shop manager
          </p>
        </div>
        <h2 class="section-title section-title--sub">
          Gérer la boutique efficacement
        </h2>
        <div class="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <h3 class="flex items-center gap-2 font-semibold" style="color: var(--text-color);">
              <UIcon name="i-lucide-package" class="h-4 w-4 text-brand" aria-hidden="true" />
              Publier un produit
            </h3>
            <p class="mt-1 text-sm text-muted">
              Renseigne le nom, le tag, la catégorie, le prix, le stock et au moins une image. Le numéro WhatsApp doit respecter exactement le format international, par exemple +229XXXXXXXX.
            </p>
          </div>
          <div>
            <h3 class="flex items-center gap-2 font-semibold" style="color: var(--text-color);">
              <UIcon name="i-lucide-phone" class="h-4 w-4 text-brand" aria-hidden="true" />
              Choisir le numéro de commande
            </h3>
            <p class="mt-1 text-sm text-muted">
              Chaque produit peut avoir son propre numéro WhatsApp. Modifie-le dans « Produits du catalogue » puis valide le champ ; le bouton Commander utilisera ce numéro.
            </p>
          </div>
          <div>
            <h3 class="flex items-center gap-2 font-semibold" style="color: var(--text-color);">
              <UIcon name="i-lucide-receipt" class="h-4 w-4 text-brand" aria-hidden="true" />
              Traiter une commande
            </h3>
            <p class="mt-1 text-sm text-muted">
              Consulte les détails, puis fais progresser le statut de PENDING à CONFIRMED, PREPARING, READY et COMPLETED. Utilise CANCELLED uniquement si nécessaire.
            </p>
          </div>
          <div>
            <h3 class="flex items-center gap-2 font-semibold" style="color: var(--text-color);">
              <UIcon name="i-lucide-boxes" class="h-4 w-4 text-brand" aria-hidden="true" />
              Stock et qualité
            </h3>
            <p class="mt-1 text-sm text-muted">
              Garde le stock réel à jour, remplace les images obsolètes et vérifie le prix avant de publier. Les membres reçoivent les informations depuis la boutique publique.
            </p>
          </div>
        </div>
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
  font-size: clamp(1.25rem, 2.4vw, 1.6rem);
  font-weight: 800;
}

.section-desc {
  margin-top: 0.35rem;
  max-width: 62ch;
  font-size: 0.875rem;
  color: var(--muted-color);
}

.stat-card {
  transition: transform 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
}

.order-card {
  border-left: 3px solid var(--accent-color);
}

.status-sep {
  width: 1px;
  align-self: stretch;
  min-height: 1.75rem;
  background: var(--border-color);
}

.product-edit-card {
  display: flex;
  flex-direction: column;
  padding: 1rem;
}

/* ---- Résumé chiffré du produit : prix FCFA + alerte stock ---- */
.product-edit-card__facts {
  margin-top: auto;
  padding-top: 0.65rem;
  border-top: 1px dashed var(--border-color);
}

.fact {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--muted-color);
}

.fact + .fact {
  margin-top: 0.3rem;
}

.fact--price {
  color: var(--accent-color);
}

.fact__amount {
  font-size: 1.2rem;
  font-weight: 900;
  line-height: 1;
}

.fact__unit {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.fact--low {
  color: var(--ui-color-warning-600);
}

.fact--out {
  color: var(--primary-color);
}

.theme-light .fact--low { color: var(--ui-color-warning-600); }

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

/* ---- Avis produits : une ligne par avis, retrait à droite ---- */
.review-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border-left: 3px solid var(--primary-color);
}

.review-row__author {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-color);
}

.review-row__comment {
  margin-top: 0.4rem;
  font-size: 0.875rem;
  color: var(--muted-color);
  overflow-wrap: anywhere;
}

.review-row__comment--empty {
  font-style: italic;
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
