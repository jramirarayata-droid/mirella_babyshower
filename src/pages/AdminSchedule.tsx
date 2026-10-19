import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Armchair, CalendarClock, Camera, Gift, Heart, Mail, Music } from 'lucide-react'
import { PageHeader } from '../components/admin/PageHeader'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { cn } from '../components/ui/cn'
import { useToast } from '../hooks/useToast'
import { useWeddingSettings } from '../hooks/useWeddingSettings'
import { getGuestPhotoSettings, saveGuestPhotoSettings, type GuestPhotoSettings } from '../services/guestPhotosService'
import { getMusicSettings, type MusicSettings } from '../services/musicService'
import { getRaffleSettings, saveRaffleSettings, type RaffleSettings } from '../services/raffleService'
import { getSchedule, saveSchedule, timingOn } from '../services/scheduleService'
import { saveSeatingConfig } from '../services/seatingService'
import { isRsvpOpen } from '../services/settingsService'
import { formatDateTime, formatWeddingDate, fromManilaParts, toManilaParts } from '../utils/formatting'
import { toFriendlyMessage } from '../utils/errors'
import { useUnsavedChanges } from '../hooks/unsavedChanges'
import { SaveStatus } from '../components/ui/SaveStatus'

type Feature = 'raffle' | 'seat' | 'photos'

/**
 * One place to see when everything appears for guests, and one "reveal date"
 * the raffle, Find My Seat and guest photos can follow.
 */
export default function AdminSchedule() {
  const toast = useToast()
  const { settings, refresh } = useWeddingSettings()
  const [revealAt, setRevealAt] = useState<string | null | undefined>(undefined)
  const [draft, setDraft] = useState({ date: '', time: '09:00' })
  const [raffle, setRaffle] = useState<RaffleSettings | null>(null)
  const [photos, setPhotos] = useState<GuestPhotoSettings | null>(null)
  const [music, setMusic] = useState<MusicSettings | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [s, r, p, m] = await Promise.all([getSchedule(), getRaffleSettings(), getGuestPhotoSettings(), getMusicSettings().catch(() => null)])
    setRevealAt(s.revealAt)
    setDraft(s.revealAt ? toManilaParts(s.revealAt) : { date: '', time: '09:00' })
    setRaffle(r)
    setPhotos(p)
    setMusic(m)
  }, [])

  useEffect(() => {
    load().catch((e) => toast.error(toFriendlyMessage(e)))
  }, [load, toast])

  const draftIso = draft.date ? fromManilaParts(draft.date, draft.time || '00:00') : null
  const dirty = revealAt !== undefined && draftIso !== revealAt
  useUnsavedChanges(dirty, 'the reveal date')

  const saveReveal = async (value: string | null) => {
    setBusy('reveal')
    try {
      await saveSchedule({ revealAt: value })
      setRevealAt(value)
      if (!value) setDraft({ date: '', time: '09:00' })
      toast.success(value ? 'Reveal date saved.' : 'Reveal date cleared.')
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const follow = async (f: Feature) => {
    if (!settings) return
    setBusy(f)
    try {
      if (f === 'raffle') {
        const fresh = await getRaffleSettings()
        await saveRaffleSettings({ ...fresh, mode: 'reveal' })
        setRaffle({ ...fresh, mode: 'reveal' })
      } else if (f === 'photos') {
        const fresh = await getGuestPhotoSettings()
        await saveGuestPhotoSettings({ ...fresh, mode: 'reveal' })
        setPhotos({ ...fresh, mode: 'reveal' })
      } else {
        await saveSeatingConfig(settings.id, { ...settings.seatingConfig, finder: { ...settings.seatingConfig.finder, mode: 'reveal', from: null } })
        await refresh()
      }
      toast.success('Now follows the reveal date.')
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const loading = revealAt === undefined || !settings || !raffle || !photos
  const finder = settings?.seatingConfig.finder

  return (
    <>
      <PageHeader title="Schedule" description="When each part of the website appears for guests — all in one place." />
      {loading ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
          <Skeleton className="h-56" />
          <Skeleton className="h-96" />
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
          <section className="space-y-3 rounded-xl border border-line bg-paper p-5 shadow-soft">
            <h2 className="flex items-center gap-2 text-xl text-ink">
              <CalendarClock aria-hidden="true" className="size-5 text-gold" strokeWidth={1.6} /> Reveal date
            </h2>
            <p className="text-sm text-muted">
              Set it once. Anything set to <b className="font-medium text-ink">“On the reveal date”</b> appears at this moment — move the date and they all move with it.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" className="input-base" aria-label="Reveal date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} />
              <input type="time" className="input-base" aria-label="Reveal time (Philippine time)" value={draft.time} onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))} />
            </div>
            <p className="text-xs text-muted">Philippine time.{settings && ` Your wedding is ${formatWeddingDate(settings.weddingDate)}.`}</p>
            <div className="flex flex-wrap items-center gap-2">
              <SaveStatus dirty={dirty} saving={busy === 'reveal'} />
              <Button onClick={() => void saveReveal(draftIso)} disabled={!dirty || !draftIso} loading={busy === 'reveal'} loadingText="Saving…">
                Save
              </Button>
              {revealAt && (
                <Button variant="ghost" onClick={() => void saveReveal(null)} disabled={busy === 'reveal'}>
                  Clear
                </Button>
              )}
              {settings && !draft.date && (
                <Button variant="outline" onClick={() => setDraft({ date: settings.weddingDate, time: '17:00' })}>
                  Use the wedding day
                </Button>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-line bg-paper p-5 shadow-soft">
            <h2 className="text-xl text-ink">What guests see, and when</h2>
            <ul className="mt-3 divide-y divide-line">
              {settings && (
                <Row
                  icon={Heart}
                  title="Wedding website"
                  status={{ on: true, text: 'Always showing' }}
                  detail={`Wedding day: ${formatWeddingDate(settings.weddingDate)}. On the day, the top of the page shows Find my seat, Photos and the details.`}
                  to="/admin/settings"
                />
              )}
              {settings && (
                <Row
                  icon={Mail}
                  title="RSVP"
                  status={{ on: isRsvpOpen(settings), text: isRsvpOpen(settings) ? (settings.rsvpDeadline ? `Open until ${formatDateTime(settings.rsvpDeadline)}` : 'Open') : 'Closed' }}
                  to="/admin/settings"
                />
              )}
              {finder && (
                <Row
                  icon={Armchair}
                  title="Find My Seat"
                  status={describe(finder.mode, finder.from, revealAt ?? null)}
                  to="/admin/seating"
                  onFollow={finder.mode === 'reveal' ? undefined : () => void follow('seat')}
                  busy={busy === 'seat'}
                />
              )}
              {raffle && (
                <Row
                  icon={Gift}
                  title="Raffle"
                  status={describe(raffle.mode, raffle.from, revealAt ?? null)}
                  to="/admin/raffle"
                  onFollow={raffle.mode === 'reveal' ? undefined : () => void follow('raffle')}
                  busy={busy === 'raffle'}
                />
              )}
              {photos && (
                <Row
                  icon={Camera}
                  title="Guest photos"
                  status={describe(photos.mode, photos.from, revealAt ?? null)}
                  detail={photos.until ? `New photos stop ${formatDateTime(photos.until)}.` : undefined}
                  to="/admin/guest-photos"
                  onFollow={photos.mode === 'reveal' ? undefined : () => void follow('photos')}
                  busy={busy === 'photos'}
                />
              )}
              {music && (
                <Row icon={Music} title="Music" status={{ on: music.enabled && Boolean(music.url), text: music.enabled && music.url ? 'Playing on the website' : 'Off' }} to="/admin/music" />
              )}
            </ul>
          </section>
        </div>
      )}
    </>
  )
}

