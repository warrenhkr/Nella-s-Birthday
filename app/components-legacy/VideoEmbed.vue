<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'

type PisteVideo = {
  src: string
  kind?: string
  srclang?: string
  label?: string
  default?: boolean
}

const props = withDefaults(defineProps<{
  url: string
  sourceUrl?: string
  title?: string
  posterUrl?: string
  preload?: 'auto' | 'metadata' | 'none'
  volume?: number
  startTime?: number
  tracks?: PisteVideo[]
}>(), {
  title: 'Vidéo du Club Otaku',
  preload: 'metadata',
  volume: 0.8,
  startTime: 0,
  tracks: () => []
})

/**
 * Le skin Vidstack est en anglais par défaut : on fournit les libellés
 * français du site (infobulles, libellés du menu Réglages…).
 */
const traductionsFr = {
  Play: 'Lecture',
  Pause: 'Pause',
  Replay: 'Revoir',
  Mute: 'Couper le son',
  Unmute: 'Rétablir le son',
  Volume: 'Volume',
  Fullscreen: 'Plein écran',
  'Enter Fullscreen': 'Passer en plein écran',
  'Exit Fullscreen': 'Quitter le plein écran',
  PiP: 'Image dans l’image',
  'Enter PiP': 'Activer l’image dans l’image',
  'Exit PiP': 'Quitter l’image dans l’image',
  Settings: 'Réglages',
  Quality: 'Qualité',
  Speed: 'Vitesse',
  Download: 'Télécharger',
  Captions: 'Sous-titres',
  'Closed-Captions On': 'Sous-titres activés',
  'Closed-Captions Off': 'Sous-titres désactivés',
  Chapters: 'Chapitres',
  Accessibility: 'Accessibilité',
  'Google Cast': 'Diffusion (Chromecast)',
  Connecting: 'Connexion…',
  Connected: 'Connecté',
  Disconnected: 'Déconnecté',
  LIVE: 'DIRECT',
  'Playback': 'Lecture'
}

const racine = ref<HTMLElement | null>(null)
const isTheaterMode = ref(false)

// On privilégie une URL déjà passée par notre proxy : elle est construite à
// partir du publink pCloud (stable, résolvable côté serveur). L'ancien ordre
// préférait `sourceUrl`, qui peut être un lien direct pCloud lié à l'IP et
// donc inutilisable → la vidéo ne se chargeait jamais.
const sourceUrl = ref(
  /^\/api\/media\//.test(props.url) ? props.url : (props.sourceUrl || props.url)
)
const isResolving = ref(estPcloudUrl(sourceUrl.value))
const resolutionFailed = ref(false)

// ------------------------------------------------------------------
// Chargement paresseux + états visibles
//
// MESURÉ : monter le lecteur déclenche côté serveur une résolution pCloud
// (~4 s : page du publink + appels api.pcloud.com) puis le téléchargement.
// L'ancienne version montait un <media-player load="eager"> par carte de la
// galerie et forçait `startLoading()` : jusqu'à 9 vidéos lançaient donc 9
// résolutions simultanées à l'ouverture de la page, ce qui engorgeait tout.
// Désormais le lecteur n'est créé que lorsque sa vignette APPROCHE de
// l'écran, et Vidstack garde sa stratégie par défaut (`load="visible"`).
// ------------------------------------------------------------------
const lecteurMonte = ref(false)
const enChargement = ref(true)
const lectureErreur = ref(false)
const tentative = ref(0)
let minuterieSecours: ReturnType<typeof setTimeout> | undefined

useIntersectionObserver(racine, ([entree]) => {
  if (entree?.isIntersecting) lecteurMonte.value = true
}, { rootMargin: '300px 0px', threshold: 0.01 })

function estPcloudUrl(value: string) {
  try {
    const host = new URL(value).hostname.replace(/^www\./, '').toLowerCase()
    return host === 'pcloud.com' || host.endsWith('.pcloud.com') || host === 'u.pcloud.link'
  } catch {
    return false
  }
}

