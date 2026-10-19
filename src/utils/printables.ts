/**
 * Print-ready layouts (millimetres) for the money envelope and paper
 * invitations of the baby shower. Plain HTML/SVG strings so they render identically on screen,
 * in the browser's print dialog and in tests. All user text is escaped.
 */

import type { StyleId } from '../theme/themes'
import { babyArtSvg, frameSvg, ornamentSvg, sealSvg, styleType, type MonogramArt } from './printStyles'
import { addressLines } from './addressing'

export type Paper = 'a4' | 'letter' | 'legal'

/** Landscape sheet sizes in mm; `size` / `label` are how the paper is sold (portrait). */
export const SHEETS: Record<Paper, { w: number; h: number; name: string; size: string; label: string }> = {
  a4: { w: 297, h: 210, name: 'A4', size: '210 × 297 mm', label: 'A4 · 210 × 297 mm (8.3 × 11.7 in)' },
  letter: { w: 279.4, h: 215.9, name: 'Letter', size: '8.5 × 11 in', label: 'Letter · 8.5 × 11 in (216 × 279 mm)' },
  legal: { w: 355.6, h: 215.9, name: 'Legal', size: '8.5 × 14 in', label: 'Legal · 8.5 × 14 in (216 × 356 mm)' },
}
/** In the order shown in the paper picker (smallest first). */
export const PAPERS: Paper[] = ['a4', 'letter', 'legal']

export interface PrintTheme {
  /** Design style (Look & Feel); defaults to classic. */
  style?: StyleId
  /** Draw the design's border around each card (default: yes). Crop marks are still printed. */
  frame?: boolean
  ink: string
  soft: string
  muted: string
  accent: string
  accentLight: string
  paper: string
  line: string
  serif: string
  sans: string
  /**
   * Printing on coloured paper: no background is printed (paper and accentLight
   * are 'transparent') and filled shapes become outlines.
   */
  onColour?: boolean
}

/** Font stacks may contain double quotes, which would break style="…" attributes. */
function safe(t: PrintTheme): PrintTheme {
  const q = (v: string) => v.replace(/"/g, "'")
  return { ...t, serif: q(t.serif), sans: q(t.sans) }
}

/** Which of our details a printable shows (each can be switched off). */
export interface OurDetails {
  monogram: boolean
  names: boolean
  date: boolean
}
export const ALL_DETAILS: OurDetails = { monogram: true, names: true, date: true }

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

/** Print-only marks typed in Printables: **bold**, __italic__, ==gold==; new lines are kept. */
export const PRINT_MARKS = { bold: '**', italic: '__', gold: '==' } as const

/** Safe HTML for text with print marks (everything is escaped first). */
export function markedHtml(s: string, t: Pick<PrintTheme, 'ink' | 'accent'>): string {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, `<b style="font-weight:700;color:${t.ink}">$1</b>`)
    .replace(/__(.+?)__/g, '<i>$1</i>')
    .replace(/==(.+?)==/g, `<span style="color:${t.accent};font-weight:500">$1</span>`)
    .replace(/\n/g, '<br/>')
}

/** The text without its marks (e.g. for checking it isn't empty). */
export const unmarked = (s: string) => s.replace(/\*\*|==|__/g, '')

/** "Juan & Maria" → names with a styled ampersand. */
function coupleHtml(names: string, t: PrintTheme): string {
  const parts = names.split(/\s*(?:&|and)\s*/i).filter(Boolean)
  if (parts.length < 2) return esc(names)
  return `${esc(parts[0])} <span style="font-style:italic;color:${t.accent}">&amp;</span> ${esc(parts.slice(1).join(' & '))}`
}

// ---------------------------------------------------------------- money envelope (policy type)

/**
 * A tall, open-end "policy" envelope: 92 × 185 mm finished, opening on the
 * short top edge, so peso bills (160 × 66 mm) slide in flat.
 *
 * Flat layout on the sheet (lying on its side, top of the envelope → right):
 *   - front panel, with the back panel below it (fold between them)
 *   - a glue strip above the front and a bottom flap on the left end — both
 *     fold INSIDE (between front and back) and carry the "GLUE" marks, so
 *     the back stays fully clear for the guest's message;
 *   - the closing flap on the right end folds over the back to close it.
 */
export const ENV = { W: 92, L: 185, glue: 10, bottom: 16, flap: 44 }
export const ENV_FLAT = { w: ENV.bottom + ENV.L + ENV.flap, h: ENV.glue + ENV.W * 2 } // 245 × 194

export interface EnvelopeOptions {
  coupleNames: string
  dateText: string
  monogram: string
  /** The uploaded monogram, used instead of the initials when set. */
  monogramArt?: MonogramArt | null
  theme: PrintTheme
  /** The venue, e.g. "Sample Garden Venue · 2:00 PM" */
  ceremony?: string
  /** Not used by the baby shower (one venue). */
  reception?: string
  /** The GCash / InstaPay QR (image URL), printed on the front. */
  giftQrUrl?: string | null
  /** Front: the date, and the monogram seal (front and closing flap). Names always show. */
  showDate?: boolean
  showSeal?: boolean
}

const r2 = (v: number) => Math.round(v * 100) / 100

/** Fits text on one line: a font size (mm) for `text` within `width` mm (approximate). */
function fit(text: string, width: number, max: number, perChar = 0.56): number {
  return r2(Math.min(max, width / Math.max(1, text.length * perChar)))
}

