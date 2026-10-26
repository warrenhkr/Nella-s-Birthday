import { v2 as cloudinary } from 'cloudinary'
import { enforceRateLimit } from '../../utils/rate-limit'

type UploadResourceType = 'image'

function getCloudinaryErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object' && error !== null) {
    const candidate = error as { message?: unknown, error?: { message?: unknown }, http_code?: unknown }
    const message = candidate.error?.message || candidate.message
    if (typeof message === 'string' && message) {
      return typeof candidate.http_code === 'number' ? `${message} (code ${candidate.http_code})` : message
    }
    try {
      return JSON.stringify(error)
    } catch {
      return 'Erreur Cloudinary non détaillée.'
    }
  }
  return 'Erreur Cloudinary non détaillée.'
}

function getCloudinaryConfig() {
  const config = useRuntimeConfig()

  if (config.public.cloudinaryCloudName && config.public.cloudinaryApiKey && config.cloudinaryApiSecret) {
    cloudinary.config({
      cloud_name: config.public.cloudinaryCloudName,
      api_key: config.public.cloudinaryApiKey,
      api_secret: config.cloudinaryApiSecret
    })
    return
  }

  const cloudinaryUrl = process.env.CLOUDINARY_URL || config.cloudinaryUrl

  if (cloudinaryUrl) {
    if (!cloudinaryUrl.startsWith('cloudinary://')) {
      throw createError({
        statusCode: 500,
        statusMessage: 'CLOUDINARY_URL doit commencer par cloudinary://.'
      })
    }
    cloudinary.config({ cloudinary_url: cloudinaryUrl })
    return
  }

  if (!config.public.cloudinaryCloudName || !config.public.cloudinaryApiKey || !config.cloudinaryApiSecret) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Cloudinary est mal configuré côté serveur.'
    })
  }

  throw createError({ statusCode: 500, statusMessage: 'Cloudinary server configuration is missing.' })
}

function uploadBuffer(buffer: Buffer, resourceType: UploadResourceType, filename: string) {
  return new Promise<{ url: string, public_id: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType,
        filename_override: filename
      },
      (error, result) => {
        if (error || !result?.secure_url || !result.public_id) {
          reject(error || new Error('Cloudinary n’a pas retourné de fichier uploadé.'))
          return
        }

        resolve({
          url: result.secure_url,
          public_id: result.public_id
        })
      }
    )

    stream.end(buffer)
  })
}

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  enforceRateLimit(event, 'cloudinary-upload', 10, 60 * 1000, 'Trop de tentatives d’upload. Réessayez plus tard.')
  getCloudinaryConfig()

  const form = await readMultipartFormData(event)
  const file = form?.find(part => part.name === 'file' && part.data)
  const resourceType = form?.find(part => part.name === 'resource_type')?.data.toString() || 'image'

  if (!file?.data) {
    throw createError({ statusCode: 400, statusMessage: 'Aucun fichier fourni.' })
  }

  if (resourceType !== 'image') {
    throw createError({ statusCode: 400, statusMessage: 'Seules les images peuvent être envoyées sur Cloudinary.' })
  }

  const maxSize = 5 * 1024 * 1024
  if (file.data.length > maxSize) {
    throw createError({
      statusCode: 413,
      statusMessage: 'L’image ne doit pas dépasser 5 Mo.'
    })
  }

  if (resourceType === 'image' && !['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/bmp', 'image/tiff', 'image/svg+xml'].includes(file.type || '')) {
    throw createError({ statusCode: 400, statusMessage: 'Format image accepté : JPG, PNG, WebP, GIF, AVIF, BMP, TIFF ou SVG.' })
  }

  try {
    return await uploadBuffer(file.data, resourceType, file.filename || 'upload')
  } catch (error: unknown) {
    console.error('Cloudinary server upload error:', error)
    const reason = getCloudinaryErrorMessage(error)
    throw createError({
      statusCode: 502,
      statusMessage: `Cloudinary a refusé l’upload : ${reason}`
    })
  }
})
