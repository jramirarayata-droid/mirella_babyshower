import { useEffect, useState, type FormEvent } from 'react'
import { Copy, Plus, Split, X } from 'lucide-react'
import type { AdditionalGuest, InvitationInput, InvitationWithRSVP } from '../../types/rsvp'
import { LIMITS, normalizePhMobile, normalizeName, normalizeSpaces, validateInvitation, type InvitationErrors } from '../../utils/validation'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { cn } from '../ui/cn'
import { Button } from '../ui/Button'
import { TextField } from '../ui/FormField'
import { Modal } from '../ui/Modal'
import { TablePicker } from './TablePicker'
import type { SeatingTable } from '../../types/seating'
import { plannedPerTable } from '../../utils/seatingPeople'
import { useWeddingSettings } from '../../hooks/useWeddingSettings'
import { guestPriceEach } from '../../utils/questions'

export interface RecordChoice {
  status: 'attending' | 'declining'
  mobile: string
}

interface Props {
  open: boolean
  invitation: InvitationWithRSVP | null // null = create
  saving: boolean
  onClose: () => void
  /** includedGuests = names the couple invites together with the invitee. */
  onSave: (input: InvitationInput, includedGuests: string[], record: RecordChoice | null) => void
  onCopyLink?: (code: string) => void
  tables: SeatingTable[]
  invitations: InvitationWithRSVP[]
  onTableCreated: (table: SeatingTable) => void
  /** Position taken from the entourage for this invitee, if linked. */
  autoPosition?: string
  /** Give a saved included guest their own invitation again. */
  onSeparate?: (guest: AdditionalGuest) => void
}

const EMPTY: InvitationInput = { inviteeName: '', tableId: null, positionMode: 'auto', positionLabel: '', side: null, maxAdditionalGuests: 0, isActive: true }

