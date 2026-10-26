import prisma from '../utils/prisma'

const defaultHomeData = {
  heroStats: [
    { label: 'Membres actifs', value: '0' },
    { label: 'Événements', value: '0' },
    { label: 'Tournois', value: '0' },
    { label: 'Cartes Otaku', value: '0' }
  ],
  poles: [
    { name: 'Anime', icon: 'i-lucide-film', description: 'Séries, recommandations, clubs de visionnage et moments de partage.' },
    { name: 'Manga', icon: 'i-lucide-book-open', description: 'Sorties, critiques, découvertes et atlas de lecture.' },
    { name: 'Gaming', icon: 'i-lucide-gamepad-2', description: 'Tournois, rencontres, sessions de jeu et compétitions campus.' },
    { name: 'Danse', icon: 'i-lucide-music-4', description: 'Chorégraphies, performances, crew et animations culturelles.' },
    { name: 'K-Drama', icon: 'i-lucide-clapperboard', description: 'Buzz, drama du moment et recommandations de la communauté.' },
    { name: 'Culture', icon: 'i-lucide-sparkles', description: 'Cosplay, tendances, fandom et activités de sensibilisation.' }
  ],
  featuredEvents: [
    { title: 'Cosplay Night', date: '12 Oct', place: 'Campus ENEAM', type: 'Culture' },
    { title: 'Anime Battle Arena', date: '24 Oct', place: 'Hall S', type: 'Gaming' },
    { title: 'K-Drama Social', date: '02 Nov', place: 'Taverne du Club', type: 'K-Drama' }
  ],
  activityHighlights: [
    { name: 'Tournois', detail: 'Compétitions campus', icon: 'i-lucide-swords', tone: 'primary' },
    { name: 'Ateliers', detail: 'Création & culture pop', icon: 'i-lucide-users-round', tone: 'accent' },
    { name: 'Watch party', detail: 'Sessions anime', icon: 'i-lucide-monitor-play', tone: 'neutral' }
  ],
  shopHighlights: []
}

export default defineEventHandler(async () => {
  try {
    const [eventCount, tournamentCount, approvedCardCount, activeMemberCount, products] = await Promise.all([
      prisma.event.count(),
      prisma.tournament.count(),
      prisma.otakuCard.count({ where: { status: 'APPROVED' } }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.product.findMany({
        where: { stock: { gt: 0 } },
        include: {
          orderItems: {
            where: { order: { status: { not: 'CANCELLED' } } },
            select: { quantity: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      })
    ])
    const shopHighlights = products
      .map(product => ({
        id: product.id,
        title: product.name,
        price: product.price,
        tag: product.tag,
        category: product.category,
        imageUrl: product.imageUrl,
        whatsappNumber: product.whatsappNumber,
        soldQuantity: product.orderItems.reduce((total, item) => total + item.quantity, 0)
      }))
      .sort((first, second) => second.soldQuantity - first.soldQuantity)
      .slice(0, 3)

    return {
      status: 200,
      data: {
        ...defaultHomeData,
        heroStats: [
          { label: 'Membres actifs', value: formatStatValue(activeMemberCount) },
          { label: 'Événements', value: formatStatValue(eventCount) },
          { label: 'Tournois', value: formatStatValue(tournamentCount) },
          { label: 'Cartes Otaku', value: formatStatValue(approvedCardCount) }
        ],
        shopHighlights
      }
    }
  } catch (error) {
    console.warn('Home data fallback used because Prisma is unavailable:', error)

    return {
      status: 200,
      data: {
        ...defaultHomeData,
        heroStats: defaultHomeData.heroStats.map(stat => ({ ...stat, value: '0' }))
      }
    }
  }
})

function formatStatValue(value: number) {
  if (value >= 1000) return `${Math.round(value / 100) / 10}k`
  return String(value)
}
