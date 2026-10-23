import { useEffect, useRef, useState } from 'react'
import { ImageUp, Save, Trash2 } from 'lucide-react'
import { useToast } from '../../hooks/useToast'
import { getGiftSettings, removeGiftQrFile, updateGiftSettings, uploadGiftQr } from '../../services/giftService'
import type { GiftSettings } from '../../types/wedding'
import { toFriendlyMessage } from '../../utils/errors'
import { Button } from '../ui/Button'
import { TextAreaField, TextField } from '../ui/FormField'
import { Skeleton } from '../ui/Skeleton'
import { cn } from '../ui/cn'
import { useUnsavedChanges } from '../../hooks/unsavedChanges'
import { SaveStatus } from '../../components/ui/SaveStatus'
import { SectionWords, smallLine } from './SectionWords'

/** Upload / show / hide the couple's gift QR and choose where it appears. */
export function GiftSettingsCard() {
  const toast = useToast()
  const [values, setValues] = useState<GiftSettings | null>(null)
  const [saved, setSaved] = useState<GiftSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getGiftSettings()
      .then((g) => {
        setValues(g)
        setSaved(g)
      })
      .catch((e) => setError(toFriendlyMessage(e)))
  }, [])

  // Before the loading return: hooks must run on every render.
  const dirty = Boolean(values && saved) && JSON.stringify(values) !== JSON.stringify(saved)
  useUnsavedChanges(dirty, 'Gift settings')
  if (error) {
    return (
      <p role="alert" className="text-sm text-rose">
        {error}
      </p>
    )
  }
  if (!values || !saved) return <Skeleton className="h-56" />

  const set = <K extends keyof GiftSettings>(k: K, v: GiftSettings[K]) => setValues({ ...values, [k]: v })

  const save = async (next: GiftSettings = values) => {
    if (next.isVisible && !next.qrImageUrl) {
      toast.error('Please upload your QR code before showing the gift section.')
      return
    }
    setSaving(true)
    try {
      const g = await updateGiftSettings(next)
      if (saved.qrImageUrl && saved.qrImageUrl !== g.qrImageUrl) void removeGiftQrFile(saved.qrImageUrl)
      setValues(g)
      setSaved(g)
      toast.success('Gift settings saved.')
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const onUpload = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadGiftQr(file)
      setValues({ ...values, qrImageUrl: url })
      toast.success('QR uploaded. Click “Save gift settings” to use it.')
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <section id="gift-settings" aria-labelledby="gift-settings-heading" className="scroll-mt-24 rounded-xl border border-line bg-paper p-5 shadow-soft sm:p-6">
      <div className="mb-5">
        <h2 id="gift-settings-heading" className="text-2xl text-ink">
          Gift QR for the Baby
        </h2>
        <p className="mt-1 text-sm text-muted">Your GCash / Maya / InstaPay QR for guests who wish to send a monetary gift.</p>
      </div>

      <SectionWords
        className="mb-5"
        heading="Words on the card"
        sectionKey="gift"
        fields={[
          { field: 'scan', label: 'Line under the QR', usual: 'Scan with GCash, Maya or your banking app' },
          { field: 'open', label: 'Button', usual: 'Open QR in full size' },
        ]}
      />
      <div className="grid gap-6 md:grid-cols-[1fr_220px]">
        <div className="space-y-5">
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-line bg-ivory/60 px-4 py-3.5">
            <span>
              <span className="block text-[0.95rem] font-medium text-ink-soft">Show on the website</span>
              <span className="block text-sm text-muted">Hide it any time — nothing is deleted.</span>
            </span>
            <input type="checkbox" checked={values.isVisible} onChange={(e) => set('isVisible', e.target.checked)} className="size-5 shrink-0 accent-ink" />
          </label>

          <fieldset>
            <legend className="mb-2 text-[0.95rem] font-medium text-ink-soft">Where to show it</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  { v: 'private', t: 'Invited guests only', d: 'After a guest finds their invitation and responds. Recommended.' },
                  { v: 'public', t: 'Everyone', d: 'Also on the home page, visible to anyone with the link.' },
                ] as const
              ).map((o) => (
                <label
                  key={o.v}
                  className={cn(
                    'relative cursor-pointer rounded-lg border px-4 py-3 text-sm transition',
                    'has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-gold',
                    values.placement === o.v ? 'border-ink bg-ink/[0.03]' : 'border-line hover:border-champagne',
                  )}
                >
                  <input type="radio" name="gift-placement" value={o.v} checked={values.placement === o.v} onChange={() => set('placement', o.v)} className="sr-only" />
                  <span className="block font-medium text-ink">{o.t}</span>
                  <span className="mt-0.5 block text-muted">{o.d}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <TextField label="Title" value={values.title} onChange={(v) => set('title', v)} maxLength={80} />
          <TextAreaField label="Message" value={values.message} onChange={(v) => set('message', v)} maxLength={400} rows={3} showCounter />
        </div>

        <div>
          <p className="mb-2 text-[0.95rem] font-medium text-ink-soft">QR code</p>
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-line bg-white">
            {values.qrImageUrl ? (
              <img src={values.qrImageUrl} alt="Your gift QR code" className="size-full object-contain p-2" />
            ) : (
              <span className="px-4 text-center text-sm text-muted">No QR uploaded yet</span>
            )}
          </div>
          <input tabIndex={-1}
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            id="gift-qr-upload"
            onChange={(e) => void onUpload(e.target.files?.[0])}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" loading={uploading} loadingText="Uploading…" onClick={() => fileRef.current?.click()} icon={<ImageUp aria-hidden="true" className="size-4" />}>
              {values.qrImageUrl ? 'Replace' : 'Upload QR'}
            </Button>
            {values.qrImageUrl && (
              <Button
                variant="ghost"
                size="sm"
                className="text-rose hover:bg-rose/10 hover:text-rose"
                onClick={() => setValues({ ...values, qrImageUrl: '', isVisible: false })}
                icon={<Trash2 aria-hidden="true" className="size-4" />}
              >
                Remove
              </Button>
            )}
          </div>
          <p className="mt-2 text-xs text-muted">PNG or JPG, up to 5 MB. A screenshot of your GCash “Receive” QR works well.</p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-3 border-t border-line pt-5">
        <SaveStatus dirty={dirty} saving={saving} />
        <Button onClick={() => void save()} loading={saving} loadingText="Saving…" disabled={!dirty} icon={<Save aria-hidden="true" className="size-4" />}>
          Save gift settings
        </Button>
      </div>
    </section>
  )
}
