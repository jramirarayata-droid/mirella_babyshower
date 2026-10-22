import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, ExternalLink, Gift, ImagePlus, Lightbulb, Pencil, Plus, Trash2, X } from 'lucide-react'
import { PageHeader } from '../components/admin/PageHeader'
import { SavedText, useAutoSaved, VisibilityField } from '../components/admin/ShowerAdminBits'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { TextAreaField, TextField } from '../components/ui/FormField'
import { Skeleton } from '../components/ui/Skeleton'
import { useToast } from '../hooks/useToast'
import {
  addRegistryItem,
  deleteRegistryItem,
  getGiftIdeasSettings,
  getRegistrySettings,
  IDEAS_LAYOUTS,
  saveGiftIdeasSettings,
  listRegistryAdmin,
  removeRegistryClaim,
  reorderRegistry,
  saveRegistrySettings,
  updateRegistryItem,
  type AdminRegistryItem,
  type GiftIdeasSettings,
  type RegistryItemInput,
} from '../services/showerService'
import { toFriendlyMessage } from '../utils/errors'
import { isValidHttpUrl } from '../utils/validation'
import { formatShortDate } from '../utils/formatting'
import { siteLinks } from '../utils/share'
import { cn } from '../components/ui/cn'
import { uploadWeddingAsset } from '../services/settingsService'
import { GuestOnlySwitch } from '../components/admin/GuestOnlySwitch'
import { OnRsvpSwitch } from '../components/admin/OnRsvpSwitch'

const EMPTY: RegistryItemInput = { kind: 'gift', title: '', note: '', link: '', imageUrl: '', priceHint: '', quantity: 1, isVisible: true }

/** Ideas to start a wishlist with (every one can be changed or removed). */
const STARTERS: RegistryItemInput[] = [
  { ...EMPTY, title: 'Diapers (newborn & size 1)', note: 'Any brand — we’ll need lots!', quantity: 10 },
  { ...EMPTY, title: 'Baby wipes', note: 'Unscented, please.', quantity: 6 },
  { ...EMPTY, title: 'Swaddle blankets', quantity: 4 },
  { ...EMPTY, title: 'Onesies (0–3 months)', quantity: 6 },
  { ...EMPTY, title: 'Baby bath tub', quantity: 1 },
  { ...EMPTY, title: 'Baby bottles & sterilizer', quantity: 1 },
  { ...EMPTY, title: 'Stroller', quantity: 1 },
  { ...EMPTY, title: 'Baby carrier', quantity: 1 },
]

