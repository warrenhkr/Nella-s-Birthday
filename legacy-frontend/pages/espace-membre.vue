<script setup lang="ts">
import NotificationCenter from '~/components-legacy/NotificationCenter.vue'
import { POLE_ICONS, POLE_LABELS, POLE_SLUGS, poleLabelsOf, resolveUserPoles } from '#shared/poles'
import { richTextLength } from '#shared/rich-text'

definePageMeta({ middleware: 'auth' })

// ============================================================
// Espace membre — organisé en onglets courts et actionnables.
//
// Aucune fonctionnalité n'a été retirée : profil, carte Otaku, commandes,
// équipes, notifications et signalements existent toujours, avec exactement
// les mêmes appels API, formulaires et messages. Seule l'organisation change.
//
// L'onglet courant est conservé dans l'URL (?onglet=…), ce qui rend chaque
// section partageable et compatible avec le bouton « précédent ».
// ============================================================

type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED'
type MemberOrder = {
  id: string
  total: number
  status: OrderStatus
  createdAt: string
  items: Array<{ name: string, quantity: number, unitPrice: number }>
}

type OtakuCard = {
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
  createdAt?: string
}

type IssueReport = {
  id: string
  title: string
  description: string
  category: 'BUG' | 'PROBLEM' | 'SUGGESTION' | 'OTHER'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  adminResponse: string | null
  createdAt: string
  updatedAt: string
}

type MemberTeam = {
  id: string
  name: string
  logoUrl: string | null
  description: string | null
  isCaptain: boolean
  memberCount: number
  tournament: { id: string, name: string, game: string } | null
}

type MemberTabKey = 'carte' | 'commandes' | 'equipes' | 'signalements' | 'profil'

const { user, profile } = useAuth()
const { refresh: refreshAuth } = useAuth()
const avatarInput = ref<HTMLInputElement | null>(null)
const avatarPending = ref(false)
const avatarError = ref('')
const avatarSuccess = ref('')
const pseudoDraft = ref(user.value?.pseudo || '')
const pseudoPending = ref(false)
const pseudoError = ref('')
const pseudoSuccess = ref('')
watch(user, (value) => {
  pseudoDraft.value = value?.pseudo || ''
})
const pseudoModifie = computed(() => pseudoDraft.value.trim() !== (user.value?.pseudo || ''))
const { data: response, pending, error, refresh } = await useFetch<{ data: MemberOrder[] }>('/api/orders')
const orders = computed(() => response.value?.data || [])
const { data: cardResponse, pending: cardPending } = await useFetch<{ data: OtakuCard | null }>('/api/member/card')
const { data: reportResponse, pending: reportsPending, error: reportsError, refresh: refreshReports } = await useFetch<{ data: IssueReport[] }>('/api/issue-reports')
const { data: teamsResponse, pending: teamsPending, error: teamsError, refresh: refreshTeams } = await useFetch<{ data: MemberTeam[] }>('/api/teams')
const card = ref<OtakuCard | null>(null)
const reports = computed(() => reportResponse.value?.data || [])
const equipes = computed(() => teamsResponse.value?.data || [])
const reportTitle = ref('')
const reportDescription = ref('')
const reportCategory = ref<string>('BUG')
const reportPriority = ref<string>('MEDIUM')
const reportSubmitting = ref(false)
const reportMessage = ref('')
watch(cardResponse, (value) => {
  card.value = value?.data || null
}, { immediate: true })

// ---------- Onglets ----------

const memberTabs: Array<{ key: MemberTabKey, label: string, icon: string, hint: string }> = [
  { key: 'carte', label: 'Ma carte', icon: 'i-lucide-id-card', hint: 'Ton identité otaku validée' },
  { key: 'commandes', label: 'Mes commandes', icon: 'i-lucide-shopping-bag', hint: 'Tes achats à la boutique' },
  { key: 'equipes', label: 'Mes équipes', icon: 'i-lucide-users', hint: 'Tes équipes de tournoi' },
  { key: 'signalements', label: 'Mes signalements', icon: 'i-lucide-message-square-warning', hint: 'Assistance et suivi' },
  { key: 'profil', label: 'Mon profil', icon: 'i-lucide-user-round', hint: 'Photo, niveau et coordonnées' }
]

const TAB_KEYS = memberTabs.map(onglet => onglet.key)

const route = useRoute()
const router = useRouter()

function lireOnglet(valeur: unknown): MemberTabKey {
  const brut = Array.isArray(valeur) ? valeur[0] : valeur
  return typeof brut === 'string' && (TAB_KEYS as string[]).includes(brut)
    ? brut as MemberTabKey
    : 'carte'
}

// Un ancien lien « /espace-membre#signalements » continue d'ouvrir le bon
// onglet même sans paramètre de requête.
const activeTab = ref<MemberTabKey>(
  route.query.onglet === undefined && route.hash === '#signalements'
    ? 'signalements'
    : lireOnglet(route.query.onglet)
)

watch(() => route.query.onglet, (valeur) => {
  activeTab.value = lireOnglet(valeur)
})

function selectOnglet(cle: MemberTabKey) {
  if (activeTab.value === cle) return
  activeTab.value = cle
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  void router.replace({ query: { ...route.query, onglet: cle } })
}

const notificationsOpen = ref(true)

// ---------- Identité transmise à la carte Otaku ----------

const identiteMembre = computed(() => ({
  nom: user.value?.nom ?? null,
  prenom: user.value?.prenom ?? null,
  situation: user.value?.situation ?? null,
  pays: user.value?.pays ?? null,
  profession: user.value?.profession ?? null,
  universite: user.value?.universite ?? null,
  filiere: user.value?.filiere ?? null,
  pseudo: user.value?.pseudo ?? null,
  pole: user.value?.pole ?? null,
  // Multi-pôles : la carte affiche l'union complète, pas seulement le principal.
  poles: resolveUserPoles(user.value),
  level: profile.value?.level ?? null,
  avatar: profile.value?.avatar ?? null
}))

