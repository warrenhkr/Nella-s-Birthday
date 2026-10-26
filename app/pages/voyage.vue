<script setup lang="ts">
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { media } from '../data/media'

const pageElement = ref<HTMLElement | null>(null)
const pageProgressBar = ref<HTMLElement | null>(null)
const isPointerTilting = ref(false)
const flippedPhotos = ref<Record<string, boolean>>({})
const heroTilt = ref({
  '--hero-tilt-x': '0deg',
  '--hero-tilt-y': '0deg'
})

const photos = media.filter(asset => asset.type === 'photo')
const videos = media.filter(asset => asset.type === 'video')
const photoMessages = [
  'Un sourire peut suffire à éclairer toute une journée.',
  'Les petits détails rendent chaque souvenir unique.',
  'Un instant n’a pas besoin d’être grand pour être précieux.'
]
const videoStories = [
  { chapter: 'Le premier mouvement', title: 'La spontanéité', text: 'Ces secondes imprévues qu’on ne pense pas à mettre en scène, et qu’on aime revoir.' },
  { chapter: 'Les détails', title: 'Le goût des petites choses', text: 'Une expression, un geste, une présence. Ce sont souvent ces détails qui restent.' },
  { chapter: 'La liberté', title: 'Le plaisir d’être soi', text: 'Un souvenir garde une énergie particulière quand il ressemble vraiment à la personne qu’on célèbre.' },
  { chapter: 'La parenthèse', title: 'Un instant hors du temps', text: 'On appuie sur lecture et, pendant quelques secondes, on retrouve toute l’ambiance.' },
  { chapter: 'La lumière', title: 'Un sourire retrouvé', text: 'Certaines images ramènent immédiatement une sensation douce, même longtemps après.' },
  { chapter: 'À suivre', title: 'La suite de l’histoire', text: 'Ce parcours garde une place pour les moments heureux qui ne sont pas encore arrivés.' }
]
let heroAnimationContext: gsap.Context | undefined

function togglePhotoFace(id: string) {
  flippedPhotos.value = { ...flippedPhotos.value, [id]: !flippedPhotos.value[id] }
}

function updateHeroTilt(event: PointerEvent) {
  if (event.pointerType !== 'mouse' || !isPointerTilting.value) return

  const target = event.currentTarget
  if (!(target instanceof HTMLElement)) return

  const bounds = target.getBoundingClientRect()
  const horizontal = (event.clientX - bounds.left) / bounds.width - 0.5
  const vertical = (event.clientY - bounds.top) / bounds.height - 0.5

  heroTilt.value = {
    '--hero-tilt-x': `${vertical * -5}deg`,
    '--hero-tilt-y': `${horizontal * 6}deg`
  }
}

function resetHeroTilt() {
  heroTilt.value = { '--hero-tilt-x': '0deg', '--hero-tilt-y': '0deg' }
}

let revealObserver: IntersectionObserver | undefined
let scrollMatchMedia: ReturnType<typeof gsap.matchMedia> | undefined

