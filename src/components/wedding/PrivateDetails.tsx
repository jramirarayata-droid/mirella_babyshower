import { Link } from 'react-router-dom'
import { LockKeyhole } from 'lucide-react'
import { Ornament } from '../ui/Ornament'
import { Reveal } from './Reveal'

/** Shown on the website in place of details the couple shares only with confirmed guests. */
export function PrivateDetails({ venues, info, rsvpOpen }: { venues: boolean; info: boolean; rsvpOpen: boolean }) {
  const what = venues && info ? 'The ceremony, reception and other wedding details are' : venues ? 'The ceremony and reception details are' : 'The wedding details are'
  return (
    <section aria-labelledby="private-details-heading" className="px-5 py-20 sm:px-8 sm:py-24">
      <Reveal className="mx-auto flex max-w-xl flex-col items-center text-center">
        <span className="flex size-14 items-center justify-center rounded-full border border-champagne/50 text-champagne">
          <LockKeyhole aria-hidden="true" className="size-5" strokeWidth={1.5} />
        </span>
        <h2 id="private-details-heading" className="mt-6 text-3xl leading-tight text-ink sm:text-4xl">
          Shared with our confirmed guests
        </h2>
        <Ornament className="mt-6" />
        <p className="mt-6 leading-relaxed text-ink-soft">
          {what} shared with guests who have confirmed they’re coming. Once you RSVP, you’ll find everything on your invitation.
        </p>
        {rsvpOpen && (
          <Link
            to="/rsvp"
            className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-ink px-8 text-[0.95rem] font-medium text-ivory shadow-soft transition hover:bg-ink-soft"
          >
            Find my invitation
          </Link>
        )}
      </Reveal>
    </section>
  )
}
