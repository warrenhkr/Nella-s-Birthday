<script setup lang="ts">
import { adminScopeLabels, normalizeAdminScopes, type AdminScope } from '#shared/admin-scopes'
import { polesToText } from '#shared/poles'

definePageMeta({ middleware: 'super-admin' })

const { success, alert } = useGameToast()

type AdminAccount = {
  id: string
  email: string
  pseudo: string
  role: 'ADMIN' | 'INTERMEDIATE_ADMIN' | 'SHOP_MANAGER' | 'MEMBER'
  pole: string | null
  /** Multi-pôles : union « poles + pole ». */
  poles?: string[]
  adminScopes: string[]
  isActive: boolean
  nom: string | null
  prenom: string | null
  telephone: string | null
  universite: string | null
  faculte: string | null
  filiere: string | null
}

type ManagedAccount = AdminAccount

type IssueReport = {
  id: string
  title: string
  description: string
  category: 'BUG' | 'PROBLEM' | 'SUGGESTION' | 'OTHER'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  adminResponse: string | null
  createdAt: string
  author: { id: string, pseudo: string, email: string } | null
}

const { data, pending, error, refresh } = await useFetch<{ data: AdminAccount[] }>('/api/admin/admins')
const admins = computed(() => data.value?.data || [])
const { data: accountsData, pending: accountsPending, error: accountsError, refresh: refreshAccounts } = await useFetch<{ data: ManagedAccount[] }>('/api/admin/accounts')
const reportFilters = reactive<{
  status: IssueReport['status'] | undefined
  priority: IssueReport['priority'] | undefined
  category: IssueReport['category'] | undefined
}>({
  status: undefined,
  priority: undefined,
  category: undefined
})
const { data: issueReportsData, pending: issueReportsPending, error: issueReportsError, refresh: refreshIssueReports } = await useFetch<{ data: IssueReport[] }>('/api/issue-reports', {
  query: reportFilters
})
const issueReports = computed(() => issueReportsData.value?.data || [])
const reportDrafts = reactive<Record<string, { response: string, status: IssueReport['status'], priority: IssueReport['priority'] }>>({})
const updatingReportId = ref<string | null>(null)
const accounts = computed(() => accountsData.value?.data || [])
const email = ref('')
const pseudo = ref('')
const password = ref('')
const pole = ref('')
// Typé `string` volontairement : AppSelect émet une chaîne (comme les autres
// sélecteurs du site), l'API valide ensuite l'enum du rôle.
const role = ref<string>('ADMIN')
const submitting = ref(false)
// Périmètres du nouvel administrateur (liste vide = administrateur complet,
// comportement historique) et édition des périmètres d'un administrateur déjà
// nommé (voir shared/admin-scopes.ts).
const createScopes = ref<AdminScope[]>([])
const scopeEditorFor = ref<string | null>(null)
const scopeDraft = ref<AdminScope[]>([])
const savingScopesId = ref<string | null>(null)
const updatingRoleId = ref<string | null>(null)
const togglingAccountId = ref<string | null>(null)
const removingAccountId = ref<string | null>(null)

// KPI de l'espace super-admin : comptes et signalements à suivre.
const kpis = computed(() => [
  { key: 'special', label: 'Comptes spéciaux', value: String(admins.value.length), icon: 'i-lucide-user-cog', hint: 'Admins et gestionnaires' },
  { key: 'active', label: 'Comptes actifs', value: String(admins.value.filter(account => account.isActive).length), icon: 'i-lucide-shield-check', hint: 'Accès autorisé' },
  { key: 'roles', label: 'Rôles attribués', value: String(accounts.value.filter(account => account.role !== 'MEMBER').length), icon: 'i-lucide-crown', hint: 'Comptes non membres' },
  { key: 'open-reports', label: 'Signalements ouverts', value: String(issueReports.value.filter(report => report.status === 'OPEN').length), icon: 'i-lucide-flag', hint: 'À traiter en priorité' }
])

// Rôles proposés à la création : ADMIN pour ceux qui en ont le droit (l'API
// applique la même règle), gestionnaire boutique pour tout le monde.
const roleOptions = [
  { value: 'ADMIN', label: 'Administrateur' },
  { value: 'INTERMEDIATE_ADMIN', label: 'Administrateur intermédiaire' },
  { value: 'SHOP_MANAGER', label: 'Gestionnaire boutique' }
]

