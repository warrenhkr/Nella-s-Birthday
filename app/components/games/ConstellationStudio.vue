<script setup lang="ts">
interface StarPoint {
  id: number
  x: number
  y: number
}

const stars: StarPoint[] = [
  { id: 1, x: 14, y: 24 },
  { id: 2, x: 31, y: 15 },
  { id: 3, x: 49, y: 31 },
  { id: 4, x: 72, y: 18 },
  { id: 5, x: 85, y: 42 },
  { id: 6, x: 67, y: 61 },
  { id: 7, x: 43, y: 71 },
  { id: 8, x: 20, y: 58 },
  { id: 9, x: 35, y: 43 },
  { id: 10, x: 56, y: 53 },
  { id: 11, x: 81, y: 78 }
]

const selectedStars = ref<number[]>([])
const constellationName = ref('')
const shimmerCount = ref(0)
const pathPoints = computed(() => selectedStars.value
  .map(id => stars.find(star => star.id === id))
  .filter((star): star is StarPoint => Boolean(star))
  .map(star => `${star.x},${star.y}`)
  .join(' '))

function toggleStar(id: number) {
  selectedStars.value = selectedStars.value.includes(id)
    ? selectedStars.value.filter(starId => starId !== id)
    : [...selectedStars.value, id]
}

function undoStar() {
  selectedStars.value = selectedStars.value.slice(0, -1)
}

function clearSky() {
  selectedStars.value = []
  constellationName.value = ''
}

function makeItShine() {
  shimmerCount.value += 1
}
</script>

<template>
  <section class="constellation-game">
    <header class="constellation-toolbar">
      <div>
        <p class="constellation-eyebrow">
          Atelier du ciel
        </p>
        <h2>Trace ta constellation</h2>
      </div>
      <span class="constellation-count">{{ selectedStars.length }} étoile{{ selectedStars.length > 1 ? 's' : '' }}</span>
    </header>

    <div
      class="constellation-sky"
      aria-label="Espace de création de constellation"
    >
      <svg
        :key="`${shimmerCount}-${pathPoints}`"
        class="constellation-lines"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <polyline :points="pathPoints" />
      </svg>
      <button
        v-for="star in stars"
        :key="star.id"
        type="button"
        class="constellation-point"
        :class="{ 'is-selected': selectedStars.includes(star.id) }"
        :style="{ left: `${star.x}%`, top: `${star.y}%` }"
        :aria-label="`Étoile ${star.id}${selectedStars.includes(star.id) ? ', retirer du tracé' : ', ajouter au tracé'}`"
        :aria-pressed="selectedStars.includes(star.id)"
        @click="toggleStar(star.id)"
      >
        <span aria-hidden="true">✦</span>
      </button>
    </div>

    <div class="constellation-actions">
      <label class="constellation-name">
        <span>Nommer le dessin</span>
        <input
          v-model="constellationName"
          maxlength="28"
          placeholder="Mon petit ciel"
        >
      </label>
      <div class="constellation-buttons">
        <button
          type="button"
          :disabled="selectedStars.length === 0"
          @click="undoStar"
        >
          <UIcon
            name="i-lucide-undo-2"
            aria-hidden="true"
          /> Annuler
        </button>
        <button
          type="button"
          :disabled="selectedStars.length < 2"
          @click="makeItShine"
        >
          <UIcon
            name="i-lucide-sparkles"
            aria-hidden="true"
          /> Faire briller
        </button>
        <button
          type="button"
          :disabled="selectedStars.length === 0 && !constellationName"
          @click="clearSky"
        >
          <UIcon
            name="i-lucide-rotate-ccw"
            aria-hidden="true"
          /> Recommencer
        </button>
      </div>
    </div>

    <p
      class="constellation-caption"
      aria-live="polite"
    >
      {{ constellationName.trim() || 'Sans nom' }} <span>·</span> {{ selectedStars.length }} point{{ selectedStars.length > 1 ? 's' : '' }} relié{{ selectedStars.length > 1 ? 's' : '' }}
    </p>
  </section>
</template>

