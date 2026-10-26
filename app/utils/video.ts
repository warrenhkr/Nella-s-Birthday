export function playVideo(video: HTMLVideoElement | null) {
  if (!video || !video.paused) return

  void video.play().catch((error: unknown) => {
    console.error('Impossible de démarrer la lecture de la vidéo.', error)
  })
}

export function playVideoOnSurface(event: MouseEvent) {
  const video = event.currentTarget
  if (!(video instanceof HTMLVideoElement) || !video.paused) return

  const bounds = video.getBoundingClientRect()
  const nativeControlsHeight = Math.min(72, bounds.height * 0.2)
  if (event.clientY >= bounds.bottom - nativeControlsHeight) return

  event.preventDefault()
  playVideo(video)
}
