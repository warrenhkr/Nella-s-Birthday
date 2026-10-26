import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DIFFERENCES, SCENE_H, SCENE_W, hitDifference } from '../../app/utils/games/scene.ts'

test('scène : zones dans l’image, sans chevauchement, détection du toucher', () => {
  assert.equal(DIFFERENCES.length, 8)
  assert.equal(new Set(DIFFERENCES.map((d) => d.id)).size, 8)
  for (const d of DIFFERENCES) {
    assert.ok(d.cx - d.r > 0 && d.cx + d.r < SCENE_W && d.cy - d.r > 0 && d.cy + d.r < SCENE_H, d.label)
  }
  for (let i = 0; i < DIFFERENCES.length; i++) for (let j = i + 1; j < DIFFERENCES.length; j++) {
    const a = DIFFERENCES[i]!
    const b = DIFFERENCES[j]!
    assert.ok(Math.hypot(a.cx - b.cx, a.cy - b.cy) > a.r * 1.35 + b.r * 1.35 - 8, a.label + ' / ' + b.label)
  }
  const d = DIFFERENCES[2]!
  assert.equal(hitDifference(d.cx + 3, d.cy - 2, DIFFERENCES)?.id, 2)
  assert.equal(hitDifference(0, 0, DIFFERENCES), null)
})
