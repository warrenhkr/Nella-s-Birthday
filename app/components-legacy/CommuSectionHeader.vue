<script setup lang="ts">
/**
 * CommuSectionHeader — en-tête de section réutilisable
 * (page Communauté + dashboard Communication).
 * Toutes les couleurs viennent des variables de thème (main.css).
 */
withDefaults(defineProps<{
  title: string
  eyebrow?: string
  description?: string
  count?: number | null
  countLabel?: string
}>(), {
  eyebrow: undefined,
  description: undefined,
  count: null,
  countLabel: 'élément(s)'
})
</script>

<template>
  <div class="commu-section-header">
    <div class="commu-section-header__main">
      <p
        v-if="eyebrow"
        class="commu-section-header__eyebrow"
      >
        {{ eyebrow }}
      </p>
      <h2 class="commu-section-header__title">
        {{ title }}
        <span
          v-if="typeof count === 'number'"
          class="commu-section-header__count"
          :title="`${count} ${countLabel}`"
        >
          {{ count }}
        </span>
      </h2>
      <p
        v-if="description"
        class="commu-section-header__description"
      >
        {{ description }}
      </p>
    </div>

    <div
      v-if="$slots.actions"
      class="commu-section-header__actions"
    >
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.commu-section-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.75rem 1.25rem;
}

.commu-section-header__main {
  min-width: 0;
}

.commu-section-header__eyebrow {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  color: var(--accent-color);
}

.commu-section-header__title {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-top: 0.4rem;
  font-family: var(--font-display);
  font-size: clamp(1.35rem, 2.4vw, 1.75rem);
  font-weight: 800;
  letter-spacing: 0.02em;
  color: var(--text-color);
}

.commu-section-header__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.85rem;
  padding: 0.1rem 0.55rem;
  border-radius: 9999px;
  border: 1px solid rgba(var(--primary-color-rgb), 0.4);
  background: rgba(var(--primary-color-rgb), 0.12);
  color: var(--primary-color);
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 700;
}

.commu-section-header__description {
  margin-top: 0.4rem;
  max-width: 58ch;
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--muted-color);
}

.commu-section-header__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}
</style>
