<script setup lang="ts">
import { computed } from 'vue'
/** Bouton commun des mini-jeux : grande zone tactile (44 px minimum), 3 variantes. */
const props = withDefaults(defineProps<{ variant?: 'primary' | 'ghost' | 'danger'; small?: boolean }>(), {
  variant: 'primary',
  small: false,
})

const classes = computed(() => {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition select-none ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300 disabled:cursor-not-allowed disabled:opacity-40 ' +
    (props.small ? 'min-h-10 px-3 text-sm' : 'min-h-11 px-5 text-base')
  const variants = {
    primary: 'bg-gradient-to-r from-violet-500 to-pink-500 text-white shadow-lg shadow-violet-900/40 hover:brightness-110 active:scale-95',
    ghost: 'border border-violet-300/30 bg-violet-900/30 text-violet-100 hover:bg-violet-800/40 active:scale-95',
    danger: 'bg-rose-600 text-white hover:bg-rose-500 active:scale-95',
  }
  return base + ' ' + variants[props.variant]
})
</script>

<template>
  <button type="button" :class="classes"><slot /></button>
</template>