export function InvitationFormModal({ open, invitation, saving, onClose, onSave, onCopyLink, tables, invitations, onTableCreated, autoPosition = '', onSeparate }: Props) {
  const priceEach = guestPriceEach(useWeddingSettings().settings?.rsvpConfig)
  const [values, setValues] = useState<InvitationInput>(EMPTY)
  const [errors, setErrors] = useState<InvitationErrors>({})
  const [included, setIncluded] = useState<string[]>([])
  const [includedErrors, setIncludedErrors] = useState<Record<number, string>>({})
  const [record, setRecord] = useState<'none' | 'attending' | 'declining'>('none')
  const [contact, setContact] = useState('')
  const [contactError, setContactError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!open) return
    setErrors({})
    setIncludedErrors({})
    setRecord('none')
    setContact('')
    setContactError(null)
    setConfirming(false)
    setIncluded(invitation ? invitation.guests.filter((g) => g.addedBy === 'admin').map((g) => g.guestName) : [])
    setValues(
      invitation
        ? {
            inviteeName: invitation.inviteeName,
            tableId: invitation.tableId,
            positionMode: invitation.positionMode,
            positionLabel: invitation.positionLabel,
            side: invitation.side,
            maxAdditionalGuests: invitation.maxAdditionalGuests,
            isActive: invitation.isActive,
          }
        : EMPTY,
    )
  }, [open, invitation])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const found = validateInvitation(values)
    setErrors(found)

    const perRow: Record<number, string> = {}
    const seen = new Set<string>([normalizeName(values.inviteeName)])
    included.forEach((raw, i) => {
      const key = normalizeName(raw)
      if (!key) return
      if (raw.trim().length > LIMITS.guestName) perRow[i] = `Please keep names under ${LIMITS.guestName} characters.`
      else if (seen.has(key)) perRow[i] = 'This name is already on the invitation.'
      seen.add(key)
    })
    setIncludedErrors(perRow)

    const badContact = record !== 'none' && contact.trim() && !normalizePhMobile(contact) ? 'Use a PH mobile number like 0917 123 4567, or leave it blank.' : null
    setContactError(badContact)
    if (Object.keys(found).length || Object.keys(perRow).length || badContact) return
    if (record !== 'none') {
      setConfirming(true)
      return
    }
    onSave(values, included.map(normalizeSpaces).filter(Boolean), null)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={saving}
      title={invitation ? 'Edit Invitation' : 'Add Invitation'}
      description={invitation ? 'Changes apply to the RSVP page immediately.' : 'Guests find their invitation by searching this exact name.'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="invitation-form" loading={saving} loadingText="Saving…" className="sm:min-w-36">
            {invitation ? 'Save Changes' : 'Add Invitation'}
          </Button>
        </>
      }
    >
      <form id="invitation-form" onSubmit={submit} noValidate className="space-y-5">
        <TextField
          label="Invitee Name"
          value={values.inviteeName}
          onChange={(v) => setValues((s) => ({ ...s, inviteeName: v }))}
          maxLength={LIMITS.inviteeName}
          error={errors.inviteeName}
          required
          data-autofocus
          autoComplete="off"
        />
        <fieldset>
          <legend className="mb-2 text-[0.95rem] font-medium text-ink-soft">Guest of</legend>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-cream p-1" role="radiogroup" aria-label="Guest of">
            {(
              [
                { v: 'groom', l: 'Groom’s side' },
                { v: 'bride', l: 'Bride’s side' },
              ] as const
            ).map((o) => (
              <button
                key={o.v}
                type="button"
                role="radio"
                aria-checked={values.side === o.v}
                onClick={() => {
                  setValues((s) => ({ ...s, side: o.v }))
                  setErrors((e) => ({ ...e, side: undefined }))
                }}
                className={cn('min-h-10 rounded-md px-2 py-1.5 text-sm transition', values.side === o.v ? 'bg-paper font-medium text-ink shadow-soft' : 'text-muted hover:text-ink')}
              >
                {o.l}
              </button>
            ))}
          </div>
          {errors.side ? (
            <p role="alert" className="mt-1.5 text-sm text-rose">
              {errors.side}
            </p>
          ) : (
            <p className="mt-1.5 text-sm text-muted">Included guests are counted on the same side.</p>
          )}
        </fieldset>
        <TablePicker
          tables={tables}
          used={plannedPerTable(invitations, invitation?.id)}
          partySize={1 + included.filter((n) => n.trim()).length}
          value={values.tableId}
          onChange={(tableId) => setValues((s) => ({ ...s, tableId }))}
          onTableCreated={onTableCreated}
        />
        <fieldset>
          <legend className="mb-2 text-[0.95rem] font-medium text-ink-soft">Position on the printed invitation (optional)</legend>
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-cream p-1">
            {(
              [
                { v: 'auto', l: 'From entourage' },
                { v: 'custom', l: 'Type it' },
                { v: 'none', l: 'Don’t show' },
              ] as const
            ).map((o) => (
              <button
                key={o.v}
                type="button"
                aria-pressed={values.positionMode === o.v}
                onClick={() => setValues((s) => ({ ...s, positionMode: o.v }))}
                className={cn('rounded-md px-2 py-1.5 text-sm transition', values.positionMode === o.v ? 'bg-paper text-ink shadow-soft' : 'text-muted hover:text-ink')}
              >
                {o.l}
              </button>
            ))}
          </div>
          {values.positionMode === 'auto' && (
            <p className="mt-1.5 text-sm text-muted">
              {autoPosition ? (
                <>
                  Will show: <strong className="font-medium text-ink">{autoPosition}</strong>
                </>
              ) : (
                'Not linked in the entourage yet — nothing will show. Link them in Entourage → “Pick from guest list”.'
              )}
            </p>
          )}
          {values.positionMode === 'custom' && (
            <TextField
              className="mt-2"
              label={<span className="sr-only">Position</span>}
              hideLabel
              value={values.positionLabel}
              onChange={(v) => setValues((s) => ({ ...s, positionLabel: v }))}
              maxLength={80}
              placeholder="e.g. Maid of Honor, Principal Sponsor, Ninang"
            />
          )}
        </fieldset>
        <TextField
          label="Extra guests they may request"
          type="number"
          inputMode="numeric"
          min={0}
          max={LIMITS.maxAdditionalGuestsPerInvitation}
          value={String(values.maxAdditionalGuests)}
          onChange={(v) => setValues((s) => ({ ...s, maxAdditionalGuests: v === '' ? 0 : Math.trunc(Number(v)) }))}
          hint={`Extra guests the invitee may request on the RSVP form (${priceEach ? `${priceEach}, ` : ''}needs your approval). 0 hides that question.`}
          error={errors.maxAdditionalGuests}
        />
        <fieldset className="rounded-lg border border-line px-4 pb-4 pt-3">
          <legend className="px-1 text-[0.95rem] font-medium text-ink-soft">Included guests</legend>
          <p className="mb-3 text-sm text-muted">
            People you’re inviting together with {values.inviteeName.trim() || 'this invitee'} — e.g. a spouse or children. They’re shown on the
            invitation after it opens and are confirmed automatically.
          </p>
          <div className="space-y-2.5">
            {included.map((name, i) => {
              const saved = invitation?.guests.find((g) => g.addedBy === 'admin' && g.guestName === name)
              return (
              <div key={i}>
                <div className="flex items-center gap-2">
                  <label className="sr-only" htmlFor={`included-${i}`}>
                    Included guest {i + 1}
                  </label>
                  <input
                    id={`included-${i}`}
                    value={name}
                    maxLength={LIMITS.guestName}
                    placeholder="Full name"
                    autoComplete="off"
                    onChange={(e) => setIncluded((list) => list.map((n, j) => (j === i ? e.target.value : n)))}
                    aria-invalid={includedErrors[i] ? true : undefined}
                    className="input-base min-h-11 py-2.5"
                  />
                  <button
                    type="button"
                    onClick={() => setIncluded((list) => list.filter((_, j) => j !== i))}
                    aria-label={`Remove included guest ${name || i + 1}`}
                    className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-rose/10 hover:text-rose"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                {saved && onSeparate && (
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                    {saved.mergedFrom && <span>Had their own invitation{saved.mergedFrom.positionLabel ? ` (${saved.mergedFrom.positionLabel})` : ''}.</span>}
                    <button
                      type="button"
                      onClick={() => onSeparate(saved)}
                      className="inline-flex items-center gap-1 rounded px-1 py-0.5 font-medium text-gold underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-gold"
                      aria-label={`Give ${name} their own invitation`}
                    >
                      <Split aria-hidden="true" className="size-3.5" />
                      Own invitation
                    </button>
                  </div>
                )}
                {includedErrors[i] && (
                  <p role="alert" className="mt-1 text-sm text-rose">
                    {includedErrors[i]}
                  </p>
                )}
              </div>
              )
            })}
          </div>
          {included.length < 20 && (
            <Button
              variant="subtle"
              size="sm"
              className="mt-3"
              icon={<Plus aria-hidden="true" className="size-4" />}
              onClick={() => {
                setIncluded((list) => [...list, ''])
                window.setTimeout(() => document.getElementById(`included-${included.length}`)?.focus(), 50)
              }}
            >
              Add included guest
            </Button>
          )}
        </fieldset>
        <fieldset className="rounded-lg border border-line px-4 pb-4 pt-3">
          <legend className="px-1 text-[0.95rem] font-medium text-ink-soft">Record their response for them</legend>
          <p className="mb-3 text-sm text-muted">
            For guests who can’t RSVP online (e.g. elderly relatives). Leave on “No” and they can RSVP on the website as usual.
            {invitation?.response && (
              <>
                {' '}
                Current response: <strong className="font-medium text-ink">{invitation.response.attendanceStatus === 'attending' ? 'Attending' : 'Not attending'}</strong>
                {invitation.response.recordedByAdmin ? ' (confirmed by you)' : ' (from their online RSVP)'}.
              </>
            )}
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {(
              [
                { v: 'none', t: 'No', d: 'They’ll RSVP online' },
                { v: 'attending', t: 'Attending', d: 'Mark as coming' },
                { v: 'declining', t: 'Not attending', d: 'Mark as not coming' },
              ] as const
            ).map((o) => (
              <label
                key={o.v}
                className={cn(
                  'relative cursor-pointer rounded-lg border px-3 py-2.5 text-sm transition has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-gold',
                  record === o.v ? 'border-ink bg-ink/[0.03]' : 'border-line hover:border-champagne',
                )}
              >
                <input type="radio" name="record-rsvp" className="sr-only" checked={record === o.v} onChange={() => setRecord(o.v)} />
                <span className="block font-medium text-ink">{o.t}</span>
                <span className="block text-xs text-muted">{o.d}</span>
              </label>
            ))}
          </div>
          {record !== 'none' && (
            <TextField
              className="mt-3"
              label="Contact number (optional)"
              type="tel"
              inputMode="tel"
              value={contact}
              onChange={setContact}
              maxLength={20}
              placeholder="0917 123 4567"
              hint="E.g. a son or daughter you can reach about the wedding."
              error={contactError ?? undefined}
            />
          )}
        </fieldset>
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-line bg-ivory/60 px-4 py-3.5">
          <span>
            <span className="block text-[0.95rem] font-medium text-ink-soft">Active</span>
            <span className="block text-sm text-muted">Inactive invitations can’t be found on the RSVP page.</span>
          </span>
          <input
            type="checkbox"
            checked={values.isActive}
            onChange={(e) => setValues((s) => ({ ...s, isActive: e.target.checked }))}
            className="size-5 shrink-0 accent-ink"
          />
        </label>
        {invitation && onCopyLink && (
          <div className="rounded-lg border border-dashed border-line px-4 py-3 text-sm text-muted">
            <p>
              Internal invitation code: <code className="rounded bg-cream px-1.5 py-0.5 text-ink">{invitation.invitationCode}</code>
            </p>
            <button
              type="button"
              onClick={() => onCopyLink(invitation.invitationCode)}
              className="mt-2 inline-flex items-center gap-1.5 rounded text-gold underline-offset-4 hover:underline"
            >
              <Copy aria-hidden="true" className="size-3.5" /> Copy invitation (message and link)
            </button>
          </div>
        )}
      </form>
      <ConfirmDialog
        open={confirming}
        tone="admin"
        title={`Record “${record === 'attending' ? 'Attending' : 'Not attending'}” for ${normalizeSpaces(values.inviteeName) || 'this guest'}?`}
        message={
          <span className="block space-y-2">
            {record === 'attending' ? (
              <span className="block">
                This saves an <strong>attending</strong> RSVP on their behalf
                {included.filter((n) => n.trim()).length > 0 && <> together with their {included.filter((n) => n.trim()).length} included {included.filter((n) => n.trim()).length === 1 ? 'guest' : 'guests'}</>}.
                They’ll count in your headcount, can be seated, and are tagged <strong>“Confirmed by couple”</strong>. Food, transport and other answers stay
                blank.
              </span>
            ) : (
              <span className="block">
                This saves a <strong>not attending</strong> RSVP on their behalf. If they had a seat, it will be freed.
              </span>
            )}
            {invitation?.response && !invitation.response.recordedByAdmin && (
              <span className="block font-medium text-rose">This replaces the answers they already gave online.</span>
            )}
            <span className="block text-muted">To undo, delete the response in Responses. If they later RSVP online, their answers replace this.</span>
          </span>
        }
        confirmLabel="Yes, record it"
        loading={saving}
        loadingText="Saving…"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false)
          onSave(values, included.map(normalizeSpaces).filter(Boolean), { status: record as RecordChoice['status'], mobile: contact })
        }}
      />
    </Modal>
  )
}
