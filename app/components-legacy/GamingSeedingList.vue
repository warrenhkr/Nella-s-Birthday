<script setup lang="ts">
// Éditeur de seeding : réordonnancement par glisser-déposer (souris) ou par
// boutons monter/descendre (clavier et mobile), puis enregistrement via
// PATCH /api/tournaments/:id/teams. En cas d'échec, l'ordre local est rétabli
// pour ne jamais afficher un ordre que le serveur n'a pas accepté.
type SeedTeam = { id: string, name: string, seed: number | null }

const props = defineProps<{
  tournamentId: string
  teams: SeedTeam[]
}>()

const emit = defineEmits<{ updated: [] }>()

const { success, alert } = useGameToast()
const { playSfx } = useSoundManager()

const order = ref<SeedTeam[]>([])
const saving = ref(false)
const draggedIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

const serverOrder = computed(() => [...props.teams].sort((a, b) => (a.seed ?? 0) - (b.seed ?? 0)).map(team => team.id))
const dirty = computed(() => order.value.map(team => team.id).join('|') !== serverOrder.value.join('|'))

watch(() => props.teams, (teams) => {
  order.value = [...teams].sort((a, b) => (a.seed ?? 0) - (b.seed ?? 0))
}, { immediate: true, deep: true })

function move(index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= order.value.length) return
  const next = [...order.value]
  const moved = next[index]
  const replaced = next[target]
  if (!moved || !replaced) return
  next[index] = replaced
  next[target] = moved
  order.value = next
  playSfx('click')
}

function moveTo(from: number, to: number) {
  if (from === to) return
  const next = [...order.value]
  const [moved] = next.splice(from, 1)
  if (!moved) return
  next.splice(to, 0, moved)
  order.value = next
}

function onDragStart(index: number) {
  draggedIndex.value = index
}

function onDragOver(index: number) {
  dragOverIndex.value = index
}

function onDrop(index: number) {
  if (draggedIndex.value !== null) moveTo(draggedIndex.value, index)
  draggedIndex.value = null
  dragOverIndex.value = null
}

function onDragEnd() {
  draggedIndex.value = null
  dragOverIndex.value = null
}

function sortByName() {
  order.value = [...order.value].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  playSfx('click')
}

function reverseOrder() {
  order.value = [...order.value].reverse()
  playSfx('click')
}

function restore() {
  order.value = [...order.value].sort((a, b) => (a.seed ?? 0) - (b.seed ?? 0))
  playSfx('click')
}

function getApiErrorMessage(errorValue: unknown, fallback: string) {
  if (typeof errorValue === 'object' && errorValue !== null && 'data' in errorValue) {
    const data = errorValue.data
    if (typeof data === 'object' && data !== null && 'statusMessage' in data && typeof data.statusMessage === 'string') return data.statusMessage
  }
  return fallback
}

async function save() {
  const payload = order.value.map(team => team.id)
  if (payload.length < 2) {
    alert('Il faut au moins deux équipes pour définir un seeding.')
    return
  }

  const rollback = [...order.value]
  saving.value = true
  try {
    await $fetch(`/api/tournaments/${props.tournamentId}/teams`, { method: 'PATCH', body: { teamIds: payload } })
    playSfx('success')
    success('Seeding enregistré (têtes de série mises à jour).')
    emit('updated')
  } catch (saveError: unknown) {
    order.value = rollback
    playSfx('error')
    alert(getApiErrorMessage(saveError, 'Impossible d’enregistrer le seeding.'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="gaming-eyebrow">
          Têtes de série
        </p>
        <p class="mt-1 text-sm text-muted">
          {{ order.length }} équipe<span v-if="order.length > 1">s</span> · glisse une ligne ou utilise les flèches.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton
          color="neutral"
          variant="soft"
          size="xs"
          icon="i-lucide-arrow-down-a-z"
          label="Trier par nom"
          @click="sortByName"
        />
        <UButton
          color="neutral"
          variant="soft"
          size="xs"
          icon="i-lucide-arrow-up-down"
          label="Inverser"
          @click="reverseOrder"
        />
        <UButton
          color="neutral"
          variant="soft"
          size="xs"
          icon="i-lucide-undo-2"
          label="Ordre d’origine"
          :disabled="!dirty"
          @click="restore"
        />
        <UButton
          color="primary"
          size="xs"
          icon="i-lucide-save"
          label="Enregistrer le seeding"
          :loading="saving"
          :disabled="!dirty"
          @click="save"
        />
      </div>
    </div>

    <ol
      class="gaming-seed-list"
      aria-label="Ordre de seeding"
    >
      <li
        v-for="(team, index) in order"
        :key="team.id"
        class="gaming-seed"
        :class="{
          'gaming-seed--dragging': draggedIndex === index,
          'gaming-seed--over': dragOverIndex === index && draggedIndex !== null && draggedIndex !== index
        }"
        :draggable="!saving"
        @dragstart="onDragStart(index)"
        @dragover.prevent="onDragOver(index)"
        @dragleave="dragOverIndex = null"
        @drop.prevent="onDrop(index)"
        @dragend="onDragEnd"
      >
        <span
          class="gaming-seed__grip"
          aria-hidden="true"
        >
          <UIcon name="i-lucide-grip-vertical" />
        </span>
        <span class="gaming-seed__rank">{{ index + 1 }}</span>
        <span class="gaming-seed__name">{{ team.name }}</span>
        <span class="gaming-seed__actions">
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-chevron-up"
            :aria-label="`Monter ${team.name}`"
            :disabled="index === 0 || saving"
            @click="move(index, -1)"
          />
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-chevron-down"
            :aria-label="`Descendre ${team.name}`"
            :disabled="index === order.length - 1 || saving"
            @click="move(index, 1)"
          />
        </span>
      </li>
    </ol>

    <UAlert
      color="neutral"
      variant="soft"
      icon="i-lucide-info"
      title="Ce que change ce classement"
      description="Les appariements du premier tour ont été générés à la création du tournoi. Réordonner ici met à jour les têtes de série enregistrées (seed), qui servent de référence pour le bracket, les forfaits et le classement. Les matchs déjà créés conservent leurs équipes."
    />
  </div>
</template>

<style scoped>
.gaming-eyebrow {
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent-color);
}

.gaming-seed-list {
  display: flex;
  max-height: 32rem;
  flex-direction: column;
  gap: 0.4rem;
  overflow-y: auto;
  padding-right: 0.15rem;
}

.gaming-seed {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-height: 2.75rem;
  border: 1px solid rgba(var(--primary-color-rgb), 0.18);
  background: rgba(var(--primary-color-rgb), 0.04);
  padding: 0.35rem 0.6rem;
  color: var(--text-color);
}

.gaming-seed--dragging {
  opacity: 0.4;
}

.gaming-seed--over {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb), 0.24);
}

.gaming-seed__grip {
  color: var(--muted-color);
  cursor: grab;
}

.gaming-seed__rank {
  min-width: 1.5rem;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--accent-color);
}

.gaming-seed__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.88rem;
}

.gaming-seed__actions {
  display: inline-flex;
  gap: 0.15rem;
}
</style>
