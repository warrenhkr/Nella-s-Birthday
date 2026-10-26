/**
 * Étude de cas : Atelier Cannelle, une pâtisserie en ligne (entreprise et chiffres inventés).
 * Tous les chiffres affichés par la page sont CALCULÉS ici à partir des données brutes : rien n'est écrit « en dur ».
 */
export const MONTHS = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.']

export interface Channel {
  key: 'site' | 'boutique' | 'marche'
  label: string
  /** Chiffre d'affaires mensuel en euros */
  values: number[]
}

export const CHANNELS: Channel[] = [
  { key: 'site', label: 'Site web', values: [8200, 8600, 9100, 9800, 10400, 10900, 11800, 11200, 12600, 13800, 18900, 23400] },
  { key: 'boutique', label: 'Boutique', values: [7600, 7400, 7900, 8200, 8700, 8500, 8100, 7800, 8300, 8600, 9400, 11200] },
  { key: 'marche', label: 'Marché', values: [3100, 3000, 3600, 4300, 5200, 5600, 5900, 5700, 4400, 3800, 3200, 4600] },
]

export interface Product {
  name: string
  /** Part du chiffre d'affaires */
  share: number
  /** Marge brute en part du prix de vente */
  margin: number
}

export const PRODUCTS: Product[] = [
  { name: 'Box cadeaux', share: 0.38, margin: 0.52 },
  { name: 'Macarons', share: 0.24, margin: 0.61 },
  { name: 'Tartes', share: 0.18, margin: 0.38 },
  { name: 'Cannelés', share: 0.12, margin: 0.66 },
  { name: 'Éclairs', share: 0.08, margin: 0.3 },
]

/** Entonnoir du site sur le dernier trimestre */
export const FUNNEL = [
  { label: 'Visiteurs', value: 64000 },
  { label: 'Fiches produit vues', value: 31000 },
  { label: 'Ajouts au panier', value: 9300 },
  { label: 'Paiements commencés', value: 5300 },
  { label: 'Commandes validées', value: 4700 },
]

export const COMPLAINTS = [
  { cause: 'Retard de livraison', count: 212 },
  { cause: 'Produit abîmé', count: 148 },
  { cause: 'Erreur de commande', count: 64 },
  { cause: 'Prix affiché faux', count: 31 },
  { cause: 'Service client lent', count: 22 },
  { cause: 'Autre', count: 13 },
]

const sum = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0)

export const monthlyTotals = (): number[] => MONTHS.map((_, m) => sum(CHANNELS.map((c) => c.values[m]!)))
export const channelTotals = () => CHANNELS.map((c) => ({ key: c.key, label: c.label, total: sum(c.values) }))
export const totalRevenue = () => sum(monthlyTotals())
export const growthPct = (values: readonly number[]) => (100 * (values[values.length - 1]! - values[0]!)) / values[0]!

export function productStats() {
  const total = totalRevenue()
  const rows = PRODUCTS.map((p) => ({ name: p.name, revenue: total * p.share, margin: p.margin, grossProfit: total * p.share * p.margin }))
  const profit = sum(rows.map((r) => r.grossProfit))
  return rows.map((r) => ({ ...r, profitShare: (100 * r.grossProfit) / profit }))
}

export function funnelRates() {
  return FUNNEL.slice(0, -1).map((s, i) => ({ from: s.label, to: FUNNEL[i + 1]!.label, rate: (100 * FUNNEL[i + 1]!.value) / s.value }))
}

/** Commandes obtenues si l'on remplace le taux d'une étape de passage (indice 0 à 3) par `newRate` (en %). */
export function ordersWithStepRate(step: number, newRate: number): number {
  let n = FUNNEL[0]!.value
  const rates = funnelRates().map((r) => r.rate)
  rates.forEach((r, i) => {
    n *= (i === step ? newRate : r) / 100
  })
  return n
}

