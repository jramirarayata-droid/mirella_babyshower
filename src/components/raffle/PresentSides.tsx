import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Crown, Maximize2, Minimize2, Trophy, X } from 'lucide-react'
import { cn } from '../ui/cn'

/** A name in one of the Present side lists. `key` must stay the same for the same result. */
export interface BoardEntry {
  key: string
  name: string
  /** Winners: "Winner", "2nd place", … */
  title?: string
  prize?: string
  /** The last one standing (or a first-spin winner): shown a little grander. */
  champion?: boolean
}

const MAX_OUT = 12
const MAX_WIN = 7
const SPRING = { type: 'spring', stiffness: 260, damping: 26 } as const

/** Holds a list still while `paused` (e.g. during a big reveal), then lets the new names animate in. */
function useHeld(list: BoardEntry[], paused: boolean): BoardEntry[] {
  const sig = list.map((e) => e.key).join('|')
  const [held, setHeld] = useState({ sig, list })
  if (!paused && held.sig !== sig) setHeld({ sig, list })
  return paused ? held.list : list
}

/** Left of the wheel: names knocked out, newest on top, older ones fading down the stack. */
export function OutStack({ entries, paused = false, className }: { entries: BoardEntry[]; paused?: boolean; className?: string }) {
  const reduce = useReducedMotion()
  const list = useHeld(entries, paused)
  const shown = [...list].reverse().slice(0, MAX_OUT)
  const more = list.length - shown.length
  return (
    <aside aria-label="Knocked out" data-raffle-out className={cn('flex min-w-0 flex-col', className)}>
      <div className="flex items-center gap-3">
        <p className="text-[clamp(0.7rem,0.9vw,0.95rem)] font-medium uppercase tracking-[0.35em] text-muted">Out of the running</p>
        <motion.span
          key={list.length}
          initial={reduce ? false : { scale: 1.35 }}
          animate={{ scale: 1 }}
          className="rounded-full bg-cream px-2.5 py-0.5 text-sm tabular-nums text-ink-soft ring-1 ring-line"
        >
          {list.length}
        </motion.span>
      </div>
      <ol className="mt-4 space-y-2">
        <AnimatePresence initial={false}>
          {shown.map((e, i) => (
            <motion.li
              key={e.key}
              layout={!reduce}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: -56, scale: 0.94 }}
              animate={{ opacity: Math.max(0.32, 1 - i * 0.07), x: 0, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.25 } }}
              transition={SPRING}
              className="relative flex min-w-0 items-center gap-3 overflow-hidden rounded-full border border-line/80 bg-paper/85 px-4 py-[clamp(0.35rem,0.6vh,0.6rem)] shadow-soft"
            >
              {/* a soft rose flash on the newest name */}
              {!reduce && <motion.span aria-hidden="true" className="absolute inset-0 bg-rose/15" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 1.6, ease: 'easeOut' }} />}
              <X aria-hidden="true" className="relative size-4 shrink-0 text-rose/70" strokeWidth={2} />
              <span className="relative truncate font-serif text-[clamp(1rem,1.45vw,1.65rem)] text-ink-soft line-through decoration-ink/25 decoration-1">{e.name}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
      {more > 0 && <p className="mt-3 pl-4 text-sm text-muted">+ {more} more</p>}
    </aside>
  )
}

