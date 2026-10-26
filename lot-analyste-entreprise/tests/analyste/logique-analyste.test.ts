import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mulberry32 } from '../../app/utils/analyste/rng.ts'
import { breakEvenUnits, makeRounds, profit } from '../../app/utils/analyste/breakeven.ts'
import { cumulativePct, makeCauses, vitalFewCount } from '../../app/utils/analyste/pareto.ts'
import { QUADRANTS, SCENARIOS as SWOT, drawScenario } from '../../app/utils/analyste/swot.ts'
import { KPI_QUESTIONS, drawKpi } from '../../app/utils/analyste/kpi.ts'
import { ANOMALY_LABEL, cellKey, judge, makeTable } from '../../app/utils/analyste/datacleaning.ts'
import { LINK_LABEL, SCENARIOS as CORR, drawScenarios } from '../../app/utils/analyste/correlation.ts'
import { knapsack, makeBacklog, type Feature } from '../../app/utils/analyste/sprint.ts'
import { STEPS, makeFunnel, makeQuestions, rate, worstTransition } from '../../app/utils/analyste/funnel.ts'
import { errorPct, linearForecast, makeSeries, pointsFor } from '../../app/utils/analyste/forecast.ts'
import { SQL_QUESTIONS, drawSql, isCorrect } from '../../app/utils/analyste/sqlblocs.ts'
import { ROOT_SCENARIOS, drawRoot } from '../../app/utils/analyste/rootcause.ts'
import { RISKS, drawRisks, level, scorePlacement } from '../../app/utils/analyste/riskmatrix.ts'
import { CHANNELS, COMPLAINTS, DECISIONS, FUNNEL, MONTHS, PRODUCTS, channelTotals, complaintCumulative, funnelRates, growthPct, monthlyTotals, ordersWithStepRate, ordersWithTrafficBoost, productStats, totalRevenue } from '../../app/utils/analyste/cas.ts'
import { CATEGORY_LABEL, TERMS } from '../../app/utils/analyste/glossaire.ts'
import { formatEuro, formatPercent, formatTime } from '../../app/utils/analyste/format.ts'

test('seuil de rentabilité : plus petit entier rentable, manches cohérentes', () => {
  for (let seed = 1; seed <= 40; seed++) {
    for (const r of makeRounds(5, mulberry32(seed))) {
      assert.ok(r.price > r.unitCost && r.fixed >= 100)
      const q = breakEvenUnits(r)
      assert.ok(profit(q, r) >= 0, 'rentable au seuil')
      assert.ok(q === 0 || profit(q - 1, r) < 0, 'pas rentable juste avant')
      assert.ok(q >= 1 && q <= 1000, 'seuil raisonnable : ' + q)
    }
  }
  assert.equal(breakEvenUnits({ name: 'x', fixed: 12000, price: 40, unitCost: 22 }), 667)
  assert.equal(new Set(makeRounds(5, mulberry32(3)).map((r) => r.name)).size, 5)
})

test('Pareto : causes triées, seuil minimal, cumul', () => {
  assert.equal(vitalFewCount([50, 30, 10, 5, 5], 80), 2)
  assert.equal(vitalFewCount([50, 30, 10, 5, 5], 81), 3)
  assert.equal(vitalFewCount([100], 80), 1)
  for (let seed = 1; seed <= 30; seed++) {
    const c = makeCauses(7, 1.5, mulberry32(seed))
    assert.equal(c.length, 7)
    assert.ok(c.every((x, i) => i === 0 || x.count < c[i - 1]!.count), 'strictement décroissant')
    const cum = cumulativePct(c)
    assert.ok(Math.abs(cum[cum.length - 1]! - 100) < 1e-9)
    const k = vitalFewCount(c.map((x) => x.count), 80)
    assert.ok(cum[k - 1]! >= 80 && (k === 1 || cum[k - 2]! < 80))
    assert.equal(new Set(c.map((x) => x.name)).size, 7)
  }
})