export function envelopeSvg({ coupleNames, dateText, monogram, monogramArt, theme, ceremony = '', reception = '', giftQrUrl, showDate = true, showSeal = true }: EnvelopeOptions): string {
  const t = safe(theme)
  const style = t.style ?? 'classic'
  const c = { ink: t.ink, accent: t.accent, accentLight: t.accentLight, paper: t.paper, line: t.line, serif: t.serif, onColour: t.onColour }
  const ty = styleType(style)
  const { W, L, glue: G, bottom: B, flap: F } = ENV
  const xr = B + L // the envelope's top edge (flap hinge) in flat coordinates
  const yF = G // front panel top
  const yB = G + W // back panel top (fold)
  const cy = yB + W / 2
  const flapPath = `L ${xr + F - 14} ${yF + 6} Q ${xr + F} ${yF + 12} ${xr + F} ${yF + W / 2} Q ${xr + F} ${yF + W - 12} ${xr + F - 14} ${yF + W - 6} L ${xr} ${yF + W}`

  // Cut outline, clockwise from the front panel's bottom-left corner.
  const outline = [
    `M ${B} ${yF}`,
    `L ${B + 6} 0 L ${xr - 6} 0 L ${xr} ${yF}`, // glue strip
    flapPath, // closing flap
    `L ${xr} ${cy - 9} A 9 9 0 0 0 ${xr} ${cy + 9}`, // thumb notch at the opening
    `L ${xr} ${yB + W} L ${B} ${yB + W} L ${B} ${yB}`, // back panel
    `L 1 ${yF + W - 7} L 1 ${yF + 7} Z`, // bottom flap
  ].join(' ')

  const cut = `fill="none" stroke="${t.ink}" stroke-width="0.35"`
  const fold = `fill="none" stroke="${t.muted}" stroke-width="0.3" stroke-dasharray="2.2 1.6"`

  // ---------------- front (portrait coords: u across 0–92, v down 0–185)
  const parts = coupleNames.split(/\s*(?:&|and)\s*/i).filter(Boolean)
  const nameA = parts[0] ?? coupleNames
  const nameB = parts.length > 1 ? parts.slice(1).join(' & ') : ''
  const caseName = (s: string) => esc(ty.namesCase === 'uppercase' ? s.toUpperCase() : s)
  const nameSize = fit(nameB ? (nameA.length > nameB.length ? nameA : nameB) : nameA, 70, 14 * ty.namesScale, ty.namesCase === 'uppercase' ? 0.72 : 0.55)
  const u0 = W / 2
  const hasQr = Boolean(giftQrUrl)
  const details = [
    ['VENUE', ceremony],
    ['', reception],
  ].filter(([l, v]) => l && v.trim())
  const top = hasQr ? 20 : 30
  let v = top
  const out: string[] = []
  if (t.frame !== false) out.push(frameSvg(style, 5, 5, W - 10, L - 10, c))
  out.push(
    `<text x="${u0}" y="${v}" text-anchor="middle" font-family="${t.sans}" font-size="2.3" letter-spacing="${ty.eyebrowTracking * 0.8}" fill="${t.accent}">FOR THE BABY · WITH LOVE</text>`,
  )
  v += 16
  out.push(
    `<text x="${u0}" y="${v}" text-anchor="middle" font-family="${t.serif}" font-size="${nameSize}" font-weight="${ty.namesWeight}" letter-spacing="${ty.namesTracking.replace('mm', '')}" fill="${t.ink}">${caseName(nameA)}</text>`,
  )
  if (nameB) {
    v += nameSize * 0.82
    out.push(`<text x="${u0}" y="${v}" text-anchor="middle" font-family="${t.serif}" font-style="italic" font-size="${r2(nameSize * 0.7)}" fill="${t.accent}">&amp;</text>`)
    v += nameSize * 0.98
    out.push(
      `<text x="${u0}" y="${v}" text-anchor="middle" font-family="${t.serif}" font-size="${nameSize}" font-weight="${ty.namesWeight}" letter-spacing="${ty.namesTracking.replace('mm', '')}" fill="${t.ink}">${caseName(nameB)}</text>`,
    )
  }
  v += 9
  out.push(ornamentSvg(style, u0, v, 34, c))
  v += 9
  if (showDate && dateText.trim())
    out.push(`<text x="${u0}" y="${v}" text-anchor="middle" font-family="${t.sans}" font-size="${fit(dateText, 76, 2.9, 0.62)}" letter-spacing="0.6" fill="${t.ink}">${esc(dateText.toUpperCase())}</text>`)
  else v -= 3.5
  for (const [label, value] of details) {
    const [place, time] = value.split(/\s+·\s+/)
    v += 7.5
    out.push(`<text x="${u0}" y="${v}" text-anchor="middle" font-family="${t.sans}" font-size="2.1" letter-spacing="0.6" fill="${t.accent}">${label}${time ? `  ·  ${esc(time)}` : ''}</text>`)
    v += 3.8
    out.push(`<text x="${u0}" y="${v}" text-anchor="middle" font-family="${t.serif}" font-size="${fit(place, 74, 3.3, 0.5)}" fill="${t.soft}">${esc(place)}</text>`)
  }
  if (hasQr) {
    const qr = 32
    const qy = L - 14 - 9 - qr
    out.push(`<text x="${u0}" y="${qy - 5}" text-anchor="middle" font-family="${t.sans}" font-size="2.15" letter-spacing="${ty.eyebrowTracking * 0.6}" fill="${t.accent}">OR SEND YOUR GIFT ONLINE</text>`)
    out.push(`<rect x="${u0 - qr / 2 - 2}" y="${qy - 2}" width="${qr + 4}" height="${qr + 4}" rx="${style === 'heritage' ? 2.5 : style === 'classic' ? 1.5 : 0}" fill="${t.onColour ? 'none' : '#ffffff'}" stroke="${t.line}" stroke-width="0.3"/>`)
    out.push(`<image href="${esc(giftQrUrl!)}" x="${u0 - qr / 2}" y="${qy}" width="${qr}" height="${qr}" preserveAspectRatio="xMidYMid meet"/>`)
    out.push(`<text x="${u0}" y="${qy + qr + 6}" text-anchor="middle" font-family="${t.sans}" font-size="2.1" fill="${t.soft}">Scan with GCash, Maya or your banking app</text>`)
  } else if (showSeal) {
    out.push(sealSvg(style, u0, L - 34, 8, monogram, c, esc, monogramArt))
  }
  const front = `<g transform="translate(${xr} ${yF}) rotate(90)">${out.join('')}</g>`

  // ---------------- back panel (as seen when the envelope is turned over)
  // The glue strip and bottom flap fold inside, so the whole back is free —
  // only the top 44 mm is covered by the closing flap once it's closed.
  const back: string[] = []
  const bl = 7
  const br = W - 7
  const lineGap = 8.5
  const lines = Math.floor((L - 28 - (F + 26)) / lineGap) + 1
  back.push(`<text x="${(bl + br) / 2}" y="${F + 14}" text-anchor="middle" font-family="${t.sans}" font-size="2.3" letter-spacing="${ty.eyebrowTracking * 0.6}" fill="${t.accent}">A WISH FOR THE BABY</text>`)
  for (let i = 0; i < lines; i++) {
    const ly = F + 26 + i * lineGap
    back.push(`<line x1="${bl}" x2="${br}" y1="${ly}" y2="${ly}" stroke="${t.line}" stroke-width="0.3"/>`)
  }
  const fy = F + 26 + lines * lineGap + 6
  back.push(`<text x="${bl}" y="${fy}" font-family="${t.sans}" font-size="2.3" letter-spacing="0.5" fill="${t.accent}">FROM</text>`)
  back.push(`<line x1="${bl + 11}" x2="${br}" y1="${fy + 0.4}" y2="${fy + 0.4}" stroke="${t.line}" stroke-width="0.3"/>`)
  const backG = `<g transform="translate(${xr} ${yB}) rotate(90)">${back.join('')}</g>`

  // ---------------- closing flap: seal facing up when closed (seen on the back)
  const sealD = 25
  const flapArt = !showSeal ? '' : `<g transform="translate(${xr + sealD} ${yF + W / 2}) rotate(-90)">${sealSvg(style, 0, 0, 7.5, monogram, c, esc, monogramArt)}</g>`
  const flapEdge =
    style === 'maison'
      ? ''
      : style === 'deco'
        ? `<line x1="${xr + 4}" x2="${xr + 4}" y1="${yF + 5}" y2="${yF + W - 5}" stroke="${t.accent}" stroke-width="0.3"/><line x1="${xr + 5.4}" x2="${xr + 5.4}" y1="${yF + 6}" y2="${yF + W - 6}" stroke="${t.accent}" stroke-width="0.15"/>`
        : `<line x1="${xr + 4}" x2="${xr + 4}" y1="${yF + 8}" y2="${yF + W - 8}" stroke="${t.accent}" stroke-width="0.22" ${style === 'heritage' ? 'stroke-dasharray="1.1 0.8"' : ''}/>`

  // Glue marks on the two flaps that fold inside (hidden once made).
  const glueMark = (x: number, y: number, w: number, h: number, rot: number) => {
    const cx = x + w / 2
    const cy = y + h / 2
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" fill="none" stroke="${t.muted}" stroke-width="0.25" stroke-dasharray="1.2 1"/>
      <text x="${cx}" y="${cy + 0.8}" text-anchor="middle" font-family="${t.sans}" font-size="2.2" letter-spacing="0.6" fill="${t.muted}" transform="rotate(${rot} ${cx} ${cy})">GLUE · FOLDS INSIDE</text>`
  }
  const bands = `${glueMark(B + 12, 2, L - 24, G - 4, 0)}${glueMark(3, yF + 12, B - 6, W - 24, -90)}`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ENV_FLAT.w}mm" height="${ENV_FLAT.h}mm" viewBox="0 0 ${ENV_FLAT.w} ${ENV_FLAT.h}">
    <path d="${outline}" fill="${t.paper}"/>
    ${front}
    ${backG}
    ${flapArt}
    ${flapEdge}
    ${bands}
    <path d="${outline}" ${cut}/>
    <line x1="${B}" y1="${yB}" x2="${xr}" y2="${yB}" ${fold}/>
    <line x1="${B}" y1="${yF}" x2="${xr}" y2="${yF}" ${fold}/>
    <line x1="${B}" y1="${yF}" x2="${B}" y2="${yB}" ${fold}/>
    <line x1="${xr}" y1="${yF}" x2="${xr}" y2="${yB}" ${fold}/>
  </svg>`
}

// ---------------------------------------------------------------- invitation cards

export type CardSize = '5x7' | '4x6' | 'fit'
export const CARD_SIZES: Record<CardSize, { w: number; h: number; label: string; perSheet: Record<Paper, number> }> = {
  '5x7': { w: 127, h: 177.8, label: '5 × 7 in (5R)', perSheet: { a4: 2, letter: 2, legal: 2 } },
  '4x6': { w: 101.6, h: 152.4, label: '4 × 6 in (4R)', perSheet: { a4: 2, letter: 2, legal: 3 } },
  // Worked out from your envelope by applyEnvelopeFit (5 : 7 like the 5×7 design).
  fit: { w: 121.9, h: 170.7, label: 'Fits my envelope', perSheet: { a4: 2, letter: 2, legal: 2 } },
}

export interface EnvelopeFit {
  /** The envelope's inside size (mm). */
  w: number
  h: number
  /** Cards that go in together (invitation, attire guide…). */
  cards: number
  /** Thickness of one card (mm): ~0.25 for 200 gsm, ~0.35 for 300 gsm. */
  thick: number
}
/** Room kept around the cards inside the envelope (mm), besides the stack's own thickness. */
export const ENVELOPE_ROOM = 4

/**
 * The biggest 5 : 7 card that slides into the envelope with the whole stack:
 * the stack's thickness wraps round the edges, so it comes off both the
 * width and the height, plus a little room to slide the cards in.
 * Updates the "Fits my envelope" card size and returns it.
 */
export function applyEnvelopeFit(e: EnvelopeFit): { w: number; h: number; stack: number } {
  const stack = Math.max(0, e.cards) * Math.max(0, e.thick)
  const maxW = Math.max(60, e.w - ENVELOPE_ROOM - stack)
  const maxH = Math.max(80, e.h - ENVELOPE_ROOM - stack)
  const w = r2(Math.min(maxW, (maxH * 5) / 7))
  const h = r2((w * 7) / 5)
  const per = (sheetW: number, sheetH: number) => (h > sheetH - 20 ? 1 : Math.max(1, Math.min(3, Math.floor((sheetW - 12) / (w + 12)))))
  CARD_SIZES.fit = {
    w,
    h,
    label: `Fits my envelope (${(w / 10).toFixed(1)} × ${(h / 10).toFixed(1)} cm)`,
    perSheet: { a4: per(SHEETS.a4.w, SHEETS.a4.h), letter: per(SHEETS.letter.w, SHEETS.letter.h), legal: per(SHEETS.legal.w, SHEETS.legal.h) },
  }
  return { w, h, stack: r2(stack) }
}

export interface InvitationCardOptions {
  guestName: string
  /** e.g. "Ninang" — shown under the name (optional). */
  position?: string
  withNames: string[]
  /** The parents' names (the hosts line; '' to leave it off). */
  coupleNames: string
  /** The baby's name or nickname, printed large. */
  babyName: string
  dateText: string
  /** The venue line ('' to leave it off). */
  ceremony: string
  /** Not used by the baby shower (one venue). */
  reception: string
  /** The venue text has print marks (**bold**, __italic__, ==gold==). */
  ceremonyMarked?: boolean
  receptionMarked?: boolean
  /** e.g. "Arriving April 2027" ('' = none). */
  arriving?: string
  respondBy: string | null
  qrSvg: string
  shortLink: string
  theme: PrintTheme
  size: CardSize
  /** Print the RSVP QR on the back instead (front then says "Please turn over to RSVP"). */
  qrOnBack?: boolean
  /** On-screen (virtual) card: no QR or web address — just a gentle "respond by" line. */
  virtual?: boolean
  /** Shown instead of the venue line when it is kept private. */
  detailsNote?: string
  /** Some details were switched off: centre what's left so the card stays balanced. */
  sparse?: boolean
  fit?: number
}

/** "Tito Joey & Tita Vivian Montes" → one line per person, with the "&" on its own line between them (when long). */
function nameLinesHtml(name: string, t: PrintTheme, z: (v: number) => number): string {
  const lines = addressLines(name)
  if (lines.length < 2) return esc(name)
  const amp = `<span style="display:block;margin:${z(0.8)}mm 0 ${z(0.6)}mm;font-style:italic;font-size:${z(5.6)}mm;line-height:1;color:${t.accent}">&amp;</span>`
  return lines.map((l) => `<span style="display:block">${esc(l)}</span>`).join(amp)
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
}

/** A personalised invitation card, designed at 5×7 in and scaled for 4×6. */
/** Space kept clear inside the card edge for each style's frame (mm, at 5×7). */
export function cardSafeArea(style: StyleId | undefined): { top: number; bottom: number; side: number } {
  return style === 'heritage' ? { top: 10.5, bottom: 10.5, side: 9.5 } : style === 'deco' ? { top: 9.5, bottom: 9.5, side: 10 } : { top: 9, bottom: 9, side: 9.5 }
}
/** Smallest text scale used before a card is reported as not fitting. */
export const MIN_CARD_FIT = 0.8

function svgBox(w: number, h: number, body: string, css = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(w)}mm" height="${r2(h)}mm" viewBox="0 0 ${w} ${h}" style="display:block;${css}">${body}</svg>`
}

