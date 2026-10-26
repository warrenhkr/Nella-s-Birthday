<script setup lang="ts">
const MAX_VISIBLE = 12
const SPAWN_INTERVAL_MIN = 900
const SPAWN_INTERVAL_MAX = 2200
const LIFETIME_MIN = 3500
const LIFETIME_MAX = 7500
const FLOAT_DISTANCE_MIN = 14
const FLOAT_DISTANCE_MAX = 55
const SIZE_MIN_PX = 50
const SIZE_MAX_PX = 115

type PoolIcon = {
  type: 'icon' | 'img'
  name?: string
  src?: string
}

const ICON_POOL: PoolIcon[] = [
  { type: 'icon', name: 'i-game-icons-katana' },
  { type: 'icon', name: 'i-game-icons-ninja-mask' },
  { type: 'icon', name: 'i-game-icons-shuriken' },
  { type: 'icon', name: 'i-game-icons-noodles' },
  { type: 'icon', name: 'i-game-icons-shinto-shrine' },
  { type: 'icon', name: 'i-game-icons-yin-yang' },
  { type: 'icon', name: 'i-game-icons-dragon-head' },
  { type: 'icon', name: 'i-game-icons-cherry' },
  { type: 'icon', name: 'i-game-icons-open-book' },
  { type: 'icon', name: 'i-game-icons-samurai-helmet' },
  { type: 'icon', name: 'i-game-icons-japan' },
  { type: 'icon', name: 'i-game-icons-lotus' },
  { type: 'icon', name: 'i-game-icons-scroll-unfurled' },
  { type: 'icon', name: 'i-mdi-star-four-points-outline' },
  { type: 'icon', name: 'i-lucide-sparkles' },
  { type: 'icon', name: 'i-mdi-cat' },
  { type: 'icon', name: 'i-twemoji-crescent-moon' },
  { type: 'icon', name: 'i-twemoji-cherry-blossom' },
  { type: 'icon', name: 'i-lucide-gamepad-2' },
  { type: 'icon', name: 'i-lucide-trophy' },
  { type: 'icon', name: 'i-lucide-joystick' },
  { type: 'img', src: '/img/floating/katana.svg' },
  { type: 'img', src: '/img/floating/shuriken.svg' },
  { type: 'img', src: '/img/floating/mask.svg' },
  { type: 'img', src: '/img/floating/sakura.svg' },
  { type: 'img', src: '/img/floating/moon-star.svg' },
  { type: 'img', src: '/img/floating/speed-lines.svg' }
] as const

const MOTION_KINDS = ['float', 'spin', 'pulse', 'drift', 'orbit'] as const
type MotionKind = typeof MOTION_KINDS[number]

type LiveIcon = {
  key: number
  type: PoolIcon['type']
  name?: string
  src?: string
  top: number
  left: number
  sizePx: number
  kind: MotionKind
  duration: number
  floatDistance: number
  driftX: number
  driftY: number
  rotateAmount: number
  scaleAmount: number
  opacity: number
  born: number
  lifetime: number
}

const liveIcons = ref<LiveIcon[]>([])
let uid = 0
let spawnTimeoutId: ReturnType<typeof setTimeout> | null = null
let sweepIntervalId: ReturnType<typeof setInterval> | null = null

function rand(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function randomPick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!
}

function spawnIcon(): LiveIcon {
  const picked = randomPick(ICON_POOL)

  return {
    key: uid++,
    type: picked.type,
    name: picked.type === 'icon' ? picked.name : undefined,
    src: picked.type === 'img' ? picked.src : undefined,
    top: rand(4, 92),
    left: rand(3, 93),
    sizePx: rand(SIZE_MIN_PX, SIZE_MAX_PX),
    kind: randomPick(MOTION_KINDS),
    duration: rand(1.4, 3.6),
    floatDistance: rand(FLOAT_DISTANCE_MIN, FLOAT_DISTANCE_MAX),
    driftX: rand(-30, 30),
    driftY: rand(-20, 20),
    rotateAmount: rand(15, 50) * (Math.random() < 0.5 ? -1 : 1),
    scaleAmount: rand(1.2, 1.8),
    opacity: rand(0.18, 0.5),
    born: Date.now(),
    lifetime: rand(LIFETIME_MIN, LIFETIME_MAX)
  }
}

