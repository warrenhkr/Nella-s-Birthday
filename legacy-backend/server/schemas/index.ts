import { z } from 'zod'
import { isRichTextEmpty, richTextLength, toSafeHtml } from '../../shared/rich-text'

/**
 * Champ de TEXTE RICHE côté API.
 * ---------------------------------------------------------------------------
 * 1. la longueur BRUTE est bornée (garde-fou anti-payload) ;
 * 2. le contenu est NETTOYÉ à l'écriture avec `toSafeHtml` — la même liste
 *    blanche que l'éditeur et l'affichage : la base ne contient donc jamais de
 *    `<script>`, d'attribut `on*` ni d'URL `javascript:` ;
 * 3. les bornes de LONGUEUR DE TEXTE (`richTextLength`) sont vérifiées APRÈS
 *    nettoyage, sur le texte seul : les 5 000 caractères annoncés à
 *    l'utilisateur sont 5 000 caractères de texte, pas de balisage.
 * Le texte brut (imports CSV, saisie sans éditeur) est converti en paragraphes.
 */
export function richTextField(options: { min?: number, max: number, minMessage?: string, maxMessage: string }) {
  const min = options.min ?? 0
  return z.string()
    .max(40_000, options.maxMessage)
    .transform(value => toSafeHtml(value))
    .refine(value => richTextLength(value) >= min, options.minMessage ?? options.maxMessage)
    .refine(value => richTextLength(value) <= options.max, options.maxMessage)
}

/**
 * Champ de TEXTE RICHE OPTIONNEL côté API (description de produit, description
 * de tournoi, réponse de l'administration à un signalement…).
 * Mêmes garanties que `richTextField`, plus le contrat des champs facultatifs :
 *   - `null`, `undefined` et la chaîne vide restent acceptés : un champ qui
 *     pouvait rester vide peut toujours l'être ;
 *   - un contenu sans AUCUN caractère visible (`<p></p>`, `<br>`) est ramené à
 *     `null` au lieu d'enregistrer du balisage vide en base ;
 *   - une image ou un séparateur seuls ne sont PAS « vides » (voir
 *     `isRichTextEmpty`) ;
 *   - la borne `max` porte sur le TEXTE (balisage exclu), donc sur la même
 *     mesure que le compteur affiché par l'éditeur.
 */
export function richTextOptionalField(options: { min?: number, max: number, minMessage?: string, maxMessage: string }) {
  return richTextField(options)
    .transform(value => (isRichTextEmpty(value) ? null : value))
    .nullable()
    .optional()
}

// ============================================================================
// AUTH & USER SCHEMAS
// ============================================================================

export const RoleEnum = z.enum(['super_admin', 'intermediate_admin', 'admin', 'shop_manager', 'member', 'guest'])
export type Role = z.infer<typeof RoleEnum>

export const UserSignUpSchema = z.object({
  email: z.string().trim().email('Email invalide'),
  password: z.string().min(8, 'Le mot de passe doit avoir au moins 8 caractères'),
  pseudo: z.string().trim().min(3, 'Le pseudo doit avoir au moins 3 caractères').max(20),
  pole: z.enum(['anime', 'manga', 'gaming', 'danse', 'k-drama', 'culture']),
  nom: z.string().trim().min(2, 'Le nom est obligatoire').max(80),
  prenom: z.string().trim().min(2, 'Le prénom est obligatoire').max(80),
  telephone: z.string().trim().min(6, 'Le numéro est obligatoire').max(30),
  situation: z.enum(['STUDENT_BENIN', 'STUDENT_ABROAD', 'PROFESSIONAL']).default('STUDENT_BENIN'),
  pays: z.string().trim().max(100).optional(),
  profession: z.string().trim().max(150).optional(),
  universite: z.string().trim().max(255).optional(),
  faculte: z.string().trim().max(255).default(''),
  filiere: z.string().trim().max(255).optional(),
  bio: z.string().trim().max(500).optional(),
  avatar_url: z.string().url().optional()
}).superRefine((value, context) => {
  const exiger = (champ: 'universite' | 'filiere' | 'pays' | 'profession', libelle: string) => {
    if ((value[champ] || '').trim().length < 2) {
      context.addIssue({ code: 'custom', path: [champ], message: `${libelle} est obligatoire` })
    }
  }

  if (value.situation === 'STUDENT_BENIN') {
    exiger('universite', 'L’université')
    exiger('filiere', 'La filière')
  } else if (value.situation === 'STUDENT_ABROAD') {
    exiger('pays', 'Le pays')
    exiger('universite', 'L’établissement')
    exiger('filiere', 'La filière')
  } else {
    exiger('profession', 'La profession ou activité')
  }
})

