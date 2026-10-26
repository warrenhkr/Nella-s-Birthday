import { z } from 'zod'
import prisma from '../../utils/prisma'
import { requireEventManager } from '../../utils/auth'
import { YoutubeUrlSchema } from '../../schemas/index'
import { enforceRateLimit } from '../../utils/rate-limit'
import { parseVideoUrl, preparerMediasVideo } from '../../utils/import-media'

const GalleryImageSchema = z.object({
  title: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(40),
  eventDate: z.string().datetime(),
  eventTag: z.string().trim().max(80).nullable().optional(),
  eventId: z.string().nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
  mediaType: z.enum(['IMAGE', 'YOUTUBE_VIDEO', 'VIDEO']).default('IMAGE'),
  youtubeUrl: YoutubeUrlSchema.nullable().optional(),
  videoUrl: z.string().url().nullable().optional(),
  publicId: z.string().trim().max(255).nullable().optional(),
  url: z.string().url().max(2048).nullable().optional()
}).superRefine((value, context) => {
  if (value.mediaType === 'IMAGE' && !value.url) context.addIssue({ code: 'custom', path: ['url'], message: 'Une image est requise.' })
  if (value.mediaType === 'YOUTUBE_VIDEO' && !value.youtubeUrl) context.addIssue({ code: 'custom', path: ['youtubeUrl'], message: 'Une URL YouTube est requise.' })
  if (value.mediaType === 'VIDEO' && !value.videoUrl && !value.url) context.addIssue({ code: 'custom', path: ['videoUrl'], message: 'Une URL vidéo ou un fichier vidéo est requis.' })
})

export default defineEventHandler(async (event) => {
  await requireEventManager(event, ['moderation'])
  enforceRateLimit(event, 'admin-gallery', 30, 60 * 1000, 'Trop de publications dans la galerie. Réessayez plus tard.')
  const parsed = GalleryImageSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Image de galerie invalide',
      data: parsed.error.flatten()
    })
  }

  const video = parsed.data.videoUrl ? parseVideoUrl(parsed.data.videoUrl) : null
  const youtubeId = parsed.data.youtubeUrl ? parseVideoUrl(parsed.data.youtubeUrl)?.id || null : null
  if (parsed.data.mediaType === 'YOUTUBE_VIDEO' && !youtubeId) {
    throw createError({ statusCode: 400, statusMessage: 'URL YouTube invalide ou identifiant absent.' })
  }
  if (parsed.data.mediaType === 'VIDEO' && parsed.data.videoUrl && !video) {
    throw createError({ statusCode: 400, statusMessage: 'Plateforme vidéo non supportée. Utilisez YouTube, Vimeo, Dailymotion, Twitch, Google Drive ou pCloud.' })
  }
  if (youtubeId && await prisma.galleryImage.findFirst({ where: { youtubeId } })) {
    throw createError({ statusCode: 409, statusMessage: 'Cette vidéo YouTube est déjà présente dans la galerie.' })
  }

  // Un publink pCloud de dossier peut contenir plusieurs vidéos : on enregistre
  // le publink + le nom du fichier (« …#f=nom.mp4 ») et non un lien direct
  // (lié à l'IP du demandeur, donc cassé en production). Message clair si
  // aucune vidéo ne peut être extraite, au lieu d'enregistrer un média mort.
  const { medias: videosImportees, erreurs: erreursVideo } = await preparerMediasVideo(
    parsed.data.mediaType === 'VIDEO' && parsed.data.videoUrl ? [parsed.data.videoUrl] : []
  )
  if (parsed.data.mediaType === 'VIDEO' && parsed.data.videoUrl && !videosImportees.length) {
    throw createError({ statusCode: 400, statusMessage: erreursVideo[0] || 'Vidéo non supportée.' })
  }
  const videoImportee = videosImportees[0]

  const resolvedMediaUrl = parsed.data.mediaType === 'VIDEO' && parsed.data.videoUrl
    ? (videoImportee?.url || parsed.data.videoUrl || '')
    : parsed.data.url || (youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : videoImportee?.url || '')

  const media = await prisma.galleryImage.create({
    data: {
      title: parsed.data.title,
      category: parsed.data.category,
      eventDate: parsed.data.eventDate ? new Date(parsed.data.eventDate) : null,
      eventTag: parsed.data.eventTag,
      eventId: parsed.data.eventId,
      description: parsed.data.description,
      mediaType: parsed.data.mediaType,
      publicId: parsed.data.publicId,
      url: resolvedMediaUrl,
      sourceUrl: videoImportee?.sourceUrl ?? null,
      youtubeId
    }
  })
  setResponseStatus(event, 201)
  return { status: 201, data: media }
})
