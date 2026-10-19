/**
 * Design-style details for the printables (all units mm, SVG fragments).
 * The same four styles as the website: classic, maison, deco, heritage.
 */
import type { StyleId } from '../theme/themes'

export interface StyleColors {
  ink: string
  accent: string
  accentLight: string
  paper: string
  line: string
  serif: string
  /** Coloured paper: no fills, so the woven band becomes a light cross-hatch. */
  onColour?: boolean
}

const n = (v: number) => Math.round(v * 100) / 100

/** Woven banig / inabel band filling a rectangle (Heritage). */
export function bandSvg(x: number, y: number, w: number, h: number, c: StyleColors, id = 'banig'): string {
  if (c.onColour)
    return `<defs><pattern id="${id}" width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <path d="M 0 0 V 2.4 M 0 0 H 2.4" fill="none" stroke="${c.accent}" stroke-width="0.22" opacity="0.8"/>
    </pattern></defs>
    <rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="url(#${id})" stroke="${c.accent}" stroke-width="0.2"/>`
  return `<defs><pattern id="${id}" width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="3.2" height="3.2" fill="${c.accentLight}"/>
      <rect width="1.6" height="3.2" fill="${c.accent}" opacity="0.85"/>
      <rect width="3.2" height="1.6" fill="${c.accent}" opacity="0.45"/>
    </pattern></defs>
    <rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="url(#${id})"/>`
}

/** Points of a rectangle with cut (chamfered) corners. */
function chamfer(x: number, y: number, w: number, h: number, c: number): string {
  return [
    [x + c, y],
    [x + w - c, y],
    [x + w, y + c],
    [x + w, y + h - c],
    [x + w - c, y + h],
    [x + c, y + h],
    [x, y + h - c],
    [x, y + c],
  ]
    .map(([a, b]) => `${n(a)},${n(b)}`)
    .join(' ')
}

/** Small Deco fan placed in a corner (sx/sy = ±1 point the fan into the card). */
function decoCorner(x: number, y: number, sx: number, sy: number, s: number, color: string): string {
  const p = (dx: number, dy: number) => `${n(x + sx * dx)} ${n(y + sy * dy)}`
  return `<g fill="none" stroke="${color}" stroke-width="0.22">
      <path d="M ${p(0, s)} A ${s} ${s} 0 0 ${sx * sy > 0 ? 0 : 1} ${p(s, 0)}"/>
      <path d="M ${p(0, s * 0.62)} A ${s * 0.62} ${s * 0.62} 0 0 ${sx * sy > 0 ? 0 : 1} ${p(s * 0.62, 0)}" opacity="0.7"/>
      <path d="M ${p(0, 0)} L ${p(s * 0.92, s * 0.38)} M ${p(0, 0)} L ${p(s * 0.7, s * 0.7)} M ${p(0, 0)} L ${p(s * 0.38, s * 0.92)}" opacity="0.55"/>
    </g>`
}

/** The card / panel frame for a style, drawn inside (x, y, w, h). */
export function frameSvg(style: StyleId, x: number, y: number, w: number, h: number, c: StyleColors, scale = 1): string {
  const k = scale
  switch (style) {
    case 'maison':
      return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="none" stroke="${c.accent}" stroke-width="${n(0.25 * k)}"/>`
    case 'deco': {
      const c1 = 6 * k
      const g = 1.8 * k
      return `<polygon points="${chamfer(x, y, w, h, c1)}" fill="none" stroke="${c.accent}" stroke-width="${n(0.45 * k)}"/>
        <polygon points="${chamfer(x + g, y + g, w - 2 * g, h - 2 * g, c1 - g * 0.4)}" fill="none" stroke="${c.accent}" stroke-width="${n(0.18 * k)}"/>
        ${decoCorner(x + g + 2 * k, y + g + 2 * k, 1, 1, 9 * k, c.accent)}
        ${decoCorner(x + w - g - 2 * k, y + g + 2 * k, -1, 1, 9 * k, c.accent)}
        ${decoCorner(x + g + 2 * k, y + h - g - 2 * k, 1, -1, 9 * k, c.accent)}
        ${decoCorner(x + w - g - 2 * k, y + h - g - 2 * k, -1, -1, 9 * k, c.accent)}`
    }
    case 'heritage': {
      const b = 3.2 * k
      return `${bandSvg(x, y, w, b, c, 'banig-top')}${bandSvg(x, y + h - b, w, b, c, 'banig-bot')}
        <rect x="${n(x + 1.6 * k)}" y="${n(y + b + 1.6 * k)}" width="${n(w - 3.2 * k)}" height="${n(h - 2 * b - 3.2 * k)}" rx="${n(3 * k)}" fill="none" stroke="${c.accent}" stroke-width="${n(0.22 * k)}" stroke-dasharray="${n(1.2 * k)} ${n(0.9 * k)}"/>`
    }
    default:
      return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="none" stroke="${c.accent}" stroke-width="${n(0.4 * k)}"/>
        <rect x="${n(x + 1.5 * k)}" y="${n(y + 1.5 * k)}" width="${n(w - 3 * k)}" height="${n(h - 3 * k)}" fill="none" stroke="${c.accent}" stroke-width="${n(0.15 * k)}"/>`
  }
}

