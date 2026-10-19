/**
 * Table printables (all units mm, SVG): folded triangle stands (name cards and
 * table names), flat cards printed on both sides — with the back placed so it
 * lands exactly behind the front — and a line-up test sheet for the printer.
 */
import type { StyleId } from '../theme/themes'
import { SHEETS, cropMarksSvg, esc, orientationMarkHtml, type Paper, type PrintTheme } from './printables'
import { frameSvg, ornamentSvg, sealSvg, styleType, type MonogramArt, type StyleColors } from './printStyles'

const r2 = (v: number) => Math.round(v * 100) / 100
const q = (v: string) => v.replace(/"/g, "'")
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

function colours(t: PrintTheme): StyleColors {
  return { ink: t.ink, accent: t.accent, accentLight: t.accentLight, paper: t.paper, line: t.line, serif: q(t.serif), onColour: t.onColour }
}

/**
 * The biggest font size (mm) that fits `text` in `width`, on one line or — for
 * longer text — two balanced lines, within `maxH` of height.
 */
export function fitTitle(text: string, width: number, maxSize: number, maxH: number, perChar = 0.5): { lines: string[]; size: number } {
  const one = Math.min(maxSize, maxH / 1.15, width / Math.max(1, text.length * perChar))
  const words = text.trim().split(/\s+/)
  if (words.length < 2 || one >= maxSize * 0.62) return { lines: [text.trim()], size: r2(one) }
  let best: string[] = [text.trim()]
  let bestLen = Infinity
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ')
    const b = words.slice(i).join(' ')
    const m = Math.max(a.length, b.length)
    if (m < bestLen) {
      bestLen = m
      best = [a, b]
    }
  }
  const two = Math.min(maxSize * 0.85, maxH / 2.3, width / Math.max(1, bestLen * perChar))
  return two > one * 1.12 ? { lines: best, size: r2(two) } : { lines: [text.trim()], size: r2(one) }
}

export interface FaceText {
  /** Small capitals above the name (e.g. "TABLE"). */
  eyebrow?: string
  /** The big line: a guest's name or a table's name. */
  title: string
  /** Italic line under it (e.g. the guest's table). */
  sub?: string
  /** Tiny line at the bottom (e.g. "Mir & Ella · December 19, 2026"). */
  footer?: string
  /** The monogram, small, above everything. */
  seal?: { text: string; art?: MonogramArt | null }
}

