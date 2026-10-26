/** Affichages communs : durées, euros, pourcentages (format français). */
export function formatTime(ms: number): string {
  if (ms < 60000) return (ms / 1000).toFixed(1).replace('.', ',') + ' s'
  const total = Math.round(ms / 1000)
  return Math.floor(total / 60) + ' min ' + String(total % 60).padStart(2, '0') + ' s'
}

export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ')
}

export function formatEuro(value: number): string {
  return formatNumber(value) + ' €'
}

export function formatPercent(value: number, digits = 1): string {
  return value.toFixed(digits).replace('.', ',') + ' %'
}