onMounted(() => {
  const root = pageElement.value
  if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  gsap.registerPlugin(ScrollTrigger)

  heroAnimationContext = gsap.context(() => {
    const entrance = gsap.timeline({ defaults: { ease: 'power3.out' } })

    entrance.from('.journey-hero__copy > *', {
      autoAlpha: 0,
      y: 22,
      duration: 0.7,
      stagger: 0.1
    })
    entrance.from('.hero-photo--main', {
      autoAlpha: 0,
      clipPath: 'inset(12% 40% 12% 40%)',
      scale: 0.88,
      duration: 1.1,
      ease: 'power4.out'
    }, 0.18)
    entrance.from('.hero-photo--left', {
      autoAlpha: 0,
      x: 64,
      rotateY: 5,
      scale: 0.86,
      duration: 0.9
    }, 0.42)
    entrance.from('.hero-photo--right', {
      autoAlpha: 0,
      x: -64,
      rotateY: -5,
      scale: 0.86,
      duration: 0.95
    }, 0.5)
  }, root)

  scrollMatchMedia = gsap.matchMedia(root)
  scrollMatchMedia.add('(prefers-reduced-motion: no-preference)', () => {
    if (pageProgressBar.value) {
      gsap.fromTo(pageProgressBar.value,
        { scaleX: 0, transformOrigin: 'left center' },
        {
          scaleX: 1,
          ease: 'none',
          scrollTrigger: { trigger: root, start: 'top top', end: 'bottom bottom', scrub: 0.35 }
        }
      )
    }

    const tree = root.querySelector<HTMLElement>('.memory-tree')
    const treeLine = root.querySelector<HTMLElement>('.memory-tree__progress')
    if (tree && treeLine) {
      gsap.fromTo(treeLine,
        { scaleY: 0, transformOrigin: 'top center' },
        {
          scaleY: 1,
          ease: 'none',
          scrollTrigger: { trigger: tree, start: 'top 68%', end: 'bottom 42%', scrub: 0.45 }
        }
      )
    }
  })

  const scenes = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'))
  if (!('IntersectionObserver' in window)) {
    scenes.forEach(scene => scene.classList.add('is-visible'))
    return
  }

  root.classList.add('reveal-ready')
  revealObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      entry.target.classList.add('is-visible')

      if (entry.target.classList.contains('memory-node')) {
        const branch = entry.target.querySelector<HTMLElement>('.memory-node__branch')
        const marker = entry.target.querySelector<HTMLElement>('.memory-node__marker')
        const offset = entry.target.classList.contains('memory-node--right') ? 42 : -42

        if (branch) {
          gsap.fromTo(branch,
            { autoAlpha: 0, x: offset, y: 22, filter: 'blur(8px)' },
            { autoAlpha: 1, x: 0, y: 0, filter: 'blur(0px)', duration: 0.9, ease: 'power3.out' }
          )
        }
        if (marker) {
          gsap.fromTo(marker,
            { scale: 0.25, rotate: -35 },
            { scale: 1, rotate: 0, duration: 0.72, ease: 'back.out(2.2)' }
          )
        }
      }

      revealObserver?.unobserve(entry.target)
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' })

  scenes.forEach(scene => revealObserver?.observe(scene))
})

onUnmounted(() => {
  revealObserver?.disconnect()
  scrollMatchMedia?.revert()
  heroAnimationContext?.revert()
})

useHead({
  title: 'Le fil des instants • Osnella Sènami',
  meta: [{ name: 'description', content: 'Un parcours immersif à travers les photos et les vidéos d’Osnella Sènami.' }]
})
</script>