/** One face (w × h) drawn at the origin: frame, eyebrow, name, ornament, sub-line, footer. */
export function faceSvg(f: FaceText, w: number, h: number, t: PrintTheme, style: StyleId): string {
  const c = colours(t)
  const ty = styleType(style)
  const k = clamp(Math.min(w, h * 1.6) / 120, 0.45, 1.6)
  const inset = 4 + 2 * k
  const upper = ty.namesCase === 'uppercase'
  const title = upper ? f.title.toUpperCase() : f.title
  const eyebrowSize = r2(clamp(h * 0.05, 2, 6.5))
  const subSize = r2(clamp(h * 0.1, 3.2, 11))
  const footSize = r2(clamp(h * 0.04, 1.8, 4))
  const sealR = r2(clamp(h * 0.075, 2.6, 11))
  const sealH = f.seal ? sealR * 3.1 : 0
  const titleRoom = h - 2 * inset - sealH - (f.eyebrow ? eyebrowSize * 2.2 : 0) - (f.sub ? subSize * 2.6 : 0) - (f.footer ? footSize * 3 : 0) - 8 * k
  const fit = fitTitle(title, w - 2 * inset - 10 * k, h * 0.3, Math.max(6, titleRoom), upper ? 0.72 : 0.5)
  const lineH = fit.size * 1.12
  const orn = 5 * k
  const blockH = sealH + (f.eyebrow ? eyebrowSize * 2.2 : 0) + fit.lines.length * lineH + fit.size * 0.2 + orn * 1.6 + (f.sub ? subSize * 1.6 : 0)
  let y = (h - (f.footer ? footSize * 2 : 0) - blockH) / 2
  const out: string[] = t.frame === false ? [] : [frameSvg(style, inset, inset, w - 2 * inset, h - 2 * inset, c, k * 0.8)]
  const cx = w / 2
  if (f.seal) {
    out.push(sealSvg(style, cx, y + sealR * 1.45, sealR, f.seal.text, c, esc, f.seal.art))
    y += sealH
  }
  if (f.eyebrow) {
    y += eyebrowSize
    out.push(`<text x="${r2(cx)}" y="${r2(y)}" text-anchor="middle" font-family="${q(t.sans)}" font-size="${eyebrowSize}" letter-spacing="${r2(eyebrowSize * 0.35)}" fill="${t.accent}">${esc(f.eyebrow.toUpperCase())}</text>`)
    y += eyebrowSize * 1.2
  }
  for (const line of fit.lines) {
    y += fit.size * 0.92
    out.push(
      `<text x="${r2(cx)}" y="${r2(y)}" text-anchor="middle" font-family="${q(t.serif)}" font-weight="${ty.namesWeight}" font-size="${fit.size}" ${upper ? `letter-spacing="${r2(fit.size * 0.08)}"` : ''} fill="${t.ink}">${esc(line)}</text>`,
    )
    y += lineH - fit.size * 0.92
  }
  // clear of the name's descenders (g, y, p…)
  y += fit.size * 0.2 + orn * 0.8
  out.push(ornamentSvg(style, cx, y, clamp(w * 0.28, 14, 70), c))
  y += orn * 0.8
  if (f.sub) {
    y += subSize * 1.25
    out.push(`<text x="${r2(cx)}" y="${r2(y)}" text-anchor="middle" font-family="${q(t.serif)}" font-style="italic" font-size="${subSize}" fill="${t.soft}">${esc(f.sub)}</text>`)
  }
  if (f.footer)
    out.push(
      `<text x="${r2(cx)}" y="${r2(h - inset - footSize * 1.4)}" text-anchor="middle" font-family="${q(t.sans)}" font-size="${footSize}" letter-spacing="${r2(footSize * 0.25)}" fill="${t.muted}">${esc(f.footer.toUpperCase())}</text>`,
    )
  return out.join('')
}

// ---------------------------------------------------------------- folded triangle stand

/** Parts of a stand strip, along its length: glue tab, face A, face B, base. */
export function tentParts(len: number) {
  const tab = r2(len * 0.1)
  const face = r2(len * 0.32)
  return { tab, face, base: r2(len - tab - 2 * face) }
}

/**
 * A stand drawn as a strip `wid` across and `len` long (origin top-left).
 * Folded on the dashed lines it becomes a triangle: the same face on both
 * sides of the table (face A is printed upside down so both read upright),
 * the base underneath, and the tab glued under the base.
 */
export function tentSvg(face: FaceText, wid: number, len: number, t: PrintTheme, style: StyleId, help = true): string {
  const { tab, face: fh } = tentParts(len)
  const a = tab
  const b = tab + fh
  const base = tab + 2 * fh
  const dash = `stroke="${t.muted}" stroke-width="0.25" stroke-dasharray="2 1.6"`
  const hint = r2(clamp(wid * 0.022, 1.7, 3))
  return `<rect x="0" y="0" width="${r2(wid)}" height="${r2(len)}" fill="${t.paper}"/>
    <g transform="translate(${r2(wid)} ${r2(b)}) rotate(180)">${faceSvg(face, wid, fh, t, style)}</g>
    <g transform="translate(0 ${r2(b)})">${faceSvg(face, wid, fh, t, style)}</g>
    <line x1="0" x2="${r2(wid)}" y1="${r2(a)}" y2="${r2(a)}" ${dash}/>
    <line x1="0" x2="${r2(wid)}" y1="${r2(b)}" y2="${r2(b)}" ${dash}/>
    <line x1="0" x2="${r2(wid)}" y1="${r2(base)}" y2="${r2(base)}" ${dash}/>
    ${
      help
        ? `<text x="${r2(wid / 2)}" y="${r2(tab / 2 + hint * 0.35)}" text-anchor="middle" font-family="${q(t.sans)}" font-size="${hint}" letter-spacing="0.4" fill="${t.muted}">GLUE TAB · GOES UNDER THE BASE</text>
    <text x="${r2(wid / 2)}" y="${r2(base + (len - base) / 2 + hint * 0.35)}" text-anchor="middle" font-family="${q(t.sans)}" font-size="${hint}" letter-spacing="0.4" fill="${t.muted}">BASE · FOLD ON THE DASHED LINES INTO A TRIANGLE</text>`
        : ''
    }`
}