// ---------- Multi-pôles : sélection depuis « Mon profil » ----------
// Les 6 pôles officiels du club, dans l'ordre d'affichage partagé
// (shared/poles.ts) : la même source alimente l'API et le front.
const poleOptions = POLE_SLUGS.map(slug => ({
  value: slug as string,
  label: POLE_LABELS[slug],
  icon: POLE_ICONS[slug]
}))

/** Pôles cochés dans le formulaire (borné aux 6 pôles officiels). */
const selectedPoles = ref<string[]>(resolveUserPoles(user.value))
const polesPending = ref(false)
const polesError = ref('')
const polesSuccess = ref('')

// L'utilisateur peut arriver avant la fin de /api/auth/me : on resynchronise
// la sélection dès que le profil réel est chargé.
watch(user, (value) => {
  selectedPoles.value = resolveUserPoles(value)
})

/** Badges affichés sur la fiche : union « poles + pole ». */
const mesPolesLabels = computed(() => poleLabelsOf(user.value))

async function enregistrerPoles() {
  polesError.value = ''
  polesSuccess.value = ''

  if (selectedPoles.value.length === 0) {
    polesError.value = 'Choisis au moins un pôle.'
    return
  }

  polesPending.value = true
  try {
    await $fetch('/api/member/profile', {
      method: 'PATCH',
      body: { poles: selectedPoles.value }
    })
    await refreshAuth()
    polesSuccess.value = 'Tes pôles ont été mis à jour.'
  } catch (requestError: unknown) {
    polesError.value = getApiErrorMessage(requestError, 'Impossible de mettre à jour tes pôles.')
  } finally {
    polesPending.value = false
  }
}

// ---------- Résumé chiffré ----------

const totalDepense = computed(() => orders.value.reduce(
  (somme, order) => order.status === 'CANCELLED' ? somme : somme + order.total,
  0
))

const signalementsOuverts = computed(() => reports.value.filter(
  report => report.status === 'OPEN' || report.status === 'IN_PROGRESS'
).length)

const statusLabels: Record<OrderStatus, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  PREPARING: 'En préparation',
  READY: 'Prête',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value))
}

function formatFcfa(value: number) {
  return `${value.toLocaleString('fr-FR')} FCFA`
}

async function retryOrders() {
  await refresh()
}

async function updateAvatar(url: string | null) {
  avatarPending.value = true
  avatarError.value = ''
  avatarSuccess.value = ''

  try {
    await $fetch('/api/member/profile', {
      method: 'PATCH',
      body: { avatar: url }
    })
    await refreshAuth()
    avatarSuccess.value = 'Photo de profil mise à jour.'
  } catch (error: unknown) {
    avatarError.value = getApiErrorMessage(error, 'Impossible de mettre à jour la photo.')
  } finally {
    avatarPending.value = false
  }
}

