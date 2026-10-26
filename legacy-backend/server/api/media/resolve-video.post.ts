// ============================================================
// server/api/media/resolve-video.post.ts — Prépare l'URL de lecture
// d'une vidéo pCloud pour le lecteur.
//
// RÔLE : le navigateur envoie le lien public stable
// (https://u.pcloud.link/publink/show?code=…) et reçoit une URL de
// NOTRE proxy, que Vidstack sait lire.
//
// AVANT : on résolvait ici le publink en lien direct pCloud, puis on
// renvoyait ce lien direct au navigateur. Deux défauts :
//   1. le lien direct est lié à l'IP de CE serveur : s'il était ensuite
//      servi par une autre instance, pCloud répondait 410 ;
//   2. la résolution coûte ~4 s (page publink + appels api.pcloud.com) et
//      bloquait le démarrage du lecteur, alors que le proxy la refaisait
//      de toute façon.
// Désormais on renvoie directement l'URL du proxy : plus d'attente ici,
// et la résolution est mise en cache côté proxy (une fois par dossier).
// ============================================================

import { z } from 'zod'
import { estUrlPcloud } from '../../lib/media-resolution'

const BodySchema = z.object({ url: z.string().url().max(2048) })

export default defineEventHandler(async (event) => {
  const parsed = BodySchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'URL vidéo invalide.' })

  const publique = parsed.data.url
  if (!estUrlPcloud(publique)) {
    throw createError({ statusCode: 400, statusMessage: 'Source vidéo invalide.' })
  }

  // On transmet le publink TEL QUEL (stable) : c'est le proxy média qui
  // résout, depuis la même machine que le téléchargement.
  return {
    status: 200,
    url: `/api/media/proxy?url=${encodeURIComponent(publique)}&type=VIDEO`
  }
})
