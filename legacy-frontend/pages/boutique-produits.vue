<script setup lang="ts">
import { productCategories } from '#shared/product-categories'

definePageMeta({ middleware: 'shop' })

const { success, alert } = useGameToast()
const images = ref<Array<string | null>>([null, null, null])
const pending = ref(false)
const form = reactive({ name: '', tag: '', category: 'goodies', description: '', price: 0, stock: 0, whatsappNumber: '' })
const uploadedImages = computed(() => images.value.filter((image): image is string => Boolean(image)))

// Options prêtes pour AppSelect (le seul sélecteur du site).
const categoryOptions = productCategories.map(category => ({ value: category.value, label: category.label }))

// Aperçu : libellé lisible de la catégorie + alerte visuelle de stock, alignés
// sur le reste de la boutique (seuil d'alerte = 5 unités).
const SEUIL_STOCK_FAIBLE = 5

const categoryLabel = computed(() =>
  categoryOptions.find(option => option.value === form.category)?.label || form.category
)

const previewStockLevel = computed<'in' | 'low' | 'out'>(() => {
  const stock = Number(form.stock || 0)
  if (stock <= 0) return 'out'
  return stock <= SEUIL_STOCK_FAIBLE ? 'low' : 'in'
})

const previewStockLabel = computed(() => {
  const stock = Number(form.stock || 0)
  if (previewStockLevel.value === 'out') return 'Rupture de stock'
  if (previewStockLevel.value === 'low') return `Stock faible · ${stock} restant(s)`
  return `${stock} en stock`
})

const previewStockIcon = computed(() => {
  if (previewStockLevel.value === 'out') return 'i-lucide-package-x'
  return previewStockLevel.value === 'low' ? 'i-lucide-triangle-alert' : 'i-lucide-boxes'
})

// Jamais `secondary`/`info` (rendus en bleu par Nuxt UI v4) : vert/ambre/rouge.
const previewStockColor = computed<'success' | 'warning' | 'error'>(() => {
  if (previewStockLevel.value === 'out') return 'error'
  return previewStockLevel.value === 'low' ? 'warning' : 'success'
})

// Les erreurs de l'API portent le message métier précis dans `statusMessage`
// (champ fautif + correction attendue) et le détail par champ dans `champs`.
type ChampProduit = 'name' | 'tag' | 'category' | 'description' | 'price' | 'stock' | 'imageUrls' | 'whatsappNumber'

const erreurs = ref<Partial<Record<ChampProduit, string>>>({})
const messageErreur = ref('')

/** Message précis (et champs fautifs) portés par une erreur HTTP de l'API. */
function extraireErreurApi(errorValue: unknown): { message: string, champs: Partial<Record<ChampProduit, string>> } {
  const donnees = (errorValue as { data?: unknown } | null)?.data
  if (typeof donnees !== 'object' || donnees === null) return { message: '', champs: {} }

  const detail = donnees as { statusMessage?: unknown, champs?: unknown }
  const message = typeof detail.statusMessage === 'string' && detail.statusMessage !== 'Internal Server Error'
    ? detail.statusMessage
    : ''
  const champs = typeof detail.champs === 'object' && detail.champs !== null
    ? detail.champs as Partial<Record<ChampProduit, string>>
    : {}
  return { message, champs }
}

/** Contrôles client, alignés sur le schéma zod de `POST /api/boutique/catalog`. */
function valider(): boolean {
  const trouvees: Partial<Record<ChampProduit, string>> = {}
  if (form.name.trim().length < 2) trouvees.name = 'Le nom du produit doit contenir au moins 2 caractères.'
  if (!form.tag.trim()) trouvees.tag = 'Renseigne au moins un tag (ex. Naruto, nouveauté).'
  if (!Number.isInteger(form.price) || form.price <= 0) trouvees.price = 'Le prix doit être un montant entier positif en FCFA.'
  if (!Number.isInteger(form.stock) || form.stock < 0) trouvees.stock = 'Le stock doit être une quantité entière positive ou nulle.'
  if (!uploadedImages.value.length) trouvees.imageUrls = 'Ajoute au moins une image produit.'
  if (form.whatsappNumber && !/^\+[1-9]\d{7,14}$/.test(form.whatsappNumber)) trouvees.whatsappNumber = 'Le numéro WhatsApp doit respecter le format international (+229XXXXXXXX).'

  erreurs.value = trouvees
  return Object.keys(trouvees).length === 0
}

