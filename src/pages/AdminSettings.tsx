import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, ImageUp, Plus, Save, Trash2 } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import { setCachedWeddingSettings } from '../hooks/useWeddingSettings'
import { getWeddingSettings, newSectionId, SECTION_ICONS, updateWeddingSettings, uploadWeddingAsset } from '../services/settingsService'
import type { InfoSection, SectionIconName, WeddingSettings, WeddingSettingsInput } from '../types/wedding'
import { toFriendlyMessage } from '../utils/errors'
import { isValidHttpUrl } from '../utils/validation'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { TextAreaField, TextField } from '../components/ui/FormField'
import { Skeleton } from '../components/ui/Skeleton'
import { cn } from '../components/ui/cn'
import { SectionIcon } from '../components/wedding/SectionIcon'
import { PageHeader } from '../components/admin/PageHeader'
import { RsvpSettingsCard } from '../components/admin/RsvpSettingsCard'
import { RsvpTeaserCard } from '../components/admin/RsvpTeaserCard'
import { GiftSettingsCard } from '../components/admin/GiftSettingsCard'
import { WebsitePrivacyCard } from '../components/admin/WebsitePrivacyCard'
import { VerseSettingsCard } from '../components/admin/VerseSettingsCard'
import { ProgramCard } from '../components/admin/ProgramCard'
import { useUnsavedChanges } from '../hooks/unsavedChanges'
import { SaveStatus } from '../components/ui/SaveStatus'

type FieldErrors = Partial<Record<'coupleNames' | 'weddingDate' | 'heroImageUrl' | 'churchMapUrl' | 'receptionMapUrl' | 'sections', string>>

function toInput(s: WeddingSettings): WeddingSettingsInput {
  return {
    coupleNames: s.coupleNames,
    weddingDate: s.weddingDate,
    heroTitle: s.heroTitle,
    heroSubtitle: s.heroSubtitle,
    heroImageUrl: s.heroImageUrl,
    churchName: s.churchName,
    ceremonyTime: s.ceremonyTime,
    receptionTime: s.receptionTime,
    churchMapUrl: s.churchMapUrl,
    receptionName: s.receptionName,
    receptionMapUrl: s.receptionMapUrl,
    storyText: s.storyText,
    closingMessage: s.closingMessage,
    sections: s.sections,
  }
}