<template>
  <main ref="pageElement" class="theme-page souvenir-journey">
    <div class="journey-progress" aria-hidden="true"><span ref="pageProgressBar" /></div>

    <section class="journey-hero">
      <div class="journey-hero__copy">
        <p class="journey-kicker"><span /> Le fil des instants</p>
        <h1>Certains moments méritent de <em>rester.</em></h1>
        <p class="journey-hero__intro">
          Pas besoin d’un grand événement pour créer un souvenir. Parfois, un regard, un geste ou un fou rire suffit.
        </p>
        <a class="journey-continue" href="#photos">
          <span>Entrer dans les souvenirs</span>
          <UIcon name="i-lucide-arrow-down" />
        </a>
      </div>

      <div
        class="hero-photo-stage"
        :style="heroTilt"
        @pointerenter="isPointerTilting = true"
        @pointermove="updateHeroTilt"
        @pointerleave="isPointerTilting = false; resetHeroTilt()"
      >
        <div class="hero-photo-stage__halo" aria-hidden="true" />
        <figure v-if="photos[1]" class="hero-photo hero-photo--left">
          <NuxtImg
            :src="photos[1].src"
            :alt="photos[1].caption || 'Portrait souvenir d’Osnella Sènami'"
            :width="photos[1].width ?? 720"
            :height="photos[1].height ?? 1280"
            sizes="640:40vw 768:24vw"
            preload
          />
          <figcaption>Un instant à soi</figcaption>
        </figure>
        <figure v-if="photos[0]" class="hero-photo hero-photo--main">
          <NuxtImg
            :src="photos[0].src"
            :alt="photos[0].caption || 'Photo d’Osnella Sènami formant un cœur avec les mains'"
            :width="photos[0].width ?? 720"
            :height="photos[0].height ?? 1280"
            sizes="640:70vw 768:34vw"
            preload
          />
          <figcaption>Osnella Sènami <span>· 18 ans</span></figcaption>
        </figure>
        <figure v-if="photos[2]" class="hero-photo hero-photo--right">
          <NuxtImg
            :src="photos[2].src"
            :alt="photos[2].caption || 'Souvenir spontané d’Osnella Sènami'"
            :width="photos[2].width ?? 720"
            :height="photos[2].height ?? 1280"
            sizes="640:38vw 768:22vw"
          />
          <figcaption>Un détour imprévu</figcaption>
        </figure>
        <span class="hero-photo-stage__index" aria-hidden="true">01 / 03</span>
      </div>
    </section>

    <section id="photos" class="journey-chapter photo-chapter" data-reveal>
      <div class="chapter-heading">
        <p class="journey-kicker"><span /> Chapitre 01 · Les images</p>
        <h2>Des photos qui gardent <em>la lumière.</em></h2>
        <p>Une petite collection de gestes spontanés, de poses improvisées et de souvenirs qui ont leur propre histoire.</p>
      </div>

      <div class="photo-gallery" aria-label="Photos souvenirs">
        <figure
          v-for="(photo, index) in photos"
          :key="photo.id"
          class="memory-photo"
          :class="{ 'memory-photo--flipped': flippedPhotos[photo.id] }"
          :style="{
            '--photo-angle': `${(index - 1) * 5}deg`,
            '--photo-roll': `${(index - 1) * 1.3}deg`
          }"
        >
          <div class="memory-photo__inner">
            <div class="memory-photo__face memory-photo__face--front" :inert="flippedPhotos[photo.id]" :aria-hidden="Boolean(flippedPhotos[photo.id])">
              <NuxtImg
                :src="photo.src"
                :alt="photo.caption || `Souvenir photo ${index + 1} d’Osnella Sènami`"
                :width="photo.width ?? 720"
                :height="photo.height ?? 1280"
                loading="lazy"
                sizes="640:90vw 768:42vw 1024:30vw"
              />
              <div class="memory-photo__caption">
                <span>Image {{ String(index + 1).padStart(2, '0') }}</span>
                <button
                  type="button"
                  :aria-label="`Retourner la photo ${index + 1}`"
                  :aria-pressed="Boolean(flippedPhotos[photo.id])"
                  @click="togglePhotoFace(photo.id)"
                >
                  <UIcon name="i-lucide-repeat-2" />
                </button>
              </div>
            </div>

            <div class="memory-photo__face memory-photo__face--back" :inert="!flippedPhotos[photo.id]" :aria-hidden="!flippedPhotos[photo.id]">
              <UIcon name="i-lucide-heart" class="memory-photo__heart" aria-hidden="true" />
              <p>{{ photoMessages[index] }}</p>
              <span>Osnella Sènami · {{ String(index + 1).padStart(2, '0') }}</span>
              <button type="button" :aria-label="`Revenir à la photo ${index + 1}`" @click="togglePhotoFace(photo.id)">
                <UIcon name="i-lucide-rotate-ccw" /> Voir le souvenir
              </button>
            </div>
          </div>
        </figure>
      </div>
    </section>

    <section class="journey-chapter memory-tree-chapter" data-reveal>
      <div class="chapter-heading chapter-heading--split">
        <div>
          <p class="journey-kicker"><span /> Chapitre 02 · L’arbre des instants</p>
          <h2>Chaque souvenir est une <em>branche de l’histoire.</em></h2>
        </div>
        <p>Les images se répondent d’un côté à l’autre. Chaque vidéo porte un mot tendre, à découvrir en avançant dans le fil.</p>
      </div>

      <div class="memory-tree" aria-label="Six vidéos de souvenirs reliées comme les branches d’un arbre">
        <div class="memory-tree__trunk" aria-hidden="true">
          <span class="memory-tree__progress" />
        </div>

        <article
          v-for="(video, index) in videos"
          :key="video.id"
          class="memory-node"
          :class="index % 2 === 0 ? 'memory-node--left' : 'memory-node--right'"
          data-reveal
        >
          <div class="memory-node__branch">
            <div class="memory-node__media">
              <VideoPlayer
                :src="video.src"
                :poster="video.poster"
                :label="video.caption || `Vidéo souvenir ${index + 1}`"
              />
              <span class="memory-node__film-id">INSTANT {{ String(index + 1).padStart(2, '0') }}</span>
            </div>

            <aside class="memory-node__note">
              <p class="memory-node__chapter">{{ videoStories[index]?.chapter }}</p>
              <h3>{{ video.caption || videoStories[index]?.title }}</h3>
              <p class="memory-node__message">{{ videoStories[index]?.text }}</p>
              <span class="memory-node__duration">
                <UIcon name="i-lucide-clock-3" />
                {{ video.durationSeconds ? `${Math.round(video.durationSeconds)} secondes` : 'Un instant à revoir' }}
              </span>
            </aside>
          </div>

          <span class="memory-node__marker" aria-label="Étape {{ index + 1 }}">
            <span>{{ String(index + 1).padStart(2, '0') }}</span>
          </span>
        </article>
      </div>
    </section>

    <section class="journey-ending" data-reveal>
      <p class="journey-kicker"><span /> Et la suite s’écrit maintenant</p>
      <h2>Les plus beaux souvenirs sont aussi <em>ceux qui arrivent.</em></h2>
      <p>Garde cette page comme un petit endroit où revenir, puis continue le parcours à ta façon.</p>
      <div class="journey-ending__links">
        <NuxtLink to="/lettres"><UIcon name="i-lucide-spell-check" /> Chaque lettre d’Osnella Sènami</NuxtLink>
        <NuxtLink to="/surprise"><UIcon name="i-lucide-gift" /> Découvrir la surprise</NuxtLink>
      </div>
    </section>
  </main>
