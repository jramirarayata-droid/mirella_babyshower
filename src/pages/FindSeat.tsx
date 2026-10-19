import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Armchair, MapPin, Minus, Plus, Users } from 'lucide-react'
import { useWeddingSettings } from '../hooks/useWeddingSettings'
import { findMySeat, type SeatSearchResult } from '../services/seatingService'
import { isRsvpOpen } from '../services/settingsService'
import { useFinderOpen } from '../hooks/useFinderOpen'
import { knownGuest, rememberGuest } from '../utils/guestIdentity'
import { ITEM_KINDS } from '../types/seating'
import { toFriendlyMessage } from '../utils/errors'
import { formatWeddingDate } from '../utils/formatting'
import { chairsFor, itemLocation } from '../utils/seatingGeometry'
import { SearchForm } from '../components/rsvp/SearchForm'
import { FloorPlan, type SeatStatus } from '../components/seating/FloorPlan'
import { PageLoader } from '../components/ui/Spinner'
import { Ornament } from '../components/ui/Ornament'
import { PublicHeader } from '../components/wedding/PublicHeader'
import { Footer } from '../components/wedding/Footer'
import { CoupleNames } from '../components/wedding/CoupleNames'
import { cn } from '../components/ui/cn'
import { saveMySeat, savedSeat, type SavedSeat } from '../utils/offlineSaved'
import { normalizeName } from '../utils/validation'

