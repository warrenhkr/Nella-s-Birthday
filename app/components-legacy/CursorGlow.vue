<script setup lang="ts">
import { useMouse, useWindowSize, useMediaQuery } from '@vueuse/core'

// Sur mobile/tactile il n'y a pas de curseur : on ne monte même pas
// les listeners de useMouse pour éviter tout coût inutile.
const isCoarsePointer = useMediaQuery('(pointer: coarse)')
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
const isEnabled = computed(() => !isCoarsePointer.value && !prefersReducedMotion.value)

const { x, y } = useMouse({ touch: false })
const { width, height } = useWindowSize()

const isVisible = computed(
  () => isEnabled.value && x.value > 0 && y.value > 0 && x.value < width.value && y.value < height.value,
)

const glowStyle = computed(() => ({
  transform: `translate3d(${x.value}px, ${y.value}px, 0) translate3d(-50%, -50%, 0)`,
  opacity: isVisible.value ? 1 : 0,
}))
</script>

<template>
  <div v-if="isEnabled" class="cursor-glow" :style="glowStyle" aria-hidden="true" />
</template>
