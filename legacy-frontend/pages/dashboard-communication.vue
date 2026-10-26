<script setup lang="ts">
/**
 * Dashboard Communication — publier et suivre les annonces du Club Otaku.
 * Données réelles : /api/communaute/posts (lecture + publication + suppression).
 * Aucune couleur figée : uniquement les variables de thème (main.css).
 */
import { htmlToPlainText, isRichTextEmpty, richTextLength } from '#shared/rich-text'

definePageMeta({ middleware: 'admin' })

type Pole = 'anime' | 'manga' | 'gaming' | 'danse' | 'k-drama' | 'culture'
type ClubPost = {
  id: string
  content: string
  pole: string
  likes: number
  comments: number
  createdAt: string
  author: { id: string, pseudo: string, profile: { avatar: string | null } | null }
}

const { success, alert } = useGameToast()
const { user } = useAuth()

const ALL_POLES = 'all'
const POST_LIMIT = 5000
const POST_PAGE = 6

const POLE_LABELS: Record<string, string> = {
  'anime': 'Anime',
  'manga': 'Manga',
  'gaming': 'Gaming',
  'danse': 'Danse',
  'k-drama': 'K-Drama',
  'culture': 'Culture',
  'all': 'Tous les pôles'
}

const POLE_ORDER: Pole[] = ['anime', 'manga', 'gaming', 'danse', 'k-drama', 'culture']
const ALL_POLES_VALUE = 'all'

const { data: response, pending, error, refresh } = await useFetch<{ data: ClubPost[] }>('/api/communaute/posts')
const posts = computed(() => response.value?.data || [])

const content = ref('')
const pole = ref<string>('anime')
const submitting = ref(false)
const deletingId = ref<string | null>(null)
const search = ref('')
const poleFilter = ref(ALL_POLES)
const sort = ref<string>('recent')
const visible = ref(POST_PAGE)

const composerPoleOptions = [
  ...POLE_ORDER.map(value => ({ label: POLE_LABELS[value] || value, value })),
  { label: POLE_LABELS[ALL_POLES_VALUE] || 'Tous les pôles', value: ALL_POLES_VALUE }
]

const poleFilterOptions = [
  { label: 'Tous les pôles', value: ALL_POLES },
  ...POLE_ORDER.map(value => ({ label: POLE_LABELS[value] || value, value })),
  { label: 'Tous les pôles', value: ALL_POLES_VALUE }
]

const sortOptions = [
  { label: 'Plus récentes', value: 'recent' },
  { label: 'Plus populaires', value: 'popular' }
]

const searchTerm = computed(() => search.value.trim().toLowerCase())
// Longueur du TEXTE (sans balisage) : même mesure que l'éditeur et l'API.
const contentLength = computed(() => richTextLength(content.value))
const remaining = computed(() => POST_LIMIT - contentLength.value)
const canPublish = computed(() => contentLength.value >= 3 && contentLength.value <= POST_LIMIT && !submitting.value)

function poleLabel(value: string | null | undefined) {
  const normalized = (value || '').trim().toLowerCase()
  return POLE_LABELS[normalized] || value || 'Pôle libre'
}

const stats = computed(() => {
  const reactions = posts.value.reduce((total, post) => total + post.likes, 0)
  const comments = posts.value.reduce((total, post) => total + post.comments, 0)
  const authors = new Set(posts.value.map(post => post.author.pseudo))
  const perPole: Record<string, number> = {}
  for (const post of posts.value) {
    const normalized = (post.pole || '').trim().toLowerCase()
    if (!normalized) continue
    perPole[normalized] = (perPole[normalized] || 0) + 1
  }
  const topPole = Object.entries(perPole).sort((a, b) => b[1] - a[1])[0]

  return {
    posts: posts.value.length,
    reactions,
    comments,
    authors: authors.size,
    topPole: topPole ? `${poleLabel(topPole[0])} (${topPole[1]})` : '—'
  }
})