/** Right of the wheel: winners and places, newest on top, each arriving with a gold shimmer. */
export function WinnersStack({ entries, paused = false, className }: { entries: BoardEntry[]; paused?: boolean; className?: string }) {
  const reduce = useReducedMotion()
  const list = useHeld(entries, paused)
  const shown = [...list].reverse().slice(0, MAX_WIN)
  const more = list.length - shown.length
  return (
    <aside aria-label="Winners" data-raffle-winners className={cn('flex min-w-0 flex-col', className)}>
      <div className="flex items-center gap-3">
        <Trophy aria-hidden="true" className="size-5 text-gold" strokeWidth={1.6} />
        <p className="text-[clamp(0.7rem,0.9vw,0.95rem)] font-medium uppercase tracking-[0.35em] text-gold">Winners</p>
        {list.length > 0 && <span className="rounded-full bg-champagne-light/60 px-2.5 py-0.5 text-sm tabular-nums text-gold ring-1 ring-champagne/40">{list.length}</span>}
      </div>
      {list.length === 0 ? (
        <p className="mt-4 font-serif text-[clamp(1rem,1.3vw,1.4rem)] italic text-muted">Who will it be?</p>
      ) : (
        <ol className="mt-4 space-y-3">
          <AnimatePresence initial={false}>
            {shown.map((e) => (
              <motion.li
                key={e.key}
                layout={!reduce}
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: 64, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.25 } }}
                transition={SPRING}
                className={cn(
                  'relative overflow-hidden rounded-2xl border bg-paper px-5 py-[clamp(0.6rem,1.1vh,1rem)] shadow-[0_14px_34px_-22px_rgba(138,110,69,0.65)]',
                  e.champion ? 'border-gold/70 ring-2 ring-champagne/50' : 'border-champagne/60',
                )}
              >
                {!reduce && (
                  <>
                    {/* a gold shimmer passes once */}
                    <motion.span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-champagne-light to-transparent"
                      initial={{ x: '0%' }}
                      animate={{ x: '520%' }}
                      transition={{ delay: 0.35, duration: 1.4, ease: 'easeInOut' }}
                    />
                    {/* a few sparkles */}
                    {Array.from({ length: 6 }, (_, k) => (
                      <motion.span
                        key={k}
                        aria-hidden="true"
                        className="pointer-events-none absolute right-6 top-1/2 size-1.5 rounded-full bg-gold"
                        initial={{ opacity: 0, x: 0, y: 0, scale: 0.6 }}
                        animate={{ opacity: [0, 1, 0], x: Math.cos((k / 6) * Math.PI * 2) * 34, y: Math.sin((k / 6) * Math.PI * 2) * 22, scale: [0.6, 1.2, 0.4] }}
                        transition={{ delay: 0.25, duration: 1.1, ease: 'easeOut' }}
                      />
                    ))}
                  </>
                )}
                <div className="relative flex items-start gap-3">
                  {e.champion && <Crown aria-hidden="true" className="mt-1 size-5 shrink-0 text-gold" strokeWidth={1.6} />}
                  <div className="min-w-0">
                    {e.title && <p className="text-[clamp(0.62rem,0.8vw,0.85rem)] font-medium uppercase tracking-[0.3em] text-gold">{e.title}</p>}
                    <p className={cn('truncate font-serif leading-tight text-ink', e.champion ? 'text-[clamp(1.35rem,2.3vw,2.6rem)]' : 'text-[clamp(1.15rem,1.8vw,2rem)]')}>{e.name}</p>
                    {e.prize && <p className="truncate font-serif text-[clamp(0.95rem,1.25vw,1.4rem)] italic text-ink-soft">{e.prize}</p>}
                  </div>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
      {more > 0 && <p className="mt-3 pl-1 text-sm text-muted">+ {more} more</p>}
    </aside>
  )
}

/** Top-right of the Present screen: full screen on/off and Close. */
export function PresentTopBar({ full, onToggleFull, onClose }: { full: boolean; onToggleFull: () => void; onClose: () => void }) {
  return (
    <div className="fixed right-5 top-5 z-[110] flex gap-2">
      <button
        type="button"
        onClick={onToggleFull}
        aria-label={full ? 'Exit full screen' : 'Full screen'}
        title={full ? 'Exit full screen' : 'Full screen'}
        className="grid size-11 place-items-center rounded-full bg-paper/90 text-ink-soft shadow-soft transition hover:bg-cream hover:text-ink"
      >
        {full ? <Minimize2 aria-hidden="true" className="size-4" /> : <Maximize2 aria-hidden="true" className="size-4" />}
      </button>
      <button
        type="button"
        onClick={onClose}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-paper/90 px-4 text-sm text-ink-soft shadow-soft transition hover:bg-cream hover:text-ink"
      >
        <X aria-hidden="true" className="size-4" /> Close
      </button>
    </div>
  )
}

/** "2nd place" etc. for a saved result; null place = a first-spin winner. */
export function placeTitle(place: number | null): string {
  if (place === null || place === 1) return 'Winner'
  const s = place % 100 >= 11 && place % 100 <= 13 ? 'th' : place % 10 === 1 ? 'st' : place % 10 === 2 ? 'nd' : place % 10 === 3 ? 'rd' : 'th'
  return `${place}${s} place`
}

/** Side-list entries from saved results: knocked-out names and winners, both oldest first. */
export function boardEntries(out: string[], winners: { name: string; prize: string | null; place: number | null }[]): { out: BoardEntry[]; winners: BoardEntry[] } {
  return {
    out: out.map((name, i) => ({ key: `o${i}-${name}`, name })),
    winners: winners.map((w, i) => ({ key: `w${i}-${w.name}`, name: w.name, title: placeTitle(w.place), prize: w.prize?.trim() || undefined, champion: w.place === 1 })),
  }
}
