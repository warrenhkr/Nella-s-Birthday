<script setup lang="ts">
import { computed } from 'vue'
import { compact, niceTicks, scale } from '../../../utils/analyste/charts'

/**
 * Barres SVG. Option Pareto : `cumulative` (cumul en %) trace une courbe sur un axe de 0 à 100 %,
 * `threshold` ajoute un trait de seuil. `highlight` colore certaines barres.
 */
const props = withDefaults(
  defineProps<{
    labels: string[]
    values: number[]
    highlight?: number[]
    cumulative?: number[]
    threshold?: number
    height?: number
    label: string
    barColor?: string
    highlightColor?: string
  }>(),
  { highlight: () => [], cumulative: undefined, threshold: undefined, height: 240, barColor: 'var(--theme-muted-text)', highlightColor: 'var(--primary-color)' },
)

const W = 600
const L = 48
const R = 40
const T = 14
const B = 52

const ticks = computed(() => niceTicks(0, Math.max(...props.values, 1), 4))
const top = computed(() => ticks.value[ticks.value.length - 1]!)
const slot = computed(() => (W - L - R) / Math.max(1, props.values.length))
const py = (v: number) => scale(v, 0, top.value, props.height - B, T)
const pyPct = (v: number) => scale(v, 0, 100, props.height - B, T)
const curve = computed(() =>
  props.cumulative ? props.cumulative.map((v, i) => (i ? 'L' : 'M') + (L + (i + 0.5) * slot.value).toFixed(1) + ' ' + pyPct(v).toFixed(1)).join('') : '',
)
const wrap = (s: string) => {
  const words = s.split(' ')
  const lines: string[] = ['']
  for (const w of words) {
    const last = lines.length - 1
    if ((lines[last] + ' ' + w).trim().length > 11 && lines[last]) lines.push(w)
    else lines[last] = (lines[last] + ' ' + w).trim()
  }
  return lines.slice(0, 3)
}
</script>

<template>
  <figure class="w-full">
    <svg :viewBox="'0 0 ' + W + ' ' + height" class="block h-auto w-full" role="img" :aria-label="label">
      <g v-for="t in ticks" :key="t">
        <line :x1="L" :x2="W - R" :y1="py(t)" :y2="py(t)" class="stroke-slate-700/70" stroke-width="1" />
        <text :x="L - 6" :y="py(t)" text-anchor="end" dominant-baseline="middle" class="fill-slate-400 text-[11px]">{{ compact(t) }}</text>
      </g>
      <line :x1="L" :x2="W - R" :y1="height - B" :y2="height - B" class="stroke-slate-500" stroke-width="1.5" />
      <g v-for="(v, i) in values" :key="i">
        <rect :x="L + i * slot + slot * 0.14" :y="py(v)" :width="slot * 0.72" :height="Math.max(0, height - B - py(v))" rx="3" :fill="highlight.includes(i) ? highlightColor : barColor" />
        <text :x="L + (i + 0.5) * slot" :y="py(v) - 5" text-anchor="middle" class="fill-slate-200 text-[11px] font-semibold">{{ compact(v) }}</text>
        <text v-for="(line, k) in wrap(labels[i] ?? '')" :key="k" :x="L + (i + 0.5) * slot" :y="height - B + 14 + k * 12" text-anchor="middle" class="fill-slate-400 text-[10px]">{{ line }}</text>
      </g>
      <template v-if="cumulative">
        <path :d="curve" fill="none" stroke="var(--accent-color)" stroke-width="2.5" stroke-linejoin="round" />
        <circle v-for="(v, i) in cumulative" :key="'c' + i" :cx="L + (i + 0.5) * slot" :cy="pyPct(v)" r="3.5" fill="var(--accent-color)" />
        <text v-for="p in [0, 50, 100]" :key="'p' + p" :x="W - R + 6" :y="pyPct(p)" dominant-baseline="middle" class="fill-amber-300 text-[11px]">{{ p }} %</text>
      </template>
      <g v-if="threshold !== undefined">
        <line :x1="L" :x2="W - R" :y1="pyPct(threshold)" :y2="pyPct(threshold)" stroke="var(--primary-color)" stroke-width="1.5" stroke-dasharray="6 4" />
        <text :x="W - R + 6" :y="pyPct(threshold)" dominant-baseline="middle" class="fill-rose-300 text-[11px]">{{ threshold }} %</text>
      </g>
    </svg>
  </figure>
</template>
