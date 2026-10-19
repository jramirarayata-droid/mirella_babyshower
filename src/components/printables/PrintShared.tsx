import { createContext, useCallback, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Search, X } from 'lucide-react'
import { SHEETS, paperCentring, type Paper, type PaperMeasured } from '../../utils/printables'
import { cn } from '../ui/cn'

const PX_PER_MM = 96 / 25.4

/** Paper as measured (per paper size), so every printable is centred on the real sheet. */
const PaperMeasuredContext = createContext<Partial<Record<Paper, PaperMeasured>>>({})
export function PaperMeasuredProvider({ value, children }: { value: Partial<Record<Paper, PaperMeasured>>; children: ReactNode }) {
  return <PaperMeasuredContext.Provider value={value}>{children}</PaperMeasuredContext.Provider>
}

/** Print sheets, shown scaled to fit on screen and at exact size when printing. `tint`: coloured paper (preview only). */
export function Sheets({ paper, sheets, tint, portrait = false }: { paper: Paper; sheets: string[]; tint?: string; portrait?: boolean }) {
  const s = portrait ? { w: SHEETS[paper].h, h: SHEETS[paper].w } : SHEETS[paper]
  const shift = paperCentring(paper, useContext(PaperMeasuredContext)[paper], portrait)
  const place = (html: string) => (shift.x || shift.y ? `<div data-paper-shift style="position:absolute;inset:0;transform:translate(${shift.x}mm,${shift.y}mm)">${html}</div>` : html)
  const [width, setWidth] = useState(800)
  const scale = Math.min(1, width / (s.w * PX_PER_MM))
  return (
    <div
      ref={(el) => {
        if (el && Math.abs(el.clientWidth - width) > 4) setWidth(el.clientWidth)
      }}
      className="space-y-4 print:space-y-0"
    >
      {sheets.map((html, i) => (
        <div
          key={i}
          style={{ height: s.h * PX_PER_MM * scale, '--pv': scale } as CSSProperties}
          className="print-page overflow-hidden rounded-md shadow-card print:!h-auto print:overflow-hidden print:rounded-none print:shadow-none"
        >
          <div
            className="print-sheet origin-top-left [transform:scale(var(--pv))] print:[transform:none]"
            data-tint={tint}
            style={{ width: `${s.w}mm`, height: `${s.h - 1}mm`, ...(tint ? { '--paper-tint': tint } : {}) } as CSSProperties}
            dangerouslySetInnerHTML={{ __html: place(html) }}
          />
        </div>
      ))}
    </div>
  )
}

