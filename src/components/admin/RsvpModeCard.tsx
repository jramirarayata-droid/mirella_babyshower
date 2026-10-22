import { useCallback, useEffect, useState } from 'react'
import { Download, Link2, ListChecks, Trash2, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../hooks/useToast'
import { setCachedWeddingSettings } from '../../hooks/useWeddingSettings'
import { clearGuestList, getWeddingSettings, updateRsvpMode } from '../../services/settingsService'
import { loadAdminData } from '../../services/adminService'
import { buildRSVPCsv, downloadCsv } from '../../utils/csvExport'
import type { RsvpMode } from '../../types/wedding'
import { toFriendlyMessage } from '../../utils/errors'
import { siteLinks } from '../../utils/share'
import { Button } from '../ui/Button'
import { Skeleton } from '../ui/Skeleton'
import { Modal } from '../ui/Modal'
import { TextField } from '../ui/FormField'
import { cn } from '../ui/cn'

/**
 * Website Settings → How guests RSVP. One way per shower:
 *   Guest list — only the names you add can RSVP.
 *   Open link  — one link for everyone; guests type their name and mobile number,
 *                companions (names required) wait for your approval.
 * Switching to the open link needs an empty guest list. Nothing is removed
 * without the customer asking: the list is cleared here, on purpose, with a
 * download offered first.
 */
export function RsvpModeCard() {
  const toast = useToast()
  const [id, setId] = useState<string | null>(null)
  const [mode, setMode] = useState<RsvpMode | null>(null)
  const [companions, setCompanions] = useState(1)
  const [listed, setListed] = useState<{ names: number; replies: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [asking, setAsking] = useState(false)

  const countListed = useCallback(async () => {
    const [names, replies] = await Promise.all([
      supabase.from('invitations').select('id', { count: 'exact', head: true }).eq('source', 'list'),
      supabase.from('rsvp_responses').select('id, invitations!inner(source)', { count: 'exact', head: true }).eq('invitations.source', 'list'),
    ])
    setListed({ names: names.count ?? 0, replies: replies.count ?? 0 })
  }, [])

  useEffect(() => {
    getWeddingSettings()
      .then((s) => {
        setId(s.id)
        setMode(s.rsvpMode)
        setCompanions(s.openRsvpCompanions)
      })
      .catch((e) => toast.error(toFriendlyMessage(e)))
    void countListed()
  }, [countListed, toast])

  const save = async (next: RsvpMode, nextCompanions = companions) => {
    if (!id) return
    setSaving(true)
    try {
      const s = await updateRsvpMode(id, next, nextCompanions)
      setCachedWeddingSettings(s)
      setMode(s.rsvpMode)
      setCompanions(s.openRsvpCompanions)
      toast.success(next === 'open' ? 'Saved. Share your RSVP link with everyone.' : 'Saved. Only the names on your guest list can RSVP.')
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const download = async () => {
    try {
      const data = await loadAdminData()
      const list = data.invitations.filter((i) => i.source !== 'link')
      downloadCsv(`guest-list-${new Date().toISOString().slice(0, 10)}.csv`, buildRSVPCsv(list))
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    }
  }

  const clearAndSwitch = async () => {
    setClearing(true)
    try {
      const n = await clearGuestList()
      await countListed()
      setAsking(false)
      setConfirmText('')
      toast.success(`Removed ${n} ${n === 1 ? 'guest' : 'guests'} from your list.`)
      await save('open')
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setClearing(false)
    }
  }

  const blocked = mode === 'list' && (listed?.names ?? 0) > 0
  const confirmWord = 'REMOVE'
  const rsvpLink = siteLinks().rsvp

  return (
    <section className="rounded-xl border border-champagne/70 bg-paper p-5 shadow-soft sm:p-6" aria-labelledby="rsvp-mode-heading">
      <h2 id="rsvp-mode-heading" className="text-2xl text-ink">
        How guests RSVP
      </h2>
      <p className="mt-1 text-sm text-muted">Choose one. This decides how your whole guest list works.</p>

      {!mode ? (
        <Skeleton className="mt-5 h-32" />
      ) : (
        <>
          <div role="radiogroup" aria-label="How guests RSVP" className="mt-5 grid gap-3 sm:grid-cols-2">
            {(
              [
                ['list', 'Guest list', 'Only the names you add can RSVP. Send each guest their link, or let them search their name.', ListChecks],
                ['open', 'Open link', 'One link for everyone. Guests type their name and mobile number; companions wait for your approval.', Link2],
              ] as const
            ).map(([value, title, text, Icon]) => {
              const active = mode === value
              const disabled = saving || (value === 'open' && blocked)
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={active || disabled}
                  onClick={() => void save(value)}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border p-4 text-left transition',
                    active ? 'border-ink bg-champagne-light/40' : 'border-line hover:border-champagne',
                    !active && disabled && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <Icon aria-hidden="true" className={cn('mt-0.5 size-5 shrink-0', active ? 'text-ink' : 'text-gold')} strokeWidth={1.6} />
                  <span>
                    <span className="flex items-center gap-2 font-medium text-ink">
                      {title}
                      {active && <span className="rounded-full bg-ink px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.14em] text-ivory">In use</span>}
                    </span>
                    <span className="mt-1 block text-sm text-ink-soft">{text}</span>
                  </span>
                </button>
              )
            })}
          </div>

          {blocked && listed && (
            <div className="mt-4 rounded-lg border border-line bg-cream p-4 text-sm text-ink-soft">
              <p>
                To use an open link, your guest list must be empty first — the two can’t mix. You have <strong className="text-ink">{listed.names}</strong> {listed.names === 1 ? 'name' : 'names'} on your list
                {listed.replies > 0 && (
                  <>
                    , and <strong className="text-ink">{listed.replies}</strong> {listed.replies === 1 ? 'has' : 'have'} already replied
                  </>
                )}
                .
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" icon={<Download aria-hidden="true" className="size-4" />} onClick={() => void download()}>
                  Download the list first
                </Button>
                <Button type="button" size="sm" variant="danger-quiet" icon={<Trash2 aria-hidden="true" className="size-4" />} onClick={() => setAsking(true)}>
                  Remove the list and switch
                </Button>
              </div>
            </div>
          )}

          {mode === 'open' && (
            <div className="mt-4 space-y-3 rounded-lg border border-line bg-cream p-4 text-sm text-ink-soft">
              <label className="flex flex-wrap items-center gap-3">
                <Users aria-hidden="true" className="size-4 text-gold" />
                <span className="font-medium text-ink">Companions each guest may add</span>
                <select
                  className="input-base min-h-10 w-24 py-1"
                  value={companions}
                  disabled={saving}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    setCompanions(n)
                    void save('open', n)
                  }}
                >
                  {Array.from({ length: 11 }, (_, n) => (
                    <option key={n} value={n}>
                      {n === 0 ? 'None' : n}
                    </option>
                  ))}
                </select>
              </label>
              <p>Guests are counted as soon as they reply. Their companions (names required) wait in Guests → requests until you approve them.</p>
              <p>
                Share this link with everyone:{' '}
                <a href={rsvpLink} target="_blank" rel="noopener noreferrer" className="break-all text-gold underline-offset-4 hover:underline">
                  {rsvpLink}
                </a>
              </p>
            </div>
          )}
        </>
      )}

      <Modal
        open={asking}
        onClose={() => !clearing && setAsking(false)}
        title="Remove your guest list?"
        locked={clearing}
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAsking(false)} disabled={clearing}>
              Cancel
            </Button>
            <Button type="button" variant="danger" loading={clearing} loadingText="Removing…" disabled={confirmText.trim().toUpperCase() !== confirmWord} onClick={() => void clearAndSwitch()}>
              Remove and switch
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-sm text-ink-soft">
          <p>
            This removes the <strong className="text-ink">{listed?.names ?? 0}</strong> names you added
            {listed?.replies ? (
              <>
                {' '}
                and their <strong className="text-ink">{listed.replies}</strong> {listed.replies === 1 ? 'reply' : 'replies'}
              </>
            ) : null}
            , then switches to an open link. It can’t be undone — download the list first if you may need it.
          </p>
          <TextField label={`Type ${confirmWord} to confirm`} value={confirmText} onChange={setConfirmText} autoComplete="off" />
        </div>
      </Modal>
    </section>
  )
}
