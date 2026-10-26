<script setup lang="ts">
import GridRenderer from './GridRenderer.vue'

const props = defineProps<{
  result?: Record<string, unknown> | null
  playing?: boolean
  replayToken?: number
  playbackSpeed?: number
}>()

const frames = computed(() => {
  const payload = props.result ?? {}
  const candidates = Array.isArray(payload.frames) ? payload.frames : []
  return candidates.length ? candidates : [payload]
})

const activeFrame = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

const frame = computed(() => {
  const current = frames.value[activeFrame.value] ?? {}

  if (typeof current === 'string') {
    return props.result?.encoding === 'png_base64' ? { image: current } : { text: current }
  }

  return current as Record<string, unknown>
})

const imageSource = computed(() => {
  const source = typeof frame.value.image === 'string' ? frame.value.image
    : typeof frame.value.data === 'string' ? frame.value.data : ''
  return source || ''
})

const isGridFrame = computed(() => props.result?.encoding === 'grid')
const gridFrame = computed(() => ({
  ...props.result,
  cells: Array.isArray(frame.value) ? frame.value : frame.value.cells ?? frame.value.grid ?? [],
  keyframes: undefined,
  frames: undefined
}))

const lines = computed(() => {
  const list = Array.isArray(frame.value.lines) ? frame.value.lines : []
  return list.length ? list.map((line) => String(line)) : []
})

function syncAnimation(resetFrame = false) {
  if (timer) clearInterval(timer)
  timer = null
  if (resetFrame) activeFrame.value = 0
  if (!props.playing || frames.value.length <= 1) return
  const fps = Math.max(1, Number(props.result?.fps ?? 12) * Number(props.playbackSpeed ?? 1))
  timer = setInterval(() => {
    if (props.result?.loop === false && activeFrame.value >= frames.value.length - 1) {
      if (timer) clearInterval(timer)
      timer = null
      return
    }
    activeFrame.value = (activeFrame.value + 1) % frames.value.length
  }, 1000 / fps)
}

watch(
  () => [props.result, props.playing, props.replayToken, props.playbackSpeed] as const,
  (values, previousValues) => {
    const resetFrame = !previousValues || values[0] !== previousValues[0] || values[2] !== previousValues[2]
    syncAnimation(resetFrame)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
})
</script>

<template>
  <div class="flex min-h-[360px] w-full min-w-0 flex-col items-center justify-center overflow-hidden rounded-[24px] bg-[#120b1d] p-4 shadow-[0_0_32px_rgba(255,110,168,0.12)]">
    <GridRenderer v-if="isGridFrame" :result="gridFrame" />

    <div v-else-if="imageSource" class="w-full">
      <img :src="imageSource" alt="Frame animée" class="mx-auto max-h-[320px] w-full rounded-2xl object-contain" />
    </div>

    <div v-else-if="lines.length" class="w-full space-y-2 text-center text-pink-100">
      <div v-for="line in lines" :key="line" class="font-mono text-lg tracking-[0.2em] sm:text-xl">
        {{ line }}
      </div>
    </div>

    <div v-else class="flex h-[280px] w-full items-center justify-center rounded-2xl border border-dashed border-pink-200/25 text-sm uppercase tracking-[0.22em] text-pink-100/70">
      Frame animée
    </div>

    <div v-if="frames.length > 1" class="mt-4 w-full max-w-xs">
      <div class="mb-2 flex items-center justify-between gap-3 text-xs text-pink-100/65">
        <span>Progression</span>
        <span>{{ activeFrame + 1 }} / {{ frames.length }}</span>
      </div>
      <div
        class="h-1.5 w-full overflow-hidden rounded-full bg-pink-100/15"
        role="progressbar"
        :aria-valuenow="activeFrame + 1"
        :aria-valuemin="1"
        :aria-valuemax="frames.length"
        :aria-label="`Image ${activeFrame + 1} sur ${frames.length}`"
      >
        <div
          class="h-full rounded-full bg-pink-300 transition-[width] duration-150"
          :style="{ width: `${((activeFrame + 1) / frames.length) * 100}%` }"
        />
      </div>
    </div>
  </div>
</template>
