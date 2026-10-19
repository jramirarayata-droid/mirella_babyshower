import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { useToast } from '../../hooks/useToast'
import { setCachedWeddingSettings } from '../../hooks/useWeddingSettings'
import { getWeddingSettings, updateRsvpTeaser } from '../../services/settingsService'
import { DEFAULT_RSVP_TEASER, type RsvpTeaser } from '../../types/questions'
import { toFriendlyMessage } from '../../utils/errors'
import { RaffleTeaser } from '../rsvp/RaffleTeaser'
import { Button } from '../ui/Button'
import { TextField } from '../ui/FormField'
import { Skeleton } from '../ui/Skeleton'
import { Badge } from '../ui/Badge'
import { useUnsavedChanges } from '../../hooks/unsavedChanges'
import { SaveStatus } from '../../components/ui/SaveStatus'

/** Admin → Website Settings: the highlighted raffle note guests see on the RSVP search page. */
export function RsvpTeaserCard() {
  const toast = useToast()
  const [id, setId] = useState<string | null>(null)
  const [saved, setSaved] = useState<RsvpTeaser | null>(null)
  const [t, setT] = useState<RsvpTeaser>(DEFAULT_RSVP_TEASER)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getWeddingSettings()
      .then((s) => {
        const v = s.rsvpConfig.teaser ?? DEFAULT_RSVP_TEASER
        setId(s.id)
        setSaved(v)
        setT(v)
      })
      .catch((e) => setError(toFriendlyMessage(e)))
  }, [])

  const dirty = Boolean(saved) && JSON.stringify(t) !== JSON.stringify(saved)
  useUnsavedChanges(dirty, 'the raffle note')
  if (error) {
    return (
      <p role="alert" className="text-sm text-rose">
        {error}
      </p>
    )
  }
  if (!saved) return <Skeleton className="h-56" />

  const set = (patch: Partial<RsvpTeaser>) => setT((v) => ({ ...v, ...patch }))

  const save = async () => {
    if (!id) return
    if (t.enabled && !t.title.trim() && !t.highlight.trim()) {
      toast.error('Please write the message, or turn the raffle note off.')
      return
    }
    setSaving(true)
    try {
      const s = await updateRsvpTeaser(id, { ...t, title: t.title.trim(), highlight: t.highlight.trim(), note: t.note.trim() })
      setCachedWeddingSettings(s)
      const v = s.rsvpConfig.teaser ?? DEFAULT_RSVP_TEASER
      setSaved(v)
      setT(v)
      toast.success(v.enabled ? 'Raffle note saved — guests see it on the RSVP page.' : 'Raffle note saved (hidden from guests).')
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section id="raffle-note" aria-labelledby="raffle-note-heading" className="scroll-mt-24 rounded-xl border border-line bg-paper p-5 shadow-soft sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="raffle-note-heading" className="text-2xl text-ink">
            Raffle note on the RSVP page
          </h2>
          <p className="mt-1 text-sm text-muted">A highlighted message above the name search, to encourage guests to confirm their attendance.</p>
        </div>
        <Badge tone={saved.enabled ? 'green' : 'gray'}>{saved.enabled ? 'Showing' : 'Hidden'}</Badge>
      </div>

      <div className="space-y-5">
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-line bg-ivory/60 px-4 py-3.5">
          <span>
            <span className="block text-[0.95rem] font-medium text-ink-soft">Show the raffle note</span>
            <span className="block text-sm text-muted">Appears on the RSVP page while RSVPs are open.</span>
          </span>
          <input type="checkbox" checked={t.enabled} onChange={(e) => set({ enabled: e.target.checked })} className="size-5 shrink-0 accent-ink" />
        </label>

        <TextField label="Message" value={t.title} onChange={(v) => set({ title: v })} maxLength={120} hint="The line above the highlighted amount." />
        <div>
          <TextField label="Highlighted amount" value={t.highlight} onChange={(v) => set({ highlight: v })} maxLength={40} hint="Shown big and gold." />
          <div className="mt-2 flex flex-wrap gap-2">
            {['up to ₱25,000', '₱25,000 in prizes', 'up to ₱10,000', 'exciting prizes'].map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => set({ highlight: l })}
                className="rounded-full border border-line px-3 py-1 text-xs text-ink-soft transition hover:border-champagne"
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <TextField label="Small print (optional)" value={t.note} onChange={(v) => set({ note: v })} maxLength={160} />

        <div>
          <p className="mb-2 text-sm font-medium text-ink-soft">Preview</p>
          <div className="rounded-lg border border-dashed border-line bg-ivory/60 px-4 py-6">
            {t.title.trim() || t.highlight.trim() ? (
              <RaffleTeaser key={`${t.title}|${t.highlight}|${t.note}`} teaser={{ ...t, enabled: true }} />
            ) : (
              <p className="text-center text-sm text-muted">Write a message to see the preview.</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-line pt-5">
          <SaveStatus dirty={dirty} saving={saving} />
          <Button onClick={() => void save()} loading={saving} loadingText="Saving…" disabled={!dirty} icon={<Save aria-hidden="true" className="size-4" />}>
            Save raffle note
          </Button>
        </div>
      </div>
    </section>
  )
}