</template>

<style scoped>
.souvenir-journey {
  min-height: 100vh;
  overflow: clip;
  padding-bottom: 7rem;
  background:
    radial-gradient(ellipse at 72% 12%, rgba(var(--accent-color-rgb), 0.11), transparent 32%),
    linear-gradient(180deg, var(--bg-color-soft), var(--bg-color));
}

.journey-progress {
  position: fixed;
  z-index: 140;
  top: 0;
  right: 0;
  left: 0;
  height: 2px;
  pointer-events: none;
}

.journey-progress > span {
  display: block;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, var(--primary-color), var(--accent-color));
  transform: scaleX(0);
  transform-origin: left center;
  box-shadow: 0 0 12px rgba(var(--accent-color-rgb), 0.6);
}

.journey-hero {
  display: grid;
  min-height: min(48rem, 100svh);
  grid-template-columns: minmax(18rem, 0.8fr) minmax(25rem, 1.2fr);
  align-items: center;
  gap: 2rem;
  max-width: 78rem;
  margin-inline: auto;
  padding: 3rem 2.5rem 4rem;
}

.journey-hero__copy {
  position: relative;
  z-index: 2;
  max-width: 34rem;
}

.journey-kicker {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--accent-color);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.journey-kicker > span {
  width: 1.65rem;
  height: 1px;
  background: var(--accent-color);
}

.journey-hero h1 {
  margin-top: 1.2rem;
  color: var(--text-color);
  font-family: var(--font-display);
  font-size: 4.7rem;
  font-weight: 600;
  line-height: 0.98;
}

.journey-hero h1 em,
.chapter-heading h2 em,
.journey-ending h2 em {
  color: var(--primary-color);
  font-weight: 500;
}

.journey-hero__intro {
  max-width: 28rem;
  margin-top: 1.5rem;
  color: var(--muted-color);
  font-size: 1rem;
  line-height: 1.8;
}

.journey-continue {
  display: inline-flex;
  align-items: center;
  gap: 1rem;
  margin-top: 2rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid var(--border-color);
  color: var(--primary-color);
  font-size: 0.82rem;
  font-weight: 700;
}

.journey-continue :deep(svg) {
  width: 1rem;
  height: 1rem;
  animation: arrow-drift 1.8s ease-in-out infinite;
}

