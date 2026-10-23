import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RevealNote } from '../components/admin/RevealNote'
import QRCode from 'qrcode'
import { Check, Copy, Download, Eye, EyeOff, ExternalLink, QrCode, Trash2, Tv } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import {
  DEFAULT_GUEST_PHOTOS,
  adminListGuestPhotos,
  getGuestPhotoSettings,
  removeGuestPhotos,
  saveGuestPhotoSettings,
  setGuestPhotoStatus,
  type AdminGuestPhoto,
  type GuestPhotoSettings,
} from '../services/guestPhotosService'
import { toFriendlyMessage } from '../utils/errors'
import { formatDateTime, fromManilaParts, toManilaParts } from '../utils/formatting'
import { copyText, siteBaseUrl } from '../utils/share'
import { makeZip } from '../utils/xlsx'
import { downloadBlob } from '../utils/svgImage'
import { PageHeader } from '../components/admin/PageHeader'
import { DriveSaveButton } from '../components/admin/DriveSave'
import { guestPhotoDriveItems } from '../utils/driveItems'
import { useWeddingSettings } from '../hooks/useWeddingSettings'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Skeleton } from '../components/ui/Skeleton'
import { cn } from '../components/ui/cn'
import { SectionWords, smallLine } from '../components/admin/SectionWords'

type Save = 'idle' | 'saving' | 'saved' | 'error'
type Filter = 'all' | 'pending' | 'visible' | 'hidden'
const ZIP_PART = 150

