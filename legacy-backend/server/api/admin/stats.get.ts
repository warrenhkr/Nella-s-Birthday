import prisma from '../../utils/prisma'

const defaultMissions = [
  { id: 'communication', title: 'Préparer la prochaine campagne de communication', status: 'À venir' },
  { id: 'validation', title: 'Valider les cartes des nouveaux membres', status: 'En cours' },
  { id: 'boutique', title: 'Gérer les demandes WhatsApp boutique', status: 'À traiter' }
]

export default defineEventHandler(async (event) => {
  await requireAdmin(event, ['membres', 'supervision'])

  try {
    const [totalUsers, totalEvents, totalProducts, recentSignups, activeBookings] = await Promise.all([
      prisma.user.count(),
      prisma.event.count(),
      prisma.product.count(),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, pseudo: true, email: true, pole: true, poles: true, createdAt: true }
      }),
      prisma.booking.count({ where: { status: 'confirmed' } })
    ])

    return {
      status: 200,
      data: {
        total_users: totalUsers,
        total_events: totalEvents,
        total_products: totalProducts,
        total_revenue: 0,
        active_members: totalUsers,
        active_bookings: activeBookings,
        recent_signups: recentSignups,
        missions: defaultMissions
      }
    }
  } catch (error) {
    console.warn('Admin stats fallback used because Prisma is unavailable:', error)

    return {
      status: 200,
      data: {
        total_users: 0,
        total_events: 0,
        total_products: 0,
        total_revenue: 0,
        active_members: 0,
        active_bookings: 0,
        recent_signups: [],
        missions: defaultMissions
      }
    }
  }
})