export function ordersWithTrafficBoost(pct: number): number {
  return FUNNEL[FUNNEL.length - 1]!.value * (1 + pct / 100)
}

export function complaintCumulative() {
  const total = sum(COMPLAINTS.map((c) => c.count))
  let acc = 0
  return COMPLAINTS.map((c) => ((acc += c.count), { ...c, cumulativePct: (100 * acc) / total }))
}

export interface Decision {
  id: string
  title: string
  question: string
  options: { key: string; label: string }[]
  answer: string
  explain: () => string
}

const f1 = (v: number) => v.toFixed(1).replace('.', ',')
const nb = (v: number) => Math.round(v).toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ')

export const DECISIONS: Decision[] = [
  {
    id: 'funnel',
    title: 'Où agir sur le site ?',
    question: 'Le budget permet d’améliorer UNE seule chose sur le site. Laquelle apporte le plus de commandes ?',
    options: [
      { key: 'trafic', label: 'Acheter de la publicité pour avoir 10 % de visiteurs en plus' },
      { key: 'panier', label: 'Faire passer le taux « fiche produit → panier » de 30 % à 40 %' },
      { key: 'paiement', label: 'Faire passer le taux de paiement réussi de 88,7 % à 95 %' },
      { key: 'rien', label: 'Ne rien changer : les résultats sont déjà bons' },
    ],
    answer: 'panier',
    explain() {
      const base = FUNNEL[FUNNEL.length - 1]!.value
      const t = ordersWithTrafficBoost(10) - base
      const c = ordersWithStepRate(1, 40) - base
      const p = ordersWithStepRate(3, 95) - base
      return `Plus de visiteurs : +${nb(t)} commandes. Meilleur passage vers le panier : +${nb(c)}. Meilleur paiement : +${nb(p)}. L’étape « fiche produit → panier » est la plus faible (${f1(funnelRates()[1]!.rate)} %) : c’est là que la marge de progression est la plus grande.`
    },
  },
  {
    id: 'produit',
    title: 'Quel produit mettre en avant ?',
    question: 'Pour augmenter le profit brut, quel produit faut-il pousser en priorité ?',
    options: PRODUCTS.map((p) => ({ key: p.name, label: p.name })),
    answer: 'Box cadeaux',
    explain() {
      const s = productStats()
      const best = s.slice().sort((a, b) => b.grossProfit - a.grossProfit)[0]!
      const bestMargin = s.slice().sort((a, b) => b.margin - a.margin)[0]!
      return `${best.name} rapporte le plus de profit brut (${nb(best.grossProfit)} €, ${f1(best.profitShare)} % du total). Attention au piège : ${bestMargin.name} a la meilleure marge en pourcentage (${Math.round(bestMargin.margin * 100)} %), mais il se vend trop peu pour peser autant. Une bonne marge en pourcentage ne suffit pas : il faut aussi du volume.`
    },
  },
  {
    id: 'reclamations',
    title: 'Quelles réclamations traiter ?',
    question: 'Les réclamations sont nombreuses. Quelle est la meilleure stratégie ?',
    options: [
      { key: 'une', label: 'Traiter uniquement le retard de livraison' },
      { key: 'trois', label: 'Traiter les trois premières causes : retard, produit abîmé, erreur de commande' },
      { key: 'toutes', label: 'Traiter les six causes en même temps' },
      { key: 'petites', label: 'Traiter d’abord les prix affichés faux et le service client lent' },
    ],
    answer: 'trois',
    explain() {
      const c = complaintCumulative()
      return `Le retard seul explique ${f1(c[0]!.cumulativePct)} % des réclamations, avec le produit abîmé ${f1(c[1]!.cumulativePct)} %, et avec l’erreur de commande ${f1(c[2]!.cumulativePct)} %. Trois causes sur six dépassent le seuil des 80 % : c’est le principe de Pareto. Les deux dernières causes citées ne pèsent que ${f1(100 - c[2]!.cumulativePct)} % du total.`
    },
  },
]
