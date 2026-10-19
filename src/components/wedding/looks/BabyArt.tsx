import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '../../ui/cn'

/**
 * Hand-drawn artwork for the baby shower looks (no stock images): clouds, a
 * crescent moon and stars (Over the Moon, Twinkle Little Star), balloons
 * (Oh Baby! Balloons) and rainbow arches (Boho Rainbow). Everything is drawn
 * in the theme's colours, so it follows Look & Feel.
 */

const soft = 'pointer-events-none select-none'

/** A soft five-point star with rounded tips. */
export function StarShape({ className, filled = true }: { className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 2.6c.4 0 .7.2.9.6l2.3 4.8 5.2.7c.8.1 1.1 1.1.5 1.6l-3.8 3.6.9 5.2c.1.8-.7 1.4-1.4 1L12 17.6l-4.6 2.5c-.7.4-1.6-.2-1.4-1l.9-5.2-3.8-3.6c-.6-.6-.3-1.5.5-1.6l5.2-.7 2.3-4.8c.2-.4.5-.6.9-.6Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.2}
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** A four-point twinkle. */
export function Twinkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 1.5c.5 5.6 2.3 8.6 10.5 10.5-8.2 1.9-10 4.9-10.5 10.5C11.5 16.9 9.7 13.9 1.5 12 9.7 10.1 11.5 7.1 12 1.5Z" fill="currentColor" />
    </svg>
  )
}

/** A puffy cloud; `tone` fills it (default: the paper colour). */
export function CloudShape({ className, tone = 'var(--color-paper)', line = 'color-mix(in srgb, var(--color-champagne) 45%, transparent)' }: { className?: string; tone?: string; line?: string }) {
  return (
    <svg viewBox="0 0 120 64" className={className} aria-hidden="true">
      <path
        d="M24 58C12 58 4 50.5 4 41.5S11.6 25 22.4 25c1.6-11 11-19 22.6-19 9.3 0 17.3 5.3 21 13 2.4-1 5-1.5 7.8-1.5 10.6 0 19.4 7.6 20.9 17.6C105.6 36 116 44.6 116 47.6 116 53.4 110.8 58 104.4 58Z"
        fill={tone}
        stroke={line}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** A crescent moon. */
export function MoonShape({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d="M41.5 6.5A27 27 0 1 0 57.5 46 22 22 0 0 1 41.5 6.5Z" fill="currentColor" />
    </svg>
  )
}

/** A balloon on a curly string. */
export function BalloonShape({ className, color }: { className?: string; color: string }) {
  return (
    <svg viewBox="0 0 40 92" className={className} aria-hidden="true">
      <path d="M20 52c-1.6 6 3.2 9-1 15s3 10-.4 16" fill="none" stroke="color-mix(in srgb, var(--color-ink) 35%, transparent)" strokeWidth="0.9" strokeLinecap="round" />
      <ellipse cx="20" cy="24" rx="17" ry="21.5" fill={color} />
      <path d="M17.4 45.2h5.2l-1.2 3.2h-2.8Z" fill={color} />
      <ellipse cx="13.5" cy="15" rx="3.6" ry="6.2" transform="rotate(-24 13.5 15)" fill="#fff" opacity="0.38" />
    </svg>
  )
}

/** Pastel colours made from the theme accent, so the balloons always match the page. */
export const BALLOON_TONES = [
  'color-mix(in srgb, var(--color-champagne) 85%, #fff)',
  'color-mix(in srgb, #f4b8c5 70%, var(--color-champagne))',
  'color-mix(in srgb, #a9c8ea 70%, var(--color-champagne))',
  'color-mix(in srgb, #f6dc8f 70%, var(--color-champagne))',
  'color-mix(in srgb, #b9dcc6 70%, var(--color-champagne))',
]

/** Rainbow bands made from the theme accent (muted, boho). */
export const RAINBOW_TONES = [
  'color-mix(in srgb, var(--color-champagne) 88%, #3b2416)',
  'color-mix(in srgb, #e2a77f 65%, var(--color-champagne))',
  'color-mix(in srgb, #ead39b 70%, var(--color-champagne))',
  'color-mix(in srgb, #b8c7a8 70%, var(--color-champagne))',
]

function useFloat() {
  const reduce = useReducedMotion()
  return (delay: number, rise = 10) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: [0, -rise, 0] },
          transition: { opacity: { duration: 1.2, delay }, y: { duration: 6 + delay * 2, delay, repeat: Infinity, ease: 'easeInOut' as const } },
        }
}

