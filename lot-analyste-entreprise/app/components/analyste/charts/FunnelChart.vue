<script setup lang="ts">
import { computed } from 'vue'
import { ArrowDown } from '@lucide/vue'

/** Entonnoir en HTML/CSS : une barre centrée par étape et le taux de passage entre les étapes. */
const props = defineProps<{ steps: { label: string; value: number }[]; highlight?: number }>()

const rows = computed(() => {
  const first = props.steps[0]?.value ?? 1
  return props.steps.map((s, i) => ({
    ...s,
    width: Math.max(8, (100 * s.value) / first),
    rate: i > 0 ? (100 * s.value) / props.steps[i - 1]!.value : null,
  }))
})
const nb = (v: number) => v.toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ')
const pct = (v: number) => v.toFixed(1).replace('.', ',') + ' %'
</script>

<template>
  <ol class="space-y-1.5" aria-label="Entonnoir de conversion">
    <li v-for="(r, i) in rows" :key="r.label">
      <p v-if="r.rate !== null" class="flex items-center justify-center gap-1 py-0.5 text-center text-xs" :class="highlight === i - 1 ? 'font-semibold text-rose-300' : 'text-slate-400'">
        <ArrowDown class="h-3.5 w-3.5" aria-hidden="true" /> {{ pct(r.rate) }} passent à l’étape suivante
      </p>
      <div class="flex items-center gap-3">
        <span class="w-28 shrink-0 text-right text-xs text-slate-300 sm:w-36 sm:text-sm">{{ r.label }}</span>
        <div class="flex flex-1 justify-center">
          <div
            class="flex h-9 items-center justify-center rounded-md text-sm font-bold text-slate-950"
            :class="highlight === i - 1 ? 'bg-rose-400' : 'bg-teal-400'"
            :style="{ width: r.width + '%' }"
          >
            <span v-if="r.width > 22">{{ nb(r.value) }}</span>
          </div>
          <span v-if="r.width <= 22" class="ml-2 self-center text-sm font-bold text-slate-100">{{ nb(r.value) }}</span>
        </div>
      </div>
    </li>
  </ol>
</template>
