/**
 * Meilleurs scores, gardés dans le navigateur (localStorage).
 * Sans danger côté serveur ou si le stockage est bloqué : on renvoie simplement null / false.
 */
const PREFIX = 'mini-jeux:best:'

export function readBest(key: string): number | null {
  try {
    if (typeof window === 'undefined') return null
    const raw = window.localStorage.getItem(PREFIX + key)
    if (raw === null) return null
    const value = Number(raw)
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

/** Enregistre `value` si c'est un record. `better` dit si plus petit ('min') ou plus grand ('max') est mieux. */
export function submitBest(key: string, value: number, better: 'min' | 'max'): boolean {
  const previous = readBest(key)
  const isRecord = previous === null || (better === 'min' ? value < previous : value > previous)
  if (!isRecord) return false
  try {
    window.localStorage.setItem(PREFIX + key, String(value))
  } catch {
    return false
  }
  return true
}