async function enregistrerPseudo() {
  const pseudo = pseudoDraft.value.trim()
  if (pseudo.length < 3 || pseudo.length > 20 || !pseudoModifie.value) return

  pseudoPending.value = true
  pseudoError.value = ''
  pseudoSuccess.value = ''
  try {
    await $fetch('/api/member/profile', {
      method: 'PATCH',
      body: { pseudo }
    })
    await refreshAuth()
    pseudoSuccess.value = 'Nom d’utilisateur mis à jour.'
  } catch (error: unknown) {
    pseudoError.value = getApiErrorMessage(error, 'Impossible de modifier le nom d’utilisateur.')
  } finally {
    pseudoPending.value = false
  }
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = error.data
    if (typeof data === 'object' && data !== null && 'statusMessage' in data && typeof data.statusMessage === 'string') {
      return data.statusMessage
    }
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

const reportStatusLabels: Record<IssueReport['status'], string> = {
  OPEN: 'Ouvert',
  IN_PROGRESS: 'En cours',
  RESOLVED: 'Résolu',
  CLOSED: 'Fermé'
}

const reportCategoryLabels: Record<IssueReport['category'], string> = {
  BUG: 'Bug',
  PROBLEM: 'Problème',
  SUGGESTION: 'Suggestion',
  OTHER: 'Autre'
}

const reportPriorityLabels: Record<IssueReport['priority'], string> = {
  LOW: 'Basse',
  MEDIUM: 'Moyenne',
  HIGH: 'Haute',
  CRITICAL: 'Critique'
}

function formatReportDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

async function submitReport() {
  if (richTextLength(reportDescription.value) < 10) {
    reportMessage.value = 'Décris le problème en 10 caractères minimum.'
    return
  }

  reportSubmitting.value = true
  reportMessage.value = ''

  try {
    await $fetch('/api/issue-reports', {
      method: 'POST',
      body: {
        title: reportTitle.value,
        description: reportDescription.value,
        category: reportCategory.value,
        priority: reportPriority.value
      }
    })
    reportTitle.value = ''
    reportDescription.value = ''
    reportCategory.value = 'BUG'
    reportPriority.value = 'MEDIUM'
    reportMessage.value = 'Ton signalement a bien été envoyé.'
    await refreshReports()
  } catch (requestError: unknown) {
    reportMessage.value = getApiErrorMessage(requestError, 'Impossible d’envoyer le signalement.')
  } finally {
    reportSubmitting.value = false
  }
}
</script>

<template>
  <div class="espace-membre mx-auto max-w-7xl px-4 py-12 lg:px-8 lg:py-16">
    <!-- ---------- En-tête ---------- -->
    <header class="membre-entete">
      <div class="min-w-0">
        <p class="section-eyebrow">
          Espace membre
        </p>
        <h1 class="membre-entete__titre">
          Bienvenue, {{ user?.pseudo }}
        </h1>
        <p class="section-desc">
          Ta carte, tes commandes, tes équipes et ton suivi : cinq onglets, une
          action claire par onglet.
        </p>
      </div>
      <UButton
        color="primary"
        variant="soft"
        icon="i-lucide-shopping-bag"
        label="Commander un produit"
        to="/boutique"
        class="membre-entete__action"
      />
    </header>

    <!-- ---------- Résumé chiffré (raccourcis vers les onglets) ---------- -->
    <div class="membre-stats">
      <button
        type="button"
        class="stat-card surface-solid clip-corner membre-stat"
        @click="selectOnglet('commandes')"
      >
        <UIcon
          name="i-lucide-receipt"
          class="membre-stat__icone"
          aria-hidden="true"
        />
        <span class="membre-stat__valeur">{{ orders.length }}</span>
        <span class="membre-stat__label">Commandes</span>
      </button>
      <button
        type="button"
        class="stat-card surface-solid clip-corner membre-stat"
        @click="selectOnglet('commandes')"
      >
        <UIcon
          name="i-lucide-wallet"
          class="membre-stat__icone"
          aria-hidden="true"
        />
        <span class="membre-stat__valeur membre-stat__valeur--texte">{{ formatFcfa(totalDepense) }}</span>
        <span class="membre-stat__label">Total dépensé</span>
      </button>
      <button
        type="button"
        class="stat-card surface-solid clip-corner membre-stat"
        @click="selectOnglet('equipes')"
      >
        <UIcon
          name="i-lucide-users"
          class="membre-stat__icone"
          aria-hidden="true"
        />
        <span class="membre-stat__valeur">{{ equipes.length }}</span>
        <span class="membre-stat__label">Équipes</span>
      </button>
      <button
        type="button"
        class="stat-card surface-solid clip-corner membre-stat"
        @click="selectOnglet('signalements')"
      >
        <UIcon
          name="i-lucide-circle-alert"
          class="membre-stat__icone"
          aria-hidden="true"
        />
        <span class="membre-stat__valeur">{{ signalementsOuverts }}</span>
        <span class="membre-stat__label">Signalements en cours</span>
      </button>
    </div>

    <!-- ---------- Notifications : accessibles depuis tous les onglets ---------- -->
    <section class="membre-notifs">
      <div class="membre-notifs__barre">
        <span class="membre-notifs__titre">
          <UIcon
            name="i-lucide-bell-ring"
            aria-hidden="true"
          />
          Fil d’activité
        </span>
        <UButton
          size="sm"
          color="neutral"
          variant="ghost"
          :icon="notificationsOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          :label="notificationsOpen ? 'Masquer' : 'Afficher'"
          :aria-expanded="notificationsOpen"
          @click="notificationsOpen = !notificationsOpen"
        />
      </div>
      <!-- Le centre de notifications reste monté en permanence : il conserve
           son minuteur et son marquage automatique comme avant. -->
      <div v-show="notificationsOpen">
        <NotificationCenter />
      </div>
    </section>

    <!-- ---------- Barre d'onglets ---------- -->
    <div
      class="membre-onglets"
      role="tablist"
      aria-label="Sections de l’espace membre"
    >
      <button
        v-for="onglet in memberTabs"
        :id="`onglet-${onglet.key}`"
        :key="onglet.key"
        type="button"
        role="tab"
        class="membre-onglet"
        :class="{ 'membre-onglet--actif': activeTab === onglet.key }"
        :aria-selected="activeTab === onglet.key"
        :aria-controls="`panneau-${onglet.key}`"
        :title="onglet.hint"
        @click="selectOnglet(onglet.key)"
      >
        <UIcon
          :name="onglet.icon"
          class="membre-onglet__icone"
          aria-hidden="true"
        />
        <span class="membre-onglet__label">{{ onglet.label }}</span>
      </button>
    </div>

    <!-- ================= ONGLET : MA CARTE ================= -->
    <section
      v-show="activeTab === 'carte'"
      id="panneau-carte"
      role="tabpanel"
      aria-labelledby="onglet-carte"
      class="membre-panneau"
    >
      <header class="membre-panneau__entete">
        <div class="min-w-0">
          <p class="section-eyebrow">
            Identité club
          </p>
          <h2 class="section-title">
            Ma carte Otaku
          </h2>
          <p class="section-desc">
            Ta carte de membre officielle : photo, pseudo, pôle, numéro et
            année. Télécharge-la ou partage-la en un clic.
          </p>
        </div>
      </header>

      <div
        v-if="cardPending"
        class="surface-solid p-6"
      >
        <USkeleton class="h-48" />
      </div>
      <div
        v-else-if="card?.status === 'APPROVED'"
        class="space-y-4"
      >
        <OtakuCardDisplay
          :card="card"
          :member="identiteMembre"
        />
      </div>
      <OtakuCardForm
        v-else
        :card="card"
        :registration-info="user"
        @saved="card = $event"
      />
    </section>

    <!-- ================= ONGLET : MES COMMANDES ================= -->
    <section
      v-show="activeTab === 'commandes'"
      id="panneau-commandes"
      role="tabpanel"
      aria-labelledby="onglet-commandes"
      class="membre-panneau"
    >
      <header class="membre-panneau__entete">
        <div class="min-w-0">
          <p class="section-eyebrow">
            Boutique
          </p>
          <h2 class="section-title">
            Mes commandes
          </h2>
          <p class="section-desc">
            Suis l’état de tes achats au club et retrouve leur détail.
          </p>
        </div>
        <div class="membre-panneau__actions">
          <UButton
            color="primary"
            variant="soft"
            icon="i-lucide-shopping-bag"
            label="Commander un produit"
            to="/boutique"
          />
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-refresh-cw"
            aria-label="Actualiser"
            class="membre-icone-bouton"
            :loading="pending"
            @click="retryOrders"
          />
        </div>
      </header>

      <div
        v-if="pending"
        class="space-y-4"
      >
        <USkeleton
          v-for="index in 2"
          :key="index"
          class="h-32"
        />
      </div>
      <div
        v-else-if="error"
        class="surface-solid p-6 text-center text-sm text-muted"
      >
        Impossible de charger tes commandes.
        <UButton
          class="mt-4"
          color="primary"
          label="Réessayer"
          @click="retryOrders"
        />
      </div>
      <div
        v-else-if="orders.length === 0"
        class="empty-state surface-solid clip-corner"
      >
        <span class="empty-state__icon">
          <UIcon
            name="i-lucide-package"
            aria-hidden="true"
          />
        </span>
        <p class="empty-state__title">
          Aucune commande pour l’instant
        </p>
        <p class="empty-state__text">
          Tu n’as encore passé aucune commande.
        </p>
        <UButton
          class="mt-3"
          color="primary"
          variant="soft"
          icon="i-lucide-shopping-bag"
          label="Découvrir la boutique"
          to="/boutique"
        />
      </div>
      <div
        v-else
        class="space-y-4"
      >
        <article
          v-for="order in orders"
          :key="order.id"
          class="surface-solid clip-corner p-5"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="text-xs text-muted">
                Commande du {{ formatDate(order.createdAt) }}
              </p>
              <div
                class="mt-2 text-sm"
                style="color: var(--text-color);"
              >
                {{ order.items.map(item => `${item.quantity} × ${item.name}`).join(', ') }}
              </div>
            </div>
            <UBadge
              color="primary"
              variant="soft"
            >
              {{ statusLabels[order.status] }}
            </UBadge>
          </div>
          <p class="mt-4 text-lg font-black text-accent-otaku">
            {{ order.total.toLocaleString() }} FCFA
          </p>
        </article>
      </div>
    </section>

    <!-- ================= ONGLET : MES ÉQUIPES ================= -->
    <section
      v-show="activeTab === 'equipes'"
      id="panneau-equipes"
      role="tabpanel"
      aria-labelledby="onglet-equipes"
      class="membre-panneau"
    >
      <header class="membre-panneau__entete">
        <div class="min-w-0">
          <p class="section-eyebrow">
            Gaming
          </p>
          <h2 class="section-title">
            Mes équipes
          </h2>
          <p class="section-desc">
            Les équipes de tournoi dont tu fais partie, avec ton rôle dans
            chacune. Seules tes propres équipes apparaissent ici.
          </p>
        </div>
        <div class="membre-panneau__actions">
          <UButton
            color="primary"
            icon="i-lucide-users"
            label="Rejoindre ou créer une équipe"
            to="/equipes"
          />
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-refresh-cw"
            aria-label="Actualiser mes équipes"
            class="membre-icone-bouton"
            :loading="teamsPending"
            @click="refreshTeams()"
          />
        </div>
      </header>

      <div
        v-if="teamsPending"
        class="space-y-4"
      >
        <USkeleton
          v-for="index in 2"
          :key="index"
          class="h-24"
        />
      </div>
      <div
        v-else-if="teamsError"
        class="surface-solid p-6 text-center text-sm text-muted"
      >
        Impossible de charger tes équipes.
        <UButton
          class="mt-4"
          color="primary"
          label="Réessayer"
          @click="refreshTeams()"
        />
      </div>
      <div
        v-else-if="equipes.length === 0"
        class="empty-state surface-solid clip-corner"
      >
        <span class="empty-state__icon">
          <UIcon
            name="i-lucide-trophy"
            aria-hidden="true"
          />
        </span>
        <p class="empty-state__title">
          Aucune équipe pour l’instant
        </p>
        <p class="empty-state__text">
          Crée ton équipe ou rejoins-en une pour participer aux tournois du
          club.
        </p>
        <UButton
          class="mt-3"
          color="primary"
          variant="soft"
          icon="i-lucide-users"
          label="Voir les équipes"
          to="/equipes"
        />
      </div>
      <div
        v-else
        class="membre-equipes"
      >
        <article
          v-for="equipe in equipes"
          :key="equipe.id"
          class="surface-solid clip-corner membre-equipe"
        >
          <div class="membre-equipe__logo">
            <img
              v-if="equipe.logoUrl"
              :src="equipe.logoUrl"
              :alt="`Logo de l’équipe ${equipe.name}`"
              loading="lazy"
            >
            <span v-else>{{ equipe.name.slice(0, 1).toUpperCase() }}</span>
          </div>
          <div class="min-w-0">
            <h3 class="membre-equipe__nom">
              {{ equipe.name }}
            </h3>
            <div class="membre-equipe__badges">
              <UBadge
                v-if="equipe.isCaptain"
                color="primary"
                variant="soft"
              >
                Capitaine
              </UBadge>
              <UBadge
                v-else
                color="neutral"
                variant="soft"
              >
                Joueur
              </UBadge>
              <UBadge
                color="neutral"
                variant="soft"
              >
                {{ equipe.memberCount }} membre{{ equipe.memberCount > 1 ? 's' : '' }}
              </UBadge>
            </div>
            <p
              v-if="equipe.tournament"
              class="membre-equipe__tournoi"
            >
              Tournoi : {{ equipe.tournament.name }} · {{ equipe.tournament.game }}
            </p>
            <p
              v-else
              class="membre-equipe__tournoi"
            >
              Pas encore inscrite à un tournoi.
            </p>
          </div>
          <UButton
            class="membre-equipe__action"
            color="neutral"
            variant="soft"
            icon="i-lucide-arrow-right"
            label="Détail"
            :to="`/equipes/${equipe.id}`"
          />
        </article>
      </div>
    </section>

    <!-- ================= ONGLET : MES SIGNALEMENTS ================= -->
    <section
      v-show="activeTab === 'signalements'"
      id="panneau-signalements"
      role="tabpanel"
      aria-labelledby="onglet-signalements"
      class="membre-panneau"
    >
      <header class="membre-panneau__entete">
        <div class="min-w-0">
          <p class="section-eyebrow">
            Assistance
          </p>
          <h2 class="section-title">
            Signaler un problème
          </h2>
          <p class="section-desc">
            Décris ce qui ne fonctionne pas afin que l’équipe puisse t’aider.
          </p>
        </div>
      </header>

      <div
        id="signalements"
        class="membre-signalements"
      >
        <form
          class="surface-solid clip-corner membre-signalements__form"
          @submit.prevent="submitReport"
        >
          <div>
            <p class="section-eyebrow">
              Nouveau signalement
            </p>
            <h3 class="section-title--sub">
              Décrire le problème
            </h3>
          </div>
          <div class="champ">
            <label
              class="champ__label"
              for="signal-titre"
            >
              Titre
            </label>
            <UInput
              id="signal-titre"
              v-model="reportTitle"
              required
              maxlength="160"
              placeholder="Titre du signalement"
            />
          </div>
          <div class="champ">
            <label
              class="champ__label"
              for="signal-description"
            >
              Description
            </label>
            <ClientOnly>
              <RichTextEditor
                id="signal-description"
                v-model="reportDescription"
                :max-characters="10000"
                aria-label="Description du problème"
                placeholder="Que s'est-il passé ?"
              />
              <template #fallback>
                <textarea
                  id="signal-description"
                  v-model="reportDescription"
                  required
                  maxlength="10000"
                  minlength="10"
                  rows="6"
                  class="issue-textarea"
                  aria-label="Description du problème"
                  placeholder="Que s'est-il passé ?"
                />
              </template>
            </ClientOnly>
          </div>
          <div class="membre-signalements__selects">
            <AppSelect
              v-model="reportCategory"
              icon="i-lucide-tag"
              variant="filter"
              aria-label="Catégorie"
              :options="[
                { value: 'BUG', label: 'Bug' },
                { value: 'PROBLEM', label: 'Problème' },
                { value: 'SUGGESTION', label: 'Suggestion' },
                { value: 'OTHER', label: 'Autre' }
              ]"
            />
            <AppSelect
              v-model="reportPriority"
              icon="i-lucide-signal"
              variant="filter"
              aria-label="Priorité"
              :options="[
                { value: 'LOW', label: 'Basse' },
                { value: 'MEDIUM', label: 'Moyenne' },
                { value: 'HIGH', label: 'Haute' },
                { value: 'CRITICAL', label: 'Critique' }
              ]"
            />
          </div>
          <UButton
            type="submit"
            color="primary"
            icon="i-lucide-send"
            label="Envoyer le signalement"
            :loading="reportSubmitting"
          />
          <p
            v-if="reportMessage"
            class="text-sm"
            :class="reportMessage.includes('bien') ? 'message--succes' : 'message--erreur'"
          >
            {{ reportMessage }}
          </p>
        </form>

        <section class="surface-solid clip-corner membre-signalements__suivi">
          <div class="flex items-center justify-between gap-4">
            <div class="min-w-0">
              <p class="section-eyebrow">
                Suivi
              </p>
              <h3 class="section-title--sub">
                Mes signalements
              </h3>
            </div>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-refresh-cw"
              aria-label="Actualiser les signalements"
              class="membre-icone-bouton"
              :loading="reportsPending"
              @click="refreshReports()"
            />
          </div>
          <p
            v-if="reportsError"
            class="mt-6 text-sm text-muted"
          >
            Impossible de charger tes signalements.
          </p>
          <p
            v-else-if="reportsPending"
            class="mt-6 text-sm text-muted"
          >
            Chargement...
          </p>
          <p
            v-else-if="reports.length === 0"
            class="mt-6 text-sm text-muted"
          >
            Tu n'as encore envoyé aucun signalement.
          </p>
          <div
            v-else
            class="mt-6 space-y-4"
          >
            <article
              v-for="report in reports"
              :key="report.id"
              class="issue-card"
            >
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0">
                  <h3
                    class="font-semibold"
                    style="color: var(--text-color);"
                  >
                    {{ report.title }}
                  </h3>
                  <p class="mt-1 text-xs text-muted">
                    {{ reportCategoryLabels[report.category] }} · {{ formatReportDate(report.createdAt) }}
                  </p>
                </div>
                <div class="flex flex-wrap gap-2">
                  <UBadge
                    color="neutral"
                    variant="soft"
                  >
                    {{ reportPriorityLabels[report.priority] }}
                  </UBadge>
                  <UBadge
                    color="primary"
                    variant="soft"
                  >
                    {{ reportStatusLabels[report.status] }}
                  </UBadge>
                </div>
              </div>
              <RichTextContent
                class="mt-3 text-sm text-muted"
                :content="report.description"
                :label="`Description du signalement ${report.title}`"
              />
              <div
                v-if="report.adminResponse"
                class="issue-response mt-4"
              >
                <p class="text-xs font-semibold uppercase tracking-[0.12em] text-brand">
                  Réponse de l'administration
                </p>
                <RichTextContent
                  class="mt-1 text-sm"
                  :content="report.adminResponse"
                  :label="`Réponse de l'administration au signalement ${report.title}`"
                />
              </div>
            </article>
          </div>
        </section>
      </div>
    </section>

    <!-- ================= ONGLET : MON PROFIL ================= -->
    <section
      v-show="activeTab === 'profil'"
      id="panneau-profil"
      role="tabpanel"
      aria-labelledby="onglet-profil"
      class="membre-panneau"
    >
      <header class="membre-panneau__entete">
        <div class="min-w-0">
          <p class="section-eyebrow">
            Mon compte
          </p>
          <h2 class="section-title">
            Mon profil
          </h2>
          <p class="section-desc">
            Ta photo, ton niveau et les coordonnées utilisées pour ta carte
            Otaku.
          </p>
        </div>
      </header>

      <div class="membre-profil">
        <section class="surface-solid clip-corner membre-profil__carte">
          <p class="section-eyebrow">
            Photo &amp; identité
          </p>
          <div class="member-avatar">
            <img
              v-if="profile?.avatar"
              :src="profile.avatar"
              alt=""
              class="member-avatar__image"
            >
            <span v-else>{{ user?.pseudo?.slice(0, 1) }}</span>
          </div>
          <h3
            class="text-xl font-semibold"
            style="color: var(--text-color);"
          >
            {{ user?.pseudo }}
          </h3>
          <p class="mt-2 text-sm text-muted">
            {{ user?.email }}
          </p>
          <form
            class="mt-4 space-y-2"
            @submit.prevent="enregistrerPseudo"
          >
            <label
              class="champ__label"
              for="profil-pseudo"
            >
              Nom d’utilisateur
            </label>
            <div class="flex flex-wrap items-center gap-2">
              <UInput
                id="profil-pseudo"
                v-model="pseudoDraft"
                class="min-w-0 flex-1"
                autocomplete="username"
                minlength="3"
                maxlength="20"
                aria-describedby="profil-pseudo-aide"
              />
              <UButton
                type="submit"
                color="primary"
                icon="i-lucide-save"
                label="Enregistrer"
                :loading="pseudoPending"
                :disabled="!pseudoModifie || pseudoDraft.trim().length < 3 || pseudoDraft.trim().length > 20"
              />
            </div>
            <p
              id="profil-pseudo-aide"
              class="text-xs text-muted"
            >
              De 3 à 20 caractères. Le nom civil et les informations de la carte Otaku ne sont pas modifiés.
            </p>
            <p
              v-if="pseudoError"
              class="text-sm message--erreur"
              role="alert"
            >
              {{ pseudoError }}
            </p>
            <p
              v-if="pseudoSuccess"
              class="text-sm message--succes"
              role="status"
            >
              {{ pseudoSuccess }}
            </p>
          </form>
          <div class="mt-2">
            <p class="membre-poles__intitule">
              Pôles
            </p>
            <div class="membre-poles__badges">
              <UBadge
                v-for="label in mesPolesLabels"
                :key="label"
                color="primary"
                variant="soft"
                size="sm"
              >
                {{ label }}
              </UBadge>
              <span
                v-if="mesPolesLabels.length === 0"
                class="text-sm text-muted"
              >
                Pôle non renseigné
              </span>
            </div>
          </div>
          <p class="mt-1 text-sm text-muted">
            Niveau : {{ profile?.level || 'Crew' }}
          </p>
          <ImageUpload
            class="mt-4"
            :model-value="profile?.avatar || null"
            label="Photo de profil"
            @update:model-value="updateAvatar"
          />
          <p
            v-if="avatarError"
            class="mt-3 text-sm message--erreur"
          >
            {{ avatarError }}
          </p>
          <p
            v-if="avatarSuccess"
            class="mt-3 text-sm message--succes"
          >
            {{ avatarSuccess }}
          </p>
        </section>

        <section class="surface-solid clip-corner membre-profil__carte">
          <p class="section-eyebrow">
            Identité &amp; formation
          </p>
          <dl class="membre-profil__liste">
            <div>
              <dt>Nom &amp; prénom</dt>
              <dd>{{ [user?.prenom, user?.nom].filter(Boolean).join(' ') || 'Non renseigné' }}</dd>
            </div>
            <div>
              <dt>Téléphone</dt>
              <dd>{{ user?.telephone || 'Non renseigné' }}</dd>
            </div>
            <div>
              <dt>Situation</dt>
              <dd>{{ user?.situation === 'PROFESSIONAL' ? 'Professionnelle' : user?.situation === 'STUDENT_ABROAD' ? 'Étudiant·e à l’étranger' : 'Étudiant·e au Bénin' }}</dd>
            </div>
            <div>
              <dt>{{ user?.situation === 'PROFESSIONAL' ? 'Profession / activité' : user?.situation === 'STUDENT_ABROAD' ? 'Pays' : 'Université' }}</dt>
              <dd>{{ user?.situation === 'PROFESSIONAL' ? (user?.profession || 'Non renseignée') : user?.situation === 'STUDENT_ABROAD' ? (user?.pays || 'Non renseigné') : (user?.universite || 'Non renseignée') }}</dd>
            </div>
            <div v-if="user?.situation !== 'PROFESSIONAL'">
              <dt>{{ user?.situation === 'STUDENT_ABROAD' ? 'Établissement' : 'Faculté / école' }}</dt>
              <dd>{{ user?.situation === 'STUDENT_ABROAD' ? (user?.universite || 'Non renseigné') : (user?.faculte || 'Non renseignée') }}</dd>
            </div>
            <div v-if="user?.situation !== 'PROFESSIONAL'">
              <dt>Filière</dt>
              <dd>{{ user?.filiere || 'Non renseignée' }}</dd>
            </div>
          </dl>
          <p class="membre-profil__note">
            Ces informations sont modifiables depuis le formulaire de ta carte
            Otaku (onglet « Ma carte »).
          </p>
          <div class="membre-profil__liens">
            <UButton
              color="primary"
              variant="soft"
              icon="i-lucide-id-card"
              label="Modifier ma carte"
              @click="selectOnglet('carte')"
            />
            <UButton
              color="neutral"
              variant="soft"
              icon="i-lucide-users"
              label="Mes équipes"
              @click="selectOnglet('equipes')"
            />
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-message-square-warning"
              label="Signaler un problème"
              @click="selectOnglet('signalements')"
            />
          </div>
        </section>

        <!-- ---------- Multi-pôles : appartenir à plusieurs pôles ---------- -->
        <section class="surface-solid clip-corner membre-profil__carte membre-poles">
          <p class="section-eyebrow">
            Mes pôles
          </p>
          <h3 class="section-title--sub">
            Pôles du club
          </h3>
          <p class="section-desc">
            Tu appartiens à autant de pôles que tu veux. Coche ceux qui te
            correspondent — le premier coché devient ton pôle principal.
          </p>

          <fieldset class="membre-poles__fieldset">
            <legend class="sr-only">
              Choisir mes pôles (plusieurs choix possibles)
            </legend>
            <div class="membre-poles__grille">
              <label
                v-for="option in poleOptions"
                :key="option.value"
                class="membre-pole-choix"
                :class="{ 'membre-pole-choix--actif': selectedPoles.includes(option.value) }"
              >
                <input
                  v-model="selectedPoles"
                  type="checkbox"
                  class="sr-only"
                  :value="option.value"
                  :name="`pole-${option.value}`"
                >
                <UIcon
                  :name="option.icon"
                  class="membre-pole-choix__icone"
                  aria-hidden="true"
                />
                <span class="membre-pole-choix__label">{{ option.label }}</span>
                <UIcon
                  v-if="selectedPoles.includes(option.value)"
                  name="i-lucide-check"
                  class="membre-pole-choix__coche"
                  aria-hidden="true"
                />
              </label>
            </div>
          </fieldset>

          <div class="membre-poles__actions">
            <UButton
              color="primary"
              icon="i-lucide-save"
              label="Enregistrer mes pôles"
              :loading="polesPending"
              @click="enregistrerPoles"
            />
            <span class="membre-poles__compteur">
              {{ selectedPoles.length }} pôle(s) sélectionné(s)
            </span>
          </div>
          <p
            v-if="polesError"
            class="mt-3 text-sm message--erreur"
          >
            {{ polesError }}
          </p>
          <p
            v-if="polesSuccess"
            class="mt-3 text-sm message--succes"
          >
            {{ polesSuccess }}
          </p>
        </section>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* ---- Design system maison (repris des autres pages du site) ---- */
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
  margin-top: 0.25rem;
  font-family: var(--font-display);
  font-size: clamp(1.2rem, 2.4vw, 1.5rem);
  font-weight: 800;
  color: var(--text-color);
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

