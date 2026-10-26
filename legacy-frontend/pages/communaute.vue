<script setup lang="ts">
import { rawPoleMatches, resolveUserPoles } from '#shared/poles'
import { htmlToPlainText, isRichTextEmpty, richTextLength } from '#shared/rich-text'

/**
 * Page Communauté — annuaire de membres + pôles + fil d'annonces.
 *
 * Objectif d'usage : un visiteur doit trouver quelque chose d'utile en moins
 * d'une minute. La page est donc découpée en quatre onglets courts
 * (Membres / Cartes Otaku / Pôles / Annonces) au lieu d'un long défilement, avec un bandeau
 * d'activité permanent (derniers inscrits, pôles actifs, dernières annonces).
 *
 * L'état de navigation vit dans l'URL pour que les liens restent partageables :
 *   ?vue=membres|cartes|poles|annonces  ?pole=gaming  ?q=pseudo  ?tri=recent  ?auteur=X
 *
 * Données réelles uniquement : membres, cartes approuvées et annonces via leurs APIs dédiées.
 * Aucune couleur figée (uniquement les variables de thème) et aucune donnée
 * privée affichée : l'API publique n'expose ni email ni téléphone.
 */
type Member = {
  id: string
  pseudo: string
  pole: string | null
  /** Multi-pôles : union « poles + pole » renvoyée par l'API. */
  poles: string[]
  level: string
  ranking: number
  avatar: string | null
  bio: string | null
}

type Post = {
  id: string
  author: {
    id: string
    pseudo: string
    profile: { avatar: string | null } | null
  }
  pole: string
  content: string
  likes: number
  comments: number
  createdAt: string
}

type ApprovedCard = {
  id: string
  displayName: string
  imageUrl: string | null
  favoriteAnime: string | null
  favoriteManga: string | null
  favoriteAnimes: string[]
  favoriteMangas: string[]
  favoriteGame: string | null
  bio: string | null
  status: 'APPROVED'
  createdAt: string
  member: {
    id: string
    pseudo: string
    nom: string | null
    prenom: string | null
    pole: string | null
    poles: string[]
    level: string
    avatar: string | null
    situation: 'STUDENT_BENIN' | 'STUDENT_ABROAD' | 'PROFESSIONAL' | null
    pays: string | null
    profession: string | null
    universite: string | null
    filiere: string | null
  }
}

type ApiResponse<T> = { data: T[] }
type PoleOption = { label: string, value: string, count?: number }
type TabValue = 'membres' | 'cartes' | 'poles' | 'annonces'
type SortValue = 'recent' | 'pionniers' | 'pseudo-asc' | 'pseudo-desc' | 'niveau'

const { success, alert } = useGameToast()
const { playSfx } = useSoundManager()
const { user } = useAuth()
const route = useRoute()
const router = useRouter()

const ALL_POLES = 'all'
const POST_LIMIT = 5000
const MEMBER_PAGE = 8
const POST_PAGE = 4
const DEFAULT_TAB: TabValue = 'membres'
const DEFAULT_SORT: SortValue = 'recent'
const TAB_VALUES: TabValue[] = ['membres', 'cartes', 'poles', 'annonces']
const SORT_VALUES: SortValue[] = ['recent', 'pionniers', 'pseudo-asc', 'pseudo-desc', 'niveau']

const POLE_LABELS: Record<string, string> = {
  'anime': 'Anime',
  'manga': 'Manga',
  'gaming': 'Gaming',
  'danse': 'Danse',
  'k-drama': 'K-Drama',
  'culture': 'Culture'
}

const POLE_ICONS: Record<string, string> = {
  'anime': 'i-lucide-sparkles',
  'manga': 'i-lucide-book-open',
  'gaming': 'i-lucide-gamepad-2',
  'danse': 'i-lucide-music',
  'k-drama': 'i-lucide-clapperboard',
  'culture': 'i-lucide-globe'
}

const POLE_VALUES = Object.keys(POLE_LABELS)
const POLE_FALLBACK_ICON = 'i-lucide-layers'

const {
  data: membersResponse,
  pending: membersPending,
  error: membersError,
  refresh: refreshMembers
} = await useFetch<ApiResponse<Member>>('/api/communaute/membres')

const {
  data: postsResponse,
  pending: postsPending,
  error: postsError,
  refresh: refreshPosts
} = await useFetch<ApiResponse<Post>>('/api/communaute/posts')

const {
  data: cardsResponse,
  pending: cardsPending,
  error: cardsError,
  refresh: refreshCards
} = await useFetch<ApiResponse<ApprovedCard>>('/api/communaute/cartes')

const members = computed<Member[]>(() => membersResponse.value?.data || [])
const approvedCards = computed<ApprovedCard[]>(() => cardsResponse.value?.data || [])

// Copie locale des publications : permet le like optimiste et la suppression
// immédiate sans attendre un nouveau chargement complet.
const posts = ref<Post[]>([])
watch(postsResponse, (response) => {
  posts.value = [...(response?.data || [])]
}, { immediate: true })

// ------------------------------------------------------------
// ÉTAT DE NAVIGATION (synchronisé avec l'URL)
// ------------------------------------------------------------
function readTab(value: unknown): TabValue {
  return typeof value === 'string' && (TAB_VALUES as string[]).includes(value) ? value as TabValue : DEFAULT_TAB
}

function readSort(value: unknown): SortValue {
  return typeof value === 'string' && (SORT_VALUES as string[]).includes(value) ? value as SortValue : DEFAULT_SORT
}

const activeTab = ref<TabValue>(readTab(route.query.vue))
const selectedPole = ref<string>(typeof route.query.pole === 'string' && route.query.pole ? normalizePole(route.query.pole) : ALL_POLES)
const sort = ref<SortValue>(readSort(route.query.tri))
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const authorFilter = ref(typeof route.query.auteur === 'string' ? route.query.auteur : '')