/** Centred divider ornament, `w` wide, centred on (cx, cy). */
export function ornamentSvg(style: StyleId, cx: number, cy: number, w: number, c: StyleColors): string {
  const h = w / 2
  switch (style) {
    case 'maison':
      return `<g stroke="${c.accent}" stroke-width="0.22"><line x1="${n(cx - h)}" x2="${n(cx - 2)}" y1="${n(cy)}" y2="${n(cy)}"/><line x1="${n(cx + 2)}" x2="${n(cx + h)}" y1="${n(cy)}" y2="${n(cy)}"/></g><circle cx="${n(cx)}" cy="${n(cy)}" r="0.55" fill="${c.accent}"/>`
    case 'deco': {
      const r = Math.min(4.2, w / 9)
      return `<g fill="none" stroke="${c.accent}" stroke-width="0.25">
          <path d="M ${n(cx - h)} ${n(cy + r * 0.2)} H ${n(cx - r - 3)} l 1.4 -1.4 h 1.6 M ${n(cx + h)} ${n(cy + r * 0.2)} H ${n(cx + r + 3)} l -1.4 -1.4 h -1.6"/>
          <path d="M ${n(cx - r)} ${n(cy + r * 0.2)} A ${r} ${r} 0 0 1 ${n(cx + r)} ${n(cy + r * 0.2)} Z"/>
          <path d="M ${n(cx)} ${n(cy + r * 0.2)} L ${n(cx - r * 0.8)} ${n(cy - r * 0.4)} M ${n(cx)} ${n(cy + r * 0.2)} L ${n(cx - r * 0.42)} ${n(cy - r * 0.72)} M ${n(cx)} ${n(cy + r * 0.2)} L ${n(cx)} ${n(cy - r * 0.8)} M ${n(cx)} ${n(cy + r * 0.2)} L ${n(cx + r * 0.42)} ${n(cy - r * 0.72)} M ${n(cx)} ${n(cy + r * 0.2)} L ${n(cx + r * 0.8)} ${n(cy - r * 0.4)}" opacity="0.8"/>
        </g>`
    }
    case 'heritage': {
      const d = 1.5
      const diamonds = [-2, -1, 0, 1, 2]
        .map((i) => {
          const x = cx + i * d * 2
          return `<path d="M ${n(x)} ${n(cy - d)} l ${d} ${d} l ${-d} ${d} l ${-d} ${-d} Z" fill="${i % 2 === 0 ? c.accent : 'none'}" stroke="${c.accent}" stroke-width="0.2"/>`
        })
        .join('')
      return `<g stroke="${c.accent}" stroke-width="0.22" opacity="0.7"><line x1="${n(cx - h)}" x2="${n(cx - 6 * d)}" y1="${n(cy)}" y2="${n(cy)}"/><line x1="${n(cx + 6 * d)}" x2="${n(cx + h)}" y1="${n(cy)}" y2="${n(cy)}"/></g>${diamonds}`
    }
    default:
      return `<g stroke="${c.accent}" stroke-width="0.3"><line x1="${n(cx - h)}" x2="${n(cx - 2.2)}" y1="${n(cy)}" y2="${n(cy)}"/><line x1="${n(cx + 2.2)}" x2="${n(cx + h)}" y1="${n(cy)}" y2="${n(cy)}"/></g>
        <path d="M ${n(cx)} ${n(cy - 1.2)} l 1.2 1.2 l -1.2 1.2 l -1.2 -1.2 Z" fill="none" stroke="${c.accent}" stroke-width="0.3"/>`
  }
}

/** A seal / crest with the monogram, centred on (cx, cy), radius r. */
/** The couple's uploaded monogram (Look & Feel → Monogram): drawn in place of the initials. */
export interface MonogramArt {
  /** Image address (a data: address in printables, so it prints reliably). */
  src: string
  /** width ÷ height */
  aspect: number
}

let tintSeq = 0

