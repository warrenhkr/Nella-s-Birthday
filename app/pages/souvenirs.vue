<script setup lang="ts">
import { media, type MediaAsset } from '../data/media'

type MediaKind = 'photo' | 'video'
interface MotionEffect {
  id: string
  name: string
  note: string
  multi?: boolean
}

const defaultEffect: MotionEffect = { id: 'soft-focus', name: 'Mise au point', note: 'Le flou se dissipe doucement.' }
const effects: MotionEffect[] = [
  defaultEffect,
  { id: 'curtain', name: 'Rideau', note: 'Le cadre se dévoile de gauche à droite.' },
  { id: 'rise', name: 'Élévation', note: 'Le souvenir remonte dans la lumière.' },
  { id: 'zoom', name: 'Zoom doux', note: 'Un rapprochement lent donne de la profondeur.' },
  { id: 'shutter', name: 'Obturateur', note: 'Deux volets s’ouvrent sur l’image.' },
  { id: 'film', name: 'Pellicule', note: 'Une arrivée verticale inspirée du cinéma.' },
  { id: 'turn', name: 'Rotation', note: 'Une bascule légère révèle le média.' },
  { id: 'split', name: 'Double ouverture', note: 'Ton image se révèle depuis le centre.' },
  { id: 'drift', name: 'Dérive', note: 'Un mouvement latéral s’arrête en douceur.' },
  { id: 'flash', name: 'Flash photo', note: 'Un éclair bref accompagne l’apparition.' },
  { id: 'flip-up', name: 'Flip vers le haut', note: 'L’image bascule vers l’avant et revient de face.' },
  { id: 'flip-down', name: 'Flip vers le bas', note: 'Ton image pivote vers l’arrière autour d’un axe horizontal.' },
  { id: 'flip-left', name: 'Flip vers la gauche', note: 'Une rotation 3D révèle le portrait.' },
  { id: 'flip-right', name: 'Flip vers la droite', note: 'Le portrait pivote puis retrouve sa face.' },
  { id: 'spin-in', name: 'Spirale', note: 'Un tour ample se calme dans le cadre.' },
  { id: 'iris', name: 'Iris', note: 'L’image s’ouvre depuis un cercle central.' },
  { id: 'fold', name: 'Pliage', note: 'Le cadre se déplie en deux panneaux.' },
  { id: 'wipe-vertical', name: 'Volet vertical', note: 'Un rideau descend sur l’image.' },
  { id: 'diagonal-wipe', name: 'Diagonale', note: 'Une ouverture oblique balaie le cadre.' },
  { id: 'elastic-pop', name: 'Rebond élastique', note: 'Une arrivée souple dépasse puis se pose.' },
  { id: 'dissolve', name: 'Dissolution', note: 'Le flou et la lumière font apparaître l’image.' },
  { id: 'pulse-zoom', name: 'Pulsation', note: 'Deux impulsions rapprochent le souvenir.' },
  { id: 'multi-rejoin', name: 'Rassembler', note: 'Les photos séparées se recollent au centre.', multi: true },
  { id: 'multi-scatter', name: 'Éparpiller', note: 'Les images quittent leur grille et s’écartent.', multi: true },
  { id: 'multi-flip-x', name: 'Flip sur X', note: 'Chaque image bascule puis revient de face.', multi: true },
  { id: 'reel', name: 'Défilé', note: 'Le montage entier glisse en scène, puis se stabilise.', multi: true },
  { id: 'constellation', name: 'Constellation', note: 'Toute la mosaïque prend forme dans un même mouvement.', multi: true },
  { id: 'contact-sheet', name: 'Planche contact', note: 'Ta planche s’ouvre depuis le centre.', multi: true },
  { id: 'flipbook', name: 'Feuilletage', note: 'Le montage pivote comme une seule page.', multi: true },
  { id: 'parade', name: 'Grande parade', note: 'Toute la composition arrive et rebondit ensemble.', multi: true },
  { id: 'memory-deck', name: 'Memory deck', note: 'La pile commune s’incline en perspective.', multi: true },
  { id: 'celebration', name: 'Celebration reveal', note: 'La composition se dévoile derrière deux volets.', multi: true },
  { id: 'floating-orbit', name: 'Floating orbit', note: 'Tes images flottent et tournent ensemble.', multi: true },
  { id: 'parallax-strip', name: 'Parallax strip', note: 'La bande entière traverse le cadre avec profondeur.', multi: true },
  { id: 'scrapbook', name: 'Scrapbook flip', note: 'Le montage s’ouvre comme une page de carnet.', multi: true },
  { id: 'multi-flip-up', name: 'Flip groupe vers le haut', note: 'Toute la mosaïque bascule sur l’axe X.', multi: true },
  { id: 'multi-flip-down', name: 'Flip groupe vers le bas', note: 'Le montage fait un tour arrière commun.', multi: true },
  { id: 'multi-flip-left', name: 'Flip groupe à gauche', note: 'La composition entière pivote sur l’axe Y.', multi: true },
  { id: 'multi-flip-right', name: 'Flip groupe à droite', note: 'Les médias reviennent ensemble de face.', multi: true },
  { id: 'multi-twist', name: 'Tourbillon', note: 'La mosaïque tourne et ralentit au centre.', multi: true },
  { id: 'multi-fan', name: 'Éventail', note: 'La planche se déploie en perspective.', multi: true },
  { id: 'multi-stack', name: 'Pile animée', note: 'Le montage descend puis se redresse.', multi: true },
  { id: 'multi-squeeze', name: 'Ouverture', note: 'La composition se déplie depuis une ligne.', multi: true },
  { id: 'multi-bloom', name: 'Éclosion', note: 'Le groupe se révèle dans une expansion douce.', multi: true },
  { id: 'multi-sweep', name: 'Balayage', note: 'Un rideau traverse toute la composition.', multi: true },
  { id: 'multi-fall', name: 'Chute', note: 'Ta planche tombe puis se pose en douceur.', multi: true },
  { id: 'multi-rise', name: 'Ascension', note: 'Tous les souvenirs remontent ensemble.', multi: true },
  { id: 'multi-turn', name: 'Grand retournement', note: 'La mosaïque entière fait un tour complet.', multi: true },
  { id: 'multi-prism', name: 'Prisme', note: 'Le groupe traverse deux axes avant de se poser.', multi: true },
  { id: 'multi-shuffle', name: 'Mélange', note: 'La planche glisse, pivote et se stabilise.', multi: true }
]

const photos = media.filter(asset => asset.type === 'photo')
const videos = media.filter(asset => asset.type === 'video')
const activeKind = ref<MediaKind>('photo')
const selectedMediaId = ref(photos[0]?.id ?? '')
const selectedEffectId = ref(defaultEffect.id)
const replayCount = ref(0)
const sequencePlaying = ref(false)
const sequenceStep = ref(0)
let sequenceTimer: ReturnType<typeof setTimeout> | undefined
let sequenceIntervalMs = 1450

const activeMedia = computed(() => activeKind.value === 'photo' ? photos : videos)
const selectedMedia = computed(() => activeMedia.value.find(asset => asset.id === selectedMediaId.value) ?? activeMedia.value[0])
const selectedMediaIndex = computed(() => Math.max(0, activeMedia.value.findIndex(asset => asset.id === selectedMediaId.value)))
const selectedEffect = computed(() => effects.find(effect => effect.id === selectedEffectId.value) ?? defaultEffect)
const isMultiEffect = computed(() => selectedEffect.value.multi === true)
const multiSceneClass = computed(() => `multi-scene--${selectedEffect.value.id}`)
const selectedMediaLabel = computed(() => selectedMedia.value
  ? isMultiEffect.value
    ? `${activeMedia.value.length} ${activeKind.value === 'photo' ? 'photos' : 'vidéos'}`
    : `${activeKind.value === 'photo' ? 'Photo' : 'Vidéo'} ${selectedMediaIndex.value + 1}`
  : '')
const sequenceStatus = computed(() => {
  if (sequencePlaying.value) return `Animation ${sequenceStep.value} / ${effects.length}`
  if (sequenceStep.value === effects.length) return `${effects.length} animations terminées`
  if (sequenceStep.value > 0) return `Arrêt à ${sequenceStep.value} / ${effects.length}`
  return ''
})

function frameMotionStyle(index: number) {
  const column = (index % 3) - 1
  const row = Math.floor(index / 3)
  const verticalOffset = activeMedia.value.length === 3
    ? (column === 0 ? 0 : 1)
    : row === 0 ? -1 : 1

  return {
    '--frame-delay': `${index * 0.14}s`,
    '--scatter-x': `${column * 6}rem`,
    '--scatter-y': `${verticalOffset * 3.5}rem`,
    '--scatter-rotation': `${column * 11}deg`
  }
}

watch(activeKind, (kind) => {
  stopSequence()
  sequenceStep.value = 0
  selectedMediaId.value = (kind === 'photo' ? photos : videos)[0]?.id ?? ''
  replayCount.value += 1
})

function stopSequence() {
  if (sequenceTimer) clearTimeout(sequenceTimer)
  sequenceTimer = undefined
  sequencePlaying.value = false
}

function playSequenceStep(index: number) {
  const effect = effects[index]
  if (!effect) {
    stopSequence()
    return
  }

  sequenceStep.value = index + 1
  selectedEffectId.value = effect.id
  replayCount.value += 1
  sequenceTimer = setTimeout(() => playSequenceStep(index + 1), sequenceIntervalMs)
}