/** Over the Moon: clouds, a moon and stars around the arched photo (`clouds={false}`: just the moon and stars). */
export function CloudsAround({ clouds = true }: { clouds?: boolean }) {
  const float = useFloat()
  return (
    <div aria-hidden="true" className={cn(soft, 'absolute -inset-[18%] z-10')}>
      {clouds && (
        <>
          <motion.div className="absolute -left-[4%] bottom-[10%] w-[46%]" {...float(0.3, 6)}>
            <CloudShape className="w-full drop-shadow-[0_10px_18px_rgb(0_0_0/0.08)]" />
          </motion.div>
          <motion.div className="absolute -right-[6%] bottom-[22%] w-[38%]" {...float(0.8, 8)}>
            <CloudShape className="w-full drop-shadow-[0_10px_18px_rgb(0_0_0/0.08)]" />
          </motion.div>
        </>
      )}
      <motion.div className="absolute right-[2%] top-[4%] w-[20%] text-champagne" {...float(0.5, 4)}>
        <MoonShape className="w-full" />
      </motion.div>
      <motion.div className="absolute left-[6%] top-[12%] w-[7%] text-champagne" {...float(1, 5)}>
        <StarShape className="w-full" />
      </motion.div>
      <motion.div className="absolute left-[18%] top-[2%] w-[4%] text-champagne/70" {...float(1.4, 3)}>
        <Twinkle className="w-full" />
      </motion.div>
      <motion.div className="absolute right-[26%] top-[0%] w-[5%] text-champagne/80" {...float(1.8, 4)}>
        <Twinkle className="w-full" />
      </motion.div>
      <motion.div className="absolute -left-[2%] top-[46%] w-[5%] text-champagne/70" {...float(2.1, 4)}>
        <StarShape className="w-full" />
      </motion.div>
    </div>
  )
}

/** Oh Baby! Balloons: balloons floating up around the round photo. */
export function BalloonsAround() {
  const float = useFloat()
  const b = (cls: string, tone: number, delay: number, rise: number, rot = 0) => (
    <motion.div className={cn('absolute', cls)} style={{ rotate: rot }} {...float(delay, rise)}>
      <BalloonShape className="w-full drop-shadow-[0_8px_14px_rgb(0_0_0/0.10)]" color={BALLOON_TONES[tone % BALLOON_TONES.length]!} />
    </motion.div>
  )
  return (
    <div aria-hidden="true" className={cn(soft, 'absolute -inset-[22%] z-10')}>
      {b('-left-[2%] top-[4%] w-[17%]', 1, 0.2, 12, -8)}
      {b('left-[9%] top-[14%] w-[13%]', 2, 0.6, 9, -4)}
      {b('-right-[1%] top-[0%] w-[18%]', 3, 0.4, 14, 7)}
      {b('right-[10%] top-[16%] w-[12%]', 0, 0.9, 8, 3)}
      {b('-right-[3%] bottom-[18%] w-[13%]', 4, 1.2, 10, 10)}
      {b('-left-[3%] bottom-[22%] w-[12%]', 0, 1.5, 8, -10)}
    </div>
  )
}

/** Boho Rainbow: muted rainbow arches standing behind the photo or the names. */
export function RainbowArches({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 104" className={cn(soft, className)} aria-hidden="true">
      {RAINBOW_TONES.map((c, i) => {
        const r = 92 - i * 17
        return <path key={i} d={`M${100 - r} 102a${r} ${r} 0 0 1 ${r * 2} 0`} fill="none" stroke={c} strokeWidth="13" strokeLinecap="round" />
      })}
    </svg>
  )
}

/** Small scattered stars over a dark or light background (Twinkle Little Star hero). */
export function StarField({ className, light = false }: { className?: string; light?: boolean }) {
  const reduce = useReducedMotion()
  const stars: [number, number, number, number][] = [
    [6, 12, 10, 0], [18, 30, 6, 1.2], [30, 8, 8, 0.6], [44, 22, 5, 2], [58, 10, 9, 0.3], [72, 26, 6, 1.6],
    [86, 9, 10, 0.9], [94, 34, 6, 2.4], [10, 62, 7, 1.1], [24, 84, 9, 0.4], [80, 70, 8, 1.8], [92, 88, 6, 0.7], [64, 90, 5, 2.2],
  ]
  return (
    <div aria-hidden="true" className={cn(soft, 'absolute inset-0 overflow-hidden', light ? 'text-white/70' : 'text-champagne/70', className)}>
      {stars.map(([x, y, s, d], i) => (
        <motion.span
          key={i}
          className="absolute"
          style={{ left: `${x}%`, top: `${y}%`, width: s, height: s }}
          animate={reduce ? undefined : { opacity: [0.35, 1, 0.35], scale: [0.85, 1.1, 0.85] }}
          transition={reduce ? undefined : { duration: 3.2, delay: d, repeat: Infinity, ease: 'easeInOut' }}
        >
          {i % 3 === 0 ? <StarShape className="size-full" /> : <Twinkle className="size-full" />}
        </motion.span>
      ))}
    </div>
  )
}

/** Hello Sunshine: a soft sun with slowly turning rays behind the arched photo. */
export function SunBehind() {
  const reduce = useReducedMotion()
  const rays = Array.from({ length: 16 }, (_, i) => i * 22.5)
  return (
    <div aria-hidden="true" className={cn(soft, 'absolute -inset-[34%] -z-10 grid place-items-center')}>
      <motion.svg
        viewBox="0 0 200 200"
        className="size-full text-champagne"
        animate={reduce ? undefined : { rotate: 360 }}
        transition={reduce ? undefined : { duration: 120, repeat: Infinity, ease: 'linear' }}
      >
        {rays.map((a) => (
          <path key={a} d="M100 6c2.4 0 3.6 14 3.6 24h-7.2C96.4 20 97.6 6 100 6Z" fill="currentColor" opacity="0.32" transform={`rotate(${a} 100 100)`} />
        ))}
        <circle cx="100" cy="100" r="64" fill="currentColor" opacity="0.16" />
      </motion.svg>
    </div>
  )
}
