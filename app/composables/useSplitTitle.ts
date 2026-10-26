// ============================================================
// useSplitTitle — découpe un titre en caractères/mots via SplitType
// puis anime l'entrée avec GSAP (effet cinématique gaming : montée
// en cascade depuis le bas avec léger flou/opacité).
//
// Usage dans un composant :
//   const titleRef = ref<HTMLElement | null>(null)
//   const { play, cleanup } = useSplitTitle(titleRef)
//   onMounted(() => play())
//   onUnmounted(() => cleanup())
// ============================================================
import SplitType from 'split-type'
import { gsap } from 'gsap'
import type { Ref } from 'vue'

interface SplitTitleOptions {
  /** 'chars' pour un effet lettre par lettre, 'words' pour mot par mot. */
  types?: 'chars' | 'words'
  stagger?: number
  duration?: number
  delay?: number
}

export function useSplitTitle(target: Ref<HTMLElement | null>, options: SplitTitleOptions = {}) {
  const { types = 'chars', stagger = 0.025, duration = 0.7, delay = 0 } = options

  let splitter: SplitType | null = null
  let tween: gsap.core.Tween | null = null

  function play() {
    if (!import.meta.client || !target.value) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    splitter = new SplitType(target.value, { types })
    const units = types === 'chars' ? splitter.chars : splitter.words
    if (!units || units.length === 0) return

    if (reduceMotion) {
      gsap.set(units, { opacity: 1, y: 0 })
      return
    }

    gsap.set(units, { opacity: 0, y: '60%', willChange: 'transform, opacity' })

    tween = gsap.to(units, {
      opacity: 1,
      y: '0%',
      duration,
      delay,
      stagger,
      ease: 'power3.out',
      onComplete: () => {
        // Une fois l'animation terminée, on retire will-change pour
        // ne pas garder une charge GPU inutile en continu.
        gsap.set(units, { willChange: 'auto' })
      },
    })
  }

  function cleanup() {
    tween?.kill()
    tween = null
    // .revert() restaure le DOM original (retire les <span> injectés)
    splitter?.revert()
    splitter = null
  }

  return { play, cleanup }
}
