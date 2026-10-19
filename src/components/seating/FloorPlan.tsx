import type { PointerEvent as ReactPointerEvent, Ref } from 'react'
import type { SeatingConfig, SeatingItem, SeatingTable } from '../../types/seating'
import { ITEM_KINDS } from '../../types/seating'
import { useMemo } from 'react'
import { chairsFor, itemLocation } from '../../utils/seatingGeometry'
import { layoutSeatLabels } from '../../utils/seatLabels'
import { cn } from '../ui/cn'

export type ObjectKind = 'table' | 'item' | 'room'
export type DragAction = 'move' | 'resize' | 'rotate' | 'resize-tl'

export interface ChairInfo {
  name: string
  /** filled = someone sits here · you/party = Find My Seat highlight */
  state: 'filled' | 'you' | 'party'
  /** Seats pre-assigned before RSVP: green = confirmed, red = declined, gold = waiting for an answer. */
  status?: SeatStatus
}

export type SeatStatus = 'confirmed' | 'declined' | 'pending'

const STATUS_FILL: Record<SeatStatus, string> = {
  confirmed: 'fill-sage stroke-sage',
  declined: 'fill-rose stroke-rose',
  pending: 'fill-gold/60 stroke-gold',
}

function chairFill(info: ChairInfo | null): string {
  if (info?.status) return STATUS_FILL[info.status]
  if (info?.state === 'you') return 'fill-gold stroke-gold'
  if (info?.state === 'party') return 'fill-champagne stroke-gold'
  return info ? 'fill-ink-soft stroke-ink-soft' : 'fill-paper stroke-champagne'
}

interface Props {
  config: SeatingConfig
  tables: SeatingTable[]
  items: SeatingItem[]
  chair?: (tableId: string, index: number) => ChairInfo | null
  /** Admin: "4/10" under table names. */
  counts?: Map<string, number>
  highlightTableId?: string | null
  /** Softly fade every other table (guest view). */
  dimOthers?: boolean
  selected?: { kind: ObjectKind; id: string } | null
  editable?: boolean
  showNames?: boolean
  /** How names next to chairs read: first name (default) or full name on two lines (image export). */
  nameStyle?: 'first' | 'full'
  /** Current zoom, so handles stay the same size on screen. */
  zoom?: number
  svgRef?: Ref<SVGSVGElement>
  className?: string
  onObjectPointerDown?: (e: ReactPointerEvent, kind: ObjectKind, id: string, action: DragAction) => void
  onChairClick?: (tableId: string, index: number) => void
  onBackgroundPointerDown?: () => void
}

export const STATUS_TEXT: Record<SeatStatus, string> = { confirmed: 'confirmed', declined: 'declined', pending: 'waiting for RSVP' }

const kindLabel = (k: string) => ITEM_KINDS.find((x) => x.kind === k)?.label ?? 'Item'

