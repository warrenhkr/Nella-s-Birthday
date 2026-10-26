<script setup lang="ts">
/**
 * CommuStatCard — tuile d'indicateur (membres, publications, réactions…).
 * Le chiffre est mis en avant, le libellé reste discret.
 */
withDefaults(defineProps<{
  label: string
  value: string | number
  icon?: string
  hint?: string
  tone?: 'primary' | 'accent' | 'muted'
}>(), {
  icon: undefined,
  hint: undefined,
  tone: 'primary'
})
</script>

<template>
  <div
    class="commu-stat"
    :class="`commu-stat--${tone}`"
  >
    <span
      v-if="icon"
      class="commu-stat__icon"
    >
      <UIcon
        :name="icon"
        class="h-4 w-4"
      />
    </span>
    <p class="commu-stat__value">
      {{ value }}
    </p>
    <p class="commu-stat__label">
      {{ label }}
    </p>
    <p
      v-if="hint"
      class="commu-stat__hint"
    >
      {{ hint }}
    </p>
  </div>
</template>

<style scoped>
.commu-stat {
  --commu-stat-tone: var(--primary-color);
  --commu-stat-tone-rgb: var(--primary-color-rgb);
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.9rem 1rem;
  border-radius: 1rem;
  border: 1px solid var(--border-color);
  background: rgba(var(--commu-stat-tone-rgb), 0.06);
}

.commu-stat--accent {
  --commu-stat-tone: var(--accent-color);
  --commu-stat-tone-rgb: var(--accent-color-rgb);
}

.commu-stat--muted {
  --commu-stat-tone: var(--muted-color);
  --commu-stat-tone-rgb: 127, 127, 127;
}

.commu-stat__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.85rem;
  height: 1.85rem;
  margin-bottom: 0.35rem;
  border-radius: 0.6rem;
  border: 1px solid rgba(var(--commu-stat-tone-rgb), 0.35);
  color: var(--commu-stat-tone);
  background: rgba(var(--commu-stat-tone-rgb), 0.12);
}

.commu-stat__value {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 900;
  line-height: 1.1;
  color: var(--text-color);
}

.commu-stat__label {
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted-color);
}

.commu-stat__hint {
  font-size: 0.72rem;
  color: var(--muted-color);
}
</style>
