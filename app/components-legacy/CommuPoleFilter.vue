<script setup lang="ts">
/**
 * CommuPoleFilter — filtres par pôle (classe maison .pole-filter).
 * Utilisé par la page Communauté et le dashboard Communication.
 */
type PoleOption = {
  label: string
  value: string
  count?: number
}

withDefaults(defineProps<{
  modelValue: string
  options: PoleOption[]
  ariaLabel?: string
  showCounts?: boolean
}>(), {
  ariaLabel: 'Filtrer par pôle',
  showCounts: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function select(value: string) {
  emit('update:modelValue', value)
}
</script>

<template>
  <div
    class="commu-pole-filter"
    role="group"
    :aria-label="ariaLabel"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="pole-filter"
      :class="{ 'pole-filter--active': modelValue === option.value }"
      :aria-pressed="modelValue === option.value"
      @click="select(option.value)"
    >
      {{ option.label }}
      <span
        v-if="showCounts && typeof option.count === 'number'"
        class="pole-filter__count"
      >
        {{ option.count }}
      </span>
    </button>
  </div>
</template>

<style scoped>
.commu-pole-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.pole-filter {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border-radius: 9999px;
  padding: 0.4rem 0.9rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-color);
  background: transparent;
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, transform 0.15s ease;
}

.pole-filter:hover {
  border-color: rgba(var(--primary-color-rgb), 0.5);
  background: rgba(var(--primary-color-rgb), 0.08);
  transform: translateY(-1px);
}

.pole-filter--active {
  color: var(--bg-color);
  background: var(--primary-color);
  border-color: var(--primary-color);
}

.pole-filter__count {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  opacity: 0.75;
}

.pole-filter--active .pole-filter__count {
  opacity: 0.9;
}
</style>
