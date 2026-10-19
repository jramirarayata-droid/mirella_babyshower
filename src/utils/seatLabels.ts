/*
 * Places guests' names around the tables so they don't sit on top of each
 * other, tables, chairs or areas — each name goes in the nearest free spot
 * outside its chair, and a thin line joins it to the chair.
 */
import type { SeatingItem, SeatingTable } from '../types/seating'
import { localChairs, rotatePoint } from './seatingGeometry'

export interface SeatLabelInput {
  tableId: string
  index: number
  lines: string[]
  /** Highlighted label (bolder). */
  strong?: boolean
}

export interface SeatLabel {
  key: string
  lines: string[]
  strong?: boolean
  fontSize: number
  /** Centre of the label box. */
  x: number
  y: number
  w: number
  h: number
  /** Leader line: from the chair's edge to the label's edge (null when the label touches the chair). */
  line: { x1: number; y1: number; x2: number; y2: number } | null
}

interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

const CHAIR_R = 12
const LINE_H = 1.18

/** Axis-aligned box around a (possibly rotated) rectangle. */
function rectBox(cx: number, cy: number, w: number, h: number, rot: number, pad = 0): Box {
  const a = (rot * Math.PI) / 180
  const c = Math.abs(Math.cos(a))
  const s = Math.abs(Math.sin(a))
  const hw = (w * c + h * s) / 2 + pad
  const hh = (w * s + h * c) / 2 + pad
  return { x0: cx - hw, y0: cy - hh, x1: cx + hw, y1: cy + hh }
}

const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0))

let measureCtx: CanvasRenderingContext2D | null = null
function textWidth(text: string, size: number, family: string, weight: number): number {
  if (typeof document !== 'undefined') {
    measureCtx ??= document.createElement('canvas').getContext('2d')
    if (measureCtx) {
      measureCtx.font = `${weight} ${size}px ${family}`
      return measureCtx.measureText(text).width * 1.04
    }
  }
  return text.length * size * 0.56
}

/** Where the line meets the edge of a box, heading from (fx, fy) to the box centre. */
function edgePoint(b: { x: number; y: number; w: number; h: number }, fx: number, fy: number) {
  const dx = fx - b.x
  const dy = fy - b.y
  const sx = dx === 0 ? Infinity : b.w / 2 / Math.abs(dx)
  const sy = dy === 0 ? Infinity : b.h / 2 / Math.abs(dy)
  const s = Math.min(sx, sy, 1)
  return { x: b.x + dx * s, y: b.y + dy * s }
}

/** Do two line segments cross? */
function segmentsCross(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): boolean {
  const o = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) => Math.sign((qx - px) * (ry - py) - (qy - py) * (rx - px))
  return o(ax, ay, bx, by, cx, cy) !== o(ax, ay, bx, by, dx, dy) && o(cx, cy, dx, dy, ax, ay) !== o(cx, cy, dx, dy, bx, by)
}

