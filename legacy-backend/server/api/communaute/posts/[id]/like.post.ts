import prisma from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const { id } = getRouterParams(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Post ID is required'
    })
  }

  const body = await readBody(event)
  const { action } = body // 'like' or 'unlike'

  if (!['like', 'unlike'].includes(action)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid action'
    })
  }

  if (action === 'like') {
    const data = await prisma.like.upsert({
      where: { userId_postId: { userId: user.id, postId: id } },
      create: { userId: user.id, postId: id },
      update: {}
    })

    setResponseStatus(event, 201)
    return {
      status: 201,
      message: 'Post aimé',
      data
    }
  }

  await prisma.like.deleteMany({ where: { userId: user.id, postId: id } })
  return {
    status: 200,
    message: 'Like retiré'
  }
})
