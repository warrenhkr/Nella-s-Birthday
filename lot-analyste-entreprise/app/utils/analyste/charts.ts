/** Aides communes aux graphiques SVG. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!(max > min)) max = min + 1
  const raw = (max - min) / Math.max(1, count)
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag
  const out: number[] = []
  let v = Math.floor(min / step + 1e-9) * step
  for (let guard = 0; guard < 100; guard++) {
    out.push(Math.round(v * 1e9) / 1e9)
    if (v >= max - step * 0.001) break
    v += step
  }
  return out
}

/** Transforme une valeur d'un intervalle de données en position dans un intervalle de pixels. */
export function scale(v: number, d0: number, d1: number, p0: number, p1: number): number {
  return d1 === d0 ? p0 : p0 + ((v - d0) / (d1 - d0)) * (p1 - p0)
}

export function compact(v: number): string {
  const a = Math.abs(v)
  if (a >= 1e6) return (v / 1e6).toFixed(1).replace('.0', '').replace('.', ',') + ' M'
  if (a >= 1e4) return Math.round(v / 1e3) + ' k'
  if (a >= 1e3) return (v / 1e3).toFixed(1).replace('.0', '').replace('.', ',') + ' k'
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',')
}
