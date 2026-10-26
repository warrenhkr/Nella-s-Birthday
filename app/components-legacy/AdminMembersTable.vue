<script setup lang="ts">
import { poleLabelsOf, polesToText, resolveUserPoles } from '#shared/poles'

type Member = {
  id: string
  email: string
  pseudo: string
  role: 'SUPER_ADMIN' | 'INTERMEDIATE_ADMIN' | 'ADMIN' | 'SHOP_MANAGER' | 'MEMBER'
  isActive: boolean
  pole: string | null
  /** Multi-pôles : union « poles + pole » renvoyée par l'API admin. */
  poles: string[]
  nom: string | null
  prenom: string | null
  telephone: string | null
  universite: string | null
  faculte: string | null
  filiere: string | null
  createdAt: string
}

const { data, pending, error, refresh } = await useFetch<{ data: Member[] }>('/api/admin/members')
const members = computed(() => data.value?.data || [])
const search = ref('')
const exportFormat = ref<string>('csv')
const membersPerPage = 8
const currentPage = ref(1)

const filteredMembers = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return members.value

  return members.value.filter(member => [
    member.pseudo,
    member.email,
    member.nom,
    member.prenom,
    member.telephone,
    member.universite,
    member.faculte,
    member.filiere,
    memberPoleLabels(member).join(' '),
    member.pole,
    member.role
  ].some(value => value?.toLowerCase().includes(query)))
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredMembers.value.length / membersPerPage)))
const paginatedMembers = computed(() => {
  const startIndex = (currentPage.value - 1) * membersPerPage
  return filteredMembers.value.slice(startIndex, startIndex + membersPerPage)
})

watch(search, () => {
  currentPage.value = 1
})
watch(filteredMembers, () => {
  if (currentPage.value > totalPages.value) currentPage.value = totalPages.value
})

const roleLabels: Record<Member['role'], string> = {
  SUPER_ADMIN: 'Super-admin',
  ADMIN: 'Administrateur',
  INTERMEDIATE_ADMIN: 'Administrateur intermédiaire',
  SHOP_MANAGER: 'Shop manager',
  MEMBER: 'Membre'
}

async function refreshMembers() {
  await refresh()
}

function displayName(member: Member) {
  return [member.prenom, member.nom].filter(Boolean).join(' ') || member.pseudo
}

function displayValue(value: string | null) {
  return value || '—'
}

// ---- Multi-pôles : union « poles + pole » (compatibilité ascendante) ----
function memberPoles(member: Pick<Member, 'pole' | 'poles'>) {
  return resolveUserPoles(member)
}

function memberPoleLabels(member: Pick<Member, 'pole' | 'poles'>) {
  return poleLabelsOf(member)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value))
}

