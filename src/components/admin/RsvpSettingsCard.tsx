import { useEffect, useState } from 'react'
import { CalendarClock, RotateCcw, Save, XCircle } from 'lucide-react'
import { useToast } from '../../hooks/useToast'
import { setCachedWeddingSettings } from '../../hooks/useWeddingSettings'
import { getWeddingSettings, isRsvpOpen, updateRsvpSettings } from '../../services/settingsService'
import type { RsvpSettings } from '../../types/wedding'
import { toFriendlyMessage } from '../../utils/errors'
import { formatDeadlineDateTime, fromManilaParts, toManilaParts } from '../../utils/formatting'
import { Button } from '../ui/Button'
import { TextAreaField, TextField } from '../ui/FormField'
import { cn } from '../ui/cn'
import { Skeleton } from '../ui/Skeleton'
import { Badge } from '../ui/Badge'
import { useUnsavedChanges } from '../../hooks/unsavedChanges'
import { SaveStatus } from '../../components/ui/SaveStatus'

/** RSVP deadline, open/closed switch, closed message and quick "reopen" actions. */
export function RsvpSettingsCard() {
  const toast = useToast()
  const [id, setId] = useState<string | null>(null)
  const [saved, setSaved] = useState<RsvpSettings | null>(null)
  const [open, setOpen] = useState(true)
  const [hasDeadline, setHasDeadline] = useState(false)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('23:59')
  const [message, setMessage] = useState('')
  const [showDeadline, setShowDeadline] = useState(true)
  const [buttonLabel, setButtonLabel] = useState('RSVP')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = (s: RsvpSettings) => {
    setSaved(s)
    setOpen(s.rsvpOpen)
    setHasDeadline(Boolean(s.rsvpDeadline))
    const parts = s.rsvpDeadline ? toManilaParts(s.rsvpDeadline) : null
    setDate(parts?.date ?? '')
    setTime(parts?.time ?? '23:59')
    setMessage(s.rsvpClosedMessage)
    setShowDeadline(s.rsvpShowDeadline)
    setButtonLabel(s.rsvpButtonLabel)
  }

  useEffect(() => {
    getWeddingSettings()
      .then((s) => {
        setId(s.id)
        load(s)
      })
      .catch((e) => setError(toFriendlyMessage(e)))
  }, [])

  const persist = async (next: RsvpSettings, success: string) => {
    if (!id) return
    setSaving(true)
    try {
      const s = await updateRsvpSettings(id, next)
      setCachedWeddingSettings(s)
      load(s)
      toast.success(success)
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const save = () => {
    if (!buttonLabel.trim()) {
      toast.error('Please enter the RSVP button text.')
      return
    }
    if (hasDeadline && !date) {
      toast.error('Please choose the deadline date, or turn the deadline off.')
      return
    }
    void persist(
      { rsvpOpen: open, rsvpDeadline: hasDeadline ? fromManilaParts(date, time) : null, rsvpClosedMessage: message, rsvpShowDeadline: showDeadline, rsvpButtonLabel: buttonLabel },
      'RSVP settings saved.',
    )
  }

  const reopenFor = (days: number) => {
    const d = new Date(Date.now() + days * 86_400_000)
    const parts = toManilaParts(d.toISOString())
    void persist(
      { rsvpOpen: true, rsvpDeadline: fromManilaParts(parts.date, '23:59'), rsvpClosedMessage: message, rsvpShowDeadline: showDeadline, rsvpButtonLabel: buttonLabel },
      `RSVP reopened until ${formatDeadlineDateTime(fromManilaParts(parts.date, '23:59'))}.`,
    )
  }

  const dirty = saved
    ? open !== saved.rsvpOpen ||
      message !== saved.rsvpClosedMessage ||
      showDeadline !== saved.rsvpShowDeadline ||
      buttonLabel !== saved.rsvpButtonLabel ||
      (hasDeadline ? fromManilaParts(date || '2000-01-01', time) : null) !== (saved.rsvpDeadline ? new Date(saved.rsvpDeadline).toISOString() : null)
    : false
  useUnsavedChanges(dirty, 'RSVP settings')
  if (error) {
    return (
      <p role="alert" className="text-sm text-rose">
        {error}
      </p>
    )
  }
  if (!saved) return <Skeleton className="h-56" />

  const liveOpen = isRsvpOpen(saved)

  return (
    <section id="rsvp-settings" aria-labelledby="rsvp-settings-heading" className="scroll-mt-24 rounded-xl border border-line bg-paper p-5 shadow-soft sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="rsvp-settings-heading" className="text-2xl text-ink">
            RSVP Settings
          </h2>
          <p className="mt-1 text-sm text-muted">After the deadline the RSVP buttons disappear and new responses are refused.</p>
        </div>
        <Badge tone={liveOpen ? 'green' : 'rose'}>
          {liveOpen ? (saved.rsvpDeadline ? `Open until ${formatDeadlineDateTime(saved.rsvpDeadline)}` : 'Open, no deadline') : 'Closed'}
        </Badge>
      </div>

      <div className="space-y-5">
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-line bg-ivory/60 px-4 py-3.5">
          <span>
            <span className="block text-[0.95rem] font-medium text-ink-soft">Accept RSVPs</span>
            <span className="block text-sm text-muted">Turn off to close RSVPs immediately, whatever the deadline.</span>
          </span>
          <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} className="size-5 shrink-0 accent-ink" />
        </label>

        <div className="rounded-lg border border-line px-4 py-4">
          <label className="flex cursor-pointer items-center gap-3 text-[0.95rem] font-medium text-ink-soft">
            <input type="checkbox" checked={hasDeadline} onChange={(e) => setHasDeadline(e.target.checked)} className="size-5 accent-ink" />
            Close RSVPs automatically on a date
          </label>
          {hasDeadline && (
            <>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="rsvp-deadline-date" className="mb-2 block text-sm font-medium text-ink-soft">
                  Deadline date
                </label>
                <input id="rsvp-deadline-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-base" />
              </div>
              <div>
                <label htmlFor="rsvp-deadline-time" className="mb-2 block text-sm font-medium text-ink-soft">
                  Time (Philippine time)
                </label>
                <input id="rsvp-deadline-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input-base" />
              </div>
            </div>
            <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-ink-soft">
              <input type="checkbox" checked={showDeadline} onChange={(e) => setShowDeadline(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-ink" />
              <span>
                <span className="block font-medium">Show the deadline to guests</span>
                <span className="mt-0.5 block text-muted">
                  Shows “Expiration of the invitation:{' '}
                  {date ? formatDeadlineDateTime(fromManilaParts(date, time)) : '[date and time]'}” on the home page and “Please respond on or before …” on the
                  RSVP page. Turn off to keep the deadline private — RSVPs still close on time.
                </span>
              </span>
            </label>
            </>
          )}
        </div>

        <div>
          <TextField
            label="RSVP button text"
            value={buttonLabel}
            onChange={setButtonLabel}
            maxLength={30}
            hint="Shown on the RSVP buttons on the home page. Not everyone knows what “RSVP” means."
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {['RSVP', 'Confirm Attendance', 'Reply to Invitation', 'Will You Attend?', 'RSVP / Confirm Attendance'].map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setButtonLabel(l)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs transition',
                  buttonLabel === l ? 'border-ink bg-ink text-ivory' : 'border-line text-ink-soft hover:border-champagne',
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <TextAreaField
          label="Message shown when RSVPs are closed"
          value={message}
          onChange={setMessage}
          maxLength={400}
          rows={2}
        />

        <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button variant="subtle" size="sm" onClick={() => reopenFor(7)} disabled={saving} icon={<RotateCcw aria-hidden="true" className="size-4" />}>
              Reopen for 7 days
            </Button>
            <Button variant="subtle" size="sm" onClick={() => reopenFor(14)} disabled={saving} icon={<CalendarClock aria-hidden="true" className="size-4" />}>
              Reopen for 14 days
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void persist({ rsvpOpen: true, rsvpDeadline: null, rsvpClosedMessage: message, rsvpShowDeadline: showDeadline, rsvpButtonLabel: buttonLabel }, 'Deadline removed. RSVPs are open.')}
              disabled={saving}
              icon={<XCircle aria-hidden="true" className="size-4" />}
            >
              Remove deadline
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <SaveStatus dirty={dirty} saving={saving} />
            <Button onClick={save} loading={saving} loadingText="Saving…" disabled={!dirty} icon={<Save aria-hidden="true" className="size-4" />}>
              Save RSVP settings
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
