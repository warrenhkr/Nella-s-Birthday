<script setup lang="ts">
import { gsap } from 'gsap'

const props = withDefaults(defineProps<{
  tag?: string
  delay?: number
  distance?: number
  duration?: number
  once?: boolean
}>(), {
  tag: 'div',
  delay: 0,
  distance: 24,
  duration: 0.7,
  once: true
})

const root = ref<HTMLElement | null>(null)
let context: gsap.Context | null = null
let observer: IntersectionObserver | null = null

onMounted(() => {
  if (!root.value || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  observer = new IntersectionObserver(([entry]) => {
    if (!entry?.isIntersecting || !root.value) return

    context = gsap.context(() => {
      gsap.from(root.value, {
        autoAlpha: 0,
        y: props.distance,
        duration: props.duration,
        delay: props.delay,
        ease: 'power3.out',
        clearProps: 'transform,opacity,visibility'
      })
    }, root.value)

    if (props.once) observer?.disconnect()
  }, { threshold: 0.01, rootMargin: '0px 0px -12% 0px' })

  observer.observe(root.value)
})

onUnmounted(() => {
  observer?.disconnect()
  observer = null
  context?.revert()
  context = null
})
</script>

<template>
  <component :is="props.tag" ref="root">
    <slot />
  </component>
</template>
