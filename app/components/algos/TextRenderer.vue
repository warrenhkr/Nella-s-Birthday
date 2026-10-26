<script setup lang="ts">
const props = defineProps<{
  result?: Record<string, unknown> | null
  playing?: boolean
  replayToken?: number
  playbackSpeed?: number
}>()

const lines = computed(() => {
  const payload = props.result ?? {}
  const rawLines = Array.isArray(payload.lines) ? payload.lines : []
  return rawLines.map((line) => String(line))
})

const color = computed(() => typeof props.result?.color === 'string' ? props.result.color : '#fbcfe8')
const lineDelay = computed(() => Math.max(0, Number(props.result?.line_delay ?? 0)))
const visibleLineCount = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

function syncAnimation(reset = false) {
  if (timer) clearInterval(timer)
  timer = null

  if (reset) visibleLineCount.value = props.playing ? 0 : lines.value.length
  if (!props.playing || lines.value.length <= 1) return

  if (visibleLineCount.value === 0) visibleLineCount.value = 1
  timer = setInterval(() => {
    if (visibleLineCount.value >= lines.value.length) {
      if (timer) clearInterval(timer)
      timer = null
      return
    }
    visibleLineCount.value += 1
  }, Math.max(50, lineDelay.value || 280) / Math.max(0.1, Number(props.playbackSpeed ?? 1)))
}

watch(
  () => [props.result, props.playing, props.replayToken, props.playbackSpeed] as const,
  (values, previousValues) => {
    const reset = !previousValues || values[0] !== previousValues[0] || values[2] !== previousValues[2]
    syncAnimation(reset)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="flex min-h-[360px] items-center justify-center rounded-[24px] bg-[#120b1d] p-6 text-center shadow-[0_0_32px_rgba(255,110,168,0.12)]">
    <div class="max-w-full space-y-2 overflow-hidden font-mono" :style="{ color }">
      <div v-for="(line, index) in lines.slice(0, visibleLineCount)" :key="`${index}-${line}`" class="break-words text-sm sm:text-base">
        {{ line }}
      </div>
    </div>
  </div>
</template>
