import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Lightbulb, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { TextAreaField, TextField } from '../ui/FormField'
import { Skeleton } from '../ui/Skeleton'
import { cn } from '../ui/cn'
import { useToast } from '../../hooks/useToast'
import { SavedText, type useAutoSaved } from './ShowerAdminBits'
import { addRegistryItem, deleteRegistryItem, IDEAS_LAYOUTS, reorderRegistry, updateRegistryItem, type AdminRegistryItem, type GiftIdeasSettings, type RegistryItemInput } from '../../services/showerService'
import { removeAssetByUrl, uploadIdeaPhoto } from '../../services/galleryService'
import { toFriendlyMessage } from '../../utils/errors'
import { siteLinks } from '../../utils/share'
import { SectionWords, smallLine } from './SectionWords'

export const IDEAS_LIMIT = 40

const inputOf = (i: AdminRegistryItem): RegistryItemInput => ({
  kind: 'idea',
  title: i.title,
  note: i.note,
  link: i.link,
  imageUrl: i.imageUrl,
  priceHint: '',
  quantity: 1,
  isVisible: i.isVisible,
})

/**
 * Admin → Gift Registry → Gift ideas: photos (many at once, like Photos &
 * Video), each with an optional title and caption, shown on the website in a
 * gallery design. Guests only look — nothing to claim.
 */