/** Wraps a card designed at 5×7 in, scaling it for smaller sizes. */
function sized(inner: string, size: CardSize): string {
  const base = CARD_SIZES['5x7']
  const s = CARD_SIZES[size]
  const k = s.w / base.w
  if (k === 1) return inner
  return `<div style="width:${s.w}mm;height:${s.h}mm;overflow:hidden"><div style="transform:scale(${k});transform-origin:top left">${inner}</div></div>`
}

/**
 * A personalised invitation card, designed at 5×7 in and scaled for 4×6.
 * `fit` (0.8–1) shrinks the text slightly when a card is very full; the
 * measured content area is marked data-card-body / data-card-content.
 */
export function invitationCardHtml(o: InvitationCardOptions): string {
  const t = safe(o.theme)
  const base = CARD_SIZES['5x7']
  const style = t.style ?? 'classic'
  const ty = styleType(style)
  const c = { ink: t.ink, accent: t.accent, accentLight: t.accentLight, paper: t.paper, line: t.line, serif: t.serif, onColour: t.onColour }
  const f = Math.max(MIN_CARD_FIT, Math.min(1, o.fit ?? 1))
  const z = (v: number) => r2(v * f)
  const area = cardSafeArea(style)
  const baby = esc(ty.namesCase === 'uppercase' ? o.babyName.toUpperCase() : o.babyName)
  const hosts = o.coupleNames.trim() ? coupleHtml(o.coupleNames.trim(), t) : ''
  const centred = o.qrOnBack || o.virtual || o.sparse || !o.ceremony
  const bottom = o.virtual
    ? `<div style="padding-top:${z(4)}mm;display:flex;flex-direction:column;align-items:center">
        ${svgBox(z(40), z(7), ornamentSvg(style, 20 * f, 4 * f, 32 * f, c))}
        ${o.respondBy ? `<div style="margin-top:${z(2.5)}mm;font-size:${z(2.7)}mm;color:${t.soft}">Kindly respond on or before <b style="color:${t.ink}">${esc(o.respondBy)}</b></div>` : ''}
      </div>`
    : o.qrOnBack
    ? `<div style="padding-top:${z(4)}mm;display:flex;flex-direction:column;align-items:center">
        ${svgBox(z(40), z(7), ornamentSvg(style, 20 * f, 4 * f, 32 * f, c))}
        <div style="margin-top:${z(2.5)}mm;font-size:${z(2.5)}mm;letter-spacing:${z(0.6)}mm;color:${t.muted}">PLEASE TURN OVER TO RSVP</div>
      </div>`
    : `<div style="margin-top:auto;padding-top:${z(3)}mm;display:flex;flex-direction:column;align-items:center">
        <div style="margin-top:${z(1)}mm;width:${z(22)}mm;height:${z(22)}mm">${o.qrSvg}</div>
        <div style="margin-top:${z(2)}mm;font-size:${z(3)}mm;letter-spacing:${z(0.5)}mm;color:${t.ink};font-weight:500">SCAN TO RSVP</div>
        ${o.respondBy ? `<div style="margin-top:${z(1)}mm;font-size:${z(2.7)}mm;color:${t.soft}">Please respond on or before <b style="color:${t.ink}">${esc(o.respondBy)}</b></div>` : ''}
        <div style="margin-top:${z(0.8)}mm;word-break:break-all;color:${t.muted};font-size:${z(2.2)}mm">${esc(o.shortLink)}</div>
      </div>`
  const inner = `<div style="box-sizing:border-box;width:${base.w}mm;height:${base.h}mm;background:${t.paper};color:${t.ink};font-family:${t.sans};position:relative">
    ${t.frame === false ? '' : svgBox(base.w, base.h, frameSvg(style, 4.5, 4.5, base.w - 9, base.h - 9, c), 'position:absolute;left:0;top:0;pointer-events:none')}
    <div data-card-body style="position:absolute;left:${area.side}mm;right:${area.side}mm;top:${area.top}mm;bottom:${area.bottom}mm;overflow:hidden;display:flex;flex-direction:column">
    <div data-card-content style="flex:1 0 auto;display:flex;flex-direction:column;align-items:center;text-align:center;overflow-wrap:anywhere">
    <div style="margin-top:${z(1)}mm">${svgBox(z(36), z(16), babyArtSvg(style, 18 * f, 7 * f, 34 * f, c))}</div>
    <div style="margin-top:${z(2)}mm;font-size:${z(2.6)}mm;letter-spacing:${z(ty.eyebrowTracking)}mm;color:${t.accent}">PLEASE JOIN US FOR A BABY SHOWER FOR</div>
    <div style="margin-top:${z(3.5)}mm;font-family:${t.serif};font-size:${z(12 * ty.namesScale)}mm;line-height:1.02;font-weight:${ty.namesWeight};letter-spacing:${ty.namesTracking}">${baby}</div>
    ${o.arriving ? `<div style="margin-top:${z(2)}mm;font-size:${z(2.5)}mm;letter-spacing:${z(0.6)}mm;color:${t.muted}">${esc(o.arriving.toUpperCase())}</div>` : ''}
    ${hosts ? `<div style="margin-top:${z(2.6)}mm;font-family:${t.serif};font-style:italic;font-size:${z(4.2)}mm;color:${t.soft}">hosted by ${hosts}</div>` : ''}
    <div style="margin-top:${z(3)}mm">${svgBox(z(40), z(8), ornamentSvg(style, 20 * f, 4.5 * f, 38 * f, c))}</div>
    <div style="${centred ? 'margin:auto 0;padding-top:' + z(3) + 'mm;' : ''}display:flex;flex-direction:column;align-items:center">
    <div style="margin-top:${z(centred ? 0 : 3.5)}mm;font-size:${z(2.6)}mm;letter-spacing:${z(0.6)}mm;color:${t.muted}">DEAR</div>
    <div style="margin-top:${z(1.5)}mm;font-family:${t.serif};font-size:${z(7)}mm;line-height:1.1">${nameLinesHtml(o.guestName, t, z)}</div>
    ${o.position ? `<div style="margin-top:${z(1.4)}mm;font-size:${z(2.7)}mm;letter-spacing:${z(0.7)}mm;color:${t.accent};font-weight:500">${esc(o.position.toUpperCase())}</div>` : ''}
    ${o.withNames.length ? `<div style="margin-top:${z(1.5)}mm;font-family:${t.serif};font-style:italic;font-size:${z(4)}mm;line-height:1.3;color:${t.soft}">and ${esc(joinNames(o.withNames))}</div>` : ''}
    <div style="margin-top:${z(4.5)}mm;font-size:${z(3.5)}mm;letter-spacing:${z(0.9)}mm;font-weight:500">${esc(o.dateText.toUpperCase())}</div>
    ${o.ceremony ? `<div style="margin-top:${z(2.6)}mm;font-size:${z(3.1)}mm;line-height:1.45;color:${t.soft}"><span style="letter-spacing:${z(0.4)}mm;color:${t.accent}">VENUE</span><br/>${o.ceremonyMarked ? markedHtml(o.ceremony, t) : esc(o.ceremony)}</div>` : ''}
    ${o.detailsNote && !o.ceremony ? `<div style="margin-top:${z(3.5)}mm;max-width:${z(80)}mm;font-family:${t.serif};font-style:italic;font-size:${z(3.6)}mm;line-height:1.4;color:${t.soft}">${esc(o.detailsNote)}</div>` : ''}
    </div>
    ${bottom}
    </div></div>
  </div>`
  return sized(inner, o.size)
}

