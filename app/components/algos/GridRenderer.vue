<script setup lang="ts">
const props = defineProps<{
  result?: Record<string, unknown> | null
  playing?: boolean
  replayToken?: number
  playbackSpeed?: number
}>()
const canvas = ref<HTMLCanvasElement | null>(null)
const activeFrame = ref(0)
let timer: ReturnType<typeof setInterval> | null = null
let resizeObserver: ResizeObserver | null = null

const keyframes = computed(() => {
  const candidates = props.result?.keyframes
  return Array.isArray(candidates) ? candidates : []
})
const rowLabels = computed(() => Array.isArray(props.result?.row_labels) ? props.result.row_labels.map(String) : [])
const columnLabels = computed(() => Array.isArray(props.result?.col_labels) ? props.result.col_labels.map(String) : [])
const averageByPeriod = computed(() => Array.isArray(props.result?.average_by_period) ? props.result.average_by_period.map(Number) : [])

function draw() {
  const element = canvas.value
  if (!element) return

  const payload = props.result ?? {}
  const frame = keyframes.value[activeFrame.value]
  const grid = Array.isArray(frame) ? frame
    : Array.isArray(payload.cells) ? payload.cells
      : Array.isArray(payload.grid) ? payload.grid : []
  const mask = Array.isArray(payload.mask) ? payload.mask : []
  const palette = Array.isArray(payload.palette) && payload.palette.length
    ? payload.palette as string[]
    : ['#120b1d', '#ff6ea8', '#ffd1dc', '#ffffff']

  const columns = Number(payload.cols || payload.width || grid[0]?.length || 32)
  const rows = Number(payload.rows || payload.height || grid.length || 32)
  const ratio = window.devicePixelRatio || 1
  const availableWidth = element.parentElement?.clientWidth || 560
  const availableHeight = Math.min(360, window.innerHeight * 0.55)
  const scale = Math.min(availableWidth / columns, availableHeight / rows)
  const displayWidth = columns * scale
  const displayHeight = rows * scale
  element.width = Math.round(displayWidth * ratio)
  element.height = Math.round(displayHeight * ratio)
  element.style.width = `${displayWidth}px`
  element.style.height = `${displayHeight}px`

  const context = element.getContext('2d')
  if (!context) return

  context.setTransform(ratio * scale, 0, 0, ratio * scale, 0, 0)
  context.fillStyle = '#120b1d'
  context.fillRect(0, 0, columns, rows)
  const maxLevel = Math.max(1, Number(payload.levels ?? palette.length - 1))

  const mixColor = (from: string, to: string, amount: number) => {
    const first = from.replace('#', '').match(/.{2}/g)?.map((part) => parseInt(part, 16)) ?? [18, 11, 29]
    const second = to.replace('#', '').match(/.{2}/g)?.map((part) => parseInt(part, 16)) ?? [255, 110, 168]
    return `rgb(${first.map((channel, index) => Math.round(channel + ((second[index] ?? channel) - channel) * amount)).join(',')})`
  }

  for (let row = 0; row < grid.length; row++) {
    const line = grid[row]
    if (!Array.isArray(line)) continue

    for (let column = 0; column < line.length; column++) {
      const value = Number(line[column])
      if (Array.isArray(mask[row]) && !mask[row][column]) continue
      if (!Number.isFinite(value) || value <= 0) continue
      const palettePosition = Math.max(0, Math.min(palette.length - 1, (value / maxLevel) * (palette.length - 1)))
      const paletteIndex = Math.min(palette.length - 2, Math.floor(palettePosition))
      const color = palette.length === 1
        ? palette[0] ?? '#ff6ea8'
        : mixColor(palette[paletteIndex] ?? palette[0] ?? '#120b1d', palette[paletteIndex + 1] ?? palette[palette.length - 1] ?? '#ff6ea8', palettePosition - paletteIndex)

      context.fillStyle = color
      context.fillRect(column, row, 0.92, 0.92)
    }
  }
}

function syncAnimation(resetFrame = false) {
  if (timer) clearInterval(timer)
  timer = null
  if (resetFrame) activeFrame.value = 0
  const fps = Math.max(1, Number(props.result?.fps ?? 10) * Number(props.playbackSpeed ?? 1))
  if (props.playing && keyframes.value.length > 1) {
    timer = setInterval(() => {
      const looping = props.result?.loop !== false
      if (!looping && activeFrame.value >= keyframes.value.length - 1) {
        if (timer) clearInterval(timer)
        timer = null
        return
      }
      activeFrame.value = (activeFrame.value + 1) % keyframes.value.length
    }, 1000 / fps)
  }
  nextTick(draw)
}

watch(
  () => [props.result, props.playing, props.replayToken, props.playbackSpeed] as const,
  (values, previousValues) => {
    const resetFrame = !previousValues || values[0] !== previousValues[0] || values[2] !== previousValues[2]
    syncAnimation(resetFrame)
  },
  { immediate: true }
)
watch(activeFrame, () => nextTick(draw))

onMounted(() => {
  if (canvas.value?.parentElement) {
    resizeObserver = new ResizeObserver(() => draw())
    resizeObserver.observe(canvas.value.parentElement)
  }
  nextTick(draw)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  resizeObserver?.disconnect()
})
</script>

<template>
  <div class="flex min-h-[360px] w-full min-w-0 flex-col items-center justify-center overflow-hidden rounded-[24px] bg-[#120b1d] p-3 shadow-[0_0_32px_rgba(255,110,168,0.12)]">
    <div v-if="columnLabels.length" class="mb-2 flex w-full flex-wrap justify-center gap-x-2 gap-y-1 text-[10px] text-pink-100/65" aria-label="Périodes">
      <span v-for="label in columnLabels" :key="label">{{ label }}</span>
    </div>
    <canvas ref="canvas" class="block max-h-full max-w-full" />
    <div v-if="rowLabels.length" class="mt-2 flex w-full flex-wrap justify-center gap-x-2 gap-y-1 text-[10px] text-pink-100/65" aria-label="Cohortes">
      <span v-for="label in rowLabels" :key="label">{{ label }}</span>
    </div>
    <p v-if="averageByPeriod.length" class="mt-2 text-center text-xs text-pink-100/75">
      Rétention moyenne par période : {{ averageByPeriod.map(value => `${value} %`).join(' · ') }}
    </p>
  </div>
</template>
