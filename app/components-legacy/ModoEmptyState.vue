<script setup lang="ts">
type ModoEmptyMode = 'empty' | 'no-match'

withDefaults(defineProps<{
  mode?: ModoEmptyMode
}>(), { mode: 'empty' })

const emit = defineEmits<{
  reset: []
}>()
</script>

<template>
  <div class="modo-empty surface-solid clip-corner">
    <span
      class="modo-empty__icon"
      aria-hidden="true"
    >
      <UIcon :name="mode === 'no-match' ? 'i-lucide-search-x' : 'i-lucide-image-off'" />
    </span>
    <h3 class="modo-empty__title">
      {{ mode === 'no-match' ? 'Aucun média pour ces filtres' : 'Aucun média à modérer' }}
    </h3>
    <p class="modo-empty__text">
      {{ mode === 'no-match'
        ? 'Aucun média ne correspond à la combinaison choisie. Assouplis ou réinitialise les filtres pour les retrouver.'
        : 'Aucun média n’est encore présent dans la galerie. Publie des souvenirs depuis la section « Publier un souvenir ».' }}
    </p>
    <UButton
      v-if="mode === 'no-match'"
      class="mt-4"
      color="primary"
      icon="i-lucide-filter-x"
      label="Réinitialiser les filtres"
      @click="emit('reset')"
    />
  </div>
</template>

<style scoped>
.modo-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding: 3rem 1.5rem;
  text-align: center;
}

.modo-empty__icon {
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

.modo-empty__title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-color);
}

.modo-empty__text {
  max-width: 34rem;
  font-size: 0.875rem;
  color: var(--muted-color);
}
</style>
