<script setup lang="ts">
const props = withDefaults(defineProps<{ themeTone?: boolean }>(), { themeTone: false })

const MAX_VISIBLE_DESKTOP = 20
const MAX_VISIBLE_MOBILE = 20
const SPAWN_INTERVAL_MIN = 1700
const SPAWN_INTERVAL_MAX = 2900
const LIFETIME_MIN = 6500
const LIFETIME_MAX = 10500
const SIZE_MIN_DESKTOP = 50
const SIZE_MAX_DESKTOP = 80
const SIZE_MIN_MOBILE = 40
const SIZE_MAX_MOBILE = 60

const ICON_POOL = [
  'i-twemoji-sparkling-heart',
  'i-twemoji-heart-with-ribbon',
  'i-twemoji-pink-heart',
  'i-twemoji-cherry-blossom',
  'i-twemoji-bouquet',
  'i-twemoji-ribbon',
  'i-twemoji-birthday-cake',
  'i-twemoji-party-popper',
  'i-twemoji-balloon',
  'i-twemoji-sparkles',
  'i-twemoji-man-dancing',
  'i-twemoji-woman-dancing',
  'i-twemoji-musical-notes',
  'i-twemoji-microphone',
  'i-twemoji-guitar',
  'i-twemoji-disco-ball',
  'i-twemoji-confetti-ball',
  'i-twemoji-beaming-face-with-smiling-eyes',
  'i-lucide-code-xml',
  'i-lucide-gamepad-2'
] as const

const MOTION_KINDS = ['float', 'pulse', 'drift'] as const
type MotionKind = typeof MOTION_KINDS[number] | 'static'

type LiveIcon = {
  key: number
  name: typeof ICON_POOL[number]
  top: number
  left: number
  sizePx: number
  kind: MotionKind
  duration: number
  driftX: number
  driftY: number
  rotateAmount: number
  opacity: number
  born: number
  lifetime: number
}

const liveIcons = ref<LiveIcon[]>([])
let uid = 0
let iconLimit = MAX_VISIBLE_DESKTOP
let spawnTimeoutId: ReturnType<typeof setTimeout> | null = null
let sweepIntervalId: ReturnType<typeof setInterval> | null = null

function rand(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function randomPick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!
}

function spawnIcon(isStatic = false): LiveIcon {
  const isMobile = window.matchMedia('(max-width: 640px)').matches

  return {
    key: uid++,
    name: randomPick(ICON_POOL),
    top: rand(6, 86),
    left: rand(4, 92),
    sizePx: isMobile
      ? rand(SIZE_MIN_MOBILE, SIZE_MAX_MOBILE)
      : rand(SIZE_MIN_DESKTOP, SIZE_MAX_DESKTOP),
    kind: isStatic ? 'static' : randomPick(MOTION_KINDS),
    duration: rand(4, 8),
    driftX: rand(-18, 18),
    driftY: rand(-20, 20),
    rotateAmount: rand(12, 28) * (Math.random() < 0.5 ? -1 : 1),
    opacity: rand(0.22, 0.48),
    born: Date.now(),
    lifetime: rand(LIFETIME_MIN, LIFETIME_MAX)
  }
}

function scheduleNextSpawn() {
  spawnTimeoutId = setTimeout(() => {
    if (liveIcons.value.length < iconLimit) liveIcons.value.push(spawnIcon())
    scheduleNextSpawn()
  }, rand(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_MAX))
}

function sweepExpired() {
  const now = Date.now()
  liveIcons.value = liveIcons.value.filter(icon => now - icon.born < icon.lifetime)
}

onMounted(() => {
  const isMobile = window.matchMedia('(max-width: 640px)').matches
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  iconLimit = isMobile ? MAX_VISIBLE_MOBILE : MAX_VISIBLE_DESKTOP

  const initialCount = Math.ceil(iconLimit * 0.6)
  for (let index = 0; index < initialCount; index++) {
    liveIcons.value.push(spawnIcon(reducedMotion))
  }

  if (reducedMotion) return

  scheduleNextSpawn()
  sweepIntervalId = setInterval(sweepExpired, 800)
})

onUnmounted(() => {
  if (spawnTimeoutId) clearTimeout(spawnTimeoutId)
  if (sweepIntervalId) clearInterval(sweepIntervalId)
})
</script>

<template>
  <ClientOnly>
    <div class="floating-icons" :class="{ 'floating-icons--theme-tone': props.themeTone }" aria-hidden="true">
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
            '--icon-drift-x': `${icon.driftX}px`,
            '--icon-drift-y': `${icon.driftY}px`,
            '--icon-rotate': `${icon.rotateAmount}deg`,
            '--icon-opacity': icon.opacity * (props.themeTone ? 0.42 : 1)
          }"
        >
          <UIcon :name="icon.name" class="floating-icons__visual" />
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
  color: var(--accent-color);
  opacity: var(--icon-opacity);
  filter: drop-shadow(0 0 8px rgba(var(--primary-color-rgb), 0.18));
  animation-duration: var(--icon-duration);
  animation-iteration-count: infinite;
  animation-direction: alternate;
  animation-timing-function: ease-in-out;
}

.floating-icons--theme-tone .floating-icons__icon {
  filter: grayscale(1) sepia(0.9) saturate(2.2) hue-rotate(292deg) drop-shadow(0 0 8px rgba(var(--primary-color-rgb), 0.18));
}

.floating-icons__icon--float { animation-name: floating-icons-float; }
.floating-icons__icon--pulse { animation-name: floating-icons-pulse; }
.floating-icons__icon--drift { animation-name: floating-icons-drift; }
.floating-icons__icon--static { animation: none; }

.floating-icons__visual,
.floating-icons__visual :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}

.floating-icons-fade-enter-active,
.floating-icons-fade-leave-active {
  transition: opacity 0.8s ease;
}

.floating-icons-fade-enter-from,
.floating-icons-fade-leave-to {
  opacity: 0 !important;
}

@keyframes floating-icons-float {
  to { transform: translate3d(0, -22px, 0) rotate(var(--icon-rotate)); }
}

@keyframes floating-icons-pulse {
  to { transform: scale(1.16) rotate(var(--icon-rotate)); }
}

@keyframes floating-icons-drift {
  to { transform: translate3d(var(--icon-drift-x), var(--icon-drift-y), 0) rotate(var(--icon-rotate)); }
}

@media (prefers-reduced-motion: reduce) {
  .floating-icons__icon,
  .floating-icons-fade-enter-active,
  .floating-icons-fade-leave-active {
    animation: none;
    transition: none;
  }
}
</style>