export interface CardBackOptions {
  coupleNames: string
  dateText: string
  monogram: string
  /** The uploaded monogram, used instead of the initials when set. */
  monogramArt?: MonogramArt | null
  theme: PrintTheme
  size: CardSize
  /** Personal RSVP QR — when given, the RSVP block is printed on the back. */
  qrSvg?: string
  respondBy?: string | null
  shortLink?: string
  /** Small "Personal QR for …" line, so each back can be matched to its front. */
  guestName?: string
  /** Website Settings sections to print under "Good to know". */
  sections?: { title: string; body: string; bold?: boolean; /** body has print marks */ marked?: boolean }[]
  /** Monogram crest, names and date (each can be left off). */
  show?: Partial<OurDetails>
  fit?: number
}

/**
 * Back of an invitation card: monogram crest, then (optionally) the RSVP QR
 * and the shower details. Frameless and centred, so a millimetre or two of
 * printer drift when printing the reverse doesn't show.
 */
export function invitationBackHtml(o: CardBackOptions): string {
  const t = safe(o.theme)
  const base = CARD_SIZES['5x7']
  const style = t.style ?? 'classic'
  const ty = styleType(style)
  const c = { ink: t.ink, accent: t.accent, accentLight: t.paper, paper: t.paper, line: t.line, serif: t.serif, onColour: t.onColour }
  const f = Math.max(MIN_CARD_FIT, Math.min(1, o.fit ?? 1))
  const z = (v: number) => r2(v * f)
  const rsvp = Boolean(o.qrSvg)
  const sections = (o.sections ?? []).filter((x) => x.title.trim() || x.body.trim())
  const busy = rsvp || sections.length > 0
  const crestBox = busy ? 22 : 40
  const crest = sealSvg(style, 20, 20, style === 'deco' ? 11 : 12, o.monogram, c, esc, o.monogramArt)
  const names = ty.namesCase === 'uppercase' ? o.coupleNames.toUpperCase() : o.coupleNames
  const eyebrow = (text: string, mt: number) =>
    `<div style="margin-top:${z(mt)}mm;font-size:${z(2.5)}mm;letter-spacing:${z(ty.eyebrowTracking * 0.8)}mm;color:${t.accent}">${text}</div>`
  const divider = (mt: number) => `<div style="margin-top:${z(mt)}mm">${svgBox(z(30), z(6), ornamentSvg(style, 15 * f, 3 * f, 24 * f, c))}</div>`

  const show = { ...ALL_DETAILS, ...(o.show ?? {}) }
  const parts: string[] = ['<div style="margin-top:auto"></div>']
  if (show.monogram)
    parts.push(`<div><svg xmlns="http://www.w3.org/2000/svg" width="${z(crestBox)}mm" height="${z(crestBox)}mm" viewBox="0 0 40 40" style="display:block">${crest}</svg></div>`)
  if (show.names)
    parts.push(`<div style="margin-top:${z(show.monogram ? (busy ? 2.5 : 4) : 0)}mm;font-family:${t.serif};font-size:${z(busy ? 4.4 : 5)}mm;color:${t.ink};letter-spacing:${ty.namesTracking}">${coupleHtml(names, t)}</div>`)
  if (!busy && (show.monogram || show.names) && show.date) parts.push(divider(2.5))
  if (show.date) parts.push(`<div style="margin-top:${z(busy ? 1.2 : 2)}mm;font-size:${z(2.5)}mm;letter-spacing:${z(0.8)}mm;color:${t.accent}">${esc(o.dateText.toUpperCase())}</div>`)
  if (rsvp && sections.length) {
    // Compact: QR on the left, the RSVP words beside it — leaves room for the details below.
    parts.push(divider(3.5))
    parts.push(`<div style="margin-top:${z(3)}mm;display:flex;align-items:center;gap:${z(4)}mm;text-align:left">
      <div style="flex:none;width:${z(25)}mm;height:${z(25)}mm">${o.qrSvg}</div>
      <div style="min-width:0">
        <div style="font-size:${z(2.5)}mm;letter-spacing:${z(ty.eyebrowTracking * 0.8)}mm;color:${t.accent}">KINDLY RSVP</div>
        <div style="margin-top:${z(1.2)}mm;font-size:${z(3)}mm;letter-spacing:${z(0.4)}mm;color:${t.ink};font-weight:500">SCAN TO RSVP</div>
        ${o.respondBy ? `<div style="margin-top:${z(1)}mm;font-size:${z(2.6)}mm;line-height:1.35;color:${t.soft}">Please respond on or before<br/><b style="color:${t.ink}">${esc(o.respondBy)}</b></div>` : ''}
        ${o.shortLink ? `<div style="margin-top:${z(1)}mm;word-break:break-all;color:${t.muted};font-size:${z(2.1)}mm">${esc(o.shortLink)}</div>` : ''}
        ${o.guestName ? `<div style="margin-top:${z(1)}mm;color:${t.muted};font-size:${z(2.1)}mm;font-style:italic">Personal QR for ${esc(o.guestName)}</div>` : ''}
      </div>
    </div>`)
  } else if (rsvp) {
    parts.push(divider(4))
    parts.push(eyebrow('KINDLY RSVP', 3))
    parts.push(`<div style="margin-top:${z(3)}mm;width:${z(30)}mm;height:${z(30)}mm">${o.qrSvg}</div>`)
    parts.push(`<div style="margin-top:${z(2)}mm;font-size:${z(3)}mm;letter-spacing:${z(0.5)}mm;color:${t.ink};font-weight:500">SCAN TO RSVP</div>`)
    if (o.respondBy) parts.push(`<div style="margin-top:${z(1)}mm;font-size:${z(2.7)}mm;color:${t.soft}">Please respond on or before <b style="color:${t.ink}">${esc(o.respondBy)}</b></div>`)
    if (o.shortLink) parts.push(`<div style="margin-top:${z(0.8)}mm;word-break:break-all;color:${t.muted};font-size:${z(2.2)}mm">${esc(o.shortLink)}</div>`)
    if (o.guestName) parts.push(`<div style="margin-top:${z(0.8)}mm;color:${t.muted};font-size:${z(2.1)}mm;font-style:italic">Personal QR for ${esc(o.guestName)}</div>`)
  }
  if (sections.length) {
    parts.push(divider(rsvp ? 4.5 : 4))
    parts.push(eyebrow('GOOD TO KNOW', 2.5))
    for (const sec of sections) {
      parts.push(`<div style="margin-top:${z(2.8)}mm;font-family:${t.serif};font-size:${z(3.9)}mm;line-height:1.15;color:${t.ink}${sec.bold ? ';font-weight:700' : ''}">${esc(sec.title)}</div>`)
      const paras = sec.body.split(/\n+/).map((p) => p.trim()).filter(Boolean)
      for (const [i, para] of paras.entries()) {
        parts.push(`<div style="margin-top:${z(i ? 1 : 1.2)}mm;font-size:${z(2.6)}mm;line-height:1.4;color:${t.soft};max-width:${z(100)}mm">${sec.marked ? markedHtml(para, t) : esc(para)}</div>`)
      }
    }
  }
  parts.push('<div style="margin-bottom:auto"></div>')

  const inner = `<div style="box-sizing:border-box;width:${base.w}mm;height:${base.h}mm;background:${t.paper};color:${t.ink};font-family:${t.sans};position:relative">
    <div data-card-body style="position:absolute;left:11mm;right:11mm;top:10mm;bottom:10mm;overflow:hidden;display:flex;flex-direction:column">
    <div data-card-content style="flex:1 0 auto;display:flex;flex-direction:column;align-items:center;text-align:center;overflow-wrap:anywhere">
    ${parts.join('\n')}
    </div></div>
  </div>`
  return sized(inner, o.size)
}

