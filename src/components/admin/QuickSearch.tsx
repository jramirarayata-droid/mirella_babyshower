import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ArrowRight, FileText, Search, User } from 'lucide-react'
import type { AdminData } from '../../services/adminService'
import { Modal } from '../ui/Modal'
import { cn } from '../ui/cn'

export interface QuickPage {
  to: string
  label: string
}

interface Result {
  key: string
  kind: 'guest' | 'page'
  title: string
  sub: string
  to: string
  state?: unknown
}

const fold = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const STATUS: Record<string, string> = { attending: 'Attending', declining: 'Can’t come', pending: 'No reply yet' }

/** Ctrl/⌘+K: find any guest (invitee, included guest or guest request) or admin page, and jump to it. */
export function QuickSearch({ open, onClose, data, pages, go }: { open: boolean; onClose: () => void; data: AdminData | null; pages: QuickPage[]; go: (to: string, state?: unknown) => void }) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const list = useRef<HTMLUListElement>(null)
  useEffect(() => {
    if (open) {
      setQ('')
      setActive(0)
    }
  }, [open])

  const results = useMemo<Result[]>(() => {
    const words = fold(q).split(/\s+/).filter(Boolean)
    if (!words.length) return pages.slice(0, 6).map((p) => ({ key: p.to, kind: 'page', title: p.label, sub: 'Go to page', to: p.to }))
    const hit = (...texts: (string | null | undefined)[]) => {
      const hay = fold(texts.filter(Boolean).join(' '))
      return words.every((w) => hay.includes(w))
    }
    const out: Result[] = []
    for (const inv of data?.invitations ?? []) {
      if (!hit(inv.inviteeName, inv.addressedAs)) continue
      const bits = [inv.side === 'bride' ? 'Bride’s side' : 'Groom’s side', STATUS[inv.status] ?? inv.status, inv.tableNumber, inv.printedAt ? 'Printed' : '', inv.isActive ? '' : 'Inactive']
      out.push({ key: `i:${inv.id}`, kind: 'guest', title: inv.inviteeName, sub: bits.filter(Boolean).join(' · '), to: '/admin/invitations', state: { q: inv.inviteeName } })
    }
    for (const inv of data?.invitations ?? []) {
      for (const g of inv.guests) {
        if (!hit(g.guestName)) continue
        const how = g.addedBy === 'admin' ? `Included in ${inv.inviteeName}’s invitation` : `Requested by ${inv.inviteeName} · ${g.status === 'approved' ? 'approved' : g.status === 'declined' ? 'declined' : 'waiting for approval'}`
        out.push({ key: `g:${g.id}`, kind: 'guest', title: g.guestName, sub: `${how} · ${STATUS[inv.status] ?? inv.status}`, to: g.addedBy === 'admin' ? '/admin/invitations' : '/admin/guests', state: { q: g.addedBy === 'admin' ? inv.inviteeName : g.guestName } })
      }
    }
    const guestHits = out.slice(0, 8)
    const pageHits: Result[] = pages.filter((p) => hit(p.label)).map((p) => ({ key: p.to, kind: 'page', title: p.label, sub: 'Go to page', to: p.to }))
    return [...guestHits, ...pageHits]
  }, [q, data, pages])

  useEffect(() => setActive(0), [q])
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const pick = (r: Result | undefined) => {
    if (!r) return
    onClose()
    go(r.to, r.state)
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(results.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      pick(results[active])
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Quick search" description="Find a guest or a page. ↑ ↓ to choose, Enter to open.">
      <div className="space-y-3">
        <label className="relative block">
          <span className="sr-only">Search guests and pages</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            role="combobox"
            aria-expanded="true"
            aria-controls="quick-search-results"
            aria-activedescendant={results[active] ? `qs-${results[active].key}` : undefined}
            autoComplete="off"
            data-autofocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="A guest’s name, or a page…"
            className="input-base min-h-11 w-full pl-9"
          />
        </label>
        <ul id="quick-search-results" ref={list} role="listbox" aria-label="Results" className="max-h-[50vh] overflow-y-auto rounded-xl border border-line">
          {results.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">No guest or page matches “{q}”.</li>}
          {results.map((r, i) => (
            <li
              key={r.key}
              id={`qs-${r.key}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(r)}
              className={cn('flex cursor-pointer items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0', i === active ? 'bg-champagne-light/50' : 'hover:bg-cream')}
            >
              {r.kind === 'guest' ? <User aria-hidden="true" className="size-4 shrink-0 text-gold" /> : <FileText aria-hidden="true" className="size-4 shrink-0 text-muted" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{r.title}</span>
                <span className="block truncate text-xs text-muted">{r.sub}</span>
              </span>
              {i === active && <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted" />}
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  )
}