export function layoutSeatLabels(opts: {
  tables: SeatingTable[]
  items: SeatingItem[]
  canvas: { width: number; height: number }
  labels: SeatLabelInput[]
  fontSize?: number
  fontFamily?: string
}): SeatLabel[] {
  const { tables, items, canvas, labels } = opts
  const base = opts.fontSize ?? 12
  const family = opts.fontFamily ?? 'sans-serif'
  const byId = new Map(tables.map((t) => [t.id, t]))

  // Everything a name must not cover.
  const blocked: Box[] = []
  for (const t of tables) blocked.push(rectBox(t.x, t.y, t.width, t.height, t.rotation, 3))
  for (const it of items) blocked.push(rectBox(it.x, it.y, it.width, it.height, it.rotation, 2))
  const chairs = new Map<string, { x: number; y: number; ox: number; oy: number }>()
  for (const t of tables) {
    localChairs(t).forEach((c, i) => {
      const p = rotatePoint(c.x, c.y, t.rotation)
      // Outward direction: away from the table, straight out from its side.
      let lx = 0
      let ly = 0
      if (t.shape === 'round') {
        const len = Math.hypot(c.x, c.y) || 1
        lx = c.x / len
        ly = c.y / len
      } else if (Math.abs(c.y) > t.height / 2) ly = Math.sign(c.y)
      else lx = Math.sign(c.x) || 1
      const o = rotatePoint(lx, ly, t.rotation)
      const x = t.x + p.x
      const y = t.y + p.y
      chairs.set(`${t.id}:${i}`, { x, y, ox: o.x, oy: o.y })
      blocked.push({ x0: x - CHAIR_R, y0: y - CHAIR_R, x1: x + CHAIR_R, y1: y + CHAIR_R })
    })
  }

  const placed: SeatLabel[] = []
  const placedBoxes: Box[] = []
  const placedLines: { x1: number; y1: number; x2: number; y2: number }[] = []
  const free = (b: Box) => b.x0 >= 2 && b.y0 >= 2 && b.x1 <= canvas.width - 2 && b.y1 <= canvas.height - 2
  const cost = (b: Box) => {
    let c = 0
    for (const o of blocked) c += overlap(b, o)
    for (const o of placedBoxes) c += overlap(b, o) * 2
    return c
  }

  // Busy tables first, so the tightest spots are settled before the easy ones.
  const order = [...labels].sort((a, b) => (byId.get(b.tableId)?.capacity ?? 0) - (byId.get(a.tableId)?.capacity ?? 0))

  for (const lab of order) {
    const ch = chairs.get(`${lab.tableId}:${lab.index}`)
    if (!ch) continue
    const tx = -ch.oy // along the table's side
    const ty = ch.ox
    const sx = ch.x + ch.ox * (CHAIR_R - 1)
    const sy = ch.y + ch.oy * (CHAIR_R - 1)
    // Obstacles the line may start inside (its own chair) don't count.
    const along = blocked.filter((o) => !(sx >= o.x0 - 1 && sx <= o.x1 + 1 && sy >= o.y0 - 1 && sy <= o.y1 + 1))
    let best: { b: Box; x: number; y: number; w: number; h: number; size: number; score: number; lines: string[]; end: { x: number; y: number } } | null = null
    // A full name may go on two lines or one; try the normal size first, then smaller ones.
    const variants = lab.lines.length > 1 ? [lab.lines, [lab.lines.join(' ')]] : [lab.lines]
    let clean = false
    search: for (const [vi, lines] of variants.entries()) {
      for (const [si, size] of [base, base * 0.9, base * 0.8].entries()) {
        const w = Math.max(...lines.map((l) => textWidth(l, size, family, lab.strong ? 600 : 400))) + 4
        const h = lines.length * size * LINE_H + 2
        // Half the label's depth in the outward direction.
        const depth = Math.abs(ch.ox) * (w / 2) + Math.abs(ch.oy) * (h / 2)
        for (const d of [4, 12, 22, 34, 48, 64]) {
          for (const sh of [0, 10, -10, 22, -22, 36, -36, 52, -52, 70, -70, 90, -90]) {
            const x = ch.x + ch.ox * (CHAIR_R + d + depth) + tx * sh
            const y = ch.y + ch.oy * (CHAIR_R + d + depth) + ty * sh
            const b = { x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2 }
            if (!free(b)) continue
            const hit = cost(b)
            const end = edgePoint({ x, y, w, h }, sx, sy)
            // The line: shouldn't cut across names, tables, areas or other lines.
            let cut = 0
            for (let k = 1; k < 10; k++) {
              const px = sx + ((end.x - sx) * k) / 10
              const py = sy + ((end.y - sy) * k) / 10
              if (placedBoxes.some((o) => px > o.x0 && px < o.x1 && py > o.y0 && py < o.y1)) cut += 1
              if (along.some((o) => px > o.x0 && px < o.x1 && py > o.y0 && py < o.y1)) cut += 2
            }
            const crossLines = placedLines.filter((l) => segmentsCross(sx, sy, end.x, end.y, l.x1, l.y1, l.x2, l.y2)).length
            const len = Math.hypot(end.x - sx, end.y - sy)
            const score = hit * 50 + cut * 14 + crossLines * 30 + len * 1.1 + Math.abs(sh) * 0.4 + si * 14 + vi * 6
            if (!best || score < best.score) {
              best = { b, x, y, w, h, size, score, lines, end }
              clean = hit === 0 && cut === 0 && crossLines === 0
            }
          }
          // A clean spot at this distance can't be beaten further out: stop looking.
          if (clean) break search
        }
      }
    }
    if (!best) continue
    const pick: NonNullable<typeof best> = best
    placedBoxes.push(pick.b)
    const start = { x: sx, y: sy }
    const end = pick.end
    const far = Math.hypot(end.x - start.x, end.y - start.y) > 7
    if (far) placedLines.push({ x1: start.x, y1: start.y, x2: end.x, y2: end.y })
    placed.push({
      key: `${lab.tableId}:${lab.index}`,
      lines: pick.lines,
      strong: lab.strong,
      fontSize: pick.size,
      x: pick.x,
      y: pick.y,
      w: pick.w,
      h: pick.h,
      line: far ? { x1: start.x, y1: start.y, x2: end.x, y2: end.y } : null,
    })
  }
  return placed
}
