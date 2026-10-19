import type { Rect, SeatingItem, SeatingTable } from '../types/seating'

export const CHAIR_GAP = 20 // distance from table edge to chair centre
export const GRID = 10

export interface ChairPos {
  /** position in canvas coordinates */
  x: number
  y: number
  /** direction the chair faces (degrees, 0 = facing up) */
  facing: number
}

/** Chair positions in the table's own frame (centre = 0,0, unrotated). */
export function localChairs(t: Pick<SeatingTable, 'shape' | 'capacity' | 'seatSides' | 'width' | 'height'>): ChairPos[] {
  const n = Math.max(0, t.capacity)
  const out: ChairPos[] = []
  if (t.shape === 'round') {
    const rx = t.width / 2 + CHAIR_GAP
    const ry = t.height / 2 + CHAIR_GAP
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
      out.push({ x: Math.cos(a) * rx, y: Math.sin(a) * ry, facing: (a * 180) / Math.PI - 90 })
    }
    return out
  }
  const hw = t.width / 2
  const hh = t.height / 2
  const row = (count: number, y: number, facing: number) => {
    for (let i = 0; i < count; i++) out.push({ x: -hw + ((i + 0.5) * t.width) / count, y, facing })
  }
  if (t.seatSides === 'one') {
    row(n, hh + CHAIR_GAP, 0)
  } else if (t.seatSides === 'both' || n < 4) {
    const top = Math.ceil(n / 2)
    row(top, -hh - CHAIR_GAP, 180)
    row(n - top, hh + CHAIR_GAP, 0)
  } else {
    const sides = n - 2
    const top = Math.ceil(sides / 2)
    row(top, -hh - CHAIR_GAP, 180)
    out.push({ x: hw + CHAIR_GAP, y: 0, facing: -90 })
    // bottom row right → left so numbering goes round the table
    const bottom = sides - top
    for (let i = bottom - 1; i >= 0; i--) out.push({ x: -hw + ((i + 0.5) * t.width) / bottom, y: hh + CHAIR_GAP, facing: 0 })
    out.push({ x: -hw - CHAIR_GAP, y: 0, facing: 90 })
  }
  return out
}

export function rotatePoint(x: number, y: number, deg: number): { x: number; y: number } {
  const a = (deg * Math.PI) / 180
  return { x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) }
}

/** Chair positions in canvas coordinates. */
export function chairsFor(t: SeatingTable): ChairPos[] {
  return localChairs(t).map((c) => {
    const p = rotatePoint(c.x, c.y, t.rotation)
    return { x: t.x + p.x, y: t.y + p.y, facing: c.facing + t.rotation }
  })
}

export function isInsideRoom(item: Pick<SeatingItem, 'x' | 'y'>, room: Rect): boolean {
  return item.x >= room.x && item.x <= room.x + room.width && item.y >= room.y && item.y <= room.y + room.height
}

/** Effective location, honouring the manual override. */
export function itemLocation(item: SeatingItem, room: Rect): 'inside' | 'outside' {
  if (item.location === 'inside' || item.location === 'outside') return item.location
  return isInsideRoom(item, room) ? 'inside' : 'outside'
}

export const snap = (v: number, step = GRID) => Math.round(v / step) * step

export function initials(name: string): string {
  const parts = name
    .replace(/\(.*?\)/g, '')
    .split(/\s+/)
    .filter((p) => p && !/^(mr|mrs|ms|dr|atty|engr)\.?$/i.test(p))
  if (!parts.length) return '?'
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}