export type StandPerSheet = 1 | 2 | 4

/** Stand strip size for a sheet: 1 = the whole sheet, 2 = halves, 4 = quarters. */
export function standStrip(paper: Paper, per: StandPerSheet): { wid: number; len: number } {
  const s = SHEETS[paper]
  if (per === 1) return { wid: s.h, len: s.w }
  if (per === 2) return { wid: s.w / 2, len: s.h }
  return { wid: s.w / 2, len: s.h / 2 }
}

/** Print sheets of stands (one face text each). No margins needed: the sheet edges are the stand's edges. */
export function standSheets(faces: FaceText[], paper: Paper, per: StandPerSheet, t: PrintTheme, style: StyleId): string[] {
  const s = SHEETS[paper]
  const { wid, len } = standStrip(paper, per)
  const out: string[] = []
  for (let i = 0; i < faces.length; i += per) {
    const group = faces.slice(i, i + per)
    const parts = group.map((f, k) => {
      if (per === 1) return `<g transform="translate(0 ${r2(s.h)}) rotate(-90)">${tentSvg(f, wid, len, t, style)}</g>`
      const x = (k % 2) * wid
      const y = per === 4 ? Math.floor(k / 2) * len : 0
      return `<g transform="translate(${r2(x)} ${r2(y)})">${tentSvg(f, wid, len, t, style)}</g>`
    })
    const cut = `stroke="${t.ink}" stroke-width="0.3" stroke-dasharray="4 2"`
    const cuts =
      per === 1
        ? ''
        : `<line x1="${r2(s.w / 2)}" x2="${r2(s.w / 2)}" y1="0" y2="${r2(s.h)}" ${cut}/>` +
          (per === 4 ? `<line x1="0" x2="${r2(s.w)}" y1="${r2(s.h / 2)}" y2="${r2(s.h / 2)}" ${cut}/>` : '')
    out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${s.w}mm" height="${s.h}mm" viewBox="0 0 ${s.w} ${s.h}" style="position:absolute;left:0;top:0">${parts.join('')}${cuts}</svg>`)
  }
  return out
}

// ---------------------------------------------------------------- flat cards printed on both sides

export interface Duplex {
  /** The back of each card is on the opposite side of the sheet (flipped left ↔ right). */
  mirror: boolean
  /** Move the back by this much (mm, + = right / down as seen on the back). */
  dx: number
  dy: number
}

export type FlatPerSheet = 1 | 2 | 4

export type CardShape = 'upright' | 'sideways'

/**
 * The page is turned upright (portrait) when that's how the cards fit their
 * shape: upright cards 1 or 4 per sheet, sideways cards 2 per sheet.
 */
export function portraitPage(per: FlatPerSheet, shape: CardShape = 'upright'): boolean {
  return shape === 'upright' ? per !== 2 : per === 2
}

/** The sheet as printed (mm): landscape, or turned upright. */
export function sheetSize(paper: Paper, portrait = false): { w: number; h: number } {
  const s = SHEETS[paper]
  return portrait ? { w: s.h, h: s.w } : { w: s.w, h: s.h }
}

/**
 * Card size and positions for 1, 2 or 4 (2 × 2) per sheet — centred, so a
 * flipped sheet lands on itself. On an upright page, 2 cards are stacked.
 */
