<script setup lang="ts">
import { computed } from 'vue'
import { compact, niceTicks, scale } from '../../../utils/analyste/charts'

/** Barres empilées (une couleur par canal, par exemple) avec légende. */
const props = withDefaults(
  defineProps<{ labels: string[]; stacks: { name: string; color: string; values: number[] }[]; height?: number; label: string }>(),
  { height: 240 },
)

const W = 600
const L = 52
const R = 12
const T = 12
const B = 28

const totals = computed(() => props.labels.map((_, i) => props.stacks.reduce((s, st) => s + st.values[i]!, 0)))
const ticks = computed(() => niceTicks(0, Math.max(...totals.value), 4))
const top = computed(() => ticks.value[ticks.value.length - 1]!)
const slot = computed(() => (W - L - R) / props.labels.length)
const py = (v: number) => scale(v, 0, top.value, props.height - B, T)
const segments = computed(() =>
  props.labels.map((_, i) => {
    let acc = 0
    return props.stacks.map((st) => {
      const y0 = acc
      acc += st.values[i]!
      return { y: py(acc), h: py(y0) - py(acc), color: st.color, name: st.name, v: st.values[i]! }
    })
  }),
)
</script>

<template>
  <figure class="w-full">
    <svg :viewBox="'0 0 ' + W + ' ' + height" class="block h-auto w-full" role="img" :aria-label="label">
      <g v-for="t in ticks" :key="t">
        <line :x1="L" :x2="W - R" :y1="py(t)" :y2="py(t)" class="stroke-slate-700/70" stroke-width="1" />
        <text :x="L - 6" :y="py(t)" text-anchor="end" dominant-baseline="middle" class="fill-slate-400 text-[11px]">{{ compact(t) }}</text>
      </g>
      <line :x1="L" :x2="W - R" :y1="height - B" :y2="height - B" class="stroke-slate-500" stroke-width="1.5" />
      <g v-for="(seg, i) in segments" :key="i">
        <rect v-for="s in seg" :key="s.name" :x="L + i * slot + slot * 0.12" :y="s.y" :width="slot * 0.76" :height="Math.max(0, s.h)" :fill="s.color">
          <title>{{ labels[i] }} · {{ s.name }} : {{ Math.round(s.v).toLocaleString('fr-FR') }} €</title>
        </rect>
        <text :x="L + (i + 0.5) * slot" :y="height - B + 15" text-anchor="middle" class="fill-slate-400 text-[10px]">{{ labels[i] }}</text>
      </g>
    </svg>
    <figcaption class="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-slate-300">
      <span v-for="s in stacks" :key="s.name" class="inline-flex items-center gap-1.5">
        <span class="inline-block h-3 w-3 rounded-sm" :style="{ backgroundColor: s.color }" aria-hidden="true" />{{ s.name }}
      </span>
    </figcaption>
  </figure>
</template>
