import prisma from '../../../../utils/prisma'
import { requireEventManager } from '../../../../utils/auth'

// ============================================================
// GET /api/admin/events/<id>/media-count
//
// Nombre de photos/vidéos rattachées à un événement. Sert à la boîte de
// dialogue de suppression : « Supprimer aussi ses 24 photos ».
// ============================================================

export default defineEventHandler(async (event) => {
  await requireEventManager(event, ['evenementiel'])
  const { id } = getRouterParams(event)

  const count = await prisma.galleryImage.count({ where: { eventId: id } })

  return { status: 200, count }
})
