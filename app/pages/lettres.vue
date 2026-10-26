<script setup lang="ts">
import { gsap } from 'gsap'
import { AGE } from '../data/config'
import { nameWords, type ComplimentWord, type LetterCompliment } from '../data/letter'

const pageElement = ref<HTMLElement | null>(null)
const activeWord = ref(nameWords[0]?.name ?? '')
const activeLetter = ref<LetterCompliment | null>(null)
const currentWord = computed(() => nameWords.find(word => word.name === activeWord.value) ?? null)
let entranceContext: gsap.Context | undefined

onMounted(() => {
  const root = pageElement.value
  if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  entranceContext = gsap.context(() => {
    gsap.fromTo('.orbit-node',
      { autoAlpha: 0, xPercent: -50, yPercent: -50, scale: 0.25, rotation: -18 },
      {
        autoAlpha: 1,
        xPercent: -50,
        yPercent: -50,
        scale: 1,
        rotation: 0,
        duration: 0.78,
        stagger: 0.09,
        delay: 0.18,
        ease: 'back.out(1.7)',
        clearProps: 'opacity,visibility,transform'
      }
    )
  }, root)
})

onUnmounted(() => entranceContext?.revert())

function orbitPosition(index: number, letterCount: number, isSelected: boolean) {
  if (isSelected) return { left: '50%', top: '50%' }

  const angle = (Math.PI * 2 * index / letterCount) - Math.PI / 2
  const radius = 34

  return {
    left: `${50 + Math.cos(angle) * radius}%`,
    top: `${50 + Math.sin(angle) * radius}%`
  }
}

function selectWord(word: ComplimentWord) {
  activeWord.value = word.name
  activeLetter.value = null
}

