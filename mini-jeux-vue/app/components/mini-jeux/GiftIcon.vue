<script setup lang="ts">
import { computed } from 'vue'

/** Cadeau dessiné en SVG. 10 variantes (couleur + motif) pour le memory. */
const props = defineProps<{ variant: number }>()

const COLORS = [
  { box: '#8b5cf6', lid: '#7c3aed', ribbon: '#fde68a' },
  { box: '#ec4899', lid: '#db2777', ribbon: '#ffffff' },
  { box: '#14b8a6', lid: '#0d9488', ribbon: '#fde68a' },
  { box: '#f97316', lid: '#ea580c', ribbon: '#ffffff' },
  { box: '#38bdf8', lid: '#0ea5e9', ribbon: '#fbcfe8' },
  { box: '#84cc16', lid: '#65a30d', ribbon: '#7c3aed' },
  { box: '#ef4444', lid: '#dc2626', ribbon: '#fef9c3' },
  { box: '#facc15', lid: '#eab308', ribbon: '#be185d' },
  { box: '#6366f1', lid: '#4f46e5', ribbon: '#a7f3d0' },
  { box: '#94a3b8', lid: '#64748b', ribbon: '#fda4af' },
]
const PATTERNS = ['stripes', 'dots', 'stars', 'zigzag', 'hearts'] as const

const c = computed(() => COLORS[props.variant % COLORS.length]!)
const pattern = computed(() => PATTERNS[props.variant % PATTERNS.length]!)
</script>

<template>
  <svg viewBox="0 0 64 64" class="h-full w-full" role="img" aria-hidden="true">
    <rect x="10" y="30" width="44" height="28" rx="3" :fill="c.box" />
    <g fill="#fff" fill-opacity="0.45" stroke="#fff" stroke-opacity="0.45">
      <template v-if="pattern === 'stripes'">
        <rect x="14" y="30" width="3" height="28" stroke="none" />
        <rect x="20" y="30" width="3" height="28" stroke="none" />
        <rect x="41" y="30" width="3" height="28" stroke="none" />
        <rect x="47" y="30" width="3" height="28" stroke="none" />
      </template>
      <template v-else-if="pattern === 'dots'">
        <circle cx="17" cy="40" r="2.4" stroke="none" />
        <circle cx="17" cy="51" r="2.4" stroke="none" />
        <circle cx="47" cy="40" r="2.4" stroke="none" />
        <circle cx="47" cy="51" r="2.4" stroke="none" />
        <circle cx="23" cy="46" r="2" stroke="none" />
        <circle cx="41" cy="46" r="2" stroke="none" />
      </template>
      <template v-else-if="pattern === 'stars'">
        <path transform="translate(18 42)" d="M0,-4 L1.2,-1.2 L4,-1 L1.8,0.8 L2.5,3.6 L0,2 L-2.5,3.6 L-1.8,0.8 L-4,-1 L-1.2,-1.2Z" stroke="none" />
        <path transform="translate(46 42)" d="M0,-4 L1.2,-1.2 L4,-1 L1.8,0.8 L2.5,3.6 L0,2 L-2.5,3.6 L-1.8,0.8 L-4,-1 L-1.2,-1.2Z" stroke="none" />
        <path transform="translate(18 54)" d="M0,-3 L1,-1 L3,-0.8 L1.4,0.6 L1.9,2.7 L0,1.5 L-1.9,2.7 L-1.4,0.6 L-3,-0.8 L-1,-1Z" stroke="none" />
        <path transform="translate(46 54)" d="M0,-3 L1,-1 L3,-0.8 L1.4,0.6 L1.9,2.7 L0,1.5 L-1.9,2.7 L-1.4,0.6 L-3,-0.8 L-1,-1Z" stroke="none" />
      </template>
      <template v-else-if="pattern === 'zigzag'">
        <polyline points="12,44 16,38 20,44 24,38" fill="none" stroke-width="2" />
        <polyline points="40,44 44,38 48,44 52,38" fill="none" stroke-width="2" />
        <polyline points="12,55 16,49 20,55 24,49" fill="none" stroke-width="2" />
        <polyline points="40,55 44,49 48,55 52,49" fill="none" stroke-width="2" />
      </template>
      <template v-else>
        <path transform="translate(18 42)" d="M0 3 C-6 -2 -3 -6 0 -2.5 C3 -6 6 -2 0 3Z" stroke="none" />
        <path transform="translate(46 42)" d="M0 3 C-6 -2 -3 -6 0 -2.5 C3 -6 6 -2 0 3Z" stroke="none" />
        <path transform="translate(18 54)" d="M0 3 C-6 -2 -3 -6 0 -2.5 C3 -6 6 -2 0 3Z" stroke="none" />
        <path transform="translate(46 54)" d="M0 3 C-6 -2 -3 -6 0 -2.5 C3 -6 6 -2 0 3Z" stroke="none" />
      </template>
    </g>
    <rect x="6" y="22" width="52" height="11" rx="3" :fill="c.lid" />
    <rect x="28" y="22" width="8" height="36" :fill="c.ribbon" />
    <path d="M32 21 C22 6 12 14 22 21 Z" :fill="c.ribbon" />
    <path d="M32 21 C42 6 52 14 42 21 Z" :fill="c.ribbon" />
    <circle cx="32" cy="21" r="4" :fill="c.ribbon" />
  </svg>
</template>
