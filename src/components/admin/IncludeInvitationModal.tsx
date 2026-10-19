import { useEffect, useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import type { InvitationWithRSVP } from '../../types/rsvp'
import type { SeatingTable } from '../../types/seating'
import { normalizeName } from '../../utils/validation'
import { includedGuests, requestedGuests } from '../../utils/guests'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { cn } from '../ui/cn'

interface Props {
  /** The invitation whose invitee becomes an included guest elsewhere. */
  from: InvitationWithRSVP | null
  invitations: InvitationWithRSVP[]
  tables: SeatingTable[]
  /** "invitationId:guestId" of everyone with a chair */
  seatedKeys: Set<string>
  /** "invitationId:guestId" → entourage role */
  positions: Map<string, string>
  /** How many times each invitation's link was opened */
  openCounts: Map<string, number>
  saving: boolean
  onClose: () => void
  onConfirm: (into: InvitationWithRSVP) => void
}

const possessive = (name: string) => `${name}’s`

/** Pick the invitation to include someone in, and see exactly what will happen first. */
export function IncludeInvitationModal({ from, invitations, tables, seatedKeys, positions, openCounts, saving, onClose, onConfirm }: Props) {
  const [query, setQuery] = useState('')
  const [intoId, setIntoId] = useState<string | null>(null)
  useEffect(() => {
    setQuery('')
    setIntoId(null)
  }, [from])

  const choices = useMemo(() => {
    if (!from) return []
    const q = normalizeName(query)
    return invitations
      .filter((i) => i.id !== from.id)
      .filter((i) => !q || normalizeName(i.inviteeName).includes(q) || i.guests.some((g) => normalizeName(g.guestName).includes(q)))
      .sort((a, b) => Number(b.side === from.side) - Number(a.side === from.side) || a.inviteeName.localeCompare(b.inviteeName))
  }, [from, invitations, query])

  const into = invitations.find((i) => i.id === intoId) ?? null
  const tableName = (id: string | null) => tables.find((t) => t.id === id)?.name ?? null

  const notes = useMemo(() => {
    if (!from || !into) return []
    const out: string[] = []
    const name = from.inviteeName
    const comes = [...includedGuests(from), ...requestedGuests(from).filter((g) => g.status !== 'declined')]
    out.push(`${name} joins ${possessive(into.inviteeName)} invitation as an included guest, and ${possessive(name)} own invitation is removed.`)
    if (comes.length) out.push(`${comes.length === 1 ? 'Their guest comes' : 'Their guests come'} along as included guests: ${comes.map((g) => g.guestName).join(', ')}.`)
    const dropped = requestedGuests(from).filter((g) => g.status === 'declined')
    if (dropped.length) out.push(`Declined guest requests are left out: ${dropped.map((g) => g.guestName).join(', ')}.`)
    const table = tableName(from.tableId)
    if (seatedKeys.has(`${from.id}:`)) out.push(`Keeps their chair${table ? ` at ${table}` : ''} in Seating.`)
    else if (table) out.push(`Not in a chair yet — you can seat them at ${table} from ${possessive(into.inviteeName)} party in Seating.`)
    const role = positions.get(`${from.id}:`)
    if (from.positionMode === 'custom' && from.positionLabel.trim() && from.positionLabel.trim() !== role)
      out.push(`The position on their own card (“${from.positionLabel.trim()}”) is kept aside and comes back if you separate them again.`)
    const opens = openCounts.get(from.id) ?? 0
    out.push(`Their link still works — it now opens ${possessive(into.inviteeName)} invitation${opens ? ` (opened ${opens} ${opens === 1 ? 'time' : 'times'} so far)` : ''}.`)
    if (from.printedAt) out.push(`Their paper invitation was already printed — print ${possessive(into.inviteeName)} again so it lists ${name}.`)
    const answer = from.response?.attendanceStatus
    if (answer === 'attending' && !into.response) out.push(`${possessive(name)} answer (Attending) becomes the answer for ${possessive(into.inviteeName)} invitation.`)
    else if (answer === 'attending') out.push(`${possessive(into.inviteeName)} invitation already has an answer, so it stays. ${possessive(name)} answer is kept aside.`)
    else if (answer === 'declining') out.push(`${name} answered “can’t come”. That isn’t carried over (it would decline the whole invitation) — remove them from the invitation if they still can’t come.`)
    if (into.side !== from.side) out.push(`${name} will count on the ${into.side === 'bride' ? 'mom’s' : 'dad’s'} side, like ${into.inviteeName}.`)
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, into, seatedKeys, positions, openCounts, tables])

  return (
    <Modal
      open={Boolean(from)}
      onClose={onClose}
      locked={saving}
      title={from ? `Include ${from.inviteeName} in another invitation` : ''}
      description="They become an included guest on the invitation you pick. Their chair and link carry over."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => into && onConfirm(into)} disabled={!into} loading={saving} loadingText="Combining…" className="sm:min-w-44">
            {into ? `Include in ${possessive(into.inviteeName)} invitation` : 'Pick an invitation'}
          </Button>
        </>
      }
    >
      {from && (
        <div className="space-y-4">
          <input
            type="search"
            aria-label="Find the invitation to include them in"
            placeholder="Search by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input-base min-h-11 w-full py-2.5"
            data-autofocus
          />
          <div role="radiogroup" aria-label="Invitation to include them in" className="max-h-64 overflow-y-auto rounded-xl border border-line">
            {choices.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted">No invitations match.</p>}
            {choices.map((i) => {
              const picked = i.id === intoId
              const names = includedGuests(i).map((g) => g.guestName)
              return (
                <button
                  key={i.id}
                  type="button"
                  role="radio"
                  aria-checked={picked}
                  onClick={() => setIntoId(i.id)}
                  className={cn(
                    'flex w-full items-center gap-3 border-b border-line px-4 py-2.5 text-left transition last:border-b-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold',
                    picked ? 'bg-champagne-light/60' : 'hover:bg-cream',
                  )}
                >
                  <span className={cn('grid size-5 shrink-0 place-items-center rounded-full border', picked ? 'border-gold bg-gold text-white' : 'border-line')}>
                    {picked && <Check aria-hidden="true" className="size-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-ink">{i.inviteeName}</span>
                    {names.length > 0 && <span className="block truncate text-xs text-muted">with {names.join(', ')}</span>}
                  </span>
                  {tableName(i.tableId) && <span className="hidden text-xs text-muted sm:inline">{tableName(i.tableId)}</span>}
                  <Badge tone={i.side === 'bride' ? 'rose' : 'gold'}>{i.side === 'bride' ? 'Mom' : 'Dad'}</Badge>
                </button>
              )
            })}
          </div>
          {into && (
            <section aria-label="What happens" className="rounded-xl bg-cream/70 px-4 py-3">
              <h3 className="mb-1.5 text-sm font-medium text-ink">What happens</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
                {notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">Changed your mind later? Edit {possessive(into.inviteeName)} invitation and choose “Own invitation” next to {from.inviteeName}.</p>
            </section>
          )}
        </div>
      )}
    </Modal>
  )
}
