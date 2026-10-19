import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Film, Images } from 'lucide-react'
import { getWeddingSettings, orderMedia, updateMediaOrder } from '../../services/settingsService'
import { listMediaSections, reorderMediaSections } from '../../services/mediaSectionsService'
import { useToast } from '../../hooks/useToast'
import { toFriendlyMessage } from '../../utils/errors'
import { Badge } from '../ui/Badge'
import { cn } from '../ui/cn'

interface Item {
  key: string
  title: string
  kind: 'photos' | 'video'
  main: boolean
  hidden: boolean
}

/**
 * The order of every photo and video section on the home page — the main
 * gallery and film included — with up / down buttons. Saved right away.
 */
export function MediaOrderCard() {
  const toast = useToast()
  const [items, setItems] = useState<Item[] | null>(null)
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    try {
      const [s, sections] = await Promise.all([getWeddingSettings(), listMediaSections()])
      setSettingsId(s.id)
      const all: Item[] = [
        { key: 'gallery', title: s.galleryTitle || 'Photo gallery', kind: 'photos', main: true, hidden: !s.galleryVisible },
        { key: 'video', title: s.videoTitle || 'Video', kind: 'video', main: true, hidden: !s.videoVisible || !s.videoUrl },
        ...sections.map((x) => ({ key: x.id, title: x.title || (x.kind === 'video' ? 'Video section' : 'Photo section'), kind: x.kind, main: false, hidden: !x.isVisible })),
      ]
      setItems(orderMedia(all, s.mediaOrder ?? []))
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    }
  }, [toast])

  useEffect(() => {
    void load()
    const again = () => void load()
    window.addEventListener('media-sections-changed', again)
    return () => window.removeEventListener('media-sections-changed', again)
  }, [load])

  const move = async (i: number, dir: -1 | 1) => {
    if (!items || !settingsId || saving) return
    const j = i + dir
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[i], next[j]] = [next[j], next[i]]
    const prev = items
    setItems(next)
    setSaving(true)
    setSaved(false)
    try {
      await updateMediaOrder(
        settingsId,
        next.map((x) => x.key),
      )
      const sectionIds = next.filter((x) => !x.main).map((x) => x.key)
      if (sectionIds.length) await reorderMediaSections(sectionIds)
      setSaved(true)
    } catch (e) {
      setItems(prev)
      toast.error(toFriendlyMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby="media-order-heading" className="mb-6 rounded-xl border border-line bg-paper p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="media-order-heading" className="text-2xl text-ink">
          Order on your website
        </h2>
        <p aria-live="polite" className={cn('text-xs', saving ? 'text-muted' : saved ? 'text-sage' : 'text-muted')}>
          {saving ? 'Saving…' : saved ? 'Saved — your website shows this order' : 'Top = first on the home page'}
        </p>
      </div>
      {!items ? (
        <p className="mt-3 text-sm text-muted">Loading…</p>
      ) : (
        <ol aria-label="Photo and video sections, in order" className="mt-4 divide-y divide-line rounded-lg border border-line">
          {items.map((it, i) => (
            <li key={it.key} className="flex items-center gap-3 px-3 py-2.5">
              <span className="w-5 text-right text-sm tabular-nums text-muted">{i + 1}</span>
              {it.kind === 'video' ? <Film aria-hidden="true" className="size-4 shrink-0 text-gold" /> : <Images aria-hidden="true" className="size-4 shrink-0 text-gold" />}
              <span className={cn('min-w-0 flex-1 truncate text-sm', it.hidden ? 'text-muted' : 'text-ink')}>{it.title}</span>
              {it.main && <Badge tone="gray">Main</Badge>}
              {it.hidden && <Badge tone="gray">Hidden</Badge>}
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  aria-label={`Move “${it.title}” up`}
                  disabled={i === 0 || saving}
                  onClick={() => void move(i, -1)}
                  className="grid size-9 place-items-center rounded-md border border-line text-ink-soft transition hover:bg-cream disabled:opacity-30"
                >
                  <ArrowUp aria-hidden="true" className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Move “${it.title}” down`}
                  disabled={i === items.length - 1 || saving}
                  onClick={() => void move(i, 1)}
                  className="grid size-9 place-items-center rounded-md border border-line text-ink-soft transition hover:bg-cream disabled:opacity-30"
                >
                  <ArrowDown aria-hidden="true" className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
