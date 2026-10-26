import { z } from 'zod'
import prisma from '../../../utils/prisma'
import { requireAdminOps } from '../../../utils/auth'

const StatusSchema = z.enum(['APPROVED', 'REJECTED', 'PENDING'])

export default defineEventHandler(async (event) => {
  await requireAdminOps(event, ['membres'])
  const id = getRouterParam(event, 'id')
  const parsed = StatusSchema.safeParse((await readBody(event)).status)
  if (!id || !parsed.success) throw createError({ statusCode: 400, statusMessage: 'Statut de carte invalide' })

  const card = await prisma.otakuCard.update({
    where: { id },
    data: { status: parsed.data, reviewedAt: parsed.data === 'PENDING' ? null : new Date() }
  })

  // Notify the card owner about the status change
  try {
    const message = parsed.data === 'APPROVED' ? 'Ta carte Otaku a été validée.' : parsed.data === 'REJECTED' ? 'Ta carte Otaku a été refusée.' : 'Le statut de ta carte Otaku a été réinitialisé.'
    await prisma.notification.create({
      data: {
        userId: card.userId,
        title: 'Mise à jour Carte Otaku',
        body: message,
        type: 'card'
      }
    })
  } catch (e) {
    console.warn('Failed to create notification for card status change', id, e)
  }

  return { status: 200, data: card }
})