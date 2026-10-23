import { syncSectionsInMediaOrder } from '../../services/settingsService'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, Film, ImagePlus, Images, Link2, Plus, Save, Trash2, Upload } from 'lucide-react'
import { useToast } from '../../hooks/useToast'
import {
  MEDIA_SECTION_LIMIT,
  createMediaSection,
  deleteMediaSection,
  listMediaSections,
  reorderMediaSections,
  updateMediaSection,
  type MediaSection,
} from '../../services/mediaSectionsService'
import {
  GALLERY_LIMIT,
  addGalleryFromFile,
  addGalleryFromUrl,
  deleteGalleryImage,
  listAllGallery,
  reorderGallery,
  updateGalleryImage,
  uploadVideoFile,
  uploadVideoPoster,
} from '../../services/galleryService'
import { GALLERY_LAYOUTS, type GalleryImage, type GalleryLayout } from '../../types/wedding'
import { toFriendlyMessage } from '../../utils/errors'
import { parseVideoUrl } from '../../utils/media'
import { isValidHttpUrl } from '../../utils/validation'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { TextField } from '../ui/FormField'
import { Skeleton } from '../ui/Skeleton'
import { cn } from '../ui/cn'
import { LayoutThumb, PhotoTile } from './MediaTiles'
import { useUnsavedChanges } from '../../hooks/unsavedChanges'
import { SaveStatus } from '../../components/ui/SaveStatus'
import { SectionWords, smallLine } from './SectionWords'

/**
 * Admin → Photos & Video → "More sections": extra photo galleries and videos
 * shown on the home page after the main gallery and film, in this order.
 */
export function MediaSectionsAdmin() {
  const toast = useToast()
  const [sections, setSections] = useState<MediaSection[] | null>(null)
  const [adding, setAdding] = useState<MediaSection['kind'] | null>(null)
  const [toRemove, setToRemove] = useState<MediaSection | null>(null)
  const [removing, setRemoving] = useState(false)
  const photoUrls = useRef(new Map<string, string[]>())

  const reload = useCallback(async () => {
    try {
      setSections(await listMediaSections())
    } catch (e) {
      toast.error(toFriendlyMessage(e))
      setSections([])
    }
  }, [toast])

  useEffect(() => {
    void reload()
  }, [reload])

  const add = async (kind: MediaSection['kind']) => {
    if (!sections) return
    setAdding(kind)
    try {
      const s = await createMediaSection(kind, sections.length + 1)
      setSections([...sections, s])
      window.dispatchEvent(new Event('media-sections-changed'))
      toast.success(kind === 'video' ? 'Video section added — add your video below.' : 'Photo section added — add your photos below.')
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setAdding(null)
    }
  }

  const move = async (i: number, dir: -1 | 1) => {
    if (!sections) return
    const t = i + dir
    if (t < 0 || t >= sections.length) return
    const next = [...sections]
    ;[next[i], next[t]] = [next[t], next[i]]
    setSections(next)
    try {
      await reorderMediaSections(next.map((s) => s.id))
      await syncSectionsInMediaOrder(next.map((s) => s.id)).catch(() => undefined)
      window.dispatchEvent(new Event('media-sections-changed'))
    } catch (e) {
      toast.error(toFriendlyMessage(e))
      void reload()
    }
  }

  const confirmRemove = async () => {
    if (!toRemove) return
    setRemoving(true)
    try {
      await deleteMediaSection(toRemove, photoUrls.current.get(toRemove.id) ?? [])
      setSections((l) => l?.filter((s) => s.id !== toRemove.id) ?? null)
      window.dispatchEvent(new Event('media-sections-changed'))
      toast.success('Section removed.')
      setToRemove(null)
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setRemoving(false)
    }
  }

  const full = Boolean(sections && sections.length >= MEDIA_SECTION_LIMIT)

  return (
    <section aria-labelledby="more-sections-heading" className="mt-6 rounded-xl border border-line bg-paper p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl">
          <h2 id="more-sections-heading" className="text-2xl text-ink">
            More sections
          </h2>
          <p className="mt-1 text-sm text-muted">
            Extra photo galleries and videos — e.g. “The Nursery”, “Gender Reveal film”. They appear on the home page after your gallery and film, in this order.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void add('photos')} loading={adding === 'photos'} loadingText="Adding…" disabled={!sections || full} icon={<Images aria-hidden="true" className="size-4" />}>
            Add photo section
          </Button>
          <Button variant="outline" size="sm" onClick={() => void add('video')} loading={adding === 'video'} loadingText="Adding…" disabled={!sections || full} icon={<Film aria-hidden="true" className="size-4" />}>
            Add video section
          </Button>
        </div>
      </div>
      {full && <p className="mt-3 text-sm text-muted">You’ve reached {MEDIA_SECTION_LIMIT} extra sections.</p>}

      <div className="mt-5 space-y-4">
        {!sections ? (
          <Skeleton className="h-24" />
        ) : sections.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
            No extra sections yet. Add a photo or video section to highlight more moments.
          </p>
        ) : (
          sections.map((s, i) => (
            <SectionEditor
              key={s.id}
              section={s}
              first={i === 0}
              last={i === sections.length - 1}
              onMove={(d) => void move(i, d)}
              onChange={(next) => setSections((l) => l?.map((x) => (x.id === next.id ? next : x)) ?? null)}
              onPhotos={(urls) => photoUrls.current.set(s.id, urls)}
              onRemove={() => setToRemove(s)}
            />
          ))
        )}
      </div>

      <ConfirmDialog
        open={Boolean(toRemove)}
        title={`Remove “${toRemove?.title || 'this section'}”?`}
        message={toRemove?.kind === 'photos' ? 'The section and all its photos will be removed from the website.' : 'The section and its video will be removed from the website.'}
        destructive
        confirmLabel="Remove section"
        loading={removing}
        loadingText="Removing…"
        onCancel={() => !removing && setToRemove(null)}
        onConfirm={() => void confirmRemove()}
      />
    </section>
  )
}