function toggleSequence() {
  if (sequencePlaying.value) {
    stopSequence()
    return
  }

  sequenceStep.value = 0
  sequencePlaying.value = true
  sequenceIntervalMs = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 220 : 1450
  playSequenceStep(0)
}

function selectMedia(asset: MediaAsset) {
  stopSequence()
  sequenceStep.value = 0
  selectedMediaId.value = asset.id
  replayCount.value += 1
}

function selectMediaById(event: Event) {
  const select = event.currentTarget
  if (!(select instanceof HTMLSelectElement)) return
  const asset = activeMedia.value.find(item => item.id === select.value)
  if (asset) selectMedia(asset)
}

function selectEffect(effectId: (typeof effects)[number]['id']) {
  stopSequence()
  sequenceStep.value = 0
  selectedEffectId.value = effectId
  replayCount.value += 1
}

function replayEffect() {
  stopSequence()
  sequenceStep.value = 0
  replayCount.value += 1
}

onBeforeUnmount(stopSequence)

useHead({
  title: 'Le labo des instants • Osnella Sènami',
  meta: [{ name: 'description', content: 'Explore cinquante animations photo et vidéo, puis lance une séquence complète de transitions et de montages.' }]
})
</script>

<template>
  <main
    class="theme-page motion-lab"
    :class="{ 'is-sequence-playing': sequencePlaying }"
  >
    <header class="motion-topbar">
      <NuxtLink
        to="/anniversaire"
        class="motion-back"
      >
        <UIcon
          name="i-lucide-arrow-left"
          aria-hidden="true"
        /> Retour à la fête
      </NuxtLink>
      <span class="motion-wordmark">M.C. <span>IMAGE LAB</span></span>
      <span class="motion-edition">STUDIO Nº 01</span>
    </header>

    <section
      class="motion-heading"
      aria-labelledby="motion-title"
    >
      <div>
        <p class="motion-kicker">
          Cinquante façons de faire bouger les souvenirs
        </p>
        <h1 id="motion-title">
          Le labo des<br><em>instants.</em>
        </h1>
      </div>
      <p class="motion-intro">
        Choisis un média pour les transitions, ou un montage pour faire entrer toutes les photos ou toutes les vidéos dans une seule animation.
      </p>
    </section>

    <section
      class="motion-workbench"
      aria-label="Aperçu interactif des animations"
    >
      <aside class="motion-controls">
        <div class="control-block">
          <p class="control-label">
            <span>01</span> FORMAT
          </p>
          <div
            class="kind-switch"
            role="group"
            aria-label="Choisir le format du média"
          >
            <button
              type="button"
              :aria-pressed="activeKind === 'photo'"
              :class="{ 'is-active': activeKind === 'photo' }"
              @click="activeKind = 'photo'"
            >
              <UIcon
                name="i-lucide-image"
                aria-hidden="true"
              /> Photos <span>{{ photos.length }}</span>
            </button>
            <button
              type="button"
              :aria-pressed="activeKind === 'video'"
              :class="{ 'is-active': activeKind === 'video' }"
              @click="activeKind = 'video'"
            >
              <UIcon
                name="i-lucide-film"
                aria-hidden="true"
              /> Vidéos <span>{{ videos.length }}</span>
            </button>
          </div>
        </div>

        <label
          class="control-block media-select"
          for="media-choice"
        >
          <span class="control-label"><span>02</span> CHOISIR UN INSTANT</span>
          <select
            id="media-choice"
            :value="selectedMediaId"
            :disabled="isMultiEffect"
            @change="selectMediaById"
          >
            <option
              v-for="(asset, index) in activeMedia"
              :key="asset.id"
              :value="asset.id"
            >
              {{ activeKind === 'photo' ? 'Photo' : 'Vidéo' }} {{ String(index + 1).padStart(2, '0') }}
            </option>
          </select>
          <span
            v-if="isMultiEffect"
            class="media-select__hint"
          >Le montage réunit toute la sélection.</span>
        </label>

        <fieldset class="control-block effect-picker">
          <legend class="control-label">
            <span>03</span> CHOISIR UNE ANIMATION <small>{{ effects.length }} possibilités</small>
          </legend>
          <div class="effect-options">
            <button
              v-for="(effect, index) in effects"
              :key="effect.id"
              type="button"
              :class="{ 'is-active': selectedEffectId === effect.id }"
              :aria-pressed="selectedEffectId === effect.id"
              @click="selectEffect(effect.id)"
            >
              <span>{{ String(index + 1).padStart(2, '0') }}</span>
              {{ effect.name }}
            </button>
          </div>
        </fieldset>
      </aside>

      <div class="motion-preview-column">
        <div class="preview-toolbar">
          <span>{{ selectedMediaLabel }} <i>·</i> {{ selectedEffect.name }}</span>
          <div class="preview-actions">
            <button
              type="button"
              class="replay-button"
              aria-label="Rejouer l’animation"
              title="Rejouer l’animation"
              @click="replayEffect"
            >
              <UIcon
                name="i-lucide-rotate-cw"
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              class="sequence-button"
              :aria-pressed="sequencePlaying"
              :aria-label="sequencePlaying ? 'Arrêter la séquence d’animations' : `Jouer les ${effects.length} animations dans l’ordre`"
              @click="toggleSequence"
            >
              <UIcon
                :name="sequencePlaying ? 'i-lucide-square' : 'i-lucide-list-video'"
                aria-hidden="true"
              />
              {{ sequencePlaying ? 'Arrêter' : `Jouer les ${effects.length}` }}
            </button>
          </div>
        </div>

        <div
          class="motion-stage"
          :class="`motion-stage--${selectedEffect.id}`"
        >
          <div
            v-if="isMultiEffect"
            :key="`${selectedEffect.id}-${activeKind}-${replayCount}`"
            class="multi-scene"
            :class="[multiSceneClass, { 'multi-scene--three': activeMedia.length === 3 }]"
            :aria-label="`${activeMedia.length} ${activeKind === 'photo' ? 'photos' : 'vidéos'} animées ensemble`"
          >
            <figure
              v-for="(asset, index) in activeMedia"
              :key="asset.id"
              class="multi-frame"
              :style="frameMotionStyle(index)"
            >
              <img
                v-if="asset.type === 'photo'"
                :src="asset.src"
                :alt="asset.caption || `Souvenir photo ${index + 1} d’Osnella Sènami`"
                :width="asset.width ?? 720"
                :height="asset.height ?? 1280"
                decoding="async"
              >
              <video
                v-else
                :src="asset.src"
                :poster="photos[index % photos.length]?.src"
                controls
                playsinline
                preload="none"
                :aria-label="`Vidéo souvenir ${index + 1} d’Osnella Sènami`"
              />
            </figure>
          </div>
          <figure
            v-else-if="selectedMedia"
            :key="`${selectedMedia.id}-${selectedEffect.id}-${replayCount}`"
            class="motion-frame"
          >
            <img
              v-if="selectedMedia.type === 'photo'"
              :src="selectedMedia.src"
              :alt="selectedMedia.caption || `Souvenir photo ${selectedMediaIndex + 1} d’Osnella Sènami`"
              :width="selectedMedia.width ?? 720"
              :height="selectedMedia.height ?? 1280"
              decoding="async"
            >
            <video
              v-else
              :src="selectedMedia.src"
              :poster="photos[0]?.src"
              controls
              playsinline
              preload="metadata"
              :aria-label="`Vidéo souvenir ${selectedMediaIndex + 1} d’Osnella Sènami`"
            />
          </figure>
          <span
            v-if="!isMultiEffect"
            class="stage-index"
          >{{ String(selectedMediaIndex + 1).padStart(2, '0') }} / {{ String(activeMedia.length).padStart(2, '0') }}</span>
        </div>

        <div
          class="preview-caption"
          aria-live="polite"
        >
          <div>
            <p>{{ selectedEffect.name }}</p>
            <span>{{ selectedEffect.note }}</span>
          </div>
          <span class="preview-caption__hint">{{ selectedMedia?.type === 'video' ? 'Lecture manuelle' : 'Aperçu photo' }}</span>
        </div>
        <p
          v-if="sequenceStatus"
          class="sequence-status"
          role="status"
        >
          {{ sequenceStatus }}
        </p>
      </div>
    </section>

    <footer class="motion-footer">
      <span>Les vidéos ne démarrent qu’à ta demande.</span>
      <NuxtLink to="/galerie">Ouvrir la galerie <UIcon
        name="i-lucide-arrow-up-right"
        aria-hidden="true"
      /></NuxtLink>
    </footer>
  </main>
</template>

<style scoped>
.memory-page {
  --memory-ink: #352c43;
  --memory-muted: #766d7f;
  --memory-paper: #fbf8f2;
  --memory-rose: #cc6d82;
  --memory-lemon: #e9ce75;
  min-height: 100vh;
  padding: 1.15rem max(1.25rem, calc((100vw - 76rem) / 2)) 6.5rem;
  overflow: hidden;
  color: var(--memory-ink);
  background:
    radial-gradient(ellipse at 12% 13%, rgba(233, 206, 117, 0.22), transparent 28rem),
    radial-gradient(ellipse at 88% 40%, rgba(204, 109, 130, 0.12), transparent 30rem),
    var(--memory-paper);
}

