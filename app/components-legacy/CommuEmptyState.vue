<script setup lang="ts">
/**
 * CommuEmptyState — état vide / erreur explicite, avec action optionnelle.
 * Évite les zones blanches muettes quand une liste ne renvoie rien.
 */
withDefaults(defineProps<{
  icon?: string
  title: string
  description?: string
  tone?: 'neutral' | 'alert'
  compact?: boolean
}>(), {
  icon: 'i-lucide-inbox',
  description: undefined,
  tone: 'neutral',
  compact: false
})
</script>

<template>
  <div
    class="commu-empty"
    :class="[`commu-empty--${tone}`, { 'commu-empty--compact': compact }]"
    role="status"
  >
    <span class="commu-empty__icon">
      <UIcon
        :name="icon"
        class="h-5 w-5"
      />
    </span>
    <p class="commu-empty__title">
      {{ title }}
    </p>
    <p
      v-if="description"
      class="commu-empty__description"
    >
      {{ description }}
    </p>
    <div
      v-if="$slots.actions"
      class="commu-empty__actions"
    >
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.commu-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 2.5rem 1.25rem;
  border-radius: 1rem;
  border: 1px dashed var(--border-color);
  background: rgba(var(--primary-color-rgb), 0.04);
  text-align: center;
}

.commu-empty--compact {
  padding: 1.25rem 1rem;
}

.commu-empty--alert {
  border-color: rgba(var(--primary-color-rgb), 0.45);
  background: rgba(var(--primary-color-rgb), 0.08);
}

.commu-empty__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.4rem;
  height: 2.4rem;
  margin-bottom: 0.35rem;
  border-radius: 0.85rem;
  border: 1px solid rgba(var(--primary-color-rgb), 0.35);
  color: var(--accent-color);
  background: rgba(var(--accent-color-rgb), 0.12);
}

.commu-empty__title {
  font-weight: 700;
  color: var(--text-color);
}

.commu-empty__description {
  max-width: 46ch;
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--muted-color);
}

.commu-empty__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
}
</style>
