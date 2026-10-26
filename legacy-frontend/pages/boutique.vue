<script setup lang="ts">
import { productCategories } from '#shared/product-categories'
import { htmlToPlainText } from '#shared/rich-text'

const { playSfx } = useSoundManager()

const selectedCategory = ref('Tous')
const selectedTag = ref('Tous')
const search = ref('')
const selectedProduct = ref<Product | null>(null)
const activeImage = ref(0)
const reviews = ref<Array<{ id: string, rating: number, comment: string | null, createdAt: string, user: { pseudo: string } }>>([])
const reviewRating = ref(5)
const reviewComment = ref('')
const reviewPending = ref(false)
const reviewLoading = ref(false)
const reviewError = ref('')
const config = useRuntimeConfig()

type Product = {
  id: string
  name: string
  price: number
  tag: string
  category: string
  stock: number
  available: boolean
  description: string | null
  imageUrl: string | null
  imageUrls: string[]
  whatsappNumber: string | null
  reviewCount: number
  averageRating: number | null
}

const { data: productsResponse, pending, error, refresh } = await useFetch<{ data: Product[] }>('/api/boutique')
const products = ref<Product[]>([])
watch(productsResponse, (response) => {
  products.value = response?.data || []
}, { immediate: true })

// Options prêtes pour AppSelect (le seul sélecteur du site).
const categories = [{ value: 'Tous', label: 'Toutes les catégories' }, ...productCategories]
const productTags = computed(() => [
  'Tous',
  ...new Set(products.value.flatMap(product => product.tag.split(',').map(tag => tag.trim()).filter(Boolean)))
])
const tagOptions = computed(() => productTags.value.map(tag => ({ value: tag, label: tag === 'Tous' ? 'Tous les tags' : tag })))

// Seuil d'alerte de stock, aligné sur le dashboard boutique.
const LOW_STOCK_THRESHOLD = 5

const isFiltered = computed(() => Boolean(search.value.trim()) || selectedCategory.value !== 'Tous' || selectedTag.value !== 'Tous')

function resetFilters() {
  selectedCategory.value = 'Tous'
  selectedTag.value = 'Tous'
  search.value = ''
  playSfx('click')
}

const filteredProducts = computed(() =>
  products.value.filter((product) => {
    const matchesCategory = selectedCategory.value === 'Tous' || product.category === selectedCategory.value
    const matchesTag = selectedTag.value === 'Tous' || product.tag.split(',').some(tag => tag.trim() === selectedTag.value)
    const needle = search.value.trim().toLowerCase()
    const matchesSearch = !needle
      || product.name.toLowerCase().includes(needle)
      || product.tag.toLowerCase().includes(needle)
    return matchesCategory && matchesTag && matchesSearch
  })
)

function getApiErrorMessage(errorValue: unknown, fallback: string) {
  if (typeof errorValue === 'object' && errorValue !== null && 'data' in errorValue) {
    const data = errorValue.data
    if (typeof data === 'object' && data !== null && 'statusMessage' in data && typeof data.statusMessage === 'string') return data.statusMessage
  }
  return fallback
}

async function retryProducts() {
  await refresh()
}

function openOrder(product: Product) {
  selectedProduct.value = product
  activeImage.value = 0
  reviewRating.value = 5
  reviewComment.value = ''
  reviewError.value = ''
  loadReviews(product)
  playSfx('click')
}

function closeOrder() {
  selectedProduct.value = null
  reviews.value = []
}

async function loadReviews(product: Product) {
  reviewLoading.value = true
  try {
    const response = await $fetch<{ data: typeof reviews.value }>(`/api/boutique/products/${product.id}/reviews`)
    reviews.value = response.data
  } catch {
    reviews.value = []
  } finally {
    reviewLoading.value = false
  }
}

async function submitReview() {
  if (!selectedProduct.value) return
  reviewPending.value = true
  reviewError.value = ''
  try {
    await $fetch(`/api/boutique/products/${selectedProduct.value.id}/reviews`, {
      method: 'POST',
      body: { rating: reviewRating.value, comment: reviewComment.value }
    })
    reviewComment.value = ''
    await loadReviews(selectedProduct.value)
    selectedProduct.value.reviewCount = reviews.value.length
    selectedProduct.value.averageRating = reviews.value.length
      ? reviews.value.reduce((sum, review) => sum + review.rating, 0) / reviews.value.length
      : null
  } catch (error: unknown) {
    reviewError.value = getApiErrorMessage(error, 'Connecte-toi pour publier un avis.')
  } finally {
    reviewPending.value = false
  }
}

