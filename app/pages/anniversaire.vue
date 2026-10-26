<script setup lang="ts">
import { gsap } from 'gsap'
import { AGE } from '../data/config'

const pageRoot = ref<HTMLElement | null>(null)
const isMontageRevealed = ref(false)
let entranceContext: gsap.Context | undefined
const stars = Array.from({ length: 30 }, (_, starIndex) => ({
  id: starIndex,
  left: `${(starIndex * 37) % 96 + 2}%`,
  top: `${(starIndex * 19) % 88 + 4}%`,
  delay: `${(starIndex % 7) * 0.38}s`,
  size: `${2 + (starIndex % 3)}px`
}))

function revealMontage() {
  isMontageRevealed.value = true
}

function returnToBirthdayCard() {
  isMontageRevealed.value = false
}

function handleMontageEnded() {
  if (isMontageRevealed.value) {
    returnToBirthdayCard()
  }
}

const highlights = [
  { label: 'Le sourire', text: 'Toujours là même quand le monde est bruyant.', icon: 'i-lucide-smile' },
  { label: 'La douceur', text: 'Une présence qui calme, réconforte et apaise.', icon: 'i-lucide-heart-handshake' },
  { label: 'La lumière', text: 'Tu apportes de la couleur même aux jours simples.', icon: 'i-lucide-sparkles' }
]

const memories = [
  { title: 'Le début', text: 'Tout a commencé avec un regard, un sourire, et cette sensation qu’on ne voulait pas laisser partir.', period: 'Première rencontre' },
  { title: 'Les petits instants', text: 'Les échanges, les rires, les pauses, les détails qui deviennent des souvenirs précieux.', period: 'Chaque jour' },
  { title: 'Le cœur', text: 'Et surtout, cette manière unique de rendre tout plus chaleureux, plus beau, plus vivant.', period: 'Toujours' }
]

onMounted(() => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const root = pageRoot.value
  if (!root || prefersReducedMotion) return

  entranceContext = gsap.context(() => {
    const entrance = gsap.timeline({ defaults: { ease: 'power3.out' } })
    entrance.from('.birthday-copy > *', {
      autoAlpha: 0,
      y: 20,
      duration: 0.65,
      stagger: 0.09
    })
    entrance.from('.birthday-wish-scene__front > *', {
      autoAlpha: 0,
      y: 24,
      scale: 0.92,
      duration: 1.1,
      stagger: 0.12,
      ease: 'power3.out',
      clearProps: 'opacity,visibility,transform'
    }, 0.16)
  }, root)
})

onUnmounted(() => entranceContext?.revert())

useHead({
  title: 'Anniversaire • Osnella Sènami',
  meta: [
    { name: 'description', content: 'Une petite page anniversaire pleine de douceur, de souvenirs et d’amour.' },
    { name: 'robots', content: 'noindex' }
  ]
})
</script>