export type UserSignUp = z.infer<typeof UserSignUpSchema>

export const UserLoginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Le mot de passe est requis')
})

export const BulkOrderCreateSchema = z.object({
  customerName: z.string().min(2).max(100),
  phone: z.string().min(6).max(30),
  deliveryNote: z.string().max(500).optional(),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().positive().max(20)
  })).min(1, 'Ajoute au moins un produit')
})

export const OrderStatusSchema = z.enum(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'])

export type UserLogin = z.infer<typeof UserLoginSchema>

export const AdminCreateSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Le mot de passe doit avoir au moins 8 caractères'),
  pseudo: z.string().min(3, 'Le pseudo doit avoir au moins 3 caractères').max(20),
  pole: z.enum(['anime', 'manga', 'gaming', 'danse', 'k-drama', 'culture']).optional(),
  role: z.enum(['ADMIN', 'INTERMEDIATE_ADMIN', 'SHOP_MANAGER']).default('ADMIN'),
  // Périmètres d'administration (voir shared/admin-scopes.ts) : uniquement
  // exploités pour un compte ADMIN. Les valeurs sont validées dans le handler
  // contre la liste canonique (une liste vide = admin complet, compatibilité).
  adminScopes: z.array(z.string()).optional()
})

export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  pseudo: z.string(),
  pole: z.enum(['anime', 'manga', 'gaming', 'danse', 'k-drama', 'culture']),
  bio: z.string().optional(),
  avatar_url: z.string().url().optional(),
  role: RoleEnum,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  is_active: z.boolean()
})

export type UserProfile = z.infer<typeof UserProfileSchema>

// ============================================================================
// EVENT SCHEMAS
// ============================================================================

export const EventStatusEnum = z.enum(['upcoming', 'ongoing', 'completed', 'cancelled', 'postponed'])
export const EventTypeEnum = z.enum(['anime', 'manga', 'gaming', 'danse', 'k-drama', 'culture'])

export const EventCreateSchema = z.object({
  title: z.string().min(3, 'Le titre doit avoir au moins 3 caractères').max(100),
  description: richTextField({
    min: 10,
    max: 12_000,
    minMessage: 'Description minimale 10 caractères',
    maxMessage: 'La description ne doit pas dépasser 12 000 caractères'
  }),
  location: z.string().min(3, 'Lieu requis'),
  pole: z.enum(['anime', 'manga', 'gaming', 'danse', 'k-drama', 'culture', 'tous']),
  type: EventTypeEnum.optional(),
  status: EventStatusEnum.default('upcoming'),
  start_date: z.string().datetime('Format date-heure invalide'),
  end_date: z.string().datetime('Format date-heure invalide').optional(),
  image_url: z.string().url().optional(),
  max_attendees: z.number().int().positive().optional(),
  is_free: z.boolean().default(true),
  price: z.number().nonnegative().optional(),
  payment_instructions: z.string().max(5000).optional()
}).superRefine((value, context) => {
  if (value.end_date && new Date(value.end_date) <= new Date(value.start_date)) {
    context.addIssue({ code: 'custom', path: ['end_date'], message: 'La fin doit être après le début' })
  }
  if (!value.is_free && (!value.price || value.price <= 0)) {
    context.addIssue({ code: 'custom', path: ['price'], message: 'Le prix est requis pour un événement payant' })
  }
  if (!value.is_free && !value.payment_instructions?.trim()) {
    context.addIssue({ code: 'custom', path: ['payment_instructions'], message: 'Les instructions de paiement sont requises pour un événement payant' })
  }
})

