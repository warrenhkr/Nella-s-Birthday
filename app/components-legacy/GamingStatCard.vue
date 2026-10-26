<script setup lang="ts">
// Carte d'indicateur du cockpit gaming.
// Aucune couleur figée : tons calculés à partir des variables du thème
// (--primary-color, --accent-color, --muted-color), donc lisibles dans les
// 4 combinaisons sombre/clair x persona/cyberpunk.
const props = defineProps<{
  label: string
  value: string | number
  hint?: string
  icon?: string
  tone?: 'default' | 'active' | 'done'
}>()

const toneClass = computed(() => `gaming-stat--${props.tone || 'default'}`)
</script>

<template>
  <article
    class="gaming-stat surface-solid clip-corner"
    :class="toneClass"
  >
    <div class="flex items-start justify-between gap-3">
      <p class="gaming-stat__label">
        {{ label }}
      </p>
      <UIcon
        v-if="icon"
        :name="icon"
        class="gaming-stat__icon"
        aria-hidden="true"
      />
    </div>
    <p class="gaming-stat__value font-display">
      {{ value }}
    </p>
    <p
      v-if="hint"
      class="gaming-stat__hint"
    >
      {{ hint }}
    </p>
  </article>
</template>

<style scoped>
.gaming-stat {
  min-width: 0;
  padding: 1rem 1.1rem;
  border: 1px solid rgba(var(--primary-color-rgb), 0.16);
}

.gaming-stat__label {
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted-color);
}

.gaming-stat__icon {
  height: 1.1rem;
  width: 1.1rem;
  flex: none;
  color: var(--accent-color);
}

.gaming-stat__value {
  margin-top: 0.4rem;
  font-size: 1.9rem;
  font-weight: 900;
  line-height: 1.1;
  color: var(--text-color);
}

.gaming-stat__hint {
  margin-top: 0.25rem;
  font-size: 0.78rem;
  color: var(--muted-color);
}

.gaming-stat--active {
  border-color: rgba(var(--primary-color-rgb), 0.42);
  background: linear-gradient(180deg, rgba(var(--primary-color-rgb), 0.12), var(--panel-color-solid));
}

.gaming-stat--active .gaming-stat__value {
  color: var(--primary-color);
}

.gaming-stat--done {
  border-color: rgba(var(--accent-color-rgb), 0.34);
}

.gaming-stat--done .gaming-stat__value {
  color: var(--accent-color);
}
</style>
