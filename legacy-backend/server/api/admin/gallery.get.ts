import prisma from '../../utils/prisma'
import { requireEventManager } from '../../utils/auth'
import { normalizePublicMediaForResponse } from '../../utils/import-media'

function hasUsableGalleryUrl(value: string | null | undefined) {
  if (typeof value !== 'string') return false

  const normalized = value.trim()
  if (!normalized || /^null$/i.test(normalized) || /^undefined$/i.test(normalized)) return false
  if (/^(?:data:|blob:|javascript:|about:)/i.test(normalized)) return false

  try {
    const parsed = new URL(normalized)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

export default defineEventHandler(async (event) => {
  await requireEventManager(event, ['moderation'])
  const items = await prisma.galleryImage.findMany({ orderBy: { createdAt: 'desc' } })
  const validItems = items.filter(item => hasUsableGalleryUrl(item.url) || hasUsableGalleryUrl(item.sourceUrl))

  return {
    status: 200,
    data: await Promise.all(validItems.map(async (item) => ({
      ...item,
      url: await normalizePublicMediaForResponse(item.url, item.mediaType === 'IMAGE' ? 'IMAGE' : 'VIDEO'),
      sourceUrl: item.sourceUrl ? await normalizePublicMediaForResponse(item.sourceUrl, item.mediaType === 'IMAGE' ? 'IMAGE' : 'VIDEO') : null
    })))
  }
})