export default function AdminSettings() {
  const toast = useToast()
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const [values, setValues] = useState<WeddingSettingsInput | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [sectionToDelete, setSectionToDelete] = useState<InfoSection | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.title = 'Website settings · Wedding admin'
    let active = true
    getWeddingSettings()
      .then((s) => {
        if (!active) return
        setSettingsId(s.id)
        setValues(toInput(s))
      })
      .catch((e) => active && setLoadError(toFriendlyMessage(e)))
    return () => {
      active = false
    }
  }, [])

  // Warn before leaving with unsaved changes (menu, reload or closing the tab).
  useUnsavedChanges(dirty, 'Website Settings')

  if (loadError) {
    return (
      <>
        <PageHeader title="Website Settings" />
        <p role="alert" className="rounded-lg border border-rose/30 bg-rose/5 px-4 py-3 text-sm text-rose">
          {loadError}
        </p>
      </>
    )
  }

  if (!values || !settingsId) {
    return (
      <>
        <PageHeader title="Website Settings" />
        <div className="space-y-4" role="status" aria-label="Loading settings">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-72" />
        </div>
      </>
    )
  }

  const set = <K extends keyof WeddingSettingsInput>(key: K, value: WeddingSettingsInput[K]) => {
    setValues((v) => (v ? { ...v, [key]: value } : v))
    setDirty(true)
  }

  const setSections = (sections: InfoSection[]) => set('sections', sections)
  const updateSection = (id: string, patch: Partial<InfoSection>) =>
    setSections(values.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  const moveSection = (index: number, dir: -1 | 1) => {
    const next = [...values.sections]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setSections(next)
  }
  const addSection = () => {
    const s: InfoSection = { id: newSectionId(), title: '', body: '', icon: 'info', visible: true }
    setSections([...values.sections, s])
    window.setTimeout(() => document.getElementById(`section-title-${s.id}`)?.focus(), 60)
  }

  const validate = (v: WeddingSettingsInput): FieldErrors => {
    const e: FieldErrors = {}
    if (!v.coupleNames.trim()) e.coupleNames = 'Couple names are required.'
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.weddingDate)) e.weddingDate = 'Please choose the wedding date.'
    if (!isValidHttpUrl(v.heroImageUrl)) e.heroImageUrl = 'Please enter a full image URL starting with https://'
    if (!isValidHttpUrl(v.churchMapUrl)) e.churchMapUrl = 'Please enter a full URL starting with https://'
    if (!isValidHttpUrl(v.receptionMapUrl)) e.receptionMapUrl = 'Please enter a full URL starting with https://'
    if (v.sections.some((s) => !s.title.trim())) e.sections = 'Every information section needs a title.'
    return e
  }

  const save = async (e?: FormEvent) => {
    e?.preventDefault()
    const found = validate(values)
    setErrors(found)
    if (Object.keys(found).length) {
      toast.error('Please fix the highlighted fields.')
      return
    }
    setSaving(true)
    try {
      const saved = await updateWeddingSettings(settingsId, values)
      setValues(toInput(saved))
      setCachedWeddingSettings(saved)
      setDirty(false)
      toast.success('Website settings saved.')
    } catch (err) {
      toast.error(toFriendlyMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const onUpload = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadWeddingAsset(file, 'hero')
      set('heroImageUrl', url)
      toast.success('Image uploaded. Click “Save changes” to publish it.')
    } catch (err) {
      toast.error(toFriendlyMessage(err))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <>
    <form onSubmit={save} noValidate>
      <PageHeader
        title="Website Settings"
        description="Everything on the public wedding website comes from here."
        actions={
          <>
            <SaveStatus dirty={dirty} saving={saving} />
            <Button type="submit" loading={saving} loadingText="Saving…" icon={<Save aria-hidden="true" className="size-4" />} disabled={!dirty && !saving}>
              Save changes
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        <Card title="General">
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="Couple names" value={values.coupleNames} onChange={(v) => set('coupleNames', v)} error={errors.coupleNames} maxLength={80} />
            <TextField label="Wedding date" type="date" value={values.weddingDate} onChange={(v) => set('weddingDate', v)} error={errors.weddingDate} />
            <TextField label="Hero title" value={values.heroTitle} onChange={(v) => set('heroTitle', v)} maxLength={80} hint="Shown large on the hero, e.g. “Mir & Ella”." />
            <TextField label="Hero subtitle" value={values.heroSubtitle} onChange={(v) => set('heroSubtitle', v)} maxLength={120} hint="e.g. “are getting married”." />
            <TextAreaField
              className="sm:col-span-2"
              label="Introduction text"
              value={values.storyText}
              onChange={(v) => set('storyText', v)}
              maxLength={600}
              showCounter
              rows={3}
            />
            <TextAreaField
              className="sm:col-span-2"
              label="Footer closing message"
              value={values.closingMessage}
              onChange={(v) => set('closingMessage', v)}
              maxLength={300}
              showCounter
              rows={2}
            />
          </div>
        </Card>

        <Card title="Hero image">
          <div className="grid gap-5 md:grid-cols-[1fr_260px]">
            <div className="space-y-4">
              <TextField
                label="Hero image URL"
                type="url"
                value={values.heroImageUrl}
                onChange={(v) => set('heroImageUrl', v)}
                error={errors.heroImageUrl}
                placeholder="https://…"
              />
              <div>
                <input tabIndex={-1}
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="sr-only"
                  id="hero-upload"
                  onChange={(e) => void onUpload(e.target.files?.[0])}
                />
                <Button
                  variant="outline"
                  loading={uploading}
                  loadingText="Uploading…"
                  onClick={() => fileRef.current?.click()}
                  icon={<ImageUp aria-hidden="true" className="size-4" />}
                >
                  Upload image
                </Button>
                <p className="mt-2 text-xs text-muted">JPG, PNG, WebP or AVIF, up to 10 MB. Stored in the Supabase “wedding-assets” bucket. A landscape photo at least 2000px wide looks best.</p>
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-line bg-cream">
              {values.heroImageUrl && isValidHttpUrl(values.heroImageUrl) ? (
                <img src={values.heroImageUrl} alt="Hero preview" className="aspect-[4/3] w-full object-cover" />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center text-sm text-muted">No image</div>
              )}
            </div>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Ceremony">
            <div className="space-y-5">
              <TextField label="Church name" value={values.churchName} onChange={(v) => set('churchName', v)} maxLength={150} />
              <TextField label="Time (optional)" value={values.ceremonyTime} onChange={(v) => set('ceremonyTime', v)} maxLength={40} placeholder="e.g. 2:00 PM" hint="Shown on the website, printed invitations and envelopes." />
              <TextField label="Google Maps URL" type="url" value={values.churchMapUrl} onChange={(v) => set('churchMapUrl', v)} error={errors.churchMapUrl} />
            </div>
          </Card>
          <Card title="Reception">
            <div className="space-y-5">
              <TextField label="Reception name" value={values.receptionName} onChange={(v) => set('receptionName', v)} maxLength={150} />
              <TextField label="Time (optional)" value={values.receptionTime} onChange={(v) => set('receptionTime', v)} maxLength={40} placeholder="e.g. 5:30 PM" />
              <TextField label="Google Maps URL" type="url" value={values.receptionMapUrl} onChange={(v) => set('receptionMapUrl', v)} error={errors.receptionMapUrl} />
            </div>
          </Card>
        </div>

        <WebsitePrivacyCard />

        <Card
          title="Information sections"
          description="Shown on the home page in this order. Hidden sections stay saved but aren’t displayed."
          action={
            <Button variant="outline" size="sm" onClick={addSection} icon={<Plus aria-hidden="true" className="size-4" />}>
              Add section
            </Button>
          }
        >
          {errors.sections && (
            <p role="alert" className="mb-4 text-sm text-rose">
              {errors.sections}
            </p>
          )}
          {values.sections.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-4 py-10 text-center text-sm text-muted">No sections yet. Add one to get started.</p>
          ) : (
            <ol className="space-y-4">
              {values.sections.map((s, i) => (
                <li key={s.id} className={cn('rounded-xl border p-4 sm:p-5', s.visible ? 'border-line bg-paper' : 'border-dashed border-line bg-ivory/60')}>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm text-muted">
                      <span className="flex size-8 items-center justify-center rounded-full border border-champagne/50 text-champagne">
                        <SectionIcon name={s.icon} className="size-4" />
                      </span>
                      Section {i + 1}
                      {!s.visible && <span className="rounded-full bg-cream px-2 py-0.5 text-xs">Hidden</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <IconButton label={`Move ${s.title || 'section'} up`} onClick={() => moveSection(i, -1)} disabled={i === 0}>
                        <ArrowUp className="size-4" />
                      </IconButton>
                      <IconButton label={`Move ${s.title || 'section'} down`} onClick={() => moveSection(i, 1)} disabled={i === values.sections.length - 1}>
                        <ArrowDown className="size-4" />
                      </IconButton>
                      <IconButton label={s.visible ? `Hide ${s.title || 'section'}` : `Show ${s.title || 'section'}`} onClick={() => updateSection(s.id, { visible: !s.visible })}>
                        {s.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                      </IconButton>
                      <IconButton label={`Delete ${s.title || 'section'}`} onClick={() => setSectionToDelete(s)} danger>
                        <Trash2 className="size-4" />
                      </IconButton>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
                    <TextField
                      id={`section-title-${s.id}`}
                      label="Title"
                      value={s.title}
                      onChange={(v) => updateSection(s.id, { title: v })}
                      maxLength={80}
                      error={errors.sections && !s.title.trim() ? 'Title is required.' : undefined}
                    />
                    <div>
                      <label htmlFor={`section-icon-${s.id}`} className="mb-2 block text-[0.95rem] font-medium text-ink-soft">
                        Icon
                      </label>
                      <select
                        id={`section-icon-${s.id}`}
                        value={s.icon}
                        onChange={(e) => updateSection(s.id, { icon: e.target.value as SectionIconName })}
                        className="input-base"
                      >
                        {SECTION_ICONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <TextAreaField
                      className="sm:col-span-2"
                      label="Text"
                      value={s.body}
                      onChange={(v) => updateSection(s.id, { body: v })}
                      maxLength={1200}
                      showCounter
                      rows={3}
                      hint="Line breaks start a new paragraph."
                    />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {/* Sticky save bar on small screens */}
      {dirty && (
        <div className="sticky bottom-0 z-20 -mx-4 mt-6 border-t border-line bg-paper/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-xl lg:border">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted">You have unsaved changes.</p>
            <Button type="submit" loading={saving} loadingText="Saving…" icon={<Save aria-hidden="true" className="size-4" />}>
              Save changes
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(sectionToDelete)}
        title="Delete this section?"
        message={`“${sectionToDelete?.title || 'Untitled section'}” will be removed from the website when you save.`}
        destructive
        confirmLabel="Delete section"
        onCancel={() => setSectionToDelete(null)}
        onConfirm={() => {
          if (sectionToDelete) setSections(values.sections.filter((x) => x.id !== sectionToDelete.id))
          setSectionToDelete(null)
        }}
      />
    </form>

    <div className="mt-6 space-y-6">
      <VerseSettingsCard />
      <ProgramCard />
      <RsvpSettingsCard />
      <RsvpTeaserCard />
      <GiftSettingsCard />
    </div>
    </>
  )
}

function Card({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-paper p-5 shadow-soft sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl text-ink">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function IconButton({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'flex size-10 items-center justify-center rounded-md text-muted transition disabled:opacity-30',
        danger ? 'hover:bg-rose/10 hover:text-rose' : 'hover:bg-cream hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}
