// ============================================================
// useSoundManager — service audio global (SFX + musique de fond)
//
// - playSfx(type) : sons courts (click, hover, popup...) générés par Web Audio,
//   donc sans aucune ressource à charger.
// - playBgm() / pauseBgm() : une piste MP3 en boucle, avec fade-in/out.
// - isMuted (réactif, persisté en localStorage) pilote tout.
// - L'audio est débloqué au premier clic utilisateur (politiques d'autoplay).
//
// DÉGRADATION PROPRE (assets manquants ou réseau coupé) :
//   - Les pistes ne sont plus préchargées (preload = 'none') : aucune requête
//     n'est émise avant que l'utilisateur n'active réellement le son.
//   - Une disponibilité est tenue à jour par piste (sonde HEAD non bloquante,
//     puis erreurs de lecture). Une piste manquante est retirée de la rotation
//     au lieu d'être retentée en boucle : un seul message console.info, jamais
//     de spam de 404 ni d'erreur non capturée.
//   - Si AUCUNE piste n'est disponible, `bgmAvailable` passe à false : l'app
//     masque le bouton de musique (AudioToggle) et la page continue de
//     fonctionner normalement (les effets courts restent actifs).
// ============================================================

import { BACKGROUND_MUSIC } from '../data/config'

export type SfxType = 'click' | 'hover' | 'popup' | 'success' | 'error'

const MUTE_STORAGE_KEY = 'otaku-audio-muted'
const BGM_VOLUME_STORAGE_KEY = 'otaku-audio-bgm-volume'
const SFX_VOLUME_STORAGE_KEY = 'otaku-audio-sfx-volume'
const DEFAULT_BGM_VOLUME = 0.35
const DEFAULT_SFX_VOLUME = 0.5
const FADE_STEP_MS = 32
const TRACK_TRANSITION_MS = 280

// État module-level : un seul contexte audio partagé par toute l'app,
// pour éviter de recréer des <audio> à chaque composant.
let unlocked = false
let fadeTimer: ReturnType<typeof setInterval> | null = null
let transitionTimer: ReturnType<typeof setTimeout> | null = null
let visibilityBound = false
let resumeAfterVisibility = false
let sfxContext: AudioContext | null = null
let bgmElements: HTMLAudioElement[] = []
let activeBgm: HTMLAudioElement | null = null
let bgmTrackIndex = 0
let videoAudioBound = false
let resumeBgmAfterVideo = false
const activeVideoTargets = new Set<Element>()
const BGM_SOURCES = [BACKGROUND_MUSIC].filter((source): source is string => typeof source === 'string' && source.trim().length > 0)

// ---------- disponibilité des pistes (module-level, client uniquement) ----------
type BgmStatus = 'unknown' | 'ok' | 'missing'
const bgmStatus: BgmStatus[] = BGM_SOURCES.map(() => 'unknown')
let bgmProbeStarted = false
const bgmWarnedSources = new Set<string>()
// État partagé côté client : la musique de fond est un sujet purement
// navigateur, on évite donc useState (qui sérialiserait l'état dans la charge
// SSR) au profit d'une ref unique, créée paresseusement au premier usage client.
let bgmAvailableRef: Ref<boolean> | null = null
function getBgmAvailableRef(): Ref<boolean> {
  if (!import.meta.client) return ref(true)
  bgmAvailableRef ??= ref(true)
  return bgmAvailableRef
}

function anyBgmSourceLeft(): boolean {
  if (BGM_SOURCES.length === 0) return false
  return bgmStatus.some(s => s !== 'missing')
}

/** Retire définitivement une piste de la rotation (un seul log par piste). */
function markBgmMissing(index: number, reason: unknown) {
  const source = BGM_SOURCES[index]
  if (!source || bgmStatus[index] === 'missing') return
  bgmStatus[index] = 'missing'
  if (!bgmWarnedSources.has(source)) {
    bgmWarnedSources.add(source)
    console.info(
      `[useSoundManager] Piste "${source}" indisponible — retirée de la rotation de musique de fond.`,
      reason instanceof Error ? reason.message : reason
    )
  }
  if (!anyBgmSourceLeft()) {
    if (activeBgm) {
      activeBgm.pause()
      activeBgm = null
    }
    getBgmAvailableRef().value = false
    console.info(
      '[useSoundManager] Aucune musique de fond disponible : le bouton de musique est masqué, '
      + 'les effets courts restent actifs.'
    )
  }
}

