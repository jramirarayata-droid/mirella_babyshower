import { useCallback, useEffect, useRef, useState } from 'react'
import { useHost } from '../hooks/hostContext'
import { Link } from 'react-router-dom'
import { Camera, Check, ImagePlus, Loader2, Trash2, Tv, X } from 'lucide-react'
import { useWeddingSettings } from '../hooks/useWeddingSettings'
import {
  forgetGuest,
  getGuestPhotosInfo,
  listGuestPhotos,
  myPhotos,
  photoAllowance,
  removeMyPhoto,
  savedGuest,
  startPhotoGuest,
  uploadGuestPhotos,
  type GuestPhoto,
  type GuestPhotosInfo,
  type MyPhoto,
  type PhotoGuest,
} from '../services/guestPhotosService'
import { preparePhoto, type PreparedPhoto } from '../utils/photoPrep'
import { toFriendlyMessage } from '../utils/errors'
import { PublicHeader } from '../components/wedding/PublicHeader'
import { Footer } from '../components/wedding/Footer'
import { CoupleNames } from '../components/wedding/CoupleNames'
import { Lightbox } from '../components/wedding/CoupleGallery'
import { PageLoader } from '../components/ui/Spinner'
import { Ornament } from '../components/ui/Ornament'
import { Button } from '../components/ui/Button'
import { cn } from '../components/ui/cn'
import { PhotoMasonryStrip } from '../components/photos/PhotoMasonryStrip'
import { PetalBurst } from '../components/photos/PetalBurst'
import { suggestGuestName } from '../services/invitationService'
import { forgetKnownGuest, knownGuest, rememberGuest } from '../utils/guestIdentity'

/** Photos are fetched in batches as guests swipe along. */
const PAGE = 30