/** Guests type their name and see their table on a read-only map. */
export default function FindSeat() {
  const { settings, loading } = useWeddingSettings()
  const reduce = useReducedMotion()
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SeatSearchResult | null>(null)
  // A name handed over from the RSVP page ("Find my seat") — kept in router state, not the URL.
  const location = useLocation()
  const [prefill] = useState(() => {
    const n = (location.state as { name?: unknown } | null)?.name
    return typeof n === 'string' ? n.slice(0, 150) : (knownGuest()?.name ?? '')
  })
  const autoSearched = useRef(false)
  // The seat kept on this phone from an earlier look-up, shown when there's no connection.
  const [saved] = useState<SavedSeat | null>(() => savedSeat())
  const [fromSaved, setFromSaved] = useState<string | null>(null)
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  const showSaved = (s: SavedSeat) => {
    setResult(s.result)
    setFromSaved(s.savedAt)
    setError(null)
  }

  useEffect(() => {
    document.title = settings ? `Find My Seat · ${settings.coupleNames}` : 'Find My Seat'
  }, [settings])

  const search = async (name: string) => {
    setSearching(true)
    setError(null)
    try {
      const r = await findMySeat(name)
      if (r.status === 'not_found') setError('We couldn’t find that name. Please type it exactly as it appears on your invitation.')
      else {
        setResult(r)
        setFromSaved(null)
        saveMySeat(r)
        if (r.name && r.status !== 'hidden') rememberGuest({ name: r.name })
      }
    } catch (e) {
      // No signal: if this phone has this guest's seat saved, show it.
      if (saved && (!name.trim() || normalizeName(saved.result.name ?? '') === normalizeName(name))) showSaved(saved)
      else setError(toFriendlyMessage(e))
    } finally {
      setSearching(false)
    }
  }

  const finderOpen = useFinderOpen()
  // Offline, the switches can't be checked — a seat saved on this phone means it was open.
  const open = finderOpen || (!online && Boolean(saved))

  // Opened with no connection: show the saved seat straight away.
  useEffect(() => {
    if (!online && saved && !result) showSaved(saved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online])

  // Arriving with a name: look it up straight away.
  useEffect(() => {
    if (!prefill || !open || autoSearched.current) return
    autoSearched.current = true
    void search(prefill)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill, open])
  const fade = reduce ? { initial: { opacity: 0 }, animate: { opacity: 1 } } : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } }

  return (
    <div className="flex min-h-[100svh] flex-col">
      <PublicHeader />
      <main className="flex flex-1 flex-col px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
        {loading && !settings ? (
          <PageLoader />
        ) : (
          <>
            <div className="mb-10 text-center">
              <p className="font-serif text-2xl font-light text-ink-soft">
                <CoupleNames names={settings?.coupleNames ?? ''} />
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.34em] text-muted">{settings ? formatWeddingDate(settings.weddingDate) : ''}</p>
              <Ornament className="mt-7" />
              <h1 className="mt-7 text-[2.5rem] leading-tight text-ink sm:text-5xl">Find My Seat</h1>
            </div>

            {!open || result?.status === 'hidden' ? (
              <Message title="Seating will be shared soon" text="We’re still arranging the tables. Please check back closer to the day. 🤍" />
            ) : !result ? (
              <>
                <p className="mx-auto -mt-4 mb-8 max-w-md text-center text-ink-soft">Type your name to see your table and where it is in the venue.</p>
                <SearchForm onSearch={(n) => void search(n)} searching={searching} error={error} initialName={prefill} />
                <p data-offline-tip className="mx-auto mt-6 max-w-sm text-center text-xs text-muted">
                  Tip: look up your seat once before you leave home — it will still show here at the venue, even without signal.
                </p>
              </>
            ) : (
              <motion.div {...fade} transition={{ duration: 0.6 }} className="mx-auto w-full max-w-4xl">
                {fromSaved && (
                  <p data-saved-seat role="status" className="mx-auto mb-6 max-w-md rounded-lg bg-cream px-4 py-2.5 text-center text-sm text-ink-soft">
                    No signal right now — this is your seat saved on this phone ({savedTime(fromSaved)}).
                  </p>
                )}
                <ResultView result={result} rsvpOpen={settings ? isRsvpOpen(settings) : false} couple={settings?.coupleNames || 'The couple'} />
                {!fromSaved && (result.status === 'seated' || result.status === 'unseated') && result.tableName && (
                  <p className="mt-6 text-center text-xs text-muted">Saved on this phone — it will show here even without signal at the venue.</p>
                )}
                <p className="mt-10 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setResult(null)
                      setError(null)
                    }}
                    className="rounded px-3 py-2 text-sm uppercase tracking-[0.2em] text-muted underline-offset-4 hover:text-ink hover:underline"
                  >
                    Search another name
                  </button>
                </p>
              </motion.div>
            )}
          </>
        )}
      </main>
      {settings && <Footer coupleNames={settings.coupleNames} weddingDate={settings.weddingDate} closingMessage={settings.closingMessage} />}
    </div>
  )
}

const savedTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  } catch {
    return 'earlier'
  }
}

function Message({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <section className="fine-frame paper-texture mx-auto w-full max-w-md rounded-sm px-7 py-12 text-center shadow-card">
      <h2 className="text-[2rem] leading-tight text-ink">{title}</h2>
      <p className="mx-auto mt-4 max-w-sm font-serif text-lg italic leading-relaxed text-ink-soft">{text}</p>
      {children}
    </section>
  )
}

