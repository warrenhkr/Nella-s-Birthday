import prisma from '../../../utils/prisma'
import { resolveUserPoles, toPoleSlug } from '#shared/poles'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const requestedPole = typeof query.pole === 'string' ? toPoleSlug(query.pole) : null

  const users = await prisma.user.findMany({
    // Multi-pôles : un membre appartient au pôle s'il l'a dans `poles` OU s'il
    // s'agit de son ancien pôle unique `pole` (comptes créés avant le multi).
    where: requestedPole
      ? { OR: [{ pole: requestedPole }, { poles: { has: requestedPole } }] }
      : undefined,
    orderBy: { createdAt: 'asc' },
    include: { profile: true }
  })

  return {
    status: 200,
    data: users.map((user, index) => {
      const poles = resolveUserPoles(user)
      return {
        id: user.id,
        pseudo: user.pseudo,
        // `pole` = pôle principal, conservé pour les lecteurs historiques ;
        // `poles` = liste complète à afficher en badges.
        pole: poles[0] ?? null,
        poles,
        level: user.profile?.level || 'Crew',
        ranking: users.length - index,
        avatar: user.profile?.avatar,
        bio: user.profile?.bio
      }
    })
  }
})
