<script setup lang="ts">
const targetAngle = 132
const angle = ref(0)
const rounds = ref(0)
const points = ref(0)
const lastResult = ref('')
const gameOver = computed(() => rounds.value >= 5)
let orbitTimer: ReturnType<typeof setInterval> | undefined

function startOrbit() {
  if (orbitTimer) clearInterval(orbitTimer)
  orbitTimer = setInterval(() => {
    if (!gameOver.value) angle.value = (angle.value + 2.5) % 360
  }, 28)
}

function launchStar() {
  if (gameOver.value) return

  const rawDistance = Math.abs(angle.value - targetAngle)
  const distance = Math.min(rawDistance, 360 - rawDistance)
  const isLanding = distance <= 16

  rounds.value += 1
  if (isLanding) points.value += 1
  lastResult.value = isLanding ? 'Dans l’orbite !' : 'Un peu à côté…'

  if (rounds.value >= 5 && orbitTimer) clearInterval(orbitTimer)
}

function restartGame() {
  rounds.value = 0
  points.value = 0
  lastResult.value = ''
  angle.value = 0
  startOrbit()
}

onMounted(startOrbit)
onBeforeUnmount(() => {
  if (orbitTimer) clearInterval(orbitTimer)
})
</script>

<template>
  <section class="orbit-game">
    <header class="orbit-toolbar">
      <div>
        <p class="orbit-eyebrow">
          Défi de précision
        </p>
        <h2>Vise l’orbite</h2>
      </div>
      <div class="orbit-score">
        <strong>{{ points }}</strong><span>/ 5</span>
      </div>
    </header>

    <div
      class="orbit-board"
      :class="{ 'is-finished': gameOver }"
    >
      <div class="orbit-ring" />
      <div
        class="orbit-target"
        :style="{ transform: `rotate(${targetAngle}deg)` }"
      >
        <span>✦</span>
      </div>
      <div
        class="orbit-pointer"
        :style="{ transform: `rotate(${angle}deg)` }"
      >
        <span>✧</span>
      </div>
      <div class="orbit-core">
        <UIcon
          name="i-lucide-sparkles"
          aria-hidden="true"
        />
      </div>
    </div>

    <div class="orbit-footer">
      <p
        class="orbit-status"
        aria-live="polite"
      >
        {{ gameOver ? `Partie terminée : ${points} étoile${points > 1 ? 's' : ''} en orbite.` : lastResult || `Lancers ${rounds} / 5` }}
      </p>
      <button
        v-if="gameOver"
        type="button"
        class="orbit-action"
        @click="restartGame"
      >
        <UIcon
          name="i-lucide-rotate-cw"
          aria-hidden="true"
        /> Rejouer
      </button>
      <button
        v-else
        type="button"
        class="orbit-action"
        @click="launchStar"
      >
        <UIcon
          name="i-lucide-send"
          aria-hidden="true"
        /> Lancer l’étoile
      </button>
    </div>
  </section>
</template>

<style scoped>
.orbit-game { --game-ink: var(--text-color); --game-muted: var(--muted-color); --game-primary: var(--primary-color); --game-accent: var(--accent-color); --game-line: var(--border-color); color: var(--game-ink); }
.orbit-toolbar { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; }
.orbit-eyebrow { color: var(--game-accent); font-family: var(--font-mono); font-size: 0.64rem; letter-spacing: 0.12em; text-transform: uppercase; }
.orbit-toolbar h2 { margin-top: 0.2rem; font-family: var(--font-display); font-size: 1.55rem; }
.orbit-score { display: flex; align-items: baseline; color: var(--game-muted); font-family: var(--font-mono); }
.orbit-score strong { color: var(--game-primary); font-size: 1.5rem; }
.orbit-score span { font-size: 0.7rem; }
.orbit-board { position: relative; width: min(100%, 24rem); aspect-ratio: 1; margin: 1.2rem auto; overflow: hidden; border: 1px solid var(--game-line); border-radius: 50%; background: radial-gradient(circle, var(--theme-panel-solid), var(--theme-soft-primary)); }
.orbit-ring { position: absolute; inset: 15%; border: 1px solid rgba(var(--primary-color-rgb), 0.35); border-radius: 50%; box-shadow: 0 0 22px rgba(var(--primary-color-rgb), 0.12), inset 0 0 22px rgba(var(--accent-color-rgb), 0.08); }
.orbit-target, .orbit-pointer { position: absolute; inset: 0; border-radius: 50%; pointer-events: none; }
.orbit-target > span, .orbit-pointer > span { position: absolute; top: 8%; left: 50%; display: grid; width: 2.3rem; aspect-ratio: 1; place-items: center; border-radius: 50%; transform: translateX(-50%); }
.orbit-target > span { border: 1px solid var(--game-accent); background: var(--theme-panel-solid); color: var(--game-accent); box-shadow: 0 0 20px rgba(var(--accent-color-rgb), 0.32); }
.orbit-pointer { transition: transform 28ms linear; }
.orbit-pointer > span { color: var(--game-primary); font-size: 1.55rem; text-shadow: 0 0 12px rgba(var(--primary-color-rgb), 0.52); }
.orbit-core { position: absolute; inset: 42%; display: grid; place-items: center; border-radius: 50%; background: var(--theme-soft-primary); color: var(--game-accent); }
.orbit-core :deep(svg) { width: 1.35rem; height: 1.35rem; }
.orbit-footer { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.orbit-status { color: var(--game-muted); font-size: 0.78rem; }
.orbit-action { display: inline-flex; min-height: 2.75rem; align-items: center; gap: 0.5rem; padding: 0.55rem 0.8rem; border: 1px solid var(--game-primary); border-radius: 0.4rem; background: var(--game-primary); color: #fff; cursor: pointer; font-size: 0.76rem; font-weight: 700; transition: transform 160ms ease, filter 160ms ease; }
.orbit-action:hover { transform: translateY(-2px); filter: brightness(1.08); }
.orbit-action:focus-visible { outline: 3px solid var(--game-accent); outline-offset: 3px; }
.orbit-action :deep(svg) { width: 1rem; height: 1rem; }

@media (max-width: 520px) {
  .orbit-footer { align-items: stretch; flex-direction: column; }
  .orbit-action { justify-content: center; }
}

@media (prefers-reduced-motion: reduce) {
  .orbit-action { transition: none; }
}
</style>
