/** Affichage d'une durée en millisecondes : 7.4 s ou 1:05 */
export function formatTime(ms: number): string {
  if (ms < 60000) return (ms / 1000).toFixed(1) + ' s'
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return m + ':' + String(s).padStart(2, '0')
}

export function plural(n: number, one: string, many: string): string {
  return n > 1 ? many : one
}
