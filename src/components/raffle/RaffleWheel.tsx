import { useEffect, useRef, useState, type RefObject } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Sparkles, Volume2, VolumeX } from 'lucide-react'
import { cn } from '../ui/cn'
import { BigReveal, nameSize } from './BigReveal'
import { useMonogram } from '../../hooks/useMonogram'
import { MonogramImage } from '../wedding/Monogram'
import { getVolume, isMuted, playKnockedOut, playPlace, playQuickRiser, playSuspense, playTick, playWinner, setMuted, setVolume, stopSuspense, unlockSound } from '../../utils/raffleSounds'

const FILLS = ['var(--color-paper)', 'var(--color-champagne-light)', 'var(--color-cream)', 'var(--color-linen)']
export const SLOW_SPIN_MS = 6500
export const QUICK_SPIN_MS = 1700

function segmentPath(a0: number, a1: number, r: number): string {
  const rad = (d: number) => (d * Math.PI) / 180
  const x0 = Math.cos(rad(a0)) * r
  const y0 = Math.sin(rad(a0)) * r
  const x1 = Math.cos(rad(a1)) * r
  const y1 = Math.sin(rad(a1)) * r
  return `M0 0 L${x0.toFixed(3)} ${y0.toFixed(3)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(3)} ${y1.toFixed(3)} Z`
}

/** A secure random whole number below n. */
function randomIndex(n: number): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] % n
}

/** The wheel's current angle (degrees) read from its transform, during a CSS transition too. */
function currentAngle(el: Element): number {
  const m = getComputedStyle(el).transform
  if (!m || m === 'none') return 0
  const v = /matrix\(([^)]+)\)/.exec(m)?.[1].split(',').map(Number)
  if (!v || v.length < 2) return 0
  return (Math.atan2(v[1], v[0]) * 180) / Math.PI
}

interface WheelProps {
  names: string[]
  rotation: number
  spinning: boolean
  durationMs?: number
  /** Slow idle turn (public page). */
  idle?: boolean
  centre?: string
  className?: string
  groupRef?: RefObject<HTMLDivElement | null>
  onSpinEnd?: () => void
}

/**
 * The raffle wheel: names around the edge, pointer at the top. The turning part
 * is its own layer (an HTML element rotated with CSS), so the browser moves it
 * as one picture instead of redrawing every name on every frame.
 */
