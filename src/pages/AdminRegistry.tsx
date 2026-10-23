import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, ExternalLink, Gift, ImagePlus, Lightbulb, Pencil, Plus, Trash2, X } from 'lucide-react'
import { PageHeader } from '../components/admin/PageHeader'
import { SavedText, StartField, useAutoSaved } from '../components/admin/ShowerAdminBits'
import { SectionAccess } from '../components/admin/SectionAccess'
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
  saveGiftIdeasSettings,
  listRegistryAdmin,
  removeRegistryClaim,
  reorderRegistry,
  saveRegistrySettings,
  updateRegistryItem,
  type AdminRegistryItem,
  type RegistryItemInput,
} from '../services/showerService'
import { toFriendlyMessage } from '../utils/errors'
import { isValidHttpUrl } from '../utils/validation'
import { formatShortDate } from '../utils/formatting'
import { siteLinks } from '../utils/share'
import { cn } from '../components/ui/cn'
import { uploadWeddingAsset } from '../services/settingsService'
import { GiftIdeasAdmin } from '../components/admin/GiftIdeasAdmin'
import { SectionWords, smallLine } from '../components/admin/SectionWords'

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

/**
 * Admin → Gift Registry: two tabs, one live on the website — the gift list
 * (guests tap "I'll bring this"; only you see who) or gift ideas photos shown
 * as a gallery. The other stays saved, ready to switch back.
 */
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
  const [tab, setTab] = useState<'list' | 'ideas' | null>(null)

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
    if (!v.title.trim()) return toast.error('Give the item a name.')
    if (!isValidHttpUrl(v.link) || !isValidHttpUrl(v.imageUrl)) return toast.error('Links must start with https://')
    setSaving(true)
    try {
      if (editing.id) await updateRegistryItem(editing.id, v)
      else await addRegistryItem(v, gifts?.length ?? 0)
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
      for (const [i, s] of STARTERS.entries()) await addRegistryItem(s, (gifts?.length ?? 0) + i)
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
    const next = items.filter((i) => i.kind === 'gift')
    const t = index + dir
    if (t < 0 || t >= next.length) return
    ;[next[index], next[t]] = [next[t]!, next[index]!]
    setItems([...next, ...items.filter((i) => i.kind !== 'gift')])
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
  const gifts = items?.filter((i) => i.kind === 'gift') ?? null
  const ideaItems = items?.filter((i) => i.kind === 'idea') ?? null
  const shownTab = tab ?? s?.active ?? 'list'
  const claimedTotal = gifts?.reduce((n, i) => n + i.claims.reduce((a, c) => a + c.qty, 0), 0) ?? 0
  return (
    <>
      <PageHeader
        title="Gift Registry"
        description="Choose what guests see: a gift list they tap “I’ll bring this” on, or gift ideas photos shown as a gallery. Only one is on the website at a time; the other stays saved."
        actions={
          shownTab === 'list' ? (
            <Button icon={<Plus aria-hidden="true" className="size-4" />} onClick={() => setEditing({ id: null, v: { ...EMPTY } })}>
              Add a gift
            </Button>
          ) : undefined
        }
      />

      {/* Which tab guests see, and when. */}
      <section aria-labelledby="live-heading" className="mb-6 rounded-xl border border-line bg-paper p-5 shadow-soft">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="live-heading" className="text-xl text-ink">
            On the website
          </h2>
          <SavedText state={settings.state} />
        </div>
        {!s ? (
          <Skeleton className="mt-4 h-28" />
        ) : (
          <div className="mt-4 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div role="radiogroup" aria-label="Guests see" className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ['list', 'Gift list', 'Guests tap “I’ll bring this” so nothing is doubled.', Gift, `${gifts?.length ?? 0} ${gifts?.length === 1 ? 'item' : 'items'}`],
                  ['ideas', 'Gift ideas', 'Photos of things you love, shown as a gallery.', Lightbulb, `${ideaItems?.length ?? 0} ${ideaItems?.length === 1 ? 'photo' : 'photos'}`],
                ] as const
              ).map(([id, title, text, Icon, count]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={s.active === id}
                  onClick={() => {
                    settings.update({ active: id })
                    setTab(id)
                  }}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border p-4 text-left transition',
                    s.active === id ? 'border-ink bg-ink/[0.03] ring-1 ring-ink' : 'border-line hover:border-champagne',
                  )}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-champagne-light/50 text-gold">
                    <Icon aria-hidden="true" className="size-5" strokeWidth={1.5} />
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 font-medium text-ink">
                      {title} {s.active === id && <Badge tone="green">Live</Badge>}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted">{text}</span>
                    <span className="mt-1 block text-xs text-muted">{count}</span>
                  </span>
                </button>
              ))}
            </div>
            <SectionAccess
              what="registry"
              hidden={s.mode === 'hidden'}
              onHiddenChange={(h) => settings.update({ mode: h ? 'hidden' : 'visible' })}
              timing={<StartField mode={s.mode} from={s.from} onChange={settings.update} />}
            />
          </div>
        )}
      </section>

      <div role="tablist" aria-label="Gift Registry" className="mb-5 inline-flex rounded-full bg-cream p-1">
        {(
          [
            ['list', 'Gift list', Gift],
            ['ideas', 'Gift ideas', Lightbulb],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={shownTab === id}
            onClick={() => setTab(id)}
            className={cn('inline-flex min-h-10 items-center gap-2 rounded-full px-5 text-sm transition', shownTab === id ? 'bg-paper font-medium text-ink shadow-soft' : 'text-muted hover:text-ink')}
          >
            <Icon aria-hidden="true" className="size-4" /> {label}
            {s?.active === id && <span aria-label="(live)" className="size-1.5 rounded-full bg-sage" />}
          </button>
        ))}
      </div>

      {shownTab === 'ideas' ? (
        <GiftIdeasAdmin ideas={ideaItems} settings={ideas} onChanged={reload} />
      ) : (
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-3">
          {error && <p className="rounded-lg bg-rose/5 p-3 text-sm text-rose">{error}</p>}
          {!items && !error ? (
            <Skeleton className="h-64" />
          ) : gifts && gifts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-paper p-8 text-center">
              <Gift aria-hidden="true" className="mx-auto size-10 text-champagne" strokeWidth={1.2} />
              <p className="mt-3 text-ink-soft">No items yet. Add your own, or start with a typical baby wishlist.</p>
              <Button className="mt-4" variant="outline" loading={saving} onClick={() => void addStarters()}>
                Start with a typical wishlist
              </Button>
            </div>
          ) : (
            gifts?.map((item, i) => {
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
                        {taken >= item.quantity ? (
                          <Badge tone="green">All taken</Badge>
                        ) : (
                          <Badge tone="gold">{item.quantity - taken} still needed</Badge>
                        )}
                      </p>
                      <p className="text-sm text-muted">
                        {`${taken} of ${item.quantity} promised${item.priceHint ? ` · ${item.priceHint}` : ''}`}
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
                      <Button size="sm" variant="ghost" aria-label="Move down" disabled={i === gifts.length - 1} onClick={() => void move(i, 1)} icon={<ArrowDown aria-hidden="true" className="size-4" />} />
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
        <aside className="space-y-4 rounded-xl border border-line bg-paper p-5 shadow-soft">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-xl text-ink">Gift list on the website</h2>
            <SavedText state={settings.state} />
          </div>
          {!s ? (
            <Skeleton className="h-40" />
          ) : (
            <>
              <TextField label="Title" value={s.title} onChange={(title) => settings.update({ title })} maxLength={60} />
              <TextAreaField label="A short note for guests" value={s.intro} onChange={(intro) => settings.update({ intro })} maxLength={300} rows={3} />
              <SectionWords
                heading="Card on the home page"
                sectionKey="fun"
                fields={[
                  { field: 'registryTitle', label: 'Title', usual: 'Gift Wishlist' },
                  { field: 'registryText', label: 'Text', usual: 'See what our little one still needs, and mark what you’ll bring so nothing is doubled.', long: true },
                  { field: 'registryButton', label: 'Button', usual: 'See the wishlist' },
                ]}
              />
            </>
          )}
          <p className="text-sm text-muted">
            {claimedTotal} {claimedTotal === 1 ? 'gift' : 'gifts'} promised so far. Guests see what’s still needed, never who is bringing what. Link:{' '}
            <a href={`${siteLinks().home}#/registry`} target="_blank" rel="noopener noreferrer" className="break-all text-gold hover:underline">
              /#/registry
            </a>
          </p>
        </aside>
      </div>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit gift' : 'Add a gift'}
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
            <p className="text-xs text-muted">Guests tap “I’ll bring this” so it isn’t doubled. Only you see who is bringing it.</p>

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