/** Sonde légère (HEAD) exécutée une fois par session, sans bloquer le rendu. */
function probeBgmSources() {
  if (!import.meta.client || bgmProbeStarted || BGM_SOURCES.length === 0) return
  bgmProbeStarted = true
  const probe = () => {
    BGM_SOURCES.forEach((source, index) => {
      void fetch(source, { method: 'HEAD' })
        .then((response) => {
          if (response.ok) {
            if (bgmStatus[index] === 'unknown') bgmStatus[index] = 'ok'
          } else {
            markBgmMissing(index, `HTTP ${response.status}`)
          }
        })
        .catch(() => {
          // Réseau indisponible : on ne conclut rien ici, la lecture tranchera.
        })
    })
  }
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(probe, { timeout: 4000 })
  } else {
    setTimeout(probe, 1500)
  }
}

/** Première piste non marquée manquante, en partant de `from` (cyclique). */
function pickPlayableIndex(from: number): number {
  for (let i = 0; i < BGM_SOURCES.length; i++) {
    const index = (from + i) % BGM_SOURCES.length
    if (bgmStatus[index] !== 'missing') return index
  }
  return -1
}

function clearTransition() {
  if (transitionTimer) {
    clearTimeout(transitionTimer)
    transitionTimer = null
  }
}