const composerPole = ref(POLE_VALUES[0] || 'anime')
const newPost = ref('')
const publishing = ref(false)
const likePending = ref<string[]>([])
const deletingId = ref<string | null>(null)
const visibleMembers = ref(MEMBER_PAGE)
const visiblePosts = ref(POST_PAGE)
const composerTarget = ref<HTMLElement | null>(null)
const memberGridTarget = ref<HTMLElement | null>(null)
const detailMemberId = ref<string | null>(null)

function buildQuery(): Record<string, string> {
  const query: Record<string, string> = {}
  if (activeTab.value !== DEFAULT_TAB) query.vue = activeTab.value
  if (selectedPole.value !== ALL_POLES) query.pole = selectedPole.value
  const term = search.value.trim()
  if (term) query.q = term
  if (sort.value !== DEFAULT_SORT) query.tri = sort.value
  if (authorFilter.value) query.auteur = authorFilter.value
  return query
}

function sameQuery(current: Record<string, unknown>, next: Record<string, string>) {
  const currentKeys = Object.keys(current)
  const nextKeys = Object.keys(next)
  if (currentKeys.length !== nextKeys.length) return false
  return nextKeys.every(key => String(current[key] ?? '') === next[key])
}

/** Reflete l'état dans l'URL (replace = pas de pollution de l'historique). */
function syncUrl() {
  if (sameQuery(route.query, buildQuery())) return
  router.replace({ query: buildQuery() })
}

/** Liens entrants (?vue=…&pole=…&q=…) et boutons précédent/suivant du navigateur. */
watch(() => route.query, (query) => {
  const tab = readTab(query.vue)
  if (tab !== activeTab.value) activeTab.value = tab

  const pole = typeof query.pole === 'string' && query.pole ? normalizePole(query.pole) : ALL_POLES
  if (pole !== selectedPole.value) selectedPole.value = pole

  const term = typeof query.q === 'string' ? query.q : ''
  if (term !== search.value.trim()) search.value = term

  const nextSort = readSort(query.tri)
  if (nextSort !== sort.value) sort.value = nextSort

  const author = typeof query.auteur === 'string' ? query.auteur : ''
  if (author !== authorFilter.value) authorFilter.value = author
}, { deep: true })

watch([activeTab, selectedPole, sort, authorFilter], syncUrl)

// La saisie met à jour l'URL après une courte pause (pas une navigation par frappe).
let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(syncUrl, 220)
})

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
})

// ------------------------------------------------------------
// NORMALISATION DES PÔLES
// ------------------------------------------------------------
const isModerator = computed(() => ['ADMIN', 'INTERMEDIATE_ADMIN', 'SUPER_ADMIN'].includes(user.value?.role || ''))
const refreshing = computed(() => membersPending.value || postsPending.value || cardsPending.value)
const searchTerm = computed(() => search.value.trim().toLowerCase())

function normalizePole(value: string | null | undefined) {
  return (value || '').trim().toLowerCase()
}

/**
 * Ce texte de pôle correspond-il au slug filtré ?
 *
 * Délègue à `shared/poles.ts` : la même règle sert au filtre « tous les pôles »,
 * au catalogue des pôles et au composeur d'annonces — un seul endroit à tester.
 */
function poleMatches(rawPole: string | null | undefined, slug: string) {
  return rawPoleMatches(rawPole, slug)
}

// ------------------------------------------------------------
// MULTI-PÔLES : un membre appartient à l'UNION « poles + pole »
// ------------------------------------------------------------
/** Tous les pôles d'un membre (compatibilité ascendante incluse). */
function memberPoles(member: Pick<Member, 'pole' | 'poles'>) {
  return resolveUserPoles(member)
}

/** Badges à afficher : libellés lisibles de tous ses pôles. */
function memberPoleLabels(member: Pick<Member, 'pole' | 'poles'>) {
  return memberPoles(member).map(slug => poleLabel(slug))
}

/** Le membre appartient-il au pôle filtré ? (union, pas seulement le principal) */
function memberMatchesPole(member: Pick<Member, 'pole' | 'poles'>, slug: string) {
  if (slug === ALL_POLES) return true
  return memberPoles(member).some(value => poleMatches(value, slug))
}

function poleLabel(value: string | null | undefined) {
  const normalized = normalizePole(value)
  if (normalized === ALL_POLES) return 'Tous les pôles'
  return POLE_LABELS[normalized] || value || 'Pôle libre'
}

function poleIcon(value: string | null | undefined) {
  return POLE_ICONS[normalizePole(value)] || POLE_FALLBACK_ICON
}

/**
 * Catalogue des pôles : les 6 pôles officiels du club, plus ceux réellement
 * présents dans les données (un pôle libre saisi par un membre reste filtrable).
 */
const poleCatalog = computed(() => {
  const slugs: string[] = [...POLE_VALUES]
  const push = (raw: string | null | undefined) => {
    const normalized = normalizePole(raw)
    if (!normalized) return
    // « all » n'est pas un pôle : c'est une diffusion tous pôles.
    if (normalized === ALL_POLES) return
    // Évite le doublon « Culture » / « Culture générale » : un pôle libre qui
    // correspond déjà à un pôle officiel ne crée pas une seconde fiche.
    if (slugs.some(slug => poleMatches(normalized, slug))) return
    slugs.push(normalized)
  }
  // Multi-pôles : on enregistre CHAQUE pôle du membre, pas seulement le principal.
  for (const member of members.value) for (const value of memberPoles(member)) push(value)
  for (const post of posts.value) push(post.pole)

  return slugs.map((slug) => {
    const poleMembers = members.value.filter(member => memberMatchesPole(member, slug))
    const postCount = posts.value.filter(post => poleMatches(post.pole, slug)).length
    return {
      slug,
      label: POLE_LABELS[slug] || slug.charAt(0).toUpperCase() + slug.slice(1),
      icon: poleIcon(slug),
      memberCount: poleMembers.length,
      postCount,
      score: poleMembers.length * 2 + postCount,
      preview: poleMembers.slice(0, 4)
    }
  })
})

const activePoleCount = computed(() => poleCatalog.value.filter(pole => pole.score > 0).length)

