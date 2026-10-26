<script setup lang="ts">
const props = withDefaults(defineProps<{
  name: string
  src?: string | null
  size?: 'sm' | 'md' | 'lg'
  tone?: 'primary' | 'accent'
}>(), {
  src: null,
  size: 'md',
  tone: 'primary'
})

const initial = computed(() => props.name.trim().charAt(0).toUpperCase() || '?')
</script>

<template>
  <span
    class="commu-avatar"
    :class="[`commu-avatar--${size}`, `commu-avatar--${tone}`]"
  >
    <img
      v-if="src"
      :src="src"
      :alt="`Avatar de ${name}`"
      class="commu-avatar__image"
      loading="lazy"
    >
    <span v-else>{{ initial }}</span>
  </span>
</template>

<style scoped>
.commu-avatar {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 1rem;
  border: 1px solid rgba(var(--primary-color-rgb), 0.35);
  color: var(--bg-color);
  background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
  font-weight: 900;
  line-height: 1;
  text-transform: uppercase;
}

.commu-avatar--sm {
  width: 2rem;
  height: 2rem;
  border-radius: 0.6rem;
  font-size: 0.8rem;
}

.commu-avatar--md {
  width: 2.75rem;
  height: 2.75rem;
  font-size: 1rem;
}

.commu-avatar--lg {
  width: 4rem;
  height: 4rem;
  border-radius: 1.15rem;
  font-size: 1.5rem;
}

.commu-avatar--accent {
  background: linear-gradient(135deg, var(--accent-color), var(--primary-color));
}

.commu-avatar__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
