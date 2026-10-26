import prisma from '../../utils/prisma'
import { requireAdminOps } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAdminOps(event, ['membres'])
  const cards = await prisma.otakuCard.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, pseudo: true, email: true, pole: true, poles: true, nom: true, prenom: true, telephone: true, situation: true, pays: true, profession: true, universite: true, faculte: true, filiere: true } } }
  })
  return { status: 200, data: cards }
})
