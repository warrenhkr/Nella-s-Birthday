const rateLimitBuckets = new Map<string, { count: number, resetAt: number }>()

function getClientIdentifier(event: any) {
  const forwardedHeader = getHeader(event, 'x-forwarded-for')
  const forwarded = Array.isArray(forwardedHeader) ? forwardedHeader[0] : forwardedHeader
  const firstForwarded = typeof forwarded === 'string' ? forwarded.split(',')[0] : undefined
  const host = typeof firstForwarded === 'string' ? firstForwarded.trim() : ''

  return host || event.node?.req?.socket?.remoteAddress || 'unknown'
}

export function enforceRateLimit(
  event: any,
  bucketName: string,
  maxRequests: number,
  windowMs: number,
  message = 'Trop de requêtes. Réessayez plus tard.'
) {
  const clientId = getClientIdentifier(event)
  const key = `${bucketName}:${clientId}`
  const now = Date.now()
  const entry = rateLimitBuckets.get(key) || { count: 0, resetAt: now + windowMs }

  if (entry.resetAt <= now) {
    entry.count = 0
    entry.resetAt = now + windowMs
  }

  if (entry.count >= maxRequests) {
    throw createError({
      statusCode: 429,
      statusMessage: message
    })
  }

  entry.count += 1
  rateLimitBuckets.set(key, entry)
}
