<script setup lang="ts">
import { productCategories } from '#shared/product-categories'
import { htmlToPlainText } from '#shared/rich-text'

definePageMeta({ middleware: 'shop' })

type Product = {
  id: string
  name: string
  tag: string
  category: string
  description: string | null
  price: number
  stock: number
  whatsappNumber: string | null
  imageUrl: string | null
  imageUrls: string[]
}

const { success, alert } = useGameToast()
const { data, pending, error, refresh } = await useFetch<{ data: Product[] }>('/api/boutique/catalog')
const products = computed(() => data.value?.data || [])
const selectedProduct = ref<Product | null>(null)

const search = ref('')
const categoryFilter = ref('Tous')
const removingId = ref<string | null>(null)

// Seuil d'alerte de stock, aligné sur le dashboard boutique.
const LOW_STOCK_THRESHOLD = 5

// Options prêtes pour AppSelect (le seul sélecteur du site).
const categoryOptions = [
  { value: 'Tous', label: 'Toutes les catégories' },
  ...productCategories.map(category => ({ value: category.value, label: category.label }))
]

const filteredProducts = computed(() => {
  const needle = search.value.trim().toLowerCase()
  return products.value.filter((product) => {
    const matchesCategory = categoryFilter.value === 'Tous' || product.category === categoryFilter.value
    const matchesSearch = !needle
      || product.name.toLowerCase().includes(needle)
      || (product.tag || '').toLowerCase().includes(needle)
    return matchesCategory && matchesSearch
  })
})

const isFiltered = computed(() => Boolean(search.value.trim()) || categoryFilter.value !== 'Tous')

// KPI du catalogue : visibles d'un coup d'œil pour le gestionnaire boutique.
const statCards = computed(() => [
  { key: 'total', label: 'Produits', value: String(products.value.length), icon: 'i-lucide-package', hint: 'Catalogue complet' },
  { key: 'in-stock', label: 'En stock', value: String(products.value.filter(product => product.stock > 0).length), icon: 'i-lucide-boxes', hint: 'Disponibles à la vente' },
  { key: 'low', label: 'Stocks faibles', value: String(products.value.filter(product => product.stock > 0 && product.stock <= LOW_STOCK_THRESHOLD).length), icon: 'i-lucide-triangle-alert', hint: `Seuil ≤ ${LOW_STOCK_THRESHOLD}` },
  { key: 'out', label: 'Ruptures', value: String(products.value.filter(product => product.stock === 0).length), icon: 'i-lucide-package-x', hint: 'À réapprovisionner' }
])

function resetFilters() {
  search.value = ''
  categoryFilter.value = 'Tous'
}

function productImage(product: Product) {
  return product.imageUrls?.[0] || product.imageUrl || null
}

// Niveau de stock : une seule source de vérité pour la pastille, la ligne
// « stock » et l'alerte visuelle de la carte. Seuil aligné sur le dashboard.
type StockLevel = 'in' | 'low' | 'out'

function stockLevel(product: Product): StockLevel {
  if (product.stock === 0) return 'out'
  return product.stock <= LOW_STOCK_THRESHOLD ? 'low' : 'in'
}

function stockLabel(product: Product) {
  const level = stockLevel(product)
  if (level === 'out') return 'Rupture de stock'
  if (level === 'low') return `Stock faible · ${product.stock} restant(s)`
  return `${product.stock} en stock`
}

function stockIcon(product: Product) {
  const level = stockLevel(product)
  if (level === 'out') return 'i-lucide-package-x'
  return level === 'low' ? 'i-lucide-triangle-alert' : 'i-lucide-boxes'
}

// Les erreurs de l'API portent le vrai message métier dans `statusMessage`
// (ex. « Ce produit est lié à une commande… ») : on l'affiche tel quel.
function getApiErrorMessage(errorValue: unknown, fallback: string) {
  if (typeof errorValue === 'object' && errorValue !== null && 'data' in errorValue) {
    const data = errorValue.data
    if (typeof data === 'object' && data !== null && 'statusMessage' in data && typeof data.statusMessage === 'string') return data.statusMessage
  }
  return fallback
}