async function submit() {
  messageErreur.value = ''
  if (!valider()) {
    messageErreur.value = 'Corrige les champs signalés avant de publier.'
    alert(messageErreur.value)
    return
  }

  pending.value = true
  try {
    await $fetch('/api/boutique/catalog', { method: 'POST', body: { ...form, whatsappNumber: form.whatsappNumber || undefined, imageUrls: uploadedImages.value } })
    Object.assign(form, { name: '', tag: '', category: 'goodies', description: '', price: 0, stock: 0, whatsappNumber: '' })
    images.value = [null, null, null]
    erreurs.value = {}
    success('Produit publié dans la boutique.')
  } catch (error: unknown) {
    const { message, champs } = extraireErreurApi(error)
    erreurs.value = champs
    messageErreur.value = message || 'Le produit n\'a pas pu être publié : vérifie les champs du formulaire.'
    alert(messageErreur.value)
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 pb-20 pt-10 lg:px-8">
    <NuxtLink
      to="/boutique-dashboard"
      class="inline-flex items-center gap-1.5 text-sm text-brand"
    >
      <UIcon name="i-lucide-arrow-left" class="h-4 w-4" aria-hidden="true" />
      Retour aux commandes
    </NuxtLink>

    <div class="mt-4">
      <p class="section-eyebrow">
        Catalogue
      </p>
      <h1 class="section-title">
        Ajouter un produit
      </h1>
      <p class="section-desc">
        Prépare le produit, vérifie son aperçu, puis publie-le dans la boutique.
      </p>
    </div>

    <form
      class="mt-8 grid gap-4 surface-solid clip-corner p-5 md:grid-cols-2"
      novalidate
      @submit.prevent="submit"
    >
      <UFormField label="Nom du produit" required :error="erreurs.name || undefined">
        <UInput
          v-model="form.name"
          icon="i-lucide-package"
          class="w-full"
          placeholder="Nom du produit (ex. T-shirt Club)"
        />
      </UFormField>
      <AppSelect
        v-model="form.category"
        :options="categoryOptions"
        label="Catégorie"
        icon="i-lucide-layout-grid"
        aria-label="Catégorie du produit"
        required
      />
      <UFormField
        label="Tags"
        hint="Sépare plusieurs tags par des virgules."
        required
        :error="erreurs.tag || undefined"
      >
        <UInput
          v-model="form.tag"
          icon="i-lucide-tags"
          class="w-full"
          placeholder="Ex. Naruto, édition limitée, nouveauté"
        />
      </UFormField>
      <UFormField label="Prix de vente (FCFA)" required :error="erreurs.price || undefined">
        <UInput
          v-model.number="form.price"
          icon="i-lucide-wallet"
          class="w-full"
          type="number"
          min="1"
          placeholder="Ex. 12000"
        />
      </UFormField>
      <UFormField
        label="Stock disponible (quantité)"
        hint="Sous 5 unités, le produit sera signalé « stock faible »."
        required
        :error="erreurs.stock || undefined"
      >
        <UInput
          v-model.number="form.stock"
          icon="i-lucide-boxes"
          class="w-full"
          type="number"
          min="0"
          placeholder="Ex. 25"
        />
      </UFormField>
      <UFormField
        label="WhatsApp de commande (optionnel)"
        hint="Format international obligatoire : +229XXXXXXXX."
        :error="erreurs.whatsappNumber || undefined"
      >
        <UInput
          v-model="form.whatsappNumber"
          icon="i-lucide-phone"
          class="w-full"
          placeholder="+229XXXXXXXX"
        />
      </UFormField>
      <UFormField label="Description" class="md:col-span-2">
        <ClientOnly>
          <RichTextEditor
            v-model="form.description"
            :max-characters="2000"
            aria-label="Description du produit"
            placeholder="Description du produit (optionnel) : matière, taille, édition…"
            hint="2 000 caractères de texte maximum. La mise en forme ne compte pas."
          />
          <template #fallback>
            <UTextarea
              v-model="form.description"
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
            Images du produit
          </p>
          <span class="text-sm font-semibold" style="color: var(--primary-color);" aria-hidden="true">*</span>
          <span class="sr-only">(obligatoire)</span>
        </div>
        <p class="mt-1 text-xs text-muted">
          Ajoute jusqu’à trois images ; elles seront affichées dans un carousel sur la boutique. La première est le visuel principal.
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
        <p v-if="erreurs.imageUrls" class="mt-2 text-error">
          {{ erreurs.imageUrls }}
        </p>
      </div>

      <div
        v-if="form.name || uploadedImages.length"
        class="md:col-span-2 rounded-xl border border-default p-4"
      >
        <p class="section-eyebrow">
          Aperçu avant publication
        </p>
        <div class="mt-3 flex flex-col gap-4 sm:flex-row">
          <img
            v-if="uploadedImages[0]"
            :src="uploadedImages[0]"
            alt="Aperçu du produit"
            class="h-28 w-28 shrink-0 rounded-lg object-cover"
          >
          <div
            v-else
            class="flex h-28 w-28 shrink-0 items-center justify-center rounded-lg border border-dashed border-default"
          >
            <UIcon name="i-lucide-image-off" class="h-6 w-6 text-muted" aria-hidden="true" />
          </div>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="meta-chip">
                <UIcon name="i-lucide-layout-grid" class="h-3.5 w-3.5" aria-hidden="true" />
                {{ categoryLabel }}
              </span>
              <UBadge
                :color="previewStockColor"
                :variant="previewStockLevel === 'in' ? 'soft' : 'solid'"
                size="sm"
                :icon="previewStockIcon"
              >
                {{ previewStockLabel }}
              </UBadge>
            </div>
            <h2 class="preview-name">
              {{ form.name || 'Nom du produit' }}
            </h2>
            <RichTextContent
              v-if="form.description"
              class="preview-desc"
              :content="form.description"
            />
            <p
              v-else
              class="preview-desc"
            >
              Description du produit
            </p>
            <p class="preview-price">
              <span class="preview-price__amount">{{ Number(form.price || 0).toLocaleString() }}</span>
              <span class="preview-price__unit">FCFA</span>
            </p>
          </div>
        </div>
      </div>

      <UAlert
        v-if="messageErreur"
        class="md:col-span-2"
        color="error"
        variant="soft"
        icon="i-lucide-circle-alert"
        :title="messageErreur"
      />

      <UButton
        type="submit"
        class="md:col-span-2"
        color="primary"
        icon="i-lucide-plus"
        :loading="pending"
        :disabled="pending"
        label="Publier le produit"
      />
    </form>
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

.section-desc {
  margin-top: 0.35rem;
  font-size: 0.875rem;
  color: var(--muted-color);
}
/* ---- Aperçu produit : catégorie, stock, nom, prix FCFA ---- */
.meta-chip {
  display: inline-flex;
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

/* ---- Alerte stock : portée par le badge UBadge (success/warning/error),
   aucune couleur codée en dur. ---- */

.preview-name {
  margin-top: 0.7rem;
  font-size: 1.1rem;
  font-weight: 700;
  line-height: 1.3;
  color: var(--text-color);
}

.preview-desc {
  margin-top: 0.3rem;
  font-size: 0.85rem;
  line-height: 1.45;
  color: var(--muted-color);
}

.preview-price {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
  margin-top: 0.55rem;
}

.preview-price__amount {
  font-size: 1.35rem;
  font-weight: 900;
  line-height: 1;
  color: var(--accent-color);
}

.preview-price__unit {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted-color);
}
</style>