const accountRoleOptions = [
  { value: 'MEMBER', label: 'Membre' },
  { value: 'ADMIN', label: 'Administrateur' },
  { value: 'INTERMEDIATE_ADMIN', label: 'Administrateur intermédiaire' },
  { value: 'SHOP_MANAGER', label: 'Gestionnaire boutique' }
]

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

// Options AppSelect : la valeur vide représente « toutes / tous » et doit
// rester `undefined` côté requête, sinon l'API refuse les filtres (400).
const reportStatusOptions = computed(() => [
  { value: '', label: 'Tous les statuts' },
  ...Object.entries(reportStatusLabels).map(([value, label]) => ({ value, label }))
])
const reportPriorityOptions = computed(() => [
  { value: '', label: 'Toutes les priorités' },
  ...Object.entries(reportPriorityLabels).map(([value, label]) => ({ value, label }))
])
const reportCategoryOptions = computed(() => [
  { value: '', label: 'Toutes les catégories' },
  ...Object.entries(reportCategoryLabels).map(([value, label]) => ({ value, label }))
])
const reportStatusChoices = Object.entries(reportStatusLabels).map(([value, label]) => ({ value, label }))
const reportPriorityChoices = Object.entries(reportPriorityLabels).map(([value, label]) => ({ value, label }))

const priorityIcons: Record<IssueReport['priority'], string> = {
  LOW: 'i-lucide-chevron-down',
  MEDIUM: 'i-lucide-minus',
  HIGH: 'i-lucide-chevron-up',
  CRITICAL: 'i-lucide-chevron-up'
}

const statusIcons: Record<IssueReport['status'], string> = {
  OPEN: 'i-lucide-circle-alert',
  IN_PROGRESS: 'i-lucide-loader-circle',
  RESOLVED: 'i-lucide-circle-check',
  CLOSED: 'i-lucide-circle-x'
}

// Garantit qu'un rôle par défaut reste valide (l'API refuse ADMIN pour un
// compte qui n'y a pas droit) : les seuls rôles pouvant atteindre cette page
// sont SUPER_ADMIN et INTERMEDIATE_ADMIN, pour qui ADMIN est autorisé.

function getApiErrorMessage(errorValue: unknown) {
  if (typeof errorValue === 'object' && errorValue !== null && 'data' in errorValue) {
    const data = errorValue.data
    if (typeof data === 'object' && data !== null && 'statusMessage' in data && typeof data.statusMessage === 'string') {
      return data.statusMessage
    }
  }
  return 'Impossible de traiter cette demande.'
}

async function createAccount() {
  if (!email.value || !pseudo.value || password.value.length < 8) {
    alert('Renseigne un email, un pseudo et un mot de passe de 8 caractères minimum.')
    return
  }

  submitting.value = true
  try {
    await $fetch('/api/admin/admins', {
      method: 'POST',
      body: {
        email: email.value,
        pseudo: pseudo.value,
        password: password.value,
        pole: pole.value || undefined,
        role: role.value,
        // Périmètres : uniquement pour un compte administrateur. Liste vide =
        // administrateur complet.
        ...(role.value === 'ADMIN' ? { adminScopes: createScopes.value } : {})
      }
    })
    email.value = ''
    pseudo.value = ''
    password.value = ''
    pole.value = ''
    createScopes.value = []
    role.value = 'ADMIN'
    await refresh()
    success('Compte spécial créé.')
  } catch (requestError: unknown) {
    alert(getApiErrorMessage(requestError))
  } finally {
    submitting.value = false
  }
}

// ---------------------------------------------------------------------------
// Périmètres d'un administrateur déjà nommé : le SUPER_ADMIN peut restreindre
// ses domaines (ex. « gaming seulement ») ou lui rendre l'accès complet.
// ---------------------------------------------------------------------------
function toggleScopeEditor(account: AdminAccount) {
  if (scopeEditorFor.value === account.id) {
    scopeEditorFor.value = null
    return
  }
  scopeEditorFor.value = account.id
  scopeDraft.value = normalizeAdminScopes(account.adminScopes)
}

