import { z } from 'zod'
import { richTextOptionalField } from '../../../schemas'
import prisma from '../../../utils/prisma'
import { requireShopManager } from '../../../utils/auth'

/**
 * Libellés français des champs, utilisés pour désigner SANS AMBIGUÏTÉ le champ
 * à corriger dans les messages d'erreur renvoyés au formulaire.
 */
const LIBELLES_CHAMPS: Record<string, string> = {
  name: 'le nom du produit',
  tag: 'les tags',
  category: 'la catégorie',
  description: 'la description',
  price: 'le prix',
  stock: 'le stock',
  imageUrls: 'les images',
  whatsappNumber: 'le numéro WhatsApp'
}

// Chaque contrainte porte un message français complet : le formulaire peut donc
// l'afficher tel quel sous le champ concerné (plus de 400 générique).
const ProductCreateSchema = z.object({
  name: z.string({ error: 'Le nom du produit est obligatoire.' })
    .trim()
    .min(2, 'Le nom du produit doit contenir au moins 2 caractères.')
    .max(120, 'Le nom du produit ne doit pas dépasser 120 caractères.'),
  tag: z.string({ error: 'Renseigne au moins un tag (ex. Naruto, nouveauté).' })
    .trim()
    .min(1, 'Renseigne au moins un tag (ex. Naruto, nouveauté).')
    .max(200, 'Les tags ne doivent pas dépasser 200 caractères.'),
  category: z.string({ error: 'Choisis une catégorie.' })
    .trim()
    .min(1, 'Choisis une catégorie.')
    .max(60, 'La catégorie est trop longue.')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'La catégorie doit être un identifiant en minuscules (ex. goodies).'),
  description: richTextOptionalField({
    max: 2000,
    maxMessage: 'La description ne doit pas dépasser 2 000 caractères.'
  }),
  price: z.number({ error: 'Le prix doit être un nombre en FCFA.' })
    .int('Le prix doit être un montant entier en FCFA.')
    .positive('Le prix doit être un montant positif en FCFA.'),
  whatsappNumber: z.string({ error: 'Le numéro WhatsApp doit être du texte.' })
    .regex(/^\+[1-9]\d{7,14}$/, 'Le numéro WhatsApp doit respecter le format international (+229XXXXXXXX).')
    .optional(),
  stock: z.number({ error: 'Le stock doit être une quantité.' })
    .int('Le stock doit être une quantité entière.')
    .nonnegative('Le stock ne peut pas être négatif.'),
  imageUrls: z.array(z.string().url('Chaque image doit être une adresse valide.'))
    .min(1, 'Ajoute au moins une image produit.')
    .max(3, 'Trois images maximum par produit.')
})

/** Messages rédigés par le projet (français complet) — à conserver tels quels. */
const MESSAGE_REDIGE = /^(Le |La |Les |L'|Renseigne|Choisis|Ajoute|Trois|Chaque)/

/**
 * Message PRÉCIS du premier problème détecté : il désigne le champ fautif et la
 * correction attendue, au lieu d'un « Informations produit invalides. » qui ne
 * laissait aucun moyen de savoir quoi corriger.
 */
function messagePrecis(erreur: z.ZodError): string {
  const probleme = erreur.issues[0]
  if (!probleme) return 'Informations produit invalides.'
  if (MESSAGE_REDIGE.test(probleme.message)) return probleme.message
  // Message par défaut de zod (anglais) : on le remplace par une phrase française
  // qui dit quel champ vérifier.
  const champ = LIBELLES_CHAMPS[String(probleme.path[0] ?? '')] ?? 'le produit'
  return `Vérifie ${champ} : valeur invalide.`
}

/** Premier message par champ, pour souligner les champs du formulaire. */
function messagesParChamp(erreur: z.ZodError): Record<string, string> {
  const champs: Record<string, string> = {}
  for (const probleme of erreur.issues) {
    const cle = String(probleme.path[0] ?? '')
    if (cle && !champs[cle]) champs[cle] = probleme.message
  }
  return champs
}

export default defineEventHandler(async (event) => {
  await requireShopManager(event)
  const parsed = ProductCreateSchema.safeParse(await readBody(event))

  if (!parsed.success) {
    // `statusMessage` est affiché par le formulaire (toast) ; `data.champs`
    // permet en plus de marquer chaque champ en erreur.
    throw createError({
      statusCode: 400,
      statusMessage: messagePrecis(parsed.error),
      data: { ...parsed.error.flatten(), champs: messagesParChamp(parsed.error) }
    })
  }

  const imageUrl = parsed.data.imageUrls[0]
  const product = await prisma.product.create({
    data: {
      ...parsed.data,
      category: parsed.data.category.toLowerCase(),
      imageUrl,
      imageUrls: parsed.data.imageUrls
    }
  })

  setResponseStatus(event, 201)
  return { status: 201, data: product }
})
