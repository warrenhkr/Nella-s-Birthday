<script setup lang="ts">
const props = withDefaults(defineProps<{
  value: number
  duration?: number
  decimals?: number
  suffix?: string
}>(), {
  duration: 1200,
  decimals: 0,
  suffix: ''
})

const displayValue = ref(0)
const elementRef = ref<HTMLElement | null>(null)
let animationFrameId: number | undefined
let observer: IntersectionObserver | undefined

function animateCount() {
  const start = performance.now()

  function tick(now: number) {
    const progress = Math.min((now - start) / props.duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)

    displayValue.value = props.value * eased

    if (progress < 1) {
      animationFrameId = requestAnimationFrame(tick)
    } else {
      displayValue.value = props.value
    }
  }

  animationFrameId = requestAnimationFrame(tick)
}

onMounted(() => {
  if (!elementRef.value) return

  observer = new IntersectionObserver(([entry]) => {
    if (entry?.isIntersecting) {
      animateCount()
      observer?.disconnect()
    }
  }, { threshold: 0.3 })

  observer.observe(elementRef.value)
})

onUnmounted(() => {
  observer?.disconnect()
  if (animationFrameId !== undefined) cancelAnimationFrame(animationFrameId)
})
</script>

<template>
  <span ref="elementRef">{{ displayValue.toFixed(decimals) }}{{ suffix }}</span>
</template>