.memory-topline,
.memory-topline a,
.memory-note,
.memory-note > a,
.memory-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.memory-topline {
  min-height: 3.25rem;
  border-bottom: 1px solid rgba(53, 44, 67, 0.15);
  color: var(--memory-muted);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
}

.memory-topline a { justify-content: flex-start; gap: 0.5rem; }
.memory-topline a:hover { color: var(--memory-rose); }
.memory-topline a :deep(svg) { width: 1rem; height: 1rem; }
.memory-topline__mark { color: var(--memory-ink); font-family: var(--font-display); font-size: 1.4rem; }
.memory-topline__mark span { color: var(--memory-rose); font-family: var(--font-sans); font-size: 0.85rem; }
.memory-topline__edition { font-family: var(--font-mono); font-size: 0.62rem; text-transform: uppercase; }

.memory-main {
  display: grid;
  max-width: 72rem;
  min-height: min(45rem, 76svh);
  grid-template-columns: 0.8fr 1.2fr;
  align-items: center;
  gap: clamp(2rem, 6vw, 6rem);
  margin: 0 auto;
  padding: 2.5rem 0 1.5rem;
}

.memory-intro { position: relative; z-index: 1; }
.memory-kicker, .memory-note__eyebrow { color: var(--memory-rose); font-size: 0.69rem; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; }
.memory-kicker span { margin-right: 0.35rem; color: var(--memory-lemon); font-size: 1rem; }
.memory-intro h1 { margin-top: 1.3rem; font-family: var(--font-display); font-size: clamp(3.5rem, 6vw, 6rem); font-weight: 500; line-height: 0.88; }
.memory-intro h1 em { color: var(--memory-rose); font-weight: 500; }
.memory-intro__copy { max-width: 22rem; margin-top: 1.6rem; color: var(--memory-muted); font-size: 0.95rem; line-height: 1.8; }
.memory-intro__scribble { display: inline-block; margin-top: 1.6rem; color: var(--memory-rose); font-family: var(--font-script); font-size: 1.45rem; transform: rotate(-5deg); }

.memory-wall {
  position: relative;
  display: grid;
  min-width: 0;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: center;
  gap: clamp(0.35rem, 1.4vw, 1.25rem);
  padding: 2rem 0 3rem;
  perspective: 1000px;
}

.memory-polaroid {
  position: relative;
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  padding: 0.65rem 0.65rem 0.9rem;
  border: 1px solid rgba(53, 44, 67, 0.1);
  background: #fffefa;
  box-shadow: 0 0.8rem 2rem rgba(53, 44, 67, 0.13);
  color: var(--memory-ink);
  cursor: pointer;
  text-align: left;
  transform: rotate(var(--polaroid-tilt));
  transition: transform 420ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 420ms ease, filter 420ms ease;
}

.memory-polaroid--1 { --polaroid-tilt: -5deg; margin-top: 1.6rem; }
.memory-polaroid--2 { --polaroid-tilt: 3deg; z-index: 1; margin-bottom: 1.8rem; }
.memory-polaroid--3 { --polaroid-tilt: -2deg; margin-top: 2.4rem; }
.memory-polaroid:not(.is-selected) { filter: saturate(0.83); }
.memory-polaroid:hover, .memory-polaroid:focus-visible, .memory-polaroid.is-selected { z-index: 2; filter: saturate(1); transform: translateY(-0.65rem) rotate(0deg) scale(1.035); box-shadow: 0 1.3rem 2.4rem rgba(53, 44, 67, 0.2); }
.memory-polaroid:focus-visible { outline: 3px solid var(--memory-rose); outline-offset: 4px; }

.memory-polaroid__photo {
  position: relative;
  display: grid;
  width: 100%;
  aspect-ratio: 9 / 16;
  place-items: center;
  overflow: hidden;
  background: #eee9e4;
}

.memory-polaroid__photo img { display: block; width: 100%; height: 100%; object-fit: contain; }
.memory-polaroid__light { position: absolute; inset: 0; background: radial-gradient(circle at var(--spot-x, 50%) var(--spot-y, 50%), rgba(255, 255, 255, 0.42), transparent 48%); opacity: 0; pointer-events: none; transition: opacity 220ms ease; }
.memory-polaroid:hover .memory-polaroid__light, .memory-polaroid.is-selected .memory-polaroid__light { opacity: 1; }
.memory-polaroid__number { position: absolute; right: 0.45rem; bottom: 0.45rem; color: white; font-family: var(--font-mono); font-size: 0.62rem; text-shadow: 0 1px 5px rgba(0, 0, 0, 0.8); }
.memory-polaroid__caption { display: block; overflow: hidden; margin-top: 0.7rem; font-family: var(--font-script); font-size: clamp(0.78rem, 1.3vw, 1.15rem); line-height: 1.2; text-overflow: ellipsis; white-space: nowrap; }
.memory-polaroid__selected { position: absolute; top: -0.6rem; right: -0.6rem; display: grid; width: 1.85rem; aspect-ratio: 1; place-items: center; border-radius: 50%; background: var(--memory-rose); color: white; opacity: 0; transform: scale(0.65); transition: opacity 200ms ease, transform 200ms ease; }
.memory-polaroid.is-selected .memory-polaroid__selected { opacity: 1; transform: scale(1); }
.memory-polaroid__selected :deep(svg) { width: 0.9rem; height: 0.9rem; }
.memory-wall__note { position: absolute; right: -0.4rem; bottom: 0; color: var(--memory-muted); font-family: var(--font-script); font-size: 1.05rem; line-height: 1.2; text-align: right; transform: rotate(-5deg); }

.memory-note {
  max-width: 72rem;
  gap: 1.5rem;
  margin: 0 auto;
  padding: 1.2rem 0;
  border-top: 1px solid rgba(53, 44, 67, 0.16);
  border-bottom: 1px solid rgba(53, 44, 67, 0.16);
}

.memory-note__ornament { color: var(--memory-lemon); font-size: 1.8rem; }
.memory-note > div { flex: 1; }
.memory-note__eyebrow { font-size: 0.58rem; }
.memory-note h2 { margin-top: 0.2rem; font-family: var(--font-display); font-size: 1.7rem; line-height: 1.1; }
.memory-note > div > p:last-child { margin-top: 0.35rem; color: var(--memory-muted); font-size: 0.8rem; line-height: 1.5; }
.memory-note > a { flex: 0 0 auto; gap: 0.5rem; color: var(--memory-rose); font-size: 0.76rem; font-weight: 700; }
.memory-note > a :deep(svg) { width: 1rem; height: 1rem; }
.memory-note > a:hover { color: var(--memory-ink); }
.memory-footer { max-width: 72rem; justify-content: center; gap: 0.8rem; margin: 1.2rem auto 0; color: var(--memory-muted); font-size: 0.62rem; letter-spacing: 0.13em; text-transform: uppercase; }
.memory-footer span:nth-child(2) { color: var(--memory-rose); }

@media (max-width: 760px) {
  .memory-main { min-height: auto; grid-template-columns: 1fr; gap: 0.5rem; padding-top: 3rem; }
  .memory-intro { max-width: 32rem; }
  .memory-intro h1 { font-size: clamp(3.5rem, 13vw, 5.4rem); }
  .memory-intro__copy { max-width: 26rem; margin-top: 1rem; }
  .memory-intro__scribble { margin-top: 0.8rem; }
  .memory-wall { width: min(100%, 36rem); margin: 0 auto; gap: 0.8rem; padding: 1.8rem 0 3.2rem; }
  .memory-polaroid { padding: 0.5rem 0.5rem 0.75rem; }
  .memory-polaroid--1 { margin-top: 1rem; }
  .memory-polaroid--2 { margin-bottom: 0.8rem; }
  .memory-polaroid--3 { margin-top: 1.2rem; }
}

@media (max-width: 440px) {
  .memory-page { padding-right: 1rem; padding-left: 1rem; }
  .memory-topline { font-size: 0.64rem; }
  .memory-topline__edition { font-size: 0.52rem; }
  .memory-wall { gap: 0.45rem; }
  .memory-polaroid { padding: 0.35rem 0.35rem 0.6rem; }
  .memory-polaroid__caption { margin-top: 0.5rem; font-size: 0.75rem; }
  .memory-note { align-items: flex-start; gap: 0.7rem; }
  .memory-note__ornament { font-size: 1.4rem; }
  .memory-note h2 { font-size: 1.35rem; }
  .memory-note > div > p:last-child { max-width: 15rem; font-size: 0.72rem; }
  .memory-note > a { width: 2.5rem; height: 2.5rem; justify-content: center; border: 1px solid rgba(204, 109, 130, 0.4); border-radius: 50%; }
  .memory-note > a span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
}

@media (prefers-reduced-motion: reduce) {
  .memory-polaroid, .memory-polaroid__light, .memory-polaroid__selected { transition: none; }
}

.capsule-page {
  --capsule-paper: #f3f2e9;
  --capsule-ink: #202b27;
  --capsule-muted: #68736d;
  --capsule-line: rgba(32, 43, 39, 0.2);
  --capsule-orange: #e96545;
  --capsule-blue: #c8dedb;
  min-height: 100vh;
  padding: 1rem max(1.25rem, calc((100vw - 72rem) / 2)) 6.5rem;
  overflow: hidden;
  color: var(--capsule-ink);
  background-color: var(--capsule-paper);
  background-image: radial-gradient(rgba(32, 43, 39, 0.09) 0.7px, transparent 0.7px);
  background-size: 9px 9px;
}