.hero-photo-stage {
  position: relative;
  display: grid;
  min-width: 0;
  height: 40rem;
  place-items: center;
  perspective: 1200px;
  transform: rotateX(var(--hero-tilt-x)) rotateY(var(--hero-tilt-y));
  transform-style: preserve-3d;
  transition: transform 500ms cubic-bezier(0.2, 0.75, 0.2, 1);
}

.hero-photo-stage__halo {
  position: absolute;
  width: 67%;
  aspect-ratio: 1;
  border: 1px solid rgba(var(--primary-color-rgb), 0.17);
  border-radius: 50%;
  transform: rotateX(68deg) translateZ(-5rem);
  box-shadow: 0 0 0 2rem rgba(var(--primary-color-rgb), 0.025), 0 0 0 5rem rgba(var(--accent-color-rgb), 0.025);
}

.hero-photo {
  position: absolute;
  overflow: hidden;
  margin: 0;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 0.85rem;
  background: var(--panel-color-solid);
  box-shadow: 0 30px 80px -38px rgba(30, 18, 42, 0.6);
  transform-style: preserve-3d;
}

.hero-photo img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-photo figcaption {
  position: absolute;
  right: 0.65rem;
  bottom: 0.65rem;
  left: 0.65rem;
  padding: 0.6rem 0.7rem;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 0.55rem;
  background: rgba(22, 15, 31, 0.58);
  color: #fff;
  font-size: 0.66rem;
  backdrop-filter: blur(12px);
}

.hero-photo--main {
  z-index: 2;
  width: 48%;
  height: 78%;
}