function selectLetter(event: MouseEvent, word: ComplimentWord, letter: LetterCompliment) {
  activeWord.value = word.name
  activeLetter.value = letter

  if (!import.meta.client || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (!(event.currentTarget instanceof HTMLElement)) return

  gsap.fromTo(event.currentTarget,
    { xPercent: -50, yPercent: -50, scale: 0.82, rotation: -10 },
    {
      xPercent: -50,
      yPercent: -50,
      scale: 1.08,
      rotation: 0,
      duration: 0.68,
      ease: 'elastic.out(1, 0.48)',
      clearProps: 'transform'
    }
  )
}

useHead({
  title: 'Chaque lettre d’Osnella Sènami',
  meta: [{ name: 'description', content: 'Un compliment pour chaque lettre des deux prénoms d’Osnella Sènami.' }]
})
</script>

<template>
  <main
    ref="pageElement"
    class="theme-page letters-page"
  >
    <header class="letters-hero">
      <p class="letters-eyebrow">
        Ses deux prénoms, treize petites lumières
      </p>
      <h1>Osnella Sènami</h1>
      <p class="letters-intro">
        Chaque lettre cache un mot doux. Choisis l’un de tes prénoms, puis clique sur une lettre pour découvrir le compliment qu’elle porte.
      </p>
      <div class="letters-age">
        <UIcon name="i-lucide-cake-slice" />
        <span><strong>{{ AGE }} ans</strong> · une nouvelle année à faire briller</span>
      </div>
    </header>

    <section
      class="letters-content"
      aria-label="Acrostiche interactif"
    >
      <div
        class="word-switcher"
        role="group"
        aria-label="Choisir un prénom"
      >
        <button
          v-for="word in nameWords"
          :key="word.name"
          type="button"
          :aria-pressed="activeWord === word.name"
          :class="{ 'is-active': activeWord === word.name }"
          @click="selectWord(word)"
        >
          {{ word.name }}
          <span>{{ word.letters.length }} lettres</span>
        </button>
      </div>

      <Transition
        name="word-swap"
        mode="out-in"
      >
        <div
          v-if="currentWord"
          :key="currentWord.name"
          class="orbit-stage"
          :aria-label="`Lettres de ${currentWord.name}`"
        >
          <div
            class="orbit-track orbit-track--outer"
            aria-hidden="true"
          />
          <div
            class="orbit-track orbit-track--inner"
            aria-hidden="true"
          />

          <div
            class="letter-orbit"
            aria-label="Choisir une lettre"
          >
            <button
              v-for="(letter, index) in currentWord.letters"
              :key="`${currentWord.name}-${letter.id}`"
              type="button"
              class="orbit-node"
              :class="{ 'orbit-node--active': activeLetter?.id === letter.id }"
              :style="orbitPosition(index, currentWord.letters.length, activeLetter?.id === letter.id)"
              :aria-label="`Lettre ${letter.character}, ${letter.adjective}`"
              :aria-pressed="activeLetter?.id === letter.id"
              :title="`${letter.character} · ${letter.adjective}`"
              @click="selectLetter($event, currentWord, letter)"
            >
              <span class="orbit-node__face">{{ letter.character }}</span>
            </button>
          </div>
        </div>
      </Transition>

      <Transition
        name="compliment"
        mode="out-in"
      >
        <article
          v-if="activeLetter"
          :key="`${activeWord}-${activeLetter.id}`"
          class="compliment-panel"
          aria-live="polite"
        >
          <span
            class="compliment-initial"
            aria-hidden="true"
          >{{ activeLetter.character }}</span>
          <div>
            <p class="compliment-label">
              Pour la lettre {{ activeLetter.character }}
            </p>
            <h2>{{ activeLetter.adjective }}</h2>
            <p>
              {{ activeLetter.message }}
            </p>
          </div>
          <UIcon
            name="i-lucide-sparkles"
            class="compliment-sparkle"
            aria-hidden="true"
          />
        </article>
        <article
          v-else
          key="choose-letter"
          class="compliment-panel compliment-panel--empty"
          aria-live="polite"
        >
          <span
            class="compliment-initial compliment-placeholder"
            aria-hidden="true"
          >
            <UIcon name="i-lucide-mouse-pointer-click" />
          </span>
          <div>
            <p class="compliment-label">
              À toi de jouer
            </p>
            <h2>Choisis une lettre</h2>
            <p>
              Clique sur une lettre autour du prénom pour découvrir le mot doux qu’elle te réserve.
            </p>
          </div>
          <UIcon
            name="i-lucide-sparkles"
            class="compliment-sparkle"
            aria-hidden="true"
          />
        </article>
      </Transition>

      <footer class="letters-footer">
        <p>Douze lettres, douze raisons de célébrer celle que tu es.</p>
        <NuxtLink to="/anniversaire">
          <UIcon name="i-lucide-arrow-left" />
          Revenir à l’anniversaire
        </NuxtLink>
      </footer>
    </section>
  </main>
</template>

<style scoped>
.letters-page {
  min-height: 100vh;
  padding: 4rem 1rem 7.5rem;
}

.letters-hero,
.letters-content {
  width: min(100%, 58rem);
  margin-inline: auto;
}

.letters-hero {
  text-align: center;
  animation: letters-arrive 700ms cubic-bezier(0.2, 0.75, 0.2, 1) both;
}

.letters-eyebrow {
  color: var(--accent-color);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.letters-hero h1 {
  margin-top: 0.8rem;
  color: var(--primary-color);
  font-family: var(--font-display);
  font-size: 4rem;
  font-weight: 700;
  line-height: 1;
}

.letters-intro {
  max-width: 38rem;
  margin: 1rem auto 0;
  color: var(--muted-color);
  font-size: 1rem;
  line-height: 1.8;
}

.letters-age {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  margin-top: 1.3rem;
  padding: 0.7rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--panel-color);
  color: var(--muted-color);
  font-size: 0.82rem;
}

.letters-age :deep(svg) {
  width: 1.1rem;
  height: 1.1rem;
  color: var(--accent-color);
}

.letters-age strong { color: var(--primary-color); }

.letters-content { margin-top: 2.8rem; }

.word-switcher {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 1.7rem;
}

.word-switcher button {
  display: grid;
  gap: 0.15rem;
  min-width: 8rem;
  padding: 0.65rem 1.15rem;
  border: 1px solid var(--border-color);
  border-radius: 0.9rem;
  background: var(--panel-color);
  color: var(--text-color);
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 180ms ease, background-color 250ms ease, border-color 250ms ease;
}

.word-switcher button:hover { transform: translateY(-2px); }

.word-switcher button.is-active {
  border-color: var(--primary-color);
  background: var(--theme-soft-primary);
  color: var(--primary-color);
}

.word-switcher button span {
  color: var(--muted-color);
  font-size: 0.68rem;
  font-weight: 500;
}

.word-swap-enter-active,
.word-swap-leave-active { transition: opacity 250ms ease, transform 250ms ease; }
.word-swap-enter-from { opacity: 0; transform: scale(0.97); }
.word-swap-leave-to { opacity: 0; transform: scale(1.02); }

.orbit-stage {
  --orbit-radius: clamp(7rem, 32vw, 13rem);
  position: relative;
  display: grid;
  width: min(100%, 38rem);
  aspect-ratio: 1;
  place-items: center;
  margin: 0 auto;
  overflow: clip;
  isolation: isolate;
}

.orbit-track {
  position: absolute;
  top: 50%;
  left: 50%;
  aspect-ratio: 1;
  border: 1px solid rgba(var(--primary-color-rgb), 0.2);
  border-radius: 50%;
  pointer-events: none;
  transform: translate(-50%, -50%);
}

.orbit-track--outer { width: 80%; }
.orbit-track--inner { width: 60%; border-style: dashed; opacity: 0.45; }

.orbit-track--outer::before,
.orbit-track--outer::after {
  position: absolute;
  width: 0.48rem;
  height: 0.48rem;
  border-radius: 50%;
  background: var(--accent-color);
  box-shadow: 0 0 16px rgba(var(--accent-color-rgb), 0.56);
  content: '';
}

.orbit-track--outer::before { top: 14%; left: 8%; }
.orbit-track--outer::after { right: 4%; bottom: 23%; width: 0.32rem; height: 0.32rem; }

.letter-orbit {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  animation: orbit-rotate 42s linear infinite;
}

.orbit-node {
  position: absolute;
  display: grid;
  width: 3.8rem;
  height: 3.8rem;
  place-items: center;
  padding: 0;
  border: 1px solid var(--border-color);
  border-radius: 50%;
  background: var(--panel-color-solid);
  box-shadow: 0 12px 28px -18px rgba(20, 12, 32, 0.5);
  cursor: pointer;
  transform: translate(-50%, -50%);
  transition: left 600ms cubic-bezier(0.2, 0.75, 0.2, 1), top 600ms cubic-bezier(0.2, 0.75, 0.2, 1), width 400ms ease, height 400ms ease, transform 400ms cubic-bezier(0.2, 0.75, 0.2, 1), background-color 250ms ease, border-color 250ms ease, box-shadow 250ms ease;
}

.orbit-node__face {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  border-radius: inherit;
  color: var(--primary-color);
  font-family: var(--font-display);
  font-size: 2rem;
  font-weight: 700;
  animation: orbit-counter-rotate 42s linear infinite;
}

.orbit-node:hover,
.orbit-node:focus-visible,
.orbit-node--active {
  z-index: 3;
  width: 4.3rem;
  height: 4.3rem;
  border-color: var(--accent-color);
  background: var(--theme-soft-primary);
  box-shadow: 0 0 0 5px rgba(var(--primary-color-rgb), 0.1), 0 0 28px rgba(var(--primary-color-rgb), 0.25);
  transform: translate(-50%, -50%) scale(1.08);
}

.compliment-panel {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 1.15rem;
  width: min(100%, 38rem);
  min-height: 10rem;
  margin: 0 auto 1.5rem;
  padding: 1.4rem 1.6rem;
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: 1.25rem;
  background:
    radial-gradient(circle at 88% 12%, rgba(var(--accent-color-rgb), 0.15), transparent 34%),
    linear-gradient(120deg, var(--panel-color-solid), var(--theme-soft-primary));
  color: var(--text-color);
  box-shadow: 0 22px 52px -38px var(--primary-color);
}

.compliment-panel::before {
  position: absolute;
  inset: 1.1rem auto 1.1rem 0;
  width: 3px;
  border-radius: 0 999px 999px 0;
  background: linear-gradient(var(--accent-color), var(--primary-color));
  content: '';
}

.compliment-initial {
  display: grid;
  width: 4.3rem;
  height: 4.3rem;
  place-items: center;
  border-radius: 1.1rem;
  border: 1px solid rgba(var(--primary-color-rgb), 0.22);
  background: linear-gradient(145deg, var(--theme-soft-primary), var(--theme-soft-accent));
  color: var(--primary-color);
  font-family: var(--font-display);
  font-size: 2.7rem;
  font-weight: 700;
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.12);
}