/** Admin → Gift Registry: the wishlist guests see, who said "I'll bring this", and when it shows. */
export default function AdminRegistry() {
  const toast = useToast()
  const settings = useAutoSaved(getRegistrySettings, saveRegistrySettings)
  const ideas = useAutoSaved(getGiftIdeasSettings, saveGiftIdeasSettings)
  const [items, setItems] = useState<AdminRegistryItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: string | null; v: RegistryItemInput } | null>(null)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState<AdminRegistryItem | null>(null)
  const [uploading, setUploading] = useState(false)

  const upload = async (file: File | undefined) => {
    if (!file || !editing) return
    setUploading(true)
    try {
      const url = await uploadWeddingAsset(file, 'registry')
      setEditing((e) => (e ? { ...e, v: { ...e.v, imageUrl: url } } : e))
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setUploading(false)
    }
  }

  const reload = useCallback(async () => {
    try {
      setItems(await listRegistryAdmin())
      setError(null)
    } catch (e) {
      setError(toFriendlyMessage(e))
    }
  }, [])

  useEffect(() => {
    document.title = 'Gift Registry · Baby shower admin'
    void reload()
  }, [reload])

  const save = async () => {
    if (!editing) return
    const v = editing.v
    if (!v.title.trim()) return toast.error(v.kind === 'idea' ? 'Give the idea a title.' : 'Give the item a name.')
    if (v.kind === 'idea' && !v.imageUrl.trim()) return toast.error('Add a photo for the idea.')
    if (!isValidHttpUrl(v.link) || !isValidHttpUrl(v.imageUrl)) return toast.error('Links must start with https://')
    setSaving(true)
    try {
      if (editing.id) await updateRegistryItem(editing.id, v)
      else await addRegistryItem(v, items?.length ?? 0)
      setEditing(null)
      toast.success('Saved.')
      await reload()
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const addStarters = async () => {
    setSaving(true)
    try {
      for (const [i, s] of STARTERS.entries()) await addRegistryItem(s, (items?.length ?? 0) + i)
      toast.success('Added a starter wishlist — change anything you like.')
      await reload()
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const move = async (index: number, dir: -1 | 1) => {
    if (!items) return
    const next = [...items]
    const t = index + dir
    if (t < 0 || t >= next.length) return
    ;[next[index], next[t]] = [next[t]!, next[index]!]
    setItems(next)
    try {
      await reorderRegistry(next.map((i) => i.id))
    } catch (e) {
      toast.error(toFriendlyMessage(e))
      void reload()
    }
  }

  const toggle = async (item: AdminRegistryItem) => {
    try {
      await updateRegistryItem(item.id, { ...item, isVisible: !item.isVisible })
      await reload()
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    }
  }

  const s = settings.value
  const claimedTotal = items?.reduce((n, i) => n + i.claims.reduce((a, c) => a + c.qty, 0), 0) ?? 0
  return (
    <>
      <PageHeader
        title="Gift Registry"
        description="Gifts guests can bring (they tap “I’ll bring this” so nothing is doubled — only you see who) and gift ideas: photos with a title and caption, just for inspiration, shown in their own section of the website."
        actions={
          <>
            <Button variant="outline" icon={<Lightbulb aria-hidden="true" className="size-4" />} onClick={() => setEditing({ id: null, v: { ...EMPTY, kind: 'idea' } })}>
              Add an idea
            </Button>
            <Button icon={<Plus aria-hidden="true" className="size-4" />} onClick={() => setEditing({ id: null, v: { ...EMPTY } })}>
              Add a gift
            </Button>
          </>
        }
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-3">
          {error && <p className="rounded-lg bg-rose/5 p-3 text-sm text-rose">{error}</p>}
          {!items && !error ? (
            <Skeleton className="h-64" />
          ) : items && items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-paper p-8 text-center">
              <Gift aria-hidden="true" className="mx-auto size-10 text-champagne" strokeWidth={1.2} />
              <p className="mt-3 text-ink-soft">No items yet. Add your own, or start with a typical baby wishlist.</p>
              <Button className="mt-4" variant="outline" loading={saving} onClick={() => void addStarters()}>
                Start with a typical wishlist
              </Button>
            </div>
          ) : (
            items?.map((item, i) => {
              const taken = item.claims.reduce((a, c) => a + c.qty, 0)
              return (
                <article key={item.id} className="rounded-xl border border-line bg-paper p-4 shadow-soft">
                  <div className="flex items-start gap-3">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" className="size-16 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="grid size-16 shrink-0 place-items-center rounded-lg bg-cream text-champagne">
                        <Gift aria-hidden="true" className="size-6" strokeWidth={1.3} />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-serif text-xl text-ink">{item.title}</span>
                        {!item.isVisible && <Badge tone="gray">Hidden</Badge>}
                        {item.kind === 'idea' ? (
                          <Badge tone="ink">Idea</Badge>
                        ) : taken >= item.quantity ? (
                          <Badge tone="green">All taken</Badge>
                        ) : (
                          <Badge tone="gold">{item.quantity - taken} still needed</Badge>
                        )}
                      </p>
                      <p className="text-sm text-muted">
                        {item.kind === 'idea' ? item.note || 'Inspiration only — guests don’t claim it.' : `${taken} of ${item.quantity} promised${item.priceHint ? ` · ${item.priceHint}` : ''}`}
                        {item.link && (
                          <a href={item.link} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 text-gold hover:underline">
                            link <ExternalLink aria-hidden="true" className="size-3" />
                          </a>
                        )}
                      </p>
                      {item.claims.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-1.5">
                          {item.claims.map((c) => (
                            <li key={c.id} className="inline-flex items-center gap-1 rounded-full bg-cream px-2.5 py-1 text-xs text-ink-soft" title={formatShortDate(c.at)}>
                              {c.name}
                              {c.qty > 1 && <span className="text-muted">×{c.qty}</span>}
                              <button
                                type="button"
                                aria-label={`Remove ${c.name}’s claim`}
                                className="text-muted hover:text-rose"
                                onClick={() =>
                                  void removeRegistryClaim(c.id)
                                    .then(reload)
                                    .catch((e) => toast.error(toFriendlyMessage(e)))
                                }
                              >
                                <X aria-hidden="true" className="size-3" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                      <Button size="sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => void move(i, -1)} icon={<ArrowUp aria-hidden="true" className="size-4" />} />
                      <Button size="sm" variant="ghost" aria-label="Move down" disabled={i === items.length - 1} onClick={() => void move(i, 1)} icon={<ArrowDown aria-hidden="true" className="size-4" />} />
                      <Button size="sm" variant="ghost" aria-label={item.isVisible ? 'Hide' : 'Show'} onClick={() => void toggle(item)} icon={item.isVisible ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />} />
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Edit"
                        onClick={() => setEditing({ id: item.id, v: { kind: item.kind, title: item.title, note: item.note, link: item.link, imageUrl: item.imageUrl, priceHint: item.priceHint, quantity: item.quantity, isVisible: item.isVisible } })}
                        icon={<Pencil aria-hidden="true" className="size-4" />}
                      />
                      <Button size="sm" variant="danger-quiet" aria-label="Delete" onClick={() => setRemoving(item)} icon={<Trash2 aria-hidden="true" className="size-4" />} />
                    </div>
                  </div>
                </article>
              )
            })
          )}
        </section>
        <div className="space-y-6">
        <aside className="space-y-4 rounded-xl border border-line bg-paper p-5 shadow-soft">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-xl text-ink">Wishlist on the website</h2>
            <SavedText state={settings.state} />
          </div>
          {!s ? (
            <Skeleton className="h-40" />
          ) : (
            <>
              <VisibilityField label="Wishlist page" mode={s.mode} from={s.from} onChange={settings.update} />
              <GuestOnlySwitch what="wishlist" stacked />
              <OnRsvpSwitch what="wishlist" />
              <TextField label="Title" value={s.title} onChange={(title) => settings.update({ title })} maxLength={60} />
              <TextAreaField label="A short note for guests" value={s.intro} onChange={(intro) => settings.update({ intro })} maxLength={300} rows={3} />
            </>
          )}
          <p className="text-sm text-muted">
            {claimedTotal} {claimedTotal === 1 ? 'gift' : 'gifts'} promised so far. Guests see what’s still needed, never who is bringing what. Link:{' '}
            <a href={`${siteLinks().home}#/registry`} target="_blank" rel="noopener noreferrer" className="break-all text-gold hover:underline">
              /#/registry
            </a>
          </p>
        </aside>
        <IdeasPanel ideas={ideas} count={items?.filter((i) => i.kind === 'idea' && i.isVisible && i.imageUrl).length ?? 0} />
        </div>
      </div>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? (editing.v.kind === 'idea' ? 'Edit idea' : 'Edit gift') : editing?.v.kind === 'idea' ? 'Add an idea' : 'Add a gift'}
        locked={saving}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button loading={saving} loadingText="Saving…" disabled={uploading} onClick={() => void save()}>
              Save
            </Button>
          </div>
        }
      >
        {editing && (
          <div className="space-y-4">
            <div role="radiogroup" aria-label="Type" className="grid grid-cols-2 gap-1 rounded-lg bg-cream p-1">
              {(
                [
                  ['gift', 'Gift to bring', Gift],
                  ['idea', 'Idea only', Lightbulb],
                ] as const
              ).map(([k, label, Icon]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={editing.v.kind === k}
                  onClick={() => setEditing({ ...editing, v: { ...editing.v, kind: k } })}
                  className={cn('flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm transition', editing.v.kind === k ? 'bg-paper text-ink shadow-soft' : 'text-muted hover:text-ink')}
                >
                  <Icon aria-hidden="true" className="size-4" /> {label}
                </button>
              ))}
            </div>
            <p className="-mt-2 text-xs text-muted">
              {editing.v.kind === 'idea'
                ? 'A photo with a title and caption, just for inspiration. Guests don’t claim it.'
                : 'Guests tap “I’ll bring this” so it isn’t doubled. Only you see who is bringing it.'}
            </p>

            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">Photo{editing.v.kind === 'idea' ? '' : ' (optional)'}</p>
              <div className="flex items-center gap-3">
                {editing.v.imageUrl ? (
                  <img src={editing.v.imageUrl} alt="" className="size-20 shrink-0 rounded-lg border border-line object-cover" />
                ) : (
                  <span className="grid size-20 shrink-0 place-items-center rounded-lg border border-dashed border-line bg-cream text-champagne">
                    <ImagePlus aria-hidden="true" className="size-6" strokeWidth={1.3} />
                  </span>
                )}
                <div className="flex flex-wrap gap-2">
                  <label className={cn('inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-line px-4 text-sm text-ink transition hover:border-champagne', uploading && 'pointer-events-none opacity-60')}>
                    <ImagePlus aria-hidden="true" className="size-4 text-gold" />
                    {uploading ? 'Uploading…' : editing.v.imageUrl ? 'Change photo' : 'Upload a photo'}
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={(e) => void upload(e.target.files?.[0])} />
                  </label>
                  {editing.v.imageUrl && (
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ ...editing, v: { ...editing.v, imageUrl: '' } })}>
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <TextField
              label={editing.v.kind === 'idea' ? 'Title' : 'What is it?'}
              value={editing.v.title}
              onChange={(title) => setEditing({ ...editing, v: { ...editing.v, title } })}
              maxLength={120}
              placeholder={editing.v.kind === 'idea' ? 'e.g. A cozy reading corner' : 'e.g. Baby monitor'}
            />
            <TextAreaField
              label={editing.v.kind === 'idea' ? 'Caption' : 'Note (optional)'}
              value={editing.v.note}
              onChange={(note) => setEditing({ ...editing, v: { ...editing.v, note } })}
              maxLength={300}
              rows={2}
              placeholder={editing.v.kind === 'idea' ? 'A few words about the idea' : 'Colour, size or brand you prefer'}
            />
            {editing.v.kind === 'gift' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="How many do you need?"
                  type="number"
                  min={1}
                  max={99}
                  value={String(editing.v.quantity)}
                  onChange={(q) => setEditing({ ...editing, v: { ...editing.v, quantity: Math.max(1, Math.min(99, Number(q) || 1)) } })}
                />
                <TextField label="Price idea (optional)" value={editing.v.priceHint} onChange={(priceHint) => setEditing({ ...editing, v: { ...editing.v, priceHint } })} maxLength={40} placeholder="e.g. around ₱1,500" />
              </div>
            )}
            <TextField
              label={editing.v.kind === 'idea' ? 'Where to find it (optional)' : 'Link to an example (optional)'}
              type="url"
              value={editing.v.link}
              onChange={(link) => setEditing({ ...editing, v: { ...editing.v, link } })}
              placeholder="https://…"
            />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(removing)}
        title="Delete this item?"
        message={removing ? `“${removing.title}” leaves the wishlist${removing.claims.length ? `, with ${removing.claims.length} ${removing.claims.length === 1 ? 'promise' : 'promises'} from guests` : ''}.` : ''}
        confirmLabel="Delete"
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const item = removing
          setRemoving(null)
          if (item)
            void deleteRegistryItem(item.id)
              .then(reload)
              .catch((e) => toast.error(toFriendlyMessage(e)))
        }}
      />
    </>
  )
}

/** Gift ideas: their own section on the home page and their own page, with their own switches. */
function IdeasPanel({ ideas, count }: { ideas: ReturnType<typeof useAutoSaved<GiftIdeasSettings>>; count: number }) {
  const v = ideas.value
  return (
    <aside aria-labelledby="ideas-panel-heading" className="space-y-4 rounded-xl border border-line bg-paper p-5 shadow-soft">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="ideas-panel-heading" className="flex items-center gap-2 text-xl text-ink">
          <Lightbulb aria-hidden="true" className="size-5 text-gold" strokeWidth={1.6} /> Gift ideas section
        </h2>
        <SavedText state={ideas.state} />
      </div>
      {!v ? (
        <Skeleton className="h-40" />
      ) : (
        <>
          <div role="radiogroup" aria-label="Gift ideas section" className="grid grid-cols-2 gap-1 rounded-lg bg-cream p-1 text-sm">
            {(
              [
                [true, 'Show'],
                [false, 'Hide'],
              ] as const
            ).map(([on, label]) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={v.visible === on}
                onClick={() => ideas.update({ visible: on })}
                className={cn('min-h-10 rounded-md px-2 py-1.5 transition', v.visible === on ? 'bg-paper font-medium text-ink shadow-soft' : 'text-muted hover:text-ink')}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted">
            {!v.visible
              ? 'Hidden from the website. Your ideas stay saved.'
              : count === 0
                ? 'Shows on the website once you add an idea with a photo.'
                : `${count} ${count === 1 ? 'idea' : 'ideas'} on the website, in their own section (move it in Page Order).`}
          </p>
          <GuestOnlySwitch what="ideas" stacked />
          <OnRsvpSwitch what="ideas" />
          <TextField label="Title" value={v.title} onChange={(title) => ideas.update({ title })} maxLength={80} />
          <TextAreaField label="A short note (optional)" value={v.intro} onChange={(intro) => ideas.update({ intro })} maxLength={300} rows={2} placeholder="Just ideas we love — no need to tell us if you choose one." />
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">Design</legend>
            <div role="radiogroup" aria-label="Gift ideas design" className="grid gap-1.5">
              {IDEAS_LAYOUTS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  role="radio"
                  aria-checked={v.layout === l.id}
                  onClick={() => ideas.update({ layout: l.id })}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-left text-sm transition',
                    v.layout === l.id ? 'border-ink bg-ink/[0.03]' : 'border-line hover:border-champagne',
                  )}
                >
                  <span className="block font-medium text-ink">{l.name}</span>
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
            or on the home page.
          </p>
        </>
      )}
    </aside>
  )
}