/** Thin corner crop marks around a card placed at (x, y) on a sheet (all mm). */
export function cropMarksSvg(sheetW: number, sheetH: number, cards: { x: number; y: number; w: number; h: number }[], color: string): string {
  const m = 4
  const g = 1.5
  const lines = cards
    .flatMap(({ x, y, w, h }) =>
      [
        [x, y],
        [x + w, y],
        [x, y + h],
        [x + w, y + h],
      ].flatMap(([cx, cy]) => {
        const sx = cx === x ? -1 : 1
        const sy = cy === y ? -1 : 1
        return [
          `<line x1="${cx + sx * g}" y1="${cy}" x2="${cx + sx * (g + m)}" y2="${cy}"/>`,
          `<line x1="${cx}" y1="${cy + sy * g}" x2="${cx}" y2="${cy + sy * (g + m)}"/>`,
        ]
      }),
    )
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}mm" height="${sheetH}mm" viewBox="0 0 ${sheetW} ${sheetH}" style="position:absolute;inset:0;pointer-events:none"><g stroke="${color}" stroke-width="0.2">${lines}</g></svg>`
}

/** Positions for n equal cards centred on a sheet with a gap between them. */
export function layoutRow(sheetW: number, sheetH: number, n: number, w: number, h: number, gap = 12): { x: number; y: number; w: number; h: number }[] {
  const total = n * w + (n - 1) * gap
  const x0 = (sheetW - total) / 2
  const y = (sheetH - h) / 2
  return Array.from({ length: n }, (_, i) => ({ x: x0 + i * (w + gap), y, w, h }))
}

/**
 * A printed back, moved by the measured line-up offset (mm; + = right / down as you look at
 * the back) — turned upside-down first when asked.
 */
export function placeBack(inner: string, o: { dx: number; dy: number; rotate?: boolean }): string {
  let html = o.rotate ? `<div style="position:absolute;inset:0;transform:rotate(180deg)">${inner}</div>` : inner
  if (o.dx || o.dy) html = `<div style="position:absolute;inset:0;transform:translate(${r2(o.dx)}mm,${r2(o.dy)}mm)">${html}</div>`
  return html
}

/** Paper as you measured it (mm, short side × long side). */
export interface PaperMeasured {
  w: number
  h: number
}

/** How far to move everything (mm) so the design is centred on paper that isn't exactly its stated size. */
export function paperCentring(paper: Paper, measured: PaperMeasured | undefined, portrait = false): { x: number; y: number } {
  if (!measured) return { x: 0, y: 0 }
  const s = SHEETS[paper]
  const clamp = (v: number) => Math.max(-10, Math.min(10, v))
  const dShort = clamp(measured.w - s.h) / 2
  const dLong = clamp(measured.h - s.w) / 2
  return portrait ? { x: r2(dShort), y: r2(dLong) } : { x: r2(dLong), y: r2(dShort) }
}

/** "Print at 100%" check: a 50 mm bar in the sheet's corner. */
export function calibrationHtml(theme: PrintTheme): string {
  const t = safe(theme)
  return `<div style="position:absolute;left:8mm;bottom:5mm;display:flex;align-items:center;gap:2mm;font-family:${t.sans};font-size:2.2mm;color:${t.muted}">
    <div style="width:50mm;height:1.6mm;border:0.2mm solid ${t.muted};border-top:none"></div>
    <span>Print at 100% (Actual size) — this bar should measure 5 cm</span>
  </div>`
}

/**
 * Orientation label printed in the sheet margin on both sides, so the
 * reverse is fed the right way round ("▲ TOP" edges must match).
 */
export function orientationMarkHtml(side: 'front' | 'back', sheetNo: number, total: number, theme: PrintTheme): string {
  const t = safe(theme)
  const label = side === 'front' ? 'FRONT' : 'BACK'
  return `<div style="position:absolute;left:0;right:0;top:3.5mm;display:flex;justify-content:center;font-family:${t.sans};font-size:2.6mm;letter-spacing:0.5mm;color:${t.muted}">
      <span style="border:0.25mm solid ${t.muted};border-radius:1mm;padding:0.6mm 2mm">▲ TOP EDGE &nbsp;·&nbsp; ${label} &nbsp;·&nbsp; SHEET ${sheetNo} OF ${total}</span>
    </div>
    ${
      side === 'back'
        ? `<div style="position:absolute;left:0;right:0;bottom:3.5mm;text-align:center;font-family:${t.sans};font-size:2.3mm;color:${t.muted}">Print on the reverse of FRONT sheet ${sheetNo}. Both “▲ TOP EDGE” labels should be on the same edge of the paper.</div>`
        : ''
    }`
}

// ---------------------------------------------------------------- QR poster (A2 portrait)

export type PosterSize = 'a1' | 'a2' | 'a3'
export const POSTER_SIZES: Record<PosterSize, { w: number; h: number; label: string }> = {
  a1: { w: 594, h: 841, label: 'A1 (594 × 841 mm)' },
  a2: { w: 420, h: 594, label: 'A2 (420 × 594 mm)' },
  a3: { w: 297, h: 420, label: 'A3 (297 × 420 mm)' },
}

export interface PosterQr {
  title: string
  caption: string
  svg: string
}

export interface PosterOptions {
  coupleNames: string
  dateText: string
  venue: string
  headline: string
  qrs: PosterQr[]
  theme: PrintTheme
  size: PosterSize
}

