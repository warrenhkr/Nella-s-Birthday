import prisma from '../../../utils/prisma'
import { requireEventManager } from '../../../utils/auth'

// ============================================================
// server/api/admin/events/[id].delete.ts
//
// Suppression d'un événement, avec un CHOIX EXPLICITE sur les médias.
//
// Par défaut les photos/vidéos sont CONSERVÉES : la relation
// GalleryImage -> Event est en `onDelete: SetNull`, et les souvenirs du
// club sont irremplaçables. Une suppression d'événement ne doit pas
// effacer des photos par accident (mauvaise date, doublon, correction…).
//
// Pour les supprimer aussi, il faut le demander explicitement :
//   DELETE /api/admin/events/<id>?avecMedias=true
// ============================================================

export default defineEventHandler(async (event) => {
  await requireEventManager(event, ['evenementiel'])
  const { id } = getRouterParams(event)
  const query = getQuery(event)

  const avecMedias = query.avecMedias === 'true' || query.avecMedias === '1'

  const existingEvent = await prisma.event.findUnique({
    where: { id },
    select: { id: true }
  })

  if (!existingEvent) {
    throw createError({ statusCode: 404, statusMessage: 'Événement introuvable.' })
  }

  const resultat = await prisma.$transaction(async (transaction) => {
    let mediasSupprimes = 0
    if (avecMedias) {
      const suppression = await transaction.galleryImage.deleteMany({ where: { eventId: id } })
      mediasSupprimes = suppression.count
    }
    await transaction.event.delete({ where: { id } })
    return { mediasSupprimes }
  }, { timeout: 60000, maxWait: 10000 })

  return {
    status: 200,
    message: avecMedias
      ? `Événement supprimé, ${resultat.mediasSupprimes} média(s) supprimé(s).`
      : 'Événement supprimé. Les photos et vidéos ont été conservées.',
    mediasSupprimes: resultat.mediasSupprimes
  }
})
