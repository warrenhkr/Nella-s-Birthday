import { CommunityPostCreateSchema } from '../../../schemas/index'
import prisma from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const body = await readBody(event)

  // Validate input
  const parsed = CommunityPostCreateSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation error',
      data: parsed.error.flatten()
    })
  }

  const post = await prisma.post.create({
    data: {
      content: parsed.data.content,
      pole: parsed.data.pole,
      authorId: user.id
    },
    include: {
      author: { select: { id: true, pseudo: true, profile: { select: { avatar: true } } } }
    }
  })

  setResponseStatus(event, 201)
  return {
    status: 201,
    message: 'Post créé avec succès',
    data: post
  }
})