const provider = computed(() => {
  try {
    const host = new URL(sourceUrl.value).hostname.replace(/^www\./, '').toLowerCase()
    if (host === 'vimeo.com' || host === 'player.vimeo.com') return 'Vimeo'
    if (host === 'dailymotion.com' || host === 'dai.ly') return 'Dailymotion'
    if (host === 'twitch.tv' || host === 'clips.twitch.tv') return 'Twitch'
    if (host === 'drive.google.com' || host === 'docs.google.com') return 'Google Drive'
    if (host === 'pcloud.com' || host.endsWith('.pcloud.com') || host === 'u.pcloud.link') return 'pCloud'
    if (host === 'terabox.com' || host.endsWith('.terabox.com') || host === '1024terabox.com'
      || host.endsWith('.1024terabox.com') || host === 'terabox.app' || host.endsWith('.terabox.app')
      || host === '1024tera.com' || host.endsWith('.1024tera.com')) return 'Terabox'
  } catch {
    return 'Vidéo'
  }
  return 'Vidéo'
})

/**
 * Un partage Terabox n'est PAS embarquable : ni iframe (la page l'interdit),
 * ni flux direct (Terabox protège le téléchargement par une vérification
 * anti-robot « verify_v2 », insurmontable depuis un serveur). Plutôt qu'un
 * message d'erreur sans issue, on propose d'ouvrir la vidéo sur sa plateforme,
 * où le visiteur la lit normalement.
 */