test('SWOT : 3 phrases par case et par scénario, tirage complet', () => {
  assert.equal(QUADRANTS.length, 4)
  for (const s of SWOT) {
    for (const q of QUADRANTS) assert.equal(s.items.filter((i) => i.quad === q.key).length, 3, s.title + ' ' + q.key)
    assert.equal(new Set(s.items.map((i) => i.text)).size, 12)
  }
  const d = drawScenario(mulberry32(1), 0)
  assert.notEqual(d.index, 0)
  assert.equal(d.cards.length, 12)
})

test('KPI : une bonne réponse parmi quatre propositions distinctes', () => {
  assert.equal(KPI_QUESTIONS.length, 10)
  for (const q of drawKpi(10, mulberry32(2))) {
    assert.equal(q.options.length, 4)
    assert.equal(new Set(q.options).size, 4)
    assert.ok(q.options.includes(q.answer))
    assert.ok(q.why.length > 30)
  }
  assert.equal(new Set(KPI_QUESTIONS.map((q) => q.situation)).size, 10)
})

test('nettoyage de données : le nombre d’anomalies demandé, et le jugement', () => {
  for (let seed = 1; seed <= 60; seed++) {
    for (const count of [3, 4, 5]) {
      const t = makeTable(count, mulberry32(seed))
      assert.equal(t.anomalies.length, count)
      assert.equal(t.rows.length, 8)
      assert.ok(t.rows.every((r) => r.length === 5))
      const rowsUsed = t.anomalies.flatMap((a) => a.cells.map(([r]) => r))
      // une anomalie par ligne (les doublons occupent deux lignes)
      assert.equal(new Set(rowsUsed).size, rowsUsed.length, 'lignes distinctes')
      for (const a of t.anomalies) {
        for (const [r, c] of a.cells) assert.ok(r >= 0 && r < 8 && c >= 0 && c < 5)
        if (a.type === 'doublon') assert.equal(t.rows[a.cells[0]![0]]![0], t.rows[a.cells[1]![0]]![0])
        if (a.type === 'manquant') assert.equal(t.rows[a.cells[0]![0]]![a.cells[0]![1]], '')
      }
      // sans anomalie, aucun doublon d'identifiant parmi les lignes non touchées
      const ids = t.rows.map((r) => r[0])
      const dupes = ids.length - new Set(ids).size
      assert.equal(dupes, t.anomalies.filter((a) => a.type === 'doublon').length)
    }
  }
  const t = makeTable(4, mulberry32(7))
  const all = new Set(t.anomalies.map((a) => cellKey(...a.cells[0]!)))
  let v = judge(t, all)
  assert.equal(v.found.length, 4)
  assert.equal(v.missed.length, 0)
  assert.equal(v.falseFlags.length, 0)
  v = judge(t, new Set([cellKey(7, 0)].filter((k) => !all.has(k))))
  assert.ok(v.missed.length >= 3)
  assert.equal(Object.keys(ANOMALY_LABEL).length, 5)
})

test('corrélation ou causalité : réponses valides, mix', () => {
  assert.ok(CORR.length >= 8)
  for (const k of ['cause', 'cache', 'hasard'] as const) {
    assert.ok(CORR.some((s) => s.answer === k), k)
    assert.ok(LINK_LABEL[k])
  }
  assert.equal(drawScenarios(8, mulberry32(1)).length, 8)
  assert.equal(new Set(CORR.map((s) => s.text)).size, CORR.length)
})

test('sprint : le sac à dos programmé retrouve l’optimum de la force brute', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const b = makeBacklog(8, mulberry32(seed))
    let best = 0
    for (let mask = 0; mask < 1 << b.features.length; mask++) {
      let cost = 0
      let value = 0
      b.features.forEach((f: Feature, i) => {
        if ((mask >> i) & 1) {
          cost += f.cost
          value += f.value
        }
      })
      if (cost <= b.capacity) best = Math.max(best, value)
    }
    assert.equal(b.optimum, best)
    const k = knapsack(b.features, b.capacity)
    assert.equal(k.chosen.reduce((s, id) => s + b.features[id]!.value, 0), k.value)
    assert.ok(k.chosen.reduce((s, id) => s + b.features[id]!.cost, 0) <= b.capacity)
  }
})

