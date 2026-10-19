/**
 * Leaflets: small printed cards the couple builds from blocks (heading, text,
 * hashtag, QR codes, the venue, the program flow and Bible verse
 * from Website Settings, a free list, …), on one or both sides.
 */
import type { StyleId } from '../theme/themes'
import { esc, type PrintTheme } from './printables'
import { ornamentSvg, sealSvg, styleType, type MonogramArt } from './printStyles'

export type QrSource = 'website' | 'rsvp' | 'seat' | 'photos' | 'gift' | 'custom'

export type LeafletBlock =
  | { id: string; kind: 'names' }
  | { id: string; kind: 'monogram' }
  | { id: string; kind: 'heading'; text: string }
  | { id: string; kind: 'text'; text: string }
  | { id: string; kind: 'hashtag'; text: string }
  | { id: string; kind: 'qr'; source: QrSource; caption: string; url?: string }
  | { id: string; kind: 'details' }
  | { id: string; kind: 'list'; title: string; text: string }
  /** The program flow from Website Settings (its own table). */
  | { id: string; kind: 'program'; title: string }
  /** The Bible verse from Website Settings. */
  | { id: string; kind: 'verse' }
  | { id: string; kind: 'divider' }

export type BlockKind = LeafletBlock['kind']

export interface Leaflet {
  id: string
  name: string
  /** 1 = a whole sheet, 2 = half sheets, 4 = quarter sheets. */
  perSheet: 1 | 2 | 4
  front: LeafletBlock[]
  /** Empty = nothing printed on the back. */
  back: LeafletBlock[]
}

export const BLOCK_LABELS: Record<BlockKind, string> = {
  names: 'Baby’s name & date',
  monogram: 'Monogram',
  heading: 'Heading',
  text: 'Text',
  hashtag: 'Hashtag',
  qr: 'QR code',
  details: 'Venue',
  program: 'Program flow',
  verse: 'Bible verse',
  list: 'Your own list',
  divider: 'Ornament line',
}

export const QR_SOURCES: Record<QrSource, string> = {
  website: 'Baby shower website',
  rsvp: 'RSVP page',
  seat: 'Find My Seat',
  photos: 'Share your photos',
  gift: 'Gift QR (GCash / InstaPay)',
  custom: 'Another link…',
}

let seq = 0
export const newId = () => `b${Date.now().toString(36)}${(++seq).toString(36)}`

export function newBlock(kind: BlockKind): LeafletBlock {
  const id = newId()
  switch (kind) {
    case 'heading':
      return { id, kind, text: 'A heading' }
    case 'text':
      return { id, kind, text: 'Write something for your guests.' }
    case 'hashtag':
      return { id, kind, text: '#YourHashtag' }
    case 'qr':
      return { id, kind, source: 'website', caption: 'Our baby shower website' }
    case 'list':
      return { id, kind, title: 'Program', text: '2:00 PM — Welcome & snacks\n2:30 PM — Shower games\n3:30 PM — Gender reveal\n4:00 PM — Opening of gifts' }
    case 'program':
      return { id, kind, title: 'Program' }
    default:
      return { id, kind } as LeafletBlock
  }
}

/** Ready-made starting points (everything can be changed afterwards). */
export const LEAFLET_TEMPLATES: { key: string; name: string; make: () => Omit<Leaflet, 'id'> }[] = [
  {
    key: 'photos',
    name: 'Share your photos',
    make: () => ({
      name: 'Share your photos',
      perSheet: 4,
      front: [
        { id: newId(), kind: 'heading', text: 'Share your photos' },
        { id: newId(), kind: 'text', text: 'Snap, scan and upload — your photos appear on the big screen during the shower.' },
        { id: newId(), kind: 'qr', source: 'photos', caption: 'Scan to upload' },
      ],
      back: [],
    }),
  },
  {
    key: 'info',
    name: 'Guest info card',
    make: () => ({
      name: 'Guest info card',
      perSheet: 4,
      front: [
        { id: newId(), kind: 'names' },
        { id: newId(), kind: 'divider' },
        { id: newId(), kind: 'qr', source: 'website', caption: 'Our website' },
        { id: newId(), kind: 'qr', source: 'seat', caption: 'Find your seat' },
        { id: newId(), kind: 'qr', source: 'photos', caption: 'Share your photos' },
      ],
      back: [],
    }),
  },
  {
    key: 'program',
    name: 'Program',
    make: () => ({
      name: 'Program',
      perSheet: 2,
      front: [
        { id: newId(), kind: 'monogram' },
        { id: newId(), kind: 'names' },
        { id: newId(), kind: 'details' },
        { id: newId(), kind: 'divider' },
        { id: newId(), kind: 'program', title: 'Program' },
      ],
      back: [
        { id: newId(), kind: 'verse' },
        { id: newId(), kind: 'divider' },
        { id: newId(), kind: 'heading', text: 'Thank you' },
        { id: newId(), kind: 'text', text: 'Thank you for celebrating our little one with us today. Your love means the world to us.' },
        { id: newId(), kind: 'qr', source: 'photos', caption: 'Share your photos' },
      ],
    }),
  },
  { key: 'blank', name: 'Blank', make: () => ({ name: 'My leaflet', perSheet: 2, front: [{ id: newId(), kind: 'heading', text: 'A heading' }], back: [] }) },
]