const lienExterne = computed(() => {
  if (!sourceUrl.value || /^\/api\/media\//.test(sourceUrl.value)) return ''
  try {
    const url = new URL(sourceUrl.value)
    if (!['http:', 'https:'].includes(url.protocol)) return ''
    if (estPcloudUrl(sourceUrl.value)) return ''
    return embedUrl.value ? '' : sourceUrl.value
  } catch {
    return ''
  }
})

const isDirectVideo = computed(() => {
  // Les deux formes sont acceptées : /api/media/proxy?url=… (galerie) et
  // l'ancienne /api/media/proxy-video(.mp4)?url=… . Sans cela, le lecteur ne
  // recevait AUCUNE source pour les vidéos de la galerie.
  if (/^\/api\/media\/proxy(?:-video)?(?:\.mp4)?(?:\?|$)/i.test(sourceUrl.value)) return true

  try {
    const url = new URL(sourceUrl.value)
    return /\.(?:mp4|webm|mov|m4v|ogg)(?:\?|$)/i.test(url.pathname)
  } catch {
    return false
  }
})

/**
 * Normalise l'URL de notre proxy média vers sa variante « .mp4 ».
 *
 * POURQUOI : Vidstack ne crée un lecteur VIDÉO que si l'URL satisfait
 * `/\.(mp4|og[gv]|webm|mov|m4v)(#t=…)?(\?|$)/i` (sa constante
 * VIDEO_EXTENSIONS). Or la galerie produit
 * `/api/media/proxy?url=…%3Dfilm.mp4&type=VIDEO` : le « .mp4 » y est suivi
 * de « & », donc la détection échoue et le lecteur n'affichait rien. La
 * route `/api/media/proxy-video.mp4` finit littéralement par « .mp4 » :
 * la détection passe, sans aucun bricolage sur les propriétés du lecteur.
 */
function normaliserProxyVideo(url: string) {
  if (!/^\/api\/media\/proxy\?/i.test(url)) return url
  const parametre = url.match(/[?&]url=([^&]*)/)
  if (!parametre?.[1]) return url
  return `/api/media/proxy-video.mp4?url=${parametre[1]}`
}

/**
 * Source du lecteur : une simple chaîne. L'ancien code passait un tableau de
 * sources puis réassigneait `player.src` à la main — inutile pour la route
 * « .mp4 » ci-dessus, qui est reconnue d'elle-même.
 */
const playableUrl = computed(() => normaliserProxyVideo(sourceUrl.value))

/** Réplique la regex VIDEO_EXTENSIONS de Vidstack (vérification exacte). */
function sourceVideoReconnue(url: string) {
  return /\.(mp4|og[gv]|webm|mov|m4v)(#t=[,\d+]+)?($|\?)/i.test(url)
}

/**
 * Repli pour les URL vidéo directes exotiques (presse-papiers de vidéos
 * hébergées ailleurs, URL sans extension) : on déclare alors explicitement
 * `type: video/mp4`, seul moyen pour Vidstack de choisir le lecteur vidéo.
 */
function appliquerSourceTypee() {
  if (sourceVideoReconnue(playableUrl.value)) return
  const player = racine.value?.querySelector('media-player') as (HTMLElement & { src?: unknown }) | null
  if (player) player.src = [{ src: playableUrl.value, type: 'video/mp4' }]
}

async function appliquerTraductions() {
  await nextTick()
  const layout = racine.value?.querySelector('media-video-layout') as (HTMLElement & { translations?: unknown }) | null
  if (layout) layout.translations = traductionsFr
}

/** Filet de sécurité : on ne laisse jamais un voile de chargement bloquant. */
function armerSecours() {
  clearTimeout(minuterieSecours)
  minuterieSecours = setTimeout(() => { enChargement.value = false }, 12000)
}

function onLecteurPret() {
  enChargement.value = false
  clearTimeout(minuterieSecours)
}

function onErreurLecture() {
  enChargement.value = false
  lectureErreur.value = true
  clearTimeout(minuterieSecours)
}

function reessayer() {
  lectureErreur.value = false
  enChargement.value = true
  tentative.value += 1
}

watch([lecteurMonte, tentative], () => {
  if (!lecteurMonte.value) return
  enChargement.value = true
  lectureErreur.value = false
  armerSecours()
  appliquerTraductions()
  // Après le rendu : repli de type uniquement pour les URL non reconnues.
  nextTick(appliquerSourceTypee)
}, { flush: 'post' })

const embedUrl = computed(() => {
  try {
    const url = new URL(sourceUrl.value)
    const host = url.hostname.replace(/^www\./, '').toLowerCase()
    if (host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com')) {
      const id = host === 'youtu.be'
        ? url.pathname.slice(1).split('/')[0]
        : url.pathname.startsWith('/embed/') || url.pathname.startsWith('/shorts/')
          ? url.pathname.split('/')[2]
          : url.searchParams.get('v')
      return id ? `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1` : ''
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const id = url.pathname.split('/').filter(Boolean).pop()
      return id ? `https://player.vimeo.com/video/${id}` : ''
    }
    if (host === 'dai.ly') {
      const id = url.pathname.slice(1).split('/')[0]
      return id ? `https://www.dailymotion.com/embed/video/${id}` : ''
    }
    if (host === 'dailymotion.com') {
      const id = url.pathname.match(/\/video\/([a-z0-9]+)/i)?.[1]
      return id ? `https://www.dailymotion.com/embed/video/${id}` : ''
    }
    if (host === 'twitch.tv') {
      const id = url.pathname.match(/\/videos\/([0-9]+)/)?.[1]
      const parent = typeof window === 'undefined' ? 'localhost' : window.location.hostname
      return id ? `https://player.twitch.tv/?video=${id}&parent=${parent}` : ''
    }
    if (host === 'clips.twitch.tv') {
      const id = url.pathname.slice(1).split('/')[0]
      const parent = typeof window === 'undefined' ? 'localhost' : window.location.hostname
      return id ? `https://clips.twitch.tv/embed?clip=${id}&parent=${parent}` : ''
    }
    if (host === 'drive.google.com' || host === 'docs.google.com') return props.url
    if (host === 'pcloud.com' || host.endsWith('.pcloud.com') || host === 'u.pcloud.link') return sourceUrl.value
  } catch {
    return ''
  }
  return ''
})

// Les lecteurs tiers (iframe) ne se chargent qu'après un clic : aucune
// requête réseau vers YouTube/Vimeo tant que le visiteur n'a pas demandé
// la lecture.
const embedVisible = ref(false)

const fallbackRef = ref<HTMLElement | null>(null)

async function toggleVideoFullscreen() {
  const cible = fallbackRef.value
  if (!document.fullscreenElement && cible?.requestFullscreen) {
    await cible.requestFullscreen().catch(() => undefined)
    isTheaterMode.value = Boolean(document.fullscreenElement)
    return
  }
  if (document.fullscreenElement) {
    await document.exitFullscreen().catch(() => undefined)
    isTheaterMode.value = false
  }
}

onMounted(async () => {
  if (estPcloudUrl(sourceUrl.value)) {
    isResolving.value = true
    try {
      const result = await $fetch<{ url: string }>('/api/media/resolve-video', {
        method: 'POST',
        body: { url: sourceUrl.value }
      })
      if (result.url) {
        sourceUrl.value = result.url
      } else {
        resolutionFailed.value = true
      }
    } catch {
      resolutionFailed.value = true
    } finally {
      isResolving.value = false
    }
  }
})

onUnmounted(() => clearTimeout(minuterieSecours))
</script>

<template>
  <div
    ref="racine"
    class="video-embed"
    :class="{ 'video-embed--theater': isTheaterMode }"
    :aria-label="title || `Vidéo ${provider}`"
  >
    <!-- 1. Résolution du publink pCloud -->
    <div v-if="isResolving" class="video-embed__etat">
      <UIcon name="i-lucide-loader-circle" class="video-embed__spinner" aria-hidden="true" />
      <p class="video-embed__etat-titre">
        Chargement de la vidéo…
      </p>
      <p class="video-embed__etat-texte">
        Connexion à la médiathèque du club.
      </p>
    </div>

    <!-- 2. Lecteur vidéo direct -->
    <div v-else-if="isDirectVideo" class="video-embed__scene">
      <media-player
        v-if="lecteurMonte"
        :key="tentative"
        class="video-player"
        :src="playableUrl"
        :title="title"
        :volume="volume"
        :preload="preload"
        :playsinline="true"
        :controls="true"
        :current-time="startTime"
        color-scheme="dark"
        @can-play="onLecteurPret"
        @loaded-data="onLecteurPret"
        @playing="onLecteurPret"
        @error="onErreurLecture"
      >
        <media-provider></media-provider>
        <media-poster v-if="posterUrl" :src="posterUrl" alt="" aria-hidden="true"></media-poster>
        <media-google-cast-button aria-label="Diffuser sur Chromecast"></media-google-cast-button>
        <track
          v-for="track in tracks"
          :key="`${track.src}-${track.label ?? 'track'}`"
          :src="track.src"
          :kind="track.kind || 'subtitles'"
          :srclang="track.srclang || 'fr'"
          :label="track.label || 'Français'"
          :default="track.default || false"
        />
        <media-video-layout></media-video-layout>
      </media-player>

      <!-- Vignette affichée tant que le lecteur n'est pas créé -->
      <div v-else class="video-embed__vignette" aria-hidden="true">
        <span class="video-embed__vignette-pastille">
          <UIcon name="i-lucide-play" />
        </span>
        <p class="video-embed__vignette-titre">
          {{ title }}
        </p>
        <span class="video-embed__vignette-mention">
          <UIcon name="i-lucide-clapperboard" />
          Vidéo {{ provider }}
        </span>
      </div>

      <!-- Voile de chargement (au-dessus du lecteur) -->
      <div v-if="lecteurMonte && enChargement && !lectureErreur" class="video-embed__voile">
        <UIcon name="i-lucide-loader-circle" class="video-embed__spinner" aria-hidden="true" />
        <p class="video-embed__etat-titre">
          Chargement de la vidéo…
        </p>
      </div>

      <!-- Erreur de lecture : message clair + nouvelle tentative -->
      <div v-if="lectureErreur" class="video-embed__voile video-embed__voile--erreur">
        <UIcon name="i-lucide-circle-alert" class="video-embed__erreur-icon" aria-hidden="true" />
        <p class="video-embed__etat-titre">
          Lecture impossible
        </p>
        <p class="video-embed__etat-texte">
          La vidéo n’a pas pu être chargée. Vérifie ta connexion puis réessaie.
        </p>
        <UButton
          class="video-embed__reessayer"
          color="primary"
          variant="solid"
          icon="i-lucide-rotate-cw"
          label="Réessayer"
          @click="reessayer"
        />
      </div>
    </div>

    <!-- 3. Lecteurs tiers (YouTube, Vimeo, Twitch, Drive…) -->
    <div
      v-else-if="embedUrl && !resolutionFailed"
      ref="fallbackRef"
      class="video-embed__fallback"
    >
      <iframe
        v-if="embedVisible"
        :src="embedUrl"
        :title="title || `Vidéo ${provider}`"
        loading="lazy"
        allow="autoplay; fullscreen; picture-in-picture"
        allowfullscreen
        referrerpolicy="strict-origin-when-cross-origin"
      ></iframe>
      <button
        v-else
        type="button"
        class="video-embed__fallback-button"
        :aria-label="`Lire la vidéo ${provider} : ${title}`"
        @click="embedVisible = true"
      >
        <span class="video-embed__vignette-pastille">
          <UIcon name="i-lucide-play" />
        </span>
        <span class="video-embed__vignette-titre">{{ title }}</span>
        <span class="video-embed__vignette-mention">
          <UIcon name="i-lucide-external-link" />
          Cliquer pour charger la vidéo {{ provider }}
        </span>
      </button>
      <UButton
        v-if="embedVisible"
        class="video-embed__plein-ecran"
        color="neutral"
        variant="solid"
        size="sm"
        icon="i-lucide-maximize"
        aria-label="Afficher la vidéo en plein écran"
        @click="toggleVideoFullscreen"
      />
    </div>

    <!-- 4. Échec ou source non reconnue -->
    <div v-else class="video-embed__etat video-embed__etat--erreur">
      <UIcon name="i-lucide-triangle-alert" class="video-embed__erreur-icon" aria-hidden="true" />
      <p class="video-embed__etat-titre">
        Cette vidéo {{ provider }} ne peut pas être affichée ici.
      </p>
      <p class="video-embed__etat-texte">
        {{ lienExterne ? 'Ouvre-la sur sa plateforme d’origine pour la regarder.' : 'Ouvre la vidéo depuis sa plateforme d’origine, ou signale-la à un responsable du club.' }}
      </p>
      <a
        v-if="lienExterne"
        class="video-embed__lien-externe"
        :href="lienExterne"
        target="_blank"
        rel="noopener noreferrer"
      >
        <UIcon name="i-lucide-external-link" aria-hidden="true" />
        Ouvrir sur {{ provider }}
      </a>
    </div>
  </div>
</template>

<style scoped>
.video-embed {
  position: relative;
  display: block;
  width: 100%;
  max-width: 100%;
  min-height: 14rem;
  overflow: hidden;
  aspect-ratio: 16 / 9;
  border: 1px solid var(--border-color);
  border-radius: 1.25rem;
  background:
    linear-gradient(145deg, rgba(var(--primary-color-rgb), 0.16), rgba(var(--accent-color-rgb), 0.06) 55%, transparent),
    var(--panel-color-solid);
}

.video-embed--theater {
  position: fixed;
  inset: 1rem;
  z-index: 60;
  min-height: auto;
  background: var(--bg-color);
}

/* Surface du lecteur : on ne touche QUE des variables du design system
   (aucune couleur codée en dur), y compris pour les options Vidstack. */
.video-player,
.media-player,
media-player {
  display: block;
  width: 100%;
  max-width: 100%;
  height: 100%;
  min-height: 14rem;
  aspect-ratio: 16 / 9;
  --media-brand: var(--primary-color);
  --media-focus-ring: 0 0 0 2px rgba(var(--primary-color-rgb), 0.55);
  --media-controls-color: var(--text-color);
  --media-font-family: var(--font-sans, inherit);
  --video-border-radius: 1.25rem;
  --video-controls-color: var(--text-color);
  /* Cibles tactiles confortables (exigence : ≥ 44 px au doigt). */
  --media-button-size: 42px;
  --video-sm-button-size: 44px;
  --media-slider-track-bg: rgba(var(--primary-color-rgb), 0.24);
  --media-slider-track-fill-bg: var(--primary-color);
  --media-slider-track-progress-bg: var(--accent-color);
  --media-slider-thumb-bg: var(--text-color);
  --media-slider-track-height: 5px;
  --media-slider-thumb-size: 14px;
  --media-buffering-track-color: rgba(var(--primary-color-rgb), 0.35);
  --media-buffering-track-fill-color: var(--primary-color);
  --media-menu-bg: var(--panel-color-solid);
  --media-menu-text-color: var(--text-color);
  --media-menu-text-secondary-color: var(--muted-color);
  --media-menu-border: 1px solid var(--border-color);
  --media-menu-item-hover-bg: rgba(var(--primary-color-rgb), 0.18);
  --media-tooltip-bg-color: var(--panel-color-solid);
  --media-tooltip-color: var(--text-color);
  --media-tooltip-border: 1px solid var(--border-color);
  --media-tooltip-border-radius: 0.6rem;
  --media-time-color: var(--text-color);
  --media-time-bg: rgba(var(--primary-color-rgb), 0.2);
  --media-poster-bg: var(--panel-color-solid);
  --media-live-button-bg: var(--primary-color);
}

.video-embed__scene {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  min-height: 14rem;
}

/* Vignette de remplacement : elle reprend la charte rouge/noir du club et
   occupe exactement la place du lecteur (pas de saut de mise en page). */
.video-embed__vignette,
.video-embed__voile,
.video-embed__etat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 14rem;
  padding: 1.25rem;
  text-align: center;
}

.video-embed__vignette {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 50% 40%, rgba(var(--primary-color-rgb), 0.32), transparent 65%),
    linear-gradient(160deg, var(--panel-color-solid), var(--bg-color));
}

