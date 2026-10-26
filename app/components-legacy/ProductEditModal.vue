<script setup lang="ts">
import { productCategories } from '#shared/product-categories'

export type EditableProduct = {
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

const props = defineProps<{ product: EditableProduct | null }>()
const emit = defineEmits<{ close: [], saved: [product: EditableProduct] }>()
const { success, alert } = useGameToast()
const pending = ref(false)
type ProductDraft = Omit<EditableProduct, 'description' | 'whatsappNumber'> & {
  description: string
  whatsappNumber: string
}
const draft = ref<ProductDraft | null>(null)
const images = ref<Array<string | null>>([null, null, null])

// Options prêtes pour AppSelect (le seul sélecteur du site).
const categoryOptions = productCategories.map(category => ({ value: category.value, label: category.label }))

// Seuil d'alerte local, aligné sur celui du dashboard boutique.
const LOW_STOCK_THRESHOLD = 5

// CORRECTIF : le parent remet `product` à null pour fermer la modale
// (`@close` / `@saved`). Sans `draft.value = null`, le `v-if="draft"` restait
// vrai et la modale ne se fermait JAMAIS : ni « Annuler », ni « Fermer », ni
// après un enregistrement réussi.
watch(() => props.product, (product) => {
  if (!product) {
    draft.value = null
    images.value = [null, null, null]
    return
  }

  draft.value = {
    ...product,
    description: product.description || '',
    whatsappNumber: product.whatsappNumber || ''
  }
  // `imageUrls` peut manquer dans une réponse partielle : on sécurise l'accès.
  const urls = Array.isArray(product.imageUrls) ? product.imageUrls : []
  images.value = [urls[0] || product.imageUrl, urls[1] || null, urls[2] || null]
}, { immediate: true })

const imageUrls = computed(() => images.value.filter((image): image is string => Boolean(image)))

const stockBadge = computed(() => {
  const stock = draft.value?.stock ?? 0
  if (stock === 0) return { label: 'Rupture de stock', color: 'error' as const, icon: 'i-lucide-package-x' }
  if (stock <= LOW_STOCK_THRESHOLD) return { label: `Stock faible (≤ ${LOW_STOCK_THRESHOLD})`, color: 'warning' as const, icon: 'i-lucide-triangle-alert' }
  return { label: `${stock} en stock`, color: 'success' as const, icon: 'i-lucide-boxes' }
})

function getApiErrorMessage(errorValue: unknown, fallback: string) {
  if (typeof errorValue === 'object' && errorValue !== null && 'data' in errorValue) {
    const data = errorValue.data
    if (typeof data === 'object' && data !== null && 'statusMessage' in data && typeof data.statusMessage === 'string') return data.statusMessage
  }
  return fallback
}

async function save() {
  if (!draft.value) return
  // L'API exige un nom, un tag, un prix strictement positif et un stock
  // positif ou nul : on le vérifie ici pour éviter une erreur 400 peu lisible.
  if (!draft.value.name.trim() || !draft.value.tag.trim()) {
    alert('Le nom et le tag du produit sont obligatoires.')
    return
  }
  if (!Number.isFinite(draft.value.price) || draft.value.price <= 0) {
    alert('Le prix doit être un montant positif en FCFA.')
    return
  }
  if (!Number.isFinite(draft.value.stock) || draft.value.stock < 0) {
    alert('Le stock doit être une quantité positive ou nulle.')
    return
  }

  pending.value = true
  try {
    const response = await $fetch<{ data: EditableProduct }>(`/api/boutique/catalog/${draft.value.id}`, {
      method: 'PATCH',
      body: {
        ...draft.value,
        // Champ WhatsApp vidé = suppression : l'API attend `null` et non une chaîne vide.
        whatsappNumber: draft.value.whatsappNumber.trim() || null,
        imageUrl: imageUrls.value[0] || null,
        imageUrls: imageUrls.value
      }
    })
    emit('saved', response.data)
    success('Produit modifié.')
  } catch (error: unknown) {
    alert(getApiErrorMessage(error, 'Impossible de modifier ce produit.'))
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div
    v-if="draft"
    class="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4"
    @click.self="emit('close')"
  >
    <div
      class="mx-auto my-8 max-w-3xl rounded-2xl surface-solid p-5 shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-edit-title"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="edit-eyebrow">
            Catalogue
          </p>
          <h2 id="product-edit-title" class="edit-title">
            Modifier le produit
          </h2>
          <p class="edit-desc">
            Ajuste les informations, les images, le prix et le stock, puis enregistre.
          </p>
        </div>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          aria-label="Fermer"
          :disabled="pending"
          @click="emit('close')"
        />
      </div>

      <div class="mt-5 grid gap-4 sm:grid-cols-2">
        <UFormField label="Nom du produit" required>
          <UInput
            v-model="draft.name"
            icon="i-lucide-package"
            class="w-full"
            placeholder="Ex. T-shirt Club Otaku"
          />
        </UFormField>
        <UFormField label="Tags" hint="Sépare plusieurs tags par des virgules.">
          <UInput
            v-model="draft.tag"
            icon="i-lucide-tags"
            class="w-full"
            placeholder="Ex. Naruto, édition limitée"
          />
        </UFormField>
        <AppSelect
          v-model="draft.category"
          :options="categoryOptions"
          label="Catégorie"
          icon="i-lucide-layout-grid"
          aria-label="Catégorie du produit"
        />
        <UFormField label="Prix (FCFA)" required>
          <UInput
            v-model.number="draft.price"
            icon="i-lucide-wallet"
            class="w-full"
            type="number"
            min="1"
            placeholder="Prix en FCFA"
          />
        </UFormField>
        <UFormField label="Stock disponible" required>
          <UInput
            v-model.number="draft.stock"
            icon="i-lucide-boxes"
            class="w-full"
            type="number"
            min="0"
            placeholder="Stock disponible"
          />
        </UFormField>
        <UFormField label="WhatsApp de commande" hint="Format international obligatoire : +229XXXXXXXX.">
          <UInput
            v-model="draft.whatsappNumber"
            icon="i-lucide-phone"
            class="w-full"
            placeholder="+229XXXXXXXX"
          />
        </UFormField>
        <UFormField label="Description" class="sm:col-span-2">
          <ClientOnly>
            <RichTextEditor
              v-model="draft.description"
              :max-characters="2000"
              aria-label="Description du produit"
              placeholder="Description du produit"
              hint="2 000 caractères de texte maximum. La mise en forme ne compte pas."
            />
            <template #fallback>
              <UTextarea
                v-model="draft.description"
                class="w-full"
                :rows="4"
                maxlength="2000"
                aria-label="Description du produit"
                placeholder="Description du produit"
              />
            </template>
          </ClientOnly>
        </UFormField>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-2">
        <UBadge
          :color="stockBadge.color"
          variant="soft"
          :icon="stockBadge.icon"
        >
          {{ stockBadge.label }}
        </UBadge>
        <UBadge color="primary" variant="soft" icon="i-lucide-wallet">
          {{ Number(draft.price || 0).toLocaleString() }} FCFA
        </UBadge>
        <span class="text-xs text-muted">Les modifications sont visibles immédiatement sur la boutique publique.</span>
      </div>

      <div class="mt-5">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-image" class="h-4 w-4 text-brand" aria-hidden="true" />
          <p class="text-sm font-semibold" style="color: var(--text-color);">
            Images du produit
          </p>
        </div>
        <p class="mt-1 text-xs text-muted">
          Supprimer une image la retire du produit ; les nouvelles images sont optimisées et envoyées à Cloudinary. La première image sert de visuel principal.
        </p>
        <div class="mt-3 grid gap-3 sm:grid-cols-3">
          <ImageUpload
            v-for="(image, index) in images"
            :key="index"
            v-model="images[index]"
            :label="`Image ${index + 1}`"
            :disabled="pending"
          />
        </div>
      </div>

      <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <UButton
          label="Annuler"
          icon="i-lucide-x"
          color="neutral"
          variant="soft"
          :disabled="pending"
          @click="emit('close')"
        />
        <UButton
          label="Enregistrer"
          icon="i-lucide-save"
          color="primary"
          :loading="pending"
          :disabled="pending"
          @click="save"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.edit-eyebrow {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--primary-color);
}

.edit-title {
  margin-top: 0.3rem;
  font-family: var(--font-display);
  font-size: clamp(1.25rem, 2.2vw, 1.6rem);
  font-weight: 800;
  color: var(--text-color);
}

.edit-desc {
  margin-top: 0.3rem;
  font-size: 0.85rem;
  color: var(--muted-color);
}
</style>