export interface LeafletData {
  coupleNames: string
  dateText: string
  monogram: string
  monogramArt?: MonogramArt | null
  /** The venue line. */
  ceremony: string
  /** Not used by the baby shower (one venue). */
  reception: string
  /** QR code SVGs by block id (made ahead, since making them is asynchronous). */
  qr: Record<string, string>
  /** The uploaded gift QR image. */
  giftQrUrl: string | null
  /** Program flow and Bible verse from Website Settings. */
  program?: { time: string; title: string; description: string }[]
  verse?: { text: string; reference: string }
}

const q = (v: string) => v.replace(/"/g, "'")

/**
 * One side of a leaflet, `w` × `h` mm, laid out at text scale `fit`
 * (measured with measureCardFit: data-card-body / data-card-content).
 * QR codes next to each other share a row; on a wide card the QR codes go in
 * a column on the right, the rest on the left.
 */
export function leafletHtml(blocks: LeafletBlock[], w: number, h: number, t0: PrintTheme, style: StyleId, data: LeafletData, fit = 1): string {
  const t = { ...t0, serif: q(t0.serif), sans: q(t0.sans) }
  const ty = styleType(style)
  const c = { ink: t.ink, accent: t.accent, accentLight: t.accentLight, paper: t.paper, line: t.line, serif: t.serif, onColour: t.onColour }
  const pad = Math.max(6, Math.min(w, h) * 0.07)
  const innerW = w - 2 * pad
  const innerH = h - 2 * pad
  const qrs = blocks.filter((b): b is Extract<LeafletBlock, { kind: 'qr' }> => b.kind === 'qr')
  const cols = w > h * 1.2 && qrs.length > 0 && qrs.length < blocks.length
  const colGap = innerW * 0.06
  const colW = cols ? (innerW - colGap) / 2 : innerW
  const k = Math.min(colW / 70, innerH / 100) * fit
  const z = (v: number, min = 0) => Math.round(Math.max(v * k, min * fit) * 100) / 100
  const gapQr = z(5)

  const qrRow = (row: Extract<LeafletBlock, { kind: 'qr' }>[], avail: number) => {
    const n = row.length
    const size = Math.round(Math.min(z(n === 1 ? 32 : n === 2 ? 26 : 21), (avail - (n - 1) * gapQr) / n) * 100) / 100
    return `<div style="display:flex;justify-content:center;gap:${gapQr}mm">${row
      .map((r) => {
        const img =
          r.source === 'gift'
            ? data.giftQrUrl
              ? `<img src="${esc(data.giftQrUrl)}" alt="" style="display:block;width:${size}mm;height:${size}mm;object-fit:contain"/>`
              : `<div style="width:${size}mm;height:${size}mm;display:flex;align-items:center;justify-content:center;font-size:${z(2.2, 1.8)}mm;color:${t.muted};border:0.3mm dashed ${t.line}">Upload your gift QR first</div>`
            : `<div style="width:${size}mm;height:${size}mm">${data.qr[r.id] ?? ''}</div>`
        return `<div style="display:flex;flex-direction:column;align-items:center;width:${Math.max(size, z(18))}mm">${img}${r.caption.trim() ? `<div style="margin-top:${z(1.4)}mm;font-size:${z(2.5, 2)}mm;line-height:1.25;letter-spacing:${z(0.2)}mm;color:${t.soft}">${esc(r.caption)}</div>` : ''}</div>`
      })
      .join('')}</div>`
  }

  const render = (list: LeafletBlock[], avail: number): string[] => {
    const parts: string[] = []
    for (let i = 0; i < list.length; i++) {
      const b = list[i]
      switch (b.kind) {
        case 'names': {
          const n = ty.namesCase === 'uppercase' ? data.coupleNames.toUpperCase() : data.coupleNames
          parts.push(
            `<div style="font-family:${t.serif};font-weight:${ty.namesWeight};font-size:${z(11, 5)}mm;line-height:1.05;color:${t.ink}">${esc(n).replace(/&amp;/, `<span style="font-style:italic;color:${t.accent}">&amp;</span>`)}</div>` +
              (data.dateText ? `<div style="margin-top:${z(1.6)}mm;font-size:${z(2.6, 2)}mm;letter-spacing:${z(0.6)}mm;color:${t.soft}">${esc(data.dateText.toUpperCase())}</div>` : ''),
          )
          break
        }
        case 'monogram': {
          const r = z(7, 4)
          parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${r * 3.2}mm" height="${r * 3.2}mm" viewBox="0 0 ${r * 3.2} ${r * 3.2}" style="display:block;margin:0 auto">${sealSvg(style, r * 1.6, r * 1.6, r, data.monogram, c, esc, data.monogramArt)}</svg>`)
          break
        }
        case 'heading':
          parts.push(`<div style="font-family:${t.serif};font-size:${z(8, 4)}mm;line-height:1.1;color:${t.ink}">${esc(b.text)}</div>`)
          break
        case 'text':
          parts.push(
            b.text
              .split(/\n\s*\n/)
              .map((p) => `<p style="margin:0 0 ${z(1.4)}mm;font-family:${t.serif};font-size:${z(3.6, 2.6)}mm;line-height:1.4;color:${t.soft}">${esc(p.trim()).replace(/\n/g, '<br/>')}</p>`)
              .join(''),
          )
          break
        case 'hashtag':
          parts.push(`<div style="font-family:${t.serif};font-style:italic;font-size:${z(5.4, 3.4)}mm;color:${t.accent};overflow-wrap:anywhere">${esc(b.text)}</div>`)
          break
        case 'details': {
          const row = (label: string, value: string) => {
            if (!value.trim()) return ''
            const [place, time] = value.split(/\s+·\s+/)
            return `<div style="margin-top:${z(1.6)}mm"><div style="font-size:${z(2.2, 1.9)}mm;letter-spacing:${z(0.5)}mm;color:${t.accent}">${label}${time ? ` · ${esc(time)}` : ''}</div><div style="font-family:${t.serif};font-size:${z(3.8, 2.8)}mm;color:${t.ink}">${esc(place)}</div></div>`
          }
          parts.push(row('VENUE', data.ceremony))
          break
        }
        case 'list': {
          const lines = b.text.split('\n').map((l) => l.trim()).filter(Boolean)
          const rows = lines
            .map((l) => {
              const m = /^(.*?)\s+[—–-]\s+(.*)$/.exec(l)
              return m
                ? `<tr><td style="padding:${z(0.6)}mm ${z(2.4)}mm ${z(0.6)}mm 0;text-align:right;white-space:nowrap;font-size:${z(2.6, 2)}mm;letter-spacing:${z(0.3)}mm;color:${t.accent}">${esc(m[1].toUpperCase())}</td><td style="padding:${z(0.6)}mm 0;text-align:left;font-family:${t.serif};font-size:${z(3.8, 2.8)}mm;color:${t.ink}">${esc(m[2])}</td></tr>`
                : `<tr><td colspan="2" style="padding:${z(0.6)}mm 0;font-family:${t.serif};font-size:${z(3.8, 2.8)}mm;color:${t.ink}">${esc(l)}</td></tr>`
            })
            .join('')
          parts.push(
            (b.title.trim() ? `<div style="font-size:${z(2.6, 2)}mm;letter-spacing:${z(0.9)}mm;color:${t.accent};margin-bottom:${z(1.2)}mm">${esc(b.title.toUpperCase())}</div>` : '') +
              `<table style="margin:0 auto;border-collapse:collapse">${rows}</table>`,
          )
          break
        }
        case 'program': {
          const items = (data.program ?? []).filter((p) => p.title.trim())
          const head = b.title.trim() ? `<div style="font-size:${z(2.6, 2)}mm;letter-spacing:${z(0.9)}mm;color:${t.accent};margin-bottom:${z(1.2)}mm">${esc(b.title.toUpperCase())}</div>` : ''
          // Nothing to print yet (the side panel says where to add it).
          if (!items.length) break
          const rows = items
            .map(
              (p) =>
                `<tr><td style="padding:${z(0.7)}mm ${z(2.4)}mm ${z(0.7)}mm 0;text-align:right;vertical-align:top;white-space:nowrap;font-size:${z(2.6, 2)}mm;line-height:1.5;letter-spacing:${z(0.3)}mm;color:${t.accent}">${esc(p.time.toUpperCase())}</td><td style="padding:${z(0.7)}mm 0;text-align:left;vertical-align:top"><div style="font-family:${t.serif};font-size:${z(3.8, 2.8)}mm;line-height:1.2;color:${t.ink}">${esc(p.title)}</div>${p.description.trim() ? `<div style="margin-top:${z(0.4)}mm;font-size:${z(2.5, 1.9)}mm;line-height:1.3;color:${t.soft}">${esc(p.description)}</div>` : ''}</td></tr>`,
            )
            .join('')
          parts.push(head + `<table style="margin:0 auto;border-collapse:collapse">${rows}</table>`)
          break
        }
        case 'verse': {
          const v = data.verse
          if (!v?.text.trim()) break
          const paras = v.text
            .split(/\n\s*\n/)
            .map((p) => p.trim())
            .filter(Boolean)
            .map((p) => `<p style="margin:0 0 ${z(1.2)}mm">${esc(p).replace(/\n/g, '<br/>')}</p>`)
            .join('')
          parts.push(
            `<div style="font-family:${t.serif};font-style:italic;font-size:${z(3.9, 2.8)}mm;line-height:1.45;color:${t.ink}">${paras}</div>` +
              (v.reference.trim() ? `<div style="margin-top:${z(1.2)}mm;font-size:${z(2.4, 1.9)}mm;letter-spacing:${z(0.6)}mm;color:${t.accent}">${esc(v.reference.trim().toUpperCase())}</div>` : ''),
          )
          break
        }
        case 'divider':
          parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${z(40)}mm" height="${z(6)}mm" viewBox="0 0 40 6" style="display:block;margin:0 auto">${ornamentSvg(style, 20, 3, 34, c)}</svg>`)
          break
        case 'qr': {
          const row: Extract<LeafletBlock, { kind: 'qr' }>[] = [b]
          while (list[i + 1]?.kind === 'qr' && row.length < (cols ? 2 : 3)) row.push(list[++i] as Extract<LeafletBlock, { kind: 'qr' }>)
          parts.push(qrRow(row, avail))
          break
        }
      }
    }
    return parts
  }

  const gap = z(4.5)
  const column = (list: LeafletBlock[], avail: number, width: string) =>
    `<div style="width:${width};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${gap}mm">${render(list, avail)
      .map((p) => `<div style="width:100%">${p}</div>`)
      .join('')}</div>`
  const content = cols
    ? `<div data-card-content style="flex:1;display:flex;align-items:center;justify-content:center;gap:${colGap}mm;text-align:center">${column(
        blocks.filter((b) => b.kind !== 'qr'),
        colW,
        `${colW}mm`,
      )}${column(qrs, colW, `${colW}mm`)}</div>`
    : `<div data-card-content style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:${gap}mm">${render(blocks, innerW)
        .map((p) => `<div style="width:100%">${p}</div>`)
        .join('')}</div>`
  return `<div style="box-sizing:border-box;width:${w}mm;height:${h}mm;padding:${pad}mm;background:${t.paper};color:${t.ink};font-family:${t.sans};display:flex;overflow:hidden">
    <div data-card-body style="flex:1;display:flex;min-height:0;overflow:hidden">${content}</div>
  </div>`
}