function SectionEditor({
  section: s,
  first,
  last,
  onMove,
  onChange,
  onPhotos,
  onRemove,
}: {
  section: MediaSection
  first: boolean
  last: boolean
  onMove: (dir: -1 | 1) => void
  onChange: (s: MediaSection) => void
  onPhotos: (urls: string[]) => void
  onRemove: () => void
}) {
  const toast = useToast()
  const [draft, setDraft] = useState({ title: s.title, subtitle: s.subtitle, videoUrl: s.videoUrl })
  const [saving, setSaving] = useState(false)
  const dirty = draft.title !== s.title || draft.subtitle !== s.subtitle || draft.videoUrl !== s.videoUrl
  useUnsavedChanges(dirty, 'a photo & video section')


  const save = async (patch: Partial<MediaSection>, ok = 'Section saved.') => {
    setSaving(true)
    try {
      await updateMediaSection(s.id, patch)
      onChange({ ...s, ...patch })
      toast.success(ok)
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const saveText = () => {
    const url = draft.videoUrl.trim()
    if (s.kind === 'video' && url && !(isValidHttpUrl(url) && url.startsWith('https://'))) {
      toast.error('Please paste a full video link starting with https:// (YouTube, Vimeo or an MP4).')
      return
    }
    void save({ title: draft.title, subtitle: draft.subtitle, ...(s.kind === 'video' ? { videoUrl: url } : {}) })
  }

  return (
    <article className={cn('rounded-lg border p-4 sm:p-5', s.isVisible ? 'border-line' : 'border-dashed border-line bg-cream/40')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-ink-soft">
          {s.kind === 'video' ? <Film aria-hidden="true" className="size-4 text-gold" /> : <Images aria-hidden="true" className="size-4 text-gold" />}
          {s.kind === 'video' ? 'Video section' : 'Photo section'}
          {!s.isVisible && <span className="rounded-full bg-cream px-2 py-0.5 text-xs text-muted">Hidden</span>}
        </p>
        <div className="flex items-center gap-1">
          <IconBtn label="Move up" onClick={() => onMove(-1)} disabled={first}>
            <ArrowUp className="size-4" />
          </IconBtn>
          <IconBtn label="Move down" onClick={() => onMove(1)} disabled={last}>
            <ArrowDown className="size-4" />
          </IconBtn>
          <IconBtn label={s.isVisible ? 'Hide on the website' : 'Show on the website'} onClick={() => void save({ isVisible: !s.isVisible }, s.isVisible ? 'Section hidden.' : 'Section shown.')} disabled={saving}>
            {s.isVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </IconBtn>
          <IconBtn label="Remove section" onClick={onRemove} danger>
            <Trash2 className="size-4" />
          </IconBtn>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <TextField label="Section title" value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} maxLength={120} />
        <TextField label={s.kind === 'video' ? 'Caption (optional)' : 'Short description (optional)'} value={draft.subtitle} onChange={(v) => setDraft({ ...draft, subtitle: v })} maxLength={300} />
        <SectionWords className="md:col-span-2" sectionKey={`media:${s.id}`} fields={[smallLine(s.kind === 'video' ? 'A Film' : 'Moments')]} />
        {s.kind === 'video' && (
          <TextField
            className="md:col-span-2"
            label="Video link"
            type="url"
            value={draft.videoUrl}
            onChange={(v) => setDraft({ ...draft, videoUrl: v })}
            placeholder="https://youtu.be/… or a Vimeo link — or upload an MP4 below"
          />
        )}
      </div>
      <div className="mt-3 flex items-center justify-end gap-3">
        <SaveStatus dirty={dirty} saving={saving} />
        <Button size="sm" onClick={saveText} loading={saving} loadingText="Saving…" disabled={!dirty} icon={<Save aria-hidden="true" className="size-4" />}>
          Save
        </Button>
      </div>

      {s.kind === 'photos' ? (
        <PhotosPart section={s} onLayout={(layout) => void save({ layout }, 'Layout saved.')} onPhotos={onPhotos} />
      ) : (
        <VideoPart section={s} onSaved={(patch) => onChange({ ...s, ...patch })} onDraftUrl={(videoUrl) => setDraft((d) => ({ ...d, videoUrl }))} />
      )}
    </article>
  )
}

function PhotosPart({ section, onLayout, onPhotos }: { section: MediaSection; onLayout: (l: GalleryLayout) => void; onPhotos: (urls: string[]) => void }) {
  const toast = useToast()
  const [photos, setPhotos] = useState<GalleryImage[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null)
  const [urlToAdd, setUrlToAdd] = useState('')
  const [toDelete, setToDelete] = useState<GalleryImage | null>(null)
  const [deleting, setDeleting] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const reload = useCallback(async () => {
    try {
      const list = await listAllGallery(section.id)
      setPhotos(list)
      onPhotos(list.map((p) => p.imageUrl))
    } catch (e) {
      toast.error(toFriendlyMessage(e))
      setPhotos([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.id])

  useEffect(() => {
    void reload()
  }, [reload])

  const upload = async (files: FileList | null) => {
    if (!files?.length || !photos) return
    const room = GALLERY_LIMIT - photos.length
    const list = Array.from(files).slice(0, Math.max(room, 0))
    if (files.length > room) toast.show(`Only ${Math.max(room, 0)} more photo${room === 1 ? '' : 's'} can be added (limit ${GALLERY_LIMIT} per section).`)
    if (!list.length) return
    setUploading({ done: 0, total: list.length })
    let order = photos.length
    let failed = 0
    for (const f of list) {
      try {
        order += 1
        await addGalleryFromFile(f, order, section.id)
      } catch (e) {
        failed++
        toast.error(toFriendlyMessage(e))
      }
      setUploading((u) => (u ? { ...u, done: u.done + 1 } : u))
    }
    setUploading(null)
    if (input.current) input.current.value = ''
    if (list.length - failed > 0) toast.success(`${list.length - failed} photo${list.length - failed === 1 ? '' : 's'} added.`)
    await reload()
  }

  const addUrl = async () => {
    if (!photos) return
    if (!isValidHttpUrl(urlToAdd) || !urlToAdd.trim().startsWith('https://')) {
      toast.error('Please paste a full image link starting with https://')
      return
    }
    try {
      await addGalleryFromUrl(urlToAdd, '', photos.length + 1, section.id)
      setUrlToAdd('')
      toast.success('Photo added.')
      await reload()
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    }
  }

  const run = async (id: string, action: () => Promise<void>, ok?: string) => {
    setBusyId(id)
    try {
      await action()
      if (ok) toast.success(ok)
      await reload()
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  const move = (i: number, dir: -1 | 1) => {
    if (!photos) return
    const t = i + dir
    if (t < 0 || t >= photos.length) return
    const ids = photos.map((p) => p.id)
    ;[ids[i], ids[t]] = [ids[t], ids[i]]
    void run(photos[i].id, () => reorderGallery(ids))
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      await deleteGalleryImage(toDelete)
      toast.success('Photo removed.')
      setToDelete(null)
      await reload()
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setDeleting(false)
    }
  }

  const current = GALLERY_LAYOUTS.find((l) => l.id === section.layout) ?? GALLERY_LAYOUTS[0]

  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-28 shrink-0">
          <LayoutThumb id={current.id} />
        </span>
        <label className="text-sm text-ink-soft">
          Layout
          <select className="input-base mt-1 min-h-10 py-1.5" value={section.layout} onChange={(e) => onLayout(e.target.value as GalleryLayout)}>
            {GALLERY_LAYOUTS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-muted">{current.description}</p>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <input tabIndex={-1} ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif" className="sr-only" onChange={(e) => void upload(e.target.files)} />
        <Button
          size="sm"
          onClick={() => input.current?.click()}
          loading={Boolean(uploading)}
          loadingText={uploading ? `Uploading ${uploading.done + 1} of ${uploading.total}…` : undefined}
          disabled={!photos || photos.length >= GALLERY_LIMIT}
          icon={<ImagePlus aria-hidden="true" className="size-4" />}
        >
          Upload photos
        </Button>
        <div className="flex flex-1 gap-2">
          <input value={urlToAdd} onChange={(e) => setUrlToAdd(e.target.value)} placeholder="…or paste an image link (https://)" aria-label="Image link" className="input-base min-h-10 py-1.5" />
          <Button size="sm" variant="subtle" onClick={() => void addUrl()} disabled={!urlToAdd.trim()} icon={<Link2 aria-hidden="true" className="size-4" />}>
            Add
          </Button>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">{photos ? `${photos.length} of ${GALLERY_LIMIT} photos` : 'Loading…'} · resized automatically to keep the site fast.</p>

      <div className="mt-3">
        {!photos ? (
          <Skeleton className="h-28" />
        ) : photos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">No photos yet — this section stays hidden on the website until it has some.</p>
        ) : (
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((p, i) => (
              <PhotoTile
                key={p.id}
                photo={p}
                index={i}
                busy={busyId === p.id}
                first={i === 0}
                last={i === photos.length - 1}
                sample={false}
                onMove={(d) => move(i, d)}
                onToggle={() => void run(p.id, () => updateGalleryImage(p.id, { isVisible: !p.isVisible }), p.isVisible ? 'Photo hidden.' : 'Photo shown.')}
                onCaption={(caption) => void run(p.id, () => updateGalleryImage(p.id, { caption }), 'Caption saved.')}
                onDelete={() => setToDelete(p)}
              />
            ))}
          </ol>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Remove this photo?"
        message={`“${toDelete?.caption || 'This photo'}” will be removed from the section.`}
        destructive
        confirmLabel="Remove photo"
        loading={deleting}
        loadingText="Removing…"
        onCancel={() => !deleting && setToDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}

function VideoPart({ section, onSaved, onDraftUrl }: { section: MediaSection; onSaved: (patch: Partial<MediaSection>) => void; onDraftUrl: (url: string) => void }) {
  const toast = useToast()
  const [videoBusy, setVideoBusy] = useState(false)
  const [posterBusy, setPosterBusy] = useState(false)
  const videoInput = useRef<HTMLInputElement>(null)
  const posterInput = useRef<HTMLInputElement>(null)
  const parsed = parseVideoUrl(section.videoUrl)

  const onVideo = async (file: File | undefined) => {
    if (!file) return
    setVideoBusy(true)
    try {
      const url = await uploadVideoFile(file)
      await updateMediaSection(section.id, { videoUrl: url })
      onSaved({ videoUrl: url })
      onDraftUrl(url)
      toast.success('Video uploaded.')
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setVideoBusy(false)
      if (videoInput.current) videoInput.current.value = ''
    }
  }

  const onPoster = async (file: File | undefined) => {
    if (!file) return
    setPosterBusy(true)
    try {
      const url = await uploadVideoPoster(file)
      await updateMediaSection(section.id, { posterUrl: url })
      onSaved({ posterUrl: url })
      toast.success('Cover image saved.')
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setPosterBusy(false)
      if (posterInput.current) posterInput.current.value = ''
    }
  }

  const cover = section.posterUrl || (parsed.kind === 'youtube' ? parsed.thumbnail : '')

  return (
    <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-[minmax(0,1fr)_220px]">
      <div className="flex flex-wrap items-start gap-2">
        <input tabIndex={-1} ref={videoInput} type="file" accept="video/mp4,video/webm" className="sr-only" onChange={(e) => void onVideo(e.target.files?.[0])} />
        <Button size="sm" variant="outline" onClick={() => videoInput.current?.click()} loading={videoBusy} loadingText="Uploading…" icon={<Upload aria-hidden="true" className="size-4" />}>
          Upload MP4 (up to 30 MB)
        </Button>
        <input tabIndex={-1} ref={posterInput} type="file" accept="image/*" className="sr-only" onChange={(e) => void onPoster(e.target.files?.[0])} />
        <Button size="sm" variant="subtle" onClick={() => posterInput.current?.click()} loading={posterBusy} loadingText="Uploading…" icon={<Plus aria-hidden="true" className="size-4" />}>
          {section.posterUrl ? 'Change cover image' : 'Add cover image'}
        </Button>
        <p className="w-full text-xs text-muted">
          {parsed.kind === 'none' ? 'No video yet — this section stays hidden on the website until it has one.' : parsed.kind === 'file' ? 'Uploaded video.' : `${parsed.kind === 'youtube' ? 'YouTube' : 'Vimeo'} video.`} Longer videos work best as a YouTube or Vimeo link.
        </p>
      </div>
      <div className="flex aspect-video items-center justify-center overflow-hidden rounded-md bg-[#1d1b19]">
        {cover ? (
          <img src={cover} alt="" className="size-full object-cover" />
        ) : parsed.kind === 'file' ? (
          <video src={parsed.src} muted playsInline className="size-full object-cover" />
        ) : (
          <Film className="size-8 text-ivory/40" />
        )}
      </div>
    </div>
  )
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn('flex size-9 items-center justify-center rounded-md text-muted transition disabled:opacity-30', danger ? 'hover:bg-rose/10 hover:text-rose' : 'hover:bg-cream hover:text-ink')}
    >
      {children}
    </button>
  )
}
