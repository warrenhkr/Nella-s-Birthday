import { requireAdmin } from '../../utils/auth'
import prisma from '../../utils/prisma'

// Liste des comptes (hors SUPER_ADMIN) pour l'attribution des rôles et des
// périmètres. `adminScopes` accompagne chaque compte afin que l'écran puisse
// afficher les périmètres en cours d'un administrateur.
export default defineEventHandler(async (event) => {
  await requireAdmin(event, ['supervision'])

  const accounts = await prisma.user.findMany({
    where: { role: { not: 'SUPER_ADMIN' } },
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
    data: accounts.map(account => ({ ...account, adminScopes: account.adminScopes ?? [] }))
  }
})