async function saveAccountScopes(account: AdminAccount) {
  savingScopesId.value = account.id
  try {
    await $fetch(`/api/admin/admins/${account.id}`, {
      method: 'PATCH',
      body: { adminScopes: scopeDraft.value }
    })
    await refresh()
    scopeEditorFor.value = null
    success(
      scopeDraft.value.length
        ? `Périmètres de ${account.pseudo} : ${adminScopeLabels(scopeDraft.value)}.`
        : `${account.pseudo} est de nouveau administrateur complet.`
    )
  } catch (requestError: unknown) {
    alert(getApiErrorMessage(requestError))
  } finally {
    savingScopesId.value = null
  }
}

async function toggleAccount(account: AdminAccount) {
  togglingAccountId.value = account.id
  try {
    await $fetch(`/api/admin/admins/${account.id}`, { method: 'PATCH', body: { isActive: !account.isActive } })
    await refresh()
    success(account.isActive ? 'Compte désactivé.' : 'Compte réactivé.')
  } catch {
    alert('Impossible de modifier ce compte.')
  } finally {
    togglingAccountId.value = null
  }
}

async function removeAccount(account: AdminAccount) {
  if (!window.confirm(`Supprimer définitivement ${account.pseudo} ?`)) return
  removingAccountId.value = account.id
  try {
    await $fetch(`/api/admin/admins/${account.id}`, { method: 'DELETE' })
    await refresh()
    success('Compte supprimé.')
  } catch {
    alert('Impossible de supprimer ce compte.')
  } finally {
    removingAccountId.value = null
  }
}

async function updateRole(account: ManagedAccount, newRole: ManagedAccount['role']) {
  if (newRole === account.role) return

  updatingRoleId.value = account.id
  try {
    await $fetch(`/api/admin/accounts/${account.id}`, {
      method: 'PATCH',
      body: { role: newRole }
    })
    await refreshAccounts()
    await refresh()
    success(newRole === 'MEMBER' ? 'Rôle spécial retiré.' : 'Rôle attribué.')
  } catch (requestError: unknown) {
    alert(getApiErrorMessage(requestError))
  } finally {
    updatingRoleId.value = null
  }
}

watch(reportFilters, () => refreshIssueReports(), { deep: true })

function reportDraft(report: IssueReport) {
  if (!reportDrafts[report.id]) {
    reportDrafts[report.id] = {
      response: report.adminResponse || '',
      status: report.status,
      priority: report.priority
    }
  }
  return reportDrafts[report.id]!
}

function formatReportDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