/** #/photos — guests add their photos from the day, and everyone can browse them. */
export default function GuestPhotos() {
  const { settings } = useWeddingSettings()
  const [info, setInfo] = useState<GuestPhotosInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [photos, setPhotos] = useState<GuestPhoto[]>([])
  const [more, setMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [open, setOpen] = useState<number | null>(null)
  // Photos this guest just added: they glide in with a glow, after a shower of petals.
  const [fresh, setFresh] = useState<Set<string>>(() => new Set())
  const [petals, setPetals] = useState(0)
  const [backToNewest, setBackToNewest] = useState(0)
  const host = useHost()
  const loadingRef = useRef(false)
  const shown = useRef<GuestPhoto[]>([])
  useEffect(() => {
    shown.current = photos
  }, [photos])
  // The glow on just-added photos fades after a moment.
  useEffect(() => {
    if (!fresh.size) return
    const t = window.setTimeout(() => setFresh(new Set()), 7000)
    return () => window.clearTimeout(t)
  }, [fresh])

  useEffect(() => {
    document.title = settings ? `Photos · ${settings.coupleNames}` : 'Photos'
  }, [settings])

  const reload = useCallback(async (celebrate = false) => {
    const [i, list] = await Promise.all([getGuestPhotosInfo(true), listGuestPhotos(null, PAGE)])
    setInfo(i)
    if (celebrate) {
      const had = new Set(shown.current.map((p) => p.id))
      setFresh(new Set(list.filter((p) => !had.has(p.id)).map((p) => p.id)))
    }
    setPhotos(list)
    setMore(list.length === PAGE)
    if (celebrate) setBackToNewest((n) => n + 1)
  }, [])

  const added = useCallback(() => {
    setPetals((n) => n + 1)
    // Let the petals fall first, then the new photos arrive at the top of the wall.
    window.setTimeout(() => {
      void reload(true).then(() => document.getElementById('photo-wall')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }, 900)
  }, [reload])

  useEffect(() => {
    reload().catch((e) => setError(toFriendlyMessage(e)))
  }, [reload])

  const loadMore = useCallback(async () => {
    const last = shown.current.at(-1)
    if (!last || loadingRef.current) return
    loadingRef.current = true
    setLoadingMore(true)
    try {
      const next = await listGuestPhotos(last.at, PAGE)
      setPhotos((p) => [...p, ...next.filter((x) => !p.some((y) => y.id === x.id))])
      setMore(next.length === PAGE)
    } catch (e) {
      setError(toFriendlyMessage(e))
      setMore(false)
    } finally {
      loadingRef.current = false
      setLoadingMore(false)
    }
  }, [])

  return (
    <div className="flex min-h-[100svh] flex-col">
      <PublicHeader />
      <main className="flex flex-1 flex-col items-center px-4 pb-20 pt-10 sm:px-8">
        {settings && (
          <p className="text-center font-serif text-2xl font-light text-ink-soft">
            <CoupleNames names={settings.coupleNames} />
          </p>
        )}
        {!info && !error ? (
          <PageLoader label="Loading the photos" />
        ) : error && !info ? (
          <p className="mt-10 max-w-md text-center text-ink-soft">{error}</p>
        ) : info && !info.visible ? (
          <div className="mt-10 max-w-md text-center">
            <h1 className="text-[2.5rem] leading-tight text-ink sm:text-5xl">Photos</h1>
            <Ornament className="mt-6" />
            <p className="mt-8 leading-relaxed text-ink-soft">The guest photo gallery opens closer to the celebration. Please check back soon.</p>
            <Link to="/" className="mt-6 inline-block text-sm text-gold underline-offset-4 hover:underline">
              Back to the wedding website
            </Link>
          </div>
        ) : info ? (
          <>
            <h1 className="mt-4 text-center text-[2.5rem] leading-tight text-ink sm:text-5xl">{info.title}</h1>
            {info.subtitle && <p className="mx-auto mt-4 max-w-lg text-center text-ink-soft">{info.subtitle}</p>}
            <Ornament className="mt-6" />

            {info.open ? (
              <Uploader info={info} onAdded={added} onChanged={() => void reload()} />
            ) : (
              <p className="mt-8 text-center text-sm text-muted">Adding photos is closed — thank you to everyone who shared!</p>
            )}

            <section id="photo-wall" aria-label="Guest photos" className="-mx-4 mt-12 w-[calc(100%+2rem)] max-w-6xl scroll-mt-6 sm:mx-0 sm:w-full">
              {photos.length === 0 ? (
                <p className="py-10 text-center text-muted">No photos yet{info.open ? ' — be the first to share one!' : '.'}</p>
              ) : (
                <PhotoMasonryStrip
                  photos={photos}
                  style={info.style}
                  fresh={fresh}
                  more={more}
                  loadingMore={loadingMore}
                  onLoadMore={() => void loadMore()}
                  onOpen={setOpen}
                  resetKey={backToNewest}
                  height={[360, 520]}
                />
              )}
            </section>
            {host.isHost && photos.length > 0 && (
              <Link
                to="/present/guests"
                className="mt-10 inline-flex min-h-12 items-center gap-2 rounded-full border border-champagne bg-paper px-6 text-xs font-medium uppercase tracking-[0.25em] text-ink shadow-soft transition hover:bg-champagne-light/40"
              >
                <Tv aria-hidden="true" className="size-4 text-gold" strokeWidth={1.6} /> Present on the big screen
              </Link>
            )}
            {petals > 0 && <PetalBurst key={petals} />}
            <Lightbox images={photos.map((p, i) => ({ id: p.id, imageUrl: p.url, caption: p.by ? `by ${p.by}` : '', sortOrder: i, isVisible: true }))} index={open} onChange={setOpen} />
          </>
        ) : null}
      </main>
      {settings && <Footer coupleNames={settings.coupleNames} weddingDate={settings.weddingDate} closingMessage={settings.closingMessage} />}
    </div>
  )
}

// ---------------------------------------------------------------- adding photos

type Item = { key: string; name: string; state: 'preparing' | 'ready' | 'uploading' | 'done' | 'failed'; prepared?: PreparedPhoto; note?: string }

function Uploader({ info, onAdded, onChanged }: { info: GuestPhotosInfo; onAdded: () => void; onChanged: () => void }) {
  // The photo session follows whoever this phone remembers (if they changed — e.g. RSVP'd as someone else — start fresh).
  const [guest, setGuest] = useState<PhotoGuest | null>(() => {
    const g = savedGuest()
    const k = knownGuest()
    if (g && k && g.name.trim().toLowerCase() !== k.name.trim().toLowerCase()) {
      forgetGuest()
      return null
    }
    return g
  })
  const [left, setLeft] = useState<number | null>(null)
  const [mine, setMine] = useState<MyPhoto[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async (g: PhotoGuest) => {
    const a = await photoAllowance(g.token)
    if (!a.ok) {
      forgetGuest()
      setGuest(null)
      return
    }
    setLeft(a.left)
    setMine(await myPhotos(g.token))
  }, [])

  useEffect(() => {
    if (guest) refresh(guest).catch(() => undefined)
  }, [guest, refresh])

  // Someone else on this phone now (e.g. RSVP'd under another name): follow them.
  useEffect(() => {
    const on = () => {
      const now = savedGuest()
      setGuest((g) => (now && g && now.token === g.token ? g : now))
    }
    window.addEventListener('wedding-guest', on)
    window.addEventListener('storage', on)
    return () => {
      window.removeEventListener('wedding-guest', on)
      window.removeEventListener('storage', on)
    }
  }, [])

  if (!guest) return <WhoAreYou onReady={setGuest} />


  const pick = async (files: FileList | null) => {
    if (!files?.length || left === null) return
    setMessage(null)
    let list = Array.from(files)
    let note = ''
    if (list.length > left) {
      note = left === 0 ? 'You’ve reached your photo limit.' : `You can add ${left} more ${left === 1 ? 'photo' : 'photos'}, so only the first ${left} will be added.`
      list = list.slice(0, left)
    }
    if (!list.length) {
      setMessage({ tone: 'warn', text: note })
      return
    }
    setBusy(true)
    const start: Item[] = list.map((f, i) => ({ key: `${Date.now()}-${i}`, name: f.name, state: 'preparing' }))
    setItems(start)
    // Shrink each photo on the phone first.
    const prepared: (PreparedPhoto | null)[] = []
    for (let i = 0; i < list.length; i++) {
      try {
        const p = await preparePhoto(list[i])
        prepared.push(p)
        setItems((cur) => cur.map((it, j) => (j === i ? { ...it, state: 'ready', prepared: p } : it)))
      } catch {
        prepared.push(null)
        setItems((cur) => cur.map((it, j) => (j === i ? { ...it, state: 'failed', note: 'This photo type can’t be opened here' } : it)))
      }
    }
    const good = prepared.map((p, i) => ({ p, i })).filter((x): x is { p: PreparedPhoto; i: number } => x.p !== null)
    setItems((cur) => cur.map((it) => (it.state === 'ready' ? { ...it, state: 'uploading' } : it)))
    try {
      const res = await uploadGuestPhotos(
        guest.token,
        good.map((x) => ({ full: x.p.full, thumb: x.p.thumb })),
        (done) => setItems((cur) => cur.map((it, j) => (good.slice(0, done).some((x) => x.i === j) && it.state === 'uploading' ? { ...it, state: 'done' } : it))),
      )
      const skipped = list.length - good.length
      const failed = res.failed + skipped
      setMessage({
        tone: failed ? 'warn' : 'ok',
        text:
          res.stopped === 'closed'
            ? 'Adding photos has just closed.'
            : res.stopped === 'full'
              ? 'The gallery is full — thank you!'
              : `${res.added ? `Thank you! ${res.added} ${res.added === 1 ? 'photo' : 'photos'} added${res.status === 'pending' ? ' — they’ll appear once the couple approves them' : ''}.` : ''}${failed ? ` ${failed} couldn’t be added.` : ''}${note ? ` ${note}` : ''}`.trim(),
      })
      if (res.added) onAdded()
    } catch (e) {
      setMessage({ tone: 'warn', text: toFriendlyMessage(e) })
    } finally {
      good.forEach((x) => URL.revokeObjectURL(x.p.previewUrl))
      setBusy(false)
      setItems([])
      await refresh(guest).catch(() => undefined)
      if (input.current) input.current.value = ''
    }
  }

  const remove = async (id: string) => {
    try {
      await removeMyPhoto(guest.token, id)
      setMine((m) => m.filter((x) => x.id !== id))
      onChanged()
      await refresh(guest)
    } catch (e) {
      setMessage({ tone: 'warn', text: toFriendlyMessage(e) })
    }
  }

  const doneCount = items.filter((i) => i.state === 'done').length

  return (
    <section aria-label="Add your photos" className="fine-frame mt-10 w-full max-w-xl rounded-sm bg-paper px-5 py-7 text-center shadow-card sm:px-8">
      <p className="text-ink-soft">
        Hi <span className="font-medium text-ink">{guest.name.split(' ')[0]}</span>!{' '}
        {left === null ? '' : left > 0 ? `You can add ${left} more ${left === 1 ? 'photo' : 'photos'}.` : 'You’ve shared all the photos you can — thank you!'}
      </p>
      <input ref={input} type="file" accept="image/*" multiple className="sr-only" id="guest-photo-input" onChange={(e) => void pick(e.target.files)} disabled={busy || !left} />
      <label
        htmlFor="guest-photo-input"
        className={cn(
          'mt-5 inline-flex min-h-14 cursor-pointer items-center justify-center gap-2.5 rounded-full bg-ink px-8 text-sm font-medium uppercase tracking-[0.2em] text-ivory shadow-soft transition hover:bg-ink-soft',
          (busy || !left) && 'pointer-events-none opacity-50',
        )}
      >
        {busy ? <Loader2 aria-hidden="true" className="size-5 animate-spin" /> : <ImagePlus aria-hidden="true" className="size-5" strokeWidth={1.6} />}
        {busy ? `Adding… ${doneCount}/${items.length}` : 'Add photos'}
      </label>
      <p className="mt-3 text-xs text-muted">Choose several at once. Photos are made smaller on your phone first, so it’s quick even on mobile data.</p>

      {items.length > 0 && (
        <ul className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-5" aria-live="polite">
          {items.map((it) => (
            <li key={it.key} className="relative aspect-square overflow-hidden rounded-sm bg-linen/60">
              {it.prepared && <img src={it.prepared.previewUrl} alt="" className="size-full object-cover" />}
              <span
                className={cn(
                  'absolute inset-0 grid place-items-center',
                  it.state === 'done' ? 'bg-sage/45' : it.state === 'failed' ? 'bg-rose/50' : 'bg-ink/35',
                )}
                title={it.note}
              >
                {it.state === 'done' ? (
                  <Check aria-label="Added" className="size-6 text-white" />
                ) : it.state === 'failed' ? (
                  <X aria-label={it.note ?? 'Couldn’t be added'} className="size-6 text-white" />
                ) : (
                  <Loader2 aria-label="Working" className="size-5 animate-spin text-white" />
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {message && (
        <p role="status" className={cn('mt-4 text-sm', message.tone === 'ok' ? 'text-sage' : 'text-rose')}>
          {message.text}
        </p>
      )}

      {mine.length > 0 && (
        <div className="mt-6 border-t border-line pt-5 text-left">
          <p className="text-xs uppercase tracking-[0.25em] text-muted">Your photos ({mine.length})</p>
          <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
            {mine.map((m) => (
              <li key={m.id} className="group relative aspect-square overflow-hidden rounded-sm bg-linen/60">
                <img src={m.thumbUrl} alt="" loading="lazy" className="size-full object-cover" />
                {m.status === 'pending' && <span className="absolute inset-x-0 bottom-0 bg-ink/60 py-0.5 text-center text-[0.6rem] uppercase tracking-wider text-white">Waiting</span>}
                <button
                  type="button"
                  onClick={() => void remove(m.id)}
                  aria-label="Remove this photo"
                  className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-paper/90 text-ink-soft shadow-soft hover:text-rose"
                >
                  <Trash2 aria-hidden="true" className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          forgetKnownGuest()
          setGuest(null)
        }}
        className="mt-5 text-xs text-muted underline-offset-4 hover:text-ink hover:underline"
      >
        Not {guest.name.split(' ')[0]}? Change name
      </button>
      {info.approval === 'approve' && <p className="mt-2 text-xs text-muted">The couple looks at each photo before it shows in the gallery.</p>}
    </section>
  )
}

function WhoAreYou({ onReady }: { onReady: (g: PhotoGuest) => void }) {
  const [known] = useState(knownGuest)
  const [name, setName] = useState(known?.name ?? '')
  const [busy, setBusy] = useState(false)
  // Already found themselves on this phone (RSVP, invitation, Find My Seat): skip the question.
  const [auto, setAuto] = useState(Boolean(known))
  const [error, setError] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<string | null>(null)

  const start = useCallback(
    async (n: string, quiet = false) => {
      setBusy(true)
      setError(null)
      setSuggestion(null)
      try {
        const r = await startPhotoGuest(n)
        if (r.ok) {
          rememberGuest({ name: r.guest.name })
          onReady(r.guest)
          return
        }
        if (quiet) return
        if (r.reason === 'closed') setError('Adding photos is closed right now.')
        else {
          setError('We couldn’t find that name. Please type your full name as it appears on your invitation.')
          void suggestGuestName(n).then(setSuggestion)
        }
      } catch (e) {
        if (!quiet) setError(toFriendlyMessage(e))
      } finally {
        setBusy(false)
        setAuto(false)
      }
    },
    [onReady],
  )

  useEffect(() => {
    if (known) void start(known.name, true)
  }, [known, start])

  const submit = async () => {
    if (!name.trim() || busy) return
    await start(name)
  }

  if (auto) return <p className="mt-10 text-sm text-muted">One moment…</p>

  return (
    <form
      className="fine-frame mt-10 w-full max-w-md rounded-sm bg-paper px-6 py-7 text-center shadow-card"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <Camera aria-hidden="true" className="mx-auto size-8 text-gold" strokeWidth={1.4} />
      <h2 className="mt-3 text-2xl text-ink">Share your photos</h2>
      <label htmlFor="photo-guest-name" className="mt-2 block text-sm text-ink-soft">
        First, your full name — as it appears on your invitation.
      </label>
      <input
        id="photo-guest-name"
        className="input-base mt-4 text-center"
        autoComplete="name"
        placeholder="e.g. Rina Gaspar"
        value={name}
        maxLength={120}
        onChange={(e) => setName(e.target.value)}
        aria-describedby={error ? 'photo-guest-error' : undefined}
      />
      {error && (
        <p id="photo-guest-error" role="alert" className="mt-2 text-sm text-rose">
          {error}
        </p>
      )}
      {suggestion && error && (
        <p className="mt-2 text-sm text-ink-soft">
          Did you mean{' '}
          <button
            type="button"
            onClick={() => {
              setName(suggestion)
              void start(suggestion)
            }}
            className="font-medium text-ink underline decoration-champagne decoration-2 underline-offset-4 hover:text-gold"
          >
            {suggestion}
          </button>
          ?
        </p>
      )}
      <Button type="submit" className="mt-4" disabled={!name.trim()} loading={busy} loadingText="Checking…">
        Continue
      </Button>
      <p className="mt-3 text-xs text-muted">This phone will remember you, so you only do this once.</p>
    </form>
  )
}
