<script setup lang="ts">
import { AGE } from '../data/config'
import { media } from '../data/media'

const emit = defineEmits<{ (event: 'enter'): void }>()
const photos = media.filter(asset => asset.type === 'photo')
const enterButton = ref<HTMLButtonElement | null>(null)
let previousBodyOverflow = ''

function enterSite() {
  emit('enter')
}

onMounted(() => {
  previousBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  enterButton.value?.focus({ preventScroll: true })
})

onUnmounted(() => {
  document.body.style.overflow = previousBodyOverflow
})
</script>

<template>
  <section class="entry-gate" aria-label="Bienvenue chez Osnella Sènami">
    <div class="entry-gate__grain" aria-hidden="true" />

    <div class="entry-gate__frame">
      <header class="entry-gate__topline">
        <span>Une histoire pour Osnella Sènami</span>
        <span class="entry-gate__edition">ÉDITION {{ AGE }} ANS</span>
      </header>

      <div class="entry-gate__layout">
        <div class="entry-gate__copy">
          <p class="entry-gate__eyebrow"><span /> Une petite attention, rien que pour toi</p>
          <h1>Entre dans un monde <em>fait de souvenirs.</em></h1>
          <p class="entry-gate__message">
            Des images à retrouver, des mots à découvrir, quelques jeux et une surprise gardée pour la fin.
          </p>

          <div class="entry-gate__occasion">
            <span class="entry-gate__age">{{ AGE }}</span>
            <span><strong>ans aujourd’hui</strong><br>et tant d’histoires à venir</span>
          </div>

          <button ref="enterButton" type="button" class="entry-gate__enter" @click="enterSite">
            Entrer dans l’histoire
            <UIcon name="i-lucide-arrow-up-right" />
          </button>

          <p class="entry-gate__hint">Prends ton temps. Le dernier chapitre t’attend.</p>
        </div>

        <div class="entry-gate__visual" aria-label="Quelques portraits d’Osnella Sènami">
          <div class="entry-gate__orbit entry-gate__orbit--outer" aria-hidden="true" />
          <div class="entry-gate__orbit entry-gate__orbit--inner" aria-hidden="true" />

          <figure v-if="photos[1]" class="entry-photo entry-photo--side entry-photo--left">
            <NuxtImg
              :src="photos[1].src"
              :alt="photos[1].caption || 'Portrait souvenir d’Osnella Sènami'"
              :width="photos[1].width ?? 720"
              :height="photos[1].height ?? 1280"
              sizes="640:40vw 768:22vw"
              preload
            />
            <figcaption>Les petits instants</figcaption>
          </figure>

          <figure v-if="photos[0]" class="entry-photo entry-photo--main">
            <NuxtImg
              :src="photos[0].src"
              :alt="photos[0].caption || 'Osnella Sènami, les mains réunies en forme de cœur'"
              :width="photos[0].width ?? 720"
              :height="photos[0].height ?? 1280"
              sizes="640:80vw 768:38vw"
              preload
            />
            <figcaption>Joyeux anniversaire, Osnella Sènami</figcaption>
          </figure>

          <figure v-if="photos[2]" class="entry-photo entry-photo--side entry-photo--right">
            <NuxtImg
              :src="photos[2].src"
              :alt="photos[2].caption || 'Un souvenir spontané d’Osnella Sènami'"
              :width="photos[2].width ?? 720"
              :height="photos[2].height ?? 1280"
              sizes="640:40vw 768:22vw"
              preload
            />
            <figcaption>Une surprise dans le cadre</figcaption>
          </figure>

          <span class="entry-gate__visual-note" aria-hidden="true">MC · {{ AGE }}</span>
        </div>
      </div>

      <footer class="entry-gate__footer">
        <span>Osnella Sènami</span>
        <span>Fait avec tendresse</span>
      </footer>
    </div>
  </section>
</template>

<style scoped>
.entry-gate {
  position: fixed;
  z-index: 1500;
  inset: 0;
  overflow: auto;
  background:
    radial-gradient(ellipse at 77% 42%, rgba(var(--accent-color-rgb), 0.13), transparent 34%),
    var(--bg-color);
  color: var(--text-color);
  animation: gate-fade-in 550ms ease both;
  isolation: isolate;
}

