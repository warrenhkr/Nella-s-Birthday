// ============================================================================
// Pôles du Club Otaku — source de vérité UNIQUE, partagée entre l'application
// Vue (app/) et le serveur Nitro (server/).
//
// Historique : les comptes créés avant le multi-pôles n'ont qu'un `pole`
// (pôle unique, ancien champ). Les nouveaux comptes ont `poles: string[]`.
// TOUS les lecteurs doivent donc raisonner sur l'UNION « poles + pole » :
// c'est exactement ce que fait `resolveUserPoles()`, à utiliser partout
// plutôt que de lire `user.pole` directement.
// ============================================================================

/** Les 6 pôles officiels du club, dans l'ordre d'affichage. */
export const POLE_SLUGS = ['anime', 'manga', 'gaming', 'danse', 'k-drama', 'culture'] as const

export type PoleSlug = (typeof POLE_SLUGS)[number]

/** Libellé lisible de chaque pôle officiel. */
export const POLE_LABELS: Record<PoleSlug, string> = {
  'anime': 'Anime',
  'manga': 'Manga',
  'gaming': 'Gaming',
  'danse': 'Danse',
  'k-drama': 'K-Drama',
  'culture': 'Culture'
}

/** Icône (lucide) de chaque pôle officiel. */
export const POLE_ICONS: Record<PoleSlug, string> = {
  'anime': 'i-lucide-sparkles',
  'manga': 'i-lucide-book-open',
  'gaming': 'i-lucide-gamepad-2',
  'danse': 'i-lucide-music',
  'k-drama': 'i-lucide-clapperboard',
  'culture': 'i-lucide-globe'
}

/** Valeur « tous les pôles » utilisée par les annonces communautaires. */
export const ALL_POLES = 'all'

export function isPoleSlug(value: unknown): value is PoleSlug {
  return typeof value === 'string' && (POLE_SLUGS as readonly string[]).includes(value)
}

export function normalizePole(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase()
}

/**
 * Convertit une valeur libre en slug officiel.
 * Accepte un slug (« k-drama ») comme un libellé (« K-Drama »).
 * Renvoie `null` si la valeur ne correspond à aucun pôle officiel.
 */
export function toPoleSlug(value: string | null | undefined): PoleSlug | null {
  const normalized = normalizePole(value)
  if (!normalized) return null
  if (isPoleSlug(normalized)) return normalized
  return POLE_SLUGS.find(slug => normalizePole(POLE_LABELS[slug]) === normalized) ?? null
}

/**
 * Nettoie une liste de pôles reçue d'un client : slugs officiels uniquement,
 * doublons retirés, ordre d'envoi conservé.
 */
export function sanitizePoles(values: unknown): PoleSlug[] {
  if (!Array.isArray(values)) return []
  const cleaned: PoleSlug[] = []
  for (const raw of values) {
    const slug = toPoleSlug(typeof raw === 'string' ? raw : null)
    if (slug && !cleaned.includes(slug)) cleaned.push(slug)
  }
  return cleaned
}

/** Toute entité portant un pôle unique (`pole`) et/ou une liste (`poles`). */
export type PoleBearer = {
  pole?: string | null
  poles?: readonly string[] | null
}

/**
 * Union « poles + pole », en slugs officiels.
 *
 * Ordre : la liste `poles` d'abord (elle est la source du multi-pôles), puis
 * l'ancien `pole` s'il n'y figure pas — c'est ce qui garantit la compatibilité
 * ascendante avec les comptes mono-pôle.
 */
export function resolveUserPoles(user: PoleBearer | null | undefined): PoleSlug[] {
  if (!user) return []
  const union = sanitizePoles(user.poles)
  const legacy = toPoleSlug(user.pole)
  if (legacy && !union.includes(legacy)) union.push(legacy)
  return union
}

/** Pôle principal : premier pôle choisi, sinon l'ancien `pole`, sinon `null`. */
export function primaryPoleOf(user: PoleBearer | null | undefined): PoleSlug | null {
  return resolveUserPoles(user)[0] ?? null
}

/** Un libellé lisible, ou la valeur brute si elle n'est pas un pôle officiel. */
export function poleLabel(value: string | null | undefined): string {
  const slug = toPoleSlug(value)
  if (slug) return POLE_LABELS[slug]
  const raw = (value || '').trim()
  return raw || 'Pôle non renseigné'
}

/** Tous les libellés des pôles d'un porteur (badges multiples). */
export function poleLabelsOf(user: PoleBearer | null | undefined): string[] {
  return resolveUserPoles(user).map(slug => POLE_LABELS[slug])
}

/** Un texte unique (« Anime · Gaming ») pour les endroits sans place. */
export function polesToText(user: PoleBearer | null | undefined, fallback = 'Aucun pôle'): string {
  const labels = poleLabelsOf(user)
  return labels.length ? labels.join(' · ') : fallback
}

/** Ce porteur appartient-il au pôle demandé (slug ou libellé) ? */
export function userHasPole(user: PoleBearer | null | undefined, slug: string | null | undefined): boolean {
  const target = toPoleSlug(slug)
  if (!target) return false
  return resolveUserPoles(user).includes(target)
}

/**
 * Ce texte de pôle correspond-il au slug demandé ?
 *
 * Utilisé à la fois par le filtre « pôles » de la communauté et par le
 * composeur d'annonces : un seul endroit décide ce qui est visible.
 *   - slug « all » → le filtre « tous les pôles » accepte tout ;
 *   - texte « all » → une annonce diffusée tous pôles est visible partout ;
 *   - accepte le slug (« k-drama ») comme le libellé (« K-Drama ») ;
 *   - accepte les valeurs composées (« Culture générale », « Anime / Manga »).
 */
export function rawPoleMatches(rawPole: string | null | undefined, slug: string): boolean {
  if (normalizePole(slug) === ALL_POLES) return true

  const normalized = normalizePole(rawPole)
  if (!normalized) return false
  if (normalized === ALL_POLES) return true

  const target = toPoleSlug(slug)
  if (!target) return false
  if (normalized === target) return true

  const label = normalizePole(POLE_LABELS[target])
  if (normalized === label) return true
  // Le libellé connu doit ouvrir la valeur sans absorber les mots voisins.
  return label.length >= 5 && normalized.startsWith(label)
}