.video-embed__vignette-pastille {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3.5rem;
  height: 3.5rem;
  font-size: 1.5rem;
  color: var(--bg-color);
  background: var(--primary-color);
  border: 1px solid rgba(var(--accent-color-rgb), 0.6);
  border-radius: 9999px;
  box-shadow: var(--shadow-glow);
}

.video-embed__vignette-titre {
  font-family: var(--font-display, inherit);
  font-weight: 800;
  color: var(--text-color);
}

.video-embed__vignette-mention {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-family: var(--font-mono, inherit);
  font-size: 0.68rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted-color);
}

.video-embed__etat-titre {
  font-weight: 700;
  color: var(--text-color);
}

.video-embed__etat-texte {
  max-width: 30rem;
  font-size: 0.875rem;
  color: var(--muted-color);
}

.video-embed__etat--erreur .video-embed__etat-titre {
  color: var(--primary-color);
}

.video-embed__voile {
  position: absolute;
  inset: 0;
  background: rgba(var(--primary-color-rgb), 0.18);
  backdrop-filter: blur(2px);
}

.video-embed__voile--erreur {
  background: rgba(var(--primary-color-rgb), 0.26);
  backdrop-filter: blur(3px);
}

.video-embed__spinner {
  width: 2rem;
  height: 2rem;
  font-size: 2rem;
  color: var(--primary-color);
  animation: video-embed-rotation 1s linear infinite;
}

