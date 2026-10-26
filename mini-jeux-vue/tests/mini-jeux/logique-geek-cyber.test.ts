import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mulberry32 } from '../../app/utils/games/rng.ts'
import { countSolutions, conflicts, generateSolved, isComplete, makePuzzle } from '../../app/utils/games/sudoku4.ts'
import { generate, isWon, pour, canPour, solve as solveBalls, CAPACITY } from '../../app/utils/games/ballsort.ts'
import { canTurn, newSnake, placeFood, step } from '../../app/utils/games/snake.ts'
import { makeSecret, score } from '../../app/utils/games/mastermind.ts'
import { LEVELS, decide, makePackets } from '../../app/utils/games/firewall.ts'
import { CHALLENGES, binaryToText, caesar, checkFlag, fromBase64, textToBinary, toBase64 } from '../../app/utils/games/ctf.ts'
import { GATE_LEVELS, bruteForce, evaluate } from '../../app/utils/games/gates.ts'
import { accuracy, choices, parseHex, randomColor, toHex } from '../../app/utils/games/colorhex.ts'
import { FACTS, drawFacts } from '../../app/utils/games/truefalse.ts'
import { SNIPPETS, drawSnippets } from '../../app/utils/games/bugs.ts'
import { MESSAGES, drawMessages } from '../../app/utils/games/phishing.ts'
import { RULES, digitSum, unlockedCount } from '../../app/utils/games/passwordrules.ts'
import { generateWordSearch, lineCells, matchSelection, placementCells } from '../../app/utils/games/wordsearch.ts'

test('sudoku 4x4 : grille valide, solution unique, conflits', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const rng = mulberry32(seed)
    const solved = generateSolved(rng)
    assert.ok(isComplete(solved))
    for (const holes of [6, 8, 9]) {
      const { puzzle, solution } = makePuzzle(mulberry32(seed + 100), holes)
      assert.equal(countSolutions(puzzle), 1, 'solution unique')
      assert.ok(isComplete(solution))
      assert.ok(puzzle.filter((v) => v === 0).length >= holes - 2)
      puzzle.forEach((v, i) => { if (v !== 0) assert.equal(v, solution[i]) })
    }
  }
  const b = new Array(16).fill(0)
  b[0] = 1; b[1] = 1
  assert.deepEqual([...conflicts(b)].sort(), [0, 1])
})

test('tri des couleurs : règles de versement, grilles résolubles', () => {
  const t = [[1, 1], [1], [], [2, 2, 2, 2]]
  assert.ok(canPour(t, 0, 1))
  assert.ok(canPour(t, 1, 0))
  assert.deepEqual(pour(t, 0, 1), [[], [1, 1, 1], [], [2, 2, 2, 2]])
  assert.ok(!canPour(t, 3, 2), 'inutile de vider un tube déjà uni')
  assert.ok(!canPour([[1, 2], [3]], 0, 1), 'couleur différente en dessus')
  assert.ok(isWon([[1, 1, 1, 1], [], [2, 2, 2, 2]]))
  for (const colors of [4, 5, 6]) {
    for (let seed = 1; seed <= 6; seed++) {
      const t0 = Date.now()
      const { tubes, solution } = generate(colors, mulberry32(seed))
      assert.ok(Date.now() - t0 < 4000, 'génération rapide')
      assert.equal(tubes.length, colors + 2)
      for (let c = 0; c < colors; c++) assert.equal(tubes.flat().filter((x) => x === c).length, CAPACITY)
      let cur = tubes
      for (const [a, b] of solution) cur = pour(cur, a, b)!
      assert.ok(isWon(cur), 'la solution fournie gagne')
    }
  }
  assert.ok(solveBalls([[0, 0, 0, 0]]) !== null)
})

