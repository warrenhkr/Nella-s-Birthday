import { z } from 'zod'
import prisma from '../../../utils/prisma'
import { requireEventManager } from '../../../utils/auth'
import { enforceRateLimit } from '../../../utils/rate-limit'
import {
  EXTENSIONS_FICHIER_IMAGE,
  classifierLienImage,
  discoverPublicImageUrls,
  estHotePcloud,
  isPublicFolderUrl,
  lienImageAccessible,
  preparerMediasVideo,
  urlSourcePcloud
} from '../../../utils/import-media'

const BulkGallerySchema = z.object({
  title: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(40),
  eventDate: z.string().datetime(),
  eventTag: z.string().trim().max(80).nullable().optional(),
  eventId: z.string().nullable().optional(),
  imageUrls: z.array(z.string().url()).max(200).default([]),
  videoUrls: z.array(z.string().url()).max(200).default([]),
  /** Les médias importés arrivent EN ATTENTE (`isPublished: false`) : le tableau
   *  de bord de modération les approuve ensuite (PATCH /api/admin/gallery/:id).
   *  Avant, le défaut implicite de la base (true) les publiait d'emblée sur la
   *  galerie publique, sans aucune validation. */
  isPublished: z.boolean().default(false)
})

/** Limite RÉELLE d'un lot, appliquée APRÈS découpage des entrées.
 *  Avant, `.max(200)` zod ne comptait que les ENTRÉES du tableau : une seule
 *  chaîne « url1\nurl2\n… » de 300 liens passait la validation. */
const MAX_LIENS_PAR_LOT = 200

/** Découpe une saisie en liens.
 *
 *  PIÈGE CORRIGÉ (17/09/2026) : la virgule était traitée comme un séparateur
 *  inconditionnel, si bien qu'une URL qui en contient — cas courant des
 *  transformations Cloudinary (`…/upload/c_fill,w_800/sample.jpg`) — était
 *  découpée en morceaux et rejetée (« lien non reconnu ») au lieu d'être
 *  importée. La virgule ne sépare donc plus que lorsqu'un NOUVEAU lien
 *  commence juste après (« https://a,https://b » ou « https://a , https://b »).
 */
/** Découpe une saisie en liens.
 *
 *  PIÈGE CORRIGÉ (17/09/2026) : la virgule servait de séparateur INCONDITIONNEL,
 *  si bien qu'une URL qui en contient — cas courant des transformations
 *  Cloudinary (`.../upload/c_fill,w_800/sample.jpg`) — était découpée en
 *  morceaux puis rejetée (« lien non reconnu ») au lieu d'être importée.
 *  Séparateurs retenus : espaces/retours à la ligne, point-virgule, barre
 *  verticale. La virgule ne coupe QUE si un nouveau lien commence juste après
 *  (« https://a,https://b » ou « https://a , https://b »). */
function splitUrls(values: string[]) {
  return [...new Set(values.flatMap(value => value
    .split(/\s+|;+|\|+/)
    .flatMap(part => part.split(/,\s*(?=https?:\/\/)/i))
    .map(item => item.trim().replace(/[,;|]+$/, ''))
    .filter(Boolean)))]
}

/** Vérifie en parallèle l'accessibilité des liens directs (concurrence bornée). */
async function verifierLiensImages(liens: string[]) {
  const resultats = new Map<string, { accessible: boolean, statut: number | null }>()
  const file: string[] = [...liens]
  const ouvriers = Array.from({ length: Math.min(6, file.length) }, async () => {
    while (file.length) {
      const lien = file.shift()
      if (!lien) continue
      resultats.set(lien, await lienImageAccessible(lien))
    }
  })
  await Promise.all(ouvriers)
  return resultats
}