export type EventCreate = z.infer<typeof EventCreateSchema>

export const YoutubeUrlSchema = z.string().url().refine((value) => {
  try {
    const host = new URL(value).hostname.replace(/^www\./, '').toLowerCase()
    return host === 'youtube.com' || host === 'youtu.be' || host.endsWith('.youtube.com')
  } catch {
    return false
  }
}, 'Seules les URL YouTube sont acceptees')

export const EventSchema = EventCreateSchema.safeExtend({
  id: z.string().uuid(),
  organizer_id: z.string().uuid(),
  status: EventStatusEnum,
  attendee_count: z.number().int().nonnegative(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
})

export type Event = z.infer<typeof EventSchema>

export const EventAttendeeSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid(),
  user_id: z.string().uuid(),
  status: z.enum(['registered', 'attended', 'cancelled']),
  registered_at: z.string().datetime()
})

export type EventAttendee = z.infer<typeof EventAttendeeSchema>

// ============================================================================
// BOUTIQUE SCHEMAS
// ============================================================================

export const ProductCategoryEnum = z.enum(['figurines', 'manga', 'goodies', 'vetements', 'autre'])

/**
 * Description de produit : TEXTE RICHE (saisi dans l'éditeur du site).
 * UNE SEULE définition des bornes, partagée par la publication et la
 * modification — 2 000 caractères de TEXTE (balisage exclu), soit exactement la
 * mesure du compteur affiché par l'éditeur.
 */
const PRODUCT_DESCRIPTION_OPTIONS = {
  max: 2000,
  maxMessage: 'La description ne doit pas dépasser 2 000 caractères'
}

export const ProductCreateSchema = z.object({
  name: z.string().min(3, 'Nom requis').max(100),
  description: richTextField({
    min: 10,
    minMessage: 'Description minimale 10 caractères',
    ...PRODUCT_DESCRIPTION_OPTIONS
  }),
  category: ProductCategoryEnum,
  price: z.number().positive('Prix doit être positif'),
  stock: z.number().int().nonnegative(),
  image_url: z.string().url().optional(),
  whatsapp_number: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Numéro WhatsApp invalide')
})

/**
 * Modification partielle d'un produit (PATCH) : tous les champs deviennent
 * facultatifs, mais la description garde EXACTEMENT le contrat de la création
 * (texte riche nettoyé, 2 000 caractères de texte, `null`/'' pour effacer).
 * Construite par `omit` + `extend` plutôt que par `partial()` : ce dernier
 * perdait le caractère `nullable` du champ de texte riche (vérifié en
 * exécution), ce qui aurait refusé un effacement de description.
 */
const ProductUpdateBaseSchema = ProductCreateSchema.omit({ description: true }).partial()

export const ProductUpdateSchema = ProductUpdateBaseSchema.extend({
  description: richTextOptionalField({ ...PRODUCT_DESCRIPTION_OPTIONS })
})

export type ProductCreate = z.infer<typeof ProductCreateSchema>

export type BulkOrderCreate = z.infer<typeof BulkOrderCreateSchema>

export const ProductSchema = ProductCreateSchema.extend({
  id: z.string().uuid(),
  seller_id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
})

export type Product = z.infer<typeof ProductSchema>

// ============================================================================
// COMMUNITY SCHEMAS
// ============================================================================

export const CommunityMemberSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  pole: z.enum(['anime', 'manga', 'gaming', 'danse', 'k-drama', 'culture']),
  joined_at: z.string().datetime(),
  level: z.enum(['novice', 'member', 'veteran', 'elite']),
  ranking: z.number().int().nonnegative()
})

export type CommunityMember = z.infer<typeof CommunityMemberSchema>

