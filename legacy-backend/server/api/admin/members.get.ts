import { requireAdminOps } from '../../utils/auth'
import prisma from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const { user } = await requireAdminOps(event, ['membres', 'supervision'])

  const members = await prisma.user.findMany({
    where: user.role === 'ADMIN' ? { role: { not: 'SUPER_ADMIN' } } : undefined,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      pseudo: true,
      role: true,
      isActive: true,
      pole: true,
      poles: true,
      nom: true,
      prenom: true,
      telephone: true,
      universite: true,
      faculte: true,
      filiere: true,
      createdAt: true
    }
  })

  return { status: 200, data: members }
})
