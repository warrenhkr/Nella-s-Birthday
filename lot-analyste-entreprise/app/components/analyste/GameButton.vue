<script setup lang="ts">
import { computed } from 'vue'

/** Bouton commun : zone tactile de 44 px, trois variantes. */
const props = withDefaults(defineProps<{ variant?: 'primary' | 'ghost' | 'danger'; small?: boolean }>(), {
  variant: 'primary',
  small: false,
})

const classes = computed(() => {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition select-none ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 disabled:cursor-not-allowed disabled:opacity-40 ' +
    (props.small ? 'min-h-10 px-3 text-sm' : 'min-h-11 px-5 text-base')
  const variants = {
    primary: 'bg-gradient-to-r from-teal-500 to-sky-500 text-slate-950 shadow-lg shadow-teal-900/30 hover:brightness-110 active:scale-95',
    ghost: 'border border-slate-600 bg-slate-800/60 text-slate-100 hover:bg-slate-700/70 active:scale-95',
    danger: 'bg-rose-500 text-white hover:bg-rose-400 active:scale-95',
  }
  return base + ' ' + variants[props.variant]
})
</script>

<template>
  <button type="button" :class="classes"><slot /></button>
</template>
