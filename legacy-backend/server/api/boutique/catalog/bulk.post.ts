import { z } from 'zod'
import prisma from '../../../utils/prisma'
import { requireShopManager } from '../../../utils/auth'
import { classifierLienImage, discoverPublicImageUrls, estLienPcloudDirectLieAIp, urlImageDepuisDossier } from '../../../utils/import-media'

const ImportedProductSchema = z.object({
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(4000),
  category: z.string().trim().min(1).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  price: z.string().regex(/^\d+$/).transform(Number).refine(value => value > 0),
  stock: z.string().regex(/^\d+$/).transform(Number),
  whatsapp_number: z.string().regex(/^\+[1-9]\d{7,14}$/),
  image_url: z.string().url().optional().or(z.literal('')),
  image_url_2: z.string().url().optional().or(z.literal('')),
  image_url_3: z.string().url().optional().or(z.literal(''))
})

const BulkProductsSchema = z.object({ products: z.array(z.record(z.string(), z.string())).min(1).max(500) })

/** Champs qui portent les visuels d'un produit (dans cet ordre d'affichage). */
const CHAMPS_IMAGES = ['image_url', 'image_url_2', 'image_url_3'] as const
/** Un produit reste un visuel de vitrine : on borne ce qu'un dossier peut ajouter. */
const MAX_IMAGES_PAR_PRODUIT = 8

function keyForProductRow(row: { name: string, category: string, price: string | number }) {
  return `${(row.name || '').trim().toLowerCase()}|${(row.category || '').trim().toLowerCase()}|${String(row.price ?? '')}`
}

/**
 * MÊME PIPELINE QUE LA GALERIE (défaut H5 corrigé) : la nature du lien décide.
 *   - DOSSIER public (pCloud, Terabox, Google Drive) : parcouru, un visuel par
 *     fichier — publink pCloud + nom de fichier (« …#f=nom.jpg »), URL d'aperçu
 *     Terabox telle quelle ;
 *   - VIDEO : refusée en français (une vidéo n'est pas un visuel produit) ;
 *   - INCONNU : refusé en français (avant, l'URL était stockée telle quelle et
 *     la vitrine affichait une image cassée, sans message).
 */
async function resoudreImagesProduit(product: z.infer<typeof ImportedProductSchema>) {
  const urls: string[] = []
  const erreurs: string[] = []

  for (const champ of CHAMPS_IMAGES) {
    const valeur = (product[champ] || '').trim()
    if (!valeur) continue

    const nature = classifierLienImage(valeur)
    if (nature === 'DOSSIER') {
      const decouvertes = await discoverPublicImageUrls(valeur)
      if (!decouvertes.length) {
        erreurs.push(`${champ} : aucune image récupérée depuis le dossier public « ${valeur} » (dossier vide, éteint ou non partagé).`)
        continue
      }
      decouvertes.forEach(fichier => urls.push(urlImageDepuisDossier(valeur, fichier)))
      continue
    }
    if (nature === 'VIDEO') {
      erreurs.push(`${champ} : une vidéo ne peut pas servir de visuel produit (${valeur}).`)
      continue
    }
    if (nature === 'INCONNU') {
      erreurs.push(`${champ} : lien image non reconnu — attendu une image JPG/PNG/WebP/GIF/BMP/AVIF, un dossier public pCloud ou Terabox, ou une URL Google Drive : ${valeur}`)
      continue
    }
    if (estLienPcloudDirectLieAIp(valeur)) {
      erreurs.push(`${champ} : lien pCloud direct refusé (il est lié à l'adresse IP qui l'a créé et casserait en production) — utilisez le publink du dossier : ${valeur}`)
      continue
    }
    urls.push(valeur)
  }

  return { urls: [...new Set(urls)].slice(0, MAX_IMAGES_PAR_PRODUIT), erreurs }
}

export default defineEventHandler(async (event) => {
  await requireShopManager(event)
  const body = BulkProductsSchema.safeParse(await readBody(event))
  if (!body.success) throw createError({ statusCode: 400, statusMessage: 'Import produit invalide.' })

  const validProducts: Array<{ line: number, data: z.infer<typeof ImportedProductSchema>, imageUrls: string[] }> = []
  const invalid: Array<{ line: number, message: string }> = []
  const duplicates: Array<{ line: number, message: string }> = []
  const seenInBatch = new Set<string>()

  for (const [index, product] of body.data.products.entries()) {
    const line = index + 2
    const parsed = ImportedProductSchema.safeParse(product)
    if (!parsed.success) {
      invalid.push({ line, message: parsed.error.issues.map(issue => issue.message).join(', ') })
      continue
    }

    const images = await resoudreImagesProduit(parsed.data)
    if (images.erreurs.length) {
      invalid.push({ line, message: images.erreurs.join(', ') })
      continue
    }

    const key = keyForProductRow(parsed.data)
    if (seenInBatch.has(key)) {
      duplicates.push({ line, message: `Doublon intra-import sur ${parsed.data.name}` })
      continue
    }

    seenInBatch.add(key)
    validProducts.push({ line, data: parsed.data, imageUrls: images.urls })
  }

  if (!validProducts.length) {
    const reportCsv = ['line,status,message', ...invalid.map(item => `${item.line},invalid,"${String(item.message).replace(/"/g, '""')}"`), ...duplicates.map(item => `${item.line},duplicate,"${String(item.message).replace(/"/g, '""')}"`)].join('\n')
    return {
      status: 200,
      created: 0,
      duplicates: duplicates.length,
      invalid: invalid.length,
      ignored: invalid.length + duplicates.length,
      total: body.data.products.length,
      reportCsv,
      rows: [
        ...invalid.map(item => ({ line: item.line, status: 'invalid' as const, message: item.message })),
        ...duplicates.map(item => ({ line: item.line, status: 'duplicate' as const, message: item.message }))
      ]
    }
  }

  const created = await prisma.$transaction(async (transaction) => {
    const result: Array<{ line: number, status: 'created', message: string }> = []

    for (const item of validProducts) {
      const product = item.data
      const existing = await transaction.product.findFirst({
        where: { name: product.name, category: product.category }
      })

      if (existing) {
        duplicates.push({ line: item.line, message: `Doublon existant : ${product.name}` })
        continue
      }

      await transaction.product.create({
        data: {
          name: product.name,
          description: product.description,
          category: product.category,
          tag: product.category,
          price: product.price,
          stock: product.stock,
          whatsappNumber: product.whatsapp_number,
          imageUrl: item.imageUrls[0] || null,
          imageUrls: item.imageUrls as unknown as object
        }
      })

      result.push({
        line: item.line,
        status: 'created',
        message: item.imageUrls.length
          ? `Créé : ${product.name} (${item.imageUrls.length} visuel(s))`
          : `Créé : ${product.name}`
      })
    }

    return result
  })

  const reportRows = [
    ...invalid.map(item => ({ line: item.line, status: 'invalid' as const, message: item.message })),
    ...duplicates.map(item => ({ line: item.line, status: 'duplicate' as const, message: item.message })),
    ...created.map(item => ({ line: item.line, status: item.status, message: item.message }))
  ].sort((a, b) => a.line - b.line)

  const reportCsv = [
    'line,status,message',
    ...reportRows.map(row => `${row.line},${row.status},"${String(row.message).replace(/"/g, '""')}"`)
  ].join('\n')

  return {
    status: 201,
    created: created.length,
    duplicates: duplicates.length,
    invalid: invalid.length,
    ignored: invalid.length + duplicates.length,
    total: body.data.products.length,
    reportCsv,
    rows: reportRows
  }
})