async function updateReport(report: IssueReport) {
  const draft = reportDraft(report)
  updatingReportId.value = report.id

  try {
    await $fetch(`/api/issue-reports/${report.id}`, {
      method: 'PATCH',
      body: {
        adminResponse: draft.response || null,
        status: draft.status,
        priority: draft.priority
      }
    })
    await refreshIssueReports()
    success('Signalement mis à jour.')
  } catch (requestError: unknown) {
    alert(getApiErrorMessage(requestError))
  } finally {
    updatingReportId.value = null
  }
}
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 pb-20 pt-10">
    <div class="surface-solid clip-corner p-6">
      <p class="section-eyebrow">
        Espace stratégique
      </p>
      <h1 class="section-title">
        Super-administration
      </h1>
      <p class="section-desc">
        Crée et pilote les comptes administrateurs et gestionnaires de la boutique, et traite les signalements des membres.
      </p>
    </div>

    <div class="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
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

    <AdminMembersTable />

    <div class="mt-8 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
      <!-- Création d'un compte -->
      <form
        class="surface-solid clip-corner space-y-3 p-6"
        @submit.prevent="createAccount"
      >
        <div>
          <p class="section-eyebrow">
            Comptes
          </p>
          <h2 class="section-title section-title--sub">
            Créer un compte spécial
          </h2>
          <p class="section-desc">
            Le compte reçoit immédiatement une notification avec son nouveau rôle.
          </p>
        </div>
        <UFormField label="Email" required>
          <UInput
            v-model="email"
            icon="i-lucide-mail"
            class="w-full"
            type="email"
            placeholder="Email"
          />
        </UFormField>
        <UFormField label="Pseudo" required>
          <UInput
            v-model="pseudo"
            icon="i-lucide-user-cog"
            class="w-full"
            placeholder="Pseudo"
          />
        </UFormField>
        <UFormField label="Mot de passe" hint="8 caractères minimum." required>
          <UInput
            v-model="password"
            icon="i-lucide-lock"
            class="w-full"
            type="password"
            placeholder="Mot de passe"
          />
        </UFormField>
        <UFormField label="Pôle (optionnel)">
          <UInput
            v-model="pole"
            icon="i-lucide-layers"
            class="w-full"
            placeholder="Pôle"
          />
        </UFormField>
        <AppSelect
          v-model="role"
          :options="roleOptions"
          label="Rôle du compte"
          icon="i-lucide-shield"
          aria-label="Rôle du compte"
        />
        <!-- Périmètres : un administrateur peut être limité à une partie de
             l'administration (ex. gaming seulement). Ne rien cocher =
             administrateur complet, comme tous les comptes actuels. -->
        <AdminScopePicker
          v-if="role === 'ADMIN'"
          v-model="createScopes"
          :disabled="submitting"
        />
        <UButton
          type="submit"
          color="primary"
          icon="i-lucide-user-plus"
          class="w-full"
          :loading="submitting"
          :disabled="submitting"
          label="Créer le compte"
        />
      </form>

      <!-- Comptes gérés -->
      <section class="surface-solid clip-corner p-6">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="section-eyebrow">
              Comptes
            </p>
            <h2 class="section-title section-title--sub">
              Comptes gérés
            </h2>
            <p class="section-desc">
              Désactive un accès temporairement ou supprime-le définitivement.
            </p>
          </div>
          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-refresh-cw"
            label="Actualiser"
            :loading="pending"
            @click="() => refresh()"
          />
        </div>

        <div v-if="error" class="empty-state-inline mt-6">
          <UIcon name="i-lucide-triangle-alert" class="h-4 w-4" aria-hidden="true" />
          <span>La liste des comptes est indisponible.</span>
        </div>
        <div v-else-if="pending" class="mt-6 space-y-3">
          <USkeleton class="h-20" />
          <USkeleton class="h-20" />
          <USkeleton class="h-20" />
        </div>
        <div v-else-if="admins.length === 0" class="empty-state-inline mt-6">
          <UIcon name="i-lucide-user-x" class="h-4 w-4" aria-hidden="true" />
          <span>Aucun compte secondaire.</span>
        </div>
        <ul
          v-else
          class="mt-6 space-y-3"
        >
          <li
            v-for="account in admins"
            :key="account.id"
            class="admin-row"
            :class="{ 'admin-row--with-editor': scopeEditorFor === account.id }"
          >
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span
                  class="font-semibold"
                  style="color: var(--text-color);"
                >
                  {{ account.pseudo }}
                </span>
                <UBadge
                  :color="account.role === 'SHOP_MANAGER' ? 'primary' : 'neutral'"
                  variant="soft"
                  :icon="account.role === 'SHOP_MANAGER' ? 'i-lucide-store' : 'i-lucide-shield'"
                >
                  {{ account.role === 'ADMIN' ? 'Administrateur' : account.role === 'INTERMEDIATE_ADMIN' ? 'Administrateur intermédiaire' : 'Gestionnaire boutique' }}
                </UBadge>
                <!-- Périmètres en place : un administrateur peut n'avoir qu'une
                     partie de l'administration (ex. gaming seulement). -->
                <UBadge
                  v-if="account.role === 'ADMIN'"
                  :color="account.adminScopes?.length ? 'primary' : 'neutral'"
                  variant="soft"
                  :icon="account.adminScopes?.length ? 'i-lucide-shield-alert' : 'i-lucide-shield-check'"
                >
                  {{ account.adminScopes?.length ? `Périmètres : ${adminScopeLabels(account.adminScopes)}` : 'Administrateur complet' }}
                </UBadge>
              </div>
              <div class="text-sm text-muted">
                {{ account.nom || '' }} {{ account.prenom || '' }} · {{ account.email }} · {{ account.telephone || 'Numéro non renseigné' }} · {{ account.universite || 'Formation non renseignée' }} / {{ account.faculte || '—' }} / {{ account.filiere || '—' }} · pôles : {{ polesToText(account, 'aucun') }}
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <UButton
                v-if="account.role === 'ADMIN'"
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-shield"
                :label="scopeEditorFor === account.id ? 'Fermer' : 'Périmètres'"
                :disabled="savingScopesId === account.id"
                @click="toggleScopeEditor(account)"
              />
              <UBadge
                :color="account.isActive ? 'primary' : 'neutral'"
                variant="soft"
                :icon="account.isActive ? 'i-lucide-circle-check' : 'i-lucide-circle-off'"
              >
                {{ account.isActive ? 'ACTIF' : 'INACTIF' }}
              </UBadge>
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                :icon="account.isActive ? 'i-lucide-power-off' : 'i-lucide-power'"
                :label="account.isActive ? 'Désactiver' : 'Réactiver'"
                :loading="togglingAccountId === account.id"
                :disabled="togglingAccountId === account.id || removingAccountId === account.id"
                @click="toggleAccount(account)"
              />
              <UButton
                color="error"
                variant="ghost"
                size="sm"
                icon="i-lucide-trash-2"
                label="Supprimer"
                :loading="removingAccountId === account.id"
                :disabled="togglingAccountId === account.id || removingAccountId === account.id"
                @click="removeAccount(account)"
              />
            </div>

            <!-- Périmètres de cet administrateur (voir shared/admin-scopes.ts) :
                 le SUPER_ADMIN peut les restreindre ou les lever. -->
            <div
              v-if="scopeEditorFor === account.id"
              class="admin-scope-editor"
            >
              <AdminScopePicker
                v-model="scopeDraft"
                :disabled="savingScopesId === account.id"
              />
              <div class="flex flex-wrap items-center gap-2">
                <UButton
                  color="primary"
                  size="sm"
                  icon="i-lucide-save"
                  label="Enregistrer les périmètres"
                  :loading="savingScopesId === account.id"
                  :disabled="savingScopesId === account.id"
                  @click="saveAccountScopes(account)"
                />
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  icon="i-lucide-x"
                  label="Annuler"
                  :disabled="savingScopesId === account.id"
                  @click="scopeEditorFor = null"
                />
              </div>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <!-- Attribution des rôles -->
    <section class="surface-solid clip-corner mt-8 p-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="section-eyebrow">
            Rôles
          </p>
          <h2 class="section-title section-title--sub">
            Attribuer les rôles aux comptes existants
          </h2>
          <p class="section-desc">
            Un rôle spécial peut être retiré en sélectionnant Membre. Le changement est immédiat.
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

      <div v-if="accountsError" class="empty-state-inline mt-6">
        <UIcon name="i-lucide-triangle-alert" class="h-4 w-4" aria-hidden="true" />
        <span>La liste des comptes est indisponible.</span>
      </div>
      <div v-else-if="accountsPending" class="mt-6 space-y-3">
        <USkeleton class="h-20" />
        <USkeleton class="h-20" />
        <USkeleton class="h-20" />
      </div>
      <div v-else-if="accounts.length === 0" class="empty-state-inline mt-6">
        <UIcon name="i-lucide-users" class="h-4 w-4" aria-hidden="true" />
        <span>Aucun compte existant.</span>
      </div>
      <ul
        v-else
        class="mt-6 space-y-3"
      >
        <li
          v-for="account in accounts"
          :key="account.id"
          class="admin-row"
        >
          <div class="min-w-0">
            <div
              class="font-semibold"
              style="color: var(--text-color);"
            >
              {{ account.pseudo }}
            </div>
            <div class="text-sm text-muted">
              {{ account.email }} · pôles : {{ polesToText(account, 'aucun') }}
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
              :disabled="updatingRoleId === account.id"
              @update:model-value="updateRole(account, $event as ManagedAccount['role'])"
            />
          </div>
        </li>
      </ul>
    </section>

    <!-- Signalements -->
    <section id="signalements" class="surface-solid clip-corner mt-8 p-6">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="section-eyebrow">
            Support membres
          </p>
          <h2 class="section-title section-title--sub">
            Signalements
          </h2>
          <p class="section-desc">
            Réponds aux membres et suis la résolution des problèmes.
          </p>
        </div>
        <div class="flex flex-wrap items-end gap-2">
          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-refresh-cw"
            label="Actualiser"
            :loading="issueReportsPending"
            @click="() => refreshIssueReports()"
          />
        </div>
      </div>

      <div class="mt-4 grid gap-2 sm:grid-cols-3">
        <AppSelect
          :model-value="reportFilters.status ?? ''"
          :options="reportStatusOptions"
          icon="i-lucide-activity"
          variant="filter"
          size="sm"
          aria-label="Filtrer par statut"
          @update:model-value="reportFilters.status = ($event as IssueReport['status']) || undefined"
        />
        <AppSelect
          :model-value="reportFilters.priority ?? ''"
          :options="reportPriorityOptions"
          icon="i-lucide-flag"
          variant="filter"
          size="sm"
          aria-label="Filtrer par priorité"
          @update:model-value="reportFilters.priority = ($event as IssueReport['priority']) || undefined"
        />
        <AppSelect
          :model-value="reportFilters.category ?? ''"
          :options="reportCategoryOptions"
          icon="i-lucide-tag"
          variant="filter"
          size="sm"
          aria-label="Filtrer par catégorie"
          @update:model-value="reportFilters.category = ($event as IssueReport['category']) || undefined"
        />
      </div>

      <div v-if="issueReportsError" class="empty-state-inline mt-6">
        <UIcon name="i-lucide-triangle-alert" class="h-4 w-4" aria-hidden="true" />
        <span>Impossible de charger les signalements.</span>
      </div>
      <div v-else-if="issueReportsPending" class="mt-6 grid gap-4 lg:grid-cols-2">
        <USkeleton class="h-56" />
        <USkeleton class="h-56" />
      </div>
      <div v-else-if="issueReports.length === 0" class="empty-state-inline mt-6">
        <UIcon name="i-lucide-inbox" class="h-4 w-4" aria-hidden="true" />
        <span>Aucun signalement pour ces filtres.</span>
      </div>
      <div
        v-else
        class="mt-6 space-y-5"
      >
        <article
          v-for="report in issueReports"
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
                {{ report.author?.pseudo || 'Auteur supprimé' }} · {{ report.author?.email || '—' }} · {{ reportCategoryLabels[report.category] }} · {{ formatReportDate(report.createdAt) }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <UBadge
                color="neutral"
                variant="soft"
                :icon="priorityIcons[report.priority]"
              >
                {{ reportPriorityLabels[report.priority] }}
              </UBadge>
              <UBadge
                color="primary"
                variant="soft"
                :icon="statusIcons[report.status]"
              >
                {{ reportStatusLabels[report.status] }}
              </UBadge>
            </div>
          </div>
          <RichTextContent
            class="mt-4 text-sm text-muted"
            :content="report.description"
            :label="`Description du signalement ${report.title}`"
          />
          <div class="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
            <!-- Réponse en TEXTE RICHE : le membre la lit mise en forme
                 (listes, gras, lien utile). Nettoyée à l'écriture côté API. -->
            <ClientOnly>
              <RichTextEditor
                v-model="reportDraft(report).response"
                compact
                :min-height="90"
                :max-characters="10000"
                aria-label="Réponse à envoyer au membre (optionnel)"
                placeholder="Réponse à envoyer au membre (optionnel)"
              />
              <template #fallback>
                <textarea
                  v-model="reportDraft(report).response"
                  rows="3"
                  maxlength="10000"
                  class="issue-textarea"
                  placeholder="Réponse à envoyer au membre (optionnel)"
                  :aria-label="`Réponse au signalement ${report.title}`"
                />
              </template>
            </ClientOnly>
            <AppSelect
              :model-value="reportDraft(report).status"
              :options="reportStatusChoices"
              icon="i-lucide-activity"
              size="sm"
              :aria-label="`Statut de ${report.title}`"
              @update:model-value="reportDraft(report).status = $event as IssueReport['status']"
            />
            <AppSelect
              :model-value="reportDraft(report).priority"
              :options="reportPriorityChoices"
              icon="i-lucide-flag"
              size="sm"
              :aria-label="`Priorité de ${report.title}`"
              @update:model-value="reportDraft(report).priority = $event as IssueReport['priority']"
            />
          </div>
          <div class="mt-3 flex justify-end">
            <UButton
              color="primary"
              icon="i-lucide-save"
              label="Enregistrer"
              :loading="updatingReportId === report.id"
              :disabled="updatingReportId === report.id"
              @click="updateReport(report)"
            />
          </div>
        </article>
      </div>
    </section>
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
  border-radius: 0.8rem;
  padding: 0.9rem 1rem;
}

.admin-row__action {
  min-width: 12rem;
}

/* Ligne de compte dont l'éditeur de périmètres est ouvert : le panneau occupe
   toute la largeur sous la ligne. */
.admin-row--with-editor {
  flex-wrap: wrap;
}

.admin-scope-editor {
  display: grid;
  flex-basis: 100%;
  gap: 0.6rem;
  margin-top: 0.4rem;
}

.empty-state-inline {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--muted-color);
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
</style>
