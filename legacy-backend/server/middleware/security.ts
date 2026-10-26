export default defineEventHandler((event) => {
  const req = event.node.req
  const isApiRoute = req.url?.startsWith('/api')

  // En-têtes de durcissement appliqués à TOUTES les réponses (pages comprises) :
  // auparavant seules les routes /api étaient protégées, donc les pages HTML
  // partaient sans nosniff ni protection anti-cadrage.
  setResponseHeader(event, 'x-content-type-options', 'nosniff')
  setResponseHeader(event, 'x-frame-options', 'SAMEORIGIN')
  setResponseHeader(event, 'x-download-options', 'noopen')
  setResponseHeader(event, 'referrer-policy', 'strict-origin-when-cross-origin')
  setResponseHeader(event, 'permissions-policy', 'camera=(), microphone=(), geolocation=()')
  setResponseHeader(event, 'cross-origin-opener-policy', 'same-origin')
  setResponseHeader(event, 'cross-origin-resource-policy', 'same-origin')
  setResponseHeader(event, 'strict-transport-security', 'max-age=31536000; includeSubDomains')

  // La CSP complète reste limitée aux réponses JSON de l'API : l'appliquer aux
  // pages casserait les intégrations légitimes (Lottie, YouTube/Vimeo, pCloud,
  // polices Google) sans bénéfice réel pour une coquille HTML sans contenu tiers
  // interprété comme du script.
  if (isApiRoute) {
    setResponseHeader(event, 'content-security-policy', [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'self'",
      "object-src 'none'",
      "img-src 'self' data: https://res.cloudinary.com https://images.unsplash.com https://*.youtube.com https://*.ytimg.com https://*.pcloud.com https://u.pcloud.link https://*.googleusercontent.com https://*.google.com",
      "media-src 'self' https://res.cloudinary.com https://*.youtube.com https://*.ytimg.com https://*.pcloud.com https://u.pcloud.link https://*.googleusercontent.com https://*.google.com",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://www.youtube-nocookie.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co https://res.cloudinary.com https://api.cloudinary.com https://www.youtube.com https://www.googleapis.com https://*.pcloud.com https://u.pcloud.link https://*.google.com",
      "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://*.pcloud.com https://u.pcloud.link https://drive.google.com https://docs.google.com",
      "form-action 'self'",
      "upgrade-insecure-requests"
    ].join('; '))
    setResponseHeader(event, 'strict-transport-security', 'max-age=31536000; includeSubDomains')
  }
})
