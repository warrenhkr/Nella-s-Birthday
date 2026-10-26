import { onBeforeUnmount, ref } from 'vue'

/** Chronomètre réactif : `elapsed` (ms) se met à jour toutes les 100 ms entre start() et stop(). */
export function useStopwatch() {
  const elapsed = ref(0)
  let startedAt = 0
  let timer: ReturnType<typeof setInterval> | null = null

  function start() {
    stop()
    startedAt = performance.now()
    elapsed.value = 0
    timer = setInterval(() => {
      elapsed.value = performance.now() - startedAt
    }, 100)
  }

  /** Arrête le chrono et renvoie la durée finale en ms. */
  function stop(): number {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
      elapsed.value = performance.now() - startedAt
    }
    return elapsed.value
  }

  function reset() {
    stop()
    elapsed.value = 0
  }

  onBeforeUnmount(() => {
    if (timer !== null) clearInterval(timer)
  })

  return { elapsed, start, stop, reset }
}
