/**
 * Design-style details for the printables (all units mm, SVG fragments).
 * The same four styles as the website: Soft & Sweet (classic), Twinkle Little
 * Star (maison), Hello Sunshine (deco) and Heritage — with baby-shower art:
 * twinkles, a crescent moon, a sun and puffy clouds.
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

/** A four-point twinkle of radius r centred on (cx, cy). */
export function twinkleSvg(cx: number, cy: number, r: number, fill: string, extra = ''): string {
  const k = r / 10.5
  const p = (x: number, y: number) => `${n(cx + (x - 12) * k)} ${n(cy + (y - 12) * k)}`
  return `<path d="M ${p(12, 1.5)} C ${p(12.5, 7.1)} ${p(14.3, 10.1)} ${p(22.5, 12)} C ${p(14.3, 13.9)} ${p(12.5, 16.9)} ${p(12, 22.5)} C ${p(11.5, 16.9)} ${p(9.7, 13.9)} ${p(1.5, 12)} C ${p(9.7, 10.1)} ${p(11.5, 7.1)} ${p(12, 1.5)} Z" fill="${fill}" ${extra}/>`
}

/** A crescent moon of radius r centred on (cx, cy). */
export function moonSvg(cx: number, cy: number, r: number, c: StyleColors, extra = ''): string {
  const fill = c.onColour ? 'none' : c.accent
  return `<path d="M ${n(cx + r * 0.3)} ${n(cy - r)} A ${n(r)} ${n(r)} 0 1 0 ${n(cx + r)} ${n(cy + r * 0.45)} A ${n(r * 0.82)} ${n(r * 0.82)} 0 0 1 ${n(cx + r * 0.3)} ${n(cy - r)} Z" fill="${fill}" stroke="${c.accent}" stroke-width="0.2" ${extra}/>`
}

/** A puffy cloud `w` wide, its base centred on (cx, cy). */
export function cloudSvg(cx: number, cy: number, w: number, c: StyleColors, extra = ''): string {
  const k = w / 112
  const p = (x: number, y: number) => `${n(cx + (x - 60) * k)} ${n(cy + (y - 58) * k)}`
  const d = `M ${p(24, 58)} C ${p(12, 58)} ${p(4, 50.5)} ${p(4, 41.5)} C ${p(4, 32.5)} ${p(11.6, 25)} ${p(22.4, 25)} C ${p(24, 14)} ${p(33.4, 6)} ${p(45, 6)} C ${p(54.3, 6)} ${p(62.3, 11.3)} ${p(66, 19)} C ${p(68.4, 18)} ${p(71, 17.5)} ${p(73.8, 17.5)} C ${p(84.4, 17.5)} ${p(93.2, 25.1)} ${p(94.7, 35.1)} C ${p(105.6, 36)} ${p(116, 44.6)} ${p(116, 47.6)} C ${p(116, 53.4)} ${p(110.8, 58)} ${p(104.4, 58)} Z`
  return `<path d="${d}" fill="${c.onColour ? 'none' : c.paper}" stroke="${c.accent}" stroke-width="0.3" stroke-linejoin="round" ${extra}/>`
}

/**
 * The little picture at the top of an invitation, `w` wide, centred on (cx, cy):
 * a moon and stars (Twinkle Little Star), a rising sun over a cloud (Hello
 * Sunshine), or clouds and twinkles (Soft & Sweet, Heritage).
 */
