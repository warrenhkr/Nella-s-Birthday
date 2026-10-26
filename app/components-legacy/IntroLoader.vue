<script setup lang="ts">
import { gsap } from 'gsap'

const emit = defineEmits<{
  complete: []
}>()

const root = ref<HTMLElement | null>(null)
const grid = ref<HTMLElement | null>(null)
const slash = ref<HTMLElement | null>(null)
const scanline = ref<HTMLElement | null>(null)
const mark = ref<HTMLElement | null>(null)
const eyebrow = ref<HTMLElement | null>(null)
const title = ref<HTMLElement | null>(null)
const status = ref<HTMLElement | null>(null)
const barTrack = ref<HTMLElement | null>(null)
const barFill = ref<HTMLElement | null>(null)

let ctx: gsap.Context | null = null
let completionTimer: number | null = null
let hasCompleted = false

function complete() {
  if (hasCompleted) return
  hasCompleted = true
  emit('complete')
}

onMounted(() => {
  if (
    !root.value || !grid.value || !slash.value || !scanline.value
    || !mark.value || !eyebrow.value || !title.value || !status.value
    || !barTrack.value || !barFill.value
  ) {
    complete()
    return
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (reduceMotion) {
    // On respecte la préférence : pas d'animation, sortie quasi immédiate
    // mais on laisse un micro-délai pour éviter un flash brutal.
    completionTimer = window.setTimeout(complete, 120)
    return
  }

  // Keep the app from being blocked if a browser pauses a GSAP ticker while
  // the tab is starting or restoring from the back-forward cache.
  completionTimer = window.setTimeout(complete, 2800)

  // gsap.context() isole tous les tweens créés à l'intérieur : un seul
  // ctx.revert() dans onUnmounted suffit à tout nettoyer proprement,
  // même si le composant est démonté en plein milieu de l'animation.
  ctx = gsap.context(() => {
    const tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      onComplete: complete
    })

    tl
      // état initial
      .set(grid.value, { opacity: 0 })
      .set(slash.value, { opacity: 0, scaleY: 0, transformOrigin: 'top center' })
      .set(mark.value, { opacity: 0, scale: 0.6, rotate: -8 })
      .set([eyebrow.value, title.value, status.value], { opacity: 0, y: 16 })
      .set(barTrack.value, { opacity: 0 })
      .set(barFill.value, { scaleX: 0 })
      .set(scanline.value, { opacity: 0, y: 0, top: '0%' })

      // 0.0s → 0.4s : la grille technique s'installe, le slash traverse l'écran
      .to(grid.value, { opacity: 0.5, duration: 0.4 }, 0)
      .to(slash.value, { opacity: 1, scaleY: 1, duration: 0.5, ease: 'power4.out' }, 0.05)

      // 0.3s → 0.75s : le logo "O" apparaît avec un léger overshoot
      .to(mark.value, { opacity: 1, scale: 1, rotate: 0, duration: 0.45, ease: 'back.out(2.2)' }, 0.3)

      // 0.55s → 1.05s : eyebrow puis titre puis statut, en cascade
      .to(eyebrow.value, { opacity: 1, y: 0, duration: 0.3 }, 0.55)
      .to(title.value, { opacity: 1, y: 0, duration: 0.4 }, 0.68)
      .to(status.value, { opacity: 1, y: 0, duration: 0.3 }, 0.85)

      // 1.0s → 1.6s : barre de progression qui se remplit + ligne de scan qui balaye
      .to(barTrack.value, { opacity: 1, duration: 0.2 }, 1.0)
      .to(barFill.value, { scaleX: 1, duration: 0.55, ease: 'power2.inOut' }, 1.05)
      .fromTo(
        scanline.value,
        { opacity: 0.9, top: '15%' },
        { opacity: 0.9, top: '85%', duration: 0.6, ease: 'power1.inOut' },
        1.05
      )

      // 1.75s → 2.15s : tout se dissipe ensemble (sortie nette)
      .to(
        [eyebrow.value, title.value, status.value, barTrack.value, mark.value, scanline.value],
        { opacity: 0, y: -10, duration: 0.28, stagger: 0.02 },
        1.75
      )
      .to(slash.value, { opacity: 0, duration: 0.22 }, 1.78)
      .to(grid.value, { opacity: 0, duration: 0.3 }, 1.8)
      // 2.1s → 2.35s : fondu final de l'overlay entier
      .to(root.value, { opacity: 0, duration: 0.25, pointerEvents: 'none' }, 2.1)
  }, root.value)
})

onUnmounted(() => {
  // Un seul appel nettoie la timeline, tous les tweens et les listeners
  // internes créés par gsap.context() — pas de fuite mémoire possible.
  ctx?.revert()
  ctx = null
  if (completionTimer) {
    window.clearTimeout(completionTimer)
    completionTimer = null
  }
})
</script>

<template>
  <div
    ref="root"
    class="intro-loader"
    role="status"
    aria-label="Chargement du Club Otaku ENEAM"
  >
    <div
      ref="grid"
      class="intro-loader__grid"
      aria-hidden="true"
    />
    <div
      ref="slash"
      class="intro-loader__slash"
      aria-hidden="true"
    />
    <div
      ref="scanline"
      class="intro-loader__scanline"
      aria-hidden="true"
    />

    <div class="relative z-10 px-6 text-center">
      <div
        ref="mark"
        class="intro-loader__mark"
        aria-hidden="true"
      >
        O
      </div>

      <p
        ref="eyebrow"
        class="intro-loader__eyebrow"
      >
        Otaku Club // ENEAM
      </p>
      <h1
        ref="title"
        class="intro-loader__title"
      >
        CLUB <span>OTAKU</span>
      </h1>
      <p
        ref="status"
        class="intro-loader__status"
      >
        ENEAM // SYSTEM ONLINE
      </p>

      <div
        ref="barTrack"
        class="intro-loader__bar-track"
        aria-hidden="true"
      >
        <div ref="barFill" class="intro-loader__bar-fill" />
      </div>
    </div>
  </div>
</template>
