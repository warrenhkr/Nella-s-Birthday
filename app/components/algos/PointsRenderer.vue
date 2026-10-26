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

function draw() {
  const element = canvas.value
  if (!element) return

  const payload = props.result ?? {}
  const frame = keyframes.value[activeFrame.value] as Record<string, unknown> | undefined
  const points = Array.isArray(frame?.points) ? frame.points : Array.isArray(payload.points) ? payload.points : []
  const links = Array.isArray(frame?.links) ? frame.links : Array.isArray(payload.links) ? payload.links : []
  const palette = Array.isArray(payload.palette) && payload.palette.length
    ? payload.palette as string[]
    : ['#ff6ea8', '#ffd1dc', '#ffffff']

  const width = Number(payload.width || 640)
  const height = Number(payload.height || 640)

  const ratio = window.devicePixelRatio || 1
  const availableWidth = element.parentElement?.clientWidth || width
  const availableHeight = Math.min(360, window.innerHeight * 0.55)
  const scale = Math.min(availableWidth / width, availableHeight / height)
  const displayWidth = width * scale
  const displayHeight = height * scale
  element.width = Math.round(displayWidth * ratio)
  element.height = Math.round(displayHeight * ratio)
  element.style.width = `${displayWidth}px`
  element.style.height = `${displayHeight}px`

  const context = element.getContext('2d')
  if (!context) return

  context.setTransform(ratio * scale, 0, 0, ratio * scale, 0, 0)
  context.clearRect(0, 0, width, height)
  context.fillStyle = '#120b1d'
  context.fillRect(0, 0, width, height)

  context.globalAlpha = Number(frame?.link_alpha ?? payload.link_alpha ?? 0.35)
  context.strokeStyle = String(palette[0] ?? '#ff6ea8')
  context.lineWidth = 1.2
  for (const link of links) {
    if (!Array.isArray(link) || link.length < 2) continue
    const from = points[Number(link[0])] as Record<string, unknown> | undefined
    const to = points[Number(link[1])] as Record<string, unknown> | undefined
    if (!from || !to) continue
    context.beginPath()
    context.moveTo(Number(from.x ?? 0), Number(from.y ?? 0))
    context.lineTo(Number(to.x ?? 0), Number(to.y ?? 0))
    context.stroke()
  }

  for (const point of points) {
    const pointRecord = point as Record<string, unknown>
    const x = Number(pointRecord.x ?? 0)
    const y = Number(pointRecord.y ?? 0)
    const radius = Number(pointRecord.r ?? 2)
    const alpha = Number(pointRecord.alpha ?? 1)
    const color = String(pointRecord.color ?? palette[0] ?? '#ff6ea8')

    context.beginPath()
    context.fillStyle = color
    context.globalAlpha = alpha
    context.arc(x, y, radius, 0, Math.PI * 2)
    context.fill()
  }

  context.globalAlpha = 1
}

function syncAnimation(resetFrame = false) {
  if (timer) clearInterval(timer)
  timer = null
  if (resetFrame) activeFrame.value = 0
  const fps = Math.max(1, Number(props.result?.fps ?? 12) * Number(props.playbackSpeed ?? 1))
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
  <div class="flex min-h-[360px] w-full min-w-0 items-center justify-center overflow-hidden rounded-[24px] bg-[#120b1d] shadow-[0_0_32px_rgba(255,110,168,0.12)]">
    <canvas ref="canvas" class="block max-h-full max-w-full" />
  </div>
</template>