function describe(mode: string, from: string | null, revealAt: string | null): { on: boolean; text: string } {
  const on = timingOn(mode, from, revealAt)
  if (mode === 'visible') return { on, text: 'Showing now' }
  if (mode === 'scheduled') return { on, text: on ? 'Showing now' : from ? `From ${formatDateTime(from)}` : 'No date set' }
  if (mode === 'reveal') return { on, text: on ? 'Showing now (revealed)' : revealAt ? `On the reveal date · ${formatDateTime(revealAt)}` : 'On the reveal date · not set yet' }
  return { on: false, text: 'Hidden' }
}

function Row({
  icon: Icon,
  title,
  status,
  detail,
  to,
  onFollow,
  busy,
}: {
  icon: typeof Heart
  title: string
  status: { on: boolean; text: string }
  detail?: string
  to: string
  onFollow?: () => void
  busy?: boolean
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-champagne-light/60 text-gold">
        <Icon aria-hidden="true" className="size-4" strokeWidth={1.6} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">{title}</p>
        <p className="flex items-center gap-1.5 text-sm">
          <span aria-hidden="true" className={cn('inline-block size-2 rounded-full', status.on ? 'bg-sage' : 'bg-line')} />
          <span className={status.on ? 'text-ink-soft' : 'text-muted'}>{status.text}</span>
        </p>
        {detail && <p className="mt-0.5 text-xs text-muted">{detail}</p>}
      </div>
      <div className="flex shrink-0 gap-1">
        {onFollow && (
          <Button size="sm" variant="ghost" onClick={onFollow} loading={busy} loadingText="Saving…">
            Follow reveal date
          </Button>
        )}
        <Link to={to} className="inline-flex min-h-9 items-center rounded-lg px-3 text-sm text-gold underline-offset-4 hover:underline">
          Change
        </Link>
      </div>
    </li>
  )
}