<template>
  <main
    ref="pageRoot"
    class="theme-page theme-page--anniversaire"
  >
    <div
      class="birthday-starfield"
      aria-hidden="true"
    >
      <span
        v-for="star in stars"
        :key="star.id"
        class="birthday-star"
        :style="{ 'left': star.left, 'top': star.top, '--star-delay': star.delay, '--star-size': star.size }"
      />
    </div>

    <section class="birthday-hero relative mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 lg:px-8 lg:pb-28 lg:pt-16">
      <div class="mb-10 flex items-center justify-between text-xs uppercase tracking-[0.28em] text-violet-500/80">
        <span>Osnella Sènami</span>
        <span>Anniversaire</span>
      </div>

      <div class="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div class="birthday-copy">
          <p class="mb-4 text-xs font-medium uppercase tracking-[0.3em] text-pink-500">
            Pour toi
          </p>
          <p class="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/60 px-3 py-1.5 text-sm font-semibold text-violet-700">
            <UIcon
              name="i-lucide-cake-slice"
              class="h-4 w-4"
            />
            {{ AGE }} ans, une nouvelle aventure commence
          </p>
          <h1 class="max-w-xl font-[var(--font-display)] text-5xl leading-none text-violet-700 sm:text-6xl lg:text-7xl">
            Joyeux anniversaire
          </h1>

          <p class="mt-5 max-w-xl text-base leading-8 text-[#5a4967] sm:text-lg">
            Aujourd’hui, on célèbre la beauté de ta présence, la douceur de ton cœur, et la lumière que tu mets partout.
            Tu mérites un moment doux, plein de souvenirs et d’amour.
          </p>

          <div class="mt-8 flex flex-wrap gap-3">
            <NuxtLink
              to="/surprise"
              class="inline-flex items-center gap-2 rounded-full bg-violet-700 px-5 py-3 text-sm font-medium text-white shadow-[0_14px_32px_rgba(109,76,151,0.26)] transition hover:bg-violet-800"
            >
              <UIcon
                name="i-lucide-gift"
                class="h-4 w-4"
              />
              La surprise
            </NuxtLink>
            <NuxtLink
              to="/jeu"
              class="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/60 px-5 py-3 text-sm font-medium text-violet-700 backdrop-blur-sm transition hover:bg-white/80"
            >
              <UIcon
                name="i-lucide-gamepad-2"
                class="h-4 w-4"
              />
              Jouer
            </NuxtLink>
            <NuxtLink
              to="/souvenirs"
              class="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/60 px-5 py-3 text-sm font-medium text-violet-700 transition hover:bg-white/80"
            >
              <UIcon
                name="i-lucide-sparkles"
                class="h-4 w-4"
              />
              Choisir une animation
            </NuxtLink>
            <NuxtLink
              to="/lettres"
              class="inline-flex items-center gap-2 rounded-full border border-pink-200 bg-white/60 px-5 py-3 text-sm font-medium text-pink-700 transition hover:bg-white/80"
            >
              <UIcon
                name="i-lucide-spell-check"
                class="h-4 w-4"
              />
              Découvrir chaque lettre de ton prénom
            </NuxtLink>
          </div>
        </div>

        <div class="birthday-wish-scene">
          <div
            class="birthday-wish-scene__card"
            :class="{ 'is-revealed': isMontageRevealed }"
          >
            <button
              type="button"
              class="birthday-wish-scene__front"
              :inert="isMontageRevealed"
              :aria-expanded="isMontageRevealed"
              aria-controls="birthday-montage"
              aria-label="Retourner la carte et découvrir la surprise"
              @click="revealMontage"
            >
              <span
                class="birthday-wish-scene__orbit birthday-wish-scene__orbit--outer"
                aria-hidden="true"
              />
              <span
                class="birthday-wish-scene__orbit birthday-wish-scene__orbit--inner"
                aria-hidden="true"
              />
              <span
                class="birthday-wish-scene__star birthday-wish-scene__star--one"
                aria-hidden="true"
              >✦</span>
              <span
                class="birthday-wish-scene__star birthday-wish-scene__star--two"
                aria-hidden="true"
              >✧</span>
              <span
                class="birthday-wish-scene__star birthday-wish-scene__star--three"
                aria-hidden="true"
              >✶</span>

              <span class="birthday-wish-scene__center">
                <span class="birthday-wish-scene__eyebrow">Une année à faire briller</span>
                <strong>{{ AGE }}</strong>
                <span class="birthday-wish-scene__caption">ans de lumière<br>et tant de rêves à venir</span>
                <UIcon
                  name="i-lucide-cake-slice"
                  aria-hidden="true"
                />
              </span>

              <span
                class="birthday-wish-scene__wish"
                aria-hidden="true"
              >
                <UIcon
                  name="i-lucide-sparkles"
                  aria-hidden="true"
                />
                Clique pour découvrir la surprise
              </span>
              <span class="birthday-wish-scene__signature">Pour Osnella Sènami <span>✳</span></span>
            </button>

            <section
              id="birthday-montage"
              class="birthday-wish-scene__back"
              :inert="!isMontageRevealed"
              aria-label="Surprise anniversaire d’Osnella Sènami"
            >
              <media-player
                v-if="isMontageRevealed"
                class="birthday-montage-player"
                src="/Vidéos/video_2026-10-05_22-12-51.mp4"
                title="Surprise vidéo d’Osnella Sènami"
                :autoplay="true"
                :controls="true"
                playsinline
                preload="metadata"
                color-scheme="dark"
                @ended="handleMontageEnded"
              >
                <media-provider />
                <media-video-layout />
              </media-player>
              <button
                type="button"
                class="birthday-wish-scene__return"
                aria-label="Retourner à la carte des 18 ans"
                @click="returnToBirthdayCard"
              >
                <UIcon
                  name="i-lucide-rotate-ccw"
                  aria-hidden="true"
                />
                Retourner à la carte
              </button>
            </section>
          </div>
        </div>
      </div>
    </section>

    <section class="relative mx-auto max-w-6xl px-4 pb-10 sm:px-6 lg:px-8">
      <div class="grid gap-4 md:grid-cols-3">
        <article
          v-for="item in highlights"
          :key="item.label"
          class="rounded-[1.75rem] border border-violet-200/75 bg-white/50 p-5 shadow-[0_14px_40px_rgba(108,70,150,0.08)] backdrop-blur-sm"
        >
          <div class="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
            <UIcon
              :name="item.icon"
              class="h-5 w-5"
            />
          </div>
          <h2 class="text-lg font-semibold text-violet-800">
            {{ item.label }}
          </h2>
          <p class="mt-2 text-sm leading-7 text-[#5c4a6b]">
            {{ item.text }}
          </p>
        </article>
      </div>
    </section>

    <section class="relative mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div class="mb-8 text-center">
        <p class="text-xs uppercase tracking-[0.32em] text-violet-500/75">
          Souvenirs
        </p>
        <h2 class="mt-3 font-[var(--font-display)] text-4xl text-violet-800 sm:text-5xl">
          Ce qui compte le plus
        </h2>
      </div>

      <div class="space-y-4">
        <article
          v-for="memory in memories"
          :key="memory.title"
          class="grid gap-4 rounded-[1.8rem] border border-violet-200/70 bg-white/55 p-5 shadow-[0_18px_48px_rgba(76,41,118,0.08)] md:grid-cols-[160px_1fr] md:items-center"
        >
          <div class="rounded-2xl bg-violet-100 px-4 py-3 text-center text-xs uppercase tracking-[0.25em] text-violet-700">
            {{ memory.period }}
          </div>
          <div>
            <h3 class="text-xl font-semibold text-violet-800">
              {{ memory.title }}
            </h3>
            <p class="mt-2 text-sm leading-7 text-[#5c4a6b]">
              {{ memory.text }}
            </p>
          </div>
        </article>
      </div>
    </section>

    <section class="relative mx-auto max-w-5xl px-4 pb-20 sm:px-6 lg:px-8">
      <div class="rounded-[2rem] border border-violet-200/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.75),rgba(247,232,255,0.8))] p-7 shadow-[0_20px_58px_rgba(88,59,119,0.12)] backdrop-blur-md sm:p-10">
        <p class="text-xs uppercase tracking-[0.32em] text-violet-500/75">
          Message
        </p>
        <h2 class="mt-3 font-[var(--font-display)] text-4xl text-violet-800 sm:text-5xl">
          Tu es une vraie douceur.
        </h2>
        <p class="mt-4 max-w-2xl text-base leading-8 text-[#5c4a6b] sm:text-lg">
          Que cette année te ramène encore plus de moments heureux, de joies simples, de souvenirs inoubliables et la certitude que tu es aimée, respectée et célébrée.
        </p>

        <div class="mt-8 flex flex-wrap items-center gap-3">
          <NuxtLink
            to="/surprise"
            class="inline-flex items-center gap-2 rounded-full bg-pink-500 px-5 py-3 text-sm font-medium text-white shadow-[0_12px_28px_rgba(236,72,153,0.3)] transition hover:bg-pink-600"
          >
            <UIcon
              name="i-lucide-heart"
              class="h-4 w-4"
            />
            Encore un mot doux
          </NuxtLink>
          <NuxtLink
            to="/galerie"
            class="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/70 px-5 py-3 text-sm font-medium text-violet-700 transition hover:bg-white"
          >
            <UIcon
              name="i-lucide-images"
              class="h-4 w-4"
            />
            Voir la galerie
          </NuxtLink>
          <NuxtLink
            to="/voyage"
            class="inline-flex items-center gap-2 rounded-full border border-pink-200 bg-white/70 px-5 py-3 text-sm font-medium text-pink-700 transition hover:bg-white"
          >
            <UIcon
              name="i-lucide-film"
              class="h-4 w-4"
            />
            Revoir les instants
          </NuxtLink>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.theme-page {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  min-height: 100vh;
  background:
    radial-gradient(ellipse at 72% 16%, rgba(var(--accent-color-rgb), 0.16), transparent 36rem),
    radial-gradient(ellipse at 12% 4%, rgba(var(--primary-color-rgb), 0.14), transparent 38rem),
    linear-gradient(180deg, var(--bg-color-soft), var(--bg-color));
  color: var(--text-color);
}

