import { useEffect, useState } from 'react'
import { Type } from 'lucide-react'
import { Button } from '../ui/Button'
import { TextAreaField, TextField } from '../ui/FormField'
import { cn } from '../ui/cn'
import { useToast } from '../../hooks/useToast'
import { setCachedWeddingSettings, useWeddingSettings } from '../../hooks/useWeddingSettings'
import { getWeddingSettings, updateSectionTexts } from '../../services/settingsService'
import type { SectionText } from '../../types/wedding'
import { toFriendlyMessage } from '../../utils/errors'

export interface WordField {
  field: keyof SectionText
  label: string
  /** The usual words (shown greyed out; used when the box is empty). */
  usual: string
  long?: boolean
}

/** "Small line above the title" — the most common one. */
export const smallLine = (usual: string): WordField => ({ field: 'eyebrow', label: 'Small line above the title', usual })

/**
 * A section's own words on its admin page (like the venue title): empty boxes
 * keep the usual words. Saves on its own button, so it never mixes with the
 * page's other unsaved changes.
 */
export function SectionWords({ sectionKey, fields, className, heading }: { sectionKey: string; fields: WordField[]; className?: string; heading?: string }) {
  const toast = useToast()
  const { settings } = useWeddingSettings()
  const current = settings?.sectionText?.[sectionKey]
  const initial = Object.fromEntries(fields.map((f) => [f.field, current?.[f.field] ?? ''])) as Record<string, string>
  const [values, setValues] = useState<Record<string, string> | null>(settings ? initial : null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (settings && values === null) setValues(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings])

  const dirty = Boolean(values && fields.some((f) => (values[f.field] ?? '').trim() !== (current?.[f.field] ?? '')))

  const save = async () => {
    if (!values) return
    setSaving(true)
    try {
      // The latest saved words, so other sections' words are never undone.
      const fresh = await getWeddingSettings()
      const next = { ...fresh.sectionText, [sectionKey]: { ...(fresh.sectionText[sectionKey] ?? {}), ...Object.fromEntries(fields.map((f) => [f.field, (values[f.field] ?? '').trim()])) } }
      setCachedWeddingSettings(await updateSectionTexts(fresh.id, next))
      toast.success('Saved. Your website shows the new words.')
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div data-section-words={sectionKey} className={cn('rounded-lg border border-line bg-cream/40 p-3', className)}>
      <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-ink">
        <Type aria-hidden="true" className="size-4 text-gold" /> {heading ?? 'Words on the website'}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) =>
          f.long ? (
            <TextAreaField
              key={f.field}
              className="sm:col-span-2"
              label={f.label}
              value={values?.[f.field] ?? ''}
              onChange={(v) => setValues((x) => ({ ...(x ?? {}), [f.field]: v }))}
              maxLength={300}
              rows={2}
              placeholder={f.usual || 'Optional'}
            />
          ) : (
            <TextField
              key={f.field}
              label={f.label}
              value={values?.[f.field] ?? ''}
              onChange={(v) => setValues((x) => ({ ...(x ?? {}), [f.field]: v }))}
              maxLength={120}
              placeholder={f.usual}
              hint={f.usual ? `Leave empty for “${f.usual}”.` : 'Optional.'}
              disabled={!values}
            />
          ),
        )}
      </div>
      <div className="mt-3 flex justify-end">
        <Button size="sm" variant={dirty ? 'primary' : 'outline'} disabled={!dirty} loading={saving} loadingText="Saving…" onClick={() => void save()}>
          Save words
        </Button>
      </div>
    </div>
  )
}