/* ---- En-tête ---- */
.espace-membre {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.membre-entete {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 0.25rem;
}

.membre-entete__titre {
  margin-top: 0.6rem;
  font-family: var(--font-display);
  font-size: clamp(2rem, 7vw, 2.6rem);
  font-weight: 900;
  line-height: 1.05;
  color: var(--text-color);
}

.membre-entete__action {
  align-self: flex-start;
}

/* ---- Résumé chiffré ---- */
.membre-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.membre-stat {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;
  min-width: 0;
  min-height: 44px;
  padding: 0.9rem 1rem;
  text-align: left;
  cursor: pointer;
}

.membre-stat__icone {
  width: 1.1rem;
  height: 1.1rem;
  color: var(--primary-color);
}

.membre-stat__valeur {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 900;
  line-height: 1.1;
  overflow-wrap: anywhere;
  color: var(--text-color);
}

.membre-stat__valeur--texte {
  font-size: 1.05rem;
}

.membre-stat__label {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted-color);
}

/* ---- Notifications ---- */
.membre-notifs {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  min-width: 0;
}

.membre-notifs__barre {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.membre-notifs__titre {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--muted-color);
}

.membre-notifs__titre :deep(svg) {
  width: 1rem;
  height: 1rem;
  color: var(--primary-color);
}