.birthday-starfield {
  position: absolute;
  z-index: -1;
  inset: 0;
  pointer-events: none;
}

.birthday-star {
  position: absolute;
  width: var(--star-size);
  aspect-ratio: 1;
  border-radius: 50%;
  background: var(--accent-color);
  animation: star-twinkle 3.8s ease-in-out var(--star-delay) infinite;
}

.birthday-hero { position: relative; z-index: 1; }
.birthday-copy h1 { color: #17534b; }
.birthday-copy > p:first-child { color: #bd6e43; }
.birthday-copy > p:nth-child(2) { border-color: rgba(23, 83, 75, 0.2); background: rgba(255, 255, 255, 0.72); color: #17534b; }

.birthday-wish-scene {
  --scene-highlight: color-mix(in srgb, var(--accent-color) 58%, #fff0c9);
  --scene-secondary: color-mix(in srgb, var(--primary-color) 58%, #f1e4ff);
  position: relative;
  display: grid;
  min-width: 0;
  min-height: 34rem;
  place-items: center;
  overflow: hidden;
  isolation: isolate;
  perspective: 1500px;
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--primary-color) 44%, #20172b),
    color-mix(in srgb, var(--primary-color) 58%, #241b32) 54%,
    color-mix(in srgb, var(--accent-color) 40%, #20172b)
  );
  color: #fff4cf;
}

.birthday-wish-scene__card {
  position: relative;
  width: 100%;
  min-height: inherit;
  transform-style: preserve-3d;
  transition: transform 1.1s cubic-bezier(0.2, 0.78, 0.2, 1);
}

.birthday-wish-scene__card.is-revealed { transform: rotateY(180deg); }

.birthday-wish-scene__front,
.birthday-wish-scene__back {
  position: absolute;
  inset: 0;
  overflow: hidden;
  backface-visibility: hidden;
}

.birthday-wish-scene__front {
  display: grid;
  width: 100%;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: center;
}

.birthday-wish-scene__front:focus-visible {
  outline: 3px solid var(--scene-highlight);
  outline-offset: -6px;
}

.birthday-wish-scene__back {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3.5rem 1rem 1rem;
  background: linear-gradient(145deg, color-mix(in srgb, var(--primary-color) 30%, #171321), #100e18);
  transform: rotateY(180deg);
}

.birthday-montage-player { width: min(100%, 44rem); }
.birthday-wish-scene__back :deep(.video-embed) { width: 100%; min-height: 14rem; border-color: rgba(var(--accent-color-rgb), 0.34); border-radius: 0.8rem; }
.birthday-wish-scene__back :deep(media-player) { --video-border-radius: 0.8rem; }

.birthday-wish-scene__return {
  position: absolute;
  z-index: 3;
  top: 0.8rem;
  right: 0.8rem;
  display: inline-flex;
  min-height: 2.5rem;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.7rem;
  border: 1px solid rgba(var(--accent-color-rgb), 0.42);
  background: rgba(20, 15, 28, 0.78);
  color: #fff4cf;
  cursor: pointer;
  font-size: 0.7rem;
  font-weight: 700;
}

.birthday-wish-scene__return:hover { background: rgba(var(--primary-color-rgb), 0.72); }
.birthday-wish-scene__return:focus-visible { outline: 3px solid var(--scene-highlight); outline-offset: 2px; }
.birthday-wish-scene__return :deep(svg) { width: 1rem; height: 1rem; }

.birthday-wish-scene::before,
.birthday-wish-scene::after {
  position: absolute;
  z-index: -1;
  inset: 0;
  background-image: radial-gradient(rgba(255, 244, 207, 0.44) 0.8px, transparent 1px);
  background-position: 14px 22px;
  background-size: 42px 42px;
  content: '';
  opacity: 0.35;
  pointer-events: none;
}

.birthday-wish-scene::after { background-position: 31px 7px; background-size: 67px 67px; opacity: 0.22; }
.birthday-wish-scene__orbit { position: absolute; width: 78%; aspect-ratio: 1; border: 1px solid rgba(255, 230, 170, 0.23); border-radius: 50%; pointer-events: none; }
.birthday-wish-scene__orbit--outer { transform: rotateX(68deg) scaleY(0.78); animation: orbit-breathe 9s ease-in-out infinite alternate; }
.birthday-wish-scene__orbit--inner { width: 63%; border-color: rgba(148, 212, 189, 0.26); transform: rotateX(68deg) rotateZ(42deg) scaleY(0.72); animation: orbit-breathe 12s ease-in-out infinite alternate-reverse; }
.birthday-wish-scene__center { display: grid; justify-items: center; text-align: center; }
.birthday-wish-scene__eyebrow { color: #f1c873; font-family: var(--font-mono); font-size: 0.62rem; letter-spacing: 0.2em; text-transform: uppercase; }
.birthday-wish-scene__center strong { margin: -0.1em 0; color: #fff4cf; font-family: var(--font-display); font-size: clamp(10rem, 24vw, 15rem); font-weight: 500; line-height: 0.92; text-shadow: 0 0 38px rgba(242, 199, 115, 0.22); }
.birthday-wish-scene__caption { color: rgba(255, 244, 207, 0.82); font-family: var(--font-display); font-size: 1.05rem; line-height: 1.4; }
.birthday-wish-scene__center :deep(svg) { width: 1.45rem; height: 1.45rem; margin-top: 0.8rem; color: #f1c873; }
.birthday-wish-scene__star { position: absolute; color: #f1c873; animation: star-float 5s ease-in-out infinite alternate; }
.birthday-wish-scene__star--one { top: 18%; left: 18%; font-size: 2rem; }
.birthday-wish-scene__star--two { top: 26%; right: 16%; color: #a8d7c3; font-size: 2.7rem; animation-delay: -1.8s; }
.birthday-wish-scene__star--three { bottom: 24%; left: 13%; color: #f4b1a0; font-size: 1.6rem; animation-delay: -3s; }
.birthday-wish-scene__wish { position: absolute; right: 1rem; bottom: 1rem; left: 1rem; display: flex; min-height: 3rem; align-items: center; justify-content: center; gap: 0.55rem; border: 1px solid rgba(255, 244, 207, 0.4); background: rgba(15, 39, 45, 0.62); color: #fff4cf; cursor: pointer; font-size: 0.8rem; font-weight: 700; transition: background-color 180ms ease, border-color 180ms ease; }
.birthday-wish-scene__wish:hover { border-color: #f1c873; background: rgba(15, 39, 45, 0.9); }
.birthday-wish-scene__wish:focus-visible { outline: 3px solid #f1c873; outline-offset: 3px; }
.birthday-wish-scene__wish :deep(svg) { width: 1rem; height: 1rem; color: #f1c873; }
.birthday-wish-scene__signature { position: absolute; top: 1.2rem; right: 1.2rem; color: rgba(255, 244, 207, 0.68); font-family: var(--font-mono); font-size: 0.55rem; letter-spacing: 0.08em; text-transform: uppercase; }
.birthday-wish-scene__signature span { margin-left: 0.3rem; color: #f1c873; }

@keyframes star-twinkle { 0%, 100% { opacity: 0.22; transform: scale(0.75); } 50% { opacity: 0.82; transform: scale(1.2); } }
@keyframes orbit-breathe { from { opacity: 0.45; transform: rotateX(68deg) scale(0.82); } to { opacity: 1; transform: rotateX(68deg) scale(1.04); } }
@keyframes star-float { from { opacity: 0.55; transform: translateY(0) rotate(-8deg); } to { opacity: 1; transform: translateY(-0.65rem) rotate(9deg); } }
@keyframes wish-burst { from { opacity: 0.8; transform: rotateX(68deg) scale(0.65); } to { opacity: 0; transform: rotateX(68deg) scale(1.34); } }

@media (max-width: 800px) {
  .birthday-wish-scene { min-height: 29rem; margin-top: 0.75rem; }
}

@media (max-width: 440px) {
  .birthday-wish-scene { min-height: 25rem; }
  .birthday-wish-scene__center strong { font-size: 10rem; }
  .birthday-wish-scene__orbit { width: 92%; }
  .birthday-wish-scene__orbit--inner { width: 72%; }
  .birthday-wish-scene__star--one { left: 10%; }
  .birthday-wish-scene__star--two { right: 8%; }
}

@media (prefers-reduced-motion: reduce) {
  .birthday-wish-scene__card { transition: none; }
  .birthday-star,
  .birthday-wish-scene__orbit,
  .birthday-wish-scene__star { animation: none; }
}
</style>
