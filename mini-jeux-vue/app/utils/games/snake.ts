import type { Rng } from './rng.ts'

export type Dir = 'up' | 'down' | 'left' | 'right'
export interface Pt {
  x: number
  y: number
}
export interface SnakeState {
  size: number
  snake: Pt[] // tête en premier
  dir: Dir
  food: Pt
  score: number
  dead: boolean
}

const VEC: Record<Dir, Pt> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }
const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }

export function canTurn(current: Dir, wanted: Dir): boolean {
  return OPPOSITE[current] !== wanted
}

export function placeFood(size: number, snake: readonly Pt[], rng: Rng): Pt {
  const free: Pt[] = []
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!snake.some((s) => s.x === x && s.y === y)) free.push({ x, y })
  return free[Math.floor(rng() * free.length)] ?? { x: 0, y: 0 }
}

export function newSnake(size: number, rng: Rng): SnakeState {
  const mid = Math.floor(size / 2)
  const snake = [{ x: mid, y: mid }, { x: mid - 1, y: mid }, { x: mid - 2, y: mid }]
  return { size, snake, dir: 'right', food: placeFood(size, snake, rng), score: 0, dead: false }
}

/** Avance d'une case dans la direction `dir`. Murs et corps sont mortels. */
export function step(state: SnakeState, dir: Dir, rng: Rng): SnakeState {
  if (state.dead) return state
  const d = canTurn(state.dir, dir) ? dir : state.dir
  const v = VEC[d]
  const head = { x: state.snake[0]!.x + v.x, y: state.snake[0]!.y + v.y }
  if (head.x < 0 || head.y < 0 || head.x >= state.size || head.y >= state.size) return { ...state, dir: d, dead: true }
  const eats = head.x === state.food.x && head.y === state.food.y
  // la queue libère sa case si on ne grandit pas
  const body = eats ? state.snake : state.snake.slice(0, -1)
  if (body.some((s) => s.x === head.x && s.y === head.y)) return { ...state, dir: d, dead: true }
  const snake = [head, ...body]
  return {
    ...state,
    dir: d,
    snake,
    score: state.score + (eats ? 1 : 0),
    food: eats ? placeFood(state.size, snake, rng) : state.food,
  }
}
