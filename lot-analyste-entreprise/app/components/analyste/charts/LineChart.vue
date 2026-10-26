<script setup lang="ts">
import { computed } from 'vue'
import { compact, niceTicks, scale } from '../../../utils/analyste/charts'

/**
 * Courbes SVG adaptatives. Les x sont des positions numériques (`xs`) ou, à défaut, les indices 0, 1, 2…
 * `markers` : points isolés (une estimation du joueur, par exemple). `cursorX` : repère vertical.
 */
export interface LineSeries {
  name: string
  values: (number | null)[]
  color: string
  dashed?: boolean
}
export interface Marker {
  x: number
  y: number
  color: string
  label?: string
}

const props = withDefaults(
  defineProps<{
    series: LineSeries[]
    xs?: number[]
    labels?: string[]
    height?: number
    yMin?: number
    yMax?: number
    markers?: Marker[]
    cursorX?: number
    label: string
    xLabelEvery?: number
  }>(),
  { xs: undefined, labels: undefined, height: 220, yMin: undefined, yMax: undefined, markers: () => [], cursorX: undefined, xLabelEvery: 1 },
)

const W = 600
const L = 52
const R = 14
const T = 12
const B = 30

const xValues = computed(() => props.xs ?? (props.series[0]?.values ?? []).map((_, i) => i))
const bounds = computed(() => {
  const all = props.series.flatMap((s) => s.values.filter((v): v is number => v !== null)).concat(props.markers.map((m) => m.y))
  const lo = props.yMin ?? Math.min(...all)
  const hi = props.yMax ?? Math.max(...all)
  const ticks = niceTicks(lo, hi, 4)
  return { lo: props.yMin ?? ticks[0]!, hi: props.yMax ?? ticks[ticks.length - 1]!, ticks }
})
const xMin = computed(() => Math.min(...xValues.value, ...props.markers.map((m) => m.x)))
const xMax = computed(() => Math.max(...xValues.value, ...props.markers.map((m) => m.x)))
const px = (x: number) => scale(x, xMin.value, xMax.value, L, W - R)
const py = (y: number) => scale(y, bounds.value.lo, bounds.value.hi, props.height - B, T)
const paths = computed(() =>
  props.series.map((s) => {
    let d = ''
    let pen = false
    s.values.forEach((v, i) => {
      if (v === null) {
        pen = false
        return
      }
      d += (pen ? 'L' : 'M') + px(xValues.value[i]!).toFixed(1) + ' ' + py(v).toFixed(1)
      pen = true
    })
    return d
  }),
)
const xTicks = computed(() => {
  if (props.labels) return xValues.value.map((x, i) => ({ x, label: props.labels![i] ?? '' })).filter((_, i) => i % props.xLabelEvery === 0)
  return niceTicks(xMin.value, xMax.value, 5).filter((t) => t >= xMin.value && t <= xMax.value).map((t) => ({ x: t, label: compact(t) }))
})
</script>

<template>
  <figure class="w-full">
    <svg :viewBox="'0 0 ' + W + ' ' + height" class="block h-auto w-full" role="img" :aria-label="label">
      <g v-for="t in bounds.ticks" :key="t">
        <line :x1="L" :x2="W - R" :y1="py(t)" :y2="py(t)" class="stroke-slate-700/70" stroke-width="1" />
        <text :x="L - 6" :y="py(t)" text-anchor="end" dominant-baseline="middle" class="fill-slate-400 text-[11px]">{{ compact(t) }}</text>
      </g>
      <line :x1="L" :x2="W - R" :y1="height - B" :y2="height - B" class="stroke-slate-500" stroke-width="1.5" />
      <text v-for="t in xTicks" :key="'x' + t.x" :x="px(t.x)" :y="height - B + 16" text-anchor="middle" class="fill-slate-400 text-[11px]">{{ t.label }}</text>
      <line v-if="cursorX !== undefined" :x1="px(cursorX)" :x2="px(cursorX)" :y1="T" :y2="height - B" class="stroke-amber-300" stroke-width="1.5" stroke-dasharray="5 4" />
      <path v-for="(d, i) in paths" :key="series[i]!.name" :d="d" fill="none" :stroke="series[i]!.color" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" :stroke-dasharray="series[i]!.dashed ? '6 5' : undefined" />
      <g v-for="m in markers" :key="m.x + '-' + m.y">
        <circle :cx="px(m.x)" :cy="py(m.y)" r="6" :fill="m.color" class="stroke-slate-950" stroke-width="2" />
        <text v-if="m.label" :x="px(m.x)" :y="py(m.y) - 12" text-anchor="middle" class="fill-slate-100 text-[11px] font-semibold">{{ m.label }}</text>
      </g>
    </svg>
    <figcaption v-if="series.length > 1" class="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-slate-300">
      <span v-for="s in series" :key="s.name" class="inline-flex items-center gap-1.5">
        <span class="inline-block h-0.5 w-5" :style="{ backgroundColor: s.color }" aria-hidden="true" />{{ s.name }}
      </span>
    </figcaption>
  </figure>
</template>