.compliment-placeholder :deep(svg) {
  width: 1.6rem;
  height: 1.6rem;
}

.compliment-label {
  color: var(--accent-color);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.compliment-panel h2 {
  margin-top: 0.35rem;
  color: var(--primary-color);
  font-size: 1.45rem;
  font-weight: 700;
}

.compliment-panel div > p:last-child {
  max-width: 42rem;
  margin-top: 0.5rem;
  color: var(--muted-color);
  font-size: 0.92rem;
  line-height: 1.7;
}

.compliment-sparkle {
  width: 1.5rem;
  height: 1.5rem;
  color: var(--accent-color);
}

.compliment-enter-active,
.compliment-leave-active { transition: opacity 220ms ease, transform 300ms cubic-bezier(0.2, 0.75, 0.2, 1); }
.compliment-enter-from { opacity: 0; transform: translateY(0.55rem) scale(0.97); }
.compliment-leave-to { opacity: 0; transform: translateY(-0.3rem); }

.letters-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 2rem;
  color: var(--muted-color);
  font-size: 0.82rem;
}

.letters-footer a {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--primary-color);
  font-weight: 700;
}

.letters-footer :deep(svg) { width: 1rem; height: 1rem; }

.compliment-enter-active,
.compliment-leave-active { transition: opacity 180ms ease, transform 180ms ease; }
.compliment-enter-from { opacity: 0; transform: translateY(0.55rem) scale(0.99); }
.compliment-leave-to { opacity: 0; transform: translateY(-0.3rem); }