export function babyArtSvg(style: StyleId, cx: number, cy: number, w: number, c: StyleColors): string {
  const fill = c.onColour ? 'none' : c.accent
  const tw = (x: number, y: number, r: number, o = 1) => twinkleSvg(cx + x * w, cy + y * w, r * w, fill, `stroke="${c.accent}" stroke-width="0.12" opacity="${o}"`)
  switch (style) {
    case 'maison':
      return `${moonSvg(cx - w * 0.04, cy, w * 0.2, c)}${tw(0.26, -0.12, 0.07)}${tw(-0.3, 0.08, 0.05, 0.8)}${tw(0.36, 0.14, 0.04, 0.7)}${tw(-0.18, -0.2, 0.035, 0.7)}`
    case 'deco': {
      const r = w * 0.17
      const rays = Array.from({ length: 9 }, (_, i) => {
        const a = Math.PI + (i / 8) * Math.PI
        return `<line x1="${n(cx + Math.cos(a) * r * 1.25)}" y1="${n(cy + w * 0.06 + Math.sin(a) * r * 1.25)}" x2="${n(cx + Math.cos(a) * r * 1.75)}" y2="${n(cy + w * 0.06 + Math.sin(a) * r * 1.75)}" stroke="${c.accent}" stroke-width="0.35" stroke-linecap="round"/>`
      }).join('')
      return `${rays}<circle cx="${n(cx)}" cy="${n(cy + w * 0.06)}" r="${n(r)}" fill="${c.onColour ? 'none' : c.accentLight}" stroke="${c.accent}" stroke-width="0.3"/>${cloudSvg(cx + w * 0.12, cy + w * 0.2, w * 0.5, c)}`
    }
    default:
      return `${cloudSvg(cx - w * 0.12, cy + w * 0.14, w * 0.56, c)}${cloudSvg(cx + w * 0.22, cy + w * 0.2, w * 0.36, c)}${tw(0.3, -0.12, 0.07)}${tw(-0.32, -0.06, 0.05, 0.8)}${tw(0.04, -0.2, 0.04, 0.7)}`
  }
}

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

/** Small rising-sun fan placed in a corner (sx/sy = ±1 point the fan into the card). */
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
  const fill = c.onColour ? 'none' : c.accent
  switch (style) {
    case 'maison': {
      // Rounded frame with a crescent moon and a few stars in the corners.
      const stars = [
        [x + 7 * k, y + 7 * k, 1.6],
        [x + 12 * k, y + 4.6 * k, 0.9],
        [x + w - 7 * k, y + h - 7 * k, 1.6],
        [x + w - 12 * k, y + h - 4.6 * k, 0.9],
        [x + 5 * k, y + h - 9 * k, 0.8],
      ]
        .map(([sx, sy, r]) => twinkleSvg(sx, sy, r * k, fill, `stroke="${c.accent}" stroke-width="0.1"`))
        .join('')
      return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(5 * k)}" fill="none" stroke="${c.accent}" stroke-width="${n(0.3 * k)}"/>
        <rect x="${n(x + 1.6 * k)}" y="${n(y + 1.6 * k)}" width="${n(w - 3.2 * k)}" height="${n(h - 3.2 * k)}" rx="${n(3.8 * k)}" fill="none" stroke="${c.accent}" stroke-width="${n(0.12 * k)}"/>
        ${moonSvg(x + w - 7.5 * k, y + 7.5 * k, 2.6 * k, c)}${stars}`
    }
    case 'deco': {
      // Rounded double frame with rising-sun fans in the corners.
      const g = 1.8 * k
      return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(6 * k)}" fill="none" stroke="${c.accent}" stroke-width="${n(0.45 * k)}"/>
        <rect x="${n(x + g)}" y="${n(y + g)}" width="${n(w - 2 * g)}" height="${n(h - 2 * g)}" rx="${n(4.4 * k)}" fill="none" stroke="${c.accent}" stroke-width="${n(0.16 * k)}"/>
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
    default: {
      // Soft & Sweet: a rounded double line with a twinkle in each corner.
      const t = (tx: number, ty: number) => twinkleSvg(tx, ty, 1.5 * k, fill, `stroke="${c.accent}" stroke-width="0.1"`)
      return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(4 * k)}" fill="none" stroke="${c.accent}" stroke-width="${n(0.4 * k)}"/>
        <rect x="${n(x + 1.5 * k)}" y="${n(y + 1.5 * k)}" width="${n(w - 3 * k)}" height="${n(h - 3 * k)}" rx="${n(2.8 * k)}" fill="none" stroke="${c.accent}" stroke-width="${n(0.15 * k)}"/>
        ${t(x + 5 * k, y + 5 * k)}${t(x + w - 5 * k, y + 5 * k)}${t(x + 5 * k, y + h - 5 * k)}${t(x + w - 5 * k, y + h - 5 * k)}`
    }
  }
}