const filteredPosts = computed(() => {
  const list = posts.value.filter((post) => {
    const normalized = (post.pole || '').trim().toLowerCase()
    const matchesPole = poleFilter.value === ALL_POLES || normalized === poleFilter.value
    const matchesSearch = !searchTerm.value
      || htmlToPlainText(post.content).toLowerCase().includes(searchTerm.value)
      || post.author.pseudo.toLowerCase().includes(searchTerm.value)
      || poleLabel(post.pole).toLowerCase().includes(searchTerm.value)
    return matchesPole && matchesSearch
  })

  if (sort.value === 'popular') {
    return [...list].sort((a, b) => (b.likes + b.comments) - (a.likes + a.comments))
  }

  return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
})

const paginatedPosts = computed(() => filteredPosts.value.slice(0, visible.value))
const hiddenPosts = computed(() => Math.max(0, filteredPosts.value.length - paginatedPosts.value.length))
const nextPageCount = computed(() => Math.min(hiddenPosts.value, POST_PAGE))
const hasFilters = computed(() => poleFilter.value !== ALL_POLES || searchTerm.value.length > 0)

watch([poleFilter, search, sort], () => {
  visible.value = POST_PAGE
})

async function publishPost() {
  const draft = content.value.trim()
  if (isRichTextEmpty(draft)) {
    alert('La publication doit contenir au moins 3 caractères.')
    return
  }
  if (contentLength.value < 3) {
    alert('La publication doit contenir au moins 3 caractères.')
    return
  }
  if (contentLength.value > POST_LIMIT) {
    alert(`La publication ne peut pas dépasser ${POST_LIMIT} caractères (balisage non compté).`)
    return
  }

  submitting.value = true
  try {
    const targetPole = pole.value === ALL_POLES_VALUE ? 'all' : pole.value
    await $fetch('/api/communaute/posts', {
      method: 'POST',
      body: { content: draft, pole: targetPole }
    })
    content.value = ''
    await refresh()
    const publishedLabel = targetPole === 'all' ? 'tous les pôles' : poleLabel(targetPole)
    success(`Publication diffusée dans ${publishedLabel}.`)
  } catch (publishError: unknown) {
    alert(getApiErrorMessage(publishError, 'Impossible de publier ce message.'))
  } finally {
    submitting.value = false
  }
}

async function deletePost(post: ClubPost) {
  if (!window.confirm('Supprimer définitivement cette publication ?')) return

  deletingId.value = post.id
  try {
    await $fetch(`/api/communaute/posts/${post.id}`, { method: 'DELETE' })
    await refresh()
    success('Publication supprimée.')
  } catch (deleteError: unknown) {
    alert(getApiErrorMessage(deleteError, 'La publication n’a pas pu être supprimée.'))
  } finally {
    deletingId.value = null
  }
}