.entry-gate__grain {
  position: absolute;
  z-index: -1;
  inset: 0;
  background-image: linear-gradient(rgba(var(--primary-color-rgb), 0.025) 1px, transparent 1px);
  background-size: 100% 5px;
  opacity: 0.34;
  pointer-events: none;
}

.entry-gate__frame {
  display: flex;
  min-height: 100svh;
  flex-direction: column;
  max-width: 90rem;
  margin-inline: auto;
  padding: 1.5rem 3.25rem 1.1rem;
}

.entry-gate__topline,
.entry-gate__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  color: var(--muted-color);
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.entry-gate__edition { color: var(--accent-color); }

.entry-gate__layout {
  display: grid;
  flex: 1;
  grid-template-columns: minmax(19rem, 0.9fr) minmax(27rem, 1.1fr);
  align-items: center;
  gap: 1.5rem;
  padding-block: 1rem;
}

.entry-gate__copy {
  position: relative;
  z-index: 2;
  max-width: 36rem;
  animation: gate-copy-arrive 850ms 120ms cubic-bezier(0.2, 0.75, 0.2, 1) both;
}

.entry-gate__eyebrow {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--accent-color);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.19em;
  text-transform: uppercase;
}

.entry-gate__eyebrow span {
  width: 1.6rem;
  height: 1px;
  background: var(--accent-color);
}

.entry-gate h1 {
  max-width: 10ch;
  margin-top: 1.25rem;
  color: var(--text-color);
  font-family: var(--font-display);
  font-size: 4.6rem;
  font-weight: 600;
  line-height: 0.99;
}

.entry-gate h1 em {
  color: var(--primary-color);
  font-weight: 500;
}

.entry-gate__message {
  max-width: 29rem;
  margin-top: 1.2rem;
  color: var(--muted-color);
  font-size: 0.98rem;
  line-height: 1.75;
}

.entry-gate__occasion {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.35rem;
  color: var(--muted-color);
  font-size: 0.77rem;
  line-height: 1.5;
}

.entry-gate__occasion strong { color: var(--primary-color); }

.entry-gate__age {
  display: grid;
  width: 3.15rem;
  height: 3.15rem;
  place-items: center;
  border: 1px solid var(--border-color);
  border-radius: 50%;
  background: var(--panel-color);
  color: var(--primary-color);
  font-family: var(--font-display);
  font-size: 1.65rem;
}

.entry-gate__enter {
  display: inline-flex;
  min-height: 3.15rem;
  align-items: center;
  gap: 1.4rem;
  margin-top: 1.55rem;
  padding: 0.75rem 1rem 0.75rem 1.2rem;
  border: 1px solid var(--primary-color);
  border-radius: 999px;
  background: var(--primary-color);
  box-shadow: 0 14px 35px -22px var(--primary-color);
  color: #fff;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 220ms ease, box-shadow 220ms ease, background-color 220ms ease;
}

.entry-gate__enter:hover,
.entry-gate__enter:focus-visible {
  transform: translateY(-2px);
  background: color-mix(in srgb, var(--primary-color) 88%, black);
  box-shadow: 0 18px 38px -20px var(--primary-color);
}

.entry-gate__enter :deep(svg) { width: 1rem; height: 1rem; }

.entry-gate__hint {
  margin-top: 0.85rem;
  color: var(--muted-color);
  font-size: 0.72rem;
}

.entry-gate__visual {
  position: relative;
  display: grid;
  min-width: 0;
  height: min(73svh, 46rem);
  min-height: 30rem;
  place-items: center;
  perspective: 1100px;
}

.entry-gate__orbit {
  position: absolute;
  width: 70%;
  aspect-ratio: 1;
  border: 1px solid rgba(var(--primary-color-rgb), 0.16);
  border-radius: 50%;
  transform: rotateX(68deg);
  pointer-events: none;
}

.entry-gate__orbit--inner {
  width: 54%;
  border-style: dashed;
  opacity: 0.52;
  transform: rotateX(68deg) rotateZ(18deg);
}

.entry-photo {
  position: absolute;
  overflow: hidden;
  margin: 0;
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 0.85rem;
  background: var(--panel-color-solid);
  box-shadow: 0 28px 75px -38px rgba(25, 15, 36, 0.56);
  transform-style: preserve-3d;
}