function scheduleNextSpawn() {
  spawnTimeoutId = setTimeout(() => {
    if (liveIcons.value.length < MAX_VISIBLE) liveIcons.value.push(spawnIcon())
    scheduleNextSpawn()
  }, rand(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_MAX))
}

function sweepExpired() {
  const now = Date.now()
  liveIcons.value = liveIcons.value.filter(icon => now - icon.born < icon.lifetime)
}

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  for (let index = 0; index < Math.ceil(MAX_VISIBLE * 0.6); index++) {
    liveIcons.value.push(spawnIcon())
  }

  scheduleNextSpawn()
  sweepIntervalId = setInterval(sweepExpired, 500)
})

onUnmounted(() => {
  if (spawnTimeoutId) clearTimeout(spawnTimeoutId)
  if (sweepIntervalId) clearInterval(sweepIntervalId)
})
</script>

<template>
  <ClientOnly>
    <div
      class="floating-icons"
      aria-hidden="true"
    >
      <TransitionGroup name="floating-icons-fade">
        <div
          v-for="icon in liveIcons"
          :key="icon.key"
          class="floating-icons__icon"
          :class="`floating-icons__icon--${icon.kind}`"
          :style="{
            '--icon-top': `${icon.top}%`,
            '--icon-left': `${icon.left}%`,
            '--icon-size': `${icon.sizePx}px`,
            '--icon-duration': `${icon.duration}s`,
            '--icon-float': `${icon.floatDistance}px`,
            '--icon-drift-x': `${icon.driftX}px`,
            '--icon-drift-y': `${icon.driftY}px`,
            '--icon-rotate': `${icon.rotateAmount}deg`,
            '--icon-scale': icon.scaleAmount,
            '--icon-opacity': icon.opacity
          }"
        >
          <UIcon
            v-if="icon.type === 'icon'"
            :name="icon.name"
            class="floating-icons__visual"
          />
          <img
            v-else
            :src="icon.src"
            alt=""
            class="floating-icons__visual"
          >
        </div>
      </TransitionGroup>
    </div>
  </ClientOnly>
</template>

<style scoped>
.floating-icons {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.floating-icons__icon {
  position: absolute;
  top: var(--icon-top);
  left: var(--icon-left);
  width: var(--icon-size);
  height: var(--icon-size);
  color: var(--primary-color);
  opacity: var(--icon-opacity);
  filter: drop-shadow(0 0 10px rgba(var(--primary-color-rgb), 0.28));
  animation-duration: var(--icon-duration);
  animation-iteration-count: infinite;
  animation-direction: alternate;
  animation-timing-function: ease-in-out;
}

.floating-icons__icon--float { animation-name: floating-icons-float; }
.floating-icons__icon--spin { animation-name: floating-icons-spin; }
.floating-icons__icon--pulse { animation-name: floating-icons-pulse; }
.floating-icons__icon--drift { animation-name: floating-icons-drift; }
.floating-icons__icon--orbit { animation-name: floating-icons-orbit; }

.floating-icons__visual {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  color: inherit;
}

:deep(.floating-icons__visual svg),
:deep(.floating-icons__visual > svg) {
  display: block;
  width: 100%;
  height: 100%;
}

.floating-icons-fade-enter-active,
.floating-icons-fade-leave-active { transition: opacity 1s ease; }
.floating-icons-fade-enter-from,
.floating-icons-fade-leave-to { opacity: 0 !important; }

@keyframes floating-icons-float {
  to { transform: translate3d(0, calc(var(--icon-float) * -1), 0); }
}

@keyframes floating-icons-spin {
  to { transform: translate3d(0, calc(var(--icon-float) * -0.3), 0) rotate(var(--icon-rotate)); }
}

@keyframes floating-icons-pulse {
  to { transform: scale(var(--icon-scale)); }
}

@keyframes floating-icons-drift {
  to { transform: translate3d(var(--icon-drift-x), var(--icon-drift-y), 0); }
}

@keyframes floating-icons-orbit {
  to { transform: translate3d(var(--icon-drift-x), calc(var(--icon-float) * -1), 0) rotate(var(--icon-rotate)); }
}
</style>