test('entonnoir : questions à bonne réponse unique et calculs justes', () => {
  assert.equal(STEPS.length, 5)
  for (let seed = 1; seed <= 80; seed++) {
    const counts = makeFunnel(mulberry32(seed))
    assert.ok(counts.every((c, i) => i === 0 || c < counts[i - 1]!))
    const w = worstTransition(counts)
    for (let i = 0; i < 4; i++) assert.ok(rate(counts, w) <= rate(counts, i))
    const qs = makeQuestions(counts, mulberry32(seed + 1000))
    assert.equal(qs.length, 6)
    for (const q of qs) {
      assert.equal(q.options.length, 4)
      assert.equal(new Set(q.options).size, 4, q.prompt + ' ' + q.options.join('|'))
      assert.equal(q.options.filter((o) => o === q.answer).length, 1)
    }
  }
})

test('prévision : droite exacte, erreurs et points', () => {
  assert.ok(Math.abs(linearForecast([10, 12, 14, 16, 18], 5) - 20) < 1e-9)
  assert.equal(errorPct(110, 100), 10)
  assert.equal(pointsFor(2), 10)
  assert.equal(pointsFor(8), 6)
  assert.equal(pointsFor(40), 0)
  for (let seed = 1; seed <= 40; seed++) {
    const s = makeSeries(mulberry32(seed))
    assert.equal(s.values.length, 11)
    assert.ok(s.truth > 0 && s.values.every((v) => v > 0))
    assert.ok(errorPct(linearForecast(s.values, 11), s.truth) < 30, 'la tendance est une bonne piste')
  }
})

test('SQL en blocs : chaque question a sa réponse, ordre unique, distracteurs absents de la réponse', () => {
  assert.ok(SQL_QUESTIONS.length >= 8)
  for (const q of SQL_QUESTIONS) {
    assert.equal(new Set(q.blocks).size, q.blocks.length)
    assert.ok(q.distractors.every((d) => !q.blocks.includes(d)))
    assert.ok(q.blocks[0]!.startsWith('SELECT'))
  }
  for (const d of drawSql(6, mulberry32(1))) {
    assert.deepEqual([...d.pool].sort(), [...d.answer, ...SQL_QUESTIONS.find((q) => q.prompt === d.prompt)!.distractors].sort())
    assert.ok(isCorrect(d.answer, d.answer))
    assert.ok(!isCorrect([...d.answer].reverse(), d.answer) || d.answer.length === 1)
  }
})

test('cinq pourquoi : 4 niveaux et 3 propositions distinctes', () => {
  for (const s of ROOT_SCENARIOS) {
    assert.equal(s.levels.length, 4)
    for (const l of s.levels) assert.equal(new Set([l.ok, ...l.bad]).size, 3)
  }
  for (const d of drawRoot(mulberry32(1))) for (const o of d.options) assert.equal(o.length, 3)
})

test('matrice des risques : notation et niveaux', () => {
  assert.equal(scorePlacement({ p: 2, i: 3 }, { p: 2, i: 3 }), 2)
  assert.equal(scorePlacement({ p: 2, i: 3 }, { p: 3, i: 3 }), 1)
  assert.equal(scorePlacement({ p: 2, i: 3 }, { p: 3, i: 2 }), 0)
  assert.equal(level(1, 1), 'faible')
  assert.equal(level(3, 3), 'eleve')
  assert.equal(level(2, 2), 'moyen')
  assert.equal(new Set(RISKS.map((r) => r.id)).size, RISKS.length)
  assert.equal(drawRisks(8, mulberry32(1)).length, 8)
})

