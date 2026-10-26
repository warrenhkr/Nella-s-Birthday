// ============================================================
// server/api/media/proxy.get.ts — Proxy des médias pCloud.
//
// POURQUOI CE FICHIER EXISTE :
// pCloud génère des liens de téléchargement DIRECTS liés à l'adresse IP
// qui les a demandés. Si on renvoie un tel lien au navigateur, celui-ci
// arrive d'une AUTRE IP et pCloud répond :
//   HTTP 410 « This link was generated for another IP address. »
// → la galerie s'affichait vide en production (alors qu'elle marchait en
//   local, où serveur et navigateur partagent la même IP).
//
// SOLUTION : le navigateur ne parle JAMAIS à pCloud. Il demande
// /api/media/proxy?url=<publink> ; notre serveur résout le publink puis
// télécharge le fichier LUI-MÊME (même IP pour les deux étapes) et le
// renvoie en streaming. Le Range est transmis pour que Vidstack puisse
// démarrer vite et se déplacer dans la vidéo.
//
// La résolution (et son cache, indexé par publink de base) vit dans
// server/lib/media-resolution.ts afin d'être partagée avec
// proxy-video.get.ts : une seule résolution pour tout un dossier.
// ============================================================

import { Readable } from 'node:stream'
import { getQuery, getRequestHeader, sendStream, setResponseHeader } from 'h3'
import {
  choisirUrl,
  decouperCible,
  estUrlMediaProxyable,
  oublierResolution,
  resoudreUrls,
  typeMime,
  type TypeMedia
} from '../../lib/media-resolution'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const cible = typeof query.url === 'string' ? query.url : ''
  const type: TypeMedia = (typeof query.type === 'string' ? query.type : 'IMAGE').toUpperCase() === 'VIDEO'
    ? 'VIDEO'
    : 'IMAGE'

  if (!cible || !estUrlMediaProxyable(cible)) {
    throw createError({ statusCode: 400, statusMessage: 'Source média invalide.' })
  }

  const { base, nom } = decouperCible(cible)
  const range = getRequestHeader(event, 'range')

  const telecharger = (url: string) => fetch(url, {
    headers: range ? { range } : undefined,
    redirect: 'follow',
    signal: AbortSignal.timeout(30000)
  })

  let direct = choisirUrl(await resoudreUrls(base, type), nom, base)
  let reponse = await telecharger(direct)

  // Le cache peut contenir un lien généré par une IP différente (instance
  // serverless recyclée) : on re-résout une fois avant d'abandonner.
  if (reponse.status === 410 || reponse.status === 403) {
    oublierResolution(base, type)
    direct = choisirUrl(await resoudreUrls(base, type), nom, base)
    reponse = await telecharger(direct)
  }

  if (!reponse.ok || !reponse.body) {
    throw createError({
      statusCode: reponse.status === 410 || reponse.status === 403 ? 502 : (reponse.status || 502),
      statusMessage: 'Média indisponible chez pCloud.'
    })
  }

  setResponseHeader(event, 'content-type', typeMime(direct, reponse.headers.get('content-type') || ''))
  setResponseHeader(event, 'accept-ranges', reponse.headers.get('accept-ranges') || 'bytes')
  // Cache navigateur/CDN : le publink et son contenu ne changent pas.
  setResponseHeader(event, 'cache-control', 'public, max-age=3600')
  // L'ETag de pCloud permet au navigateur de réutiliser les segments déjà vus.
  for (const entete of ['content-length', 'content-range', 'etag', 'last-modified']) {
    const valeur = reponse.headers.get(entete)
    if (valeur) setResponseHeader(event, entete, valeur)
  }
  event.node.res.statusCode = reponse.status

  return sendStream(event, Readable.fromWeb(reponse.body as never))
})