<style scoped>
.constellation-game { --game-ink: var(--text-color); --game-muted: var(--muted-color); --game-primary: var(--primary-color); --game-accent: var(--accent-color); --game-line: var(--border-color); color: var(--game-ink); }
.constellation-toolbar { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; margin-bottom: 0.85rem; }
.constellation-eyebrow { color: var(--game-accent); font-family: var(--font-mono); font-size: 0.64rem; letter-spacing: 0.12em; text-transform: uppercase; }
.constellation-toolbar h2 { margin-top: 0.2rem; font-family: var(--font-display); font-size: 1.55rem; }
.constellation-count { color: var(--game-muted); font-family: var(--font-mono); font-size: 0.65rem; }
.constellation-sky { position: relative; min-height: 22rem; overflow: hidden; border: 1px solid var(--game-line); background: radial-gradient(ellipse at 50% 50%, rgba(var(--primary-color-rgb), 0.13), transparent 68%), linear-gradient(145deg, var(--bg-color-soft), var(--bg-color)); }
.constellation-sky::before { position: absolute; inset: 0; background-image: radial-gradient(rgba(var(--accent-color-rgb), 0.35) 0.7px, transparent 0.8px); background-size: 23px 23px; content: ''; opacity: 0.5; pointer-events: none; }
.constellation-lines { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.constellation-lines polyline { fill: none; stroke: var(--game-accent); stroke-linecap: round; stroke-linejoin: round; stroke-width: 0.42; stroke-dasharray: 420; stroke-dashoffset: 420; filter: drop-shadow(0 0 3px rgba(var(--accent-color-rgb), 0.8)); animation: constellation-draw 1.4s cubic-bezier(0.2, 0.7, 0.2, 1) forwards; }
.constellation-point { position: absolute; z-index: 1; display: grid; width: 2.65rem; aspect-ratio: 1; place-items: center; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--game-muted); cursor: pointer; font-size: 1.2rem; transform: translate(-50%, -50%); transition: color 180ms ease, background-color 180ms ease, transform 180ms ease; }
.constellation-point:hover, .constellation-point:focus-visible, .constellation-point.is-selected { background: rgba(var(--primary-color-rgb), 0.18); color: var(--game-accent); transform: translate(-50%, -50%) scale(1.22); }
.constellation-point:focus-visible { outline: 2px solid var(--game-accent); outline-offset: 2px; }
.constellation-point.is-selected { filter: drop-shadow(0 0 8px rgba(var(--accent-color-rgb), 0.85)); }
.constellation-actions { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; margin-top: 0.85rem; }
.constellation-name { display: grid; gap: 0.35rem; min-width: 10rem; color: var(--game-muted); font-size: 0.68rem; }
.constellation-name input { width: 100%; min-height: 2.5rem; padding: 0.4rem 0.6rem; border: 1px solid var(--game-line); border-radius: 0.35rem; background: var(--theme-panel); color: var(--game-ink); }
.constellation-name input:focus-visible { outline: 2px solid var(--game-accent); outline-offset: 2px; }
.constellation-buttons { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0.4rem; }
.constellation-buttons button { display: inline-flex; min-height: 2.5rem; align-items: center; gap: 0.4rem; padding: 0.45rem 0.65rem; border: 1px solid var(--game-line); border-radius: 0.35rem; background: var(--theme-panel); color: var(--game-ink); cursor: pointer; font-size: 0.7rem; transition: border-color 160ms ease, background-color 160ms ease, transform 160ms ease; }
.constellation-buttons button:hover:not(:disabled) { transform: translateY(-2px); border-color: var(--game-accent); background: var(--theme-soft-primary); }
.constellation-buttons button:disabled { cursor: not-allowed; opacity: 0.45; }
.constellation-buttons button :deep(svg) { width: 0.95rem; height: 0.95rem; color: var(--game-accent); }
.constellation-caption { margin-top: 0.65rem; color: var(--game-muted); font-family: var(--font-mono); font-size: 0.62rem; }
.constellation-caption span { margin-inline: 0.35rem; color: var(--game-accent); }

@keyframes constellation-draw { to { stroke-dashoffset: 0; } }

@media (max-width: 600px) {
  .constellation-sky { min-height: 19rem; }
  .constellation-actions { align-items: stretch; flex-direction: column; }
  .constellation-name { min-width: 0; }
  .constellation-buttons { justify-content: flex-start; }
}

@media (prefers-reduced-motion: reduce) {
  .constellation-point, .constellation-buttons button { transition: none; }
  .constellation-lines polyline { animation-duration: 0.01ms; }
}
</style>