const poleFilterOptions = computed<PoleOption[]>(() => [
  { label: 'Tous les pôles', value: ALL_POLES },
  ...poleCatalog.value
    .filter(pole => pole.score > 0 || POLE_VALUES.includes(pole.slug))
    .map(pole => ({
      label: pole.label,
      value: pole.slug,
      count: pole.memberCount
    }))
])

const composerPoleOptions: PoleOption[] = [
  { label: 'Tous les pôles', value: ALL_POLES },
  ...POLE_VALUES.map(value => ({
    label: POLE_LABELS[value] || value,
    value
  }))
]

const sortOptions = [
  { label: 'Nouveaux membres d’abord', value: 'recent' },
  { label: 'Pionniers d’abord', value: 'pionniers' },
  { label: 'Pseudo (A → Z)', value: 'pseudo-asc' },
  { label: 'Pseudo (Z → A)', value: 'pseudo-desc' },
  { label: 'Niveau (A → Z)', value: 'niveau' }
]

// ------------------------------------------------------------
// ANNUAIRE
// ------------------------------------------------------------
/**
 * L'API trie les membres par date d'inscription croissante et renvoie
 * `ranking = total - index` : le ranking le plus haut est donc le premier
 * inscrit. On en déduit une position d'arrivée honnête (1 = pionnier), sans
 * inventer de date que l'API n'expose pas.
 */
const arrivalPositions = computed(() => {
  const positions = new Map<string, number>()
  const ordered = [...members.value].sort((a, b) => b.ranking - a.ranking)
  ordered.forEach((member, index) => positions.set(member.id, index + 1))
  return positions
})

const filteredMembers = computed(() => {
  return members.value.filter((member) => {
    const matchesPole = memberMatchesPole(member, selectedPole.value)
    if (!matchesPole) return false
    if (!searchTerm.value) return true
    return member.pseudo.toLowerCase().includes(searchTerm.value)
      || memberPoleLabels(member).join(' · ').toLowerCase().includes(searchTerm.value)
      || member.level.toLowerCase().includes(searchTerm.value)
      || (member.bio || '').toLowerCase().includes(searchTerm.value)
  })
})

const sortedMembers = computed(() => {
  const list = [...filteredMembers.value]
  switch (sort.value) {
    case 'pionniers':
      return list.sort((a, b) => b.ranking - a.ranking)
    case 'pseudo-asc':
      return list.sort((a, b) => a.pseudo.localeCompare(b.pseudo, 'fr', { sensitivity: 'base' }))
    case 'pseudo-desc':
      return list.sort((a, b) => b.pseudo.localeCompare(a.pseudo, 'fr', { sensitivity: 'base' }))
    case 'niveau':
      return list.sort((a, b) => (a.level || '').localeCompare(b.level || '', 'fr', { sensitivity: 'base' }))
    case 'recent':
    default:
      return list.sort((a, b) => a.ranking - b.ranking)
  }
})

const paginatedMembers = computed(() => sortedMembers.value.slice(0, visibleMembers.value))
const hiddenMembers = computed(() => Math.max(0, sortedMembers.value.length - paginatedMembers.value.length))
const memberPageStep = computed(() => Math.min(hiddenMembers.value, MEMBER_PAGE))

// ------------------------------------------------------------
// FIL D'ANNONCES
// ------------------------------------------------------------
const filteredPosts = computed(() => {
  return posts.value.filter((post) => {
    if (!poleMatches(post.pole, selectedPole.value)) return false
    if (authorFilter.value && post.author.pseudo !== authorFilter.value) return false
    if (!searchTerm.value) return true
    // Recherche sur le TEXTE (les balises HTML ne doivent pas être cherchées).
    return htmlToPlainText(post.content).toLowerCase().includes(searchTerm.value)
      || post.author.pseudo.toLowerCase().includes(searchTerm.value)
      || poleLabel(post.pole).toLowerCase().includes(searchTerm.value)
  })
})

const paginatedPosts = computed(() => filteredPosts.value.slice(0, visiblePosts.value))
const hiddenPosts = computed(() => Math.max(0, filteredPosts.value.length - paginatedPosts.value.length))
const postPageStep = computed(() => Math.min(hiddenPosts.value, POST_PAGE))

/** Auteurs présents dans la page courante du fil (raccourci « voir ses annonces »). */
const pageAuthors = computed(() => {
  const names = new Set<string>()
  for (const post of paginatedPosts.value) names.add(post.author.pseudo)
  return [...names]
})

function setSort(value: string) {
  sort.value = readSort(value)
}

const hasActiveFilters = computed(() => selectedPole.value !== ALL_POLES || searchTerm.value.length > 0 || Boolean(authorFilter.value))

// ------------------------------------------------------------
// ACTIVITÉ MISE EN AVANT
// ------------------------------------------------------------
const stats = computed(() => ({
  members: members.value.length,
  posts: posts.value.length,
  reactions: posts.value.reduce((total, post) => total + post.likes + post.comments, 0),
  activePoles: activePoleCount.value
}))

const recentMembers = computed(() => {
  return [...members.value]
    .sort((a, b) => a.ranking - b.ranking)
    .slice(0, 3)
    .map(member => ({
      id: member.id,
      pseudo: member.pseudo,
      avatar: member.avatar,
      poleLabel: memberPoleLabels(member).join(' · ') || 'Pôle non renseigné'
    }))
})

const topPoles = computed(() => {
  return [...poleCatalog.value]
    .filter(pole => pole.score > 0)
    .sort((a, b) => b.score - a.score || b.memberCount - a.memberCount)
    .slice(0, 3)
    .map(pole => ({
      slug: pole.slug,
      label: pole.label,
      icon: pole.icon,
      memberCount: pole.memberCount,
      postCount: pole.postCount
    }))
})

const recentPosts = computed(() => posts.value.slice(0, 2).map(post => ({
  id: post.id,
  pseudo: post.author.pseudo,
  avatar: post.author.profile?.avatar || null,
  poleLabel: poleLabel(post.pole),
  excerpt: htmlToPlainText(post.content).replace(/\s+/g, ' ').slice(0, 90),
  timeLabel: formatRelativeTime(post.createdAt)
})))

