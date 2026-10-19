/*
 * Bingo (75 balls): B 1–15 · I 16–30 · N 31–45 · G 46–60 · O 61–75.
 * The game is kept on the presenting device, so a refresh doesn't lose the calls.
 */

export const BINGO_MAX = 75
export const LETTERS = ['B', 'I', 'N', 'G', 'O'] as const
export type BingoLetter = (typeof LETTERS)[number]

/** Ball colours per letter — soft, earthy tones that sit well with every design. */
export const BALL_COLORS: Record<BingoLetter, string> = {
  B: '#c08a7d',
  I: '#8fa68a',
  N: '#c9a66b',
  G: '#7f93a8',
  O: '#b07a52',
}

export const letterFor = (n: number): BingoLetter => LETTERS[Math.min(4, Math.floor((n - 1) / 15))]
export const callLabel = (n: number) => `${letterFor(n)}-${n}`
export const colorFor = (n: number) => BALL_COLORS[letterFor(n)]

/** A fair random whole number from 0 to n-1 (the browser's secure random source). */
function randomIndex(n: number): number {
  const c = globalThis.crypto
  if (c?.getRandomValues) {
    // Rejection sampling keeps every number equally likely.
    const limit = Math.floor(0x100000000 / n) * n
    const buf = new Uint32Array(1)
    do c.getRandomValues(buf)
    while (buf[0] >= limit)
    return buf[0] % n
  }
  return Math.floor(Math.random() * n)
}

/** Numbers still in the drum, in order. */
export const remainingNumbers = (called: number[]) => {
  const out = new Set(called)
  return Array.from({ length: BINGO_MAX }, (_, i) => i + 1).filter((n) => !out.has(n))
}

/** Picks the next number from those not yet called — never a repeat. Null when the drum is empty. */
export function drawNumber(called: number[]): number | null {
  const left = remainingNumbers(called)
  return left.length ? left[randomIndex(left.length)] : null
}

/** Numbers typed by the host (any separators), kept to 1–75, no duplicates. */
export function parseCard(text: string): number[] {
  const seen = new Set<number>()
  for (const m of text.match(/\d+/g) ?? []) {
    const n = Number(m)
    if (n >= 1 && n <= BINGO_MAX) seen.add(n)
  }
  return [...seen]
}

// ---------------------------------------------------------------- saved game

const KEY = 'wedding-bingo-game'

export interface BingoGameState {
  called: number[]
  autoSeconds: number
}

export const NEW_GAME: BingoGameState = { called: [], autoSeconds: 8 }

export function loadBingo(): BingoGameState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return NEW_GAME
    const v = JSON.parse(raw) as Partial<BingoGameState>
    const seen = new Set<number>()
    const called = (Array.isArray(v.called) ? v.called : []).filter((n): n is number => {
      if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > BINGO_MAX || seen.has(n)) return false
      seen.add(n)
      return true
    })
    const autoSeconds = typeof v.autoSeconds === 'number' && v.autoSeconds >= 3 && v.autoSeconds <= 60 ? v.autoSeconds : NEW_GAME.autoSeconds
    return { called, autoSeconds }
  } catch {
    return NEW_GAME
  }
}

export function saveBingo(s: BingoGameState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* private mode etc. — the game still works, it just isn't remembered */
  }
}
