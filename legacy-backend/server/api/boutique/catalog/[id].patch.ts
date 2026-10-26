import { z } from 'zod'
import { richTextOptionalField } from '../../../schemas'
import prisma from '../../../utils/prisma'
import { requireShopManager } from '../../../utils/auth'

const ProductPatchSchema = z.object({
  imageUrl: z.string().url().nullable().optional(),
  imageUrls: z.array(z.string().url()).max(3).optional(),
  name: z.string().trim().min(2).max(120).optional(),
  tag: z.string().trim().min(1).max(200).optional(),
  category: z.string().trim().min(1).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  // Texte riche : nettoyé à l'écriture et borné sur le TEXTE (2 000 caractères,
  // balisage exclu), exactement comme la publication. `null` et '' effacent la
  // description, comme avant.
  description: richTextOptionalField({
    max: 2000,
    maxMessage: 'La description ne doit pas dépasser 2 000 caractères.'
  }),
  stock: z.number().int().nonnegative().optional(),
  price: z.number().int().positive().optional(),
  // NOTE : la colonne Json `variations` reste réservée en base (prisma/schema.prisma,
  // modèle Product) mais n'est plus acceptée ni écrite ici : aucune interface ne l'envoie.
  whatsappNumber: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Le numéro WhatsApp doit respecter le format international (+229XXXXXXXX).').nullable().optional()
}).refine(data => Object.keys(data).length > 0, 'Aucune modification fournie')

export default defineEventHandler(async (event) => {
  await requireShopManager(event)
  const id = getRouterParam(event, 'id')
  const parsed = ProductPatchSchema.safeParse(await readBody(event))
  if (!id || !parsed.success) throw createError({ statusCode: 400, statusMessage: 'Modification produit invalide', data: parsed.success ? undefined : parsed.error.flatten() })

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...parsed.data,
      category: parsed.data.category?.toLowerCase(),
      // L'image principale reste toujours la première de `imageUrls` : évite un
      // carrousel public obsolète quand la galerie du produit est remplacée ou vidée.
      imageUrl: parsed.data.imageUrls ? (parsed.data.imageUrls[0] ?? null) : parsed.data.imageUrl,
      imageUrls: parsed.data.imageUrls ?? undefined
    }
  })
  return { status: 200, data: product }
})
