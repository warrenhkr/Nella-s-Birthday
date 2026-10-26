import { toPoleSlug } from '#shared/poles'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  // Le pôle demandé est normalisé en slug officiel (« Anime » comme « anime ») :
  // la même valeur qu'à la publication, donc le filtre serveur reste aligné.
  const pole = typeof query.pole === 'string' ? toPoleSlug(query.pole) : null

  const posts = await prisma.post.findMany({
    where: pole ? { pole } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      author: { select: { id: true, pseudo: true, profile: { select: { avatar: true } } } },
      _count: { select: { likes: true, comments: true } }
    }
  })

  return {
    status: 200,
    data: posts.map((post) => ({
      id: post.id,
      author: post.author,
      pole: post.pole,
      content: post.content,
      likes: post._count.likes,
      comments: post._count.comments,
      createdAt: post.createdAt
    }))
  }
})
