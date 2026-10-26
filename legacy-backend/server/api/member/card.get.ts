import prisma from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const card = await prisma.otakuCard.findUnique({ where: { userId: user.id } })
  return { status: 200, data: card }
})