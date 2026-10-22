import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, ExternalLink, Eye, EyeOff, Lock, RotateCcw, Save } from 'lucide-react'
import { PageHeader } from '../components/admin/PageHeader'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Skeleton } from '../components/ui/Skeleton'
import { SaveStatus } from '../components/ui/SaveStatus'
import { useToast } from '../hooks/useToast'
import { useSpace } from '../hooks/useSpace'
import { useUnsavedChanges } from '../hooks/unsavedChanges'
import { setCachedWeddingSettings } from '../hooks/useWeddingSettings'
import { getWeddingSettings, orderMedia, updatePageOrder } from '../services/settingsService'
import { listMediaSections } from '../services/mediaSectionsService'
import { listVisibleGallery } from '../services/galleryService'
import { listProgram } from '../services/programService'
import { listVisibleOutfits } from '../services/outfitService'
import { getPublicGift } from '../services/giftService'
import { getPublicReveal, getRegistry, getPredictionsInfo, getNameIdeasInfo, getGiftIdeasSettings, listRegistryAdmin } from '../services/showerService'
import { getGuestPhotosInfo } from '../services/guestPhotosService'
import { getWebsitePrivacy } from '../services/adminDisplayService'
import type { WeddingSettings } from '../types/wedding'
import { toFriendlyMessage } from '../utils/errors'
import { siteLinks } from '../utils/share'
import { cn } from '../components/ui/cn'
import { SECTION_NAMES, defaultSectionKeys, orderSections, type FixedSectionKey, type SectionKey } from '../utils/pageOrder'

type Status = { tone: 'on' | 'off' | 'guests' | 'plan'; text: string; fix?: { to: string; label: string } }
interface Row {
  key: SectionKey
  name: string
  status: Status
}

const ON = (text = 'Showing'): Status => ({ tone: 'on', text })
const OFF = (text: string, to: string, label: string): Status => ({ tone: 'off', text, fix: { to, label } })

/**
 * Admin → Page Order: every section of the home page, in order, with what it
 * shows right now (showing, switched off, empty, attending guests only, not in
 * the plan) and Move up / Move down. The front page is always first and the
 * footer last. Hidden sections keep their place for when they're switched on.
 */
