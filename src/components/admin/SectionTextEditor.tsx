import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button } from '../ui/Button'
import { TextAreaField, TextField } from '../ui/FormField'
import { useToast } from '../../hooks/useToast'
import { updateSectionTexts } from '../../services/settingsService'
import type { SectionText, WeddingSettings } from '../../types/wedding'
import { toFriendlyMessage } from '../../utils/errors'

/** One editable line of a section: stored in section_text, or in an existing column. */
type Field =
  | { kind: 'text'; key?: string; field: keyof SectionText; label: string; usual: string; long?: boolean }
  | { kind: 'column'; column: string; setting: keyof WeddingSettings; label: string; usual: string; long?: boolean }
  | { kind: 'link'; label: string; to: string; where: string }

const eyebrow = (usual: string): Field => ({ kind: 'text', field: 'eyebrow', label: 'Small line above the title', usual })

/** What can be edited for each section, and where the rest is set. */
export function sectionFields(key: string): { fields: Field[]; note?: string } {
  if (key.startsWith('media:')) {
    if (key === 'media:gallery')
      return {
        fields: [
          eyebrow('Moments'),
          { kind: 'column', column: 'gallery_title', setting: 'galleryTitle', label: 'Title', usual: 'Waiting for You, Little One' },
          { kind: 'column', column: 'gallery_subtitle', setting: 'gallerySubtitle', label: 'Note under the title', usual: '', long: true },
        ],
      }
    if (key === 'media:video')
      return {
        fields: [
          eyebrow('A Film'),
          { kind: 'column', column: 'video_title', setting: 'videoTitle', label: 'Title', usual: 'Our Baby Journey' },
          { kind: 'column', column: 'video_caption', setting: 'videoCaption', label: 'Note under the title', usual: '', long: true },
        ],
      }
    return { fields: [eyebrow('Moments'), { kind: 'link', label: 'Title and note', to: '/admin/media', where: 'Photos & Video' }] }
  }
  switch (key) {
    case 'intro':
      return { fields: [eyebrow('The Baby Shower'), { kind: 'link', label: 'The welcome message', to: '/admin/settings', where: 'Website Settings' }] }
    case 'verse':
      return { fields: [{ kind: 'link', label: 'The verse', to: '/admin/settings', where: 'Website Settings' }] }
    case 'reveal':
      return {
        fields: [
          eyebrow('Gender Reveal'),
          { kind: 'link', label: 'Title before the reveal', to: '/admin/reveal', where: 'Gender Reveal' },
          { kind: 'text', field: 'after', label: 'Title after the reveal', usual: 'The secret is out!' },
        ],
      }
    case 'guestPhotos':
      return { fields: [eyebrow('From our guests'), { kind: 'link', label: 'Title and note', to: '/admin/guest-photos', where: 'Guest Photos' }] }
    case 'venue':
      return {
        fields: [
          { kind: 'column', column: 'venue_eyebrow', setting: 'venueEyebrow', label: 'Small line above the title', usual: 'Where' },
          { kind: 'column', column: 'venue_title', setting: 'venueTitle', label: 'Title', usual: 'The Shower' },
          { kind: 'text', key: 'private', field: 'title', label: 'Title when the venue is kept for confirmed guests', usual: 'Shared with our confirmed guests' },
        ],
      }
    case 'program':
      return {
        fields: [
          eyebrow('Order of the Day'),
          { kind: 'column', column: 'program_title', setting: 'programTitle', label: 'Title', usual: 'Program' },
          { kind: 'column', column: 'program_subtitle', setting: 'programSubtitle', label: 'Note under the title', usual: '', long: true },
        ],
      }
    case 'info':
      return {
        fields: [eyebrow('Good to Know'), { kind: 'text', field: 'title', label: 'Title', usual: 'Shower Details' }, { kind: 'text', field: 'subtitle', label: 'Note under the title', usual: '', long: true }],
      }
    case 'attire':
      return {
        fields: [
          eyebrow('Dress Code'),
          { kind: 'column', column: 'outfit_title', setting: 'outfitTitle', label: 'Title', usual: 'What to Wear' },
          { kind: 'column', column: 'outfit_subtitle', setting: 'outfitSubtitle', label: 'Note under the title', usual: '', long: true },
          { kind: 'link', label: 'The motif colours label', to: '/admin/outfits', where: 'What to Wear' },
        ],
      }
    case 'ideas':
      return { fields: [eyebrow('Ideas & inspiration'), { kind: 'link', label: 'Title and note', to: '/admin/registry', where: 'Gift Registry → Gift ideas' }] }
    case 'gift':
      return { fields: [{ kind: 'link', label: 'The gift card’s words', to: '/admin/settings', where: 'Website Settings' }] }
    case 'rsvp':
      return { fields: [eyebrow('Kindly Respond'), { kind: 'text', field: 'title', label: 'Title', usual: 'We would be honoured by your presence' }] }
    case 'fun':
      return { fields: [], note: 'No heading here — just a card for each activity that’s switched on. Each card names itself.' }
    default:
      return { fields: [] }
  }
}

