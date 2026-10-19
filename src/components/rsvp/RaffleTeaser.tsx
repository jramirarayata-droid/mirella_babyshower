import { motion, useReducedMotion } from 'framer-motion'
import { Gift } from 'lucide-react'
import type { RsvpTeaser } from '../../types/questions'
import { cn } from '../ui/cn'

/**
 * The highlighted note on the RSVP search page (Admin → Website Settings →
 * Raffle note), e.g. "Confirm your attendance for a chance to win up to ₱25,000".
 * Soft champagne card, the amount in large gold serif, a slow shine once.
 */
export function RaffleTeaser({ teaser, className }: { teaser: RsvpTeaser; className?: string }) {
  const reduce = useReducedMotion()
  if (!teaser.enabled || !(teaser.title.trim() || teaser.highlight.trim())) return null
  return (
    <motion.aside
      aria-label="Baby shower raffle"
      data-raffle-teaser
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.35, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'relative mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-champagne/60 px-6 pb-5 pt-6 text-center',
        'shadow-[0_18px_40px_-24px_rgba(138,110,69,0.55)]',
        className,
      )}
      style={{
        background:
          'linear-gradient(160deg, color-mix(in srgb, var(--color-champagne-light) 75%, var(--color-paper)) 0%, var(--color-paper) 60%, color-mix(in srgb, var(--color-champagne-light) 55%, var(--color-paper)) 100%)',
      }}
    >
      {/* a slow shine that passes once */}
      {!reduce && (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/70 to-transparent"
          initial={{ x: '0%' }}
          animate={{ x: '450%' }}
          transition={{ delay: 1.1, duration: 1.6, ease: 'easeInOut' }}
        />
      )}
      <span className="relative mx-auto grid size-10 place-items-center rounded-full border border-champagne/60 bg-paper text-gold shadow-soft">
        <Gift aria-hidden="true" className="size-[1.15rem]" strokeWidth={1.6} />
      </span>
      {teaser.title.trim() && <p className="relative mt-3 text-[0.95rem] leading-snug text-ink-soft">{teaser.title.trim()}</p>}
      {teaser.highlight.trim() && (
        <p className="relative mt-1 font-serif text-[2.35rem] font-medium italic leading-tight text-gold sm:text-[2.6rem]">{teaser.highlight.trim()}</p>
      )}
      {teaser.note.trim() && <p className="relative mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-muted">{teaser.note.trim()}</p>}
    </motion.aside>
  )
}