/** Statistiques d'un membre calculées sur le fil déjà chargé. */
function memberStats(member: Member) {
  const own = posts.value.filter(post => post.author.id === member.id)
  const last = own[0]
  return {
    postCount: own.length,
    reactionCount: own.reduce((total, post) => total + post.likes + post.comments, 0),
    lastPostLabel: last ? formatRelativeTime(last.createdAt).toLowerCase() : null
  }
}

const detailMember = computed(() => members.value.find(member => member.id === detailMemberId.value) || null)
const detailMemberStats = computed(() => detailMember.value ? memberStats(detailMember.value) : null)
const detailMemberPosition = computed(() => detailMember.value ? arrivalPositions.value.get(detailMember.value.id) ?? null : null)
const detailOpen = computed({
  get: () => detailMemberId.value !== null,
  set: (value: boolean) => { if (!value) detailMemberId.value = null }
})

// ------------------------------------------------------------
// ONGLETS
// ------------------------------------------------------------
const tabs = computed(() => [
  {
    value: 'membres',
    label: 'Membres',
    icon: 'i-lucide-users-round',
    count: filteredMembers.value.length,
    hint: 'Annuaire : recherche, filtre par pôle, tri'
  },
  {
    value: 'cartes',
    label: 'Cartes Otaku',
    icon: 'i-lucide-id-card',
    count: approvedCards.value.length,
    hint: 'Cartes de membre validées par le club'
  },
  {
    value: 'poles',
    label: 'Pôles',
    icon: 'i-lucide-layers',
    count: activePoleCount.value,
    hint: 'Les groupes du club et leur activité'
  },
  {
    value: 'annonces',
    label: 'Annonces',
    icon: 'i-lucide-megaphone',
    count: filteredPosts.value.length,
    hint: 'Fil communautaire et publication'
  }
])

function setTab(value: string) {
  const tab = readTab(value)
  if (tab === activeTab.value) return
  activeTab.value = tab
  playSfx('click')
}

/** Phrase d'aide de l'onglet courant (une seule, sous la barre d'onglets). */
const tabHint = computed(() => {
  switch (activeTab.value) {
    case 'cartes':
      return 'Les cartes de membre validées par l’équipe du club.'
    case 'poles':
      return 'Les pôles du club : effectifs et activité.'
    case 'annonces':
      return 'Le fil communautaire et la publication.'
    default:
      return 'Annuaire des membres : cherche, filtre, trie.'
  }
})

function resetPagination() {
  visibleMembers.value = MEMBER_PAGE
  visiblePosts.value = POST_PAGE
}

watch([selectedPole, search, authorFilter, sort], resetPagination)