export function flatLayout(paper: Paper, per: FlatPerSheet, portrait = false): { w: number; h: number; pos: { x: number; y: number; w: number; h: number }[] } {
  const s = sheetSize(paper, portrait)
  const m = 12
  const g = 12
  const cols = per === 1 || (per === 2 && portrait) ? 1 : 2
  const rows = per === 4 || (per === 2 && portrait) ? 2 : 1
  const w = cols === 1 ? s.w - 2 * m : (s.w - 2 * m - g) / 2
  const h = rows === 1 ? s.h - 2 * m : (s.h - 2 * m - g) / 2
  const xs = cols === 1 ? [m] : [m, m + w + g]
  const ys = rows === 1 ? [m] : [m, m + h + g]
  const pos = ys.flatMap((y) => xs.map((x) => ({ x: r2(x), y: r2(y), w: r2(w), h: r2(h) })))
  return { w: r2(w), h: r2(h), pos }
}

/** A flat card (w × h) with one face, as an SVG. */
export function faceCardSvg(face: FaceText, w: number, h: number, t: PrintTheme, style: StyleId): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}" style="display:block"><rect width="${w}" height="${h}" fill="${t.paper}"/>${faceSvg(face, w, h, t, style)}</svg>`
}

/**
 * Front and back sheets for cards (HTML, `w` × `h` from flatLayout) that are the same on both sides. The back
 * of a card goes to the mirrored spot (when the sheet is flipped left ↔ right)
 * and is nudged by the printer's measured offset.
 */
export function flatSheets(cards: string[], backs_: string[] | null, paper: Paper, per: FlatPerSheet, t: PrintTheme, duplex: Duplex, side: 'front' | 'back' | 'both', portrait = false): string[] {
  const s = sheetSize(paper, portrait)
  const { w, h, pos } = flatLayout(paper, per, portrait)
  const groups: string[][] = []
  for (let i = 0; i < cards.length; i += per) groups.push(cards.slice(i, i + per))
  const card = (body: string, x: number, y: number) => `<div style="position:absolute;left:${x}mm;top:${y}mm;width:${w}mm;height:${h}mm;overflow:hidden">${body}</div>`
  const fronts = groups.map(
    (g, gi) => g.map((body, k) => card(body, pos[k].x, pos[k].y)).join('') + cropMarksSvg(s.w, s.h, pos.slice(0, g.length), t.muted) + orientationMarkHtml('front', gi + 1, groups.length, t),
  )
  const backs = groups.map((g, gi) => {
    const placed = g
      .map((front, k) => {
        const body = backs_?.[gi * per + k] ?? front
        const p = pos[k]
        const x = duplex.mirror ? s.w - p.x - p.w : p.x
        return card(body, r2(x + duplex.dx), r2(p.y + duplex.dy))
      })
      .join('')
    return placed + orientationMarkHtml('back', gi + 1, groups.length, t)
  })
  return side === 'front' ? fronts : side === 'back' ? backs : fronts.flatMap((f, i) => [f, backs[i]])
}

/**
 * Line-up test: the front has a cross in the middle and numbered spots; the
 * back has rulers through the middle (moved by the current offset). Held up to
 * a light, the front's cross shows where the back really landed.
 */