function ResultView({ result: r, rsvpOpen, couple }: { result: SeatSearchResult; rsvpOpen: boolean; couple: string }) {
  const first = (r.name ?? '').split(' ')[0]
  if (r.status === 'pending') {
    return (
      <Message title={`Hi ${first}!`} text={`Please RSVP first. Once you’ve confirmed, ${couple} will assign your seat and it will appear here.`}>
        {rsvpOpen && (
          <Link to="/rsvp" className="mt-7 inline-flex min-h-12 items-center rounded-full bg-ink px-8 text-sm font-medium uppercase tracking-[0.24em] text-ivory shadow-card transition hover:bg-ink-soft">
            RSVP now
          </Link>
        )}
      </Message>
    )
  }
  if (r.status === 'declined' || (r.rsvp === 'declining' && (r.status === 'unseated' || !r.layout))) {
    return <Message title={`We’ll miss you, ${first}!`} text="Thank you for letting us know. You’ll be in our hearts on the day." />
  }
  if (r.rsvp === 'pending' && (r.status === 'unseated' || !r.layout)) {
    return (
      <Message
        title={`Hi ${first}!`}
        text={
          r.tableName
            ? `${couple} have saved you a place at ${r.tableName}. Please RSVP to confirm your seat. 🤍`
            : `Please RSVP first. Once you’ve confirmed, ${couple} will assign your seat and it will appear here.`
        }
      >
        <RsvpButton show={rsvpOpen} />
      </Message>
    )
  }
  if (r.status === 'unseated' || !r.layout) {
    return (
      <Message
        title={r.tableName ? `You’re at ${r.tableName}` : `Thank you for confirming, ${first}!`}
        text={
          r.tableName
            ? `${couple} are finalising where your table sits on the map — please check back soon. 🤍`
            : `${couple} are arranging the seats. Yours will appear here soon. 🤍`
        }
      />
    )
  }
  return <SeatedView r={r} rsvpOpen={rsvpOpen} couple={couple} />
}

function RsvpButton({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <Link to="/rsvp" className="mt-7 inline-flex min-h-12 items-center rounded-full bg-ink px-8 text-sm font-medium uppercase tracking-[0.24em] text-ivory shadow-card transition hover:bg-ink-soft">
      RSVP now
    </Link>
  )
}

const SEAT_STATUS: Record<NonNullable<SeatSearchResult['rsvp']>, SeatStatus> = { attending: 'confirmed', declining: 'declined', pending: 'pending' }

