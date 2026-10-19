import { useRef, useState } from 'react'
import { ImageDown } from 'lucide-react'
import type { SeatingConfig, SeatingItem, SeatingTable } from '../../types/seating'
import { useWeddingSettings } from '../../hooks/useWeddingSettings'
import { useToast } from '../../hooks/useToast'
import { chairsFor } from '../../utils/seatingGeometry'
import { formatWeddingDate } from '../../utils/formatting'
import { readTheme } from '../../utils/printTheme'
import { canvasToBlob, downloadBlob, jpegPdf, standaloneSvg, svgToImage } from '../../utils/svgImage'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { cn } from '../ui/cn'
import { FloorPlan, STATUS_TEXT, type ChairInfo, type SeatStatus } from './FloorPlan'

type Names = 'none' | 'first' | 'full'
type Size = 'large' | 'xl'
type Format = 'png' | 'pdf'

interface Props {
  config: SeatingConfig
  tables: SeatingTable[]
  items: SeatingItem[]
  counts: Map<string, number>
  chair: (tableId: string, index: number) => ChairInfo | null
  /** Seats are pre-assigned, so chairs are coloured by RSVP — add a key. */
  statusColours?: boolean
  className?: string
}

const TARGET: Record<Size, number> = { large: 4200, xl: 8400 }
const PAD = 64
const HEADER = 178

/** Phones and iPads cap canvas size much lower than computers. */
const maxPixels = () => (/iP(hone|ad|od)|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent)) ? 16_000_000 : 60_000_000)

/**
 * "Download image": the seating plan as a sharp, high-resolution PNG (or a
 * print-ready PDF), with or without guests' names — plus, if wanted, each
 * table's guest list under the plan.
 */