.entry-photo img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.entry-photo figcaption {
  position: absolute;
  right: 0.65rem;
  bottom: 0.65rem;
  left: 0.65rem;
  padding: 0.58rem 0.68rem;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 0.55rem;
  background: rgba(20, 14, 29, 0.6);
  color: #fff;
  font-size: 0.65rem;
  backdrop-filter: blur(12px);
}

.entry-photo--main {
  z-index: 2;
  width: 53%;
  height: 84%;
  animation: gate-photo-open 1100ms 80ms cubic-bezier(0.16, 0.78, 0.22, 1) both;
}

.entry-photo--left {
  z-index: 1;
  left: 3%;
  width: 39%;
  height: 62%;
  transform: rotateY(17deg) rotateZ(-7deg) translateZ(-3rem);
  animation: gate-left-open 920ms 160ms cubic-bezier(0.16, 0.78, 0.22, 1) both;
}

.entry-photo--right {
  z-index: 3;
  right: 1%;
  width: 38%;
  height: 54%;
  transform: rotateY(-15deg) rotateZ(6deg) translateZ(4rem);
  animation: gate-right-open 940ms 240ms cubic-bezier(0.16, 0.78, 0.22, 1) both;
}

.entry-gate__visual-note {
  position: absolute;
  right: 0;
  bottom: 0.7rem;
  color: var(--muted-color);
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.16em;
}

.entry-gate__footer { padding-top: 0.8rem; border-top: 1px solid var(--border-color); }

@keyframes gate-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes gate-copy-arrive {
  from { opacity: 0; transform: translateY(1rem); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes gate-photo-open {
  from { opacity: 0; clip-path: inset(12% 40%); transform: translateZ(-4rem) scale(0.88); }
  to { opacity: 1; clip-path: inset(0); transform: translateZ(0) scale(1); }
}

@keyframes gate-left-open {
  from { opacity: 0; transform: rotateY(17deg) rotateZ(-7deg) translateX(4rem) translateZ(-4rem) scale(0.82); }
  to { opacity: 1; transform: rotateY(17deg) rotateZ(-7deg) translateX(0) translateZ(-3rem) scale(1); }
}

@keyframes gate-right-open {
  from { opacity: 0; transform: rotateY(-15deg) rotateZ(6deg) translateX(-4rem) translateZ(0) scale(0.82); }
  to { opacity: 1; transform: rotateY(-15deg) rotateZ(6deg) translateX(0) translateZ(4rem) scale(1); }
}

@media (max-width: 800px) {
  .entry-gate__frame { padding: 1rem 1.2rem 0.85rem; }
  .entry-gate__layout { grid-template-columns: 1fr; gap: 0; padding-block: 0.5rem; }
  .entry-gate__visual { grid-row: 1; height: 48svh; min-height: 18rem; max-height: 27rem; }
  .entry-gate__copy { grid-row: 2; max-width: 42rem; padding: 0 0.2rem 1rem; }
  .entry-gate h1 { max-width: 13ch; margin-top: 0.8rem; font-size: 3.15rem; }
  .entry-gate__message { margin-top: 0.65rem; font-size: 0.86rem; line-height: 1.55; }
  .entry-gate__occasion { margin-top: 0.75rem; }
  .entry-gate__age { width: 2.6rem; height: 2.6rem; font-size: 1.35rem; }
  .entry-gate__enter { min-height: 2.8rem; margin-top: 0.9rem; }
  .entry-gate__hint { margin-top: 0.55rem; }
  .entry-gate__footer { font-size: 0.58rem; }
  .entry-photo--main { width: 48%; height: 88%; }
  .entry-photo--left { left: 4%; width: 36%; height: 62%; }
  .entry-photo--right { right: 3%; width: 36%; height: 57%; }
}

@media (max-width: 420px) {
  .entry-gate__frame { padding-inline: 0.85rem; }
  .entry-gate__topline { font-size: 0.57rem; }
  .entry-gate__visual { height: 42svh; min-height: 15rem; }
  .entry-gate h1 { font-size: 2.55rem; }
  .entry-gate__eyebrow { font-size: 0.57rem; }
  .entry-gate__message { max-width: 30rem; }
  .entry-photo figcaption { right: 0.35rem; bottom: 0.35rem; left: 0.35rem; padding: 0.4rem; font-size: 0.56rem; }
}

@media (prefers-reduced-motion: reduce) {
  .entry-gate,
  .entry-gate__copy,
  .entry-photo { animation: none; }
  .entry-gate__enter { transition: none; }
}
</style>