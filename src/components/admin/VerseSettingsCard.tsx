import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { useToast } from '../../hooks/useToast'
import { setCachedWeddingSettings } from '../../hooks/useWeddingSettings'
import { useUnsavedChanges } from '../../hooks/unsavedChanges'
import { getWeddingSettings, updateVerse } from '../../services/settingsService'
import type { VerseSettings } from '../../types/wedding'
import { toFriendlyMessage } from '../../utils/errors'
import { VerseCard } from '../wedding/VerseHighlight'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { TextAreaField, TextField } from '../ui/FormField'
import { SaveStatus } from '../ui/SaveStatus'
import { Skeleton } from '../ui/Skeleton'

/** Admin → Website Settings: a Bible verse, highlighted on the home page. */
export function VerseSettingsCard() {
  const toast = useToast()
  const [id, setId] = useState<string | null>(null)
  const [saved, setSaved] = useState<VerseSettings | null>(null)
  const [v, setV] = useState<VerseSettings>({ verseVisible: false, verseText: '', verseReference: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getWeddingSettings()
      .then((s) => {
        if (!active) return
        const x: VerseSettings = { verseVisible: s.verseVisible, verseText: s.verseText, verseReference: s.verseReference }
        setId(s.id)
        setSaved(x)
        setV(x)
      })
      .catch((e) => active && setError(toFriendlyMessage(e)))
    return () => {
      active = false
    }
  }, [])

  const dirty = Boolean(saved) && JSON.stringify(v) !== JSON.stringify(saved)
  useUnsavedChanges(dirty, 'the Bible verse')
  if (error) {
    return (
      <p role="alert" className="text-sm text-rose">
        {error}
      </p>
    )
  }
  if (!saved) return <Skeleton className="h-56" />

  const set = (patch: Partial<VerseSettings>) => setV((x) => ({ ...x, ...patch }))

  const save = async () => {
    if (!id) return
    if (v.verseVisible && !v.verseText.trim()) {
      toast.error('Please write the verse, or turn it off.')
      return
    }
    setSaving(true)
    try {
      const s = await updateVerse(id, v)
      setCachedWeddingSettings(s)
      const x: VerseSettings = { verseVisible: s.verseVisible, verseText: s.verseText, verseReference: s.verseReference }
      setSaved(x)
      setV(x)
      toast.success(x.verseVisible ? 'Bible verse saved — it’s highlighted on the website.' : 'Bible verse saved (hidden from guests).')
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section id="verse" aria-labelledby="verse-heading-admin" className="scroll-mt-24 rounded-xl border border-line bg-paper p-5 shadow-soft sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="verse-heading-admin" className="text-2xl text-ink">
            Bible verse
          </h2>
          <p className="mt-1 text-sm text-muted">Highlighted on the home page, right after your introduction. Also available in Printables → Leaflets.</p>
        </div>
        <Badge tone={saved.verseVisible ? 'green' : 'gray'}>{saved.verseVisible ? 'Showing' : 'Hidden'}</Badge>
      </div>

      <div className="space-y-5">
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-line bg-ivory/60 px-4 py-3.5">
          <span>
            <span className="block text-[0.95rem] font-medium text-ink-soft">Show the verse on the website</span>
            <span className="block text-sm text-muted">Off = saved, but guests don’t see it.</span>
          </span>
          <input type="checkbox" checked={v.verseVisible} onChange={(e) => set({ verseVisible: e.target.checked })} className="size-5 shrink-0 accent-ink" />
        </label>

        <TextAreaField
          label="Verse"
          value={v.verseText}
          onChange={(x) => set({ verseText: x })}
          maxLength={1200}
          showCounter
          rows={4}
          hint="Paste it from the Bible translation you love. A blank line starts a new paragraph."
        />
        <TextField label="Reference" value={v.verseReference} onChange={(x) => set({ verseReference: x })} maxLength={120} placeholder="e.g. 1 Corinthians 13:4–7" />

        <div>
          <p className="mb-2 text-sm font-medium text-ink-soft">Preview</p>
          <div className="rounded-lg border border-dashed border-line bg-ivory/60 p-4 sm:p-6">
            {v.verseText.trim() ? <VerseCard text={v.verseText} reference={v.verseReference} /> : <p className="py-4 text-center text-sm text-muted">Write the verse to see the preview.</p>}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-line pt-5">
          <SaveStatus dirty={dirty} saving={saving} />
          <Button onClick={() => void save()} loading={saving} loadingText="Saving…" disabled={!dirty} icon={<Save aria-hidden="true" className="size-4" />}>
            Save verse
          </Button>
        </div>
      </div>
    </section>
  )
}
