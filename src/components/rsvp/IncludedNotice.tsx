import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Armchair, Heart } from 'lucide-react'
import type { IncludedGuestLookup } from '../../types/rsvp'

/** Shown when the searched name belongs to someone included in another person's invitation. */
export function IncludedNotice({ included, showSeat }: { included: IncludedGuestLookup; showSeat: boolean }) {
  const reduce = useReducedMotion()
  const who = included.inviteeName
  const s = included.attendanceStatus
  return (
    <motion.div
      role="status"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto mt-8 w-full max-w-md rounded-xl border border-champagne/50 bg-paper px-6 py-6 text-center shadow-soft"
    >
      <Heart aria-hidden="true" className="mx-auto size-5 text-gold" strokeWidth={1.5} />
      <p className="mt-3 text-[0.7rem] font-medium uppercase tracking-[0.3em] text-gold">You’re on our list</p>
      <p className="mt-3 font-serif text-[1.5rem] leading-snug text-ink">
        You’re included in <span className="whitespace-nowrap">{who}’s</span> invitation
      </p>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        {s === 'attending'
          ? 'You’re already confirmed — there’s nothing you need to do. We can’t wait to celebrate with you!'
          : s === 'declining'
            ? `${who} has let us know your party can’t make it. If plans change, please ask ${who} to update the RSVP.`
            : `${who} will RSVP for your party, so there’s nothing you need to do here.`}
      </p>
      {showSeat && s === 'attending' && (
        <Link
          to="/seat"
          state={{ name: included.searchedName }}
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-ivory shadow-soft transition hover:bg-ink-soft"
        >
          <Armchair aria-hidden="true" className="size-4" strokeWidth={1.6} />
          Find my seat
        </Link>
      )}
    </motion.div>
  )
}