export default defineEventHandler(async (event) => {
  await requireEventManager(event, ['moderation'])
  enforceRateLimit(event, 'admin-gallery-bulk', 10, 60 * 1000, 'Trop d’imports média. Réessayez plus tard.')

  const parsed = BulkGallerySchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Import média invalide.', data: parsed.error.flatten() })

  const imageInputs = splitUrls(parsed.data.imageUrls)
  const videoInputs = splitUrls(parsed.data.videoUrls)
  if (!imageInputs.length && !videoInputs.length) throw createError({ statusCode: 400, statusMessage: 'Ajoutez au moins un lien image, dossier ou vidéo.' })
  if (imageInputs.length > MAX_LIENS_PAR_LOT) {
    throw createError({ statusCode: 400, statusMessage: `Un lot est limité à ${MAX_LIENS_PAR_LOT} liens. Reçu : ${imageInputs.length} lien(s) image.` })
  }
  if (videoInputs.length > MAX_LIENS_PAR_LOT) {
    throw createError({ statusCode: 400, statusMessage: `Un lot est limité à ${MAX_LIENS_PAR_LOT} liens. Reçu : ${videoInputs.length} lien(s) vidéo.` })
  }

  const errors: string[] = []

  // ------------------------------------------------------------
  // ZONE IMAGES — la nature du lien décide, pas la zone de collage.
  // ------------------------------------------------------------
  const imagesRetenues: string[] = []
  const videosDepuisZoneImages: string[] = []
  const liensDirects: string[] = []

  /** Règle PARTAGÉE (shared/media-providers.ts) : un seul jeu d'hôtes pCloud
   *  pour l'aperçu, l'import d'événements, la galerie et les produits. */
  const estDossierPcloud = estHotePcloud

  for (const input of imageInputs) {
    const nature = classifierLienImage(input)
    if (nature === 'DOSSIER') {
      if (!isPublicFolderUrl(input)) continue
      const discovered = await discoverPublicImageUrls(input)
      if (!discovered.length) {
        errors.push(`Aucune image trouvée dans le dossier : ${input}`)
        continue
      }
      // pCloud ne fournit que des liens de téléchargement DIRECTS, liés à
      // l'adresse IP qui les a demandés (HTTP 410 dès que l'IP change — voir
      // server/lib/media-resolution.ts). Comme l'import d'événements, on
      // enregistre donc le publink (stable) + le nom du fichier, et le proxy
      // re-résout au moment de l'affichage. Avant, le lien direct était stocké
      // tel quel : l'image cassait en production.
      const pcloud = estDossierPcloud(input)
      discovered.forEach((fichier) => {
        // On ne réécrit que les VRAIS liens de fichier direct (…/nom.jpg) :
        // un aperçu pCloud (…/getpubthumb?code=…) est déjà public et stable.
        const estFichierDirect = EXTENSIONS_FICHIER_IMAGE.test(fichier)
        imagesRetenues.push(pcloud && estFichierDirect ? urlSourcePcloud(input, fichier) : fichier)
      })
      continue
    }
    if (nature === 'VIDEO') {
      // Une vidéo collée dans la zone Images : on l'importe comme vidéo au lieu
      // de créer une « photo » dont l'URL n'est pas une image (vignette cassée,
      // aucun message). Le message n'est ajouté qu'après conversion réussie,
      // plus bas — sinon il annoncerait un import qui n'a pas eu lieu.
      videosDepuisZoneImages.push(input)
      continue
    }
    if (nature === 'INCONNU') {
      errors.push(`Lien image non reconnu (ni image JPG/PNG/WebP/GIF/BMP/AVIF, ni dossier public Google Drive, pCloud ou Terabox) : ${input}`)
      continue
    }
    liensDirects.push(input)
  }

  // Les images en CDN (Cloudinary, aperçus pCloud…) sont servies sans
  // extension : on ne les force pas à répondre ici, seule une panne FRANCHE
  // (DNS, 404, 410, 5xx) est signalée au lieu de créer un média mort.
  if (liensDirects.length) {
    const accessibilite = await verifierLiensImages(liensDirects)
    for (const lien of liensDirects) {
      const resultat = accessibilite.get(lien)
      if (!resultat?.accessible) {
        errors.push(`Lien image inaccessible (HTTP ${resultat?.statut ?? 'injoignable'}) : ${lien}`)
        continue
      }
      imagesRetenues.push(lien)
    }
  }

  // Un publink pCloud peut désigner un DOSSIER de vidéos : on crée un média
  // par fichier (publink + nom du fichier) et on remonte les liens
  // inexploitables au lieu d'insérer un média mort en silence.
  const zoneVideos = await preparerMediasVideo(videoInputs)
  errors.push(...zoneVideos.erreurs)
  // Les vidéos trouvées dans la zone Images : on ne prévient qu'une fois
  // qu'elles ont réellement été converties en média (sinon l'erreur du
  // pipeline vidéo explique déjà le refus).
  const videosDepuisZoneImagesPreparees = await preparerMediasVideo(videosDepuisZoneImages)
  if (videosDepuisZoneImagesPreparees.medias.length) {
    errors.push(`Lien(s) vidéo détecté(s) dans la zone Images, importé(s) comme vidéo : ${videosDepuisZoneImages.join(', ')}`)
  }
  errors.push(...videosDepuisZoneImagesPreparees.erreurs)
  const videosImportees = [...zoneVideos.medias, ...videosDepuisZoneImagesPreparees.medias]

  const imagesUniques = [...new Set(imagesRetenues)]
  const media = [
    ...imagesUniques.map(url => ({
      title: parsed.data.title,
      category: parsed.data.category,
      eventDate: new Date(parsed.data.eventDate),
      eventTag: parsed.data.eventTag || null,
      eventId: parsed.data.eventId || null,
      description: null,
      mediaType: 'IMAGE' as const,
      publicId: null,
      url,
      youtubeId: null,
      isPublished: parsed.data.isPublished
    })),
    ...videosImportees.map(video => ({
      title: parsed.data.title,
      category: parsed.data.category,
      eventDate: new Date(parsed.data.eventDate),
      eventTag: parsed.data.eventTag || null,
      eventId: parsed.data.eventId || null,
      description: null,
      mediaType: video.mediaType,
      publicId: null,
      url: video.url,
      sourceUrl: video.sourceUrl,
      youtubeId: video.youtubeId,
      isPublished: parsed.data.isPublished
    }))
  ]

  const eventId = parsed.data.eventId || null

  // Doublons YouTube (identifiant déjà en galerie) — comportement d'origine.
  const youtubeIds = media.map(item => item.youtubeId).filter((id): id is string => Boolean(id))
  const existingYoutubeIds = new Set((await prisma.galleryImage.findMany({
    where: { youtubeId: { in: youtubeIds } },
    select: { youtubeId: true }
  })).map(item => item.youtubeId).filter((id): id is string => Boolean(id)))

  // Doublons images : même URL déjà en galerie POUR LE MÊME ÉVÉNEMENT (ou pour
  // aucun événement). Sans ce filtre, réimporter un lien déjà publié créait un
  // second média identique, en silence. On ne dédoublonne PAS globalement : la
  // même photo peut légitimement illustrer deux événements différents.
  const urlsMedia = media.map(item => item.url)
  const existingUrls = new Set((await prisma.galleryImage.findMany({
    where: { url: { in: urlsMedia }, eventId },
    select: { url: true }
  })).map(item => item.url))
  const dejaVusLot = new Set<string>()

  const uniqueMedia = media.filter((item) => {
    if (existingUrls.has(item.url) || dejaVusLot.has(item.url)) {
      errors.push(`Média déjà présent dans la galerie${eventId ? ' pour cet événement' : ''} : ${item.url}`)
      return false
    }
    if (item.youtubeId && existingYoutubeIds.has(item.youtubeId)) {
      errors.push(`Vidéo YouTube déjà présente : ${item.url}`)
      return false
    }
    dejaVusLot.add(item.url)
    return true
  })

  if (uniqueMedia.length) await prisma.galleryImage.createMany({ data: uniqueMedia })
  // 201 CREATED réellement (avant : le corps annonçait 201 mais la réponse HTTP
  // restait 200, ce qui rendait le contrat d'API ambigu et cassait les tests).
  setResponseStatus(event, uniqueMedia.length > 0 ? 201 : 200)
  return { status: 201, created: uniqueMedia.length, rejected: errors.length, errors }
})