function SeatedView({ r, rsvpOpen, couple }: { r: SeatSearchResult; rsvpOpen: boolean; couple: string }) {
  // Pre-assigned seats are coloured by the party's RSVP: green confirmed, gold waiting, red declined.
  const status = r.rsvp ? SEAT_STATUS[r.rsvp] : undefined
  const first = (r.name ?? '').split(' ')[0]
  const { config, tables, items } = r.layout!
  const table = tables.find((t) => t.id === r.tableId)
  const [zoom, setZoom] = useState(1)

  const where = useMemo(() => {
    if (!table) return ''
    const inside = itemLocation({ id: '', kind: 'custom', label: '', x: table.x, y: table.y, width: 1, height: 1, rotation: 0, location: 'auto' }, config.room) === 'inside'
    const near = [...items]
      .map((i) => ({ i, d: Math.hypot(i.x - table.x, i.y - table.y) }))
      .sort((a, b) => a.d - b.d)[0]
    const nearLabel = near ? near.i.label.trim() || ITEM_KINDS.find((k) => k.kind === near.i.kind)?.label : ''
    return `${inside ? 'Inside the hall' : 'Outside'}${nearLabel ? ` · near the ${nearLabel.toLowerCase()}` : ''}`
  }, [table, items, config.room])

  const partyAt = new Map((r.party ?? []).map((p) => [p.seat, p.name]))
  const chairCount = table ? chairsFor(table).length : 0

  return (
    <div>
      <section className="fine-frame paper-texture mx-auto max-w-md rounded-sm px-7 py-10 text-center shadow-card">
        {status === 'declined' ? (
          <>
            <h2 className="text-[2rem] leading-tight text-ink">We’ll miss you, {first}!</h2>
            <p className="mx-auto mt-3 max-w-sm font-serif text-lg italic leading-relaxed text-ink-soft">
              Thank you for letting us know. The seat that was saved for you is shown in red — if your plans change, please let {couple} know.
            </p>
            <p className="mt-5 font-serif text-[2.2rem] leading-none text-ink/70 line-through decoration-rose/70">{r.tableName}</p>
          </>
        ) : (
          <>
            <p className="eyebrow">{r.name}, {status === 'pending' ? 'a seat is saved for you at' : 'your seat is at'}</p>
            <p className="mt-4 font-serif text-[2.8rem] leading-none text-ink">{r.tableName}</p>
          </>
        )}
        {status && (
          <p
            className={cn(
              'mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.18em]',
              status === 'confirmed' ? 'bg-sage/15 text-sage' : status === 'declined' ? 'bg-rose/10 text-rose' : 'bg-champagne-light/60 text-gold',
            )}
          >
            <span aria-hidden="true" className={cn('size-2 rounded-full', status === 'confirmed' ? 'bg-sage' : status === 'declined' ? 'bg-rose' : 'bg-gold')} />
            {status === 'confirmed' ? 'Confirmed' : status === 'declined' ? 'Declined' : 'Waiting for your RSVP'}
          </p>
        )}
        {typeof r.seat === 'number' && chairCount > 0 && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-champagne/60 bg-champagne-light/35 px-4 py-1.5 text-sm text-ink-soft">
            <Armchair aria-hidden="true" className="size-4 text-gold" /> Chair {r.seat + 1} of {chairCount}
          </p>
        )}
        {where && (
          <p className="mt-4 flex items-center justify-center gap-1.5 text-sm text-ink-soft">
            <MapPin aria-hidden="true" className="size-4 text-gold" /> {where}
          </p>
        )}
        {(r.party ?? []).length > 0 && (
          <p className="mt-4 flex items-start justify-center gap-1.5 text-sm text-ink-soft">
            <Users aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-gold" />
            <span>Seated with you: {(r.party ?? []).map((p) => p.name).join(', ')}</span>
          </p>
        )}
        {status === 'pending' && (
          <>
            <p className="mx-auto mt-5 max-w-xs text-sm text-ink-soft">Please RSVP to confirm your seat.</p>
            <RsvpButton show={rsvpOpen} />
          </>
        )}
      </section>

      <section aria-label="Venue map" className="mt-8 overflow-hidden rounded-xl border border-line bg-paper shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Venue map · your table is highlighted</p>
          {status && (
            <span className="hidden items-center gap-3 text-[0.7rem] text-muted sm:inline-flex">
              <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="size-2.5 rounded-full bg-sage" /> Confirmed</span>
              <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="size-2.5 rounded-full bg-gold/60 ring-1 ring-gold" /> Waiting</span>
              <span className="inline-flex items-center gap-1"><span aria-hidden="true" className="size-2.5 rounded-full bg-rose" /> Declined</span>
            </span>
          )}
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(1, z - 0.5))} className="flex size-9 items-center justify-center rounded-md hover:bg-cream disabled:opacity-30" disabled={zoom <= 1}>
              <Minus className="size-4" />
            </button>
            <button type="button" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(3, z + 0.5))} className="flex size-9 items-center justify-center rounded-md hover:bg-cream disabled:opacity-30" disabled={zoom >= 3}>
              <Plus className="size-4" />
            </button>
          </div>
        </div>
        <div className="max-h-[70vh] overflow-auto" ref={(el) => {
          if (el && table && zoom > 1) {
            const sx = (table.x / config.canvas.width) * el.scrollWidth - el.clientWidth / 2
            const sy = (table.y / config.canvas.height) * el.scrollHeight - el.clientHeight / 2
            el.scrollTo({ left: sx, top: sy })
          }
        }}>
          <div style={{ width: `${zoom * 100}%` }}>
            <FloorPlan
              config={config}
              tables={tables}
              items={items}
              highlightTableId={r.tableId}
              dimOthers
              className="h-auto w-full"
              chair={(tid, i) => {
                if (tid !== r.tableId) return null
                if (i === r.seat) return { name: r.name ?? 'You', state: 'you', status }
                const n = partyAt.get(i)
                return n ? { name: n, state: 'party', status } : null
              }}
            />
          </div>
        </div>
      </section>
    </div>
  )
}