test('serpent : déplacement, croissance, murs, corps, demi-tour interdit', () => {
  const rng = mulberry32(3)
  let s = newSnake(10, rng)
  assert.equal(s.snake.length, 3)
  const head = s.snake[0]!
  s = step(s, 'right', rng)
  assert.deepEqual(s.snake[0], { x: head.x + 1, y: head.y })
  assert.equal(s.snake.length, 3)
  assert.ok(!canTurn('right', 'left'))
  const before = s.snake[0]!
  s = step(s, 'left', rng)
  assert.deepEqual(s.snake[0], { x: before.x + 1, y: before.y }, 'demi-tour ignoré')
  const eat = { ...s, food: { x: s.snake[0]!.x + 1, y: s.snake[0]!.y } }
  const grown = step(eat, 'right', rng)
  assert.equal(grown.snake.length, 4)
  assert.equal(grown.score, 1)
  let w = newSnake(5, rng)
  for (let i = 0; i < 10 && !w.dead; i++) w = step(w, 'right', rng)
  assert.ok(w.dead, 'le mur tue')
  const f = placeFood(5, [{ x: 0, y: 0 }], rng)
  assert.ok(!(f.x === 0 && f.y === 0))
  // le corps tue
  const loop = { size: 10, dir: 'up' as const, food: { x: 9, y: 9 }, score: 0, dead: false,
    snake: [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 5 }, { x: 4, y: 4 }, { x: 5, y: 4 }] }
  assert.ok(step(loop, 'up', rng).dead || step({ ...loop, dir: 'left' }, 'left', rng).dead)
})

test('casse-coffre : évaluation classique avec doublons', () => {
  assert.deepEqual(score([1, 2, 3, 4], [1, 2, 3, 4]), { exact: 4, misplaced: 0 })
  assert.deepEqual(score([1, 2, 3, 4], [4, 3, 2, 1]), { exact: 0, misplaced: 4 })
  assert.deepEqual(score([1, 1, 2, 2], [1, 2, 1, 2]), { exact: 2, misplaced: 2 })
  assert.deepEqual(score([1, 1, 1, 2], [1, 2, 2, 2]), { exact: 2, misplaced: 0 })
  assert.deepEqual(score([0, 0, 1, 1], [1, 1, 0, 0]), { exact: 0, misplaced: 4 })
  assert.deepEqual(score([5, 5, 5, 5], [5, 0, 0, 0]), { exact: 1, misplaced: 0 })
  const s = makeSecret(5, 8, mulberry32(1))
  assert.equal(s.length, 5)
  assert.ok(s.every((x) => x >= 0 && x < 8))
})

test('pare-feu : première règle gagnante, niveaux équilibrés', () => {
  const l3 = LEVELS[2]!.rules
  assert.equal(decide(l3, { zone: 'inconnue', port: 80, service: '' }), 'block')
  assert.equal(decide(l3, { zone: 'bureau', port: 22, service: '' }), 'allow')
  assert.equal(decide(l3, { zone: 'maison', port: 22, service: '' }), 'block')
  assert.equal(decide(l3, { zone: 'maison', port: 443, service: '' }), 'allow')
  assert.equal(decide(l3, { zone: 'maison', port: 25, service: '' }), 'block')
  for (const level of LEVELS) {
    for (let seed = 1; seed <= 10; seed++) {
      const ps = makePackets(level, mulberry32(seed))
      assert.equal(ps.length, level.count)
      const allowed = ps.filter((p) => decide(level.rules, p) === 'allow').length
      assert.ok(allowed >= 2 && level.count - allowed >= 2, 'mélange de autorisés / bloqués')
    }
  }
})

test('mini CTF : les drapeaux sont retrouvables avec les outils', () => {
  assert.equal(fromBase64(CHALLENGES[0]!.material), CHALLENGES[0]!.flag)
  assert.equal(caesar(CHALLENGES[1]!.material, -5), CHALLENGES[1]!.flag)
  assert.equal(caesar(CHALLENGES[1]!.material, 21), CHALLENGES[1]!.flag)
  assert.equal(binaryToText(CHALLENGES[2]!.material), CHALLENGES[2]!.flag)
  assert.ok(CHALLENGES[3]!.material.includes(CHALLENGES[3]!.flag))
  const initials = CHALLENGES.slice(0, 4).map((c) => c.keyword[0]).join('')
  assert.equal(CHALLENGES[4]!.flag, 'FLAG{' + initials + '}')
  assert.ok(checkFlag(CHALLENGES[4]!, ' flag{ ' + initials.toLowerCase() + ' } '))
  assert.ok(!checkFlag(CHALLENGES[0]!, 'FLAG{autre}'))
  assert.equal(fromBase64(toBase64('Éé ça va ?')), 'Éé ça va ?')
  assert.equal(fromBase64('###'), null)
  assert.equal(binaryToText('0101'), null)
  assert.equal(binaryToText(textToBinary('Hé')), 'Hé')
  assert.equal(caesar('Zz Aa!', 1), 'Aa Bb!')
})