function csvValue(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

function exportMembers() {
  const rows = filteredMembers.value.map(member => ({
    Nom: displayName(member),
    Pseudo: member.pseudo,
    Email: member.email,
    Téléphone: displayValue(member.telephone),
    Université: displayValue(member.universite),
    Faculté: displayValue(member.faculte),
    Filière: displayValue(member.filiere),
    Pôle: polesToText(member, '—'),
    Rôle: roleLabels[member.role],
    Statut: member.isActive ? 'Actif' : 'Inactif',
    Inscription: formatDate(member.createdAt)
  }))

  const date = new Date().toISOString().slice(0, 10)
  let content: string
  let mimeType: string
  let extension: string

  if (exportFormat.value === 'json') {
    content = JSON.stringify(rows, null, 2)
    mimeType = 'application/json;charset=utf-8'
    extension = 'json'
  } else {
    const headers = Object.keys(rows[0] || {
      Nom: '',
      Pseudo: '',
      Email: '',
      Téléphone: '',
      Université: '',
      Faculté: '',
      Filière: '',
      Pôle: '',
      Rôle: '',
      Statut: '',
      Inscription: ''
    })
    content = `\uFEFF${headers.map(csvValue).join(';')}\n${rows.map(row => headers.map(header => csvValue(row[header as keyof typeof row])).join(';')).join('\n')}`
    mimeType = 'text/csv;charset=utf-8'
    extension = 'csv'
  }

  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `membres-club-otaku-${date}.${extension}`
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <section class="surface-solid clip-corner p-6">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="text-xs uppercase tracking-[0.28em] text-brand">
          Membres du site
        </p>
        <h2
          class="mt-2 text-xl font-semibold"
          style="color: var(--text-color);"
        >
          Annuaire des inscrits
        </h2>
        <p class="mt-1 text-sm text-muted">
          Consulte les informations déclarées par les membres et exporte la liste filtrée.
        </p>
      </div>
      <div class="flex flex-col gap-2 sm:flex-row">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Rechercher..."
          aria-label="Rechercher un membre"
        />
        <AppSelect
          v-model="exportFormat"
          :options="[
            { label: 'CSV (Excel)', value: 'csv' },
            { label: 'JSON', value: 'json' }
          ]"
          icon="i-lucide-file-text"
          aria-label="Format d'export"
        />
        <UButton
          color="primary"
          icon="i-lucide-download"
          label="Exporter"
          :disabled="filteredMembers.length === 0"
          @click="exportMembers"
        />
        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-refresh-cw"
          label="Actualiser"
          :loading="pending"
          @click="refreshMembers"
        />
      </div>
    </div>

    <p
      v-if="error"
      class="mt-6 text-sm text-muted"
    >
      Impossible de charger la liste des membres.
    </p>
    <p
      v-else-if="pending"
      class="mt-6 text-sm text-muted"
    >
      Chargement des membres...
    </p>
    <p
      v-else-if="filteredMembers.length === 0"
      class="mt-6 text-sm text-muted"
    >
      Aucun membre ne correspond à la recherche.
    </p>
    <div
      v-else
      class="mt-6 overflow-x-auto"
    >
      <table class="min-w-[760px] w-full text-left text-sm sm:min-w-[1100px]">
        <thead class="border-b border-white/10 text-xs uppercase tracking-wider text-muted">
          <tr>
            <th class="px-3 py-3">
              Identité
            </th>
            <th class="px-3 py-3">
              Contact
            </th>
            <th class="px-3 py-3">
              Formation
            </th>
            <th class="px-3 py-3">
              Pôle
            </th>
            <th class="px-3 py-3">
              Rôle
            </th>
            <th class="px-3 py-3">
              Statut
            </th>
            <th class="px-3 py-3">
              Inscription
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="member in paginatedMembers"
            :key="member.id"
            class="border-b border-white/5 last:border-0"
          >
            <td class="px-3 py-3">
              <div
                class="font-semibold"
                style="color: var(--text-color);"
              >
                {{ displayName(member) }}
              </div>
              <div class="text-muted">
                @{{ member.pseudo }}
              </div>
            </td>
            <td class="px-3 py-3">
              <div>{{ member.email }}</div>
              <div class="text-muted">
                {{ displayValue(member.telephone) }}
              </div>
            </td>
            <td class="px-3 py-3">
              <div>{{ displayValue(member.filiere) }}</div>
              <div class="text-muted">
                {{ displayValue(member.faculte) }} · {{ displayValue(member.universite) }}
              </div>
            </td>
            <td class="px-3 py-3">
              <div
                v-if="memberPoles(member).length"
                class="flex flex-wrap gap-1"
              >
                <UBadge
                  v-for="label in memberPoleLabels(member)"
                  :key="label"
                  color="neutral"
                  variant="soft"
                  size="sm"
                >
                  {{ label }}
                </UBadge>
              </div>
              <span v-else>{{ displayValue(null) }}</span>
            </td>
            <td class="px-3 py-3">
              {{ roleLabels[member.role] }}
            </td>
            <td class="px-3 py-3">
              <UBadge
                :color="member.isActive ? 'primary' : 'neutral'"
                variant="soft"
              >
                {{ member.isActive ? 'Actif' : 'Inactif' }}
              </UBadge>
            </td>
            <td class="px-3 py-3 whitespace-nowrap">
              {{ formatDate(member.createdAt) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <AppPagination
      v-if="!pending && !error"
      :current-page="currentPage"
      :total-pages="totalPages"
      :item-count="filteredMembers.length"
      item-label="résultat"
      @page-change="(page) => (currentPage = page)"
    />
    <p
      v-if="!pending && !error"
      class="mt-4 text-xs text-muted"
    >
      {{ filteredMembers.length }} membre{{ filteredMembers.length > 1 ? 's' : '' }} affiché{{ filteredMembers.length > 1 ? 's' : '' }}.
      Sur mobile, fais glisser le tableau horizontalement.
    </p>
  </section>
</template>
