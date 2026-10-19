/**
 * Printing on coloured paper: nothing is printed for the card background (the
 * paper's own colour shows through), filled shapes become outlines, and the
 * text / gold / grey lines are kept as readable on that paper as on the design.
 * The chosen colour is only used for the on-screen preview — never printed.
 */
import type { PrintTheme } from './printables'

export type PrintOn = 'designed' | 'coloured'

export interface PaperColour {
  name: string
  hex: string
}

/** Common card-stock colours (close enough for the preview). */
export const PAPER_PRESETS: PaperColour[] = [
  { name: 'Ivory', hex: '#F6EFE0' },
  { name: 'Champagne', hex: '#EADBC0' },
  { name: 'Blush', hex: '#F2DAD3' },
  { name: 'Kraft', hex: '#C9A47E' },
]
export const DEFAULT_PAPER_COLOUR = '#EADBC0'

type RGB = [number, number, number]

export function parseHex(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1]
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB
}

const toHex = (c: RGB) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase()}`

/** "#eadbc0" / "EADBC0" → "#EADBC0"; anything else → null. */
export function normalHex(hex: string): string | null {
  const c = parseHex(hex)
  return c ? toHex(c) : null
}

const lin = (v: number) => {
  const s = v / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const luminance = ([r, g, b]: RGB) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
const contrast = (a: RGB, b: RGB) => {
  const x = luminance(a)
  const y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
/** Ink on coloured paper: roughly the two multiplied (printer inks only ever darken the paper). */
const onPaper = (c: RGB, p: RGB): RGB => [(c[0] * p[0]) / 255, (c[1] * p[1]) / 255, (c[2] * p[2]) / 255]

/**
 * The same colour, a shade deeper if needed so it stands out on `paper` about
 * as well as it does on the designed paper (never lighter, hue kept).
 */
function keepContrast(colour: string, designed: RGB, paper: RGB): string {
  const c = parseHex(colour)
  if (!c) return colour
  const target = Math.min(contrast(c, designed), 12) * 0.9
  let x: RGB = c
  for (let i = 0; i < 40 && contrast(onPaper(x, paper), paper) < target; i++) x = [x[0] * 0.94, x[1] * 0.94, x[2] * 0.94]
  return x === c ? colour : toHex(x)
}

export interface PaperFit {
  /** The theme to print with. */
  theme: PrintTheme
  /** Coloured paper: its colour, for the preview only. */
  tint?: string
  /** Too dark for printed text and QR codes to stand out. */
  tooDark: boolean
  /** The gold prints a shade deeper on this paper (the text may too). */
  deepened: boolean
}

export function forPaper(theme: PrintTheme, on: PrintOn, colour: string): PaperFit {
  if (on !== 'coloured') return { theme, tooDark: false, deepened: false }
  const paper = parseHex(colour) ?? parseHex(DEFAULT_PAPER_COLOUR)!
  const designed = parseHex(theme.paper) ?? ([255, 255, 255] as RGB)
  const ink = keepContrast(theme.ink, designed, paper)
  const soft = keepContrast(theme.soft, designed, paper)
  const muted = keepContrast(theme.muted, designed, paper)
  const accent = keepContrast(theme.accent, designed, paper)
  const line = keepContrast(theme.line, designed, paper)
  const printedInk = parseHex(ink)
  return {
    theme: { ...theme, ink, soft, muted, accent, line, paper: 'transparent', accentLight: 'transparent', onColour: true },
    tint: toHex(paper),
    tooDark: printedInk ? contrast(onPaper(printedInk, paper), paper) < 4.5 : luminance(paper) < 0.2,
    deepened: accent !== theme.accent,
  }
}
