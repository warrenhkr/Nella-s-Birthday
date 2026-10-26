// ============================================================
// server/api/media/proxy-video.get.ts — Relais vidéo pCloud.
//
// Ce point d'entrée sert les vidéos demandées par URL complète
// (/api/media/proxy-video.mp4?url=<publink ou lien direct>). C'est
// l'ancienne forme utilisée par /api/media/resolve-video ; la galerie
// passe par proxy.get.ts.
//
// Avant, il n'avait AUCUN cache : chaque requête (et un lecteur vidéo en
// émet plusieurs : métadonnées puis segments Range) refaisait la
// résolution pCloud de ~4 s. Il partage désormais le cache de
// server/lib/media-resolution.ts et les mêmes en-têtes que proxy.get.ts.
//
// Le support Range est indispensable : il permet à Vidstack de démarrer
// sans télécharger le fichier entier et de se déplacer dans la vidéo.
// ============================================================

import { Readable } from 'node:stream'
import { getQuery, getRequestHeader, sendStream, setResponseHeader } from 'h3'
import {
  choisirUrl,
  decouperCible,
  estUrlMediaProxyable,
  oublierResolution,
  resoudreUrls,
  typeMime
} from '../../lib/media-resolution'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const cible = typeof query.url === 'string' ? query.url : ''
  if (!cible || !estUrlMediaProxyable(cible)) {
    throw createError({ statusCode: 400, statusMessage: 'Source vidéo invalide.' })
  }

  // Un publink peut pointer un DOSSIER : le fragment « #f=nom.mp4 » dit quel
  // fichier servir. Sans ce découpage, toutes les vidéos d'un même dossier
  // renvoyaient le PREMIER fichier (bug corrigé ici ; le proxy média,
  // lui, faisait déjà le tri par nom).
  const { base, nom } = decouperCible(cible)
  const range = getRequestHeader(event, 'range')

  const telecharger = (url: string) => fetch(url, {
    headers: range ? { range } : undefined,
    redirect: 'follow',
    signal: AbortSignal.timeout(30000)
  })

  let direct = choisirUrl(await resoudreUrls(base, 'VIDEO'), nom, base)
  let reponse = await telecharger(direct)

  // Lien direct périmé (généré pour une autre IP) : on purge et on re-résout.
  if (reponse.status === 410 || reponse.status === 403) {
    oublierResolution(base, 'VIDEO')
    direct = choisirUrl(await resoudreUrls(base, 'VIDEO'), nom, base)
    reponse = await telecharger(direct)
  }

  if (!reponse.ok || !reponse.body) {
    throw createError({
      statusCode: reponse.status === 410 || reponse.status === 403 ? 502 : (reponse.status || 502),
      statusMessage: 'Source vidéo indisponible.'
    })
  }

  setResponseHeader(event, 'content-type', typeMime(direct, reponse.headers.get('content-type') || '') || 'video/mp4')
  setResponseHeader(event, 'accept-ranges', reponse.headers.get('accept-ranges') || 'bytes')
  // Sans cet en-tête, Vercel appliquait « max-age=0, must-revalidate » :
  // chaque lecture relançait un téléchargement complet chez pCloud.
  setResponseHeader(event, 'cache-control', 'public, max-age=3600')
  for (const entete of ['content-length', 'content-range', 'etag', 'last-modified']) {
    const valeur = reponse.headers.get(entete)
    if (valeur) setResponseHeader(event, entete, valeur)
  }
  event.node.res.statusCode = reponse.status

  return sendStream(event, Readable.fromWeb(reponse.body as never))
})
