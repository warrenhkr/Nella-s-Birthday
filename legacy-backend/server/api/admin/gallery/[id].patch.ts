import { z } from 'zod'
import prisma from '../../../utils/prisma'
import { requireEventManager } from '../../../utils/auth'

const GalleryPatchSchema = z.object({
  isPublished: z.boolean().optional(),
  title: z.string().trim().min(1).max(120).optional(),
  category: z.string().trim().min(1).max(40).optional(),
  eventTag: z.string().trim().max(80).nullable().optional()
}).refine(value => Object.keys(value).length > 0, 'Aucune modification fournie')

export default defineEventHandler(async (event) => {
  await requireEventManager(event, ['moderation'])
  const id = getRouterParam(event, 'id')
  const parsed = GalleryPatchSchema.safeParse(await readBody(event))
  if (!id || !parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Modification du média invalide.' })
  }

  const media = await prisma.galleryImage.update({ where: { id }, data: parsed.data })
  return { status: 200, data: media }
})