/* ---- Onglets ---- */
.membre-onglets {
  display: flex;
  gap: 0.4rem;
  min-width: 0;
  padding-bottom: 0.35rem;
  overflow-x: auto;
  scrollbar-width: none;
}

.membre-onglets::-webkit-scrollbar {
  display: none;
}

.membre-onglet {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  flex: 0 0 auto;
  min-height: 44px;
  padding: 0.55rem 0.95rem;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: rgba(var(--primary-color-rgb), 0.05);
  color: var(--muted-color);
  font-size: 0.83rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.18s ease, border-color 0.18s ease, background-color 0.18s ease, transform 0.18s ease;
}

.membre-onglet:hover {
  border-color: rgba(var(--primary-color-rgb), 0.45);
  color: var(--text-color);
  transform: translateY(-1px);
}

.membre-onglet--actif {
  border-color: var(--primary-color);
  background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
  color: var(--bg-color);
}

.membre-onglet--actif:hover {
  color: var(--bg-color);
  transform: none;
}

.membre-onglet__icone {
  width: 1rem;
  height: 1rem;
  flex: 0 0 auto;
}

.membre-onglet__label {
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ---- Panneaux ---- */
.membre-panneau {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  min-width: 0;
}

.membre-panneau__entete {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  min-width: 0;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.membre-panneau__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.membre-icone-bouton {
  min-width: 44px;
  min-height: 44px;
}

/* ---- Équipes ---- */
.membre-equipes {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.85rem;
}

.membre-equipe {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.85rem;
  min-width: 0;
  padding: 1rem;
}

.membre-equipe__logo {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 3.25rem;
  height: 3.25rem;
  overflow: hidden;
  border: 2px solid var(--primary-color);
  border-radius: 0.9rem;
  color: var(--bg-color);
  background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
  font-family: var(--font-display);
  font-size: 1.3rem;
  font-weight: 900;
}

.membre-equipe__logo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.membre-equipe__nom {
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 800;
  overflow-wrap: anywhere;
  color: var(--text-color);
}

.membre-equipe__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.45rem;
}

.membre-equipe__tournoi {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: var(--muted-color);
  overflow-wrap: anywhere;
}

.membre-equipe__action {
  align-self: stretch;
  justify-content: center;
}

/* ---- Signalements ---- */
.membre-signalements {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.1rem;
  min-width: 0;
}

.membre-signalements__form,
.membre-signalements__suivi {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  min-width: 0;
  padding: clamp(1.1rem, 3.5vw, 1.6rem);
}

.membre-signalements__selects {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.issue-textarea {
  width: 100%;
  resize: vertical;
  border: 1px solid var(--border-color);
  border-radius: 0.65rem;
  padding: 0.75rem;
  color: var(--text-color);
  background: var(--bg-color-soft);
}

.issue-textarea:focus {
  outline: 2px solid rgba(var(--primary-color-rgb), 0.35);
  outline-offset: 1px;
}

.issue-card {
  border: 1px solid var(--border-color);
  border-radius: 0.8rem;
  padding: 1rem;
}

.issue-response {
  border-left: 3px solid var(--primary-color);
  padding-left: 0.75rem;
}

/* Messages de retour : couleurs sémantiques Nuxt UI, jamais de couleur
   codée en dur (lisible en thème clair comme en thème sombre). */
.message--succes {
  color: var(--ui-color-success-600);
}

.message--erreur {
  color: var(--ui-color-error-600);
}

/* ---- Profil ---- */
.membre-profil {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.1rem;
  min-width: 0;
}

.membre-profil__carte {
  min-width: 0;
  padding: clamp(1.1rem, 3.5vw, 1.6rem);
}

/* ---- Multi-pôles (sélection multiple, utilisable à 375 px) ---- */
.membre-poles__intitule {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted-color);
}

.membre-poles__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.3rem;
}

