import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '../../ui/cn'
import gardenSpray from '../../../assets/looks/garden-spray.webp'
import gardenSprig from '../../../assets/looks/garden-sprig.webp'

/** Painted artwork for Little Blossom (see also GreeneryArt and BabyArt), and the round countdown. */

const img = 'pointer-events-none select-none'

function useGrow() {
  const reduce = useReducedMotion()
  return (delay: number) =>
    reduce ? {} : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 1.5, delay, ease: [0.22, 1, 0.36, 1] as const } }
}

/** Little Blossom: a low spray of painted blooms resting across the foot of the arched photo. */
export function GardenPhotoSpray() {
  const grow = useGrow()
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10">
      <motion.img src={gardenSpray} alt="" decoding="async" className={cn(img, 'absolute -bottom-[12%] left-1/2 h-auto w-[132%] max-w-none -translate-x-1/2')} {...grow(0.5)} />
    </div>
  )
}

/** Little Blossom divider: a small painted spray. */
export function GardenSprig() {
  return <img src={gardenSprig} alt="" aria-hidden="true" loading="lazy" decoding="async" className={cn(img, 'mx-auto h-auto w-[170px]')} />
}

// ---------------------------------------------------------------- round countdown

/** "2:00 PM" / "14:30" → minutes after midnight (null when it isn't a clock time). */
function clockMinutes(time: string | undefined): number | null {
  const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m?\.?/i.exec(time ?? '') ?? /^\s*(\d{1,2}):(\d{2})\s*$/.exec(time ?? '')
  if (!m) return null
  let h = Number(m[1])
  const min = Number(m[2] ?? 0)
  const ap = m[3]?.toLowerCase()
  if (ap === 'p' && h < 12) h += 12
  if (ap === 'a' && h === 12) h = 0
  return h < 24 && min < 60 ? h * 60 + min : null
}

/** The shower's start in the Philippines (the date is stored as YYYY-MM-DD; midnight when there's no start time). */
const targetOf = (date: string, time?: string) => new Date(`${date}T00:00:00+08:00`).getTime() + (clockMinutes(time) ?? 0) * 60000

function parts(ms: number) {
  const m = Math.max(0, Math.floor(ms / 60000))
  return { days: Math.floor(m / 1440), hours: Math.floor((m % 1440) / 60), minutes: m % 60 }
}

/** Days, hours and minutes (and seconds) to the shower — or to `at` — in rings. Hidden once the moment arrives. */
export function RoundCountdown({
  date = '',
  time,
  at,
  className,
  onPhoto = false,
  big = false,
  showSeconds = false,
  onDone,
}: {
  date?: string
  time?: string
  /** An exact moment (ISO) instead of a date and time, e.g. the gender reveal. */
  at?: string | null
  className?: string
  onPhoto?: boolean
  /** For the big screen. */
  big?: boolean
  showSeconds?: boolean
  /** Called once when the moment arrives. */
  onDone?: () => void
}) {
  const target = at ? new Date(at).getTime() : targetOf(date, time)
  const [now, setNow] = useState(() => Date.now())
  const near = Number.isFinite(target) && target - now < 3 * 3600_000
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), showSeconds || near ? 1000 : 30_000)
    return () => window.clearInterval(id)
  }, [showSeconds, near])
  const done = Number.isFinite(target) && target - now <= 0
  useEffect(() => {
    if (done) onDone?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])
  if (!Number.isFinite(target) || done) return null
  const p = parts(target - now)
  const secs = Math.max(0, Math.floor((target - now) / 1000) % 60)
  const cells: [number, string][] = [
    ...(p.days > 0 || !showSeconds ? ([[p.days, p.days === 1 ? 'day' : 'days']] as [number, string][]) : []),
    [p.hours, p.hours === 1 ? 'hour' : 'hours'],
    [p.minutes, p.minutes === 1 ? 'minute' : 'minutes'],
    ...(showSeconds ? ([[secs, secs === 1 ? 'second' : 'seconds']] as [number, string][]) : []),
  ]
  return (
    <div className={cn('lux-rings flex items-center justify-center', big ? 'gap-[3vw]' : 'gap-3 sm:gap-5', className)} role="timer" aria-label={`${p.days} days, ${p.hours} hours and ${p.minutes} minutes to go`}>
      {cells.map(([v, label]) => (
        <div
          key={label}
          aria-hidden="true"
          className={cn(
            'lux-ring grid place-items-center rounded-full border',
            big ? 'size-[min(17vh,15vw,12rem)]' : 'size-[4.6rem] sm:size-24',
            onPhoto ? 'border-white/60 text-white' : 'border-champagne/60 bg-paper/70 text-ink shadow-soft',
          )}
        >
          <div className="text-center leading-none">
            <span className={cn('block font-serif', big ? 'text-[min(6.5vh,6vw,4.5rem)]' : 'text-2xl sm:text-3xl', !onPhoto && 'text-gold')}>{v}</span>
            <span className={cn('mt-1 block uppercase', big ? 'text-[min(1.6vh,1.4vw,1rem)] tracking-[0.25em]' : 'text-[0.56rem] tracking-[0.16em] sm:text-[0.62rem] sm:tracking-[0.22em]', onPhoto ? 'text-white/80' : 'text-muted')}>{label}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