test('portes logiques : chaque niveau a une solution, test faux détecté', () => {
  for (const level of GATE_LEVELS) {
    const sol = bruteForce(level)
    assert.ok(sol, level.title)
    assert.ok(level.tests.every((t) => evaluate(level, sol!, t.inputs) === t.expected))
    assert.equal(evaluate(level, {}, level.tests[0]!.inputs), null)
  }
  const l1 = GATE_LEVELS[0]!
  assert.ok(!l1.tests.every((t) => evaluate(l1, { P1: 'AND' }, t.inputs) === t.expected))
  assert.equal(GATE_LEVELS.length, 6)
})

test('couleurs hexadécimales', () => {
  assert.equal(toHex([255, 0, 128]), '#FF0080')
  assert.deepEqual(parseHex('#ff0080'), [255, 0, 128])
  assert.equal(parseHex('zz'), null)
  assert.equal(accuracy([0, 0, 0], [0, 0, 0]), 100)
  assert.equal(accuracy([0, 0, 0], [255, 255, 255]), 0)
  for (let seed = 1; seed <= 30; seed++) {
    const rng = mulberry32(seed)
    const target = randomColor(rng)
    const { options, answer } = choices(target, rng)
    assert.equal(options.length, 4)
    assert.equal(new Set(options).size, 4)
    assert.ok(options.includes(answer))
    assert.equal(answer, toHex(target))
  }
})

test('contenus : vrai ou faux, bugs, phishing', () => {
  assert.ok(FACTS.filter((f) => f.answer).length >= 15 && FACTS.filter((f) => !f.answer).length >= 15)
  assert.equal(new Set(FACTS.map((f) => f.text)).size, FACTS.length)
  const d = drawFacts(10, mulberry32(4))
  assert.equal(d.length, 10)
  assert.equal(d.filter((f) => f.answer).length, 5)
  for (const s of SNIPPETS) {
    assert.ok(s.bugLine >= 0 && s.bugLine < s.lines.length, 'ligne fautive valide #' + s.id)
    assert.ok(s.lines[s.bugLine]!.trim().length > 0, 'la ligne fautive n’est pas vide #' + s.id)
  }
  assert.equal(new Set(SNIPPETS.map((s) => s.id)).size, SNIPPETS.length)
  assert.equal(drawSnippets(8, mulberry32(1)).length, 8)
  const m = drawMessages(10, mulberry32(2))
  assert.equal(m.length, 10)
  assert.equal(m.filter((x) => x.phishing).length, 5)
  assert.ok(MESSAGES.every((x) => x.clues.length >= 2))
  assert.equal(new Set(MESSAGES.map((x) => x.id)).size, MESSAGES.length)
})

test('mot de passe en or : un mot de passe satisfait toutes les règles, règles débloquées dans l’ordre', () => {
  const good = 'Gateau!mai2058!'
  assert.ok(RULES.every((r) => r.test(good)), RULES.filter((r) => !r.test(good)).map((r) => r.id).join(','))
  assert.equal(digitSum(good), 15)
  assert.equal(unlockedCount(good), RULES.length)
  assert.equal(unlockedCount(''), 0)
  assert.equal(unlockedCount('abcdefgh'), 1)
  assert.equal(unlockedCount('abcdefg1'), 2)
  assert.ok(!RULES[6]!.test('aab'))
})

test('mots mêlés : tous les mots sont dans la grille', () => {
  const words = ['GATEAU', 'BOUGIE', 'CADEAU', 'CODE', 'PIXEL', 'SERVEUR', 'FETE']
  for (const hard of [false, true]) {
    for (let seed = 1; seed <= 30; seed++) {
      const ws = generateWordSearch(12, words, mulberry32(seed), hard)!
      assert.ok(ws, 'génération')
      assert.equal(ws.placements.length, words.length)
      for (const p of ws.placements) {
        const cells = placementCells(p)
        assert.equal(cells.map(([r, c]) => ws.grid[r]![c]).join(''), p.word)
        const found = matchSelection(ws, cells, new Set())
        assert.equal(found, p.word)
        assert.equal(matchSelection(ws, cells.slice().reverse(), new Set()), p.word, 'sens inverse accepté')
        assert.equal(matchSelection(ws, cells, new Set([p.word])), null)
      }
      assert.ok(ws.grid.flat().every((ch) => /^[A-Z]$/.test(ch)))
    }
  }
  assert.deepEqual(lineCells([0, 0], [0, 3]), [[0, 0], [0, 1], [0, 2], [0, 3]])
  assert.deepEqual(lineCells([2, 2], [0, 0]), [[2, 2], [1, 1], [0, 0]])
  assert.equal(lineCells([0, 0], [1, 2]), null)
})