/** Admin → Guest Photos: open the gallery, limits and approval, the QR code, and every photo guests added. */
export default function AdminGuestPhotos() {
  const toast = useToast()
  const [cfg, setCfg] = useState<GuestPhotoSettings | null>(null)
  const { settings: wedding } = useWeddingSettings()
  const couple = wedding?.babyName?.trim() || 'Baby Shower'
  const [save, setSave] = useState<Save>('idle')
  const [photos, setPhotos] = useState<AdminGuestPhoto[] | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [askRemove, setAskRemove] = useState(false)
  const [busy, setBusy] = useState(false)
  const [zipping, setZipping] = useState<string | null>(null)
  const latest = useRef<GuestPhotoSettings>(DEFAULT_GUEST_PHOTOS)
  const timer = useRef<number | undefined>(undefined)

  const load = useCallback(() => adminListGuestPhotos().then(setPhotos), [])

  useEffect(() => {
    document.title = 'Guest Photos · Baby shower admin'
    getGuestPhotoSettings()
      .then((c) => {
        latest.current = c
        setCfg(c)
      })
      .catch((e) => toast.error(toFriendlyMessage(e)))
    load().catch((e) => toast.error(toFriendlyMessage(e)))
    return () => window.clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const update = (patch: Partial<GuestPhotoSettings>) => {
    const next = { ...latest.current, ...patch }
    latest.current = next
    setCfg(next)
    setSave('saving')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      saveGuestPhotoSettings(latest.current)
        .then(() => setSave('saved'))
        .catch(() => setSave('error'))
    }, 600)
  }

  const shown = useMemo(() => (photos ?? []).filter((p) => filter === 'all' || p.status === filter), [photos, filter])
  const counts = useMemo(() => {
    const c = { all: 0, pending: 0, visible: 0, hidden: 0, bytes: 0 }
    for (const p of photos ?? []) {
      c.all++
      c[p.status]++
      c.bytes += p.bytes
    }
    return c
  }, [photos])

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const setStatus = async (status: 'visible' | 'hidden') => {
    const ids = [...selected]
    if (!ids.length) return
    setBusy(true)
    try {
      await setGuestPhotoStatus(ids, status)
      setPhotos((list) => (list ?? []).map((p) => (selected.has(p.id) ? { ...p, status } : p)))
      setSelected(new Set())
      toast.success(`${ids.length} ${ids.length === 1 ? 'photo' : 'photos'} ${status === 'visible' ? 'shown' : 'hidden'}.`)
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    const list = (photos ?? []).filter((p) => selected.has(p.id))
    setBusy(true)
    try {
      await removeGuestPhotos(list)
      setPhotos((all) => (all ?? []).filter((p) => !selected.has(p.id)))
      setSelected(new Set())
      setAskRemove(false)
      toast.success(`${list.length} ${list.length === 1 ? 'photo' : 'photos'} removed.`)
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setBusy(false)
    }
  }

  // Download all: zip files of up to 150 photos each (so phones and laptops don't run out of memory).
  const downloadAll = async () => {
    const list = [...(photos ?? [])].filter((p) => p.status !== 'hidden').reverse()
    if (!list.length) return
    const parts = Math.ceil(list.length / ZIP_PART)
    const enc = new TextEncoder()
    try {
      for (let part = 0; part < parts; part++) {
        const files: { name: string; data: Uint8Array }[] = []
        const slice = list.slice(part * ZIP_PART, (part + 1) * ZIP_PART)
        for (let i = 0; i < slice.length; i++) {
          setZipping(`Preparing ${part * ZIP_PART + i + 1} of ${list.length}…`)
          const p = slice[i]
          const res = await fetch(p.url)
          if (!res.ok) continue
          const who = p.uploaderName.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'guest'
          files.push({ name: `${String(part * ZIP_PART + i + 1).padStart(4, '0')}-${who}.jpg`, data: new Uint8Array(await res.arrayBuffer()) })
        }
        files.push({ name: 'README.txt', data: enc.encode(`Guest photos from the baby shower website.\nPart ${part + 1} of ${parts}, downloaded ${new Date().toLocaleString()}.\n`) })
        const zip = new Blob([makeZip(files)], { type: 'application/zip' })
        downloadBlob(zip, `guest-photos${parts > 1 ? `-part-${part + 1}-of-${parts}` : ''}.zip`)
      }
      toast.success(parts > 1 ? `Downloaded in ${parts} parts.` : 'Downloaded.')
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setZipping(null)
    }
  }

  const link = `${siteBaseUrl()}#/photos`

  return (
    <>
      <PageHeader
        title="Guest Photos"
        description="Guests add their photos from the day on the website. Photos are made smaller on their phones first, to save space."
        actions={
          <div className="flex flex-wrap gap-2">
          <a
            href={`${siteBaseUrl()}#/present/guests`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-paper px-5 text-sm font-medium text-ink transition hover:border-champagne"
          >
            <Tv aria-hidden="true" className="size-4" /> Present slideshow
          </a>
          <Button variant="outline" onClick={() => void downloadAll()} disabled={!counts.all || Boolean(zipping)} loading={Boolean(zipping)} loadingText={zipping ?? 'Preparing…'} icon={<Download aria-hidden="true" className="size-4" />}>
            Download all
          </Button>
          <DriveSaveButton target="guest" folderName={`${couple} — Guest Photos`} loadItems={guestPhotoDriveItems} noun="guest photos" />
          </div>
        }
      />

      {!cfg ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <section className="space-y-4 rounded-xl border border-line bg-paper p-5 shadow-soft">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-xl text-ink">Settings</h2>
              <span className="text-xs text-muted" aria-live="polite">
                {save === 'saving' ? 'Saving…' : save === 'saved' ? 'All changes saved' : save === 'error' ? 'Couldn’t save — please try again' : 'Changes save as you go'}
              </span>
            </div>
            <label className="block text-sm text-ink-soft">
              <span className="font-medium text-ink">Photos page on the website</span>
              <select className="input-base mt-1.5" value={cfg.mode} onChange={(e) => update({ mode: e.target.value as GuestPhotoSettings['mode'] })}>
                <option value="hidden">Hidden</option>
                <option value="visible">Visible</option>
                <option value="scheduled">Visible from a date</option>
                <option value="reveal">On the reveal date</option>
              </select>
            </label>
            {cfg.mode === 'reveal' && <RevealNote />}
            {cfg.mode === 'scheduled' && <DateTime label="Visible from" value={cfg.from} onChange={(from) => update({ from })} />}
            <DateTime label="Stop new photos after (optional)" value={cfg.until} onChange={(until) => update({ until })} clearable hint="The gallery stays up; guests just can’t add more." />

            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium text-ink">When a guest adds a photo</legend>
              {(
                [
                  ['instant', 'Show it straight away', 'You can hide or remove any photo later.'],
                  ['approve', 'Wait for my approval', 'Photos appear only after you show them here.'],
                ] as const
              ).map(([v, label, hint]) => (
                <label key={v} className={cn('relative flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm', cfg.approval === v ? 'border-champagne bg-champagne-light/30' : 'border-line')}>
                  <input type="radio" name="gp-approval" className="mt-0.5 size-4 accent-ink" checked={cfg.approval === v} onChange={() => update({ approval: v })} />
                  <span>
                    <span className="font-medium text-ink">{label}</span>
                    <span className="mt-0.5 block text-muted">{hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium text-ink">How photos look in the gallery</legend>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['classic', 'Classic', 'Edge to edge, a clean photo wall.'],
                    ['polaroid', 'Polaroid', 'White frames, a slight tilt, and the guest’s name underneath.'],
                  ] as const
                ).map(([v, label, hint]) => (
                  <label key={v} className={cn('relative flex cursor-pointer flex-col gap-2 rounded-lg border p-3 text-sm', cfg.style === v ? 'border-champagne bg-champagne-light/30' : 'border-line')}>
                    <span aria-hidden="true" className="flex h-14 items-center justify-center gap-1.5">
                      {[0, 1, 2].map((k) =>
                        v === 'polaroid' ? (
                          <span key={k} className="block bg-white p-1 pb-3 shadow-soft" style={{ rotate: `${[-4, 2, -1][k]}deg` }}>
                            <span className="block size-7 bg-linen" />
                          </span>
                        ) : (
                          <span key={k} className="block h-10 w-8 rounded-[2px] bg-linen" />
                        ),
                      )}
                    </span>
                    <span className="flex items-start gap-2">
                      <input type="radio" name="gp-style" className="mt-0.5 size-4 accent-ink" checked={cfg.style === v} onChange={() => update({ style: v })} />
                      <span>
                        <span className="font-medium text-ink">{label}</span>
                        <span className="mt-0.5 block text-xs text-muted">{hint}</span>
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm text-ink-soft">
                <span className="font-medium text-ink">Photos per guest</span>
                <input type="number" min={1} max={200} className="input-base mt-1.5" value={cfg.perGuest} onChange={(e) => update({ perGuest: Math.min(200, Math.max(1, Math.round(Number(e.target.value)) || 1)) })} />
              </label>
              <label className="block text-sm text-ink-soft">
                <span className="font-medium text-ink">Photos in total</span>
                <input type="number" min={10} max={5000} className="input-base mt-1.5" value={cfg.total} onChange={(e) => update({ total: Math.min(5000, Math.max(10, Math.round(Number(e.target.value)) || 10)) })} />
              </label>
            </div>
            <p className="text-xs text-muted">
              Each photo takes about 0.4 MB. {cfg.total.toLocaleString()} photos ≈ {Math.round(cfg.total * 0.43).toLocaleString()} MB of storage.
            </p>

            <label className="block text-sm text-ink-soft">
              <span className="font-medium text-ink">Title</span>
              <input className="input-base mt-1.5" maxLength={80} value={cfg.title} onChange={(e) => update({ title: e.target.value })} />
            </label>
            <label className="block text-sm text-ink-soft">
              <span className="font-medium text-ink">Message</span>
              <textarea className="input-base mt-1.5" rows={2} maxLength={200} value={cfg.subtitle} onChange={(e) => update({ subtitle: e.target.value })} />
            </label>
            <SectionWords
              sectionKey="guestPhotos"
              fields={[smallLine('From our guests'), { field: 'addButton', label: 'Button to add photos', usual: 'Add your photos' }, { field: 'seeAll', label: 'Link to all photos', usual: 'See all photos' }]}
            />
          </section>

          <div className="space-y-6">
            <ShareCard link={link} visible={cfg.mode !== 'hidden'} />
            <section className="grid grid-cols-3 gap-2 text-center">
              {[
                ['Photos', counts.all],
                ['Waiting', counts.pending],
                ['Storage', `${(counts.bytes / 1048576).toFixed(counts.bytes > 104857600 ? 0 : 1)} MB`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-line bg-paper px-3 py-4 shadow-soft">
                  <p className="text-2xl text-ink">{value}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted">{label}</p>
                </div>
              ))}
            </section>
          </div>
        </div>
      )}

      <section className="mt-6 rounded-xl border border-line bg-paper p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="Show" className="inline-flex flex-wrap gap-1 rounded-lg bg-cream p-1">
            {(
              [
                ['all', 'All'],
                ['pending', 'Waiting'],
                ['visible', 'Shown'],
                ['hidden', 'Hidden'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={filter === id}
                onClick={() => {
                  setFilter(id)
                  setSelected(new Set())
                }}
                className={cn('rounded-md px-3 py-1.5 text-sm transition', filter === id ? 'bg-paper text-ink shadow-soft' : 'text-muted hover:text-ink')}
              >
                {label} <span className="tabular-nums text-muted">({counts[id]})</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {shown.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setSelected(selected.size === shown.length ? new Set() : new Set(shown.map((p) => p.id)))}>
                {selected.size === shown.length ? 'Clear selection' : 'Select all'}
              </Button>
            )}
            <Button size="sm" variant="outline" disabled={!selected.size || busy} onClick={() => void setStatus('visible')} icon={<Eye aria-hidden="true" className="size-3.5" />}>
              Show
            </Button>
            <Button size="sm" variant="outline" disabled={!selected.size || busy} onClick={() => void setStatus('hidden')} icon={<EyeOff aria-hidden="true" className="size-3.5" />}>
              Hide
            </Button>
            <Button size="sm" variant="danger-quiet" disabled={!selected.size || busy} onClick={() => setAskRemove(true)} icon={<Trash2 aria-hidden="true" className="size-3.5" />}>
              Remove
            </Button>
          </div>
        </div>

        {photos === null ? (
          <Skeleton className="mt-4 h-48" />
        ) : shown.length === 0 ? (
          <p className="mt-6 text-sm text-muted">{counts.all ? 'No photos here.' : 'No guest photos yet. Turn the photos page on and share the link or QR code.'}</p>
        ) : (
          <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
            {shown.map((p) => {
              const on = selected.has(p.id)
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => toggle(p.id)}
                    aria-pressed={on}
                    aria-label={`Photo by ${p.uploaderName}, ${p.status === 'pending' ? 'waiting' : p.status}`}
                    className={cn('relative block aspect-square w-full overflow-hidden rounded-md bg-linen/60 ring-offset-2 ring-offset-paper', on && 'ring-2 ring-gold')}
                  >
                    <img src={p.thumbUrl} alt="" loading="lazy" className={cn('size-full object-cover', p.status === 'hidden' && 'opacity-40 grayscale')} />
                    {p.status !== 'visible' && (
                      <span className="absolute left-1 top-1 rounded bg-ink/70 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wider text-white">{p.status === 'pending' ? 'Waiting' : 'Hidden'}</span>
                    )}
                    {on && (
                      <span className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-gold text-white">
                        <Check aria-hidden="true" className="size-4" />
                      </span>
                    )}
                  </button>
                  <p className="mt-1 truncate text-[0.7rem] text-ink-soft" title={`${p.uploaderName} · ${formatDateTime(p.createdAt)}`}>
                    {p.uploaderName}
                  </p>
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-[0.65rem] text-gold underline-offset-2 hover:underline">
                    Open
                  </a>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={askRemove}
        title={`Remove ${selected.size} ${selected.size === 1 ? 'photo' : 'photos'}?`}
        message="They’re deleted for good, to free up space. To keep them, use Download all first — or Hide them instead."
        confirmLabel="Remove"
        destructive
        loading={busy}
        loadingText="Removing…"
        onCancel={() => !busy && setAskRemove(false)}
        onConfirm={() => void remove()}
      />
    </>
  )
}

function DateTime({ label, value, onChange, clearable, hint }: { label: string; value: string | null; onChange: (v: string | null) => void; clearable?: boolean; hint?: string }) {
  const parts = value ? toManilaParts(value) : { date: '', time: '' }
  return (
    <div className="text-sm text-ink-soft">
      <span className="font-medium text-ink">{label}</span>
      <div className="mt-1.5 grid grid-cols-[1fr_1fr_auto] gap-2">
        <input type="date" className="input-base" aria-label={`${label} — date`} value={parts.date} onChange={(e) => onChange(e.target.value ? fromManilaParts(e.target.value, parts.time || '00:00') : null)} />
        <input type="time" className="input-base" aria-label={`${label} — time`} value={parts.time} onChange={(e) => parts.date && onChange(fromManilaParts(parts.date, e.target.value || '00:00'))} />
        {clearable && value ? (
          <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
            Clear
          </Button>
        ) : (
          <span />
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-muted">{hint} Philippine time.</p>}
    </div>
  )
}

function ShareCard({ link, visible }: { link: string; visible: boolean }) {
  const toast = useToast()
  const [svg, setSvg] = useState('')
  useEffect(() => {
    QRCode.toString(link, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#2b2a28', light: '#ffffff' } })
      .then(setSvg)
      .catch(() => setSvg(''))
  }, [link])

  const downloadQr = async () => {
    const data = await QRCode.toDataURL(link, { width: 1200, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#2b2a28', light: '#ffffff' } })
    const blob = await (await fetch(data)).blob()
    downloadBlob(blob, 'guest-photos-qr.png')
  }

  return (
    <section className="space-y-3 rounded-xl border border-line bg-paper p-5 shadow-soft">
      <h2 className="flex items-center gap-2 text-xl text-ink">
        <QrCode aria-hidden="true" className="size-5 text-gold" strokeWidth={1.6} /> Link & QR code
      </h2>
      <p className="text-sm text-muted">Print the QR code on table cards or a sign — guests scan it and add their photos.</p>
      {!visible && <p className="text-xs text-gold">The photos page is hidden — turn it on in Settings first.</p>}
      <div className="flex flex-wrap items-center gap-4">
        {svg && <div className="size-32 shrink-0 rounded-md border border-line bg-white p-1.5" aria-label="QR code for the photos page" dangerouslySetInnerHTML={{ __html: svg }} />}
        <div className="min-w-0 flex-1 space-y-2">
          <input readOnly className="input-base text-xs" value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Photos page link" />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => void copyText(link).then((ok) => ok && toast.success('Link copied.'))} icon={<Copy aria-hidden="true" className="size-3.5" />}>
              Copy link
            </Button>
            <Button size="sm" variant="outline" onClick={() => void downloadQr()} icon={<Download aria-hidden="true" className="size-3.5" />}>
              QR code (PNG)
            </Button>
            <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 px-2 text-sm text-gold underline-offset-4 hover:underline">
              <ExternalLink aria-hidden="true" className="size-3.5" /> Open
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