/** One welcome-sign layout with up to three QR codes, designed at A2 and scaled for A1 / A3. */
export function posterHtml(o: PosterOptions): string {
  const t = safe(o.theme)
  const base = POSTER_SIZES.a2
  const size = POSTER_SIZES[o.size]
  const k = size.w / base.w
  const n = Math.max(1, o.qrs.length)
  const qrSize = n === 1 ? 170 : n === 2 ? 135 : 104
  const style = t.style ?? 'classic'
  const c = { ink: t.ink, accent: t.accent, accentLight: t.accentLight, paper: t.paper, line: t.line, serif: t.serif, onColour: t.onColour }
  const ty = styleType(style)
  // Ornament drawn at card scale and enlarged ×2.6 for the poster.
  const ornament = (w: number) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${2 * w + 10}mm" height="${8 * 2.6}mm" viewBox="0 0 ${(2 * w + 10) / 2.6} 8" style="display:block;margin:0 auto">${ornamentSvg(style, (2 * w + 10) / 5.2, 4.5, (2 * w) / 2.6, c)}</svg>`
  const inner = `<div style="box-sizing:border-box;width:${base.w}mm;height:${base.h}mm;background:${t.paper};color:${t.ink};font-family:${t.sans};position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;padding:40mm 24mm 30mm">
    <svg xmlns="http://www.w3.org/2000/svg" width="${base.w}mm" height="${base.h}mm" viewBox="0 0 ${base.w / 2.6} ${base.h / 2.6}" style="position:absolute;left:0;top:0;pointer-events:none">${t.frame === false ? '' : frameSvg(style, 12 / 2.6, 12 / 2.6, (base.w - 24) / 2.6, (base.h - 24) / 2.6, c)}</svg>
    <div style="font-size:9mm;letter-spacing:${ty.eyebrowTracking * 3.3}mm;color:${t.accent};position:relative">${esc(o.headline.toUpperCase())}</div>
    <div style="margin-top:12mm;font-family:${t.serif};font-size:${r2(Math.min(46, 900 / Math.max(10, o.coupleNames.length)) * ty.namesScale)}mm;line-height:1;font-weight:${ty.namesWeight};letter-spacing:${ty.namesCase === 'uppercase' ? '3mm' : '0'};position:relative">${coupleHtml(ty.namesCase === 'uppercase' ? o.coupleNames.toUpperCase() : o.coupleNames, t)}</div>
    <div style="margin-top:12mm;font-size:9mm;letter-spacing:2.4mm;color:${t.ink}">${esc(o.dateText.toUpperCase())}</div>
    ${o.venue ? `<div style="margin-top:4mm;font-family:${t.serif};font-style:italic;font-size:9mm;color:${t.soft}">${esc(o.venue)}</div>` : ''}
    <div style="margin-top:16mm">${ornament(40)}</div>
    <div style="margin-top:auto;margin-bottom:auto;display:flex;justify-content:center;gap:${n === 3 ? 10 : 30}mm;width:100%">
      ${o.qrs
        .map(
          (q, i) => `<div style="flex:0 0 ${qrSize + 8}mm;display:flex;flex-direction:column;align-items:center">
            <div style="width:12mm;height:12mm;border-radius:50%;background:${t.accent};color:${t.paper};font-size:6.5mm;font-weight:600;display:flex;align-items:center;justify-content:center">${i + 1}</div>
            <div style="margin-top:4mm;font-family:${t.serif};font-size:${n === 3 ? 11 : 13}mm;line-height:1.05">${esc(q.title)}</div>
            <div style="margin-top:3mm;font-size:${n === 3 ? 5.6 : 6.2}mm;line-height:1.35;color:${t.soft};min-height:${n === 3 ? 14 : 0}mm">${esc(q.caption)}</div>
            <div style="margin-top:6mm;background:#fff;padding:4mm;border:0.6mm solid ${t.line};border-radius:3mm"><div style="width:${qrSize}mm;height:${qrSize}mm">${q.svg}</div></div>
          </div>`,
        )
        .join('')}
    </div>
    <div style="margin-top:14mm;font-size:6.5mm;letter-spacing:1.6mm;color:${t.muted}">SCAN WITH YOUR PHONE CAMERA</div>
  </div>`
  if (k === 1) return inner
  return `<div style="width:${size.w}mm;height:${size.h}mm;overflow:hidden"><div style="transform:scale(${k});transform-origin:top left">${inner}</div></div>`
}

// ---------------------------------------------------------------- attire guide (insert cards)

export interface AttirePhoto {
  url: string
  label: string
  /** Small caps above the label, e.g. "PRINCIPAL SPONSORS" (optional). */
  tag?: string
}
export type AttireItem = { kind: 'pair'; a: AttirePhoto; b: AttirePhoto } | { kind: 'single'; photo: AttirePhoto }

/** "Please refrain from wearing …" — a highlighted note at the bottom of the attire guide. */
export interface AttireAvoid {
  title: string
  items: string[]
}

/** "Slippers, Sando\nShorts" → ["Slippers", "Sando", "Shorts"] (one per line or comma-separated). */
export function avoidItems(text: string): string[] {
  return text
    .split(/[\n,;]+/)
    .map((x) => x.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 12)
}

/** Height (mm) the note takes, to make room for it. */
function avoidHeight(a: AttireAvoid, width: number): number {
  const text = a.items.join(' · ')
  const lines = Math.max(1, Math.ceil((text.length * 1.42) / Math.max(30, width - 8)))
  return 3 + 2.2 + 3.4 + lines * 3.6 + 2.2
}

function avoidHtml(a: AttireAvoid, t: PrintTheme): string {
  const cross = `<svg xmlns="http://www.w3.org/2000/svg" width="3.2mm" height="3.2mm" viewBox="0 0 10 10" style="flex:none"><circle cx="5" cy="5" r="4.4" fill="none" stroke="${t.accent}" stroke-width="0.9"/><path d="M3.3 3.3l3.4 3.4M6.7 3.3l-3.4 3.4" stroke="${t.accent}" stroke-width="0.9" stroke-linecap="round"/></svg>`
  const dot = `<span style="color:${t.accent};padding:0 1.4mm">·</span>`
  return `<div data-attire-avoid style="margin-top:3mm;width:100%;box-sizing:border-box;padding:2.2mm 3mm;border:0.35mm solid ${t.accent};border-radius:1.6mm;background:${t.accentLight}">
      <div style="display:flex;align-items:center;justify-content:center;gap:1.4mm;font-size:2.3mm;letter-spacing:0.5mm;font-weight:600;color:${t.accent}">${cross}${esc(a.title.toUpperCase())}</div>
      <div style="margin-top:1.2mm;font-size:2.6mm;line-height:1.38;font-weight:500;color:${t.ink}">${a.items.map((x) => esc(x)).join(dot)}</div>
    </div>`
}

export interface AttireCardOptions {
  title: string
  /** First card only: the motif colours and a short note. */
  motifTitle?: string
  swatches?: { name: string; hex: string }[]
  note?: string
  items: AttireItem[]
  page: number
  pages: number
  /** "Please refrain from wearing …" at the bottom (the last card). */
  avoid?: AttireAvoid
  theme: PrintTheme
  size: CardSize
}

/**
 * Splits outfits into cards: pairs (a gentleman's and a lady's look, by upload
 * order) first, then any photo without a partner on its own. The first card
 * also carries the motif, so it holds one look; the others hold two.
 */
export function attirePages(male: AttirePhoto[], female: AttirePhoto[], withMotif: boolean): AttireItem[][] {
  const items: AttireItem[] = []
  const n = Math.max(male.length, female.length)
  const singles: AttireItem[] = []
  for (let i = 0; i < n; i++) {
    if (male[i] && female[i]) items.push({ kind: 'pair', a: male[i], b: female[i] })
    else if (male[i]) singles.push({ kind: 'single', photo: male[i] })
    else if (female[i]) singles.push({ kind: 'single', photo: female[i] })
  }
  items.push(...singles)
  const pages: AttireItem[][] = []
  let rest = items
  const firstCap = withMotif ? 1 : 2
  pages.push(rest.slice(0, firstCap))
  rest = rest.slice(firstCap)
  while (rest.length) {
    pages.push(rest.slice(0, 2))
    rest = rest.slice(2)
  }
  return pages
}

/** The white print-style frame around an attire photo; on coloured paper just a fine line (no ink for the white or the shadow). */
function photoFrame(t: PrintTheme, y: number, blur: number, alpha: number): string {
  return t.onColour ? `background:transparent;box-shadow:inset 0 0 0 0.25mm ${t.line}` : `background:#fff;box-shadow:0 ${y}mm ${blur}mm rgba(0,0,0,${alpha})`
}

function photoHtml(p: AttirePhoto, w: number, h: number, t: PrintTheme, css: string): string {
  return `<div style="position:absolute;${css};width:${r2(w)}mm;padding:1.6mm 1.6mm 0;${photoFrame(t, 0.5, 1.6, 0.28)};box-sizing:content-box">
    <div style="width:${r2(w)}mm;height:${r2(h)}mm;overflow:hidden;background:#eee"><img src="${esc(p.url)}" alt="" style="display:block;width:100%;height:100%;object-fit:cover" /></div>
    ${
      p.tag
        ? `<div style="height:8.6mm;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden">
        <div style="font-size:1.75mm;letter-spacing:0.38mm;color:${t.accent};font-weight:500;white-space:nowrap">${esc(p.tag.toUpperCase())}</div>
        <div style="margin-top:0.5mm;font-family:${t.serif};font-style:italic;font-size:2.5mm;color:${t.soft};white-space:nowrap">${esc(p.label)}</div>
      </div>`
        : `<div style="height:5.5mm;display:flex;align-items:center;justify-content:center;font-family:${t.serif};font-style:italic;font-size:2.6mm;color:${t.soft};white-space:nowrap;overflow:hidden">${esc(p.label)}</div>`
    }
  </div>`
}