export const hasEditableText = (key: string) => sectionFields(key).fields.some((f) => f.kind !== 'link')

/**
 * Admin → Page Order → Edit text: a section's small line, title and note.
 * Empty boxes keep the usual words (shown greyed out).
 */
export function SectionTextEditor({ sectionKey, settings, onSaved, onClose }: { sectionKey: string; settings: WeddingSettings; onSaved: (s: WeddingSettings) => void; onClose: () => void }) {
  const toast = useToast()
  const { fields, note } = sectionFields(sectionKey)
  const id = (f: Field, i: number) => (f.kind === 'text' ? `${f.key ?? sectionKey}.${f.field}` : f.kind === 'column' ? f.column : `link-${i}`)
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {}
    fields.forEach((f, i) => {
      if (f.kind === 'text') v[id(f, i)] = settings.sectionText[f.key ?? sectionKey]?.[f.field] ?? ''
      if (f.kind === 'column') v[id(f, i)] = String(settings[f.setting] ?? '')
    })
    return v
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const text: Record<string, SectionText> = JSON.parse(JSON.stringify(settings.sectionText)) as Record<string, SectionText>
      const columns: Record<string, string | null> = {}
      fields.forEach((f, i) => {
        const v = (values[id(f, i)] ?? '').trim()
        if (f.kind === 'text') {
          const k = f.key ?? sectionKey
          text[k] = { ...(text[k] ?? {}), [f.field]: v }
        } else if (f.kind === 'column') {
          columns[f.column] = v ? v.slice(0, f.long ? 300 : 120) : null
        }
      })
      onSaved(await updateSectionTexts(settings.id, text, columns))
      toast.success('Saved. Your website shows the new words.')
      onClose()
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const editable = fields.some((f) => f.kind !== 'link')
  return (
    <div className="w-full rounded-lg border border-champagne/50 bg-paper p-4" data-text-editor={sectionKey}>
      {note && <p className="text-sm text-muted">{note}</p>}
      <div className="space-y-3">
        {fields.map((f, i) =>
          f.kind === 'link' ? (
            <p key={i} className="text-sm text-muted">
              {f.label}: set in{' '}
              <Link to={f.to} className="inline-flex items-center gap-1 text-gold underline-offset-4 hover:underline">
                {f.where} <ArrowRight aria-hidden="true" className="size-3.5" />
              </Link>
            </p>
          ) : f.long ? (
            <TextAreaField
              key={i}
              label={f.label}
              value={values[id(f, i)] ?? ''}
              onChange={(v) => setValues((x) => ({ ...x, [id(f, i)]: v }))}
              maxLength={300}
              rows={2}
              placeholder={f.usual || 'Optional'}
            />
          ) : (
            <TextField
              key={i}
              label={f.label}
              value={values[id(f, i)] ?? ''}
              onChange={(v) => setValues((x) => ({ ...x, [id(f, i)]: v }))}
              maxLength={120}
              placeholder={f.usual}
              hint={f.usual ? `Leave empty for “${f.usual}”.` : undefined}
            />
          ),
        )}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onClose}>
          {editable ? 'Cancel' : 'Close'}
        </Button>
        {editable && (
          <Button size="sm" loading={saving} loadingText="Saving…" onClick={() => void save()}>
            Save text
          </Button>
        )}
      </div>
    </div>
  )
}