async function remove(product: Product) {
  if (!window.confirm(`Supprimer ${product.name} ?`)) return
  removingId.value = product.id
  try {
    await $fetch(`/api/boutique/catalog/${product.id}`, { method: 'DELETE' })
    await refresh()
    success('Produit supprimé.')
  } catch (error: unknown) {
    alert(getApiErrorMessage(error, 'Impossible de supprimer ce produit.'))
  } finally {
    removingId.value = null
  }
}
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 pb-20 pt-10 lg:px-8">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <NuxtLink
          to="/boutique-dashboard"
          class="inline-flex items-center gap-1.5 text-sm text-brand"
        >
          <UIcon name="i-lucide-arrow-left" class="h-4 w-4" aria-hidden="true" />
          Retour aux commandes
        </NuxtLink>
        <p class="section-eyebrow">
          Catalogue
        </p>
        <h1 class="section-title">
          Gérer le catalogue
        </h1>
        <p class="section-desc">
          Consulte l’état du stock, modifie un produit ou ajoute une nouvelle référence.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-refresh-cw"
          label="Actualiser"
          :loading="pending"
          @click="() => refresh()"
        />
        <NuxtLink to="/boutique-produits">
          <UButton icon="i-lucide-plus" color="primary" label="Ajouter un produit" />
        </NuxtLink>
      </div>
    </div>

    <div class="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div
        v-for="card in statCards"
        :key="card.key"
        class="stat-card surface-solid clip-corner-sm p-4"
      >
        <div class="flex items-center gap-2">
          <UIcon :name="card.icon" class="h-4 w-4 text-brand" aria-hidden="true" />
          <span class="text-xs uppercase tracking-[0.2em] text-muted">{{ card.label }}</span>
        </div>
        <div class="mt-3 text-3xl font-black text-gradient-otaku">
          {{ card.value }}
        </div>
        <p class="mt-1 text-xs text-muted">
          {{ card.hint }}
        </p>
      </div>
    </div>

    <div class="mt-6 grid gap-3 sm:grid-cols-2">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        class="w-full"
        placeholder="Rechercher un produit par nom ou tag"
        aria-label="Rechercher un produit"
      />
      <AppSelect
        v-model="categoryFilter"
        :options="categoryOptions"
        icon="i-lucide-layout-grid"
        aria-label="Filtrer par catégorie"
        variant="filter"
      />
    </div>

    <div v-if="pending" class="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <USkeleton
        v-for="index in 6"
        :key="index"
        class="h-72"
      />
    </div>

    <div
      v-else-if="error"
      class="empty-state surface-solid clip-corner mt-8"
    >
      <span class="empty-state__icon" aria-hidden="true">
        <UIcon name="i-lucide-triangle-alert" />
      </span>
      <h2 class="empty-state__title">
        Catalogue indisponible
      </h2>
      <p class="empty-state__text">
        Impossible de charger le catalogue pour le moment. Réessaie dans un instant.
      </p>
      <UButton
        class="mt-4"
        color="primary"
        icon="i-lucide-refresh-cw"
        label="Réessayer"
        @click="() => refresh()"
      />
    </div>

    <div
      v-else-if="!products.length"
      class="empty-state surface-solid clip-corner mt-8"
    >
      <span class="empty-state__icon" aria-hidden="true">
        <UIcon name="i-lucide-package" />
      </span>
      <h2 class="empty-state__title">
        Aucun produit dans le catalogue
      </h2>
      <p class="empty-state__text">
        La boutique est encore vide. Ajoute une première référence pour que les membres puissent commander.
      </p>
      <NuxtLink to="/boutique-produits" class="mt-4 inline-block">
        <UButton color="primary" icon="i-lucide-plus" label="Ajouter un produit" />
      </NuxtLink>
    </div>

    <div
      v-else-if="!filteredProducts.length"
      class="empty-state surface-solid clip-corner mt-8"
    >
      <span class="empty-state__icon" aria-hidden="true">
        <UIcon name="i-lucide-search-x" />
      </span>
      <h2 class="empty-state__title">
        Aucun produit pour cette recherche
      </h2>
      <p class="empty-state__text">
        Aucun produit ne correspond au filtre choisi. Réinitialise la recherche pour revoir tout le catalogue.
      </p>
      <UButton
        class="mt-4"
        color="primary"
        icon="i-lucide-filter-x"
        label="Réinitialiser les filtres"
        @click="resetFilters"
      />
    </div>

    <div v-else class="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <article
        v-for="product in filteredProducts"
        :key="product.id"
        class="product-admin-card surface-solid clip-corner-sm p-4"
      >
        <div class="relative">
          <img
            v-if="productImage(product)"
            :src="productImage(product) || undefined"
            :alt="product.name"
            class="h-40 w-full rounded-lg object-cover"
          >
          <div
            v-else
            class="flex h-40 w-full items-center justify-center rounded-lg border border-dashed border-default"
          >
            <UIcon name="i-lucide-image-off" class="h-6 w-6 text-muted" aria-hidden="true" />
          </div>
          <UBadge
            v-if="product.stock === 0"
            class="absolute left-2 top-2"
            color="error"
            variant="solid"
            icon="i-lucide-package-x"
          >
            Rupture
          </UBadge>
          <UBadge
            v-else-if="product.stock <= LOW_STOCK_THRESHOLD"
            class="absolute left-2 top-2"
            color="warning"
            variant="solid"
            icon="i-lucide-triangle-alert"
          >
            Stock faible
          </UBadge>
        </div>

        <div class="mt-3 min-w-0">
          <p class="product-admin-card__name">
            {{ product.name }}
          </p>
          <p v-if="product.description" class="product-admin-card__desc">
            {{ htmlToPlainText(product.description || '') }}
          </p>

          <div class="product-admin-card__meta">
            <span class="meta-chip">
              <UIcon name="i-lucide-layout-grid" class="h-3.5 w-3.5" aria-hidden="true" />
              {{ product.category }}
            </span>
            <span class="meta-chip">
              <UIcon name="i-lucide-tags" class="h-3.5 w-3.5" aria-hidden="true" />
              <span class="truncate">{{ product.tag || 'Sans tag' }}</span>
            </span>
          </div>

          <div class="product-admin-card__facts">
            <p class="fact fact--price">
              <UIcon name="i-lucide-wallet" class="h-4 w-4" aria-hidden="true" />
              <span class="fact__amount">{{ product.price.toLocaleString() }}</span>
              <span class="fact__unit">FCFA</span>
            </p>
            <p class="fact" :class="`fact--${stockLevel(product)}`">
              <UIcon :name="stockIcon(product)" class="h-4 w-4" aria-hidden="true" />
              {{ stockLabel(product) }}
            </p>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          <UButton
            icon="i-lucide-pencil"
            label="Modifier"
            color="primary"
            variant="soft"
            :disabled="removingId === product.id"
            @click="selectedProduct = product"
          />
          <UButton
            icon="i-lucide-trash-2"
            label="Supprimer"
            color="error"
            variant="soft"
            :loading="removingId === product.id"
            :disabled="removingId === product.id"
            @click="remove(product)"
          />
        </div>
      </article>
    </div>

    <p v-if="!pending && !error && products.length" class="mt-6 text-xs text-muted">
      <template v-if="isFiltered">
        {{ filteredProducts.length }} produit(s) affiché(s) sur {{ products.length }}.
      </template>
      <template v-else>
        {{ products.length }} produit(s) au catalogue.
      </template>
    </p>

    <ProductEditModal
      :product="selectedProduct"
      @close="selectedProduct = null"
      @saved="refresh(); selectedProduct = null"
    />
  </div>
</template>

<style scoped>
.section-eyebrow {
  margin-top: 1rem;
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

.section-desc {
  margin-top: 0.35rem;
  max-width: 58ch;
  font-size: 0.875rem;
  color: var(--muted-color);
}

.stat-card {
  transition: transform 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
}

.product-admin-card {
  display: flex;
  flex-direction: column;
  transition: transform 0.2s ease;
}

.product-admin-card:hover {
  transform: translateY(-2px);
}

/* ---- Fiche produit : nom, description, catégorie, prix, stock ---- */
.product-admin-card__name {
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.3;
  color: var(--text-color);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.product-admin-card__desc {
  margin-top: 0.35rem;
  font-size: 0.8rem;
  line-height: 1.45;
  color: var(--muted-color);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.product-admin-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.6rem;
}

.meta-chip {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.6rem;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted-color);
  background: rgba(var(--primary-color-rgb), 0.08);
  border: 1px solid var(--border-color);
  border-radius: 9999px;
}

.product-admin-card__facts {
  display: grid;
  gap: 0.35rem;
  margin-top: 0.65rem;
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
</style>
