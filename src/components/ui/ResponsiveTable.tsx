import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from './cn'

export interface Column<T> {
  key: string
  header: string
  cell: (row: T) => ReactNode
  className?: string
  /** Hide from the stacked mobile card view (e.g. when shown in the card title). */
  hideOnMobile?: boolean
}

interface ResponsiveTableProps<T> {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  caption: string
  mobileTitle: (row: T) => ReactNode
  mobileActions?: (row: T) => ReactNode
  empty?: ReactNode
}

/**
 * The table's own height: from where it starts on the page down to the bottom
 * of the screen (at least 360 px). The table scrolls inside it, so its
 * sideways scrollbar is always at the bottom of what you see — not at the
 * bottom of a long list. Re-measured when the window or the page above changes.
 */
function useFitToScreen(active: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const [maxH, setMaxH] = useState<number | undefined>(undefined)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let frame = 0
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const top = el.getBoundingClientRect().top + window.scrollY
        setMaxH(Math.max(360, Math.round(window.innerHeight - top - 24)))
      })
    }
    measure()
    window.addEventListener('resize', measure)
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
    ro?.observe(document.body)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
      ro?.disconnect()
    }
  }, [active])
  return { ref, maxH }
}

/** A real <table> on md+ screens and stacked cards on phones — never overflows the page. */
export function ResponsiveTable<T>({ rows, columns, rowKey, caption, mobileTitle, mobileActions, empty }: ResponsiveTableProps<T>) {
  const fit = useFitToScreen(rows.length > 0)
  if (!rows.length) {
    return <div className="px-6 py-16 text-center text-muted">{empty ?? 'Nothing to show yet.'}</div>
  }
  return (
    <>
      <div
        ref={fit.ref}
        data-table-scroll
        tabIndex={0}
        role="region"
        aria-label={`${caption} (scrolls)`}
        style={{ maxHeight: fit.maxH }}
        className="hidden overflow-auto overscroll-x-contain focus-visible:ring-2 focus-visible:ring-champagne md:block"
      >
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-line bg-ivory shadow-[0_1px_0_var(--color-line)]">
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn('whitespace-nowrap bg-ivory px-4 py-3 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted', c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-line/60 align-top transition-colors last:border-0 hover:bg-ivory/60">
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-4 py-3.5 text-ink-soft', c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-line/70 md:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li key={rowKey(row)} className="px-4 py-4">
            <div className="mb-3 font-medium text-ink">{mobileTitle(row)}</div>
            <dl className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
              {columns
                .filter((c) => !c.hideOnMobile)
                .map((c) => (
                  <div key={c.key} className="contents">
                    <dt className="text-muted">{c.header}</dt>
                    <dd className="min-w-0 break-words text-ink-soft">{c.cell(row)}</dd>
                  </div>
                ))}
            </dl>
            {mobileActions && <div className="mt-3 flex flex-wrap gap-2">{mobileActions(row)}</div>}
          </li>
        ))}
      </ul>
    </>
  )
}
