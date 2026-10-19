import { PRINT_MARKS } from './printables'

export type Mark = keyof typeof PRINT_MARKS

/** Is the text at [a, b) wrapped by marker m (and not by a longer run of the same character)? */
function wrappedAt(v: string, a: number, b: number, m: string): boolean {
  return a >= m.length && v.slice(a - m.length, a) === m && v.slice(b, b + m.length) === m
}

/** Wraps (or unwraps) the selection in a print mark. Returns the new text and selection. */
export function toggleMark(v: string, start: number, end: number, mark: Mark): { text: string; start: number; end: number } {
  const m = PRINT_MARKS[mark]
  let a = start
  let b = end
  // Nothing selected: use the word under the cursor.
  if (a === b) {
    while (a > 0 && /[^\s*=_]/.test(v[a - 1])) a--
    while (b < v.length && /[^\s*=_]/.test(v[b])) b++
  }
  // Keep spaces outside the marks ("**word** ", not "**word **").
  while (a < b && /\s/.test(v[a])) a++
  while (b > a && /\s/.test(v[b - 1])) b--
  if (a === b) return { text: v.slice(0, a) + m + m + v.slice(a), start: a + m.length, end: a + m.length }
  const sel = v.slice(a, b)
  // Already marked → remove the mark.
  if (wrappedAt(v, a, b, m)) return { text: v.slice(0, a - m.length) + sel + v.slice(b + m.length), start: a - m.length, end: b - m.length }
  if (sel.length > 2 * m.length && sel.startsWith(m) && sel.endsWith(m))
    return { text: v.slice(0, a) + sel.slice(m.length, -m.length) + v.slice(b), start: a, end: b - 2 * m.length }
  return { text: v.slice(0, a) + m + sel + m + v.slice(b), start: a + m.length, end: b + m.length }
}

/** Removes every mark in the selection (or in the whole text when nothing is selected). */
export function clearMarks(v: string, start: number, end: number): { text: string; start: number; end: number } {
  const strip = (s: string) => s.replace(/\*\*|==|__/g, '')
  if (start === end) {
    const text = strip(v)
    return { text, start: Math.min(start, text.length), end: Math.min(start, text.length) }
  }
  // Include marks that sit just outside the selection.
  let a = start
  let b = end
  while (a > 0 && /[*=_]/.test(v[a - 1])) a--
  while (b < v.length && /[*=_]/.test(v[b])) b++
  const mid = strip(v.slice(a, b))
  return { text: v.slice(0, a) + mid + v.slice(b), start: a, end: a + mid.length }
}