.membre-poles__fieldset {
  margin: 1rem 0 0;
  padding: 0;
  border: 0;
  min-width: 0;
}

/* 2 colonnes dès le plus petit écran (375 px), 3 colonnes au-delà. */
.membre-poles__grille {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.membre-pole-choix {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
  min-height: 48px;
  padding: 0.6rem 0.7rem;
  border: 1px solid var(--border-color);
  border-radius: 0.65rem;
  background: var(--panel-color);
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease, transform 0.18s ease;
}

.membre-pole-choix:hover {
  border-color: rgba(var(--primary-color-rgb), 0.45);
}

/* État coché : lisible sans couleur seule (bordure + coche + fond). */
.membre-pole-choix--actif {
  border-color: var(--primary-color);
  background: rgba(var(--primary-color-rgb), 0.12);
}

.membre-pole-choix:focus-within {
  outline: 2px solid rgba(var(--primary-color-rgb), 0.45);
  outline-offset: 1px;
}

.membre-pole-choix__icone {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  color: var(--primary-color);
}

.membre-pole-choix__label {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 0.82rem;
  font-weight: 600;
  overflow-wrap: anywhere;
  color: var(--text-color);
}

.membre-pole-choix__coche {
  width: 0.95rem;
  height: 0.95rem;
  flex-shrink: 0;
  color: var(--primary-color);
}

.membre-poles__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  margin-top: 1rem;
}