// Numéro WhatsApp du produit prioritaire, repli sur le numéro général du club :
// c'est ce que le gestionnaire boutique configure produit par produit.
function orderViaWhatsapp(product: Product) {
  const raw = product.whatsappNumber || config.public.whatsappNumber || ''
  const number = String(raw).replace(/\D/g, '')
  const message = `Bonjour, je souhaite commander : ${product.name} (${product.price.toLocaleString()} FCFA).`
  window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank', 'noopener')
}

function productImages(product: Product) {
  return product.imageUrls?.length ? product.imageUrls : product.imageUrl ? [product.imageUrl] : []
}

// État de stock unifié : une seule source de vérité pour la pastille, le badge
// de la fiche produit et l'alerte visuelle de la carte. Le seuil est aligné sur
// celui du dashboard boutique (LOW_STOCK_THRESHOLD).
// `color` reste une couleur Nuxt UI explicite (jamais `secondary`/`info`, qui
// rendraient en bleu) : le vert/ambre/rouge est fourni par la palette du projet.
type StockState = { key: 'in' | 'low' | 'out', label: string, icon: string, color: 'success' | 'warning' | 'error' }

function stockState(product: Product): StockState {
  if (!product.available || product.stock === 0) {
    return { key: 'out', label: 'Rupture de stock', icon: 'i-lucide-package-x', color: 'error' }
  }
  if (product.stock <= LOW_STOCK_THRESHOLD) {
    return { key: 'low', label: `Plus que ${product.stock} en stock`, icon: 'i-lucide-triangle-alert', color: 'warning' }
  }
  return { key: 'in', label: `${product.stock} en stock`, icon: 'i-lucide-boxes', color: 'success' }
}
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 pb-20 pt-10 lg:px-8">
    <div class="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="text-xs uppercase tracking-[0.28em] text-accent-otaku">
          Boutique
        </p>
        <h1
          class="mt-3 font-display text-4xl font-black"
          style="color: var(--text-color);"
        >
          Produits et goodies
        </h1>
        <p class="mt-2 text-sm text-muted">
          Choisis un produit et envoie ta commande directement à l’équipe boutique.
        </p>
      </div>

      <div class="flex w-full max-w-sm items-center gap-2">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          class="w-full"
          placeholder="Rechercher un produit"
          aria-label="Rechercher un produit"
        />
        <UButton
          v-if="search"
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          aria-label="Effacer la recherche"
          @click="search = ''"
        />
      </div>
    </div>

    <div class="mb-4 flex flex-wrap items-center gap-2">
      <span class="flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-muted">
        <UIcon name="i-lucide-filter" class="h-3.5 w-3.5" aria-hidden="true" />
        Filtrer
      </span>
    </div>
    <div class="mb-6 grid gap-3 sm:grid-cols-2">
      <AppSelect
        v-model="selectedCategory"
        :options="categories"
        icon="i-lucide-layout-grid"
        aria-label="Filtrer par catégorie"
        variant="filter"
      />
      <AppSelect
        v-model="selectedTag"
        :options="tagOptions"
        icon="i-lucide-tags"
        aria-label="Filtrer par tag"
        variant="filter"
      />
    </div>

    <div
      v-if="pending"
      class="grid gap-6 md:grid-cols-2 xl:grid-cols-4"
    >
      <USkeleton
        v-for="index in 4"
        :key="index"
        class="h-72"
      />
    </div>

    <div
      v-else-if="error"
      class="empty-state surface-solid clip-corner"
    >
      <span class="empty-state__icon" aria-hidden="true">
        <UIcon name="i-lucide-triangle-alert" />
      </span>
      <h2 class="empty-state__title">
        Boutique temporairement indisponible
      </h2>
      <p class="empty-state__text">
        Le catalogue n’a pas pu être chargé. Réessaie dans quelques instants.
      </p>
      <UButton
        class="mt-4"
        color="primary"
        icon="i-lucide-refresh-cw"
        label="Réessayer"
        @click="retryProducts"
      />
    </div>

    <div
      v-else-if="!products.length"
      class="empty-state surface-solid clip-corner"
    >
      <span class="empty-state__icon" aria-hidden="true">
        <UIcon name="i-lucide-store" />
      </span>
      <h2 class="empty-state__title">
        La boutique est encore vide
      </h2>
      <p class="empty-state__text">
        Aucun produit n’est publié pour le moment. Reviens bientôt : l’équipe boutique prépare le catalogue.
      </p>
    </div>

    <div
      v-else-if="!filteredProducts.length"
      class="empty-state surface-solid clip-corner"
    >
      <span class="empty-state__icon" aria-hidden="true">
        <UIcon name="i-lucide-search-x" />
      </span>
      <h2 class="empty-state__title">
        Aucun produit ne correspond à ta recherche
      </h2>
      <p class="empty-state__text">
        Essaie un autre mot-clé ou réinitialise les filtres pour revoir tout le catalogue.
      </p>
      <UButton
        v-if="isFiltered"
        class="mt-4"
        color="primary"
        icon="i-lucide-filter-x"
        label="Réinitialiser les filtres"
        @click="resetFilters"
      />
    </div>

    <div
      v-else
      class="grid gap-6 md:grid-cols-2 xl:grid-cols-4"
    >
      <div
        v-for="product in filteredProducts"
        :key="product.id"
        class="product-card surface-solid clip-corner-sm"
      >
        <button
          type="button"
          class="product-card__image"
          :style="productImages(product)[0] ? { backgroundImage: `url(${productImages(product)[0]})` } : undefined"
          :aria-label="`Voir ${product.name}`"
          @click="openOrder(product)"
        />
        <div class="product-card__head">
          <span class="product-card__category">
            <UIcon name="i-lucide-layout-grid" class="h-3 w-3" aria-hidden="true" />
            {{ product.category }}
          </span>
          <UBadge
            :color="stockState(product).color"
            :variant="stockState(product).key === 'in' ? 'soft' : 'solid'"
            size="sm"
            :icon="stockState(product).icon"
          >
            {{ stockState(product).label }}
          </UBadge>
        </div>

        <h3 class="product-card__name">
          {{ product.name }}
        </h3>

        <p v-if="product.description" class="product-card__desc">
          {{ htmlToPlainText(product.description || '') }}
        </p>

        <div v-if="product.tag" class="product-card__tags">
          <span
            v-for="tag in product.tag.split(',').map(tag => tag.trim()).filter(Boolean)"
            :key="tag"
            class="product-card__tag"
          >
            {{ tag }}
          </span>
        </div>

        <div v-if="product.reviewCount" class="product-card__rating">
          <UIcon name="i-lucide-star" class="h-3.5 w-3.5" aria-hidden="true" />
          <span>{{ product.averageRating?.toFixed(1) ?? '—' }}/5 · {{ product.reviewCount }} avis</span>
        </div>

        <div class="product-card__footer">
          <p class="product-card__price">
            <span class="product-card__amount">{{ product.price.toLocaleString() }}</span>
            <span class="product-card__currency">FCFA</span>
          </p>
          <UButton
            color="primary"
            variant="soft"
            icon="i-lucide-shopping-bag"
            :disabled="!product.available"
            :label="product.available ? 'Commander' : 'Indisponible'"
            @click="openOrder(product)"
          />
        </div>
      </div>
    </div>

    <div
      v-if="selectedProduct"
      class="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4"
      @click.self="closeOrder"
    >
      <div class="mx-auto my-8 max-w-5xl surface-solid clip-corner p-5 shadow-2xl">
        <div class="flex flex-col gap-5 lg:flex-row">
          <div class="lg:w-1/2">
            <div
              class="product-detail__image"
              :style="productImages(selectedProduct)[activeImage] ? { backgroundImage: `url(${productImages(selectedProduct)[activeImage]})` } : undefined"
            />
            <div
              v-if="productImages(selectedProduct).length > 1"
              class="mt-3 flex flex-wrap gap-2"
            >
              <button
                v-for="(image, index) in productImages(selectedProduct)"
                :key="image"
                type="button"
                class="product-detail__thumb"
                :class="{ 'product-detail__thumb--active': activeImage === index }"
                :style="{ backgroundImage: `url(${image})` }"
                :aria-label="`Afficher l'image ${index + 1}`"
                @click="activeImage = index"
              />
            </div>
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <p class="flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-brand">
                  <UIcon name="i-lucide-tag" class="h-3.5 w-3.5" aria-hidden="true" />
                  {{ selectedProduct.tag }}
                </p>
                <h2
                  class="mt-2 text-2xl font-semibold"
                  style="color: var(--text-color);"
                >
                  {{ selectedProduct.name }}
                </h2>
              </div>
              <UButton
                icon="i-lucide-x"
                color="neutral"
                variant="ghost"
                aria-label="Fermer la fiche produit"
                @click="closeOrder"
              />
            </div>

            <div class="mt-3 flex flex-wrap items-center gap-2">
              <UBadge color="neutral" variant="soft" icon="i-lucide-layout-grid">
                {{ selectedProduct.category }}
              </UBadge>
              <UBadge
                v-if="selectedProduct.stock === 0"
                color="error"
                variant="soft"
                icon="i-lucide-package-x"
              >
                Rupture de stock
              </UBadge>
              <UBadge
                v-else-if="selectedProduct.stock <= LOW_STOCK_THRESHOLD"
                color="warning"
                variant="soft"
                icon="i-lucide-triangle-alert"
              >
                Plus que {{ selectedProduct.stock }} en stock
              </UBadge>
              <UBadge
                v-else
                color="success"
                variant="soft"
                icon="i-lucide-boxes"
              >
                {{ selectedProduct.stock }} en stock
              </UBadge>
            </div>

            <RichTextContent
              v-if="selectedProduct.description"
              class="mt-4 text-sm text-muted"
              :content="selectedProduct.description"
              :label="`Description de ${selectedProduct.name}`"
            />
            <p
              v-else
              class="mt-4 text-sm text-muted"
            >
              Produit du Club Otaku ENEAM.
            </p>

            <div class="mt-5 flex flex-wrap items-center justify-between gap-4">
              <strong class="text-2xl text-accent-otaku">{{ selectedProduct.price.toLocaleString() }} FCFA</strong>
              <UButton
                color="primary"
                icon="i-simple-icons-whatsapp"
                :disabled="!selectedProduct.available"
                label="Commander sur WhatsApp"
                @click="orderViaWhatsapp(selectedProduct)"
              />
            </div>

            <section class="mt-8 border-t border-default pt-5">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <h3 class="flex items-center gap-2 text-lg font-semibold" style="color: var(--text-color);">
                  <UIcon name="i-lucide-message-circle" class="h-4 w-4 text-brand" aria-hidden="true" />
                  Avis et commentaires
                </h3>
                <span class="text-sm text-muted">{{ selectedProduct.reviewCount }} avis</span>
              </div>
              <p v-if="selectedProduct.averageRating" class="mt-1 flex items-center gap-1.5 text-sm text-accent-otaku">
                <UIcon name="i-lucide-star" class="h-4 w-4" aria-hidden="true" />
                {{ selectedProduct.averageRating.toFixed(1) }}/5
              </p>

              <div class="mt-4 grid gap-3">
                <div>
                  <p class="text-sm text-muted">
                    Ta note
                  </p>
                  <div class="mt-1 flex gap-1" role="radiogroup" aria-label="Note du produit">
                    <button
                      v-for="rating in 5"
                      :key="rating"
                      type="button"
                      class="review-star"
                      :class="{ 'review-star--active': rating <= reviewRating }"
                      :aria-label="`Donner ${rating} étoile${rating > 1 ? 's' : ''}`"
                      :aria-pressed="rating <= reviewRating"
                      @click="reviewRating = rating"
                    >
                      <UIcon name="i-lucide-star" />
                    </button>
                  </div>
                </div>
                <div class="flex flex-col gap-2 sm:flex-row">
                  <UInput v-model="reviewComment" class="w-full flex-1" icon="i-lucide-message-circle" placeholder="Écris ton commentaire sur ce produit (optionnel)" />
                  <UButton icon="i-lucide-send" color="primary" :loading="reviewPending" :disabled="reviewPending" aria-label="Publier l'avis" @click="submitReview" />
                </div>
              </div>

              <UAlert
                v-if="reviewError"
                class="mt-3"
                color="error"
                variant="soft"
                icon="i-lucide-circle-alert"
                :title="reviewError"
              />

              <div v-if="reviewLoading" class="mt-4 space-y-3">
                <USkeleton class="h-16" />
                <USkeleton class="h-16" />
              </div>
              <div v-else-if="reviews.length" class="mt-4 space-y-3">
                <article v-for="review in reviews" :key="review.id" class="rounded-lg border border-default p-3">
                  <div class="flex items-center justify-between gap-3 text-sm">
                    <strong>{{ review.user.pseudo }}</strong>
                    <span class="flex items-center gap-1 text-accent-otaku">
                      <UIcon v-for="index in review.rating" :key="index" name="i-lucide-star" class="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </div>
                  <p v-if="review.comment" class="mt-1 text-sm text-muted">
                    {{ review.comment }}
                  </p>
                </article>
              </div>
              <div v-else class="mt-4 flex items-center gap-2 text-sm text-muted">
                <UIcon name="i-lucide-inbox" class="h-4 w-4" aria-hidden="true" />
                Aucun avis pour le moment. Sois le premier à donner ton avis.
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pole-filter {
  border-radius: 9999px;
  padding: 0.4rem 0.9rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-color);
  background: transparent;
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, transform 0.15s ease;
}