test('étude de cas : les chiffres annoncés sont bien ceux que donnent les données', () => {
  assert.equal(MONTHS.length, 12)
  assert.ok(CHANNELS.every((c) => c.values.length === 12))
  assert.equal(monthlyTotals().length, 12)
  assert.equal(monthlyTotals().reduce((s, x) => s + x, 0), totalRevenue())
  assert.equal(channelTotals().reduce((s, c) => s + c.total, 0), totalRevenue())
  assert.ok(Math.abs(PRODUCTS.reduce((s, p) => s + p.share, 0) - 1) < 1e-9)
  const site = CHANNELS[0]!.values
  assert.ok(growthPct(site) > 150, 'le site a plus que doublé')
  assert.ok(Math.abs(growthPct(CHANNELS[1]!.values)) < 60, 'la boutique est stable')
  const peak = CHANNELS[2]!.values.indexOf(Math.max(...CHANNELS[2]!.values))
  assert.ok(peak >= 4 && peak <= 6, 'le marché culmine en été')
  const stats = productStats()
  assert.equal(stats.slice().sort((a, b) => b.grossProfit - a.grossProfit)[0]!.name, 'Box cadeaux')
  assert.equal(stats.slice().sort((a, b) => b.margin - a.margin)[0]!.name, 'Cannelés')
  assert.ok(Math.abs(stats.reduce((s, r) => s + r.profitShare, 0) - 100) < 1e-9)
  const rates = funnelRates()
  assert.equal(rates.indexOf(rates.slice().sort((a, b) => a.rate - b.rate)[0]!), 1, 'étape la plus faible : fiche produit → panier')
  const base = FUNNEL[4]!.value
  const gains = { trafic: ordersWithTrafficBoost(10) - base, panier: ordersWithStepRate(1, 40) - base, paiement: ordersWithStepRate(3, 95) - base }
  assert.ok(gains.panier > gains.trafic && gains.panier > gains.paiement, JSON.stringify(gains))
  assert.ok(Math.abs(ordersWithStepRate(1, rates[1]!.rate) - base) < 1e-6, 'sans changement, on retrouve les commandes actuelles')
  const c = complaintCumulative()
  assert.ok(c[1]!.cumulativePct < 80 && c[2]!.cumulativePct >= 80, 'trois causes pour dépasser 80 %')
  assert.equal(COMPLAINTS.length, 6)
  for (const d of DECISIONS) {
    assert.ok(d.options.some((o) => o.key === d.answer), d.id)
    assert.ok(d.explain().length > 80)
  }
  assert.ok(!DECISIONS.map((d) => d.explain()).join(' ').includes('NaN'))
})

test('glossaire : termes uniques, catégories valides, contenu rempli', () => {
  assert.ok(TERMS.length >= 45)
  assert.equal(new Set(TERMS.map((t) => t.term)).size, TERMS.length)
  for (const t of TERMS) {
    assert.ok(t.category in CATEGORY_LABEL, t.term)
    assert.ok(t.definition.length > 25 && t.example.length > 15, t.term)
  }
  for (const k of Object.keys(CATEGORY_LABEL)) assert.ok(TERMS.some((t) => t.category === k), k)
})

test('format : euros, pourcentages, durées', () => {
  assert.equal(formatEuro(12500), '12 500 €')
  assert.equal(formatPercent(7.34), '7,3 %')
  assert.equal(formatTime(7400), '7,4 s')
  assert.equal(formatTime(65000), '1 min 05 s')
})

import { compact, niceTicks, scale } from '../../app/utils/analyste/charts.ts'
test('graphiques : graduations rondes qui encadrent les données, échelle, abréviations', () => {
  for (const [lo, hi] of [[0, 97], [3, 8], [0, 1], [-50, 120], [1000, 23400]] as const) {
    const t = niceTicks(lo, hi, 5)
    assert.ok(t[0]! <= lo + 1e-9 && t[t.length - 1]! >= hi - 1e-9, lo + '-' + hi + ' : ' + t.join(','))
    assert.ok(t.length >= 2 && t.length <= 12)
    assert.ok(t.every((v, i) => i === 0 || v > t[i - 1]!))
  }
  assert.equal(scale(5, 0, 10, 0, 100), 50)
  assert.equal(scale(7, 7, 7, 3, 9), 3)
  assert.equal(compact(23400), '23 k')
  assert.equal(compact(1500), '1,5 k')
  assert.equal(compact(2500000), '2,5 M')
  assert.equal(compact(12), '12')
})