.membre-poles__compteur {
  font-size: 0.78rem;
  color: var(--muted-color);
}

.member-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 4rem;
  height: 4rem;
  margin: 1rem 0;
  border-radius: 1rem;
  color: var(--bg-color);
  background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
  font-size: 1.5rem;
  font-weight: 900;
  overflow: hidden;
}

.member-avatar__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.membre-profil__liste {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  margin-top: 0.9rem;
}

.membre-profil__liste div {
  min-width: 0;
  padding-bottom: 0.7rem;
  border-bottom: 1px dashed var(--border-color);
}

.membre-profil__liste dt {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted-color);
}

.membre-profil__liste dd {
  margin: 0.2rem 0 0;
  font-size: 0.9rem;
  font-weight: 600;
  overflow-wrap: anywhere;
  color: var(--text-color);
}

.membre-profil__note {
  margin-top: 0.9rem;
  font-size: 0.78rem;
  line-height: 1.5;
  color: var(--muted-color);
}

.membre-profil__liens {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;
}

/* ---- Champs de formulaire ---- */
.champ {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}

.champ__label {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--text-color);
}

/* Cibles tactiles confortables (>= 44 px). */
.membre-panneau :deep(button) {
  min-height: 2.75rem;
}

.membre-onglet {
  min-height: 44px;
}

/* ---- Points de rupture ---- */
@media (min-width: 640px) {
  .membre-entete {
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
  }

  .membre-entete__action {
    align-self: flex-end;
  }

  .membre-stats {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .membre-onglets {
    overflow-x: visible;
  }

  .membre-onglet {
    flex: 1 1 0;
    justify-content: center;
  }

  .membre-equipes {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .membre-equipe {
    flex-direction: row;
    align-items: center;
  }

  .membre-equipe__action {
    align-self: center;
    margin-left: auto;
  }
}

@media (min-width: 1024px) {
  .membre-signalements {
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  }

  .membre-profil {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  /* Les 6 pôles tiennent sur toute la largeur (grille 3 colonnes). */
  .membre-poles {
    grid-column: 1 / -1;
  }

  .membre-poles__grille {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .membre-equipes {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