/** One attire-guide insert card, designed at 5×7 in and scaled for 4×6. */
export function attireCardHtml(o: AttireCardOptions): string {
  const t = safe(o.theme)
  const base = CARD_SIZES['5x7']
  const style = t.style ?? 'classic'
  const ty = styleType(style)
  const c = { ink: t.ink, accent: t.accent, accentLight: t.accentLight, paper: t.paper, line: t.line, serif: t.serif, onColour: t.onColour }
  const area = cardSafeArea(style)
  const motif = Boolean(o.swatches?.length || o.note)
  const avoid = o.avoid?.items.length ? o.avoid : null
  const avoidH = avoid ? avoidHeight(avoid, base.w - 2 * area.side) : 0
  // Fewer than the full slots of photos when the note needs the room.
  const slotH = Math.max(36, (o.items.length === 1 ? (motif ? 74 : 104) : 62) - (o.items.length ? avoidH / o.items.length : 0))

  const item = (it: AttireItem) => {
    // A label adds a line under the photo: keep the frame inside its slot.
    const tagged = it.kind === 'pair' ? Boolean(it.a.tag || it.b.tag) : Boolean(it.photo.tag)
    let ph = slotH - (tagged ? 12 : 9)
    let pw = ph * 0.74
    // A pair stands side by side, overlapping only a little, so both labels read in full:
    // two frames (photo + 1.6 mm border each side) minus the overlap fit the card's width.
    const OVERLAP = 5
    if (it.kind === 'pair') {
      const maxW = (base.w - 2 * area.side + OVERLAP) / 2 - 3.2
      if (pw > maxW) {
        pw = maxW
        ph = pw / 0.74
      }
    }
    const frame = pw + 3.2
    const inner =
      it.kind === 'pair'
        ? photoHtml(it.a, pw, ph, t, `left:calc(50% - ${r2(frame - OVERLAP / 2)}mm);top:1mm;transform:rotate(-3deg)`) +
          photoHtml(it.b, pw, ph, t, `left:calc(50% - ${r2(OVERLAP / 2)}mm);top:2.5mm;transform:rotate(2.5deg)`)
        : photoHtml(it.photo, pw, ph, t, `left:calc(50% - ${r2(pw / 2 + 1.6)}mm);top:1.5mm;transform:rotate(-2deg)`)
    return `<div style="position:relative;width:100%;height:${slotH}mm;margin-top:3mm">${inner}</div>`
  }

  const swatches = o.swatches?.length
    ? `<div style="margin-top:2.5mm;display:flex;flex-wrap:wrap;justify-content:center;gap:2.5mm 3.5mm">${o.swatches
        .slice(0, 8)
        .map(
          (s) =>
            `<div style="display:flex;flex-direction:column;align-items:center;width:13mm"><div style="width:9mm;height:9mm;border-radius:50%;background:${esc(s.hex)};box-shadow:inset 0 0 0 0.25mm rgba(0,0,0,0.15)"></div><div style="margin-top:1mm;font-size:2.1mm;line-height:1.15;color:${t.soft};text-align:center">${esc(s.name)}</div></div>`,
        )
        .join('')}</div>`
    : ''

  const inner = `<div style="box-sizing:border-box;width:${base.w}mm;height:${base.h}mm;background:${t.paper};color:${t.ink};font-family:${t.sans};position:relative">
    ${t.frame === false ? '' : svgBox(base.w, base.h, frameSvg(style, 4.5, 4.5, base.w - 9, base.h - 9, c), 'position:absolute;left:0;top:0;pointer-events:none')}
    <div style="position:absolute;left:${area.side}mm;right:${area.side}mm;top:${area.top}mm;bottom:${area.bottom}mm;display:flex;flex-direction:column;align-items:center;text-align:center;overflow:hidden">
      <div style="margin-top:2mm;font-size:2.6mm;letter-spacing:${ty.eyebrowTracking}mm;color:${t.accent}">ATTIRE GUIDE</div>
      <div style="margin-top:2mm;font-family:${t.serif};font-size:7mm;line-height:1.1">${esc(o.title)}</div>
      ${svgBox(40, 7, ornamentSvg(style, 20, 3.5, 32, c), 'margin-top:1.5mm')}
      ${o.motifTitle && o.swatches?.length ? `<div style="margin-top:1.5mm;font-family:${t.serif};font-style:italic;font-size:3.6mm;color:${t.soft}">${esc(o.motifTitle)}</div>` : ''}
      ${swatches}
      ${o.note ? `<div style="margin-top:2.5mm;font-size:2.6mm;color:${t.ink};font-weight:500">${esc(o.note)}</div>` : ''}
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;width:100%">${o.items.map(item).join('')}</div>
      ${avoid ? avoidHtml(avoid, t) : ''}
      ${o.pages > 1 ? `<div style="margin-top:1mm;font-size:2.2mm;letter-spacing:0.4mm;color:${t.muted}">${o.page} / ${o.pages}</div>` : ''}
    </div>
  </div>`
  return sized(inner, o.size)
}

// ---------------------------------------------------------------- attire guide on one card

export interface AttireOneCardOptions {
  title: string
  motifTitle?: string
  swatches?: { name: string; hex: string }[]
  note?: string
  /** Looks in columns: him above her (by their order in Outfit Gallery). */
  male: AttirePhoto[]
  female: AttirePhoto[]
  /** "Please refrain from wearing …" at the bottom. */
  avoid?: AttireAvoid
  theme: PrintTheme
  size: CardSize
}

/**
 * The whole attire guide on a single card: the motif on top, then one column
 * per look — the label once at the top (e.g. "PRINCIPAL SPONSORS"), the
 * gentleman's look above the lady's, each with its caption. Photos size
 * themselves to fill the card; more than three looks wrap onto a second row.
 */