export function Tips({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-line bg-paper p-4 text-sm text-ink-soft shadow-soft">{children}</div>
}

export function Panel({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <section aria-label={label} className="space-y-4 rounded-xl border border-line bg-paper p-4 shadow-soft">
      {children}
    </section>
  )
}

/** A small set of buttons where one is chosen. */
export function Segmented<T extends string | number>({ label, value, options, onChange, cols }: { label: string; value: T; options: { v: T; l: string }[]; onChange: (v: T) => void; cols?: number }) {
  return (
    <div>
      <p className="mb-1.5 text-sm text-ink-soft">{label}</p>
      <div role="radiogroup" aria-label={label} className="grid gap-1 rounded-lg bg-cream p-1" style={{ gridTemplateColumns: `repeat(${cols ?? options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => (
          <button
            key={String(o.v)}
            type="button"
            role="radio"
            aria-checked={value === o.v}
            onClick={() => onChange(o.v)}
            className={cn('rounded-md px-2 py-1.5 text-sm transition', value === o.v ? 'bg-paper text-ink shadow-soft' : 'text-muted hover:text-ink')}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  )
}

export function EmptyPreview({ children }: { children: ReactNode }) {
  return <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-line px-6 text-center text-sm text-muted print:hidden">{children}</div>
}

export type DetailKey = 'monogram' | 'names' | 'date'
const DETAIL_LABELS: Record<DetailKey, string> = { monogram: 'Monogram', names: 'Our names', date: 'Wedding date' }

/** "Our details": switch the monogram, names and date on or off for one printable. */
export function OurDetailsSwitches({
  value,
  onChange,
  keys = ['monogram', 'names', 'date'],
  note,
}: {
  value: Record<DetailKey, boolean>
  onChange: (v: Record<DetailKey, boolean>) => void
  keys?: DetailKey[]
  note?: string
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1.5 text-sm text-ink-soft">Our details</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {keys.map((k) => (
          <label key={k} className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" className="size-4 accent-ink" checked={value[k]} onChange={(e) => onChange({ ...value, [k]: e.target.checked })} />
            {DETAIL_LABELS[k]}
          </label>
        ))}
      </div>
      {note && <p className="text-xs text-muted">{note}</p>}
    </fieldset>
  )
}

// ---------------------------------------------------------------- workspace: settings column, print bar, preview

/** The settings sections (internal keys kept from the earlier toolbar), plus the side panel and the print bar. */
export type RibbonPaneKey = 'page' | 'content' | 'details' | 'print' | 'side' | 'bar'
type SectionKey = 'content' | 'details' | 'page' | 'print'
export const RIBBON_PANES: { key: SectionKey; label: string; hint: string }[] = [
  { key: 'content', label: 'Content', hint: 'Wording and what goes on the card' },
  { key: 'details', label: 'Monogram, names & date', hint: 'Show or hide our details' },
  { key: 'page', label: 'Paper & design', hint: 'Paper, card size, style, border' },
  { key: 'print', label: 'Printing', hint: 'Fronts or backs, lining up both sides' },
]

type PaneNodes = Partial<Record<RibbonPaneKey, HTMLElement | null>>
interface RibbonApi {
  nodes: PaneNodes
  setNode: (k: RibbonPaneKey, el: HTMLElement | null) => void
  used: Partial<Record<RibbonPaneKey, number>>
  use: (k: RibbonPaneKey, d: 1 | -1) => void
  column: boolean
}
const RibbonContext = createContext<RibbonApi>({ nodes: {}, setNode: () => undefined, used: {}, use: () => undefined, column: false })

/** Wraps the whole Printables page, so every printable can put controls into the settings column and the print bar. */
export function RibbonProvider({ children }: { children: ReactNode }) {
  const [nodes, setNodes] = useState<PaneNodes>({})
  const [used, setUsed] = useState<Partial<Record<RibbonPaneKey, number>>>({})
  const setNode = useCallback((k: RibbonPaneKey, el: HTMLElement | null) => {
    if (el) setNodes((n) => (n[k] === el ? n : { ...n, [k]: el }))
  }, [])
  const use = useCallback((k: RibbonPaneKey, d: 1 | -1) => setUsed((u) => ({ ...u, [k]: Math.max(0, (u[k] ?? 0) + d) })), [])
  const value = useMemo(() => ({ nodes, setNode, used, use, column: true }), [nodes, setNode, used, use])
  return <RibbonContext.Provider value={value}>{children}</RibbonContext.Provider>
}

const OPEN_KEY = 'printables-open-section'
function readOpen(): SectionKey | null {
  try {
    const v = localStorage.getItem(OPEN_KEY)
    return v === 'content' || v === 'details' || v === 'page' || v === 'print' ? v : null
  } catch {
    return null
  }
}

/**
 * The Printables workspace: the printable picker on top; on the left the settings
 * in folding sections (one open at a time) and the printable's own panel (guests,
 * tables…); on the right the print bar and the preview. On tablets and phones the
 * columns stack and the print bar stays at the bottom of the screen.
 */
export function Ribbon({ head, children, main, pane, onPane }: { head: ReactNode; children: ReactNode; main: ReactNode; pane?: RibbonPaneKey | null; onPane?: (p: RibbonPaneKey | null) => void }) {
  const { setNode, used } = useContext(RibbonContext)
  const [ownOpen, setOwnOpen] = useState<SectionKey | null>(readOpen)
  const open = pane === undefined ? ownOpen : (pane as SectionKey | null)
  const toggle = (k: SectionKey) => {
    const next = open === k ? null : k
    setOwnOpen(next)
    onPane?.(next)
    try {
      if (next) localStorage.setItem(OPEN_KEY, next)
      else localStorage.removeItem(OPEN_KEY)
    } catch {
      /* private window — nothing to remember */
    }
  }
  const sections = RIBBON_PANES.filter((p) => (used[p.key] ?? 0) > 0)
  return (
    <>
      <div data-ribbon className="mb-5 print:hidden">
        {head}
      </div>
      <div data-workspace className="pb-28 xl:grid xl:grid-cols-[minmax(340px,400px)_minmax(0,1fr)] xl:items-start xl:gap-6 xl:pb-0 print:block print:pb-0">
        <div data-settings className="space-y-4 print:hidden xl:sticky xl:top-4 xl:max-h-[calc(100dvh-2rem)] xl:overflow-y-auto xl:overscroll-contain xl:pb-2 xl:pr-1">
          <div role="group" aria-label="Printables toolbar" className="divide-y divide-line rounded-xl border border-line bg-paper shadow-soft [&:empty]:hidden">
            {sections.map((p) => {
              const isOpen = open === p.key
              return (
                <div key={p.key}>
                  <h2 className="m-0">
                    <button
                      type="button"
                      id={`ribbon-tab-${p.key}`}
                      aria-expanded={isOpen}
                      aria-controls={`ribbon-pane-${p.key}`}
                      onClick={() => toggle(p.key)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left font-sans transition hover:bg-cream/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-sans text-[0.95rem] font-medium text-ink">{p.label}</span>
                        <span className="block truncate text-xs text-muted">{p.hint}</span>
                      </span>
                      <svg aria-hidden="true" viewBox="0 0 20 20" className={cn('size-4 shrink-0 text-muted transition-transform', isOpen && 'rotate-180')}>
                        <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </h2>
                  <div
                    ref={(el) => setNode(p.key, el)}
                    id={`ribbon-pane-${p.key}`}
                    role="region"
                    aria-labelledby={`ribbon-tab-${p.key}`}
                    hidden={!isOpen}
                    className="space-y-4 px-4 pb-4 pt-1"
                  />
                </div>
              )
            })}
          </div>
          <div ref={(el) => setNode('side', el)} className="[&:empty]:hidden" />
        </div>
        <div className="mt-5 min-w-0 xl:mt-0 print:mt-0">
          <div
            ref={(el) => setNode('bar', el)}
            data-print-bar
            className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ivory/95 px-4 py-3 shadow-[0_-6px_20px_-12px_rgba(0,0,0,0.25)] backdrop-blur lg:left-[var(--sidebar-w,0px)] xl:sticky xl:top-4 xl:mb-4 xl:rounded-xl xl:border xl:bg-paper/95 xl:shadow-soft print:hidden [&:empty]:hidden"
          />
          {main}
        </div>
      </div>
      {children}
    </>
  )
}

/** Puts controls into a settings section, the side panel or the print bar. */
export function RibbonPane({ pane, children }: { pane: RibbonPaneKey; children: ReactNode }) {
  const { nodes, use } = useContext(RibbonContext)
  useEffect(() => {
    use(pane, 1)
    return () => use(pane, -1)
  }, [pane, use])
  const node = nodes[pane]
  return node ? createPortal(children, node) : null
}

/** The print bar above the preview: what will print, and the Print button. */
export function PrintBar({ summary, children, note, below }: { summary: ReactNode; children: ReactNode; note?: ReactNode; below?: ReactNode }) {
  return (
    <RibbonPane pane="bar">
      <div role="group" aria-label="Print" className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-56">
          <p data-print-summary className="text-sm font-medium text-ink">
            {summary}
          </p>
          <p className="hidden text-xs text-muted sm:block">{note ?? 'In the print window choose Actual size (100%).'}</p>
        </div>
        <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">{children}</div>
      </div>
      {below}
    </RibbonPane>
  )
}

/** "4 invitations · 2 sheets · A4" */
export function printSummary(parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' · ')
}

/** One labelled group of settings inside a section. */
export function RibbonGroup({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  // Widths were set for the old toolbar row; in the settings column every group uses the full width.
  const rest = (className ?? '').replace(/(^|\s)(max-)?w-\S+/g, ' ').trim()
  return (
    <section aria-label={label} className={cn('space-y-2 border-t border-line/70 pt-3 first:border-t-0 first:pt-0', rest)}>
      <h3 className="text-[0.68rem] font-medium uppercase tracking-[0.16em] text-muted">{label}</h3>
      <div className="space-y-2.5">{children}</div>
    </section>
  )
}

/** Longer how-to notes, folded away under the controls. */
export function TipsFold({ title = 'Printing tips', children }: { title?: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl border border-line bg-paper text-sm text-ink-soft shadow-soft">
      <summary className="cursor-pointer select-none px-4 py-3 font-medium text-ink marker:text-muted">{title}</summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  )
}

// ---------------------------------------------------------------- guest search

/** Lower-case, without accents — so "jose" finds "José". */
export const fold = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
/** Does `query` match any of these texts (each word anywhere, any order)? */
export function matches(query: string, ...texts: (string | null | undefined)[]): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const hay = fold(texts.filter(Boolean).join(' '))
  return words.every((w) => hay.includes(w))
}

export function GuestSearch({ value, onChange, count, total, label = 'Search guests' }: { value: string; onChange: (v: string) => void; count: number; total: number; label?: string }) {
  return (
    <div className="space-y-1">
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          aria-label={label}
          placeholder="Search a name, party or table…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-base min-h-10 py-1.5 pl-9 pr-9"
        />
        {value && (
          <button type="button" aria-label="Clear search" onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink">
            <X aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>
      {value.trim() && (
        <p aria-live="polite" className="text-xs text-muted">
          {count === 0 ? 'No one matches — ticked guests stay ticked.' : `${count} of ${total} shown · ticked guests stay ticked`}
        </p>
      )}
    </div>
  )
}
