<script setup lang="ts">
/**
 * CommuTabs — barre d'onglets de la page Communauté.
 *
 * Objectif : éviter le défilement interminable en découpant la page en
 * vues courtes (Membres / Pôles / Annonces). L'onglet actif est piloté par
 * le parent, qui le synchronise avec l'URL (?vue=membres) pour que les
 * liens restent partageables.
 *
 * Accessibilité : vraie structure ARIA (tablist/tab/tabpanel côté parent),
 * navigation clavier ← → Début/Fin et tabindex mobile (une seule tabulation).
 */
const props = withDefaults(defineProps<{
  /** Onglet actif (valeur technique, ex. « membres »). */
  modelValue: string
  /** Onglets à afficher, dans l'ordre. */
  tabs: Array<{ value: string, label: string, icon?: string, count?: number | null, hint?: string }>
  ariaLabel?: string
}>(), {
  ariaLabel: 'Navigation par onglets'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function select(value: string) {
  if (value !== props.modelValue) emit('update:modelValue', value)
}

function onKeydown(event: KeyboardEvent, index: number) {
  const last = props.tabs.length - 1
  let next = -1
  if (event.key === 'ArrowRight') next = index >= last ? 0 : index + 1
  else if (event.key === 'ArrowLeft') next = index <= 0 ? last : index - 1
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = last
  if (next < 0) return

  event.preventDefault()
  const target = props.tabs[next]
  if (!target) return
  select(target.value)
  nextTick(() => {
    const element = document.getElementById(`commu-tab-${target.value}`)
    if (element instanceof HTMLElement) element.focus()
  })
}
</script>

<template>
  <div
    class="commu-tabs"
    role="tablist"
    :aria-label="ariaLabel"
  >
    <button
      v-for="(tab, index) in tabs"
      :key="tab.value"
      :id="`commu-tab-${tab.value}`"
      type="button"
      role="tab"
      class="commu-tab"
      :class="{ 'commu-tab--active': modelValue === tab.value }"
      :aria-selected="modelValue === tab.value"
      :aria-controls="`commu-panel-${tab.value}`"
      :tabindex="modelValue === tab.value ? 0 : -1"
      :title="tab.hint || undefined"
      @click="select(tab.value)"
      @keydown="onKeydown($event, index)"
    >
      <UIcon
        v-if="tab.icon"
        :name="tab.icon"
        class="commu-tab__icon"
        aria-hidden="true"
      />
      <span class="commu-tab__label">{{ tab.label }}</span>
      <span
        v-if="typeof tab.count === 'number'"
        class="commu-tab__count"
      >
        {{ tab.count }}
      </span>
    </button>
  </div>
</template>

<style scoped>
.commu-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  padding: 0.4rem;
  border: 1px solid var(--border-color);
  border-radius: 0.9rem;
  background: rgba(var(--primary-color-rgb), 0.05);
}

.commu-tab {
  display: inline-flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 2.6rem;
  padding: 0.45rem 0.9rem;
  border: 1px solid transparent;
  border-radius: 0.7rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--muted-color);
  background: transparent;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.commu-tab:hover {
  color: var(--text-color);
  border-color: rgba(var(--primary-color-rgb), 0.35);
  background: rgba(var(--primary-color-rgb), 0.08);
}

.commu-tab--active {
  color: var(--bg-color);
  background: var(--primary-color);
  border-color: var(--primary-color);
}

.commu-tab:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(var(--primary-color-rgb), 0.35);
}

.commu-tab__icon {
  width: 1rem;
  height: 1rem;
}

.commu-tab__label {
  white-space: nowrap;
}

.commu-tab__count {
  padding: 0.05rem 0.45rem;
  border-radius: 9999px;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  font-weight: 700;
  color: inherit;
  background: rgba(var(--primary-color-rgb), 0.16);
}

.commu-tab--active .commu-tab__count {
  color: var(--primary-color);
  background: var(--bg-color);
}

@media (min-width: 640px) {
  .commu-tab {
    flex: 0 1 auto;
  }
}
</style>