// ------------------------------------------------------------
// ACTIONS
// ------------------------------------------------------------
function formatRelativeTime(value: string) {
  const elapsed = Date.now() - new Date(value).getTime()
  const minutes = Math.max(1, Math.floor(elapsed / 60000))
  if (minutes < 60) return `Il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Il y a ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `Il y a ${days} j`
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value))
}

function resetFilters() {
  selectedPole.value = ALL_POLES
  search.value = ''
  authorFilter.value = ''
  playSfx('click')
}

/** Ouvre la fiche d'un membre (depuis une carte ou le bandeau d'activité). */
function openMember(id: string) {
  detailMemberId.value = id
  playSfx('click')
}

/** Recentre l'annuaire sur un pôle : onglet Membres + filtre + défilement. */
function showPole(slug: string, scroll = true) {
  const normalized = normalizePole(slug)
  selectedPole.value = normalized || ALL_POLES
  authorFilter.value = ''
  activeTab.value = 'membres'
  playSfx('click')
  if (!scroll) return
  nextTick(() => memberGridTarget.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

/** Depuis une carte de membre : filtrer l'annuaire sur son pôle principal. */
function showMemberPole(member: Member) {
  showPole(memberPoles(member)[0] || ALL_POLES)
}

/** Affiche les annonces d'un membre dans l'onglet Annonces. */
function showAuthor(pseudo: string) {
  authorFilter.value = pseudo
  selectedPole.value = ALL_POLES
  search.value = ''
  activeTab.value = 'annonces'
  detailMemberId.value = null
  playSfx('click')
  nextTick(() => composerTarget.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

/** Depuis une annonce : filtrer sur son auteur. */
function filterByAuthor(pseudo: string) {
  authorFilter.value = pseudo
  playSfx('click')
}

function goToComposer() {
  activeTab.value = 'annonces'
  nextTick(() => composerTarget.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

async function refreshAll() {
  await Promise.all([refreshMembers(), refreshPosts(), refreshCards()])
}

async function addPost() {
  if (!user.value) {
    alert('Connecte-toi pour publier dans la communauté.')
    return
  }

  const content = newPost.value.trim()
  if (isRichTextEmpty(content)) {
    alert('Écris d’abord ton message avant de publier.')
    return
  }
  if (richTextLength(content) > POST_LIMIT) {
    alert(`Le message dépasse ${POST_LIMIT} caractères (balisage non compté).`)
    return
  }

  publishing.value = true
  try {
    await $fetch('/api/communaute/posts', {
      method: 'POST',
      body: { content, pole: composerPole.value }
    })
    newPost.value = ''
    await refreshPosts()
    playSfx('popup')
    success('Publication envoyée à la communauté !')
  } catch (error: unknown) {
    alert(getApiErrorMessage(error, 'La publication n’a pas pu être enregistrée.'))
  } finally {
    publishing.value = false
  }
}

async function toggleLike(post: Post) {
  if (!user.value) {
    alert('Connecte-toi pour aimer une publication.')
    return
  }
  if (likePending.value.includes(post.id)) return

  likePending.value = [...likePending.value, post.id]
  try {
    await $fetch(`/api/communaute/posts/${post.id}/like`, {
      method: 'POST',
      body: { action: 'like' }
    })
    post.likes += 1
    playSfx('click')
  } catch (error: unknown) {
    alert(getApiErrorMessage(error, 'Impossible d’enregistrer ta réaction.'))
  } finally {
    likePending.value = likePending.value.filter(id => id !== post.id)
  }
}

async function deletePost(post: Post) {
  if (!window.confirm('Supprimer cette publication ?')) return

  deletingId.value = post.id
  try {
    await $fetch(`/api/communaute/posts/${post.id}`, { method: 'DELETE' })
    posts.value = posts.value.filter(item => item.id !== post.id)
    success('Publication supprimée.')
  } catch (error: unknown) {
    alert(getApiErrorMessage(error, 'La publication n’a pas pu être supprimée.'))
  } finally {
    deletingId.value = null
  }
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = error.data
    if (typeof data === 'object' && data !== null && 'statusMessage' in data && typeof data.statusMessage === 'string') {
      return data.statusMessage
    }
  }

  return fallback
}

// Longueur du TEXTE (sans balisage) : même mesure que l'éditeur et l'API.
const newPostLength = computed(() => richTextLength(newPost.value))
const canPublish = computed(() => Boolean(user.value) && newPostLength.value > 0 && newPostLength.value <= POST_LIMIT)
const currentPoleOption = computed<PoleOption | undefined>(() => poleFilterOptions.value.find(option => option.value === selectedPole.value))
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 pb-24 pt-16 lg:px-8">
    <!-- ================= EN-TÊTE ================= -->
    <header class="commu-hero surface-solid clip-corner">
      <div class="commu-hero__intro">
        <p class="section-eyebrow">
          Communauté • Club Otaku ENEAM
        </p>
        <h1 class="commu-hero__title text-gradient-otaku">
          La communauté Otaku
        </h1>
        <p class="commu-hero__lead">
          L'annuaire du club, ses pôles et son fil d'annonces — sur une seule page,
          organisée en onglets. Cherche un membre, filtre par pôle, trie la liste,
          puis passe aux annonces sans perdre le fil.
        </p>
        <div class="commu-hero__actions">
          <UButton
            v-if="user"
            color="primary"
            icon="i-lucide-pencil-line"
            label="Publier une annonce"
            @click="goToComposer"
          />
          <UButton
            v-else
            to="/auth"
            color="primary"
            icon="i-lucide-log-in"
            label="Se connecter pour publier"
          />
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-refresh-cw"
            label="Actualiser"
            :loading="refreshing"
            @click="refreshAll"
          />
        </div>
      </div>

      <div class="commu-hero__stats">
        <CommuStatCard
          label="Membres inscrits"
          :value="stats.members"
          icon="i-lucide-users-round"
          hint="Tous pôles confondus"
        />
        <CommuStatCard
          label="Annonces publiées"
          :value="stats.posts"
          icon="i-lucide-megaphone"
          tone="accent"
          hint="Fil communautaire"
        />
        <CommuStatCard
          label="Réactions & commentaires"
          :value="stats.reactions"
          icon="i-lucide-flame"
          tone="muted"
          hint="Likes + commentaires"
        />
        <CommuStatCard
          label="Pôles actifs"
          :value="stats.activePoles"
          icon="i-lucide-layers"
          tone="accent"
          hint="Sur les 6 pôles du club"
        />
      </div>
    </header>

    <!-- ================= ACTIVITÉ MISE EN AVANT ================= -->
    <CommuActivityStrip
      :recent-members="recentMembers"
      :top-poles="topPoles"
      :recent-posts="recentPosts"
      :loading="membersPending || postsPending"
      @select-member="openMember"
      @select-pole="showPole"
      @open-posts="setTab('annonces')"
    />

    <!-- ================= ONGLETS ================= -->
    <div class="commu-nav surface-solid clip-corner">
      <CommuTabs
        :model-value="activeTab"
        :tabs="tabs"
        aria-label="Vues de la communauté"
        @update:model-value="setTab"
      />
      <p class="commu-nav__hint">
        {{ tabHint }}
      </p>
    </div>

    <!-- ================= ONGLET MEMBRES ================= -->
    <section
      v-show="activeTab === 'membres'"
      id="commu-panel-membres"
      ref="memberGridTarget"
      class="commu-panel"
      role="tabpanel"
      aria-labelledby="commu-tab-membres"
    >
      <CommuSectionHeader
        eyebrow="Annuaire"
        title="Les membres"
        :count="sortedMembers.length"
        count-label="membres"
        description="Chaque carte montre le pôle, le niveau et l'ordre d'arrivée. Ouvre une carte pour la fiche complète, ou filtre directement sur un pôle."
      >
        <template #actions>
          <UButton
            v-if="hasActiveFilters"
            color="neutral"
            variant="soft"
            size="sm"
            icon="i-lucide-filter-x"
            label="Réinitialiser"
            @click="resetFilters"
          />
        </template>
      </CommuSectionHeader>

      <!-- Barre d'outils de l'annuaire -->
      <div class="commu-tools clip-corner-sm">
        <div class="commu-tools__search">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Rechercher un pseudo, un niveau, un pôle"
            aria-label="Rechercher un membre"
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

        <AppSelect
          :model-value="sort"
          label="Trier par"
          icon="i-lucide-arrow-up-down"
          variant="filter"
          aria-label="Trier l'annuaire des membres"
          :options="sortOptions"
          @update:model-value="setSort"
        />

        <CommuPoleFilter
          v-model="selectedPole"
          show-counts
          :options="poleFilterOptions"
          aria-label="Filtrer l'annuaire par pôle"
        />
      </div>

      <p class="commu-tools__summary">
        <strong>{{ sortedMembers.length }}</strong> membre(s) affiché(s)
        <template v-if="selectedPole !== ALL_POLES">
          · pôle {{ currentPoleOption?.label || selectedPole }}
        </template>
        <template v-if="searchTerm">
          · recherche « {{ search.trim() }} »
        </template>
      </p>

      <div
        v-if="membersPending"
        class="commu-grid commu-grid--members"
        :class="{ 'commu-grid--members-all': selectedPole === ALL_POLES }"
        aria-busy="true"
      >
        <USkeleton
          v-for="index in 4"
          :key="index"
          class="h-56 rounded-2xl"
        />
      </div>

      <CommuEmptyState
        v-else-if="membersError"
        icon="i-lucide-wifi-off"
        tone="alert"
        title="Les membres sont indisponibles"
        description="Le serveur n’a pas répondu. Réessaie dans un instant — aucune donnée n’est perdue."
      >
        <template #actions>
          <UButton
            color="primary"
            icon="i-lucide-refresh-cw"
            label="Réessayer"
            @click="refreshMembers()"
          />
        </template>
      </CommuEmptyState>

      <CommuEmptyState
        v-else-if="members.length === 0"
        icon="i-lucide-user-plus"
        title="Aucun membre inscrit pour l’instant"
        description="Sois la première personne à rejoindre la communauté et à apparaître dans l’annuaire."
      >
        <template #actions>
          <UButton
            to="/inscription"
            color="primary"
            icon="i-lucide-user-plus"
            label="Créer mon compte"
          />
        </template>
      </CommuEmptyState>

      <CommuEmptyState
        v-else-if="sortedMembers.length === 0"
        icon="i-lucide-search-x"
        title="Aucun membre ne correspond à cette recherche"
        description="Essaie un autre pseudo, un autre pôle, ou repart de la vue complète."
      >
        <template #actions>
          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-filter-x"
            label="Voir tous les membres"
            @click="resetFilters"
          />
        </template>
      </CommuEmptyState>

      <template v-else>
        <div
          class="commu-grid commu-grid--members"
          :class="{ 'commu-grid--members-all': selectedPole === ALL_POLES }"
        >
          <CommuMemberCard
            v-for="member in paginatedMembers"
            :key="member.id"
            :member="member"
            :pole-label="memberPoleLabels(member)[0] || null"
            :pole-labels="memberPoleLabels(member)"
            :arrival-position="arrivalPositions.get(member.id) ?? null"
            :total-members="members.length"
            @open="openMember(member.id)"
            @pole="showMemberPole(member)"
          />
        </div>
        <div
          v-if="hiddenMembers > 0"
          class="commu-more"
        >
          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-chevron-down"
            :label="`Afficher ${memberPageStep} membres de plus`"
            @click="visibleMembers += MEMBER_PAGE"
          />
          <span class="commu-more__hint">{{ hiddenMembers }} membre(s) encore masqué(s)</span>
        </div>
      </template>
    </section>

    <!-- ================= ONGLET CARTES OTAKU ================= -->
    <section
      v-show="activeTab === 'cartes'"
      id="commu-panel-cartes"
      class="commu-panel"
      role="tabpanel"
      aria-labelledby="commu-tab-cartes"
    >
      <CommuSectionHeader
        eyebrow="Cartes de membre"
        title="Cartes Otaku"
        :count="approvedCards.length"
        count-label="cartes validées"
        description="Les cartes personnalisées des membres, après validation par l’équipe du club."
      >
        <template #actions>
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-lucide-refresh-cw"
            label="Actualiser les cartes"
            :loading="cardsPending"
            @click="refreshCards()"
          />
        </template>
      </CommuSectionHeader>

      <div
        v-if="cardsPending"
        class="commu-grid commu-grid--otaku-cards"
        aria-busy="true"
      >
        <USkeleton
          v-for="index in 2"
          :key="index"
          class="h-72 rounded-2xl"
        />
      </div>

      <CommuEmptyState
        v-else-if="cardsError"
        icon="i-lucide-wifi-off"
        tone="alert"
        title="Les cartes Otaku sont indisponibles"
        description="Le serveur n’a pas répondu. Réessaie dans un instant."
      >
        <template #actions>
          <UButton
            color="primary"
            icon="i-lucide-refresh-cw"
            label="Réessayer"
            @click="refreshCards()"
          />
        </template>
      </CommuEmptyState>

      <CommuEmptyState
        v-else-if="approvedCards.length === 0"
        icon="i-lucide-id-card"
        title="Aucune carte Otaku n’a encore été validée"
        description="Les cartes apparaîtront ici dès que l’équipe du club en aura approuvé une."
      />

      <div
        v-else
        class="commu-grid commu-grid--otaku-cards"
      >
        <OtakuCardDisplay
          v-for="card in approvedCards"
          :key="card.id"
          :card="card"
          :member="card.member"
        />
      </div>
    </section>

    <!-- ================= ONGLET PÔLES ================= -->
    <section
      v-show="activeTab === 'poles'"
      id="commu-panel-poles"
      class="commu-panel"
      role="tabpanel"
      aria-labelledby="commu-tab-poles"
    >
      <CommuSectionHeader
        eyebrow="Groupes"
        title="Les pôles du club"
        :count="activePoleCount"
        count-label="pôles actifs"
        description="Chaque pôle est un groupe à part entière. Ouvre un pôle pour n'afficher que ses membres dans l'annuaire."
      />

      <div class="commu-grid commu-grid--poles">
        <article
          v-for="group in poleCatalog"
          :key="group.slug"
          class="commu-pole-card clip-corner"
          :class="{ 'commu-pole-card--active': selectedPole === group.slug }"
        >
          <div class="commu-pole-card__head">
            <span class="commu-pole-card__icon">
              <UIcon
                :name="group.icon"
                class="h-4 w-4"
              />
            </span>
            <h3 class="commu-pole-card__title">
              {{ group.label }}
            </h3>
          </div>

          <div class="commu-pole-card__counts">
            <span>
              <strong>{{ group.memberCount }}</strong> membre(s)
            </span>
            <span>
              <strong>{{ group.postCount }}</strong> annonce(s)
            </span>
          </div>

          <div
            v-if="group.preview.length > 0"
            class="commu-pole-card__preview"
          >
            <CommuAvatar
              v-for="member in group.preview"
              :key="member.id"
              :name="member.pseudo"
              :src="member.avatar"
              size="sm"
              tone="accent"
            />
            <span class="commu-pole-card__names">
              {{ group.preview.map(item => item.pseudo).join(' · ') }}
            </span>
          </div>
          <p
            v-else
            class="commu-pole-card__empty"
          >
            Aucun membre dans ce pôle pour l’instant.
          </p>

          <UButton
            color="neutral"
            :variant="selectedPole === group.slug ? 'solid' : 'soft'"
            size="sm"
            class="commu-pole-card__cta"
            :icon="selectedPole === group.slug ? 'i-lucide-check' : 'i-lucide-users-round'"
            :label="selectedPole === group.slug ? 'Pôle affiché' : 'Voir les membres'"
            @click="showPole(group.slug)"
          />
        </article>
      </div>
    </section>

    <!-- ================= ONGLET ANNONCES ================= -->
    <section
      v-show="activeTab === 'annonces'"
      id="commu-panel-annonces"
      ref="composerTarget"
      class="commu-panel"
      role="tabpanel"
      aria-labelledby="commu-tab-annonces"
    >
      <CommuSectionHeader
        eyebrow="Fil communautaire"
        title="Annonces & publications"
        :count="filteredPosts.length"
        count-label="publications"
        description="Les annonces du club et les messages des membres, du plus récent au plus ancien."
      >
        <template #actions>
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-lucide-refresh-cw"
            label="Rafraîchir le fil"
            :loading="postsPending"
            @click="refreshPosts()"
          />
        </template>
      </CommuSectionHeader>

      <div class="commu-tools commu-tools--posts clip-corner-sm">
        <div class="commu-tools__search">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Rechercher dans les annonces"
            aria-label="Rechercher dans les annonces"
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

        <CommuPoleFilter
          v-model="selectedPole"
          :options="poleFilterOptions"
          aria-label="Filtrer les annonces par pôle"
        />
      </div>

      <div
        v-if="authorFilter"
        class="commu-author-chip"
      >
        <span>
          <UIcon
            name="i-lucide-user-round"
            class="h-3.5 w-3.5"
          />
          Annonces de <strong>{{ authorFilter }}</strong>
        </span>
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-lucide-x"
          label="Retirer ce filtre"
          @click="authorFilter = ''"
        />
      </div>

      <div class="commu-layout">
        <div class="commu-layout__feed">
          <div
            v-if="postsPending"
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
            v-else-if="postsError"
            icon="i-lucide-wifi-off"
            tone="alert"
            title="Le fil est momentanément indisponible"
            description="Impossible de charger les publications pour le moment."
          >
            <template #actions>
              <UButton
                color="primary"
                icon="i-lucide-refresh-cw"
                label="Réessayer"
                @click="refreshPosts()"
              />
            </template>
          </CommuEmptyState>

          <CommuEmptyState
            v-else-if="posts.length === 0"
            icon="i-lucide-megaphone"
            title="Aucune annonce pour l’instant"
            description="Le fil est vide. Lance la conversation en publiant la première annonce du club."
          />

          <CommuEmptyState
            v-else-if="filteredPosts.length === 0"
            icon="i-lucide-search-x"
            title="Aucune publication pour ce filtre"
            description="Aucun message ne correspond à la recherche, au pôle ou à l'auteur sélectionné."
          >
            <template #actions>
              <UButton
                color="neutral"
                variant="soft"
                icon="i-lucide-filter-x"
                label="Voir tout le fil"
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
                :time-label="formatRelativeTime(post.createdAt)"
                :pole-label="poleLabel(post.pole)"
                :can-moderate="isModerator"
                :deleting="deletingId === post.id"
                @like="toggleLike(post)"
                @delete="deletePost(post)"
              />
            </div>

            <div
              v-if="pageAuthors.length > 1"
              class="commu-post-author-actions"
            >
              <span class="commu-post-author-actions__label">Voir les annonces de :</span>
              <UButton
                v-for="author in pageAuthors"
                :key="author"
                color="neutral"
                variant="ghost"
                size="xs"
                icon="i-lucide-user-round"
                :label="author"
                @click="filterByAuthor(author)"
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
                :label="`Afficher ${postPageStep} publications de plus`"
                @click="visiblePosts += POST_PAGE"
              />
              <span class="commu-more__hint">{{ hiddenPosts }} publication(s) encore masquée(s)</span>
            </div>
          </template>
        </div>

        <aside class="commu-layout__aside surface-solid clip-corner">
          <p class="section-eyebrow">
            Prendre la parole
          </p>
          <h3 class="commu-composer__title">
            Poster dans la communauté
          </h3>

          <template v-if="user">
            <p class="commu-composer__identity">
              Connecté en tant que <strong>{{ user.pseudo }}</strong>
            </p>

            <p class="commu-composer__label">
              Pôle de publication
            </p>
            <CommuPoleFilter
              v-model="composerPole"
              :options="composerPoleOptions"
              aria-label="Choisir le pôle de la publication"
            />

            <ClientOnly>
              <RichTextEditor
                v-model="newPost"
                :max-characters="POST_LIMIT"
                aria-label="Contenu de la publication"
                placeholder="Partage une annonce, une idée ou un moment du club…"
                class="mt-4"
              />
              <template #fallback>
                <UTextarea
                  v-model="newPost"
                  :rows="5"
                  placeholder="Partage une annonce, une idée ou un moment du club…"
                  aria-label="Contenu de la publication"
                  class="mt-4 w-full"
                />
              </template>
            </ClientOnly>
            <div class="commu-composer__meta">
              <span>{{ newPostLength }} / {{ POST_LIMIT }} caractères</span>
              <span>Diffusion : {{ poleLabel(composerPole) }}</span>
            </div>

            <UButton
              color="primary"
              icon="i-lucide-send"
              :label="composerPole === ALL_POLES ? 'Publier pour tous les pôles' : `Publier dans ${poleLabel(composerPole)}`"
              :loading="publishing"
              :disabled="!canPublish"
              block
              class="mt-3"
              @click="addPost"
            />
            <p class="commu-composer__hint">
              {{ composerPole === ALL_POLES ? 'Ta publication sera visible dans le fil de chaque pôle.' : 'Ta publication apparaît immédiatement en tête du fil communautaire.' }}
            </p>
          </template>

          <template v-else>
            <CommuEmptyState
              icon="i-lucide-lock"
              compact
              title="Connecte-toi pour publier"
              description="La lecture du fil est ouverte à tous ; la publication et les réactions demandent un compte membre."
            >
              <template #actions>
                <UButton
                  to="/auth"
                  color="primary"
                  icon="i-lucide-log-in"
                  label="Se connecter"
                />
                <UButton
                  to="/inscription"
                  color="neutral"
                  variant="soft"
                  label="Créer un compte"
                />
              </template>
            </CommuEmptyState>
          </template>
        </aside>
      </div>
    </section>

    <!-- ================= FICHE MEMBRE ================= -->
    <CommuMemberDetail
      v-if="detailMember"
      v-model:open="detailOpen"
      :member="detailMember"
      :pole-label="detailMember ? memberPoleLabels(detailMember)[0] ?? null : null"
      :pole-labels="detailMember ? memberPoleLabels(detailMember) : []"
      :arrival-position="detailMemberPosition"
      :total-members="members.length"
      :post-count="detailMemberStats?.postCount ?? 0"
      :reaction-count="detailMemberStats?.reactionCount ?? 0"
      :last-post-label="detailMemberStats?.lastPostLabel ?? null"
      @pole="detailMember && showMemberPole(detailMember)"
      @posts="showAuthor(detailMember.pseudo)"
    />
  </div>
</template>

<style scoped>
/* ---- En-tête ---- */
.commu-hero {
  display: grid;
  gap: 1.5rem;
  padding: 1.5rem;
}

.section-eyebrow {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--accent-color);
}

.commu-hero__title {
  margin-top: 0.6rem;
  font-family: var(--font-display);
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 900;
  line-height: 1.05;
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

/* ---- Barre d'onglets ---- */
.commu-nav {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-top: 1.25rem;
  padding: 0.75rem;
}

.commu-nav__hint {
  padding: 0 0.25rem;
  font-size: 0.75rem;
  color: var(--muted-color);
}

/* ---- Panneaux ---- */
.commu-panel {
  margin-top: 1.75rem;
  scroll-margin-top: 5.5rem;
}

/* ---- Barre d'outils ---- */
.commu-tools {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  margin-top: 1.25rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--border-color);
  background: rgba(var(--primary-color-rgb), 0.05);
}

.commu-tools__search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.commu-tools__summary {
  margin-top: 0.75rem;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  color: var(--muted-color);
}

.commu-tools__summary strong {
  color: var(--text-color);
}

.commu-author-chip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding: 0.5rem 0.75rem;
  border: 1px dashed rgba(var(--primary-color-rgb), 0.5);
  border-radius: 0.75rem;
  background: rgba(var(--primary-color-rgb), 0.08);
  font-size: 0.78rem;
  color: var(--text-color);
}

.commu-author-chip > span {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

/* ---- Grilles ---- */
.commu-grid {
  display: grid;
  gap: 1rem;
  margin-top: 1.25rem;
}

.commu-grid--members,
.commu-grid--poles {
  grid-template-columns: minmax(0, 1fr);
  min-width: 0;
}

.commu-grid--otaku-cards {
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
}

.commu-post-author-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  margin-top: 1rem;
}

.commu-post-author-actions__label {
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  color: var(--muted-color);
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

.commu-stack {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.commu-layout {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-top: 1.25rem;
}

.commu-layout__feed {
  order: 2;
  min-width: 0;
}

.commu-layout__aside {
  order: 1;
  padding: 1.25rem;
}

/* ---- Cartes de pôle ---- */
.commu-pole-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.1rem;
  border: 1px solid var(--border-color);
  background: var(--panel-color);
  transition: border-color 0.18s ease, transform 0.18s ease;
}

.commu-pole-card:hover {
  border-color: rgba(var(--primary-color-rgb), 0.45);
  transform: translateY(-2px);
}

.commu-pole-card--active {
  border-color: var(--primary-color);
  background: rgba(var(--primary-color-rgb), 0.08);
}

.commu-pole-card__head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
}

.commu-pole-card__icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.7rem;
  border: 1px solid rgba(var(--accent-color-rgb), 0.35);
  color: var(--accent-color);
  background: rgba(var(--accent-color-rgb), 0.12);
}

.commu-pole-card__title {
  overflow: hidden;
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--text-color);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.commu-pole-card__counts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
  font-size: 0.75rem;
  color: var(--muted-color);
}

.commu-pole-card__counts strong {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: var(--text-color);
}

.commu-pole-card__preview {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.commu-pole-card__names {
  overflow: hidden;
  margin-left: 0.35rem;
  font-size: 0.72rem;
  color: var(--muted-color);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.commu-pole-card__empty {
  font-size: 0.75rem;
  font-style: italic;
  color: var(--muted-color);
}

.commu-pole-card__cta {
  margin-top: auto;
  align-self: flex-start;
}

/* ---- Composeur ---- */
.commu-composer__title {
  margin: 0.4rem 0 0.75rem;
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--text-color);
}

.commu-composer__identity {
  margin-bottom: 0.75rem;
  font-size: 0.8rem;
  color: var(--muted-color);
}

.commu-composer__identity strong {
  color: var(--text-color);
}

.commu-composer__label {
  display: block;
  margin-bottom: 0.4rem;
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted-color);
}

.commu-composer__meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.5rem;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--muted-color);
}

.commu-composer__hint {
  margin-top: 0.75rem;
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--muted-color);
}

@media (min-width: 640px) {
  .commu-hero {
    padding: 2rem;
  }

  .commu-hero__stats {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .commu-grid--members,
  .commu-grid--poles,
  .commu-grid--otaku-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .commu-tools {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: flex-end;
  }

  .commu-tools__search {
    flex: 1 1 18rem;
  }

  .commu-grid--members {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .commu-grid--members.commu-grid--members-all {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr));
    min-width: 0;
  }

  .commu-grid--poles {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .commu-layout {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
    align-items: start;
  }

  .commu-layout__feed {
    order: 0;
  }

  .commu-layout__aside {
    order: 0;
    position: sticky;
    top: 5.5rem;
    z-index: 1;
  }
}
</style>