/** The uploaded monogram, tinted to one colour (it has its own frame, so no seal shape around it). */
export function monogramArtSvg(art: MonogramArt, cx: number, cy: number, height: number, colour: string, esc: (s: string) => string): string {
  const id = `mono-tint-${++tintSeq}`
  const w = height * art.aspect
  return `<defs><filter id="${id}" x="0" y="0" width="1" height="1" color-interpolation-filters="sRGB"><feFlood flood-color="${esc(colour)}"/><feComposite in2="SourceAlpha" operator="in"/></filter></defs><image href="${esc(art.src)}" x="${n(cx - w / 2)}" y="${n(cy - height / 2)}" width="${n(w)}" height="${n(height)}" preserveAspectRatio="xMidYMid meet" filter="url(#${id})"/>`
}

export function sealSvg(style: StyleId, cx: number, cy: number, r: number, monogram: string, c: StyleColors, esc: (s: string) => string, art?: MonogramArt | null): string {
  if (art) return monogramArtSvg(art, cx, cy, r * 2.5, c.ink, esc)
  const text = (size: number, italic: boolean, extra = '') =>
    `<text x="${n(cx)}" y="${n(cy + size * 0.34)}" text-anchor="middle" font-family="${c.serif}" ${italic ? 'font-style="italic"' : ''} font-size="${n(size)}" fill="${c.ink}" ${extra}>${esc(monogram)}</text>`
  switch (style) {
    case 'maison':
      return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${c.paper}" stroke="${c.accent}" stroke-width="0.25"/>
        <circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r - 1.2)}" fill="none" stroke="${c.accent}" stroke-width="0.12"/>
        ${text(r * 0.62, false, 'letter-spacing="0.3"')}`
    case 'deco': {
      const rays = Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * Math.PI * 2
        const r1 = r * 1.05
        const r2 = r * (i % 2 ? 1.28 : 1.45)
        return `<line x1="${n(cx + Math.cos(a) * r1)}" y1="${n(cy + Math.sin(a) * r1)}" x2="${n(cx + Math.cos(a) * r2)}" y2="${n(cy + Math.sin(a) * r2)}"/>`
      }).join('')
      return `<g stroke="${c.accent}" stroke-width="0.22">${rays}</g>
        <polygon points="${chamfer(cx - r, cy - r, 2 * r, 2 * r, r * 0.42)}" fill="${c.accentLight}" stroke="${c.accent}" stroke-width="0.35"/>
        <polygon points="${chamfer(cx - r + 1, cy - r + 1, 2 * r - 2, 2 * r - 2, r * 0.42 - 0.4)}" fill="none" stroke="${c.accent}" stroke-width="0.15"/>
        ${text(r * 0.62, false, 'letter-spacing="0.4"')}`
    }
    case 'heritage':
      return `<path d="M ${n(cx)} ${n(cy - r * 1.25)} L ${n(cx + r * 1.25)} ${n(cy)} L ${n(cx)} ${n(cy + r * 1.25)} L ${n(cx - r * 1.25)} ${n(cy)} Z" fill="${c.accentLight}" stroke="${c.accent}" stroke-width="0.35"/>
        <path d="M ${n(cx)} ${n(cy - r * 1.05)} L ${n(cx + r * 1.05)} ${n(cy)} L ${n(cx)} ${n(cy + r * 1.05)} L ${n(cx - r * 1.05)} ${n(cy)} Z" fill="none" stroke="${c.accent}" stroke-width="0.18" stroke-dasharray="0.8 0.6"/>
        ${text(r * 0.62, true)}`
    default:
      return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${c.accentLight}" stroke="${c.accent}" stroke-width="0.4"/>${text(r * 0.62, true)}`
  }
}

/** Typography tweaks per style, for HTML cards. */
export function styleType(style: StyleId): { namesCase: string; namesTracking: string; namesWeight: number; namesScale: number; eyebrowTracking: number } {
  switch (style) {
    case 'maison':
      return { namesCase: 'none', namesTracking: '-0.2mm', namesWeight: 300, namesScale: 1.08, eyebrowTracking: 1.3 }
    case 'deco':
      return { namesCase: 'uppercase', namesTracking: '0.9mm', namesWeight: 400, namesScale: 0.78, eyebrowTracking: 1.4 }
    case 'heritage':
      return { namesCase: 'none', namesTracking: '0', namesWeight: 400, namesScale: 1, eyebrowTracking: 0.9 }
    default:
      return { namesCase: 'none', namesTracking: '0', namesWeight: 300, namesScale: 1, eyebrowTracking: 0.9 }
  }
}