export function useSoundManager() {
  const isMuted = useState<boolean>('otaku-audio-muted', () => false)
  const bgmPlaying = useState<boolean>('otaku-bgm-playing', () => false)
  const bgmVolume = useState<number>('otaku-audio-bgm-volume', () => DEFAULT_BGM_VOLUME)
  const sfxVolume = useState<number>('otaku-audio-sfx-volume', () => DEFAULT_SFX_VOLUME)
  const bgmAvailable = getBgmAvailableRef()

  if (BGM_SOURCES.length === 0) {
    bgmAvailable.value = false
  }

  if (import.meta.client) probeBgmSources()

  function clearFade() {
    if (fadeTimer) {
      clearInterval(fadeTimer)
      fadeTimer = null
    }
  }

  function getBgmElements() {
    if (!import.meta.client) return null
    if (BGM_SOURCES.length === 0) {
      bgmAvailable.value = false
      return []
    }
    if (bgmElements.length === 0) {
      bgmElements = BGM_SOURCES.map((source, index) => {
        const audio = new Audio()
        // preload = 'none' : aucune requête tant que l'utilisateur n'a pas
        // activé le son (évite 3 téléchargements et d'éventuels 404 au chargement).
        audio.preload = 'none'
        audio.src = source
        audio.loop = true
        audio.volume = index === 0 ? bgmVolume.value : 0
        audio.addEventListener('error', () => markBgmMissing(index, audio.error?.message))
        audio.addEventListener('ended', () => {
          if (audio === activeBgm && bgmPlaying.value) {
            const next = pickPlayableIndex(bgmTrackIndex + 1)
            if (next < 0) {
              bgmPlaying.value = false
              return
            }
            bgmTrackIndex = next
            audio.currentTime = 0
            // Laisser la piste précédente se terminer complètement avant
            // d'introduire la suivante avec un court fondu d'entrée.
            clearTransition()
            transitionTimer = setTimeout(() => {
              transitionTimer = null
              if (!isMuted.value && bgmPlaying.value && activeBgm === audio) playBgm()
            }, TRACK_TRANSITION_MS)
          }
        })
        return audio
      })
    }
    return bgmElements
  }

  function fadeTo(target: number, durationMs: number, onDone?: () => void) {
    if (!activeBgm) return
    clearFade()

    const steps = Math.max(1, Math.round(durationMs / FADE_STEP_MS))
    const startVolume = activeBgm.volume
    const delta = (target - startVolume) / steps
    let i = 0

    fadeTimer = setInterval(() => {
      i += 1
      const next = startVolume + delta * i
      if (activeBgm) activeBgm.volume = Math.min(1, Math.max(0, next))

      if (i >= steps) {
        if (activeBgm) activeBgm.volume = target
        clearFade()
        onDone?.()
      }
    }, FADE_STEP_MS)
  }

  /** À appeler sur le tout premier clic utilisateur (voir plugin audio-unlock). */
  function unlockAudio(startPlayback = true) {
    if (unlocked || !import.meta.client) return
    unlocked = true

    if (bgmAvailable.value) {
      getBgmElements()
      if (!isMuted.value && startPlayback) playBgm()
    }
  }

  function playSfx(type: SfxType) {
    if (!import.meta.client || isMuted.value) return

    try {
      sfxContext ??= new AudioContext()
      if (sfxContext.state === 'suspended') void sfxContext.resume()

      const oscillator = sfxContext.createOscillator()
      const gain = sfxContext.createGain()
      const now = sfxContext.currentTime
      const frequencies: Record<SfxType, number> = {
        click: 520,
        hover: 720,
        popup: 420,
        success: 760,
        error: 180
      }

      oscillator.frequency.value = frequencies[type]
      oscillator.type = type === 'error' ? 'sawtooth' : 'sine'
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, sfxVolume.value * 0.12), now + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
      oscillator.connect(gain).connect(sfxContext.destination)
      oscillator.start(now)
      oscillator.stop(now + 0.13)
    } catch (err) {
      console.warn(`[useSoundManager] Erreur SFX "${type}" :`, err)
    }
  }

  /**
   * `attempt` est interne : en cas d'échec de lecture (fichier absent), la piste
   * est retirée et la suivante est essayée, au maximum une fois par piste.
   */
  function playBgm(attempt = 0) {
    if (!import.meta.client || isMuted.value) return
    clearTransition()

    if (activeVideoTargets.size > 0) {
      resumeBgmAfterVideo = true
      return
    }

    if (!bgmAvailable.value) {
      bgmPlaying.value = false
      return
    }

    const elements = getBgmElements()
    if (!elements || elements.length === 0) {
      bgmAvailable.value = false
      bgmPlaying.value = false
      return
    }

    const index = pickPlayableIndex(bgmTrackIndex)
    if (index < 0) {
      bgmPlaying.value = false
      return
    }
    bgmTrackIndex = index

    const nextBgm = elements[index]
    if (!nextBgm) return

    if (activeBgm && activeBgm !== nextBgm) {
      activeBgm.pause()
      activeBgm.currentTime = 0
      activeBgm.volume = 0
    }
    activeBgm = nextBgm
    activeBgm.volume = 0
    activeBgm.muted = false
    bgmPlaying.value = true
    void activeBgm.play().then(() => {
      fadeTo(bgmVolume.value, 600)
    }).catch((err: unknown) => {
      // Lecture refusée (autoplay) ou fichier illisible : on ne casse pas la
      // page, on retire la piste et on tente la suivante si elle existe.
      bgmPlaying.value = false
      const isAssetFailure = nextBgm.error !== null && nextBgm.error !== undefined
      if (isAssetFailure) {
        markBgmMissing(index, err)
        if (attempt + 1 < BGM_SOURCES.length && anyBgmSourceLeft()) {
          playBgm(attempt + 1)
        }
        return
      }
      // Autoplay bloqué : simple information, la reprise aura lieu au clic.
      console.info('[useSoundManager] Lecture de la musique différée par le navigateur.')
    })
  }

  function pauseBgm() {
    if (!activeBgm) return

    clearTransition()
    fadeTo(0, 400, () => {
      activeBgm?.pause()
      bgmPlaying.value = false
    })
  }

  function pauseBgmImmediately() {
    clearTransition()
    clearFade()
    if (activeBgm) {
      activeBgm.pause()
      activeBgm.volume = 0
    }
    bgmPlaying.value = false
  }

  function toggleMute() {
    isMuted.value = !isMuted.value
    if (import.meta.client) {
      localStorage.setItem(MUTE_STORAGE_KEY, String(isMuted.value))
    }

    if (isMuted.value) {
      clearTransition()
      pauseBgm()
    } else {
      unlockAudio()
      playBgm()
    }
  }

  function setBgmVolume(value: number) {
    bgmVolume.value = Math.min(1, Math.max(0, value))
    if (import.meta.client) localStorage.setItem(BGM_VOLUME_STORAGE_KEY, String(bgmVolume.value))
    if (activeBgm && bgmPlaying.value) activeBgm.volume = bgmVolume.value
  }

  function setSfxVolume(value: number) {
    sfxVolume.value = Math.min(1, Math.max(0, value))
    if (import.meta.client) localStorage.setItem(SFX_VOLUME_STORAGE_KEY, String(sfxVolume.value))
  }

  function hydrateMuteState() {
    if (!import.meta.client) return
    const saved = localStorage.getItem(MUTE_STORAGE_KEY)
    isMuted.value = saved === null ? false : saved === 'true'
    const savedBgmVolume = localStorage.getItem(BGM_VOLUME_STORAGE_KEY)
    const savedSfxVolume = localStorage.getItem(SFX_VOLUME_STORAGE_KEY)
    if (savedBgmVolume !== null && Number.isFinite(Number(savedBgmVolume))) {
      bgmVolume.value = Math.min(1, Math.max(0, Number(savedBgmVolume)))
    }
    if (savedSfxVolume !== null && Number.isFinite(Number(savedSfxVolume))) {
      sfxVolume.value = Math.min(1, Math.max(0, Number(savedSfxVolume)))
    }
  }

  function bindVisibilityAudio() {
    if (!import.meta.client || visibilityBound) return
    visibilityBound = true
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        resumeAfterVisibility = bgmPlaying.value && !isMuted.value
        if (resumeAfterVisibility) pauseBgm()
      } else if (resumeAfterVisibility) {
        resumeAfterVisibility = false
        playBgm()
      }
    })
  }

  function bindVideoAudio() {
    if (!import.meta.client || videoAudioBound) return
    videoAudioBound = true

    function resumeBgmWhenVideoStops() {
      if (activeVideoTargets.size > 0) return

      const shouldResume = resumeBgmAfterVideo
      resumeBgmAfterVideo = false
      if (shouldResume && !isMuted.value) playBgm()
    }

    function findVideoTarget(event: Event): Element | null {
      const mediaPlayer = event.composedPath().find(
        target => target instanceof HTMLElement && target.localName === 'media-player'
      )
      if (mediaPlayer instanceof Element) return mediaPlayer
      return event.target instanceof HTMLVideoElement ? event.target : null
    }

    function handleVideoPlay(event: Event) {
      const target = findVideoTarget(event)
      if (!target || activeVideoTargets.has(target)) return

      if (activeVideoTargets.size === 0) {
        resumeBgmAfterVideo = bgmPlaying.value && !isMuted.value
        if (resumeBgmAfterVideo) pauseBgmImmediately()
      }
      activeVideoTargets.add(target)
    }

    function handleVideoStop(event: Event) {
      const target = findVideoTarget(event)
      if (!target || !activeVideoTargets.delete(target)) return
      resumeBgmWhenVideoStops()
    }

    document.addEventListener('play', handleVideoPlay, true)
    document.addEventListener('pause', handleVideoStop, true)
    document.addEventListener('ended', handleVideoStop, true)

    const removalObserver = new MutationObserver(() => {
      let removedPlayingVideo = false
      for (const target of activeVideoTargets) {
        if (!target.isConnected) {
          activeVideoTargets.delete(target)
          removedPlayingVideo = true
        }
      }
      if (removedPlayingVideo) resumeBgmWhenVideoStops()
    })
    removalObserver.observe(document.documentElement, { childList: true, subtree: true })
  }

  if (import.meta.client) bindVisibilityAudio()
  if (import.meta.client) bindVideoAudio()

  return {
    isMuted: readonly(isMuted),
    bgmPlaying: readonly(bgmPlaying),
    bgmAvailable: readonly(bgmAvailable),
    bgmVolume: readonly(bgmVolume),
    sfxVolume: readonly(sfxVolume),
    playSfx,
    playBgm,
    pauseBgm,
    pauseBgmImmediately,
    toggleMute,
    setBgmVolume,
    setSfxVolume,
    unlockAudio,
    hydrateMuteState
  }
}