export function alignmentSheets(paper: Paper, t: PrintTheme, duplex: Duplex, portrait = false): [string, string] {
  const s = sheetSize(paper, portrait)
  const cx = s.w / 2
  const cy = s.h / 2
  // Spots 1 and 2 on the left and right halves (the halves swap when the sheet is flipped left ↔ right).
  const pos = [
    { x: 0, w: s.w / 2 },
    { x: s.w / 2, w: s.w / 2 },
  ]
  const font = `font-family="${q(t.sans)}"`
  const spot = (n: number, x: number, w: number) =>
    `<text x="${r2(x + w / 2)}" y="${r2(cy - 34)}" text-anchor="middle" ${font} font-size="16" fill="${t.ink}">${n}</text>`
  const front = `<svg xmlns="http://www.w3.org/2000/svg" width="${s.w}mm" height="${s.h}mm" viewBox="0 0 ${s.w} ${s.h}" style="position:absolute;left:0;top:0">
      <g stroke="${t.ink}" stroke-width="0.35"><line x1="${cx - 25}" x2="${cx + 25}" y1="${cy}" y2="${cy}"/><line x1="${cx}" x2="${cx}" y1="${cy - 25}" y2="${cy + 25}"/></g>
      <circle cx="${cx}" cy="${cy}" r="3" fill="none" stroke="${t.ink}" stroke-width="0.35"/>
      ${spot(1, pos[0].x, pos[0].w)}${spot(2, pos[1].x, pos[1].w)}
      <text x="${cx}" y="${s.h - 22}" text-anchor="middle" ${font} font-size="${portrait ? 2.9 : 3.6}" fill="${t.ink}">LINE-UP TEST · FRONT — print this, then print the back on the other side the way you'll print your cards.</text>
      <text x="${cx}" y="${s.h - 16}" text-anchor="middle" ${font} font-size="${portrait ? 2.9 : 3.6}" fill="${t.ink}">Hold the sheet up to a light, looking at the BACK: read on its rulers where this cross falls, and type the two numbers in Printables.</text>
    </svg>`
  const ticks: string[] = []
  for (let i = -15; i <= 15; i++) {
    const long = i % 5 === 0
    ticks.push(`<line x1="${cx + i}" x2="${cx + i}" y1="${cy - (long ? 3 : 1.6)}" y2="${cy + (long ? 3 : 1.6)}"/>`)
    ticks.push(`<line y1="${cy + i}" y2="${cy + i}" x1="${cx - (long ? 3 : 1.6)}" x2="${cx + (long ? 3 : 1.6)}"/>`)
  }
  // Numbers: across above the line, down on the right (±5 only across, so they don't overlap).
  const labels = [-15, -10, -5, 5, 10, 15]
    .map(
      (i) =>
        `<text x="${cx + i}" y="${cy - 4.5}" text-anchor="middle" ${font} font-size="2.2" fill="${t.ink}">${i > 0 ? '+' : ''}${i}</text>` +
        (Math.abs(i) > 5 ? `<text x="${cx + 4.5}" y="${cy + i + 0.8}" ${font} font-size="2.2" fill="${t.ink}">${i > 0 ? '+' : ''}${i}</text>` : ''),
    )
    .join('')
  const spotsBack = [0, 1]
    .map((k) => {
      const p = pos[k]
      const x = duplex.mirror ? s.w - p.x - p.w : p.x
      return spot(k + 1, x, p.w)
    })
    .join('')
  const back = `<svg xmlns="http://www.w3.org/2000/svg" width="${s.w}mm" height="${s.h}mm" viewBox="0 0 ${s.w} ${s.h}" style="position:absolute;left:0;top:0">
      <g transform="translate(${r2(duplex.dx)} ${r2(duplex.dy)})">
        <g stroke="${t.ink}" stroke-width="0.22"><line x1="${cx - 16}" x2="${cx + 16}" y1="${cy}" y2="${cy}"/><line x1="${cx}" x2="${cx}" y1="${cy - 16}" y2="${cy + 16}"/>${ticks.join('')}</g>
        ${labels}${spotsBack}
      </g>
      <text x="${cx}" y="${s.h - 22}" text-anchor="middle" ${font} font-size="${portrait ? 2.9 : 3.6}" fill="${t.ink}">LINE-UP TEST · BACK — rulers in mm: + is right / down as you look at this side.</text>
      <text x="${cx}" y="${s.h - 16}" text-anchor="middle" ${font} font-size="${portrait ? 2.9 : 3.6}" fill="${t.ink}">The big 1 and 2 should be behind the 1 and 2 on the front. Swapped or upside-down? Change “Back lands” or “Turn the backs upside-down” in Printables.</text>
    </svg>`
  return [front, back]
}
