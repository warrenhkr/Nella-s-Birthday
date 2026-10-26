import prisma from '../../utils/prisma'
import { isScopedAdmin, requireAdmin } from '../../utils/auth'

// Liste des administrateurs / gestionnaires : chaque entrée porte ses
// périmètres (`adminScopes`) pour que l'écran de supervision puisse les
// afficher et les modifier.
export default defineEventHandler(async (event) => {
  await requireAdmin(event, ['supervision'])

  const admins = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'INTERMEDIATE_ADMIN', 'SHOP_MANAGER'] } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      pseudo: true,
      role: true,
      isActive: true,
      pole: true,
      poles: true,
      adminScopes: true,
      nom: true,
      prenom: true,
      telephone: true,
      universite: true,
      faculte: true,
      filiere: true,
      createdAt: true
    }
  })

  return {
    status: 200,
    data: admins.map(admin => ({
      ...admin,
      adminScopes: admin.adminScopes ?? [],
      isScopedAdmin: isScopedAdmin(admin)
    }))
  }
})
