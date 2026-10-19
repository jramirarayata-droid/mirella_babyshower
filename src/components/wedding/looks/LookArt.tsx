import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '../../ui/cn'
import gardenSpray from '../../../assets/looks/garden-spray.webp'
import gardenSprig from '../../../assets/looks/garden-sprig.webp'
import petalsRing from '../../../assets/looks/petals-ring.webp'

/** Artwork for the website-only looks other than Eucalyptus & Gold (see GreeneryArt). */

const img = 'pointer-events-none select-none'

function useGrow() {
  const reduce = useReducedMotion()
  return (delay: number) =>
    reduce ? {} : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 1.5, delay, ease: [0.22, 1, 0.36, 1] as const } }
}

/** Watercolour Garden: a low spray of painted roses resting across the foot of the arched photo. */
export function GardenPhotoSpray() {
  const grow = useGrow()
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10">
      <motion.img src={gardenSpray} alt="" decoding="async" className={cn(img, 'absolute -bottom-[12%] left-1/2 h-auto w-[132%] max-w-none -translate-x-1/2')} {...grow(0.5)} />
    </div>
  )
}

/** Love Story: a few painted rose petals drifting round the round photo. */
export function PetalsAround() {
  const grow = useGrow()
  return (
    <div aria-hidden="true" className="pointer-events-none absolute -inset-[20%] z-10">
      <motion.img src={petalsRing} alt="" decoding="async" className={cn(img, 'size-full')} {...grow(0.6)} />
    </div>
  )
}

/** Watercolour Garden divider: a small painted spray. */
export function GardenSprig() {
  return <img src={gardenSprig} alt="" aria-hidden="true" loading="lazy" decoding="async" className={cn(img, 'mx-auto h-auto w-[170px]')} />
}

// ---------------------------------------------------------------- Save the Date: round countdown

/** Wedding morning in the Philippines (the date is stored as YYYY-MM-DD). */
const targetOf = (date: string) => new Date(`${date}T00:00:00+08:00`).getTime()

function parts(ms: number) {
  const m = Math.max(0, Math.floor(ms / 60000))
  return { days: Math.floor(m / 1440), hours: Math.floor((m % 1440) / 60), minutes: m % 60 }
}

/** Days, hours and minutes to the wedding in three fine rings, over the photo. Hidden once the day arrives. */
export function RoundCountdown({ date, className }: { date: string; className?: string }) {
  const target = targetOf(date)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  if (!Number.isFinite(target) || target - now <= 0) return null
  const p = parts(target - now)
  const cells: [number, string][] = [
    [p.days, p.days === 1 ? 'day' : 'days'],
    [p.hours, p.hours === 1 ? 'hour' : 'hours'],
    [p.minutes, p.minutes === 1 ? 'minute' : 'minutes'],
  ]
  return (
    <div className={cn('lux-rings flex items-center justify-center gap-3 sm:gap-5', className)} role="timer" aria-label={`${p.days} days, ${p.hours} hours and ${p.minutes} minutes to go`}>
      {cells.map(([v, label]) => (
        <div key={label} aria-hidden="true" className="grid size-[4.6rem] place-items-center rounded-full border border-white/60 text-white sm:size-24">
          <div className="text-center leading-none">
            <span className="block font-serif text-2xl sm:text-3xl">{v}</span>
            <span className="mt-1 block text-[0.58rem] uppercase tracking-[0.25em] text-white/80 sm:text-[0.62rem]">{label}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