.video-embed__erreur-icon {
  width: 2.25rem;
  height: 2.25rem;
  font-size: 2.25rem;
  color: var(--primary-color);
}

.video-embed__reessayer {
  margin-top: 0.5rem;
  min-height: 44px;
}

/* Source non embarquable (ex. partage Terabox) : lien sortant explicite
   plutôt qu'un message d'erreur sans issue. */
.video-embed__lien-externe {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin-top: 0.5rem;
  min-height: 44px;
  padding: 0.6rem 1rem;
  border: 1px solid var(--primary-color);
  border-radius: 9999px;
  color: var(--bg-color);
  background: var(--primary-color);
  font-weight: 600;
  text-decoration: none;
}

@keyframes video-embed-rotation {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .video-embed__spinner { animation: none; }
}

/* Lecteurs tiers : clic-à-charger (aucune iframe avant le clic). */
.video-embed__fallback {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 14rem;
}

.video-embed__fallback iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
}

.video-embed__fallback-button {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  height: 100%;
  cursor: pointer;
  border: 0;
  padding: 1.25rem;
  background:
    radial-gradient(circle at 50% 42%, rgba(var(--primary-color-rgb), 0.34), transparent 62%),
    linear-gradient(160deg, var(--panel-color-solid), var(--bg-color));
}

.video-embed__fallback-button:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: -2px;
}

.video-embed__plein-ecran {
  position: absolute;
  right: 0.65rem;
  bottom: 0.65rem;
  min-width: 44px;
  min-height: 44px;
}

@media (max-width: 640px) {
  .video-embed,
  .video-player,
  media-player,
  .video-embed__scene,
  .video-embed__vignette,
  .video-embed__voile,
  .video-embed__etat,
  .video-embed__fallback {
    min-height: 11rem;
    aspect-ratio: 16 / 10;
  }

  .video-embed__vignette-pastille {
    width: 3rem;
    height: 3rem;
    font-size: 1.35rem;
  }
}
</style>
