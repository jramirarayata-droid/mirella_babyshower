import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '../../ui/cn'
import corner from '../../../assets/looks/greenery-corner.webp'
import cornerBr from '../../../assets/looks/greenery-corner-br.webp'
import frame from '../../../assets/looks/greenery-frame.webp'
import frameBr from '../../../assets/looks/greenery-frame-br.webp'
import sprig from '../../../assets/looks/greenery-sprig.webp'

/**
 * Eucalyptus & Gold artwork: painted watercolour greenery (small WebP files,
 * about 100 KB in all) with fine gold lines drawn in CSS.
 */

const img = 'pointer-events-none select-none'

/** Greenery spilling round a corner. `at` picks which corner. */
export function GreeneryCorner({ at, className, eager = false }: { at: 'tl' | 'br'; className?: string; eager?: boolean }) {
  return (
    <img
      src={at === 'tl' ? corner : cornerBr}
      alt=""
      aria-hidden="true"
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={cn(img, 'absolute h-auto', className)}
    />
  )
}

/** The small sprig used as the divider (between two fine gold lines). */
export function GreenerySprig({ light }: { light?: boolean }) {
  const line = light ? 'bg-white/45' : 'bg-champagne/55'
  return (
    <div aria-hidden="true" className="flex items-center justify-center gap-2">
      <span className={cn('hidden h-px w-10 sm:block', line)} />
      <img src={sprig} alt="" loading="lazy" decoding="async" className={cn(img, 'h-auto w-[150px] sm:w-[170px]')} />
      <span className={cn('hidden h-px w-10 sm:block', line)} />
    </div>
  )
}

/**
 * Around the hero photo: a fine gold rectangle set off the photo, with painted
 * greenery lush at the top-left and bottom-right corners and thinning out along
 * the frame's edges (the corner of each painting sits on the frame's corner).
 */
export function GreeneryPhotoFrame() {
  const reduce = useReducedMotion()
  const grow = (delay: number) =>
    reduce ? {} : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 1.6, delay, ease: [0.22, 1, 0.36, 1] as const } }
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10">
      <span className="absolute -inset-3.5 border border-champagne/70 sm:-inset-[18px]" />
      <motion.img
        src={frame}
        alt=""
        decoding="async"
        className={cn(img, 'absolute -left-3.5 -top-3.5 h-auto w-[86%] max-w-none -translate-x-[19%] -translate-y-[19%] sm:-left-[18px] sm:-top-[18px]')}
        {...grow(0.4)}
      />
      <motion.img
        src={frameBr}
        alt=""
        decoding="async"
        className={cn(img, 'absolute -bottom-3.5 -right-3.5 h-auto w-[86%] max-w-none translate-x-[19%] translate-y-[19%] sm:-bottom-[18px] sm:-right-[18px]')}
        {...grow(0.7)}
      />
    </div>
  )
}
