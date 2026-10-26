import prisma from '../../utils/prisma'
import { resolveUserPoles } from '#shared/poles'

export default defineEventHandler(async () => {
  const cards = await prisma.otakuCard.findMany({
    where: { status: 'APPROVED' },
    orderBy: { reviewedAt: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          pseudo: true,
          nom: true,
          prenom: true,
          pole: true,
          poles: true,
          situation: true,
          pays: true,
          profession: true,
          universite: true,
          filiere: true,
          profile: { select: { avatar: true, level: true } }
        }
      }
    }
  })

  return {
    status: 200,
    data: cards.map(card => ({
      id: card.id,
      displayName: card.displayName,
      imageUrl: card.imageUrl,
      favoriteAnime: card.favoriteAnime,
      favoriteManga: card.favoriteManga,
      favoriteAnimes: card.favoriteAnimes,
      favoriteMangas: card.favoriteMangas,
      favoriteGame: card.favoriteGame,
      bio: card.bio,
      status: card.status,
      createdAt: card.reviewedAt || card.createdAt,
      member: {
        id: card.user.id,
        pseudo: card.user.pseudo,
        nom: card.user.nom,
        prenom: card.user.prenom,
        pole: resolveUserPoles(card.user)[0] || null,
        poles: resolveUserPoles(card.user),
        level: card.user.profile?.level || 'Crew',
        avatar: card.user.profile?.avatar || null,
        situation: card.user.situation,
        pays: card.user.pays,
        profession: card.user.profession,
        universite: card.user.universite,
        filiere: card.user.filiere
      }
    }))
  }
})
