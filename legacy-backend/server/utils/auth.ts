import { createServerClient, serializeCookieHeader, parseCookieHeader } from '@supabase/ssr'
import type { Database } from '../../types/supabase'
import prisma from './prisma'
import { readSession } from './session'
import {
  adminScopeLabels,
  canUseAdminScope,
  normalizeAdminScopes,
  type AdminScope
} from '../../shared/admin-scopes'

export function useSupabaseServer(event: any) {
  const config = useRuntimeConfig()

  return createServerClient<Database>(
    config.public.supabaseUrl,
    config.public.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(getRequestHeader(event, 'cookie') ?? '')
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            setResponseHeader(event, 'set-cookie', serializeCookieHeader(name, value, options))
          })
        }
      }
    }
  ) as any
}

export async function getUser(event: any) {
  const userId = await readSession(event)
  if (!userId) return null

  return prisma.user.findUnique({ where: { id: userId } })
}

export async function getUserProfile(event: any) {
  const user = await getUser(event)
  if (!user) return null

  const profile = await prisma.userProfile.findUnique({ where: { userId: user.id } })
  return profile ? { ...profile, role: user.role } : null
}

export async function requireAuth(event: any) {
  const user = await getUser(event)

  if (!user || !user.isActive) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized - vous devez être connecté'
    })
  }

  return user
}

export async function requireRole(event: any, ...allowedRoles: string[]) {
  const user = await requireAuth(event)
  const profile = await getUserProfile(event)

  const normalizedRoles = allowedRoles.map((role) => role.toUpperCase())
  if (!normalizedRoles.includes(user.role)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden - permissions insuffisantes'
    })
  }

  return { user, profile }
}

// ─────────────────────────────────────────────────────────────────────────────
// PÉRIMÈTRES D'ADMINISTRATION (adminScopes) — voir shared/admin-scopes.ts
// ─────────────────────────────────────────────────────────────────────────────
//
// Un compte `role='ADMIN'` dont `adminScopes` est NON vide ne peut agir que sur
// les domaines de ses périmètres. `adminScopes` vide = administrateur complet
// (compatibilité ascendante : aucun compte existant ne perd de droits).
// SUPER_ADMIN, INTERMEDIATE_ADMIN, SHOP_MANAGER et MEMBER ne sont jamais
// limités : leurs droits sont exactement ceux d'avant.
//
// Règle de sécurité : une route qui n'annonce AUCUN périmètre est refusée à un
// administrateur limité (« échec fermé »). Ajouter une route admin revient donc
// à écrire explicitement le périmètre qu'elle exige ; oublier de le faire
// ferme l'accès au lieu de l'ouvrir.

/**
 * Vrai si le compte est un ADMIN explicitement limité à un ou plusieurs
 * périmètres (utile pour l'affichage : « administrateur à périmètre »).
 */
export function isScopedAdmin(user: { role?: string, adminScopes?: string[] } | null | undefined): boolean {
  if (!user || user.role !== 'ADMIN') return false
  return normalizeAdminScopes(user.adminScopes).length > 0
}

function scopedAccessError(user: { role?: string, adminScopes?: string[] }, required: readonly AdminScope[]) {
  const own = adminScopeLabels(normalizeAdminScopes(user.adminScopes))
  const message = required.length
    ? `Forbidden - administrateur limité aux périmètres : ${own}. Périmètre requis : ${adminScopeLabels(required)}.`
    : `Forbidden - administrateur limité aux périmètres : ${own}. Cette action n'appartient à aucun de ses périmètres.`

  return createError({ statusCode: 403, statusMessage: message })
}

/**
 * Garde commune : vérifie le rôle PUIS, pour un administrateur à périmètre,
 * l'appartenance au périmètre requis par la route.
 *
 * @param scopes périmètres autorisés à appeler la route. Omis (ou vide) =
 *               route qui n'appartient à aucun périmètre → refusée à un
 *               administrateur limité.
 */
export async function requireScopedRole(event: any, scopes: readonly AdminScope[] | undefined, ...allowedRoles: string[]) {
  const { user, profile } = await requireRole(event, ...allowedRoles)

  if (!canUseAdminScope(user.role, user.adminScopes ?? [], scopes ?? [])) {
    throw scopedAccessError(user, scopes ?? [])
  }

  return { user, profile }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPERVISION — pilotage des COMPTES (page /dashboard-super-admin) : lister les
// administrateurs, lister les comptes, attribuer un rôle. Le SUPER_ADMIN y a
// accès : c'est SON outil (il n'a ni carte membre, ni événement, ni boutique).
// Périmètre requis : `supervision`.
// ─────────────────────────────────────────────────────────────────────────────
export async function requireAdmin(event: any, scopes?: readonly AdminScope[]) {
  return requireScopedRole(event, scopes, 'super_admin', 'intermediate_admin', 'admin')
}

// ─────────────────────────────────────────────────────────────────────────────
// OPÉRATIONS DU CLUB (cartes membres, statistiques, tournois) : ADMIN et
// ADMIN_INTERMÉDIAIRE uniquement. Le SUPER_ADMIN est EXCLU — décision produit :
// il reçoit les signalements et suit l'avancement, il n'administre pas le club.
// ─────────────────────────────────────────────────────────────────────────────
export async function requireAdminOps(event: any, scopes?: readonly AdminScope[]) {
  return requireScopedRole(event, scopes, 'intermediate_admin', 'admin')
}

// Événements, galerie, imports, médias : mêmes rôles que requireAdminOps.
// Aligné sur la règle métier documentée : « le SUPER_ADMIN ne crée, ne modifie,
// n'importe ni ne supprime les événements ou leurs médias ».
export async function requireEventManager(event: any, scopes?: readonly AdminScope[]) {
  return requireScopedRole(event, scopes, 'intermediate_admin', 'admin')
}

// Boutique : gestionnaire boutique + administrateur intermédiaire (mêmes
// droits). Le SUPER_ADMIN est EXCLU : il commande des comptes dédiés pour ça.
// `admin` reste exclu : le rôle ADMIN n'a aucun écran boutique (le middleware
// `shop` le renvoie vers /dashboard) — API et UI restent alignés.
export async function requireShopManager(event: any) {
  return requireRole(event, 'intermediate_admin', 'shop_manager')
}

export async function requireSuperAdmin(event: any) {
  return requireRole(event, 'super_admin')
}