export default function AdminPageOrder() {
  const toast = useToast()
  const space = useSpace()
  const [settings, setSettings] = useState<WeddingSettings | null>(null)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [order, setOrder] = useState<SectionKey[]>([])
  const [savedOrder, setSavedOrder] = useState<SectionKey[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewKey, setPreviewKey] = useState(0)

  const load = useCallback(async () => {
    try {
      const s = await getWeddingSettings()
      const [media, gallery, program, outfits, gift, reveal, registry, predictions, names, photos, privacy, ideasCfg, regItems] = await Promise.all([
        listMediaSections().catch(() => []),
        listVisibleGallery().catch(() => []),
        listProgram().catch(() => []),
        listVisibleOutfits().catch(() => []),
        getPublicGift().catch(() => null),
        getPublicReveal().catch(() => null),
        getRegistry().catch(() => null),
        getPredictionsInfo().catch(() => null),
        getNameIdeasInfo().catch(() => null),
        getGuestPhotosInfo().catch(() => null),
        getWebsitePrivacy().catch(() => null),
        getGiftIdeasSettings().catch(() => null),
        listRegistryAdmin().catch(() => []),
      ])

      // Photo sections in the Photos & Video order (hidden ones too — they keep their place).
      const mediaItems = orderMedia(
        [
          { key: 'gallery', name: s.galleryTitle || 'Photo gallery', status: !s.galleryVisible ? OFF('Switched off', '/admin/media', 'Photos & Video') : gallery.length === 0 ? OFF('No photos yet', '/admin/media', 'Add photos') : ON() },
          {
            key: 'video',
            name: s.videoTitle || 'Video',
            status: !s.videoVisible ? OFF('Switched off', '/admin/media', 'Photos & Video') : !s.videoUrl ? OFF('No video yet', '/admin/media', 'Add a video') : ON(),
          },
          ...media.map((m) => ({ key: m.id, name: m.title || (m.kind === 'video' ? 'Video section' : 'Photo section'), status: m.isVisible ? ON() : OFF('Switched off', '/admin/media', 'Photos & Video') })),
        ],
        s.mediaOrder ?? [],
      )

      const guestOnly = (on: boolean | undefined, text: string): Status | null => (on ? { tone: 'guests', text } : null)
      const funOn = [registry?.guestVisible && 'Wishlist', predictions?.visible && space.has('predictions') && 'Predictions', names?.visible && space.has('names') && 'Name ideas'].filter(Boolean) as string[]
      const status: Record<FixedSectionKey, Status> = {
        intro: ON(),
        verse: s.verseVisible ? ON() : OFF('Switched off', '/admin/settings', 'Website Settings'),
        reveal: !space.has('reveal') ? { tone: 'plan', text: 'Not in this plan' } : reveal?.enabled ? ON() : OFF('Switched off', '/admin/reveal', 'Gender Reveal'),
        guestPhotos: !space.has('guest_photos') ? { tone: 'plan', text: 'Not in this plan' } : photos?.visible ? ON() : OFF('Not shown yet', '/admin/guest-photos', 'Guest Photos'),
        venue: guestOnly(privacy?.hideVenues, 'Confirmed guests only — a short note shows instead') ?? ON(),
        program: !s.programVisible ? OFF('Switched off', '/admin/settings', 'Website Settings') : program.length === 0 ? OFF('No program items yet', '/admin/settings', 'Add the program') : ON(),
        info: guestOnly(privacy?.hideInfo, 'Confirmed guests only') ?? (s.sections.some((x) => x.visible) ? ON() : OFF('Nothing to show', '/admin/settings', 'Website Settings')),
        attire:
          s.outfitSectionVisible && outfits.length > 0
            ? (guestOnly(privacy?.hideAttire, 'Outfit photos for attending guests only — motif colours show') ?? ON())
            : s.motifColors.length > 0
              ? ON('Motif colours only')
              : OFF(s.outfitSectionVisible ? 'No outfit photos or colours yet' : 'Switched off', '/admin/outfits', 'What to Wear'),
        ideas: !ideasCfg?.visible
          ? OFF('Switched off', '/admin/registry', 'Gift Registry')
          : !regItems.some((i) => i.kind === 'idea' && i.isVisible && i.imageUrl)
            ? OFF('No ideas with a photo yet', '/admin/registry', 'Add an idea')
            : (guestOnly(privacy?.hideIdeas, 'Attending guests only') ?? ON()),
        fun: funOn.length ? ON(`Showing: ${funOn.join(', ')}`) : OFF('All three are off', '/admin/registry', 'Shower fun'),
        gift: gift ? ON() : OFF('Not set up', '/admin/settings', 'Website Settings'),
        rsvp: ON(),
      }

      const rowsNow: Row[] = [
        ...(Object.keys(SECTION_NAMES) as FixedSectionKey[]).map((k) => ({ key: k as SectionKey, name: SECTION_NAMES[k], status: status[k] })),
        ...mediaItems.map((m) => ({ key: `media:${m.key}` as SectionKey, name: m.name, status: m.status })),
      ]
      const now = orderSections(
        defaultSectionKeys(mediaItems.map((m) => `media:${m.key}`)),
        s.pageOrder,
      )
      setSettings(s)
      setRows(rowsNow)
      setOrder(now)
      setSavedOrder(now)
      setError(null)
    } catch (e) {
      setError(toFriendlyMessage(e))
    }
  }, [space])

  useEffect(() => {
    document.title = 'Page Order · Baby shower admin'
    void load()
  }, [load])

  const byKey = useMemo(() => new Map((rows ?? []).map((r) => [r.key, r])), [rows])
  const dirty = order.join('|') !== savedOrder.join('|')
  useUnsavedChanges(dirty, 'Page Order')

  const move = (i: number, dir: -1 | 1) => {
    const t = i + dir
    if (t < 0 || t >= order.length) return
    const next = [...order]
    ;[next[i], next[t]] = [next[t]!, next[i]!]
    setOrder(next)
  }

  const save = async () => {
    if (!settings) return
    setSaving(true)
    try {
      const s = await updatePageOrder(settings.id, order)
      setCachedWeddingSettings(s)
      setSettings(s)
      setSavedOrder(order)
      setPreviewKey((k) => k + 1)
      toast.success('Saved. Your website shows the new order.')
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const resetToUsual = () => {
    const mediaKeys = order.filter((k) => k.startsWith('media:'))
    setOrder(defaultSectionKeys(mediaKeys))
  }

  const site = siteLinks().home
  return (
    <>
      <PageHeader
        title="Page Order"
        description="The order of the sections on your home page. The front page always comes first and the footer last. Hidden sections keep their place for when you switch them on."
        actions={
          <>
            <SaveStatus dirty={dirty} saving={saving} />
            <Button variant="ghost" onClick={resetToUsual} disabled={!rows || saving} icon={<RotateCcw aria-hidden="true" className="size-4" />}>
              Usual order
            </Button>
            <Button onClick={() => void save()} loading={saving} loadingText="Saving…" disabled={!dirty} icon={<Save aria-hidden="true" className="size-4" />}>
              Save order
            </Button>
          </>
        }
      />
      {error && <p className="mb-4 rounded-lg bg-rose/5 p-3 text-sm text-rose">{error}</p>}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section aria-label="Sections in order" className="overflow-hidden rounded-xl border border-line bg-paper shadow-soft">
          <p className="flex items-center gap-2 border-b border-line bg-cream px-4 py-3 text-sm text-muted">
            <Lock aria-hidden="true" className="size-4" /> Front page (always first)
          </p>
          {!rows ? (
            <Skeleton className="m-4 h-96" />
          ) : (
            <ol className="divide-y divide-line">
              {order.map((k, i) => {
                const r = byKey.get(k)
                if (!r) return null
                const shown = r.status.tone === 'on' || r.status.tone === 'guests'
                return (
                  <li key={k} data-section={k} className={cn('flex flex-wrap items-center gap-3 px-4 py-3', !shown && 'bg-cream/40')}>
                    <span className="w-6 shrink-0 text-right text-sm tabular-nums text-muted">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('flex flex-wrap items-center gap-2 font-medium', shown ? 'text-ink' : 'text-muted')}>
                        {shown ? <Eye aria-hidden="true" className="size-4 text-sage" /> : <EyeOff aria-hidden="true" className="size-4 text-muted" />}
                        {r.name}
                        {k.startsWith('media:') && <Badge tone="gray">Photos &amp; video</Badge>}
                      </span>
                      <span className="mt-0.5 block text-sm text-muted">
                        {r.status.tone === 'guests' ? <Badge tone="gold">{r.status.text}</Badge> : r.status.tone === 'plan' ? <Badge tone="gray">{r.status.text}</Badge> : r.status.text}
                        {r.status.fix && (
                          <>
                            {' · '}
                            <Link to={r.status.fix.to} className="text-gold underline-offset-4 hover:underline">
                              {r.status.fix.label}
                            </Link>
                          </>
                        )}
                      </span>
                    </span>
                    <span className="flex shrink-0 gap-1">
                      <Button size="sm" variant="ghost" aria-label={`Move ${r.name} up`} disabled={i === 0} onClick={() => move(i, -1)} icon={<ArrowUp aria-hidden="true" className="size-4" />} />
                      <Button size="sm" variant="ghost" aria-label={`Move ${r.name} down`} disabled={i === order.length - 1} onClick={() => move(i, 1)} icon={<ArrowDown aria-hidden="true" className="size-4" />} />
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
          <p className="flex items-center gap-2 border-t border-line bg-cream px-4 py-3 text-sm text-muted">
            <Lock aria-hidden="true" className="size-4" /> Footer (always last)
          </p>
        </section>
        <aside className="space-y-3 xl:sticky xl:top-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg text-ink">Your website</h2>
            <a href={site} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-gold hover:underline">
              Open <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
          </div>
          <div className="overflow-hidden rounded-[1.6rem] border-4 border-ink/80 bg-ivory shadow-soft">
            <iframe key={previewKey} title="Your website" src={site} className="h-[680px] w-full" loading="lazy" />
          </div>
          <p className="text-xs text-muted">Shows the saved order. Press Save order to see changes here.</p>
        </aside>
      </div>
    </>
  )
}