export function GiftIdeasAdmin({
  ideas,
  settings,
  onChanged,
}: {
  ideas: AdminRegistryItem[] | null
  settings: ReturnType<typeof useAutoSaved<GiftIdeasSettings>>
  onChanged: () => Promise<void>
}) {
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null)
  const [removing, setRemoving] = useState<AdminRegistryItem | null>(null)
  const [list, setList] = useState<AdminRegistryItem[] | null>(null)
  const shown = list ?? ideas

  const upload = async (files: FileList | null) => {
    if (!files?.length || !ideas) return
    const room = IDEAS_LIMIT - ideas.length
    const picked = Array.from(files).slice(0, Math.max(room, 0))
    if (files.length > room) toast.show(`Only ${Math.max(room, 0)} more photo${room === 1 ? '' : 's'} can be added (limit ${IDEAS_LIMIT}).`)
    if (!picked.length) return
    setUploading({ done: 0, total: picked.length })
    let order = ideas.length
    let added = 0
    for (const f of picked) {
      try {
        const url = await uploadIdeaPhoto(f)
        try {
          await addRegistryItem({ kind: 'idea', title: '', note: '', link: '', imageUrl: url, priceHint: '', quantity: 1, isVisible: true }, order++)
          added++
        } catch (e) {
          void removeAssetByUrl(url)
          throw e
        }
      } catch (e) {
        toast.error(toFriendlyMessage(e))
      }
      setUploading((u) => (u ? { ...u, done: u.done + 1 } : u))
    }
    setUploading(null)
    if (input.current) input.current.value = ''
    if (added) toast.success(`${added} photo${added === 1 ? '' : 's'} added. Add a title or caption if you like.`)
    setList(null)
    await onChanged()
  }

  const save = async (item: AdminRegistryItem, patch: Partial<RegistryItemInput>) => {
    const next = { ...inputOf(item), ...patch }
    if (next.title === item.title && next.note === item.note && next.isVisible === item.isVisible) return
    try {
      await updateRegistryItem(item.id, next)
      setList(null)
      await onChanged()
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    }
  }

  const move = async (index: number, dir: -1 | 1) => {
    if (!shown) return
    const next = [...shown]
    const t = index + dir
    if (t < 0 || t >= next.length) return
    ;[next[index], next[t]] = [next[t]!, next[index]!]
    setList(next)
    try {
      await reorderRegistry(next.map((i) => i.id))
      await onChanged()
      setList(null)
    } catch (e) {
      toast.error(toFriendlyMessage(e))
      setList(null)
    }
  }

  const v = settings.value
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-label="Gift ideas photos" className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-paper p-4 shadow-soft">
          <input ref={input} tabIndex={-1} type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif" className="sr-only" onChange={(e) => void upload(e.target.files)} />
          <Button
            icon={<ImagePlus aria-hidden="true" className="size-4" />}
            onClick={() => input.current?.click()}
            loading={Boolean(uploading)}
            loadingText={uploading ? `Uploading ${uploading.done + 1} of ${uploading.total}…` : undefined}
            disabled={!ideas || ideas.length >= IDEAS_LIMIT}
          >
            Upload photos
          </Button>
          <p className="text-sm text-muted">
            Pick several at once. {ideas ? `${ideas.length} of ${IDEAS_LIMIT} photos` : 'Loading…'} · resized automatically to keep the site fast.
          </p>
        </div>

        {!shown ? (
          <Skeleton className="h-64" />
        ) : shown.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-paper p-8 text-center">
            <Lightbulb aria-hidden="true" className="mx-auto size-10 text-champagne" strokeWidth={1.2} />
            <p className="mt-3 text-ink-soft">No gift ideas yet. Upload photos of things you love — a nursery corner, a favourite stroller, little outfits.</p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((item, i) => (
              <li key={item.id} data-idea={item.id} className={cn('overflow-hidden rounded-xl border border-line bg-paper shadow-soft', !item.isVisible && 'opacity-70')}>
                <div className="relative">
                  <img src={item.imageUrl} alt={item.title || `Gift idea ${i + 1}`} className="aspect-[4/3] w-full bg-cream object-cover" />
                  {!item.isVisible && (
                    <Badge tone="gray" className="absolute left-2 top-2">
                      Hidden
                    </Badge>
                  )}
                </div>
                <div className="space-y-2 p-3">
                  <IdeaTexts item={item} onSave={(patch) => void save(item, patch)} />
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" aria-label={`Move photo ${i + 1} earlier`} disabled={i === 0} onClick={() => void move(i, -1)} icon={<ArrowUp aria-hidden="true" className="size-4" />} />
                    <Button size="sm" variant="ghost" aria-label={`Move photo ${i + 1} later`} disabled={i === shown.length - 1} onClick={() => void move(i, 1)} icon={<ArrowDown aria-hidden="true" className="size-4" />} />
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={item.isVisible ? `Hide photo ${i + 1}` : `Show photo ${i + 1}`}
                      onClick={() => void save(item, { isVisible: !item.isVisible })}
                      icon={item.isVisible ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
                    />
                    <Button size="sm" variant="danger-quiet" aria-label={`Delete photo ${i + 1}`} onClick={() => setRemoving(item)} icon={<Trash2 aria-hidden="true" className="size-4" />} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside aria-labelledby="ideas-panel-heading" className="space-y-4 rounded-xl border border-line bg-paper p-5 shadow-soft">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="ideas-panel-heading" className="text-xl text-ink">
            Gift ideas on the website
          </h2>
          <SavedText state={settings.state} />
        </div>
        {!v ? (
          <Skeleton className="h-40" />
        ) : (
          <>
            <p className="text-sm text-muted">Who sees it is set at the top of this page, for whichever tab is live.</p>
            <TextField label="Title" value={v.title} onChange={(title) => settings.update({ title })} maxLength={80} />
            <TextAreaField label="A short note (optional)" value={v.intro} onChange={(intro) => settings.update({ intro })} maxLength={300} rows={2} placeholder="Just ideas we love — no need to tell us if you choose one." />
            <SectionWords sectionKey="ideas" fields={[smallLine('Ideas & inspiration')]} />
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-ink">Gallery design</legend>
              <div role="radiogroup" aria-label="Gallery design" className="grid gap-1.5">
                {IDEAS_LAYOUTS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    role="radio"
                    aria-checked={v.layout === l.id}
                    onClick={() => settings.update({ layout: l.id })}
                    className={cn('rounded-lg border px-3 py-2 text-left text-sm transition', v.layout === l.id ? 'border-ink bg-ink/[0.03]' : 'border-line hover:border-champagne')}
                  >
                    <span className="flex items-center gap-2 font-medium text-ink">
                      {l.name}
                      {l.recommended && <Badge tone="gold">For gift ideas</Badge>}
                    </span>
                    <span className="block text-xs text-muted">{l.description}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <p className="text-sm text-muted">
              See it:{' '}
              <a href={`${siteLinks().home}#/ideas`} target="_blank" rel="noopener noreferrer" className="break-all text-gold hover:underline">
                /#/ideas
              </a>{' '}
              or on the home page (move it in Page Order).
            </p>
          </>
        )}
      </aside>

      <ConfirmDialog
        open={Boolean(removing)}
        title="Delete this photo?"
        message={removing?.title ? `“${removing.title}” leaves the gift ideas.` : 'This photo leaves the gift ideas.'}
        confirmLabel="Delete"
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const item = removing
          setRemoving(null)
          if (item)
            void deleteRegistryItem(item.id)
              .then(() => {
                if (item.imageUrl) void removeAssetByUrl(item.imageUrl)
                setList(null)
                return onChanged()
              })
              .catch((e) => toast.error(toFriendlyMessage(e)))
        }}
      />
    </div>
  )
}

/** Title and caption of one photo, saved when the field is left. */
function IdeaTexts({ item, onSave }: { item: AdminRegistryItem; onSave: (patch: { title?: string; note?: string }) => void }) {
  const [title, setTitle] = useState(item.title)
  const [note, setNote] = useState(item.note)
  useEffect(() => {
    setTitle(item.title)
    setNote(item.note)
  }, [item.title, item.note])
  return (
    <>
      <TextField label="Title (optional)" value={title} onChange={setTitle} maxLength={120} placeholder="e.g. A cozy reading corner" onBlur={() => onSave({ title: title.trim() })} />
      <TextAreaField label="Caption (optional)" value={note} onChange={setNote} maxLength={300} rows={2} placeholder="A few words about it" onBlur={() => onSave({ note: note.trim() })} />
    </>
  )
}