.capsule-topbar, .capsule-back, .capsule-footer, .capsule-footer a { display: flex; align-items: center; justify-content: space-between; }
.capsule-topbar { min-height: 3.2rem; border-bottom: 1px solid var(--capsule-line); color: var(--capsule-muted); font-family: var(--font-mono); font-size: 0.65rem; text-transform: uppercase; }
.capsule-back { justify-content: flex-start; gap: 0.5rem; font-family: var(--font-sans); font-size: 0.78rem; text-transform: none; }
.capsule-back :deep(svg) { width: 1rem; height: 1rem; }
.capsule-back:hover, .capsule-footer a:hover { color: var(--capsule-orange); }
.capsule-wordmark { color: var(--capsule-ink); font-weight: 800; letter-spacing: 0.12em; }
.capsule-wordmark span { color: var(--capsule-orange); }

.capsule-heading { display: flex; max-width: 68rem; align-items: flex-end; justify-content: space-between; gap: 2rem; margin: 0 auto; padding: 3.8rem 0 2.7rem; }
.capsule-kicker, .capsule-step { display: flex; align-items: center; gap: 0.65rem; color: var(--capsule-orange); font-family: var(--font-mono); font-size: 0.65rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
.capsule-kicker > span { width: 0.55rem; height: 0.55rem; border-radius: 50%; background: var(--capsule-orange); }
.capsule-heading h1 { margin-top: 1.1rem; font-family: var(--font-display); font-size: 4.4rem; font-weight: 500; line-height: 0.9; }
.capsule-heading h1 em { color: var(--capsule-orange); font-weight: 500; }
.capsule-intro { max-width: 29rem; margin-top: 1.15rem; color: var(--capsule-muted); font-size: 0.95rem; line-height: 1.7; }
.capsule-heading__seal { display: grid; width: 7.5rem; aspect-ratio: 1; flex: 0 0 auto; align-content: center; justify-items: center; gap: 0.45rem; margin: 0 2rem 0.2rem 0; border: 1px solid var(--capsule-orange); border-radius: 50%; color: var(--capsule-orange); font-family: var(--font-mono); font-size: 0.58rem; line-height: 1.4; text-align: center; text-transform: uppercase; transform: rotate(9deg); }
.capsule-heading__seal :deep(svg) { width: 1.4rem; height: 1.4rem; }

.capsule-workspace { display: grid; max-width: 68rem; grid-template-columns: 1fr 0.85fr; gap: clamp(2rem, 6vw, 5.5rem); margin: 0 auto; border-top: 1px solid var(--capsule-line); }
.capsule-writing { min-width: 0; padding: 1.65rem 0 0; }
.capsule-step { gap: 0.8rem; color: var(--capsule-muted); }
.capsule-step > span { color: var(--capsule-ink); }
.prompt-fieldset { min-width: 0; margin-top: 1.55rem; padding: 0; border: 0; }
.prompt-fieldset legend { margin-bottom: 0.65rem; font-size: 0.83rem; font-weight: 700; }
.prompt-options { display: flex; flex-wrap: wrap; gap: 0.45rem; }
.prompt-option { display: inline-flex; min-height: 2.5rem; align-items: center; gap: 0.45rem; padding: 0.55rem 0.7rem; border: 1px solid var(--capsule-line); background: transparent; color: var(--capsule-muted); cursor: pointer; font-size: 0.73rem; transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease; }
.prompt-option.is-active { border-color: var(--capsule-ink); background: var(--capsule-ink); color: var(--capsule-paper); }
.prompt-option :deep(svg) { width: 0.85rem; height: 0.85rem; }
.prompt-option:focus-visible, .seal-button:focus-visible, .sealed-actions button:focus-visible, .copy-button:focus-visible { outline: 3px solid var(--capsule-orange); outline-offset: 3px; }
.message-label { display: block; margin-top: 1.5rem; font-family: var(--font-display); font-size: 1.35rem; line-height: 1.3; }
.capsule-form textarea { display: block; width: 100%; min-height: 9rem; margin-top: 0.75rem; padding: 0.8rem 0; resize: vertical; border: 0; border-top: 1px solid var(--capsule-line); border-bottom: 1px solid var(--capsule-line); border-radius: 0; outline: 0; background: transparent; color: var(--capsule-ink); font-size: 0.9rem; line-height: 1.7; }
.capsule-form textarea::placeholder { color: #8d9690; }
.capsule-form textarea:focus-visible { border-color: var(--capsule-orange); box-shadow: 0 1px var(--capsule-orange); }
.message-meta { display: flex; justify-content: space-between; gap: 1rem; margin-top: 0.4rem; color: var(--capsule-muted); font-family: var(--font-mono); font-size: 0.58rem; }
.seal-button { display: inline-flex; min-height: 3rem; align-items: center; gap: 0.65rem; margin-top: 1.15rem; padding: 0.7rem 1rem; border: 0; background: var(--capsule-orange); color: white; cursor: pointer; font-size: 0.8rem; font-weight: 700; transition: background-color 160ms ease, transform 160ms ease; }
.seal-button:hover:not(:disabled) { background: #c94e32; transform: translateY(-2px); }
.seal-button:disabled { cursor: not-allowed; opacity: 0.45; }
.seal-button :deep(svg) { width: 1.1rem; height: 1.1rem; }
.storage-warning { margin-top: 0.8rem; color: #a23b27; font-size: 0.75rem; line-height: 1.5; }

.sealed-message { min-height: 22rem; padding-top: 1.65rem; }
.sealed-message__mark { display: grid; width: 3.25rem; aspect-ratio: 1; place-items: center; margin-top: 2.2rem; border: 1px solid var(--capsule-orange); border-radius: 50%; color: var(--capsule-orange); animation: stamp-in 500ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.sealed-message__mark :deep(svg) { width: 1.5rem; height: 1.5rem; }
.sealed-message h2 { margin-top: 1rem; font-family: var(--font-display); font-size: 2.3rem; font-weight: 500; }
.sealed-message > p:not(.capsule-step) { max-width: 22rem; margin-top: 0.55rem; color: var(--capsule-muted); font-size: 0.85rem; line-height: 1.7; }
.sealed-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem; margin-top: 1.4rem; }
.sealed-actions button { display: inline-flex; min-height: 2.5rem; align-items: center; gap: 0.45rem; padding: 0; border: 0; background: transparent; color: var(--capsule-ink); cursor: pointer; font-size: 0.75rem; font-weight: 700; }
.sealed-actions button :deep(svg) { width: 1rem; height: 1rem; }
.sealed-actions .sealed-actions__delete { color: var(--capsule-muted); font-weight: 400; text-decoration: underline; text-underline-offset: 3px; }

.capsule-preview { position: relative; display: flex; min-height: 24rem; flex-direction: column; overflow: hidden; padding: 1.1rem 1.25rem 0.9rem; background-color: var(--capsule-blue); background-image: linear-gradient(rgba(255, 255, 255, 0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.12) 1px, transparent 1px); background-size: 22px 22px; }
.capsule-preview::after { position: absolute; top: -6rem; right: -5rem; width: 15rem; aspect-ratio: 1; border: 1px solid rgba(32, 43, 39, 0.12); border-radius: 50%; content: ''; pointer-events: none; }
.preview-topline, .preview-footer { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 0.8rem; }
.preview-topline { padding-bottom: 0.75rem; border-bottom: 1px solid rgba(32, 43, 39, 0.25); }
.preview-topline h2 { font-family: var(--font-mono); font-size: 0.6rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.preview-topline > span { color: var(--capsule-muted); font-family: var(--font-mono); font-size: 0.58rem; }
.preview-empty { display: flex; flex: 1; flex-direction: column; align-items: flex-start; justify-content: center; padding: 1.5rem 0.5rem; }
.preview-stamp { display: grid; width: 4.2rem; aspect-ratio: 1; align-content: center; justify-items: center; border: 1px solid var(--capsule-orange); border-radius: 50%; color: var(--capsule-orange); font-family: var(--font-mono); font-size: 1rem; font-weight: 700; line-height: 1.15; text-align: center; transform: rotate(-12deg); }
.preview-stamp small { font-size: 0.48rem; letter-spacing: 0.12em; }
.preview-empty > p { max-width: 19rem; margin-top: 1.5rem; font-family: var(--font-display); font-size: 1.65rem; line-height: 1.25; }
.preview-empty > span { margin-top: 0.7rem; color: var(--capsule-muted); font-size: 0.75rem; }
.preview-letter { position: relative; z-index: 1; display: flex; flex: 1; flex-direction: column; padding: 1.25rem 0.4rem 0.7rem; animation: letter-arrive 420ms ease-out both; }
.preview-question { color: var(--capsule-muted); font-family: var(--font-mono); font-size: 0.62rem; line-height: 1.6; text-transform: uppercase; }
.preview-message { margin-top: 1rem; overflow-wrap: anywhere; font-family: var(--font-display); font-size: 1.45rem; line-height: 1.5; white-space: pre-wrap; }
.preview-signoff { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; margin-top: auto; padding-top: 1.5rem; color: var(--capsule-muted); font-family: var(--font-script); font-size: 1.1rem; }
.preview-footer { margin-top: 0.75rem; padding-top: 0.7rem; border-top: 1px solid rgba(32, 43, 39, 0.25); color: var(--capsule-muted); font-family: var(--font-mono); font-size: 0.55rem; letter-spacing: 0.08em; }
.preview-footer :deep(svg) { width: 0.9rem; height: 0.9rem; color: var(--capsule-ink); }
.copy-button { position: relative; z-index: 1; display: inline-flex; align-self: flex-start; align-items: center; gap: 0.4rem; margin-top: 1rem; padding: 0; border: 0; background: transparent; color: var(--capsule-ink); cursor: pointer; font-size: 0.7rem; font-weight: 700; }
.copy-button :deep(svg) { width: 0.9rem; height: 0.9rem; }
.capsule-footer { max-width: 68rem; margin: 1.4rem auto 0; color: var(--capsule-muted); font-family: var(--font-mono); font-size: 0.58rem; letter-spacing: 0.06em; text-transform: uppercase; }
.capsule-footer a { gap: 0.35rem; color: var(--capsule-ink); font-family: var(--font-sans); font-size: 0.75rem; letter-spacing: 0; text-transform: none; }
.capsule-footer a :deep(svg) { width: 0.9rem; height: 0.9rem; }

@keyframes stamp-in { from { opacity: 0; transform: scale(0.7) rotate(-24deg); } to { opacity: 1; transform: scale(1) rotate(0deg); } }
@keyframes letter-arrive { from { opacity: 0; transform: translateY(0.5rem); } to { opacity: 1; transform: translateY(0); } }

@media (max-width: 760px) {
  .capsule-page { padding-inline: 1.25rem; }
  .capsule-heading { padding-top: 3rem; }
  .capsule-heading h1 { font-size: 3.7rem; }
  .capsule-heading__seal { width: 6.25rem; margin-right: 0; }
  .capsule-workspace { grid-template-columns: 1fr; gap: 2rem; }
  .capsule-preview { min-height: 21rem; }
  .sealed-message { min-height: auto; padding-bottom: 1rem; }
}

@media (max-width: 440px) {
  .capsule-page { padding-inline: 1rem; }
  .capsule-topbar { font-size: 0.52rem; }
  .capsule-back { font-size: 0.7rem; }
  .capsule-heading { align-items: flex-start; padding-top: 2.6rem; }
  .capsule-heading h1 { font-size: 2.9rem; }
  .capsule-intro { max-width: 19rem; font-size: 0.85rem; }
  .capsule-heading__seal { width: 4.7rem; margin-top: 2rem; font-size: 0.48rem; }
  .capsule-heading__seal :deep(svg) { width: 1.1rem; height: 1.1rem; }
  .prompt-options { display: grid; grid-template-columns: 1fr; }
  .prompt-option { justify-content: space-between; }
  .capsule-preview { min-height: 19rem; padding-inline: 1rem; }
  .preview-empty > p { font-size: 1.4rem; }
  .capsule-footer { align-items: flex-start; gap: 0.8rem; font-size: 0.5rem; }
  .capsule-footer a { white-space: nowrap; }
}

@media (prefers-reduced-motion: reduce) {
  .capsule-page *, .capsule-page *::before, .capsule-page *::after { scroll-behavior: auto !important; animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
}

.motion-lab {
  --lab-ink: var(--text-color);
  --lab-muted: var(--muted-color);
  --lab-line: var(--border-color);
  --lab-primary: var(--primary-color);
  --lab-primary-rgb: var(--primary-color-rgb);
  --lab-accent: var(--accent-color);
  --lab-accent-rgb: var(--accent-color-rgb);
  --lab-panel: var(--theme-panel);
  --lab-panel-solid: var(--theme-panel-solid);
  --lab-soft-primary: var(--theme-soft-primary);
  min-height: 100vh;
  padding: 1rem max(1.25rem, calc((100vw - 82rem) / 2)) 6.5rem;
  color: var(--lab-ink);
  background:
    radial-gradient(ellipse at 84% 7%, rgba(var(--lab-accent-rgb), 0.14), transparent 34rem),
    radial-gradient(ellipse at 7% 0%, rgba(var(--lab-primary-rgb), 0.12), transparent 38rem),
    linear-gradient(180deg, var(--bg-color-soft), var(--bg-color));
}

.motion-topbar, .motion-back, .motion-footer, .motion-footer a { display: flex; align-items: center; justify-content: space-between; }
.motion-topbar { min-height: 3rem; border-bottom: 1px solid var(--lab-line); color: var(--lab-muted); font-family: var(--font-mono); font-size: 0.62rem; text-transform: uppercase; }
.motion-back { justify-content: flex-start; gap: 0.45rem; font-family: var(--font-sans); font-size: 0.76rem; text-transform: none; }
.motion-back :deep(svg), .motion-footer a :deep(svg) { width: 1rem; height: 1rem; }
.motion-back:hover, .motion-footer a:hover { color: var(--lab-accent); }
.motion-wordmark { color: var(--lab-ink); font-weight: 800; letter-spacing: 0.12em; }
.motion-wordmark span { margin-left: 0.35rem; color: var(--lab-accent); }

.motion-heading { display: flex; max-width: 78rem; align-items: flex-end; justify-content: space-between; gap: 3rem; margin: 0 auto; padding: 3rem 0 2.2rem; }
.motion-kicker { color: var(--theme-accent-text); font-family: var(--font-mono); font-size: 0.65rem; letter-spacing: 0.08em; text-transform: uppercase; }
.motion-heading h1 { margin-top: 0.85rem; font-family: var(--font-display); font-size: 4rem; font-weight: 500; line-height: 0.92; }
.motion-heading h1 em { color: var(--theme-heading); font-weight: 500; }
.motion-intro { max-width: 25rem; padding-bottom: 0.35rem; color: var(--lab-muted); font-size: 0.9rem; line-height: 1.75; }

.motion-workbench { display: grid; max-width: 78rem; grid-template-columns: minmax(18rem, 0.78fr) minmax(0, 1.22fr); gap: clamp(1.5rem, 4vw, 3.5rem); margin: 0 auto; padding-top: 1.25rem; border-top: 1px solid var(--lab-line); }
.motion-controls { display: flex; min-width: 0; flex-direction: column; gap: 1.25rem; }
.control-block { min-width: 0; margin: 0; padding: 0; border: 0; }
.control-label { display: flex; align-items: center; gap: 0.55rem; margin-bottom: 0.65rem; color: var(--lab-ink); font-family: var(--font-mono); font-size: 0.61rem; font-weight: 700; letter-spacing: 0.06em; }
.control-label > span { color: var(--lab-accent); }
.control-label small { margin-left: auto; color: var(--lab-muted); font-size: 0.55rem; font-weight: 400; letter-spacing: 0; text-transform: none; }
.kind-switch { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid var(--lab-line); }
.kind-switch button { display: flex; min-width: 0; min-height: 2.7rem; align-items: center; justify-content: center; gap: 0.45rem; padding: 0.5rem; border: 0; background: transparent; color: var(--lab-muted); cursor: pointer; font-size: 0.72rem; }
.kind-switch button + button { border-left: 1px solid var(--lab-line); }
.kind-switch button.is-active { background: var(--lab-primary); color: white; }
.kind-switch button :deep(svg) { width: 0.95rem; height: 0.95rem; }
.kind-switch button span { font-family: var(--font-mono); font-size: 0.6rem; opacity: 0.7; }
.kind-switch button:focus-visible, .effect-options button:focus-visible, .replay-button:focus-visible, .media-select select:focus-visible { outline: 3px solid var(--lab-coral); outline-offset: 3px; }

.media-select { display: grid; }
.media-select select { width: 100%; min-height: 2.75rem; padding: 0 0.75rem; border: 1px solid var(--lab-line); border-radius: 0; background: transparent; color: var(--lab-ink); font: inherit; font-size: 0.78rem; }
.media-select select:disabled { opacity: 0.55; }
.media-select__hint { margin-top: 0.35rem; color: var(--lab-muted); font-size: 0.68rem; }
.effect-options { display: grid; max-height: min(31rem, 62vh); grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.4rem; overflow-y: auto; padding: 0.15rem 0.25rem 0.15rem 0; scrollbar-color: var(--lab-accent) transparent; scrollbar-width: thin; }
.effect-options button { display: flex; min-width: 0; min-height: 2.5rem; align-items: center; gap: 0.55rem; padding: 0.4rem 0.5rem; border: 1px solid var(--lab-line); background: transparent; color: var(--lab-muted); cursor: pointer; text-align: left; font-size: 0.69rem; transition: background-color 160ms ease, color 160ms ease, border-color 160ms ease; }
.effect-options button > span { color: var(--lab-accent); font-family: var(--font-mono); font-size: 0.57rem; }
.effect-options button.is-active { border-color: var(--lab-primary); background: var(--lab-primary); color: white; }
.effect-options button.is-active > span { color: var(--lab-panel-solid); }

.motion-preview-column { min-width: 0; }
.preview-toolbar { display: flex; min-height: 2.75rem; align-items: center; justify-content: space-between; gap: 1rem; color: var(--lab-muted); font-family: var(--font-mono); font-size: 0.62rem; text-transform: uppercase; }
.preview-toolbar i { padding-inline: 0.25rem; color: var(--lab-accent); font-style: normal; }
.replay-button { display: grid; width: 2.35rem; aspect-ratio: 1; flex: 0 0 auto; place-items: center; border: 1px solid var(--lab-line); background: var(--lab-panel); color: var(--lab-ink); cursor: pointer; }
.replay-button:hover { border-color: var(--lab-accent); color: var(--lab-accent); }
.replay-button :deep(svg) { width: 1rem; height: 1rem; }
.motion-stage { position: relative; display: grid; min-height: clamp(20rem, 38vw, 32rem); aspect-ratio: 4 / 3; place-items: center; overflow: hidden; background-color: var(--theme-soft-primary); background-image: linear-gradient(135deg, rgba(var(--lab-accent-rgb), 0.12), transparent 55%), linear-gradient(180deg, rgba(var(--lab-primary-rgb), 0.06), transparent); }
.motion-stage::before, .motion-stage::after { position: absolute; width: 38%; aspect-ratio: 1; border: 1px solid rgba(var(--lab-primary-rgb), 0.18); border-radius: 50%; content: ''; pointer-events: none; }
.motion-stage::before { top: -18%; right: -8%; }
.motion-stage::after { bottom: -23%; left: -10%; width: 54%; }
.motion-frame { position: relative; z-index: 1; display: grid; width: min(66%, 22rem); height: 86%; place-items: center; overflow: hidden; margin: 0; background: var(--lab-panel-solid); box-shadow: 0 1.2rem 3rem rgba(var(--lab-primary-rgb), 0.22); }
.motion-frame img, .motion-frame video { display: block; width: 100%; height: 100%; object-fit: contain; }
.motion-frame video { background: #111; }
.stage-index { position: absolute; z-index: 2; right: 0.8rem; bottom: 0.75rem; color: var(--lab-ink); font-family: var(--font-mono); font-size: 0.62rem; letter-spacing: 0.08em; }
.preview-caption { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding: 0.85rem 0; border-bottom: 1px solid var(--lab-line); }
.preview-caption p { font-family: var(--font-display); font-size: 1.15rem; }
.preview-caption > div > span { display: block; margin-top: 0.2rem; color: var(--lab-muted); font-size: 0.75rem; }
.preview-caption__hint { flex: 0 0 auto; padding-top: 0.25rem; color: var(--lab-muted); font-family: var(--font-mono); font-size: 0.55rem; text-transform: uppercase; }
.motion-footer { max-width: 78rem; margin: 1rem auto 0; color: var(--lab-muted); font-size: 0.68rem; }
.motion-footer a { gap: 0.45rem; color: var(--lab-ink); font-weight: 700; }

.motion-stage--soft-focus .motion-frame { animation: effect-focus 1.8s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
.motion-stage--curtain .motion-frame { animation: effect-curtain 2.2s cubic-bezier(0.65, 0, 0.35, 1) both; }
.motion-stage--rise .motion-frame { animation: effect-rise 1.9s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.motion-stage--zoom .motion-frame { animation: effect-zoom 2.4s cubic-bezier(0.2, 0.75, 0.25, 1) both; }
.motion-stage--shutter .motion-frame { animation: effect-shutter 2.1s cubic-bezier(0.76, 0, 0.24, 1) both; }
.motion-stage--film .motion-frame { animation: effect-film 2s cubic-bezier(0.22, 0.78, 0.25, 1) both; }
.motion-stage--turn .motion-frame { animation: effect-turn 2.1s cubic-bezier(0.2, 0.75, 0.2, 1) both; }
.motion-stage--split .motion-frame { animation: effect-split 2.3s cubic-bezier(0.76, 0, 0.24, 1) both; }
.motion-stage--drift .motion-frame { animation: effect-drift 2.1s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.motion-stage--flash .motion-frame { animation: effect-flash 1.8s ease-out both; }
.motion-stage--flip-up .motion-frame { animation: effect-flip-up 2.4s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.motion-stage--flip-down .motion-frame { animation: effect-flip-down 2.4s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.motion-stage--flip-left .motion-frame { animation: effect-flip-left 2.4s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.motion-stage--flip-right .motion-frame { animation: effect-flip-right 2.4s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.motion-stage--spin-in .motion-frame { animation: effect-spin-in 2.8s cubic-bezier(0.16, 0.8, 0.2, 1) both; }
.motion-stage--iris .motion-frame { animation: effect-iris 2.5s cubic-bezier(0.65, 0, 0.35, 1) both; }
.motion-stage--fold .motion-frame { animation: effect-fold 2.5s cubic-bezier(0.65, 0, 0.35, 1) both; }
.motion-stage--wipe-vertical .motion-frame { animation: effect-wipe-vertical 2.2s cubic-bezier(0.65, 0, 0.35, 1) both; }
.motion-stage--diagonal-wipe .motion-frame { animation: effect-diagonal-wipe 2.3s cubic-bezier(0.65, 0, 0.35, 1) both; }
.motion-stage--elastic-pop .motion-frame { animation: effect-elastic-pop 2.6s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.motion-stage--dissolve .motion-frame { animation: effect-dissolve 2.4s ease-out both; }
.motion-stage--pulse-zoom .motion-frame { animation: effect-pulse-zoom 2.7s cubic-bezier(0.2, 0.75, 0.2, 1) both; }

.multi-scene { position: absolute; z-index: 1; inset: 5%; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-rows: repeat(2, minmax(0, 1fr)); align-items: stretch; gap: 0.8rem; perspective: 1100px; transform-style: preserve-3d; }
.multi-scene--three { grid-template-rows: 1fr; align-content: center; }
.multi-frame { position: relative; display: grid; min-width: 0; min-height: 0; place-items: center; overflow: hidden; margin: 0; border: 0.35rem solid color-mix(in srgb, var(--lab-panel-solid) 88%, var(--lab-accent)); background: var(--lab-panel-solid); box-shadow: 0 0.8rem 2rem rgba(var(--lab-primary-rgb), 0.24); }
.multi-frame { transform-style: preserve-3d; backface-visibility: hidden; }
.multi-scene--three .multi-frame { height: min(100%, 27rem); align-self: center; aspect-ratio: 9 / 16; }
.multi-frame img, .multi-frame video { display: block; width: 100%; height: 100%; object-fit: contain; background: #202320; }
.motion-stage--reel .multi-scene { animation: multi-reel 5.8s cubic-bezier(0.2, 0.75, 0.25, 1) both; }
.motion-stage--multi-rejoin .multi-frame { animation: multi-rejoin 3.8s cubic-bezier(0.18, 0.8, 0.25, 1) both; animation-delay: var(--frame-delay); }
.motion-stage--multi-scatter .multi-frame { animation: multi-scatter 3.8s cubic-bezier(0.18, 0.8, 0.25, 1) both; animation-delay: var(--frame-delay); }
.motion-stage--multi-flip-x .multi-frame { animation: multi-flip-x 3.2s cubic-bezier(0.2, 0.8, 0.2, 1) both; animation-delay: var(--frame-delay); }
.motion-stage--constellation .multi-scene { animation: multi-constellation 5.2s cubic-bezier(0.16, 0.8, 0.25, 1) both; }
.motion-stage--contact-sheet .multi-scene { animation: multi-sheet 4.6s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
.motion-stage--flipbook .multi-scene { animation: multi-flipbook 5.4s cubic-bezier(0.2, 0.75, 0.2, 1) both; transform-origin: left center; }
.motion-stage--parade .multi-scene { animation: multi-parade 6.2s cubic-bezier(0.16, 0.8, 0.25, 1) both; }
.motion-stage--memory-deck .multi-scene { animation: multi-deck 5.6s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.motion-stage--celebration .multi-scene { animation: multi-celebration 5s cubic-bezier(0.76, 0, 0.24, 1) both; }
.motion-stage--floating-orbit .multi-scene { animation: multi-orbit 6.5s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
.motion-stage--parallax-strip .multi-scene { animation: multi-parallax 5.4s cubic-bezier(0.2, 0.75, 0.25, 1) both; }
.motion-stage--scrapbook .multi-scene { animation: multi-scrapbook 5.8s cubic-bezier(0.2, 0.75, 0.2, 1) both; transform-origin: left center; }
.motion-stage--multi-flip-up .multi-scene { animation: multi-flip-up 4.4s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.motion-stage--multi-flip-down .multi-scene { animation: multi-flip-down 4.4s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.motion-stage--multi-flip-left .multi-scene { animation: multi-flip-left 4.4s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.motion-stage--multi-flip-right .multi-scene { animation: multi-flip-right 4.4s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.motion-stage--multi-twist .multi-scene { animation: multi-twist 5.2s cubic-bezier(0.2, 0.75, 0.25, 1) both; }
.motion-stage--multi-fan .multi-scene { animation: multi-fan 5.2s cubic-bezier(0.2, 0.75, 0.25, 1) both; }
.motion-stage--multi-stack .multi-scene { animation: multi-stack 4.8s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.motion-stage--multi-squeeze .multi-scene { animation: multi-squeeze 4.4s cubic-bezier(0.76, 0, 0.24, 1) both; }
.motion-stage--multi-bloom .multi-scene { animation: multi-bloom 5.2s cubic-bezier(0.16, 0.8, 0.25, 1) both; }
.motion-stage--multi-sweep .multi-scene { animation: multi-sweep 4.6s cubic-bezier(0.65, 0, 0.35, 1) both; }
.motion-stage--multi-fall .multi-scene { animation: multi-fall 4.8s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.motion-stage--multi-rise .multi-scene { animation: multi-rise 4.8s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.motion-stage--multi-turn .multi-scene { animation: multi-turn 5.2s cubic-bezier(0.2, 0.75, 0.25, 1) both; }
.motion-stage--multi-prism .multi-scene { animation: multi-prism 5.6s cubic-bezier(0.2, 0.75, 0.25, 1) both; }
.motion-stage--multi-shuffle .multi-scene { animation: multi-shuffle 5.4s cubic-bezier(0.2, 0.75, 0.25, 1) both; }

.preview-actions { display: flex; align-items: center; gap: 0.45rem; }
.sequence-button { display: inline-flex; min-height: 2.35rem; align-items: center; gap: 0.45rem; padding: 0.45rem 0.7rem; border: 1px solid var(--lab-primary); background: var(--lab-primary); color: var(--lab-panel-solid); cursor: pointer; font-family: var(--font-sans); font-size: 0.7rem; font-weight: 700; transition: transform 160ms ease, filter 160ms ease; }
.sequence-button:hover { filter: brightness(1.1); transform: translateY(-1px); }
.sequence-button:focus-visible { outline: 3px solid var(--lab-accent); outline-offset: 3px; }
.sequence-button :deep(svg) { width: 0.95rem; height: 0.95rem; }
.sequence-status { margin-top: 0.35rem; color: var(--lab-accent); font-family: var(--font-mono); font-size: 0.62rem; text-align: right; }

.motion-lab.is-sequence-playing .motion-frame,
.motion-lab.is-sequence-playing .multi-scene,
.motion-lab.is-sequence-playing .multi-frame { animation-duration: 1.1s !important; animation-delay: 0ms !important; }

@keyframes effect-focus { from { opacity: 0; filter: blur(16px); transform: scale(1.08); } to { opacity: 1; filter: blur(0); transform: scale(1); } }
@keyframes effect-curtain { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
@keyframes effect-rise { from { opacity: 0; transform: translateY(12%) rotate(2deg); } to { opacity: 1; transform: translateY(0) rotate(0); } }
@keyframes effect-zoom { from { opacity: 0; transform: scale(0.72); } to { opacity: 1; transform: scale(1); } }
@keyframes effect-shutter { 0% { clip-path: inset(0 0 50% 0); opacity: 0; } 45% { clip-path: inset(0 0 50% 0); opacity: 1; } 100% { clip-path: inset(0); opacity: 1; } }
@keyframes effect-film { from { opacity: 0; transform: translateY(-14%) rotateX(18deg); } to { opacity: 1; transform: translateY(0) rotateX(0); } }
@keyframes effect-turn { from { opacity: 0; transform: perspective(800px) rotateY(-24deg) scale(0.9); } to { opacity: 1; transform: perspective(800px) rotateY(0) scale(1); } }
@keyframes effect-split { from { clip-path: inset(0 50%); transform: scale(1.06); } to { clip-path: inset(0); transform: scale(1); } }
@keyframes effect-drift { from { opacity: 0; transform: translateX(10%) scale(0.96); } to { opacity: 1; transform: translateX(0) scale(1); } }
@keyframes effect-flash { 0% { opacity: 0; filter: brightness(2.3); transform: scale(0.96); } 28% { opacity: 1; filter: brightness(1.3); } 100% { opacity: 1; filter: brightness(1); transform: scale(1); } }
@keyframes effect-flip-up { 0% { opacity: 0; transform: perspective(950px) rotateX(-110deg) scale(0.86); } 62% { opacity: 1; transform: perspective(950px) rotateX(12deg) scale(1.02); } 100% { opacity: 1; transform: perspective(950px) rotateX(0) scale(1); } }
@keyframes effect-flip-down { 0% { opacity: 0; transform: perspective(950px) rotateX(110deg) scale(0.86); } 62% { opacity: 1; transform: perspective(950px) rotateX(-12deg) scale(1.02); } 100% { opacity: 1; transform: perspective(950px) rotateX(0) scale(1); } }
@keyframes effect-flip-left { 0% { opacity: 0; transform: perspective(950px) rotateY(-110deg) scale(0.86); } 62% { opacity: 1; transform: perspective(950px) rotateY(12deg) scale(1.02); } 100% { opacity: 1; transform: perspective(950px) rotateY(0) scale(1); } }
@keyframes effect-flip-right { 0% { opacity: 0; transform: perspective(950px) rotateY(110deg) scale(0.86); } 62% { opacity: 1; transform: perspective(950px) rotateY(-12deg) scale(1.02); } 100% { opacity: 1; transform: perspective(950px) rotateY(0) scale(1); } }
@keyframes effect-spin-in { 0% { opacity: 0; filter: blur(12px); transform: rotate(-200deg) scale(0.28); } 72% { opacity: 1; filter: blur(0); transform: rotate(9deg) scale(1.04); } 100% { opacity: 1; transform: rotate(0) scale(1); } }
@keyframes effect-iris { from { opacity: 0.5; clip-path: circle(0 at 50% 50%); transform: scale(0.88); } to { opacity: 1; clip-path: circle(75% at 50% 50%); transform: scale(1); } }
@keyframes effect-fold { 0% { opacity: 0; clip-path: inset(0 50%); transform: perspective(900px) rotateY(25deg) scaleX(0.7); } 60% { opacity: 1; clip-path: inset(0 0); transform: perspective(900px) rotateY(-5deg) scaleX(1.02); } 100% { opacity: 1; clip-path: inset(0); transform: perspective(900px) rotateY(0) scaleX(1); } }
@keyframes effect-wipe-vertical { from { opacity: 0; clip-path: inset(100% 0 0); } to { opacity: 1; clip-path: inset(0); } }
@keyframes effect-diagonal-wipe { from { opacity: 0; clip-path: polygon(0 0, 0 0, 0 0, 0 0); } to { opacity: 1; clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); } }
@keyframes effect-elastic-pop { 0% { opacity: 0; transform: scale(0.35) rotate(-9deg); } 58% { opacity: 1; transform: scale(1.08) rotate(3deg); } 76% { transform: scale(0.96) rotate(-1deg); } 100% { opacity: 1; transform: scale(1) rotate(0); } }
@keyframes effect-dissolve { from { opacity: 0; filter: blur(22px) saturate(0.2); transform: scale(1.08); } to { opacity: 1; filter: blur(0) saturate(1); transform: scale(1); } }
@keyframes effect-pulse-zoom { 0% { opacity: 0; transform: scale(0.64); } 48% { opacity: 1; transform: scale(1.08); } 70% { transform: scale(0.96); } 100% { opacity: 1; transform: scale(1); } }
@keyframes multi-rejoin { 0% { opacity: 0; transform: translate3d(var(--scatter-x), var(--scatter-y), 0) rotate(var(--scatter-rotation)) scale(0.6); } 72% { opacity: 1; transform: translate3d(-0.3rem, 0.2rem, 0) rotate(-1deg) scale(1.02); } 100% { opacity: 1; transform: translate3d(0, 0, 0) rotate(0) scale(1); } }
@keyframes multi-scatter { 0% { opacity: 1; transform: translate3d(0, 0, 0) rotate(0) scale(1); } 72% { opacity: 1; transform: translate3d(calc(var(--scatter-x) * 1.08), calc(var(--scatter-y) * 1.08), 0) rotate(calc(var(--scatter-rotation) * 1.15)) scale(1.04); } 100% { opacity: 1; transform: translate3d(var(--scatter-x), var(--scatter-y), 0) rotate(var(--scatter-rotation)) scale(1); } }
@keyframes multi-flip-x { 0% { opacity: 0; transform: perspective(900px) rotateX(-105deg) scale(0.86); } 54% { opacity: 1; transform: perspective(900px) rotateX(14deg) scale(1.03); } 78% { transform: perspective(900px) rotateX(-5deg) scale(1); } 100% { opacity: 1; transform: perspective(900px) rotateX(0) scale(1); } }
@keyframes multi-reel { 0% { opacity: 0; clip-path: inset(0 100% 0 0); transform: translateX(22%) rotateY(-16deg) scale(0.9); } 58% { opacity: 1; clip-path: inset(0); transform: translateX(-2%) rotateY(3deg) scale(1.02); } 100% { opacity: 1; clip-path: inset(0); transform: translateX(0) rotateY(0) scale(1); } }
@keyframes multi-constellation { 0% { opacity: 0; transform: scale(0.35) rotate(-12deg) rotateX(18deg); filter: blur(12px); } 72% { opacity: 1; transform: scale(1.04) rotate(2deg) rotateX(-2deg); filter: blur(0); } 100% { opacity: 1; transform: scale(1) rotate(0) rotateX(0); filter: blur(0); } }
@keyframes multi-sheet { 0% { opacity: 0; clip-path: inset(48% 48%); transform: scale(0.84); } 65% { opacity: 1; clip-path: inset(0); transform: scale(1.015); } 100% { opacity: 1; clip-path: inset(0); transform: scale(1); } }
@keyframes multi-flipbook { 0% { opacity: 0; transform: perspective(1400px) rotateY(-92deg); } 62% { opacity: 1; transform: perspective(1400px) rotateY(8deg); } 100% { opacity: 1; transform: perspective(1400px) rotateY(0); } }
@keyframes multi-parade { 0% { opacity: 0; transform: translateY(7rem) rotate(9deg) scale(0.68); } 62% { opacity: 1; transform: translateY(-0.75rem) rotate(-2deg) scale(1.035); } 82% { transform: translateY(0.25rem) rotate(0.7deg) scale(0.99); } 100% { opacity: 1; transform: translateY(0) rotate(0) scale(1); } }
@keyframes multi-deck { 0% { opacity: 0; transform: perspective(1400px) rotateX(36deg) rotateY(-12deg) translateY(4rem) scale(0.75); filter: blur(8px); } 72% { opacity: 1; transform: perspective(1400px) rotateX(-4deg) rotateY(2deg) translateY(-0.5rem) scale(1.02); filter: blur(0); } 100% { opacity: 1; transform: perspective(1400px) rotateX(0) rotateY(0) translateY(0) scale(1); filter: blur(0); } }
@keyframes multi-celebration { 0% { opacity: 0; clip-path: inset(0 50%); transform: scale(0.8); filter: brightness(0.7); } 48% { opacity: 1; clip-path: inset(0 50%); transform: scale(1); filter: brightness(1.3); } 100% { opacity: 1; clip-path: inset(0); transform: scale(1); filter: brightness(1); } }
@keyframes multi-orbit { 0% { opacity: 0; transform: scale(0.55) rotate(-18deg); } 58% { opacity: 1; transform: scale(1.02) rotate(5deg); } 100% { opacity: 1; transform: scale(1) rotate(0); } }
@keyframes multi-parallax { 0% { opacity: 0; transform: perspective(1000px) translateX(30%) rotateY(-22deg) skewY(4deg); filter: blur(5px); } 60% { opacity: 1; transform: perspective(1000px) translateX(-3%) rotateY(4deg) skewY(-1deg); filter: blur(0); } 100% { opacity: 1; transform: perspective(1000px) translateX(0) rotateY(0) skewY(0); filter: blur(0); } }
@keyframes multi-scrapbook { 0% { opacity: 0; transform: perspective(1400px) rotateY(-105deg) translateX(-2rem); filter: brightness(0.8); } 72% { opacity: 1; transform: perspective(1400px) rotateY(7deg) translateX(0); filter: brightness(1.08); } 100% { opacity: 1; transform: perspective(1400px) rotateY(0) translateX(0); filter: brightness(1); } }
@keyframes multi-flip-up { 0% { opacity: 0; transform: perspective(1500px) rotateX(-105deg) scale(0.85); } 62% { opacity: 1; transform: perspective(1500px) rotateX(12deg) scale(1.02); } 100% { opacity: 1; transform: perspective(1500px) rotateX(0) scale(1); } }
@keyframes multi-flip-down { 0% { opacity: 0; transform: perspective(1500px) rotateX(105deg) scale(0.85); } 62% { opacity: 1; transform: perspective(1500px) rotateX(-12deg) scale(1.02); } 100% { opacity: 1; transform: perspective(1500px) rotateX(0) scale(1); } }
@keyframes multi-flip-left { 0% { opacity: 0; transform: perspective(1500px) rotateY(-105deg) scale(0.85); } 62% { opacity: 1; transform: perspective(1500px) rotateY(12deg) scale(1.02); } 100% { opacity: 1; transform: perspective(1500px) rotateY(0) scale(1); } }
@keyframes multi-flip-right { 0% { opacity: 0; transform: perspective(1500px) rotateY(105deg) scale(0.85); } 62% { opacity: 1; transform: perspective(1500px) rotateY(-12deg) scale(1.02); } 100% { opacity: 1; transform: perspective(1500px) rotateY(0) scale(1); } }
@keyframes multi-twist { 0% { opacity: 0; transform: rotate(-28deg) scale(0.55); filter: blur(12px); } 72% { opacity: 1; transform: rotate(4deg) scale(1.04); filter: blur(0); } 100% { opacity: 1; transform: rotate(0) scale(1); filter: blur(0); } }
@keyframes multi-fan { 0% { opacity: 0; transform: perspective(1200px) rotateY(-48deg) rotateX(24deg) translateX(12%); } 70% { opacity: 1; transform: perspective(1200px) rotateY(8deg) rotateX(-4deg) translateX(-1%); } 100% { opacity: 1; transform: perspective(1200px) rotateY(0) rotateX(0) translateX(0); } }
@keyframes multi-stack { 0% { opacity: 0; transform: perspective(1200px) rotateX(44deg) translateY(-6rem) scale(0.74); } 68% { opacity: 1; transform: perspective(1200px) rotateX(-7deg) translateY(0.6rem) scale(1.03); } 100% { opacity: 1; transform: perspective(1200px) rotateX(0) translateY(0) scale(1); } }
@keyframes multi-squeeze { 0% { opacity: 0; clip-path: inset(48% 0); transform: scaleX(0.7); } 62% { opacity: 1; clip-path: inset(0); transform: scaleX(1.03); } 100% { opacity: 1; clip-path: inset(0); transform: scaleX(1); } }
@keyframes multi-bloom { 0% { opacity: 0; transform: scale(0.18); filter: blur(24px) brightness(1.8); } 72% { opacity: 1; transform: scale(1.04); filter: blur(0) brightness(1.05); } 100% { opacity: 1; transform: scale(1); filter: blur(0) brightness(1); } }
@keyframes multi-sweep { 0% { opacity: 0; clip-path: inset(0 100% 0 0); transform: translateX(8%); } 62% { opacity: 1; clip-path: inset(0); transform: translateX(-1%); } 100% { opacity: 1; clip-path: inset(0); transform: translateX(0); } }
@keyframes multi-fall { 0% { opacity: 0; transform: translateY(-95%) rotateX(32deg) scale(0.9); } 68% { opacity: 1; transform: translateY(3%) rotateX(-4deg) scale(1.02); } 100% { opacity: 1; transform: translateY(0) rotateX(0) scale(1); } }
@keyframes multi-rise { 0% { opacity: 0; transform: translateY(85%) rotateX(-24deg) scale(0.88); } 68% { opacity: 1; transform: translateY(-3%) rotateX(4deg) scale(1.02); } 100% { opacity: 1; transform: translateY(0) rotateX(0) scale(1); } }
@keyframes multi-turn { 0% { opacity: 0; transform: rotate(-180deg) scale(0.48); } 72% { opacity: 1; transform: rotate(8deg) scale(1.04); } 100% { opacity: 1; transform: rotate(0) scale(1); } }
@keyframes multi-prism { 0% { opacity: 0; transform: perspective(1300px) rotateX(55deg) rotateY(-42deg) scale(0.72); filter: hue-rotate(-35deg); } 68% { opacity: 1; transform: perspective(1300px) rotateX(-8deg) rotateY(7deg) scale(1.03); filter: hue-rotate(10deg); } 100% { opacity: 1; transform: perspective(1300px) rotateX(0) rotateY(0) scale(1); filter: hue-rotate(0); } }
@keyframes multi-shuffle { 0% { opacity: 0; transform: translateX(35%) skewX(-14deg) rotate(7deg) scale(0.84); } 62% { opacity: 1; transform: translateX(-3%) skewX(3deg) rotate(-1deg) scale(1.02); } 100% { opacity: 1; transform: translateX(0) skewX(0) rotate(0) scale(1); } }

@media (max-width: 820px) {
  .motion-lab { padding-inline: 1.25rem; }
  .motion-heading { align-items: flex-start; flex-direction: column; gap: 1rem; padding-top: 2.5rem; }
  .motion-heading h1 { font-size: 3.4rem; }
  .motion-intro { max-width: 38rem; }
  .motion-workbench { grid-template-columns: 1fr; }
  .motion-preview-column { grid-row: 1; }
  .motion-controls { display: grid; grid-template-columns: 1fr 1fr; align-items: start; }
  .effect-picker { grid-column: 1 / -1; }
  .motion-stage { min-height: 25rem; }
}

@media (max-width: 500px) {
  .motion-lab { padding-inline: 1rem; }
  .motion-topbar { font-size: 0.5rem; }
  .motion-back { font-size: 0.68rem; }
  .motion-wordmark span { display: block; margin: 0.15rem 0 0; font-size: 0.48rem; }
  .motion-heading h1 { font-size: 2.9rem; }
  .motion-controls { grid-template-columns: 1fr; }
  .effect-picker { grid-column: auto; }
  .effect-options { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .motion-stage { min-height: 20rem; aspect-ratio: 0.95; }
  .motion-frame { width: 74%; height: 86%; }
  .motion-footer { align-items: flex-start; gap: 1rem; font-size: 0.6rem; }
}

@media (prefers-reduced-motion: reduce) {
  .motion-lab *, .motion-lab *::before, .motion-lab *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; transition-duration: 0.01ms !important; }
  .motion-lab.is-sequence-playing .motion-frame, .motion-lab.is-sequence-playing .multi-scene, .motion-lab.is-sequence-playing .multi-frame { animation-duration: 0.01ms !important; }
}
</style>