function resetFilters() {
  poleFilter.value = ALL_POLES
  search.value = ''
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

// ============================================================
// ONGLETS DE TRAVAIL
// Le pôle communication est scindé en deux onglets pour que publier ou
// suivre une annonce reste à un clic. Les blocs restent montés (v-show) :
// aucun contenu n’est retiré et aucun appel API ne change.
// ============================================================
type CommuTab = 'publier' | 'suivi'

const commuTabs: Array<{ value: CommuTab, label: string, icon: string }> = [
  { value: 'publier', label: 'Publier une annonce', icon: 'i-lucide-send' },
  { value: 'suivi', label: 'Suivi des publications', icon: 'i-lucide-activity' }
]

const activeTab = ref<CommuTab>('publier')

// Repère chiffré : nombre d’annonces actuellement affichées dans le suivi.
const tabCounts = computed<Partial<Record<CommuTab, number>>>(() => ({
  'suivi': filteredPosts.value.length
}))

function selectTab(value: CommuTab) {
  activeTab.value = value
  if (import.meta.client) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${value}`)
  }
}

onMounted(() => {
  const hash = window.location.hash.replace(/^#/, '')
  if (commuTabs.some(tab => tab.value === hash)) activeTab.value = hash as CommuTab
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
  <div class="mx-auto max-w-7xl px-4 pb-24 pt-16 lg:px-8">
    <!-- ================= EN-TÊTE ================= -->
    <header class="commu-hero surface-solid clip-corner">
      <div class="commu-hero__intro">
        <p class="commu-hero__eyebrow">
          Communication • Espace administration
        </p>
        <h1 class="commu-hero__title">
          Animer la communauté
        </h1>
        <p class="commu-hero__lead">
          Publie les actualités du Club Otaku ENEAM dans le bon pôle, puis suis l’accueil
          des annonces : réactions, commentaires et pôles les plus actifs.
        </p>
        <div class="commu-hero__actions">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-refresh-cw"
            label="Actualiser les publications"
            :loading="pending"
            @click="refresh()"
          />
          <UButton
            to="/communaute"
            target="_blank"
            color="neutral"
            variant="soft"
            icon="i-lucide-external-link"
            label="Voir la page Communauté"
          />
        </div>
      </div>

      <div class="commu-hero__stats">
        <CommuStatCard
          label="Publications"
          :value="stats.posts"
          icon="i-lucide-megaphone"
          hint="Tous pôles confondus"
        />
        <CommuStatCard
          label="Réactions"
          :value="stats.reactions"
          icon="i-lucide-heart"
          tone="accent"
          hint="Likes reçus"
        />
        <CommuStatCard
          label="Commentaires"
          :value="stats.comments"
          icon="i-lucide-message-circle"
          tone="muted"
          hint="Réponses des membres"
        />
        <CommuStatCard
          label="Auteurs distincts"
          :value="stats.authors"
          icon="i-lucide-users-round"
          tone="accent"
          :hint="`Pôle le plus actif : ${stats.topPole}`"
        />
      </div>
    </header>

    <!-- Barre d’onglets : une action = un clic -->
    <div
      class="otaku-tabs commu-tabs"
      role="tablist"
      aria-label="Sections de la communication"
    >
      <button
        v-for="tab in commuTabs"
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
        <span
          v-if="tabCounts[tab.value] !== undefined"
          class="otaku-tab__count"
        >{{ tabCounts[tab.value] }}</span>
      </button>
    </div>
    <!-- Onglet : Publier une annonce -->
    <div
      v-show="activeTab === 'publier'"
      role="tabpanel"
      aria-label="Publier une annonce"
    >
        <!-- ================= COLONNE GAUCHE : PUBLIER ================= -->
        <div class="commu-columns__side">
          <form
            class="commu-panel surface-solid clip-corner"
            @submit.prevent="publishPost"
          >
            <p class="commu-panel__eyebrow">
              Nouvelle publication
            </p>
            <h2 class="commu-panel__title">
              Rédiger une annonce
            </h2>
            <p
              v-if="user"
              class="commu-panel__identity"
            >
              Connecté en tant que <strong>{{ user.pseudo }}</strong>
            </p>

            <label
              for="commu-post-content"
              class="commu-field-label"
            >
              Message
            </label>
            <ClientOnly>
              <RichTextEditor
                v-model="content"
                :max-characters="POST_LIMIT"
                aria-label="Contenu de la publication"
                placeholder="Ex. : Répétition danse vendredi 18 h — amphithéâtre B. Inscription auprès du bureau."
              />
              <template #fallback>
                <UTextarea
                  id="commu-post-content"
                  v-model="content"
                  :rows="7"
                  placeholder="Ex. : Répétition danse vendredi 18 h — amphithéâtre B. Inscription auprès du bureau."
                  aria-label="Contenu de la publication"
                  class="w-full"
                />
              </template>
            </ClientOnly>
            <div class="commu-meter">
              <span
                class="commu-meter__counter"
                :class="{ 'commu-meter__counter--warn': remaining < 200 }"
              >
                {{ contentLength }} / {{ POST_LIMIT }} caractères
              </span>
              <span class="commu-meter__state">
                <template v-if="contentLength === 0">
                  En attente de saisie
                </template>
                <template v-else-if="contentLength < 3">
                  Trop court (3 caractères minimum)
                </template>
                <template v-else>
                  Prêt à publier
                </template>
              </span>
            </div>

            <p class="commu-field-label commu-field-label--spaced">
              Pôle de diffusion
            </p>
            <CommuPoleFilter
              v-model="pole"
              :options="composerPoleOptions"
              aria-label="Choisir le pôle de diffusion"
            />

            <UButton
              type="submit"
              color="primary"
              icon="i-lucide-send"
              :label="`Publier dans ${poleLabel(pole)}`"
              :loading="submitting"
              :disabled="!canPublish"
              block
              class="mt-4"
            />
            <p class="commu-panel__hint">
              La publication apparaît immédiatement dans la page Communauté et dans le filtre
              du pôle choisi. Les membres connectés peuvent réagir et commenter.
            </p>
          </form>

          <section class="commu-panel surface-solid clip-corner">
            <p class="commu-panel__eyebrow">
              Bonnes pratiques
            </p>
            <h2 class="commu-panel__title">
              Publier utile
            </h2>
            <ul class="commu-tips">
              <li>
                <UIcon
                  name="i-lucide-target"
                  class="h-4 w-4"
                />
                <span>Un pôle par annonce : le message ne s’affiche que dans le filtre du pôle choisi.</span>
              </li>
              <li>
                <UIcon
                  name="i-lucide-heading"
                  class="h-4 w-4"
                />
                <span>L’essentiel en première ligne : annonce dès le premier mot quoi, quand et où.</span>
              </li>
              <li>
                <UIcon
                  name="i-lucide-calendar-days"
                  class="h-4 w-4"
                />
                <span>Pour un événement, publie 48 h avant et rappelle la date, l’heure et le lieu.</span>
              </li>
              <li>
                <UIcon
                  name="i-lucide-copy-check"
                  class="h-4 w-4"
                />
                <span>Pas de doublon : une information = une publication, sinon le fil devient illisible.</span>
              </li>
            </ul>
          </section>
        </div>
    </div>

    <!-- Onglet : Suivi des publications -->
    <div
      v-show="activeTab === 'suivi'"
      role="tabpanel"
      aria-label="Suivi des publications"
    >
        <!-- ================= COLONNE DROITE : SUIVI ================= -->
        <section class="commu-columns__main">
          <CommuSectionHeader
            eyebrow="Suivi"
            title="Publications récentes"
            :count="filteredPosts.length"
            count-label="publications"
            description="Recherche par auteur, contenu ou pôle, trie par date ou par engagement, modère ce qui doit l’être."
          >
            <template #actions>
              <UButton
                v-if="hasFilters"
                color="neutral"
                variant="soft"
                size="sm"
                icon="i-lucide-filter-x"
                label="Réinitialiser"
                @click="resetFilters"
              />
            </template>
          </CommuSectionHeader>

          <div class="commu-filters surface-solid clip-corner">
            <div class="commu-filters__row">
              <UInput
                v-model="search"
                icon="i-lucide-search"
                placeholder="Rechercher un auteur, un mot, un pôle"
                aria-label="Rechercher une publication"
                class="w-full"
              />
              <UButton
                v-if="searchTerm"
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-x"
                label="Effacer"
                @click="search = ''"
              />
            </div>
            <div class="commu-filters__row">
              <CommuPoleFilter
                v-model="poleFilter"
                :options="poleFilterOptions"
                aria-label="Filtrer les publications par pôle"
              />
              <CommuPoleFilter
                v-model="sort"
                :options="sortOptions"
                aria-label="Trier les publications"
              />
            </div>
            <p class="commu-filters__summary">
              {{ filteredPosts.length }} publication(s) affichée(s) sur {{ posts.length }}
            </p>
          </div>

          <div
            v-if="pending"
            class="commu-stack"
            aria-busy="true"
          >
            <USkeleton
              v-for="index in 3"
              :key="index"
              class="h-40 rounded-2xl"
            />
          </div>

          <CommuEmptyState
            v-else-if="error"
            icon="i-lucide-wifi-off"
            tone="alert"
            title="Impossible de charger les publications"
            description="Le serveur n’a pas répondu. Tu peux relancer le chargement sans perdre ton brouillon."
          >
            <template #actions>
              <UButton
                color="primary"
                icon="i-lucide-refresh-cw"
                label="Réessayer"
                @click="refresh()"
              />
            </template>
          </CommuEmptyState>

          <CommuEmptyState
            v-else-if="posts.length === 0"
            icon="i-lucide-megaphone"
            title="Aucune publication pour le moment"
            description="Le fil est vide. Utilise le formulaire de gauche pour diffuser la première annonce du club."
          />

          <CommuEmptyState
            v-else-if="filteredPosts.length === 0"
            icon="i-lucide-search-x"
            title="Aucune publication ne correspond aux filtres"
            description="Change de pôle, ajuste la recherche ou reviens à la vue complète."
          >
            <template #actions>
              <UButton
                color="neutral"
                variant="soft"
                icon="i-lucide-filter-x"
                label="Voir toutes les publications"
                @click="resetFilters"
              />
            </template>
          </CommuEmptyState>

          <template v-else>
            <div class="commu-stack">
              <CommuPostCard
                v-for="post in paginatedPosts"
                :key="post.id"
                :post="post"
                :time-label="formatDate(post.createdAt)"
                :pole-label="poleLabel(post.pole)"
                can-moderate
                :deleting="deletingId === post.id"
                @delete="deletePost(post)"
              />
            </div>
            <div
              v-if="hiddenPosts > 0"
              class="commu-more"
            >
              <UButton
                color="neutral"
                variant="soft"
                icon="i-lucide-chevron-down"
                :label="`Afficher ${nextPageCount} publications de plus`"
                @click="visible += POST_PAGE"
              />
              <span class="commu-more__hint">{{ hiddenPosts }} publication(s) encore masquée(s)</span>
            </div>
          </template>
        </section>
    </div>
  </div>
</template>

<style scoped>
.commu-hero {
  display: grid;
  gap: 1.5rem;
  padding: 1.5rem;
}

.commu-hero__eyebrow {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--accent-color);
}

.commu-hero__title {
  margin-top: 0.6rem;
  font-family: var(--font-display);
  font-size: clamp(1.9rem, 4.5vw, 2.75rem);
  font-weight: 900;
  line-height: 1.05;
  color: var(--text-color);
}

.commu-hero__lead {
  margin-top: 0.75rem;
  max-width: 62ch;
  font-size: 0.92rem;
  line-height: 1.6;
  color: var(--muted-color);
}

.commu-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 1.25rem;
}

.commu-hero__stats {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.commu-tabs {
  margin-top: 2.5rem;
}

.commu-columns__side,
.commu-columns__main {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
}

.commu-panel {
  padding: 1.25rem;
}

.commu-panel__eyebrow {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--accent-color);
}

.commu-panel__title {
  margin: 0.4rem 0 0.85rem;
  font-family: var(--font-display);
  font-size: 1.2rem;
  font-weight: 800;
  color: var(--text-color);
}

.commu-panel__identity {
  margin-bottom: 0.85rem;
  font-size: 0.8rem;
  color: var(--muted-color);
}

.commu-panel__identity strong {
  color: var(--text-color);
}

.commu-panel__hint {
  margin-top: 0.75rem;
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--muted-color);
}

.commu-field-label {
  display: block;
  margin-bottom: 0.4rem;
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted-color);
}

.commu-field-label--spaced {
  margin-top: 1.1rem;
}

.commu-meter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.5rem;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--muted-color);
}

.commu-meter__counter--warn {
  color: var(--primary-color);
}

.commu-meter__state {
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.commu-tips {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  font-size: 0.8rem;
  line-height: 1.5;
  color: var(--muted-color);
}

.commu-tips li {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
}

.commu-tips :deep(svg) {
  flex: 0 0 auto;
  margin-top: 0.15rem;
  color: var(--primary-color);
}

.commu-filters {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem 1.15rem;
}

.commu-filters__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.commu-filters__summary {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  color: var(--muted-color);
}

.commu-stack {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.commu-more {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1rem;
  text-align: center;
}

.commu-more__hint {
  font-size: 0.75rem;
  color: var(--muted-color);
}

@media (min-width: 640px) {
  .commu-hero {
    padding: 2rem;
  }

  .commu-hero__stats {
    grid-template-columns: repeat(4, minmax(0, 1fr));
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
  margin-top: 1.5rem;
  margin-bottom: 2rem;
}

[role='tabpanel'] + [role='tabpanel'] {
  margin-top: 1.5rem;
}

</style>