export function FloorPlan({
  config,
  tables,
  items,
  chair,
  counts,
  highlightTableId,
  dimOthers,
  selected,
  editable,
  showNames,
  nameStyle = 'first',
  zoom = 1,
  svgRef,
  className,
  onObjectPointerDown,
  onChairClick,
  onBackgroundPointerDown,
}: Props) {
  const { room, canvas } = config
  const h = 9 / zoom // handle radius, constant on screen
  const isSel = (kind: ObjectKind, id: string) => selected?.kind === kind && selected.id === id
  const down = (kind: ObjectKind, id: string, action: DragAction) => (e: ReactPointerEvent) => {
    if (!editable || !onObjectPointerDown) return
    e.stopPropagation()
    onObjectPointerDown(e, kind, id, action)
  }

  const handles = (kind: ObjectKind, id: string, w: number, hgt: number, rotate: boolean) => (
    <g>
      <rect x={-w / 2 - 6} y={-hgt / 2 - 6} width={w + 12} height={hgt + 12} rx={8} className="fill-none stroke-gold" strokeDasharray="6 5" strokeWidth={1.5 / zoom} />
      <circle
        cx={w / 2 + 6}
        cy={hgt / 2 + 6}
        r={h}
        className="cursor-nwse-resize fill-paper stroke-gold"
        strokeWidth={2 / zoom}
        style={{ touchAction: 'none' }}
        onPointerDown={down(kind, id, 'resize')}
      >
        <title>Drag to resize</title>
      </circle>
      {rotate && (
        <>
          <line x1={0} y1={-hgt / 2 - 6} x2={0} y2={-hgt / 2 - 6 - 28 / zoom} className="stroke-gold" strokeWidth={1.5 / zoom} />
          <circle
            cx={0}
            cy={-hgt / 2 - 6 - 28 / zoom}
            r={h}
            className="cursor-grab fill-gold stroke-paper"
            strokeWidth={2 / zoom}
            style={{ touchAction: 'none' }}
            onPointerDown={down(kind, id, 'rotate')}
          >
            <title>Drag to rotate</title>
          </circle>
        </>
      )}
    </g>
  )

  // All names on: place them clear of each other, with a line to each chair.
  const labelInputs = showNames
    ? tables.flatMap((t) =>
        chairsFor(t).flatMap((_, i) => {
          const info = chair?.(t.id, i)
          if (!info) return []
          const words = info.name.trim().split(/\s+/)
          const lines = nameStyle === 'full' ? (words.length > 1 ? [words.slice(0, -1).join(' '), words.at(-1)!] : [info.name]) : [info.state === 'you' ? 'You' : words[0]]
          return [{ tableId: t.id, index: i, lines, strong: info.state === 'you' }]
        }),
      )
    : []
  const labelKey = JSON.stringify(labelInputs)
  const layoutKey = JSON.stringify([tables.map((t) => [t.id, t.x, t.y, t.width, t.height, t.rotation, t.capacity, t.shape, t.seatSides]), items.map((i) => [i.x, i.y, i.width, i.height, i.rotation]), canvas])
  const seatLabels = useMemo(
    () => (showNames ? layoutSeatLabels({ tables, items, canvas, labels: labelInputs, fontSize: nameStyle === 'full' ? 11 : 12, fontFamily: getComputedStyle(document.body).fontFamily }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showNames, labelKey, layoutKey, nameStyle],
  )

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${canvas.width} ${canvas.height}`}
      className={cn('block select-none', className)}
      role="img"
      aria-label="Seating plan of the venue"
      onPointerDown={() => onBackgroundPointerDown?.()}
    >
      <defs>
        <pattern id="fp-garden" width="26" height="26" patternUnits="userSpaceOnUse">
          <circle cx="4" cy="4" r="1.6" className="fill-sage/35" />
          <circle cx="17" cy="16" r="1.2" className="fill-sage/25" />
        </pattern>
        <pattern id="fp-floor" width="30" height="30" patternUnits="userSpaceOnUse">
          <rect width="30" height="30" className="fill-paper" />
          <rect width="15" height="15" className="fill-champagne-light" />
          <rect x="15" y="15" width="15" height="15" className="fill-champagne-light" />
        </pattern>
      </defs>

      {/* Outside area */}
      <rect width={canvas.width} height={canvas.height} className="fill-cream" />
      <rect width={canvas.width} height={canvas.height} fill="url(#fp-garden)" />
      <text x={24} y={40} className="fill-sage text-[18px] font-medium uppercase tracking-[0.3em]">
        Outside
      </text>

      {/* The hall */}
      <g>
        <rect x={room.x} y={room.y} width={room.width} height={room.height} className="fill-paper" />
        <rect
          x={room.x}
          y={room.y}
          width={room.width}
          height={room.height}
          className={cn('fill-none stroke-ink-soft/70', editable && 'cursor-move')}
          strokeWidth={6}
          style={editable ? { touchAction: 'none' } : undefined}
          onPointerDown={down('room', 'room', 'move')}
        />
        <rect x={room.x + 9} y={room.y + 9} width={room.width - 18} height={room.height - 18} className="pointer-events-none fill-none stroke-line" strokeWidth={1.5} />
        <text x={room.x + 22} y={room.y + 38} className="pointer-events-none fill-muted text-[16px] font-medium uppercase tracking-[0.3em]">
          Inside the hall
        </text>
        {editable && isSel('room', 'room') && (
          <g>
            <circle
              cx={room.x}
              cy={room.y}
              r={h}
              className="cursor-nwse-resize fill-paper stroke-gold"
              strokeWidth={2 / zoom}
              style={{ touchAction: 'none' }}
              onPointerDown={down('room', 'room', 'resize-tl')}
            />
            <circle
              cx={room.x + room.width}
              cy={room.y + room.height}
              r={h}
              className="cursor-nwse-resize fill-paper stroke-gold"
              strokeWidth={2 / zoom}
              style={{ touchAction: 'none' }}
              onPointerDown={down('room', 'room', 'resize')}
            />
          </g>
        )}
      </g>

      {/* Non-seat items */}
      {items.map((it) => {
        const outside = itemLocation(it, room) === 'outside'
        const label = it.label.trim() || kindLabel(it.kind)
        return (
          <g
            key={it.id}
            transform={`translate(${it.x} ${it.y}) rotate(${it.rotation})`}
            className={cn(dimOthers && 'opacity-70')}
          >
            <rect
              x={-it.width / 2}
              y={-it.height / 2}
              width={it.width}
              height={it.height}
              rx={it.kind === 'cake' ? it.width / 2 : 10}
              className={cn(
                it.kind === 'stage'
                  ? 'fill-champagne-light stroke-gold'
                  : it.kind === 'entrance'
                    ? 'fill-paper stroke-ink-soft'
                    : it.kind === 'dance_floor'
                      ? 'stroke-champagne'
                      : 'fill-paper stroke-champagne',
                editable && 'cursor-move',
              )}
              fill={it.kind === 'dance_floor' ? 'url(#fp-floor)' : undefined}
              strokeWidth={it.kind === 'stage' ? 2.5 : 1.8}
              strokeDasharray={it.kind === 'entrance' ? '8 6' : undefined}
              style={editable ? { touchAction: 'none' } : undefined}
              onPointerDown={down('item', it.id, 'move')}
            />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              y={outside ? -8 : 0}
              className="pointer-events-none fill-ink text-[15px] font-medium uppercase tracking-[0.18em]"
              transform={`rotate(${-it.rotation})`}
            >
              {label}
            </text>
            {outside && (
              <text textAnchor="middle" dominantBaseline="central" y={12} transform={`rotate(${-it.rotation})`} className="pointer-events-none fill-sage text-[11px] font-semibold uppercase tracking-[0.2em]">
                Outside
              </text>
            )}
            {editable && isSel('item', it.id) && handles('item', it.id, it.width, it.height, true)}
          </g>
        )
      })}

      {/* Tables */}
      {tables.map((t) => {
        const hl = highlightTableId === t.id
        const chairs = chairsFor(t)
        const count = counts?.get(t.id)
        return (
          <g key={t.id} className={cn(dimOthers && !hl && 'opacity-45')}>
            {/* chairs (canvas coordinates) */}
            {chairs.map((c, i) => {
              const info = chair?.(t.id, i) ?? null
              const outward = { x: c.x - t.x, y: c.y - t.y }
              const len = Math.hypot(outward.x, outward.y) || 1
              return (
                <g
                  key={i}
                  data-chair={`${t.id}:${i}`}
                  transform={`translate(${c.x} ${c.y})`}
                  className={cn(onChairClick && 'cursor-pointer')}
                  onPointerDown={(e) => onChairClick && e.stopPropagation()}
                  onClick={() => onChairClick?.(t.id, i)}
                >
                  <circle r={17} className="fill-transparent" />
                  <g transform={`rotate(${c.facing})`}>
                    <path d="M-12 11 C-12 3 -7 1 0 1 C7 1 12 3 12 11 Z" className={chairFill(info)} strokeWidth={1.6} />
                    <circle cy={-6} r={6} className={chairFill(info)} strokeWidth={1.6} />
                  </g>
                  {info?.state === 'you' && (
                    <circle
                      r={22}
                      className={cn('pointer-events-none fill-none motion-safe:animate-pulse', info.status === 'confirmed' ? 'stroke-sage' : info.status === 'declined' ? 'stroke-rose' : 'stroke-gold')}
                      strokeWidth={2.5}
                    />
                  )}
                  <title>{info ? `${info.name}${info.status ? ` — ${STATUS_TEXT[info.status]}` : ''}` : `Chair ${i + 1} — empty`}</title>
                  {!showNames && (info?.state === 'you' || info?.state === 'party') && info && (
                    <text
                      x={(outward.x / len) * (nameStyle === 'full' ? 30 : 26)}
                      y={(outward.y / len) * (nameStyle === 'full' ? 30 : 26)}
                      textAnchor={Math.abs(outward.x / len) < 0.35 ? 'middle' : outward.x > 0 ? 'start' : 'end'}
                      dominantBaseline="central"
                      className={cn('pointer-events-none text-[12px]', info.state === 'you' ? 'fill-ink font-semibold' : 'fill-ink-soft')}
                    >
                      {info.state === 'you' ? 'You' : nameStyle === 'full' ? <FullName name={info.name} x={(outward.x / len) * 30} /> : info.name.split(' ')[0]}
                    </text>
                  )}
                </g>
              )
            })}
            {/* table top */}
            <g transform={`translate(${t.x} ${t.y}) rotate(${t.rotation})`}>
              {t.shape === 'round' ? (
                <ellipse
                  rx={t.width / 2}
                  ry={t.height / 2}
                  className={cn(hl ? 'fill-champagne-light stroke-gold' : 'fill-linen stroke-champagne', editable && 'cursor-move')}
                  strokeWidth={hl ? 3.5 : 2}
                  style={editable ? { touchAction: 'none' } : undefined}
                  onPointerDown={down('table', t.id, 'move')}
                />
              ) : (
                <rect
                  x={-t.width / 2}
                  y={-t.height / 2}
                  width={t.width}
                  height={t.height}
                  rx={8}
                  className={cn(hl ? 'fill-champagne-light stroke-gold' : 'fill-linen stroke-champagne', editable && 'cursor-move')}
                  strokeWidth={hl ? 3.5 : 2}
                  style={editable ? { touchAction: 'none' } : undefined}
                  onPointerDown={down('table', t.id, 'move')}
                />
              )}
              <g transform={`rotate(${-t.rotation})`} className="pointer-events-none">
                <text textAnchor="middle" dominantBaseline="central" y={count !== undefined ? -8 : 0} className="fill-ink font-serif text-[19px]">
                  {t.name}
                </text>
                {count !== undefined && (
                  <text textAnchor="middle" dominantBaseline="central" y={14} className={cn('text-[12px] tabular-nums', count >= t.capacity ? 'fill-gold' : 'fill-muted')}>
                    {count}/{t.capacity}
                  </text>
                )}
              </g>
              {editable && isSel('table', t.id) && handles('table', t.id, t.width, t.height, true)}
            </g>
          </g>
        )
      })}

      {/* Names, each joined to its chair by a fine line. */}
      {seatLabels.length > 0 && (
        <g className="pointer-events-none" aria-hidden="true">
          {seatLabels.map((l) =>
            l.line ? (
              <g key={`l-${l.key}`}>
                <line x1={l.line.x1} y1={l.line.y1} x2={l.line.x2} y2={l.line.y2} className="stroke-champagne" strokeWidth={1} />
                <circle cx={l.line.x1} cy={l.line.y1} r={1.8} className="fill-champagne" />
              </g>
            ) : null,
          )}
          {seatLabels.map((l) => (
            <text
              key={`t-${l.key}`}
              x={l.x}
              y={l.y - ((l.lines.length - 1) * l.fontSize * 1.18) / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={l.fontSize}
              className={cn('fill-ink-soft stroke-paper', l.strong && 'fill-ink font-semibold')}
              strokeWidth={3}
              strokeLinejoin="round"
              paintOrder="stroke"
            >
              {l.lines.map((line, i) => (
                <tspan key={i} x={l.x} dy={i === 0 ? 0 : l.fontSize * 1.18}>
                  {line}
                </tspan>
              ))}
            </text>
          ))}
        </g>
      )}
    </svg>
  )
}

/** A full name on two short lines (given names, then surname) so it fits beside a chair. */
function FullName({ name, x }: { name: string; x: number }) {
  const words = name.trim().split(/\s+/)
  if (words.length < 2) return <>{name}</>
  const last = words.pop()!
  return (
    <>
      <tspan dy="-0.6em">{words.join(' ')}</tspan>
      <tspan x={x} dy="1.2em">
        {last}
      </tspan>
    </>
  )
}