export const CommunityPostSchema = z.object({
  id: z.string().uuid(),
  author_id: z.string().uuid(),
  pole: z.enum(['anime', 'manga', 'gaming', 'danse', 'k-drama', 'culture', 'all']),
  content: z.string().min(1, 'Contenu requis').max(5000),
  image_urls: z.array(z.string().url()).optional(),
  likes_count: z.number().int().nonnegative(),
  comments_count: z.number().int().nonnegative(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
})

export type CommunityPost = z.infer<typeof CommunityPostSchema>

export const CommunityPostCreateSchema = z.object({
  content: richTextField({
    min: 3,
    max: 5_000,
    minMessage: 'Contenu requis',
    maxMessage: 'Le contenu ne doit pas dépasser 5 000 caractères'
  }),
  pole: z.enum(['anime', 'manga', 'gaming', 'danse', 'k-drama', 'culture', 'all']),
  image_urls: z.array(z.string().url()).optional()
})

export type CommunityPostCreate = z.infer<typeof CommunityPostCreateSchema>

// ============================================================================
// DASHBOARD & ANALYTICS SCHEMAS
// ============================================================================

export const DashboardStatsSchema = z.object({
  total_users: z.number().int().nonnegative(),
  total_events: z.number().int().nonnegative(),
  total_products: z.number().int().nonnegative(),
  total_revenue: z.number().nonnegative(),
  active_members: z.number().int().nonnegative(),
  recent_signups: z.array(UserProfileSchema).optional()
})

export type DashboardStats = z.infer<typeof DashboardStatsSchema>

// ============================================================================
// UPLOAD SCHEMAS (Cloudinary)
// ============================================================================

export const UploadResponseSchema = z.object({
  public_id: z.string(),
  url: z.string().url(),
  secure_url: z.string().url(),
  resource_type: z.enum(['image', 'video', 'raw']),
  format: z.string(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  bytes: z.number().int()
})

export type UploadResponse = z.infer<typeof UploadResponseSchema>

// ============================================================================
// API RESPONSE SCHEMAS
// ============================================================================

export const ApiErrorSchema = z.object({
  status: z.number().int(),
  message: z.string(),
  code: z.string().optional(),
  details: z.any().optional()
})

export type ApiError = z.infer<typeof ApiErrorSchema>

export const ApiSuccessSchema = z.object({
  status: z.number().int(),
  message: z.string().optional(),
  data: z.any().optional()
})

export type ApiSuccess = z.infer<typeof ApiSuccessSchema>

// ============================================================================
// ISSUE REPORT SCHEMAS
// ============================================================================

export const IssueReportCategorySchema = z.enum(['BUG', 'PROBLEM', 'SUGGESTION', 'OTHER'])
export const IssueReportPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
export const IssueReportStatusSchema = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'])

export const IssueReportCreateSchema = z.object({
  title: z.string().trim().min(3, 'Le titre doit avoir au moins 3 caractères').max(160),
  description: richTextField({
    min: 10,
    max: 10_000,
    minMessage: 'La description doit avoir au moins 10 caractères',
    maxMessage: 'La description ne doit pas dépasser 10 000 caractères'
  }),
  category: IssueReportCategorySchema,
  priority: IssueReportPrioritySchema.default('MEDIUM')
})

export const IssueReportUpdateSchema = z.object({
  // Réponse de l'administration : TEXTE RICHE (même éditeur que le reste du
  // site), nettoyé à l'écriture et borné sur le TEXTE — 10 000 caractères,
  // balisage exclu. Le champ reste facultatif : `null`, vide ou absent efface
  // la réponse, exactement comme avant.
  adminResponse: richTextOptionalField({
    max: 10_000,
    maxMessage: 'La réponse est trop longue'
  }),
  status: IssueReportStatusSchema.optional(),
  priority: IssueReportPrioritySchema.optional()
}).refine(value => Object.keys(value).length > 0, 'Aucune modification fournie')

export const IssueReportFilterSchema = z.object({
  status: IssueReportStatusSchema.optional(),
  priority: IssueReportPrioritySchema.optional(),
  category: IssueReportCategorySchema.optional()
})
