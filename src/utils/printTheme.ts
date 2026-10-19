import type { PrintTheme } from './printables'

/** The website's current colours and fonts, read from the applied theme (CSS variables). */
export function readTheme(): PrintTheme {
  const cs = getComputedStyle(document.documentElement)
  const v = (name: string, d: string) => cs.getPropertyValue(name).trim() || d
  return {
    ink: v('--color-ink', '#2b2a28'),
    soft: v('--color-ink-soft', '#55504a'),
    muted: v('--color-muted', '#8a847b'),
    accent: v('--color-gold', '#b89b6a'),
    accentLight: v('--color-champagne-light', '#efe4cf'),
    paper: v('--color-paper', '#fffdf9'),
    line: v('--color-line', '#d9d0c1'),
    serif: v('--font-serif', 'Georgia, serif'),
    sans: v('--font-sans', 'Arial, sans-serif'),
  }
}
