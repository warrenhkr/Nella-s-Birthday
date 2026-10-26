import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mulberry32, shuffle } from '../../app/utils/games/rng.ts'
import { buildDeck } from '../../app/utils/games/memory.ts'
import { dropLayer, oscillate } from '../../app/utils/games/stack.ts'
import { press, scramble, solve } from '../../app/utils/games/lightsout.ts'
import { placeBalloons } from '../../app/utils/games/balloons.ts'
import { isSolvable, isSolved, scrambleTiles, slide, solvedTiles } from '../../app/utils/games/slidepuzzle.ts'

test('rng : même graine, même suite ; shuffle garde les éléments', () => {
  assert.deepEqual([mulberry32(5)(), mulberry32(5)()], [mulberry32(5)(), mulberry32(5)()])
  const a = shuffle([1, 2, 3, 4, 5, 6], mulberry32(1))
  assert.deepEqual([...a].sort(), [1, 2, 3, 4, 5, 6])
})

test('memory : chaque carte apparaît deux fois', () => {
  for (const pairs of [6, 8, 10]) {
    const deck = buildDeck(pairs, mulberry32(pairs))
    assert.equal(deck.length, pairs * 2)
    for (let i = 0; i < pairs; i++) assert.equal(deck.filter((v) => v === i).length, 2)
  }
})

test('gâteau : recouvrement, coupe, parfait, raté', () => {
  assert.equal(dropLayer({ x: 0, w: 100 }, { x: 200, w: 100 }), null)
  const r = dropLayer({ x: 50, w: 100 }, { x: 70, w: 100 })!
  assert.deepEqual(r.layer, { x: 70, w: 80 })
  assert.deepEqual(r.cut, { x: 150, w: 20 })
  const l = dropLayer({ x: 50, w: 100 }, { x: 20, w: 100 })!
  assert.deepEqual(l.layer, { x: 50, w: 70 })
  assert.deepEqual(l.cut, { x: 20, w: 30 })
  const p = dropLayer({ x: 50, w: 100 }, { x: 52, w: 100 })!
  assert.equal(p.perfect, true)
  assert.deepEqual(p.layer, { x: 50, w: 100 })
  for (let t = 0; t < 20000; t += 137) {
    const x = oscillate(t, 120, 60, 300)
    assert.ok(x >= 0 && x <= 240)
  }
})

test('lights out : appui sur un coin et au centre, solveur', () => {
  const all = new Array(9).fill(true)
  assert.equal(press(all, 3, 0).filter((v) => !v).length, 3)
  assert.equal(press(all, 3, 4).filter((v) => !v).length, 5)
  for (const n of [3, 4, 5]) {
    for (let seed = 1; seed <= 30; seed++) {
      const g = scramble(n, 12, mulberry32(seed))
      assert.ok(!g.every(Boolean))
      const s = solve(g, n)
      assert.ok(s, 'résoluble ' + n + ' ' + seed)
      let cur = g
      for (const i of s!) cur = press(cur, n, i)
      assert.ok(cur.every(Boolean), 'la solution allume tout')
    }
  }
})

test('ballons : bon nombre, numéros 1..n, pas de chevauchement', () => {
  for (const n of [8, 12, 16]) {
    const b = placeBalloons(n, mulberry32(n))
    assert.deepEqual(b.map((x) => x.n).sort((p, q) => p - q), Array.from({ length: n }, (_, i) => i + 1))
    for (const x of b) assert.ok(x.x >= 5 && x.x <= 95 && x.y >= 5 && x.y <= 95)
    for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
      assert.ok(Math.hypot(b[i]!.x - b[j]!.x, b[i]!.y - b[j]!.y) > 5)
    }
  }
})

test('taquin : mélange résoluble, coups, glissement multiple', () => {
  for (const n of [3, 4]) {
    for (let seed = 1; seed < 25; seed++) {
      const t = scrambleTiles(n, 60, mulberry32(seed))
      assert.ok(!isSolved(t))
      assert.ok(isSolvable(t, n))
    }
  }
  const s = solvedTiles(3)
  assert.ok(isSolved(s))
  assert.equal(slide(s, 3, 0), null, 'case hors ligne et colonne du vide')
  const m = slide(s, 3, 5)!
  assert.equal(m.moved, 1)
  assert.deepEqual(m.tiles, [1, 2, 3, 4, 5, 0, 7, 8, 6].map((v, i) => (i === 5 ? 0 : i === 8 ? 6 : v)))
  const row = slide(s, 3, 6)!
  assert.equal(row.moved, 2)
  assert.deepEqual(row.tiles, [1, 2, 3, 4, 5, 6, 0, 7, 8])
  const m2 = slide(solvedTiles(4), 4, 12)!
  assert.equal(m2.moved, 3)
  assert.deepEqual(m2.tiles.slice(12), [0, 13, 14, 15])
})
