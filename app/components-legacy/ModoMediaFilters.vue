<script setup lang="ts">
type ModoStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FLAGGED'
type MediaSource = 'CLOUDINARY' | 'DIRECT' | 'YOUTUBE' | 'TERABOX'
type MediaTypeFilter = 'ALL' | 'IMAGE' | 'VIDEO'
type SourceFilter = 'ALL' | MediaSource
type StatusFilter = 'ALL' | ModoStatus

type Filters = {
  query: string
  event: string
  type: MediaTypeFilter
  source: SourceFilter
  status: StatusFilter
}

const props = defineProps<{
  filters: Filters
  events: string[]
  counts: Record<ModoStatus, number>
  total: number
  filtered: number
}>()

const emit = defineEmits<{
  'update:filters': [value: Filters]
  'reset': []
}>()

const STATUS_CHIPS: Array<{ value: ModoStatus, label: string }> = [
  { value: 'PENDING', label: 'En attente' },
  { value: 'APPROVED', label: 'Approuvé' },
  { value: 'REJECTED', label: 'Rejeté' },
  { value: 'FLAGGED', label: 'Signalé' }
]

const isDirty = computed(() =>
  Boolean(props.filters.query)
  || Boolean(props.filters.event)
  || props.filters.type !== 'ALL'
  || props.filters.source !== 'ALL'
  || props.filters.status !== 'ALL'
)

function set<K extends keyof Filters>(key: K, value: Filters[K]) {
  emit('update:filters', { ...props.filters, [key]: value })
}

function onChange(key: keyof Filters, event: Event) {
  const target = event.target as HTMLInputElement | HTMLSelectElement
  set(key, target.value as Filters[typeof key])
}

// AppSelect émet directement la valeur (chaîne), contrairement à un <select>
// natif dont @change fournit un Event. On normalise donc vers le type du filtre.
function onSelectChange(key: keyof Filters, value: string) {
  emit('update:filters', { ...props.filters, [key]: value } as Filters)
}
</script>

<template>
  <section class="modo-filters surface-solid clip-corner">
    <div class="modo-filters__head">
      <div>
        <p class="modo-filters__eyebrow">
          Filtres média
        </p>
        <p class="modo-filters__count">
          <strong>{{ filtered }}</strong> média(s) affiché(s) sur {{ total }}
        </p>
      </div>
      <UButton
        color="neutral"
        variant="soft"
        size="sm"
        icon="i-lucide-filter-x"
        label="Réinitialiser"
        :disabled="!isDirty"
        @click="emit('reset')"
      />
    </div>

    <div class="modo-filters__grid">
      <label class="modo-field modo-field--wide">
        <span class="modo-field__label">Recherche</span>
        <input
          class="modo-control"
          type="search"
          :value="filters.query"
          placeholder="Titre, événement, source…"
          @input="onChange('query', $event)"
        >
      </label>

      <AppSelect
        :model-value="filters.event"
        label="Événement"
        icon="i-lucide-calendar"
        variant="filter"
        aria-label="Filtrer par événement"
        :options="[{ value: '', label: 'Tous les événements' }, ...events.map(eventLabel => ({ value: eventLabel, label: eventLabel }))]"
        @update:model-value="onSelectChange('event', $event)"
      />

      <AppSelect
        :model-value="filters.type"
        label="Type"
        icon="i-lucide-image"
        variant="filter"
        aria-label="Filtrer par type de média"
        :options="[
          { value: 'ALL', label: 'Tous les types' },
          { value: 'IMAGE', label: 'Images' },
          { value: 'VIDEO', label: 'Vidéos' }
        ]"
        @update:model-value="onSelectChange('type', $event)"
      />

      <AppSelect
        :model-value="filters.source"
        label="Source"
        icon="i-lucide-database"
        variant="filter"
        aria-label="Filtrer par source"
        :options="[
          { value: 'ALL', label: 'Toutes les sources' },
          { value: 'CLOUDINARY', label: 'Cloudinary' },
          { value: 'DIRECT', label: 'Lien direct' },
          { value: 'YOUTUBE', label: 'YouTube' },
          { value: 'TERABOX', label: 'Terabox' }
        ]"
        @update:model-value="onSelectChange('source', $event)"
      />
    </div>

    <div
      class="modo-status-chips"
      role="group"
      aria-label="Filtrer par statut"
    >
      <button
        type="button"
        class="pole-filter"
        :class="{ 'pole-filter--active': filters.status === 'ALL' }"
        :aria-pressed="filters.status === 'ALL'"
        @click="set('status', 'ALL')"
      >
        Tous <span class="modo-chip__count">{{ total }}</span>
      </button>
      <button
        v-for="chip in STATUS_CHIPS"
        :key="chip.value"
        type="button"
        class="pole-filter"
        :class="{ 'pole-filter--active': filters.status === chip.value }"
        :aria-pressed="filters.status === chip.value"
        @click="set('status', chip.value)"
      >
        {{ chip.label }} <span class="modo-chip__count">{{ counts[chip.value] }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.modo-filters {
  padding: 1.25rem;
}

.modo-filters__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
}

.modo-filters__eyebrow {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--primary-color);
}

.modo-filters__count {
  margin-top: 0.25rem;
  font-size: 0.875rem;
  color: var(--muted-color);
}

.modo-filters__count strong {
  color: var(--text-color);
  font-weight: 700;
}

.modo-filters__grid {
  display: grid;
  gap: 1rem;
  margin-top: 1.25rem;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.modo-field--wide {
  grid-column: 1 / -1;
}

@media (min-width: 900px) {
  .modo-field--wide {
    grid-column: span 2;
  }
}

.modo-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
}

.modo-field__label {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted-color);
}

.modo-control {
  width: 100%;
  min-height: 2.6rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 0.6rem;
  background: rgba(var(--primary-color-rgb), 0.06);
  color: var(--text-color);
  font-size: 0.9rem;
}

.modo-control:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(var(--primary-color-rgb), 0.14);
}

.modo-status-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1.25rem;
}

/* Classes maison : `.pole-filter` (déclarée localement, comme sur les pages
   événements/communauté) — fond primaire translucide, lisible dans les 4 thèmes. */
.pole-filter {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 2.4rem;
  padding: 0.4rem 0.9rem;
  border: 1px solid var(--border-color);
  border-radius: 9999px;
  background: transparent;
  color: var(--text-color);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, transform 0.15s ease;
}

.pole-filter:hover {
  border-color: rgba(var(--primary-color-rgb), 0.5);
  transform: translateY(-1px);
}

.pole-filter--active {
  color: var(--text-color);
  background: rgba(var(--primary-color-rgb), 0.18);
  border-color: var(--primary-color);
  font-weight: 600;
}

.modo-chip__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.4rem;
  padding: 0 0.35rem;
  border-radius: 9999px;
  background: rgba(var(--primary-color-rgb), 0.16);
  color: var(--text-color);
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
}
</style>