.pole-filter:hover {
  border-color: rgba(var(--accent-color-rgb), 0.5);
  transform: translateY(-1px);
}

.pole-filter--active {
  color: var(--bg-color);
  background: var(--accent-color);
  border-color: var(--accent-color);
}

.product-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 1.25rem;
  transition: transform 0.2s ease;
}

.review-star {
  color: var(--border-color);
  font-size: 1.6rem;
  line-height: 1;
  transition: color 0.15s ease, transform 0.15s ease;
}

.review-star :deep(svg) {
  width: 1.6rem;
  height: 1.6rem;
}

.review-star:hover,
.review-star--active {
  color: var(--accent-color);
  transform: scale(1.08);
}

.product-card:hover {
  transform: translateY(-3px);
}

.product-card__image {
  display: block;
  width: 100%;
  height: 8rem;
  margin-bottom: 1rem;
  border-radius: 0.85rem;
  background: linear-gradient(135deg, rgba(var(--primary-color-rgb), 0.25), rgba(var(--accent-color-rgb), 0.2));
  background-position: center;
  background-size: cover;
  border: 0;
  cursor: pointer;
}

.product-detail__image {
  min-height: 18rem;
  border-radius: 1rem;
  background-position: center;
  background-size: cover;
  background-color: rgba(var(--primary-color-rgb), 0.08);
}