export function SeatingImageExport({ config, tables, items, counts, chair, statusColours, className }: Props) {
  const { settings } = useWeddingSettings()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [names, setNames] = useState<Names>('first')
  const [list, setList] = useState(true)
  const [showCounts, setShowCounts] = useState(false)
  const [size, setSize] = useState<Size>('large')
  const [format, setFormat] = useState<Format>('png')
  const [busy, setBusy] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)

  const withList = names !== 'none' && list

  const download = async () => {
    const svg = svgRef.current
    if (!svg) return
    setBusy(true)
    try {
      const theme = readTheme()
      await Promise.all(
        [`300 56px ${theme.serif}`, `400 24px ${theme.serif}`, `500 16px ${theme.sans}`, `400 16px ${theme.sans}`].map((f) => document.fonts.load(f)),
      ).catch(() => undefined)

      const { width: cw, height: ch } = config.canvas
      const W = cw + PAD * 2

      // Guest list under the plan: one card per table, packed into columns.
      const groups = withList ? tableGroups(tables, chair) : []
      const colW = 300
      const gap = 28
      const cols = Math.max(1, Math.floor((cw + gap) / (colW + gap)))
      const colWidth = (cw - gap * (cols - 1)) / cols
      const lineH = 24
      const cards = layoutCards(groups, cols, gap, lineH)
      const listTop = HEADER + ch + 56
      const listH = cards.length ? Math.max(...cards.map((c) => c.y + c.h)) + 8 : 0
      const H = (withList && cards.length ? listTop + 40 + listH : HEADER + ch) + PAD

      let scale = TARGET[size] / W
      const cap = maxPixels()
      let reduced = false
      if (W * scale * H * scale > cap) {
        scale = Math.sqrt(cap / (W * H))
        reduced = true
      }
      const px = (n: number) => Math.round(n * scale)

      const img = await svgToImage(await standaloneSvg(svg, px(cw), px(ch)))

      const canvas = document.createElement('canvas')
      canvas.width = px(W)
      canvas.height = px(H)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('TOO_BIG')

      // Background and plan (the plan drawn at full resolution, not scaled up).
      ctx.fillStyle = theme.paper
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, px(PAD), px(HEADER), px(cw), px(ch))

      ctx.scale(scale, scale)
      ctx.strokeStyle = theme.line
      ctx.lineWidth = 2
      ctx.strokeRect(PAD, HEADER, cw, ch)

      // Header
      ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = theme.accent
      ctx.font = `500 16px ${theme.sans}`
      spaced(ctx, 'SEATING PLAN', PAD, PAD + 18, 4)
      ctx.fillStyle = theme.ink
      ctx.font = `300 56px ${theme.serif}`
      ctx.fillText(settings?.babyName ?? 'Baby Shower', PAD - 2, PAD + 78, cw * 0.62)
      if (settings?.weddingDate) {
        ctx.fillStyle = theme.muted
        ctx.font = `400 18px ${theme.sans}`
        ctx.fillText([formatWeddingDate(settings.weddingDate), settings.receptionName].filter(Boolean).join(' · '), PAD, PAD + 110, cw * 0.62)
      }
      drawKey(ctx, theme, W - PAD, PAD + 18, statusColours)

      // Guest list
      if (withList && cards.length) {
        ctx.fillStyle = theme.accent
        ctx.font = `500 16px ${theme.sans}`
        spaced(ctx, 'GUESTS BY TABLE', PAD, listTop + 16, 4)
        const top = listTop + 40
        for (const c of cards) {
          const x = PAD + c.col * (colWidth + gap)
          const y = top + c.y
          ctx.fillStyle = theme.accentLight
          roundRect(ctx, x, y, colWidth, c.h, 10)
          ctx.globalAlpha = 0.35
          ctx.fill()
          ctx.globalAlpha = 1
          ctx.strokeStyle = theme.line
          ctx.lineWidth = 1.5
          ctx.stroke()
          ctx.fillStyle = theme.ink
          ctx.font = `400 25px ${theme.serif}`
          ctx.fillText(fit(ctx, c.group.name, colWidth - 90), x + 16, y + 36)
          ctx.fillStyle = theme.muted
          ctx.font = `400 14px ${theme.sans}`
          ctx.textAlign = 'right'
          ctx.fillText(`${c.group.people.length}/${c.group.capacity}`, x + colWidth - 16, y + 34)
          ctx.textAlign = 'left'
          c.group.people.forEach((p, i) => {
            const ly = y + 66 + i * lineH
            ctx.fillStyle = theme.muted
            ctx.font = `400 13px ${theme.sans}`
            ctx.fillText(String(p.seat), x + 16, ly)
            ctx.fillStyle = theme.soft
            ctx.font = `400 16px ${theme.sans}`
            ctx.fillText(fit(ctx, p.name, colWidth - 62), x + 46, ly)
          })
          if (!c.group.people.length) {
            ctx.fillStyle = theme.muted
            ctx.font = `italic 400 15px ${theme.sans}`
            ctx.fillText('No one seated yet', x + 16, y + 66)
          }
        }
      }

      const couple = (settings?.babyName ?? 'Baby-Shower').replace(/&/g, 'and').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')
      const base = `${couple}-seating-plan${names === 'none' ? '' : '-with-names'}-${new Date().toISOString().slice(0, 10)}`
      if (format === 'pdf') {
        const jpeg = await canvasToBlob(canvas, 'image/jpeg', 0.93)
        downloadBlob(await jpegPdf(jpeg, canvas.width, canvas.height, 300), `${base}.pdf`)
      } else {
        downloadBlob(await canvasToBlob(canvas, 'image/png'), `${base}.png`)
      }
      toast.success(
        reduced
          ? `Downloaded at ${canvas.width.toLocaleString()} × ${canvas.height.toLocaleString()} px — the biggest this device can make.`
          : `Downloaded (${canvas.width.toLocaleString()} × ${canvas.height.toLocaleString()} px).`,
      )
      setOpen(false)
    } catch (e) {
      toast.error(
        e instanceof Error && e.message === 'TOO_BIG'
          ? 'That size is too big for this device. Try “Large”, or use a computer.'
          : 'The image couldn’t be made. Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  const option = (checked: boolean) =>
    cn(
      'relative flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition',
      checked ? 'border-champagne bg-champagne-light/30' : 'border-line hover:border-champagne/60',
    )

  return (
    <>
      <Button variant="outline" className={className} onClick={() => setOpen(true)} disabled={!tables.length} icon={<ImageDown aria-hidden="true" className="size-4" />}>
        Download image
      </Button>
      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        locked={busy}
        title="Download the seating plan"
        description="A high-resolution picture of the floor plan — sharp enough to print big for the venue or the welcome board."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void download()} loading={busy} loadingText="Making the image…" icon={<ImageDown aria-hidden="true" className="size-4" />}>
              Download {format === 'pdf' ? 'PDF' : 'PNG'}
            </Button>
          </>
        }
      >
        <fieldset>
          <legend className="mb-2 text-[0.95rem] font-medium text-ink-soft">Guest names</legend>
          <div className="space-y-2">
            {(
              [
                ['none', 'Without names', 'Just the tables, chairs and areas — good for the venue or suppliers.'],
                ['first', 'With first names', 'Each guest’s first name beside their chair.'],
                ['full', 'With full names', 'First and last name beside each chair, on two short lines.'],
              ] as const
            ).map(([v, label, hint]) => (
              <label key={v} className={option(names === v)}>
                <input type="radio" name="plan-names" className="mt-0.5 size-4 accent-ink" checked={names === v} onChange={() => setNames(v)} />
                <span>
                  <span className="font-medium text-ink">{label}</span>
                  <span className="mt-0.5 block text-muted">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {names !== 'none' && (
          <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 text-sm">
            <input type="checkbox" className="mt-0.5 size-4 accent-ink" checked={list} onChange={(e) => setList(e.target.checked)} />
            <span>
              <span className="font-medium text-ink">Add a list of guests by table</span>
              <span className="mt-0.5 block text-muted">Under the plan, each table with its guests’ full names and chair numbers.</span>
            </span>
          </label>
        )}
        <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-ink" checked={showCounts} onChange={(e) => setShowCounts(e.target.checked)} />
          <span>
            <span className="font-medium text-ink">Show seats filled under each table name</span>
            <span className="mt-0.5 block text-muted">E.g. “8/10”.</span>
          </span>
        </label>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <fieldset>
            <legend className="mb-2 text-[0.95rem] font-medium text-ink-soft">Size</legend>
            <div className="space-y-2">
              {(
                [
                  ['large', 'Large', 'About 4,200 px wide — sharp up to A3.'],
                  ['xl', 'Extra large', 'About 8,400 px — posters and tarpaulins. Best on a computer.'],
                ] as const
              ).map(([v, label, hint]) => (
                <label key={v} className={option(size === v)}>
                  <input type="radio" name="plan-size" className="mt-0.5 size-4 accent-ink" checked={size === v} onChange={() => setSize(v)} />
                  <span>
                    <span className="font-medium text-ink">{label}</span>
                    <span className="mt-0.5 block text-muted">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-[0.95rem] font-medium text-ink-soft">File</legend>
            <div className="space-y-2">
              {(
                [
                  ['png', 'PNG image', 'Crisp picture for sharing or printing.'],
                  ['pdf', 'PDF', 'Ready to send to a print shop (300 dpi).'],
                ] as const
              ).map(([v, label, hint]) => (
                <label key={v} className={option(format === v)}>
                  <input type="radio" name="plan-format" className="mt-0.5 size-4 accent-ink" checked={format === v} onChange={() => setFormat(v)} />
                  <span>
                    <span className="font-medium text-ink">{label}</span>
                    <span className="mt-0.5 block text-muted">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        {names !== 'none' && <p className="mt-4 text-xs text-muted">This picture shows guests’ names — share it only with people who need it.</p>}

      </Modal>
      {/* The plan the picture is made from (off-screen, never interactive). */}
      {open && (
        <div aria-hidden="true" className="pointer-events-none fixed top-0 -left-[99999px] opacity-0" style={{ width: config.canvas.width }}>
          <FloorPlan
            svgRef={svgRef}
            config={config}
            tables={tables}
            items={items}
            counts={showCounts ? counts : undefined}
            chair={chair}
            showNames={names !== 'none'}
            nameStyle={names === 'full' ? 'full' : 'first'}
            className="h-auto w-full"
          />
        </div>
      )}
    </>
  )
}

// ------------------------------------------------------------------ drawing helpers

interface Group {
  name: string
  capacity: number
  people: { seat: number; name: string }[]
}

function tableGroups(tables: SeatingTable[], chair: Props['chair']): Group[] {
  return [...tables]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, undefined, { numeric: true }))
    .map((t) => {
      const n = chairsFor(t).length
      const people: Group['people'] = []
      for (let i = 0; i < n; i++) {
        const c = chair(t.id, i)
        if (c) people.push({ seat: i + 1, name: c.name })
      }
      return { name: t.name, capacity: n, people }
    })
}

/** Places each table's card in the shortest column (keeps table order left to right). */
function layoutCards(groups: Group[], cols: number, gap: number, lineH: number) {
  const heights = new Array(cols).fill(0) as number[]
  return groups.map((group) => {
    const h = 56 + Math.max(1, group.people.length) * lineH + 6
    const col = heights.indexOf(Math.min(...heights))
    const y = heights[col]
    heights[col] += h + gap
    return { group, col, y, h }
  })
}

function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  let cx = x
  for (const ch of text) {
    ctx.fillText(ch, cx, y)
    cx += ctx.measureText(ch).width + spacing
  }
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1)
  return `${t.trimEnd()}…`
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** The colour key, right-aligned at (right, y). */
function drawKey(ctx: CanvasRenderingContext2D, theme: ReturnType<typeof readTheme>, right: number, y: number, statuses?: boolean) {
  const css = getComputedStyle(document.documentElement)
  const v = (n: string, d: string) => css.getPropertyValue(n).trim() || d
  const sage = v('--color-sage', '#6f7d68')
  const rose = v('--color-rose', '#a2574f')
  const champagne = v('--color-champagne', '#b89b6a')
  const entries: { label: string; fill: string; stroke: string; alpha?: number }[] = statuses
    ? (['confirmed', 'pending', 'declined'] as SeatStatus[]).map((s) => ({
        label: STATUS_TEXT[s][0].toUpperCase() + STATUS_TEXT[s].slice(1),
        fill: s === 'confirmed' ? sage : s === 'declined' ? rose : theme.accent,
        stroke: s === 'confirmed' ? sage : s === 'declined' ? rose : theme.accent,
        alpha: s === 'pending' ? 0.6 : 1,
      }))
    : [{ label: 'Seated', fill: theme.soft, stroke: theme.soft }]
  entries.push({ label: 'Empty chair', fill: theme.paper, stroke: champagne })
  ctx.font = `400 15px ${theme.sans}`
  let x = right
  for (const e of [...entries].reverse()) {
    const w = ctx.measureText(e.label).width
    ctx.fillStyle = theme.soft
    ctx.textAlign = 'right'
    ctx.fillText(e.label, x, y)
    ctx.textAlign = 'left'
    const cx = x - w - 16
    ctx.beginPath()
    ctx.arc(cx, y - 5, 8, 0, Math.PI * 2)
    ctx.globalAlpha = e.alpha ?? 1
    ctx.fillStyle = e.fill
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.strokeStyle = e.stroke
    ctx.lineWidth = 2
    ctx.stroke()
    x = cx - 28
  }
}
