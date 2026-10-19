import type { InvitationWithRSVP } from '../../types/rsvp'
import { bySide, headcount, type SideFilter } from '../../utils/headcount'

/** "23 invitations + 9 included guests + 0 approved extra guests = 32 expected guests" */
export function HeadcountSummary({ invitations, side }: { invitations: InvitationWithRSVP[]; side: SideFilter }) {
  const h = headcount(bySide(invitations, side))
  const groom = side === 'all' ? headcount(bySide(invitations, 'groom')).expected : 0
  const bride = side === 'all' ? headcount(bySide(invitations, 'bride')).expected : 0
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

  const parts: [number, string][] = [
    [h.invitations, h.invitations === 1 ? 'invitation' : 'invitations'],
    [h.included, h.included === 1 ? 'included guest' : 'included guests'],
    [h.approvedExtras, h.approvedExtras === 1 ? 'approved extra guest' : 'approved extra guests'],
  ]

  const notes = [
    h.possibleMore > 0 && `Up to ${plural(h.possibleMore, 'more guest')} if every invitee brings the extra guests they’re allowed`,
    h.declinedPeople > 0 && `${plural(h.declinedPeople, 'person', 'people')} in parties that can’t come — not counted`,
    h.recordedByCouple > 0 && `${plural(h.recordedByCouple, 'RSVP')} recorded by you`,
  ].filter(Boolean) as string[]

  return (
    <section aria-label="Expected headcount" className="mb-5 rounded-xl border border-line bg-paper px-4 py-4 shadow-soft sm:px-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {parts.map(([n, label], i) => (
          <span key={label} className="flex items-center gap-3">
            {i > 0 && (
              <span aria-hidden="true" className="text-muted">
                +
              </span>
            )}
            <span className="text-sm text-ink-soft">
              <strong className="font-serif text-2xl font-normal tabular-nums text-ink">{n}</strong> {label}
            </span>
          </span>
        ))}
        <span aria-hidden="true" className="text-muted">
          =
        </span>
        <span className="rounded-lg bg-ink px-3 py-1.5 text-sm text-ivory">
          <strong className="font-serif text-2xl font-normal tabular-nums">{h.expected}</strong> expected {h.expected === 1 ? 'guest' : 'guests'}
        </span>
        {side === 'all' && (groom > 0 || bride > 0) && (
          <span className="text-sm text-muted sm:ml-auto">
            Groom’s side <strong className="font-medium tabular-nums text-ink">{groom}</strong> · Bride’s side{' '}
            <strong className="font-medium tabular-nums text-ink">{bride}</strong>
          </span>
        )}
      </div>
      {notes.length > 0 && <p className="mt-2 text-xs text-muted">{notes.join(' · ')}</p>}
    </section>
  )
}