.product-detail__thumb {
  width: 4rem;
  height: 4rem;
  border: 2px solid transparent;
  border-radius: 0.65rem;
  background-position: center;
  background-size: cover;
}

.product-detail__thumb--active {
  border-color: var(--primary-color);
}

/* ---- Informations produit : hiérarchie claire (catégorie, nom, prix, stock) ---- */
.product-card__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.product-card__category {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.6rem;
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-color);
  background: rgba(var(--primary-color-rgb), 0.12);
  border: 1px solid var(--border-color);
  border-radius: 9999px;
}

.product-card__name {
  margin-top: 0.8rem;
  font-size: 1.1rem;
  font-weight: 700;
  line-height: 1.3;
  color: var(--text-color);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.product-card__desc {
  margin-top: 0.4rem;
  font-size: 0.8rem;
  line-height: 1.45;
  color: var(--muted-color);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.product-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.6rem;
}

.product-card__tag {
  display: inline-flex;
  border-radius: 9999px;
  padding: 0.15rem 0.55rem;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--primary-color);
  background: rgba(var(--primary-color-rgb), 0.1);
  border: 1px solid rgba(var(--primary-color-rgb), 0.35);
}

.product-card__rating {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.55rem;
  font-size: 0.75rem;
  color: var(--accent-color);
}

.product-card__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: auto;
  padding-top: 1rem;
}

.product-card__price {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
}

.product-card__amount {
  font-size: 1.35rem;
  font-weight: 900;
  line-height: 1;
  color: var(--accent-color);
}

.product-card__currency {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted-color);
}

/* ---- Pastille de stock : le badge UBadge (color success/warning/error)
   porte l'alerte visuelle ; aucune couleur codée en dur ici. ---- */

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