@keyframes letters-arrive {
  from { opacity: 0; transform: translateY(0.9rem) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes orbit-rotate {
  to { transform: rotate(1turn); }
}

@keyframes orbit-counter-rotate {
  to { transform: rotate(-1turn); }
}

@media (max-width: 600px) {
  .letters-page { padding: 3.25rem 1rem 7.25rem; }
  .letters-hero h1 { font-size: 3rem; }
  .letters-intro { font-size: 0.9rem; }
  .letters-content { margin-top: 2rem; }
  .orbit-stage { width: 100%; }
  .orbit-node { width: 3.25rem; height: 3.25rem; }
  .orbit-node__face { font-size: 1.7rem; }
  .orbit-node--active { width: 3.8rem; height: 3.8rem; }
  .compliment-panel { grid-template-columns: auto 1fr; gap: 0.8rem; padding: 1rem; }
  .compliment-initial { width: 3.2rem; height: 3.2rem; font-size: 2rem; }
  .compliment-panel h2 { font-size: 1.2rem; }
  .compliment-panel div > p:last-child { font-size: 0.84rem; }
  .compliment-sparkle { display: none; }
  .letters-footer { align-items: flex-start; flex-direction: column; }
}

@media (prefers-reduced-motion: reduce) {
  .letters-hero { animation: none; }
  .letter-orbit,
  .orbit-node__face { animation: none; }
  .word-switcher button,
  .orbit-node,
  .word-swap-enter-active,
  .word-swap-leave-active,
  .compliment-enter-active,
  .compliment-leave-active { transition: none; }
}
</style>
