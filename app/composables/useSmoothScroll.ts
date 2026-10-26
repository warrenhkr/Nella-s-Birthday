// ============================================================
// useSmoothScroll — Lenis pour un smooth scroll fluide.
//
// Usage dans une page/layout :
//   const { destroy } = useSmoothScroll()
//   onUnmounted(() => destroy())
// (le composable ne s'auto-détruit pas : c'est à l'appelant de
// décider de la portée — généralement app.vue ou default.vue layout).
// ============================================================
import Lenis from '@studio-freight/lenis'

let lenisInstance: Lenis | null = null
let animationFrameId: number | null = null

export function useSmoothScroll() {
  function init() {
    if (!import.meta.client || lenisInstance) return lenisInstance

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) return null

    lenisInstance = new Lenis({
      duration: 1.1,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.2
    })

    const raf = (time: number) => {
      lenisInstance?.raf(time)
      animationFrameId = window.requestAnimationFrame(raf)
    }
    animationFrameId = window.requestAnimationFrame(raf)

    return lenisInstance
  }

  function destroy() {
    if (animationFrameId !== null) {
      window.cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    lenisInstance?.destroy()
    lenisInstance = null
  }

  function scrollTo(target: string | number | HTMLElement, options?: Parameters<Lenis['scrollTo']>[1]) {
    lenisInstance?.scrollTo(target, options)
  }

  return { init, destroy, scrollTo }
}