.hero-photo--main figcaption span { color: #f4cfe1; }

.hero-photo--left {
  z-index: 1;
  left: 3%;
  width: 38%;
  height: 59%;
  transform: rotateY(18deg) rotateZ(-7deg) translateZ(-3rem);
}

.hero-photo--right {
  z-index: 3;
  right: 1%;
  width: 38%;
  height: 54%;
  transform: rotateY(-16deg) rotateZ(7deg) translateZ(4rem);
}

.hero-photo-stage__index {
  position: absolute;
  right: 0;
  bottom: 2rem;
  color: var(--muted-color);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.12em;
}

.journey-chapter {
  max-width: 78rem;
  margin: 0 auto;
  padding: 6rem 2.5rem;
}

.chapter-heading {
  max-width: 50rem;
  margin: 0 auto 3rem;
}

.chapter-heading h2,
.journey-ending h2 {
  margin-top: 1rem;
  color: var(--text-color);
  font-family: var(--font-display);
  font-size: 3.45rem;
  font-weight: 600;
  line-height: 1.05;
}

.chapter-heading > p:last-child {
  max-width: 37rem;
  margin-top: 1rem;
  color: var(--muted-color);
  font-size: 0.94rem;
  line-height: 1.75;
}

.photo-gallery {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  align-items: center;
  gap: 1.4rem;
  perspective: 1300px;
}

.memory-photo {
  position: relative;
  grid-column: span 4;
  aspect-ratio: 0.74;
  margin: 0;
  perspective: 1100px;
  transform: rotateY(var(--photo-angle)) rotateZ(var(--photo-roll));
  transition: transform 700ms cubic-bezier(0.2, 0.75, 0.2, 1);
}

.memory-photo:nth-child(2) { grid-column: 5 / span 4; transform: translateY(-2rem) rotateY(0); }

.memory-photo__inner {
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
  transition: transform 850ms cubic-bezier(0.2, 0.75, 0.2, 1);
}

.memory-photo--flipped .memory-photo__inner { transform: rotateY(180deg); }

.memory-photo__face {
  position: absolute;
  inset: 0;
  display: flex;
  overflow: hidden;
  flex-direction: column;
  border: 1px solid var(--border-color);
  border-radius: 0.9rem;
  background: var(--panel-color-solid);
  box-shadow: 0 26px 60px -36px rgba(30, 18, 42, 0.52);
  backface-visibility: hidden;
}

.memory-photo__face--front img { display: block; width: 100%; height: 100%; object-fit: cover; }

.memory-photo__caption {
  position: absolute;
  right: 0.7rem;
  bottom: 0.7rem;
  left: 0.7rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 0.6rem;
  background: rgba(20, 14, 29, 0.62);
  color: #fff;
  font-size: 0.68rem;
  backdrop-filter: blur(12px);
}

.memory-photo__caption,
.memory-photo__caption button { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.memory-photo__caption button { width: 2rem; height: 2rem; flex: 0 0 auto; place-content: center; border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 50%; background: rgba(255, 255, 255, 0.12); color: white; cursor: pointer; }
.memory-photo__caption :deep(svg),
.memory-photo__heart { width: 1.1rem; height: 1.1rem; color: #f1c5dc; }

.memory-photo__face--back {
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  background:
    radial-gradient(circle at 50% 30%, rgba(var(--accent-color-rgb), 0.2), transparent 52%),
    var(--theme-surface-gradient);
  text-align: center;
  transform: rotateY(180deg);
}

.memory-photo__heart { width: 1.5rem; height: 1.5rem; }
.memory-photo__face--back p { margin-top: 1rem; color: var(--text-color); font-family: var(--font-display); font-size: 1.55rem; line-height: 1.12; }
.memory-photo__face--back > span { margin-top: 0.8rem; color: var(--muted-color); font-family: var(--font-mono); font-size: 0.6rem; letter-spacing: 0.12em; text-transform: uppercase; }
.memory-photo__face--back button { display: inline-flex; align-items: center; gap: 0.4rem; margin-top: 1rem; padding: 0.55rem 0.7rem; border: 1px solid var(--border-color); border-radius: 999px; background: var(--panel-color); color: var(--primary-color); font-size: 0.7rem; cursor: pointer; }
.memory-photo__face--back button :deep(svg) { width: 0.9rem; height: 0.9rem; }

.chapter-heading--split {
  display: grid;
  grid-template-columns: 1fr 0.65fr;
  align-items: end;
  gap: 3rem;
  max-width: none;
}

.chapter-heading--split > p:last-child { margin-bottom: 0.35rem; }

.memory-tree {
  position: relative;
  max-width: 76rem;
  margin-inline: auto;
  padding-block: 0.5rem 2rem;
}

.memory-tree__trunk {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  overflow: hidden;
  background: var(--border-color);
  transform: translateX(-50%);
}

.memory-tree__progress {
  display: block;
  width: 100%;
  height: 100%;
  background: linear-gradient(180deg, var(--primary-color), var(--accent-color));
  transform: scaleY(0);
  transform-origin: top center;
  box-shadow: 0 0 16px rgba(var(--accent-color-rgb), 0.55);
}

.memory-node {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 4rem minmax(0, 1fr);
  align-items: start;
  margin-bottom: 2.25rem;
  opacity: 1;
  transition: opacity 700ms ease, transform 700ms cubic-bezier(0.2, 0.75, 0.2, 1);
}

.memory-node:last-child { margin-bottom: 0; }

.memory-node__branch {
  display: grid;
  grid-column: 1;
  grid-row: 1;
  grid-template-columns: minmax(0, 0.78fr) minmax(0, 1fr);
  align-items: center;
  gap: 0.9rem;
  min-width: 0;
  perspective: 1000px;
}

.memory-node--right .memory-node__branch {
  grid-column: 3;
  grid-template-columns: minmax(0, 1fr) minmax(0, 0.78fr);
}

.memory-node--right .memory-node__media { order: 2; }
.memory-node--right .memory-node__note { order: 1; }

.memory-node__marker {
  position: relative;
  z-index: 2;
  display: grid;
  width: 2.8rem;
  height: 2.8rem;
  grid-column: 2;
  grid-row: 1;
  place-items: center;
  justify-self: center;
  margin-top: 1.7rem;
  border: 1px solid var(--border-color);
  border-radius: 50%;
  background: var(--bg-color-soft);
  box-shadow: 0 0 0 0.4rem var(--bg-color);
  color: var(--primary-color);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  transition: background-color 300ms ease, border-color 300ms ease, box-shadow 400ms ease, color 300ms ease;
}

.memory-node__marker::before {
  position: absolute;
  top: 50%;
  width: 1.25rem;
  height: 1px;
  background: var(--border-color);
  content: '';
}

.memory-node--left .memory-node__marker::before { right: 100%; }
.memory-node--right .memory-node__marker::before { left: 100%; }

.memory-node.is-visible .memory-node__marker {
  border-color: var(--accent-color);
  background: var(--primary-color);
  box-shadow: 0 0 0 0.4rem var(--bg-color), 0 0 1.5rem rgba(var(--primary-color-rgb), 0.4);
  color: white;
}

.memory-node__media {
  position: relative;
  position: relative;
  overflow: hidden;
  aspect-ratio: 0.64;
  border: 1px solid var(--border-color);
  border-radius: 0.85rem;
  background: #17111e;
  box-shadow: 0 28px 54px -34px rgba(30, 18, 42, 0.62);
  transform: rotateY(-4deg) rotateZ(-1deg);
  transition: transform 600ms cubic-bezier(0.2, 0.75, 0.2, 1), box-shadow 600ms ease;
}

.memory-node--right .memory-node__media { transform: rotateY(4deg) rotateZ(1deg); }
.memory-node__media :deep(.video-player) {
  width: 100%;
  height: 100%;
}

.memory-node__media:hover,
.memory-node.is-visible .memory-node__media { box-shadow: 0 34px 65px -32px rgba(30, 18, 42, 0.7); }
.memory-node__media:hover { transform: rotateY(0) rotateZ(0) translateY(-0.3rem); }

.memory-node__film-id {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  padding: 0.35rem 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 999px;
  background: rgba(15, 10, 22, 0.58);
  color: white;
  font-family: var(--font-mono);
  font-size: 0.56rem;
  letter-spacing: 0.12em;
  pointer-events: none;
}

.memory-node__note {
  position: relative;
  z-index: 1;
  min-width: 0;
  padding: 1rem 0.9rem;
  border: 1px solid var(--border-color);
  border-radius: 0.9rem;
  background: color-mix(in srgb, var(--theme-panel-solid) 58%, transparent);
  box-shadow: 0 18px 48px -38px rgba(23, 14, 34, 0.5);
  backdrop-filter: blur(16px);
  transform: translateY(0.6rem);
  transition: border-color 500ms ease, background-color 500ms ease, transform 700ms cubic-bezier(0.2, 0.75, 0.2, 1);
}

.memory-node.is-visible .memory-node__note { border-color: rgba(var(--accent-color-rgb), 0.42); transform: translateY(0); }

.memory-node__chapter {
  color: var(--accent-color);
  font-family: var(--font-mono);
  font-size: 0.57rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.memory-node__note h3 {
  margin-top: 0.7rem;
  color: var(--text-color);
  font-family: var(--font-display);
  font-size: 1.45rem;
  font-weight: 600;
  line-height: 1.05;
}

.memory-node__message {
  margin-top: 0.65rem;
  color: var(--muted-color);
  font-size: 0.77rem;
  line-height: 1.65;
}

.memory-node__duration {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.8rem;
  color: var(--primary-color);
  font-family: var(--font-mono);
  font-size: 0.58rem;
}

.memory-node__duration :deep(svg) { width: 0.85rem; height: 0.85rem; }

.journey-ending {
  max-width: 65rem;
  margin: 4rem auto 0;
  padding: 6rem 2.5rem;
  text-align: center;
}

.journey-ending .journey-kicker { justify-content: center; }
.journey-ending h2 { max-width: 52rem; margin-inline: auto; }
.journey-ending > p:not(.journey-kicker) { max-width: 38rem; margin: 1rem auto 0; color: var(--muted-color); line-height: 1.7; }

.journey-ending__links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1.8rem;
}

.journey-ending__links a {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  min-height: 2.8rem;
  padding: 0.65rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--panel-color);
  color: var(--primary-color);
  font-size: 0.82rem;
  font-weight: 700;
  transition: transform 200ms ease, border-color 200ms ease;
}

.journey-ending__links a:hover { transform: translateY(-2px); border-color: var(--primary-color); }
.journey-ending__links :deep(svg) { width: 1rem; height: 1rem; }

.reveal-ready [data-reveal]:not(.is-visible) {
  opacity: 0;
  transform: translateY(2rem);
}

[data-reveal] {
  transition: opacity 850ms ease, transform 850ms cubic-bezier(0.2, 0.75, 0.2, 1);
}

[data-reveal].is-visible { opacity: 1; transform: translateY(0); }

@keyframes arrow-drift {
  50% { transform: translateY(0.25rem); }
}

@media (max-width: 800px) {
  .journey-hero {
    min-height: auto;
    grid-template-columns: 1fr;
    gap: 0.5rem;
    padding: 4.5rem 1.25rem 2.5rem;
  }

  .journey-hero__copy { max-width: 42rem; }
  .journey-hero h1 { max-width: 13ch; font-size: 3.4rem; }
  .hero-photo-stage { height: 34rem; margin-top: 0.25rem; perspective: 950px; }
  .hero-photo--main { width: 51%; height: 80%; }
  .hero-photo--left { left: 4%; width: 40%; height: 61%; }
  .hero-photo--right { right: 3%; width: 39%; height: 54%; }
  .journey-chapter { padding: 4.5rem 1.25rem; }
  .chapter-heading h2,
  .journey-ending h2 { font-size: 2.8rem; }
  .photo-gallery { gap: 0.7rem; }
  .memory-photo { grid-column: span 6; }
  .memory-photo:nth-child(2) { grid-column: span 6; transform: translateY(0); }
  .chapter-heading--split { grid-template-columns: 1fr; gap: 0.5rem; }
  .memory-tree { padding-left: 0; }
  .memory-tree__trunk { left: 1.35rem; }
  .memory-node { grid-template-columns: 2.7rem minmax(0, 1fr); gap: 0.55rem; margin-bottom: 1.5rem; }
  .memory-node__marker { width: 2.45rem; height: 2.45rem; grid-column: 1; margin-top: 1.4rem; font-size: 0.62rem; }
  .memory-node__marker::before { display: none; }
  .memory-node__branch,
  .memory-node--right .memory-node__branch { grid-column: 2; grid-template-columns: minmax(0, 0.82fr) minmax(0, 1fr); gap: 0.55rem; }
  .memory-node--right .memory-node__media,
  .memory-node--right .memory-node__note { order: initial; }
  .memory-node__media,
  .memory-node--right .memory-node__media { transform: none; border-radius: 0.65rem; }
  .memory-node__note { padding: 0.65rem 0.58rem; border-radius: 0.65rem; }
  .memory-node__note h3 { margin-top: 0.45rem; font-size: 1.05rem; }
  .memory-node__message { margin-top: 0.45rem; font-size: 0.68rem; line-height: 1.45; }
  .memory-node__chapter { font-size: 0.49rem; letter-spacing: 0.08em; }
  .memory-node__duration { margin-top: 0.55rem; font-size: 0.5rem; }
  .journey-ending { margin-top: 1rem; padding: 4.5rem 1.25rem; }
}

@media (max-width: 440px) {
  .journey-hero h1 { font-size: 2.8rem; }
  .hero-photo-stage { height: 27rem; }
  .hero-photo--main { width: 54%; height: 78%; }
  .hero-photo--left { left: 1%; width: 41%; height: 58%; }
  .hero-photo--right { right: 0; width: 40%; height: 52%; }
  .hero-photo figcaption { right: 0.4rem; bottom: 0.4rem; left: 0.4rem; padding: 0.45rem; font-size: 0.58rem; }
  .chapter-heading h2,
  .journey-ending h2 { font-size: 2.3rem; }
  .memory-node { grid-template-columns: 2.25rem minmax(0, 1fr); gap: 0.45rem; }
  .memory-tree__trunk { left: 1.1rem; }
  .memory-node__marker { width: 2rem; height: 2rem; margin-top: 1.25rem; }
  .memory-node__note { padding: 0.56rem 0.48rem; }
  .memory-node__note h3 { font-size: 0.92rem; }
  .memory-node__message { font-size: 0.62rem; }
}

@media (prefers-reduced-motion: reduce) {
  .journey-continue :deep(svg) { animation: none; }
  .hero-photo-stage,
  .memory-photo,
  .memory-photo__inner,
  .memory-node__media,
  .memory-node__note,
  .journey-ending__links a,
  [data-reveal] { transition: none; transform: none; }
  .journey-progress { display: none; }
  .reveal-ready [data-reveal]:not(.is-visible) { opacity: 1; }
}
</style>