export function attireOneCardHtml(o: AttireOneCardOptions): string {
  const t = safe(o.theme)
  const base = CARD_SIZES['5x7']
  const style = t.style ?? 'classic'
  const ty = styleType(style)
  const c = { ink: t.ink, accent: t.accent, accentLight: t.accentLight, paper: t.paper, line: t.line, serif: t.serif, onColour: t.onColour }
  const area = cardSafeArea(style)
  const innerW = base.w - 2 * area.side
  const innerH = base.h - area.top - area.bottom

  const n = Math.max(o.male.length, o.female.length)
  // Up to four looks in one row; more wrap into two rows.
  const perRow = n <= 4 ? Math.max(n, 1) : Math.ceil(n / 2)
  const rows = Math.max(1, Math.ceil(n / perRow))
  // Narrow columns: labels may need two lines.
  const HDR = perRow >= 4 ? 6.2 : 4.2
  const swatches = (o.swatches ?? []).slice(0, 8)
  const swatchRows = swatches.length ? Math.ceil(swatches.length / 6) : 0

  // Heights (mm): header, motif, then the looks share what's left.
  const headerH = 24
  const motifH = (o.motifTitle && swatches.length ? 5.5 : 0) + (swatchRows ? 2.5 + swatchRows * 15 + (swatchRows - 1) * 2.5 : 0) + (o.note ? 5.5 : 0)
  const COL_GAP = perRow >= 4 ? 3 : 4
  const CAPTION = 7.2 // up to two lines of caption under each photo
  const PAD = 1.4
  const avoid = o.avoid?.items.length ? o.avoid : null
  const avoidH = avoid ? avoidHeight(avoid, innerW) : 0
  const avail = innerH - headerH - motifH - avoidH - 2
  const phByHeight = (avail / rows - (HDR + 2 * (2 * PAD + CAPTION) + 2.2 + 3.5)) / 2
  const colW = (innerW - (perRow - 1) * COL_GAP) / perRow
  const phByWidth = (colW - 2 * PAD) / 0.75
  const ph = Math.max(18, Math.min(phByHeight, phByWidth, 62))
  const pw = ph * 0.75

  const frame = (p: AttirePhoto | undefined) =>
    p
      ? `<div style="width:${r2(pw + 2 * PAD)}mm;margin:0 auto;padding:${PAD}mm ${PAD}mm 0;box-sizing:border-box;${photoFrame(t, 0.35, 1.2, 0.22)}">
          <div style="width:100%;height:${r2(ph)}mm;overflow:hidden;background:#f1ece3"><img src="${esc(p.url)}" alt="" style="display:block;width:100%;height:100%;object-fit:cover" /></div>
          <div style="height:${CAPTION}mm;display:flex;align-items:center;justify-content:center;padding:0 0.6mm;font-family:${t.serif};font-style:italic;font-size:2.25mm;line-height:1.15;color:${t.soft};text-align:center;overflow:hidden">${esc(p.label)}</div>
        </div>`
      : `<div style="height:${r2(ph + 2 * PAD + CAPTION)}mm"></div>`

  const column = (i: number) => {
    const a = o.male[i]
    const b = o.female[i]
    const tags = [a?.tag, b?.tag].filter((x): x is string => Boolean(x && x.trim()))
    const label = tags.length === 2 && tags[0].trim().toLowerCase() !== tags[1].trim().toLowerCase() ? `${tags[0]} · ${tags[1]}` : (tags[0] ?? '')
    return `<div style="width:${r2(colW)}mm;min-width:0;display:flex;flex-direction:column;align-items:center">
      <div style="height:${HDR}mm;display:flex;align-items:flex-end;justify-content:center;padding-bottom:0.8mm;box-sizing:border-box;font-size:1.95mm;line-height:1.25;letter-spacing:0.36mm;color:${t.accent};font-weight:500;overflow:hidden">${esc(label.toUpperCase())}</div>
      ${frame(a)}
      <div style="height:2.2mm"></div>
      ${frame(b)}
    </div>`
  }

  const rowsHtml: string[] = []
  for (let r = 0; r < rows; r++) {
    const cols = Array.from({ length: Math.min(perRow, n - r * perRow) }, (_, k) => column(r * perRow + k))
    rowsHtml.push(`<div style="display:flex;justify-content:center;gap:${COL_GAP}mm;margin-top:${r ? 3.5 : 0}mm">${cols.join('')}</div>`)
  }

  const swatchHtml = swatches.length
    ? `<div style="margin-top:2.5mm;display:flex;flex-wrap:wrap;justify-content:center;gap:2.5mm 3.5mm">${swatches
        .map(
          (s) =>
            `<div style="display:flex;flex-direction:column;align-items:center;width:13mm"><div style="width:9mm;height:9mm;border-radius:50%;background:${esc(s.hex)};box-shadow:inset 0 0 0 0.25mm rgba(0,0,0,0.15)"></div><div style="margin-top:1mm;font-size:2.1mm;line-height:1.15;color:${t.soft};text-align:center">${esc(s.name)}</div></div>`,
        )
        .join('')}</div>`
    : ''

  const inner = `<div style="box-sizing:border-box;width:${base.w}mm;height:${base.h}mm;background:${t.paper};color:${t.ink};font-family:${t.sans};position:relative">
    ${t.frame === false ? '' : svgBox(base.w, base.h, frameSvg(style, 4.5, 4.5, base.w - 9, base.h - 9, c), 'position:absolute;left:0;top:0;pointer-events:none')}
    <div style="position:absolute;left:${area.side}mm;right:${area.side}mm;top:${area.top}mm;bottom:${area.bottom}mm;display:flex;flex-direction:column;align-items:center;text-align:center;overflow:hidden">
      <div style="margin-top:2mm;font-size:2.6mm;letter-spacing:${ty.eyebrowTracking}mm;color:${t.accent}">ATTIRE GUIDE</div>
      <div style="margin-top:2mm;font-family:${t.serif};font-size:7mm;line-height:1.1">${esc(o.title)}</div>
      ${svgBox(40, 7, ornamentSvg(style, 20, 3.5, 32, c), 'margin-top:1.5mm')}
      ${o.motifTitle && swatches.length ? `<div style="margin-top:1.5mm;font-family:${t.serif};font-style:italic;font-size:3.6mm;color:${t.soft}">${esc(o.motifTitle)}</div>` : ''}
      ${swatchHtml}
      ${o.note ? `<div style="margin-top:2.5mm;font-size:2.6mm;color:${t.ink};font-weight:500">${esc(o.note)}</div>` : ''}
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;width:100%;margin-top:2mm">${rowsHtml.join('')}</div>
      ${avoid ? avoidHtml(avoid, t) : ''}
    </div>
  </div>`
  return sized(inner, o.size)
}

// ---------------------------------------------------------------- thank-you card

export interface ThankYouCardOptions {
  /** e.g. "Thank you". */
  title: string
  message: string
  /** e.g. "With love and gratitude," — the parents' names follow. */
  signoff: string
  coupleNames: string
  dateText: string
  /** Personal card: "Dear …" (the invitation's "addressed as", or the name). */
  guestName?: string
  /** Your names and the date under the sign-off (each can be left off). */
  showNames?: boolean
  showDate?: boolean
  theme: PrintTheme
  size: CardSize
  fit?: number
}

/**
 * A thank-you card in the invitation's design: "With gratitude", a large
 * "Thank you", an optional "Dear …", the message, and the parents' sign-off.
 * The back is the plain monogram back (invitationBackHtml without extras).
 */
export function thankYouCardHtml(o: ThankYouCardOptions): string {
  const t = safe(o.theme)
  const base = CARD_SIZES['5x7']
  const style = t.style ?? 'classic'
  const ty = styleType(style)
  const c = { ink: t.ink, accent: t.accent, accentLight: t.accentLight, paper: t.paper, line: t.line, serif: t.serif, onColour: t.onColour }
  const f = Math.max(0.7, Math.min(1, o.fit ?? 1))
  const z = (v: number) => r2(v * f)
  const area = cardSafeArea(style)
  const couple = ty.namesCase === 'uppercase' ? o.coupleNames.toUpperCase() : o.coupleNames
  const paras = o.message.split(/\n+/).map((p) => p.trim()).filter(Boolean)

  const inner = `<div style="box-sizing:border-box;width:${base.w}mm;height:${base.h}mm;background:${t.paper};color:${t.ink};font-family:${t.sans};position:relative">
    ${t.frame === false ? '' : svgBox(base.w, base.h, frameSvg(style, 4.5, 4.5, base.w - 9, base.h - 9, c), 'position:absolute;left:0;top:0;pointer-events:none')}
    <div data-card-body style="position:absolute;left:${area.side}mm;right:${area.side}mm;top:${area.top}mm;bottom:${area.bottom}mm;overflow:hidden;display:flex;flex-direction:column">
    <div data-card-content style="flex:1 0 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;overflow-wrap:anywhere;padding:0 ${z(4)}mm">
      <div style="font-size:${z(2.6)}mm;letter-spacing:${z(ty.eyebrowTracking)}mm;color:${t.accent}">WITH GRATITUDE</div>
      <div style="margin-top:${z(3)}mm;font-family:${t.serif};font-style:italic;font-size:${z(15 * ty.namesScale)}mm;line-height:1;font-weight:${ty.namesWeight};color:${t.ink}">${esc(o.title)}</div>
      <div style="margin-top:${z(4)}mm">${svgBox(z(40), z(8), ornamentSvg(style, 20 * f, 4.5 * f, 38 * f, c))}</div>
      ${
        o.guestName
          ? `<div style="margin-top:${z(5)}mm;font-size:${z(2.6)}mm;letter-spacing:${z(0.6)}mm;color:${t.muted}">DEAR</div>
             <div style="margin-top:${z(1.5)}mm;font-family:${t.serif};font-size:${z(6.4)}mm;line-height:1.12">${nameLinesHtml(o.guestName, t, z)}</div>`
          : ''
      }
      ${paras
        .map((p, i) => `<div style="margin-top:${z(i ? 2.4 : o.guestName ? 4.5 : 6)}mm;max-width:${z(86)}mm;font-family:${t.serif};font-size:${z(4.1)}mm;line-height:1.5;color:${t.soft}">${esc(p)}</div>`)
        .join('')}
      ${o.signoff.trim() ? `<div style="margin-top:${z(7)}mm;font-family:${t.serif};font-style:italic;font-size:${z(3.8)}mm;color:${t.soft}">${esc(o.signoff.trim())}</div>` : ''}
      ${o.showNames === false ? '' : `<div style="margin-top:${z(o.signoff.trim() ? 1.8 : 7)}mm;font-family:${t.serif};font-size:${z(7.2 * ty.namesScale)}mm;line-height:1.05;letter-spacing:${ty.namesTracking}">${coupleHtml(couple, t)}</div>`}
      ${o.showDate === false ? '' : `<div style="margin-top:${z(2.2)}mm;font-size:${z(2.5)}mm;letter-spacing:${z(0.8)}mm;color:${t.accent}">${esc(o.dateText.toUpperCase())}</div>`}
    </div></div>
  </div>`
  return sized(inner, o.size)
}
