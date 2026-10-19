import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CheckCircle2, Maximize2, Play, RotateCcw, Square, Undo2 } from 'lucide-react'
import { useWeddingSettings } from '../../hooks/useWeddingSettings'
import {
  BINGO_MAX,
  LETTERS,
  NEW_GAME,
  callLabel,
  colorFor,
  drawNumber,
  letterFor,
  loadBingo,
  parseCard,
  remainingNumbers,
  saveBingo,
  type BingoGameState,
} from '../../utils/bingo'
import { playBallOut, playDrumroll, stopSuspense, unlockSound } from '../../utils/raffleSounds'
import { PageHeader } from '../admin/PageHeader'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { cn } from '../ui/cn'
import { BingoDrum } from './BingoDrum'
import { SoundControls } from './RaffleWheel'
import { BigReveal } from './BigReveal'
import { PresentTopBar } from './PresentSides'
import { usePresentScreen } from '../../hooks/usePresentScreen'

type Phase = 'idle' | 'mixing' | 'exiting'
const MIX_SECONDS = 3
const EXIT_MS = 750

/** Bingo for the reception: a lotto drum, a drumroll, and a 75-number board. */
export function BingoGame({ tabs, host }: { tabs: ReactNode; /** Run from the shower website (host link), not the admin. */ host?: boolean }) {
  const { settings } = useWeddingSettings()
  const reduce = Boolean(useReducedMotion())
  const [game, setGame] = useState<BingoGameState>(loadBingo)
  const [phase, setPhase] = useState<Phase>('idle')
  const [exiting, setExiting] = useState<number | null>(null)
  const [auto, setAuto] = useState(false)
  const { present, open: openPresent, close: closePresent, full, toggleFull } = usePresentScreen()
  const [askNew, setAskNew] = useState(false)
  const [card, setCard] = useState('')
  // Present: the number just called, full screen.
  const [reveal, setReveal] = useState<{ n: number; key: string } | null>(null)
  const presentRef = useRef(false)
  presentRef.current = present
  const timers = useRef<number[]>([])
  const autoRef = useRef(false)
  const gameRef = useRef(game)
  gameRef.current = game

  const called = game.called
  const remaining = useMemo(() => remainingNumbers(called), [called])
  const current = called.length ? called[called.length - 1] : null
  const recent = (phase === 'idle' ? called.slice(-6, -1) : called.slice(-5)).reverse()
  const busy = phase !== 'idle'
  const done = remaining.length === 0

  useEffect(() => {
    if (!host) document.title = 'Shower Bingo · Admin'
  }, [host])
  useEffect(() => saveBingo(game), [game])
  useEffect(() => {
    autoRef.current = auto
  }, [auto])
  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t))
      stopSuspense()
    },
    [],
  )
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))

  const draw = useCallback(() => {
    if (phase !== 'idle') return
    const n = drawNumber(gameRef.current.called)
    if (n === null) return
    unlockSound()
    playDrumroll(MIX_SECONDS)
    setPhase('mixing')
    later(() => {
      setExiting(n)
      setPhase('exiting')
      later(() => {
        playBallOut()
        setExiting(null)
        setGame((g) => (g.called.includes(n) ? g : { ...g, called: [...g.called, n] }))
        setPhase('idle')
        if (presentRef.current) setReveal({ n, key: `${n}-${Date.now()}` })
        // Auto-draw: the next ball after a pause, until it's stopped or the drum is empty.
        if (autoRef.current && gameRef.current.called.length + 1 < BINGO_MAX) {
          later(() => autoRef.current && document.dispatchEvent(new Event('bingo:auto')), gameRef.current.autoSeconds * 1000)
        } else if (autoRef.current) setAuto(false)
      }, EXIT_MS)
    }, MIX_SECONDS * 1000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // Auto-draw fires through an event, so it always uses the latest draw().
  useEffect(() => {
    const go = () => draw()
    document.addEventListener('bingo:auto', go)
    return () => document.removeEventListener('bingo:auto', go)
  }, [draw])

  const toggleAuto = () => {
    if (auto) return setAuto(false)
    setAuto(true)
    autoRef.current = true
    if (phase === 'idle') draw()
  }
  const undo = () => !busy && setGame((g) => ({ ...g, called: g.called.slice(0, -1) }))
  const newGame = () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
    stopSuspense()
    setAuto(false)
    setExiting(null)
    setPhase('idle')
    setGame((g) => ({ ...NEW_GAME, autoSeconds: g.autoSeconds }))
    setAskNew(false)
    setCard('')
  }

  // Present: full screen; Space draws, Escape closes.
  useEffect(() => {
    if (!present) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePresent()
      if ((e.key === ' ' || e.key === 'Enter') && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault()
        draw()
      }
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [present, draw, closePresent])

  const cardNums = parseCard(card)
  const missing = cardNums.filter((n) => !called.includes(n))

  const drawButton = (
    <Button size="lg" onClick={draw} disabled={busy || done} className={cn('min-w-44', present && 'text-lg')}>
      {phase === 'mixing' ? 'Drawing…' : phase === 'exiting' ? 'Here it comes…' : done ? 'All balls drawn' : called.length ? 'Draw next ball' : 'Draw first ball'}
    </Button>
  )

  return (
    <>
      {host ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          {tabs}
          <Button variant="outline" onClick={openPresent} icon={<Maximize2 aria-hidden="true" className="size-4" />}>
            Present
          </Button>
        </div>
      ) : (
        <>
          <PageHeader
            title="Raffle"
            description="Bingo with 75 balls. Each draw mixes the drum to a drumroll — no number is ever called twice."
            actions={
              <Button variant="outline" onClick={openPresent} icon={<Maximize2 aria-hidden="true" className="size-4" />}>
                Present
              </Button>
            }
          />
          {tabs}
        </>
      )}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-xl border border-line bg-paper p-5 shadow-soft sm:p-8">
          <div
            className={present ? 'fixed inset-0 z-[100] flex flex-col overflow-y-auto bg-ivory px-5 py-8 sm:px-10' : undefined}
            role={present ? 'dialog' : undefined}
            aria-modal={present || undefined}
            aria-label={present ? 'Bingo' : undefined}
          >
            {present && (
              <>
                <PresentTopBar full={full} onToggleFull={toggleFull} onClose={closePresent} />
                {settings && <p className="text-center font-serif text-3xl text-ink-soft">{settings.coupleNames}</p>}
                <p className="mt-1 text-center text-lg uppercase tracking-[0.4em] text-gold">Bingo</p>
              </>
            )}

            <div className={cn('mx-auto grid w-full items-center gap-6', present ? 'mt-4 max-w-6xl md:grid-cols-2' : 'md:grid-cols-2')}>
              <div className={cn('mx-auto w-full', present ? 'max-w-[min(46vh,520px)]' : 'max-w-sm')}>
                <BingoDrum numbers={remaining} mixing={phase === 'mixing'} exiting={exiting} reduce={reduce} label={`Bingo drum with ${remaining.length} balls left`} />
              </div>

              <div className="flex flex-col items-center text-center">
                <p className="text-xs uppercase tracking-[0.32em] text-muted">{phase === 'mixing' ? 'Mixing the balls…' : phase === 'exiting' ? 'Here it comes…' : current ? 'Last number called' : 'Ready when you are'}</p>
                <div className={cn('relative mt-3 grid place-items-center', present ? 'size-56 sm:size-64' : 'size-44 sm:size-48')}>
                  <AnimatePresence mode="popLayout">
                    {current && phase === 'idle' ? (
                      <BigBall key={current} n={current} reduce={reduce} />
                    ) : (
                      <motion.div
                        key="waiting"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="grid size-full place-items-center rounded-full border-2 border-dashed border-line text-5xl text-line"
                      >
                        {phase !== 'idle' && !reduce ? (
                          <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }} className="text-gold">
                            ✦
                          </motion.span>
                        ) : (
                          '?'
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <p className="sr-only" aria-live="assertive">
                  {current && phase === 'idle' ? `${callLabel(current)}` : ''}
                </p>
                {recent.length > 0 && (
                  <div className="mt-4">
                    <p className="text-[0.65rem] uppercase tracking-[0.3em] text-muted">Before that</p>
                    <div className="mt-2 flex justify-center gap-2">
                      {recent.map((n) => (
                        <MiniBall key={n} n={n} large={present} />
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{drawButton}</div>
                <p className="mt-3 text-sm text-muted">
                  <span className="font-medium text-ink">{called.length}</span> called · <span className="font-medium text-ink">{remaining.length}</span> left
                  {present && ' · Space to draw'}
                </p>
                {present && (
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                    <AutoToggle auto={auto} onToggle={toggleAuto} seconds={game.autoSeconds} disabled={done} />
                    <SoundControls />
                  </div>
                )}
              </div>
            </div>

            <Board called={called} last={phase === 'idle' ? current : null} large={present} />
          </div>
        </section>

        <aside className="space-y-5">
          <section className="space-y-3 rounded-xl border border-line bg-paper p-5 shadow-soft">
            <h2 className="text-xl text-ink">Host controls</h2>
            <SoundControls />
            <div className="flex flex-wrap items-center gap-3">
              <AutoToggle auto={auto} onToggle={toggleAuto} seconds={game.autoSeconds} disabled={done} />
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                every
                <select
                  className="input-base min-h-9 w-auto py-1"
                  value={game.autoSeconds}
                  onChange={(e) => setGame((g) => ({ ...g, autoSeconds: Number(e.target.value) }))}
                  aria-label="Seconds between automatic draws"
                >
                  {[5, 8, 10, 15, 20, 30].map((s) => (
                    <option key={s} value={s}>
                      {s} s
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={undo} disabled={busy || !called.length} icon={<Undo2 aria-hidden="true" className="size-3.5" />}>
                Undo last ({current ? callLabel(current) : '—'})
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAskNew(true)} disabled={busy || !called.length} icon={<RotateCcw aria-hidden="true" className="size-3.5" />}>
                New game
              </Button>
            </div>
            <p className="text-xs text-muted">The game is kept on this device, so refreshing the page won’t lose the numbers called. Use the same device for the whole game.</p>
            {!host && <p className="text-xs text-muted">To run Bingo from the shower website instead, set up host access in the Website &amp; host tab.</p>}
          </section>

          <section className="space-y-3 rounded-xl border border-line bg-paper p-5 shadow-soft">
            <h2 className="text-xl text-ink">Check a card</h2>
            <p className="text-sm text-muted">Someone shouts “Bingo!”? Type the numbers on their winning line.</p>
            <input className="input-base" inputMode="numeric" placeholder="e.g. 4 19 33 52 70" value={card} onChange={(e) => setCard(e.target.value)} aria-label="Numbers on the winning line" />
            {cardNums.length > 0 && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {cardNums.map((n) => {
                    const ok = called.includes(n)
                    return (
                      <span
                        key={n}
                        className={cn('rounded-full px-2.5 py-1 text-xs font-medium', ok ? 'text-white' : 'border border-dashed border-rose text-rose')}
                        style={ok ? { background: colorFor(n) } : undefined}
                      >
                        {callLabel(n)}
                      </span>
                    )
                  })}
                </div>
                <p className={cn('flex items-center gap-1.5 text-sm font-medium', missing.length ? 'text-rose' : 'text-sage')}>
                  {missing.length ? (
                    `Not yet — ${missing.length === 1 ? `${callLabel(missing[0])} hasn’t` : `${missing.length} numbers haven’t`} been called.`
                  ) : (
                    <>
                      <CheckCircle2 aria-hidden="true" className="size-4" /> All called — it’s a Bingo!
                    </>
                  )}
                </p>
              </>
            )}
          </section>
        </aside>
      </div>

      <BigReveal
        revealKey={present && reveal ? reveal.key : null}
        autoHideMs={auto ? Math.max(2500, Math.min(5000, game.autoSeconds * 1000 - 1500)) : undefined}
        onClose={() => setReveal(null)}
      >
        {reveal && <RevealBall n={reveal.n} />}
      </BigReveal>

      <ConfirmDialog
        destructive
        open={askNew}
        title="Start a new game?"
        message="All balls go back in the drum and the board is cleared."
        confirmLabel="New game"
        onCancel={() => setAskNew(false)}
        onConfirm={newGame}
      />
    </>
  )
}

function AutoToggle({ auto, onToggle, seconds, disabled }: { auto: boolean; onToggle: () => void; seconds: number; disabled: boolean }) {
  return (
    <Button size="sm" variant={auto ? 'primary' : 'outline'} onClick={onToggle} disabled={disabled && !auto} icon={auto ? <Square aria-hidden="true" className="size-3.5" /> : <Play aria-hidden="true" className="size-3.5" />}>
      {auto ? 'Stop auto-draw' : `Auto-draw (${seconds} s)`}
    </Button>
  )
}

function ballStyle(n: number) {
  const c = colorFor(n)
  return { background: `radial-gradient(circle at 32% 28%, #fff 0%, ${c} 26%, ${c} 55%, color-mix(in srgb, ${c} 62%, #000) 100%)` }
}

/** The called ball, popping out big and turning to face the room. */
function BigBall({ n, reduce }: { n: number; reduce: boolean }) {
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.25, y: 90, rotate: -160 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0, rotate: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4, x: -60, y: 40 }}
      transition={{ type: 'spring', stiffness: 170, damping: 15 }}
      className="grid size-full place-items-center rounded-full shadow-lift"
      style={ballStyle(n)}
    >
      <div className="grid size-[62%] place-items-center rounded-full bg-white/95 shadow-inner">
        <div className="text-center leading-none text-ink">
          <div className="text-[clamp(1rem,4vw,1.6rem)] font-semibold tracking-[0.2em]" style={{ color: colorFor(n) }}>
            {letterFor(n)}
          </div>
          <div className="mt-1 font-serif text-[clamp(2.6rem,9vw,4.4rem)]">{n}</div>
        </div>
      </div>
    </motion.div>
  )
}

const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy']
/** 42 → "forty-two" (1–75). */
function inWords(n: number): string {
  if (n < 20) return ONES[n]
  const t = TENS[Math.floor(n / 10)]
  return n % 10 ? `${t}-${ONES[n % 10]}` : t
}

/** Present: the called ball filling the screen, letter and number big enough for the back tables. */
function RevealBall({ n }: { n: number }) {
  return (
    <div className="flex flex-col items-center">
      <div className="grid place-items-center rounded-full" style={{ ...ballStyle(n), width: 'min(62vh, 80vw)', height: 'min(62vh, 80vw)', boxShadow: `0 0 12vmin color-mix(in srgb, ${colorFor(n)} 55%, transparent), 0 2vmin 5vmin rgba(0,0,0,0.5)` }}>
        <div className="grid size-[64%] place-items-center rounded-full bg-white shadow-inner">
          <div className="text-center leading-none">
            <div className="font-bold" style={{ color: colorFor(n), fontSize: 'min(9vh, 11vw)', letterSpacing: '0.12em' }}>
              {letterFor(n)}
            </div>
            <div className="font-serif font-semibold text-ink" style={{ fontSize: 'min(24vh, 30vw)', lineHeight: 0.95 }}>
              {n}
            </div>
          </div>
        </div>
      </div>
      <p className="mt-[3vh] font-serif capitalize text-white" style={{ fontSize: 'min(7vh, 8vw)', textShadow: '0 0.05em 0.2em rgba(0,0,0,0.6)' }}>
        {letterFor(n)} · {inWords(n)}
      </p>
    </div>
  )
}

function MiniBall({ n, large }: { n: number; large: boolean }) {
  return (
    <span className={cn('grid place-items-center rounded-full shadow-soft', large ? 'size-12' : 'size-10')} style={ballStyle(n)} title={callLabel(n)}>
      <span className={cn('grid place-items-center rounded-full bg-white/95 font-semibold text-ink', large ? 'size-8 text-sm' : 'size-7 text-xs')}>{n}</span>
    </span>
  )
}

/** All 75 numbers; the called ones light up in their letter's colour. */
function Board({ called, last, large }: { called: number[]; last: number | null; large: boolean }) {
  const on = new Set(called)
  const cell = (n: number) => {
    const hit = on.has(n)
    return (
      <span
        key={n}
        className={cn(
          'grid aspect-square place-items-center rounded-full font-medium tabular-nums transition-colors duration-500',
          large ? 'text-base sm:text-lg' : 'text-[0.7rem] sm:text-xs',
          hit ? 'text-white shadow-soft' : 'border border-line text-muted/70',
          n === last && 'ring-2 ring-ink ring-offset-2 ring-offset-paper',
        )}
        style={hit ? { background: colorFor(n) } : undefined}
      >
        {n}
      </span>
    )
  }
  return (
    <div className={cn('mx-auto mt-8 w-full', large ? 'max-w-6xl' : '')} aria-label={`${called.length} of 75 numbers called`}>
      {/* wide screens: a row per letter */}
      <div className="hidden space-y-1.5 sm:block">
        {LETTERS.map((L, row) => (
          <div key={L} className="grid grid-cols-[2.25rem_repeat(15,minmax(0,1fr))] items-center gap-1.5">
            <span className="grid aspect-square place-items-center rounded-md font-serif text-lg text-white" style={{ background: colorFor(row * 15 + 1) }}>
              {L}
            </span>
            {Array.from({ length: 15 }, (_, i) => cell(row * 15 + i + 1))}
          </div>
        ))}
      </div>
      {/* phones: a column per letter */}
      <div className="grid grid-cols-5 gap-1.5 sm:hidden">
        {LETTERS.map((L, col) => (
          <span key={L} className="grid h-8 place-items-center rounded-md font-serif text-lg text-white" style={{ background: colorFor(col * 15 + 1) }}>
            {L}
          </span>
        ))}
        {Array.from({ length: 15 }, (_, r) => LETTERS.map((_, col) => cell(col * 15 + r + 1)))}
      </div>
    </div>
  )
}