export function RaffleWheel({ names, rotation, spinning, durationMs = SLOW_SPIN_MS, idle, centre, className, groupRef, onSpinEnd }: WheelProps) {
  const mono = useMonogram()
  const n = Math.max(names.length, 1)
  const a = 360 / n
  const chord = (2 * Math.PI * 80 * a) / 360
  const font = Math.min(7, Math.max(2.3, chord * 0.6))
  const maxChars = font < 3.2 ? 26 : 20
  const VB = '-106 -112 212 218'
  return (
    <div className={cn('relative w-full', className)} style={{ aspectRatio: '212 / 218' }} role="img" aria-label={`Raffle wheel with ${names.length} names`}>
      <svg viewBox={VB} className="absolute inset-0 block size-full" aria-hidden="true">
        <circle r="103" fill="var(--color-champagne)" opacity="0.35" />
      </svg>
      <div
        ref={groupRef}
        // The turning layer is a rectangle: at some angles its (invisible) corners reach past the
        // circle — over the Spin button. It's never clicked, so it lets clicks through.
        className={cn('pointer-events-none absolute inset-0', idle && 'motion-safe:animate-[spin_90s_linear_infinite]')}
        style={{
          transformOrigin: '50% 51.376%',
          willChange: 'transform',
          ...(idle ? {} : { transform: `rotate(${rotation}deg)`, transition: spinning ? `transform ${durationMs}ms cubic-bezier(0.12, 0.8, 0.12, 1)` : 'none' }),
        }}
        onTransitionEnd={(e) => e.target === e.currentTarget && onSpinEnd?.()}
      >
        <svg viewBox={VB} className="block size-full" aria-hidden="true">
          {names.length === 0 ? (
            <circle r="100" fill="var(--color-cream)" stroke="var(--color-line)" strokeWidth="0.6" />
          ) : (
            names.map((name, i) => {
              const a0 = -90 + i * a
              const mid = a0 + a / 2
              const label = name.length > maxChars ? `${name.slice(0, maxChars - 1)}…` : name
              return (
                <g key={`${name}-${i}`}>
                  {n === 1 ? (
                    <circle r="100" fill={FILLS[0]} stroke="var(--color-line)" strokeWidth="0.5" />
                  ) : (
                    <path d={segmentPath(a0, a0 + a, 100)} fill={FILLS[i % (n % 4 === 1 ? 3 : 4)]} stroke="var(--color-line)" strokeWidth="0.35" />
                  )}
                  <text
                    transform={`rotate(${mid}) translate(94 0)`}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fontSize={font}
                    fill="var(--color-ink)"
                    style={{ fontFamily: 'var(--font-sans)' }}
                  >
                    {label}
                  </text>
                </g>
              )
            })
          )}
        </svg>
      </div>
      <svg viewBox={VB} className="pointer-events-none absolute inset-0 block size-full" aria-hidden="true">
        <circle r="17" fill="var(--color-paper)" stroke="var(--color-champagne)" strokeWidth="1.2" />
        {mono ? (
          <foreignObject x={-14} y={-14} width={28} height={28}>
            <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--color-gold)' }}>
              <MonogramImage url={mono.url} aspect={mono.aspect} height="24px" />
            </div>
          </foreignObject>
        ) : (
          <text textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="var(--color-gold)" style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>
            {centre ?? ''}
          </text>
        )}
        {/* pointer */}
        <path d="M0 -94 L-7 -110 L7 -110 Z" fill="var(--color-ink)" stroke="var(--color-paper)" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

/** What a spin led to, as shown under the wheel. */
export interface Outcome {
  tone: 'out' | 'place' | 'winner'
  /** e.g. "Out", "3rd place", "Winner". */
  title: string
  name: string
  detail?: string
  /** Shown a moment later (last one standing: the winner after 2nd place). */
  then?: Outcome
  /** Present: a short full-screen moment for this result (e.g. an "Out" in the finals). */
  brief?: boolean
}

interface StageProps {
  /** Names as shown (masked or full). */
  shown: string[]
  /** The real names, same order (what's saved). */
  real: string[]
  centre?: string
  disabled?: boolean
  large?: boolean
  durationMs?: number
  /** After an "out", spin again automatically while this says so. */
  autoPlay?: () => boolean
  spinLabel?: string
  /** Present on a big screen: winners, places (and brief finals) take over the screen. */
  reveal?: boolean
  onLanded: (realName: string, shownName: string) => Promise<Outcome | null> | Outcome | null
  /** Changes when a new round starts: the wheel shows the current names and clears the last result. */
  roundKey?: number
  /** Present: told when a big reveal opens and closes (side lists hold still meanwhile). */
  onRevealChange?: (open: boolean) => void
}

function playFor(o: Outcome) {
  if (o.tone === 'winner') playWinner()
  else if (o.tone === 'place') playPlace()
  else playKnockedOut(Boolean(o.brief))
}

/** Wheel + Spin button + the result. The host spins; the caller decides what a landing means and saves it. */
export function SpinStage({ shown: liveShown, real: liveReal, centre, disabled, large, durationMs = SLOW_SPIN_MS, autoPlay, spinLabel = 'Spin', reveal, onLanded, roundKey = 0, onRevealChange }: StageProps) {
  const reduce = useReducedMotion()
  // The wheel keeps the names it was spun with until the next spin, so it doesn't
  // redraw (and move the pointer) when the result changes the list.
  const [frozen, setFrozen] = useState<{ shown: string[]; real: string[] } | null>(null)
  const shown = frozen?.shown ?? liveShown
  const real = frozen?.real ?? liveReal
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [duration, setDuration] = useState(durationMs)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [confetti, setConfetti] = useState(0)
  const target = useRef<number | null>(null)
  // The names the wheel was spun with (the landing reads these, never an older list).
  const spunWith = useRef<{ real: string[]; shown: string[] } | null>(null)
  const group = useRef<HTMLDivElement | null>(null)
  const landed = useRef(onLanded)
  const auto = useRef(autoPlay)
  const spinRef = useRef<() => void>(() => undefined)
  const landedName = useRef<string | null>(null)
  useEffect(() => {
    landed.current = onLanded
    auto.current = autoPlay
  }, [onLanded, autoPlay])

  // Tick each time a name passes the pointer.
  useEffect(() => {
    if (!spinning || !group.current) return
    const el = group.current
    const n = Math.max(real.length, 1)
    let last = -1
    let raf = 0
    const loop = () => {
      const angle = ((currentAngle(el) % 360) + 360) % 360
      const idx = Math.floor(angle / (360 / n))
      if (idx !== last) {
        if (last !== -1) playTick()
        last = idx
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [spinning, real.length])

  // Show the live names again when the list changes for a reason other than the
  // result just saved — e.g. a new round brings names back, or names are added.
  // (A result only takes names off: the one landed on, and in the finals the winner.)
  useEffect(() => {
    if (!frozen || spinning || target.current !== null) return
    const was = new Set(frozen.real)
    const added = liveReal.some((x) => !was.has(x))
    const gone = frozen.real.filter((x) => !liveReal.includes(x) && x !== landedName.current).length
    if (added || gone > 1) setFrozen(null)
  }, [liveReal, frozen, spinning])

  // New round: fresh wheel, no old result.
  const lastRound = useRef(roundKey)
  useEffect(() => {
    if (lastRound.current === roundKey) return
    lastRound.current = roundKey
    landedName.current = null
    setFrozen(null)
    setOutcome(null)
  }, [roundKey])

  const [big, setBig] = useState<{ o: Outcome; key: string } | null>(null)
  const revealChange = useRef(onRevealChange)
  useEffect(() => {
    revealChange.current = onRevealChange
  }, [onRevealChange])
  useEffect(() => {
    revealChange.current?.(Boolean(big))
  }, [big])
  const show = (o: Outcome) => {
    if (reveal && (o.tone !== 'out' || o.brief)) setBig({ o, key: `${o.title}-${o.name}-${Date.now()}` })
    setOutcome(o)
    playFor(o)
    if (o.tone === 'winner') setConfetti((c) => c + 1)
    if (o.then) {
      const next = o.then
      window.setTimeout(() => show(next), 1800)
    }
  }

  const finish = async () => {
    const i = target.current
    const names = spunWith.current ?? { real, shown }
    target.current = null
    spunWith.current = null
    setSpinning(false)
    if (i == null || !names.real[i]) return
    landedName.current = names.real[i]
    const o = await landed.current(names.real[i], names.shown[i] ?? names.real[i])
    if (!o) return stopSuspense()
    show(o)
    if (o.tone === 'out' && !o.then && auto.current?.()) window.setTimeout(() => spinRef.current(), 900)
  }

  const spin = () => {
    if (spinning || liveReal.length === 0) return
    unlockSound()
    setFrozen({ shown: liveShown, real: liveReal })
    const n = liveReal.length
    const a = 360 / n
    const i = randomIndex(n)
    const jitter = (Math.random() - 0.5) * a * 0.6
    const quick = durationMs < SLOW_SPIN_MS
    const turns = reduce ? 1 : quick ? 3 : 7
    if (!reduce) {
      if (quick) playQuickRiser(durationMs / 1000)
      else playSuspense(durationMs / 1000)
    }
    const base = Math.ceil(rotation / 360) * 360 + 360 * turns
    target.current = i
    spunWith.current = { real: liveReal, shown: liveShown }
    setOutcome(null)
    setDuration(durationMs)
    setSpinning(!reduce)
    setRotation(base + 360 - (i + 0.5) * a + jitter)
    if (reduce) window.setTimeout(() => void finish(), 50)
  }
  useEffect(() => {
    spinRef.current = spin
  })
  useEffect(() => () => stopSuspense(), [])

  return (
    // Presenting: the result fits on one line whatever the name's length (a long name
    // shrinks instead of wrapping and pushing the screen taller than the TV).
    <div className={cn('relative flex w-full flex-col items-center', large && '[container-type:inline-size]')}>
      <Confetti burst={reveal ? 0 : confetti} />
      <BigReveal
        revealKey={reveal && big ? big.key : null}
        level={big && big.o.tone !== 'out' ? 'full' : 'soft'}
        autoHideMs={big?.o.tone === 'out' ? 2600 : undefined}
        onClose={() => setBig(null)}
      >
        {big && (
          <>
            <p
              className="font-medium uppercase"
              style={{ fontSize: 'clamp(1.2rem, 3.2vw, 3.4rem)', letterSpacing: '0.35em', color: big.o.tone === 'out' ? 'rgba(255,255,255,0.6)' : 'var(--color-champagne)' }}
            >
              {big.o.tone === 'winner' ? 'Winner' : big.o.title}
            </p>
            <p
              className={cn('mt-[2vh] font-serif leading-[1.05] text-white', big.o.tone === 'out' && 'line-through decoration-[0.04em] opacity-80')}
              style={{
                fontSize: nameSize(big.o.name),
                textShadow: big.o.tone === 'out' ? 'none' : '0 0 0.25em color-mix(in srgb, var(--color-champagne) 70%, transparent), 0 0.04em 0.12em rgba(0,0,0,0.5)',
              }}
            >
              {big.o.name}
            </p>
            {big.o.detail && (
              <p className="mt-[3vh] font-serif italic text-white/85" style={{ fontSize: 'clamp(1.4rem, 3.6vw, 4rem)' }}>
                {big.o.detail}
              </p>
            )}
          </>
        )}
      </BigReveal>
      <div className={cn('w-full', large ? 'max-w-[min(72vh,92vw)]' : 'max-w-md')}>
        <RaffleWheel names={shown} rotation={rotation} spinning={spinning} durationMs={duration} centre={centre} groupRef={group} onSpinEnd={() => void finish()} />
      </div>
      <button
        type="button"
        onClick={spin}
        disabled={disabled || spinning || liveReal.length === 0}
        className={cn(
          'mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-ink font-medium uppercase tracking-[0.2em] text-ivory shadow-soft transition hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-50',
          large ? 'min-h-16 px-14 text-lg' : 'min-h-12 px-10 text-sm',
        )}
      >
        <Sparkles aria-hidden="true" className={large ? 'size-5' : 'size-4'} strokeWidth={1.6} />
        {spinning ? 'Spinning…' : spinLabel}
      </button>
      <div aria-live="polite" className="mt-6 min-h-24 text-center">
        <AnimatePresence mode="wait">
          {outcome && (
            <motion.div key={outcome.title + outcome.name + rotation} initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }}>
              <p className={cn('text-sm uppercase tracking-[0.3em]', large && 'whitespace-nowrap', outcome.tone === 'out' ? 'text-muted' : 'text-gold')}>{outcome.title}</p>
              <p
                className={cn('mt-1 font-serif', outcome.tone === 'out' ? 'text-ink-soft line-through decoration-1' : 'text-ink', large ? 'whitespace-nowrap leading-[1.05]' : outcome.tone === 'out' ? 'text-2xl' : 'text-4xl')}
                style={large ? { fontSize: `min(${outcome.tone === 'out' ? 2.25 : 3.75}rem, ${Math.round(1000 / (Math.max(8, outcome.name.length) * 0.56)) / 10}cqi)` } : undefined}
              >
                {outcome.name}
              </p>
              {outcome.detail && <p className="mt-1 text-sm text-ink-soft">{outcome.detail}</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/** A short burst of confetti in the theme's colours. */
function Confetti({ burst }: { burst: number }) {
  const reduce = useReducedMotion()
  if (!burst || reduce) return null
  const colors = ['var(--color-champagne)', 'var(--color-gold)', 'var(--color-champagne-light)', 'var(--color-rose)', 'var(--color-sage)']
  return (
    <div key={burst} aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 overflow-visible">
      {Array.from({ length: 70 }, (_, i) => {
        const x = (Math.random() - 0.5) * 900
        const y = -Math.random() * 420 - 80
        const r = Math.random() * 720 - 360
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/3 block"
            style={{ width: 7, height: 12, background: colors[i % colors.length], borderRadius: 2 }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
            animate={{ x, y: [y, y + 700], opacity: [1, 1, 0], rotate: r }}
            transition={{ duration: 2.6 + Math.random(), ease: 'easeOut' }}
          />
        )
      })}
    </div>
  )
}

/** Mute + volume for the raffle sounds (remembered on this device). */
export function SoundControls({ className }: { className?: string }) {
  const [muted, setM] = useState(isMuted)
  const [vol, setV] = useState(getVolume)
  return (
    <div className={cn('inline-flex items-center gap-2 text-sm text-muted', className)}>
      <button
        type="button"
        onClick={() => {
          setMuted(!muted)
          setM(!muted)
        }}
        aria-pressed={muted}
        aria-label={muted ? 'Turn sound on' : 'Mute sound'}
        className="rounded-full p-2 transition hover:bg-cream hover:text-ink"
      >
        {muted ? <VolumeX aria-hidden="true" className="size-4" /> : <Volume2 aria-hidden="true" className="size-4" />}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={vol}
        disabled={muted}
        aria-label="Volume"
        onChange={(e) => {
          const v = Number(e.target.value)
          setVolume(v)
          setV(v)
        }}
        className="w-24 accent-ink"
      />
    </div>
  )
}
