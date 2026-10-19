import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Save, Trash2 } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import { setCachedWeddingSettings } from '../hooks/useWeddingSettings'
import { addOutfitFromFile, addOutfitFromUrl, deleteOutfit, listAllOutfits, reorderOutfits, updateOutfit } from '../services/outfitService'
import { getWeddingSettings, updateOutfitSectionSettings } from '../services/settingsService'
import type { OutfitGender, OutfitImage, OutfitSectionSettings } from '../types/wedding'
import { toFriendlyMessage } from '../utils/errors'
import { isValidHttpUrl } from '../utils/validation'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { TextAreaField, TextField } from '../components/ui/FormField'
import { Modal } from '../components/ui/Modal'
import { Skeleton } from '../components/ui/Skeleton'
import { Spinner } from '../components/ui/Spinner'
import { cn } from '../components/ui/cn'
import { PageHeader } from '../components/admin/PageHeader'
import { MotifCard } from '../components/admin/MotifCard'
import { outfitPairs, type OutfitPair } from '../utils/outfitPairs'

const GROUPS: { gender: OutfitGender; title: string }[] = [
  { gender: 'male', title: 'For Him' },
  { gender: 'female', title: 'For Her' },
]

export default function AdminOutfits() {
  const toast = useToast()
  const [outfits, setOutfits] = useState<OutfitImage[] | null>(null)
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const [section, setSection] = useState<OutfitSectionSettings | null>(null)
  const [savingSection, setSavingSection] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [addFor, setAddFor] = useState<OutfitGender | null>(null)
  const [toDelete, setToDelete] = useState<OutfitImage | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setOutfits(await listAllOutfits())
    } catch (e) {
      setLoadError(toFriendlyMessage(e))
    }
  }, [])

  useEffect(() => {
    document.title = 'Outfit gallery · Wedding admin'
    void reload()
    getWeddingSettings()
      .then((s) => {
        setSettingsId(s.id)
        setSection({ outfitTitle: s.outfitTitle, outfitSubtitle: s.outfitSubtitle, outfitSectionVisible: s.outfitSectionVisible, outfitLayout: s.outfitLayout })
      })
      .catch((e) => setLoadError(toFriendlyMessage(e)))
  }, [reload])

  const saveSection = async (e: FormEvent) => {
    e.preventDefault()
    if (!settingsId || !section) return
    setSavingSection(true)
    try {
      const saved = await updateOutfitSectionSettings(settingsId, section)
      setCachedWeddingSettings(saved)
      toast.success('Section settings saved.')
    } catch (err) {
      toast.error(toFriendlyMessage(err))
    } finally {
      setSavingSection(false)
    }
  }

  const run = async (id: string, action: () => Promise<void>, success?: string) => {
    setBusyId(id)
    try {
      await action()
      if (success) toast.success(success)
      await reload()
    } catch (err) {
      toast.error(toFriendlyMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  const move = (group: OutfitImage[], index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= group.length) return
    const ids = group.map((o) => o.id)
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    void run(group[index].id, () => reorderOutfits(ids))
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      await deleteOutfit(toDelete.id)
      toast.success('Image removed.')
      setToDelete(null)
      await reload()
    } catch (err) {
      toast.error(toFriendlyMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  if (loadError) {
    return (
      <>
        <PageHeader title="Outfit Gallery" />
        <p role="alert" className="rounded-lg border border-rose/30 bg-rose/5 px-4 py-3 text-sm text-rose">
          {loadError}
        </p>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Outfit Gallery"
        description="Dress code motif and attire inspiration shown on the home page, below the wedding details."
      />

      {section ? (
        <form onSubmit={saveSection} className="mb-6 rounded-xl border border-line bg-paper p-5 shadow-soft sm:p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <TextField
              label="Section title"
              value={section.outfitTitle}
              onChange={(v) => setSection({ ...section, outfitTitle: v })}
              maxLength={80}
            />
            <TextAreaField
              label="Short description"
              value={section.outfitSubtitle}
              onChange={(v) => setSection({ ...section, outfitSubtitle: v })}
              maxLength={240}
              rows={2}
            />
          </div>
          <div className="mt-5">
            <p className="mb-1.5 text-[0.95rem] font-medium text-ink-soft">Layout on the website</p>
            <div role="radiogroup" aria-label="Layout on the website" className="grid max-w-xl grid-cols-2 gap-1 rounded-lg bg-cream p-1">
              {(
                [
                  { v: 'pairs', l: 'His & hers side by side' },
                  { v: 'tabs', l: 'For Him / For Her tabs' },
                ] as const
              ).map((o) => (
                <button
                  key={o.v}
                  type="button"
                  role="radio"
                  aria-checked={section.outfitLayout === o.v}
                  onClick={() => setSection({ ...section, outfitLayout: o.v })}
                  className={cn('rounded-md px-3 py-2 text-sm transition', section.outfitLayout === o.v ? 'bg-paper text-ink shadow-soft' : 'text-muted hover:text-ink')}
                >
                  {o.l}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted">
              {section.outfitLayout === 'pairs'
                ? 'Each look for him is shown next to the look for her in the same position below, under one label.'
                : 'Guests switch between the looks for him and for her; each photo shows its own label.'}
            </p>
          </div>
          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex cursor-pointer items-center gap-3 text-sm text-ink-soft">
              <input
                type="checkbox"
                checked={section.outfitSectionVisible}
                onChange={(e) => setSection({ ...section, outfitSectionVisible: e.target.checked })}
                className="size-5 accent-ink"
              />
              Show this section on the website
            </label>
            <Button type="submit" loading={savingSection} loadingText="Saving…" icon={<Save aria-hidden="true" className="size-4" />}>
              Save section
            </Button>
          </div>
        </form>
      ) : (
        <Skeleton className="mb-6 h-40" />
      )}

      <MotifCard />

      {section?.outfitLayout === 'pairs' && outfits && (
        <PairsCard
          pairs={outfitPairs(
            outfits.filter((o) => o.gender === 'male'),
            outfits.filter((o) => o.gender === 'female'),
          )}
          busyId={busyId}
          onLabel={(key, ids, label) =>
            void run(key, async () => {
              await Promise.all(ids.map((id) => updateOutfit(id, { label })))
            }, label ? `Label saved: ${label}` : 'Label removed.')
          }
        />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {GROUPS.map(({ gender, title }) => {
          const group = (outfits ?? []).filter((o) => o.gender === gender)
          return (
            <section key={gender} aria-labelledby={`group-${gender}`} className="rounded-xl border border-line bg-paper p-5 shadow-soft sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 id={`group-${gender}`} className="text-2xl text-ink">
                    {title}
                  </h2>
                  <p className="text-sm text-muted">
                    {outfits ? `${group.length} ${group.length === 1 ? 'image' : 'images'} · ${group.filter((g) => g.isVisible).length} shown` : 'Loading…'}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setAddFor(gender)} icon={<ImagePlus aria-hidden="true" className="size-4" />}>
                  Add image
                </Button>
              </div>

              {!outfits ? (
                <div className="space-y-3">
                  <Skeleton className="h-28" />
                  <Skeleton className="h-28" />
                </div>
              ) : group.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line px-4 py-10 text-center text-sm text-muted">No images yet.</p>
              ) : (
                <ol className="space-y-3">
                  {group.map((o, i) => (
                    <OutfitRow
                      key={o.id}
                      outfit={o}
                      busy={busyId === o.id}
                      first={i === 0}
                      last={i === group.length - 1}
                      onMove={(dir) => move(group, i, dir)}
                      onToggle={() =>
                        void run(o.id, () => updateOutfit(o.id, { isVisible: !o.isVisible }), o.isVisible ? 'Image hidden.' : 'Image shown.')
                      }
                      onCaption={(caption) => void run(o.id, () => updateOutfit(o.id, { caption }), 'Caption saved.')}
                      onLabel={(label) => void run(o.id, () => updateOutfit(o.id, { label }), label ? `Label saved: ${label}` : 'Label removed.')}
                      showLabel={section?.outfitLayout !== 'pairs'}
                      onDelete={() => setToDelete(o)}
                    />
                  ))}
                </ol>
              )}
            </section>
          )
        })}
      </div>

      <AddOutfitModal
        gender={addFor}
        nextOrder={(outfits ?? []).filter((o) => o.gender === addFor).length + 1}
        suggestedLabel={
          (outfits ?? []).filter((o) => o.gender !== addFor)[(outfits ?? []).filter((o) => o.gender === addFor).length]?.label ?? ''
        }
        onClose={() => setAddFor(null)}
        onAdded={async () => {
          setAddFor(null)
          toast.success('Image added.')
          await reload()
        }}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Remove this image?"
        message={`“${toDelete?.caption || 'Untitled image'}” will be removed from the website.`}
        destructive
        confirmLabel="Remove image"
        loading={deleting}
        loadingText="Removing…"
        onCancel={() => !deleting && setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </>
  )
}

function OutfitRow({
  outfit,
  busy,
  first,
  last,
  onMove,
  onToggle,
  onCaption,
  onLabel,
  onDelete,
  showLabel,
}: {
  outfit: OutfitImage
  busy: boolean
  first: boolean
  last: boolean
  onMove: (dir: -1 | 1) => void
  onToggle: () => void
  onCaption: (caption: string) => void
  onLabel: (label: string) => void
  onDelete: () => void
  showLabel: boolean
}) {
  const [caption, setCaption] = useState(outfit.caption)
  const [label, setLabel] = useState(outfit.label)
  useEffect(() => setLabel(outfit.label), [outfit.label])
  const name = outfit.caption || 'image'
  return (
    <li className={cn('flex gap-4 rounded-lg border p-3', outfit.isVisible ? 'border-line' : 'border-dashed border-line bg-ivory/60')}>
      <img
        src={outfit.imageUrl}
        alt=""
        className={cn('h-28 w-21 shrink-0 rounded object-cover', !outfit.isVisible && 'opacity-50')}
        loading="lazy"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {showLabel ? (
          <>
        <label className="sr-only" htmlFor={`label-${outfit.id}`}>
          Label
        </label>
        <input
          id={`label-${outfit.id}`}
          value={label}
          maxLength={60}
          placeholder="Label, e.g. Principal Sponsors (optional)"
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => label.trim() !== outfit.label && onLabel(label)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="input-base min-h-9 py-1.5 text-xs uppercase tracking-[0.12em] placeholder:normal-case placeholder:tracking-normal"
        />
        <LabelPicks
          value={label.trim()}
          onPick={(v) => {
            setLabel(v)
            onLabel(v)
          }}
        />
          </>
        ) : (
          outfit.label && <p className="text-xs font-medium uppercase tracking-[0.14em] text-gold">{outfit.label}</p>
        )}
        <label className="sr-only" htmlFor={`caption-${outfit.id}`}>
          Caption
        </label>
        <input
          id={`caption-${outfit.id}`}
          value={caption}
          maxLength={120}
          placeholder="Caption (optional)"
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => caption.trim() !== outfit.caption && onCaption(caption)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="input-base min-h-10 py-2 text-sm"
        />
        <div className="flex flex-wrap items-center gap-1">
          <IconButton label={`Move ${name} up`} onClick={() => onMove(-1)} disabled={first || busy}>
            <ArrowUp className="size-4" />
          </IconButton>
          <IconButton label={`Move ${name} down`} onClick={() => onMove(1)} disabled={last || busy}>
            <ArrowDown className="size-4" />
          </IconButton>
          <IconButton label={outfit.isVisible ? `Hide ${name}` : `Show ${name}`} onClick={onToggle} disabled={busy}>
            {outfit.isVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </IconButton>
          <IconButton label={`Remove ${name}`} onClick={onDelete} disabled={busy} danger>
            <Trash2 className="size-4" />
          </IconButton>
          {busy && <Spinner label="Saving" className="ml-1 text-xs text-muted" />}
          {!outfit.isVisible && <span className="ml-auto rounded-full bg-cream px-2 py-0.5 text-xs text-muted">Hidden</span>}
        </div>
      </div>
    </li>
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
        'flex size-9 items-center justify-center rounded-md text-muted transition disabled:opacity-30',
        danger ? 'hover:bg-rose/10 hover:text-rose' : 'hover:bg-cream hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

function AddOutfitModal({
  gender,
  nextOrder,
  suggestedLabel,
  onClose,
  onAdded,
}: {
  gender: OutfitGender | null
  nextOrder: number
  /** The label of the look it will pair with (same position, other side). */
  suggestedLabel: string
  onClose: () => void
  onAdded: () => void
}) {
  const [mode, setMode] = useState<'upload' | 'url'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [url, setUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!gender) return
    setMode('upload')
    setFile(null)
    setUrl('')
    setCaption('')
    setLabel(suggestedLabel)
    setError(null)
  }, [gender])

  useEffect(() => {
    if (!file) {
      setPreview(null)
      return
    }
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!gender) return
    setError(null)
    if (mode === 'upload' && !file) return setError('Please choose an image to upload.')
    if (mode === 'url' && (!url.trim() || !isValidHttpUrl(url))) return setError('Please enter a full image link starting with https://')
    setSaving(true)
    try {
      if (mode === 'upload' && file) await addOutfitFromFile(gender, file, caption, nextOrder, label)
      else await addOutfitFromUrl(gender, url, caption, nextOrder, label)
      onAdded()
    } catch (err) {
      setError(toFriendlyMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const shown = mode === 'upload' ? preview : isValidHttpUrl(url) && url.trim() ? url.trim() : null

  return (
    <Modal
      open={Boolean(gender)}
      onClose={onClose}
      locked={saving}
      title={gender === 'female' ? 'Add outfit — For Her' : 'Add outfit — For Him'}
      description="Portrait photos (3:4) look best."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="add-outfit-form" loading={saving} loadingText={mode === 'upload' ? 'Uploading…' : 'Adding…'}>
            Add image
          </Button>
        </>
      }
    >
      <form id="add-outfit-form" onSubmit={submit} noValidate className="space-y-5">
        <div role="tablist" aria-label="Image source" className="flex gap-1 rounded-lg bg-cream p-1">
          {(['upload', 'url'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn('flex-1 rounded-md px-3 py-2 text-sm transition', mode === m ? 'bg-paper text-ink shadow-soft' : 'text-muted hover:text-ink')}
            >
              {m === 'upload' ? 'Upload a photo' : 'Paste an image link'}
            </button>
          ))}
        </div>

        {mode === 'upload' ? (
          <div>
            <input tabIndex={-1}
              ref={fileRef}
              id="outfit-file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()} icon={<ImagePlus aria-hidden="true" className="size-4" />}>
              {file ? 'Choose a different photo' : 'Choose photo'}
            </Button>
            <p className="mt-2 text-xs text-muted">{file ? file.name : 'JPG, PNG, WebP or AVIF, up to 10 MB.'}</p>
          </div>
        ) : (
          <TextField label="Image link" type="url" value={url} onChange={setUrl} placeholder="https://…" />
        )}

        {shown && <img src={shown} alt="Preview" className="mx-auto aspect-[3/4] w-40 rounded object-cover shadow-soft" />}

        <div>
          <TextField label="Label (optional)" value={label} onChange={setLabel} maxLength={60} placeholder="e.g. Principal Sponsors" hint="Who this look is for — shown as a small tag above the caption." />
          <div className="mt-2">
            <LabelPicks value={label.trim()} onPick={setLabel} />
          </div>
        </div>

        <TextField label="Caption (optional)" value={caption} onChange={setCaption} maxLength={120} placeholder="e.g. Barong Tagalog" />

        {error && (
          <p role="alert" className="text-sm text-rose">
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}

/** Quick picks for who an outfit is for. */
const LABEL_PICKS = ['Principal Sponsors', 'Parents & Relatives', 'Entourage', 'Guests']

function LabelPicks({ value, onPick }: { value: string; onPick: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {LABEL_PICKS.map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={value === l}
          onClick={() => onPick(value === l ? '' : l)}
          className={cn('rounded-full border px-2.5 py-0.5 text-xs transition', value === l ? 'border-ink bg-ink text-ivory' : 'border-line text-ink-soft hover:border-champagne')}
        >
          {l}
        </button>
      ))}
    </div>
  )
}

/** Side-by-side layout: each pair (1st for him with 1st for her, …) with one label for both. */
function PairsCard({ pairs, busyId, onLabel }: { pairs: OutfitPair[]; busyId: string | null; onLabel: (key: string, ids: string[], label: string) => void }) {
  return (
    <section aria-labelledby="pairs-heading" className="mb-6 rounded-xl border border-line bg-paper p-5 shadow-soft sm:p-6">
      <h2 id="pairs-heading" className="text-2xl text-ink">
        Pairs
      </h2>
      <p className="mt-1 text-sm text-muted">
        How guests see them side by side. Pairs follow the order in For Him and For Her below — move a photo up or down to change its partner. One label covers both.
      </p>
      {pairs.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-muted">Add looks for him and for her below.</p>
      ) : (
        <ol className="mt-4 grid gap-3 md:grid-cols-2">
          {pairs.map((p) => (
            <PairRow key={`${p.him?.id ?? ''}-${p.her?.id ?? ''}`} pair={p} busy={busyId === `pair-${p.index}`} onLabel={(label) => onLabel(`pair-${p.index}`, p.images.map((i) => i.id), label)} />
          ))}
        </ol>
      )}
    </section>
  )
}

function PairRow({ pair, busy, onLabel }: { pair: OutfitPair; busy: boolean; onLabel: (label: string) => void }) {
  const [label, setLabel] = useState(pair.label)
  useEffect(() => setLabel(pair.label), [pair.label])
  const mixed = Boolean(pair.him && pair.her && pair.him.label.trim() !== pair.her.label.trim())
  const id = `pair-label-${pair.index}`
  return (
    <li className="flex gap-3 rounded-lg border border-line p-3" data-pair-row={pair.index + 1}>
      <div className="flex shrink-0 gap-1">
        {[pair.him, pair.her].map((img, k) =>
          img ? (
            <img key={img.id} src={img.imageUrl} alt="" className={cn('h-24 w-18 rounded object-cover', !img.isVisible && 'opacity-50')} loading="lazy" />
          ) : (
            <span key={k} className="grid h-24 w-18 place-items-center rounded border border-dashed border-line text-center text-[0.65rem] text-muted">
              No look for {k === 0 ? 'him' : 'her'}
            </span>
          ),
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <label htmlFor={id} className="text-xs text-muted">
          Pair {pair.index + 1} · label
        </label>
        <input
          id={id}
          value={label}
          maxLength={60}
          placeholder="e.g. Principal Sponsors (optional)"
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => (label.trim() !== pair.label || mixed) && onLabel(label)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="input-base min-h-9 py-1.5 text-xs uppercase tracking-[0.12em] placeholder:normal-case placeholder:tracking-normal"
        />
        <LabelPicks
          value={label.trim()}
          onPick={(v) => {
            setLabel(v)
            onLabel(v)
          }}
        />
        <p className="truncate text-xs text-muted">
          {[pair.him?.caption, pair.her?.caption].filter(Boolean).join(' · ') || 'No captions yet'}
          {busy && <Spinner label="Saving" className="ml-2 inline-flex text-xs" />}
        </p>
        {mixed && <p className="text-xs text-rose">His and her photos have different labels — save one here to use it for both.</p>}
      </div>
    </li>
  )
}