/** Centred divider ornament, `w` wide, centred on (cx, cy). */
export function ornamentSvg(style: StyleId, cx: number, cy: number, w: number, c: StyleColors): string {
  const h = w / 2
  switch (style) {
    case 'maison':
      return `<g stroke="${c.accent}" stroke-width="0.22"><line x1="${n(cx - h)}" x2="${n(cx - 3.4)}" y1="${n(cy)}" y2="${n(cy)}"/><line x1="${n(cx + 3.6)}" x2="${n(cx + h)}" y1="${n(cy)}" y2="${n(cy)}"/></g>${moonSvg(cx - 0.6, cy, 1.6, c)}${twinkleSvg(cx + 2.2, cy - 1, 0.9, c.onColour ? 'none' : c.accent, `stroke="${c.accent}" stroke-width="0.1"`)}`
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
      return `<g stroke="${c.accent}" stroke-width="0.3"><line x1="${n(cx - h)}" x2="${n(cx - 2.6)}" y1="${n(cy)}" y2="${n(cy)}"/><line x1="${n(cx + 2.6)}" x2="${n(cx + h)}" y1="${n(cy)}" y2="${n(cy)}"/></g>
        ${twinkleSvg(cx, cy, 1.9, c.onColour ? 'none' : c.accent, `stroke="${c.accent}" stroke-width="0.15"`)}`
  }
}

/** A seal / crest with the monogram, centred on (cx, cy), radius r. */
/** The uploaded monogram (Look & Feel → Monogram): drawn in place of the initials. */
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
        ${moonSvg(cx + r * 0.62, cy - r * 0.62, r * 0.26, c)}
        ${text(r * 0.62, false, 'letter-spacing="0.3"')}`
    case 'deco': {
      const rays = Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * Math.PI * 2
        const r1 = r * 1.05
        const r2 = r * (i % 2 ? 1.28 : 1.45)
        return `<line x1="${n(cx + Math.cos(a) * r1)}" y1="${n(cy + Math.sin(a) * r1)}" x2="${n(cx + Math.cos(a) * r2)}" y2="${n(cy + Math.sin(a) * r2)}"/>`
      }).join('')
      return `<g stroke="${c.accent}" stroke-width="0.22" stroke-linecap="round">${rays}</g>
        <circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${c.accentLight}" stroke="${c.accent}" stroke-width="0.35"/>
        <circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r - 1)}" fill="none" stroke="${c.accent}" stroke-width="0.15"/>
        ${text(r * 0.62, false, 'letter-spacing="0.4"')}`
    }
    case 'heritage':
      return `<path d="M ${n(cx)} ${n(cy - r * 1.25)} L ${n(cx + r * 1.25)} ${n(cy)} L ${n(cx)} ${n(cy + r * 1.25)} L ${n(cx - r * 1.25)} ${n(cy)} Z" fill="${c.accentLight}" stroke="${c.accent}" stroke-width="0.35"/>
        <path d="M ${n(cx)} ${n(cy - r * 1.05)} L ${n(cx + r * 1.05)} ${n(cy)} L ${n(cx)} ${n(cy + r * 1.05)} L ${n(cx - r * 1.05)} ${n(cy)} Z" fill="none" stroke="${c.accent}" stroke-width="0.18" stroke-dasharray="0.8 0.6"/>
        ${text(r * 0.62, true)}`
    default:
      return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${c.accentLight}" stroke="${c.accent}" stroke-width="0.4"/>
        ${twinkleSvg(cx + r * 0.78, cy - r * 0.78, r * 0.22, c.onColour ? 'none' : c.accent, `stroke="${c.accent}" stroke-width="0.1"`)}${text(r * 0.62, true)}`
  }
}

/** Typography tweaks per style, for HTML cards. */
export function styleType(style: StyleId): { namesCase: string; namesTracking: string; namesWeight: number; namesScale: number; eyebrowTracking: number } {
  switch (style) {
    case 'maison':
      return { namesCase: 'none', namesTracking: '-0.2mm', namesWeight: 300, namesScale: 1.08, eyebrowTracking: 1.3 }
    case 'deco':
      return { namesCase: 'none', namesTracking: '0.3mm', namesWeight: 400, namesScale: 0.92, eyebrowTracking: 1.2 }
    case 'heritage':
      return { namesCase: 'none', namesTracking: '0', namesWeight: 400, namesScale: 1, eyebrowTracking: 0.9 }
    default:
      return { namesCase: 'none', namesTracking: '0', namesWeight: 300, namesScale: 1, eyebrowTracking: 0.9 }
  }
}
