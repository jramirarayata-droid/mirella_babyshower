import { useCallback, useEffect, useRef, useState } from 'react'
import { Music, Pause, Play, SkipForward, Trash2, Upload } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import { DEFAULT_MUSIC, MAX_SONG_MB, MUSIC_PAGES, getMusicSettings, removeSongFile, saveMusicSettings, uploadSong, type MusicSettings } from '../services/musicService'
import { SegmentPlayer, mmss, parseMmss } from '../utils/segmentPlayer'
import { toFriendlyMessage } from '../utils/errors'
import { PageHeader } from '../components/admin/PageHeader'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Skeleton } from '../components/ui/Skeleton'
import { cn } from '../components/ui/cn'

type Save = 'idle' | 'saving' | 'saved' | 'error'
const BARS = 300

/** Admin → Music: a song that plays on the wedding website — the part to play, fades, loop, volume and pages. */
export default function AdminMusic() {
  const toast = useToast()
  const [cfg, setCfg] = useState<MusicSettings | null>(null)
  const [save, setSave] = useState<Save>('idle')
  const [uploading, setUploading] = useState(false)
  const [peaks, setPeaks] = useState<number[] | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [now, setNow] = useState(0)
  const [askRemove, setAskRemove] = useState(false)
  const latest = useRef<MusicSettings>(DEFAULT_MUSIC)
  const timer = useRef<number | undefined>(undefined)
  const player = useRef<SegmentPlayer | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.title = 'Music · Baby shower admin'
    getMusicSettings()
      .then((c) => {
        latest.current = c
        setCfg(c)
      })
      .catch((e) => toast.error(toFriendlyMessage(e)))
    return () => {
      window.clearTimeout(timer.current)
      player.current?.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const persist = useCallback((next: MusicSettings, immediate = false) => {
    latest.current = next
    setCfg(next)
    setSave('saving')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(
      () => {
        saveMusicSettings(latest.current)
          .then(() => setSave('saved'))
          .catch(() => setSave('error'))
      },
      immediate ? 0 : 600,
    )
  }, [])
  const update = (patch: Partial<MusicSettings>) => persist({ ...latest.current, ...patch })

  // The waveform, drawn from the song itself.
  const url = cfg?.url
  useEffect(() => {
    if (!url) {
      setPeaks(null)
      return
    }
    let alive = true
    setPeaks(null)
    ;(async () => {
      const buf = await (await fetch(url)).arrayBuffer()
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      const ctx = new AC()
      const audio = await ctx.decodeAudioData(buf)
      void ctx.close()
      const data = audio.getChannelData(0)
      const step = Math.floor(data.length / BARS)
      const out: number[] = []
      for (let i = 0; i < BARS; i++) {
        let max = 0
        for (let j = i * step; j < (i + 1) * step; j += 16) max = Math.max(max, Math.abs(data[j]))
        out.push(max)
      }
      const top = Math.max(...out, 0.01)
      if (!alive) return
      setPeaks(out.map((v) => v / top))
      if (Math.abs(latest.current.duration - audio.duration) > 0.5) persist({ ...latest.current, duration: audio.duration }, true)
    })().catch(() => alive && setPeaks([]))
    return () => {
      alive = false
    }
  }, [url, persist])

  // Preview player follows the settings.
  useEffect(() => {
    if (!cfg?.url) return
    const opts = { url: cfg.url, start: cfg.start, end: cfg.end, fadeIn: cfg.fadeIn, fadeOut: cfg.fadeOut, loop: cfg.loop, volume: cfg.volume }
    if (!player.current) {
      player.current = new SegmentPlayer(opts)
      player.current.onChange = setPreviewing
    } else player.current.update(opts)
  }, [cfg])

  useEffect(() => {
    if (!previewing) return
    let raf = 0
    const loop = () => {
      setNow(player.current?.time ?? 0)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [previewing])

  const onFile = async (file: File | undefined) => {
    if (!file || !cfg) return
    setUploading(true)
    try {
      player.current?.destroy()
      player.current = null
      const { url, path } = await uploadSong(file)
      const old = cfg.path
      persist({ ...latest.current, url, path, title: file.name.replace(/\.[^.]+$/, ''), duration: 0, start: 0, end: null }, true)
      if (old) void removeSongFile(old)
      toast.success('Song uploaded. Now choose the part to play.')
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const removeSong = async () => {
    if (!cfg) return
    player.current?.destroy()
    player.current = null
    const old = cfg.path
    persist({ ...DEFAULT_MUSIC }, true)
    setAskRemove(false)
    if (old) await removeSongFile(old)
    toast.success('Song removed.')
  }

  if (!cfg) {
    return (
      <>
        <PageHeader title="Music" />
        <Skeleton className="h-96" />
      </>
    )
  }

  const duration = cfg.duration || 0
  const end = cfg.end ?? duration
  const length = Math.max(0, end - cfg.start)

  return (
    <>
      <PageHeader
        title="Music"
        description="A song that plays softly on the website. Browsers only allow sound after a tap, so it starts when a guest first taps — like opening the envelope."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <section className="space-y-5 rounded-xl border border-line bg-paper p-5 shadow-soft sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-champagne-light/60 text-gold">
                <Music aria-hidden="true" className="size-5" strokeWidth={1.6} />
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{cfg.title || 'No song yet'}</p>
                <p className="text-xs text-muted">{cfg.url ? (duration ? `${mmss(duration)} long` : 'Reading the song…') : `MP3 or M4A, up to ${MAX_SONG_MB} MB`}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <input tabIndex={-1} ref={fileInput} type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,.mp3,.m4a" className="sr-only" id="song-file" onChange={(e) => void onFile(e.target.files?.[0])} />
              <Button variant="outline" onClick={() => fileInput.current?.click()} loading={uploading} loadingText="Uploading…" icon={<Upload aria-hidden="true" className="size-4" />}>
                {cfg.url ? 'Replace song' : 'Upload a song'}
              </Button>
              {cfg.url && (
                <Button variant="danger-quiet" onClick={() => setAskRemove(true)} icon={<Trash2 aria-hidden="true" className="size-4" />} aria-label="Remove the song" />
              )}
            </div>
          </div>

          {cfg.url && (
            <>
              <Waveform peaks={peaks} duration={duration} start={cfg.start} end={end} now={previewing ? now : null} />
              {duration > 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <TimeControl
                    label="Start at"
                    value={cfg.start}
                    max={duration}
                    onChange={(v) => update({ start: Math.min(v, end - 5) })}
                  />
                  <TimeControl label="End at" value={end} max={duration} onChange={(v) => update({ end: v >= duration - 0.5 ? null : Math.max(v, cfg.start + 5) })} />
                </div>
              )}
              <p className="text-sm text-ink-soft">
                Plays <span className="font-medium text-ink">{mmss(cfg.start)} → {mmss(end)}</span> ({mmss(length)}){cfg.loop ? ', then starts again.' : ', once.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => (previewing ? player.current?.stop(0.4) : void player.current?.play(true))}
                  icon={previewing ? <Pause aria-hidden="true" className="size-4" /> : <Play aria-hidden="true" className="size-4" />}
                >
                  {previewing ? 'Stop' : 'Preview'}
                </Button>
                <Button variant="outline" onClick={() => void player.current?.playFrom(end - cfg.fadeOut - 5)} icon={<SkipForward aria-hidden="true" className="size-4" />}>
                  Hear the ending
                </Button>
              </div>
            </>
          )}
        </section>

        <aside className="space-y-5">
          <section className="space-y-4 rounded-xl border border-line bg-paper p-5 shadow-soft">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-xl text-ink">Settings</h2>
              <span className="text-xs text-muted" aria-live="polite">
                {save === 'saving' ? 'Saving…' : save === 'saved' ? 'Saved' : save === 'error' ? 'Couldn’t save' : ''}
              </span>
            </div>
            <label className="flex cursor-pointer items-start justify-between gap-3 text-sm">
              <span>
                <span className="font-medium text-ink">Play music on the website</span>
                <span className="block text-xs text-muted">{cfg.url ? 'Guests can turn it off with the ♪ button.' : 'Upload a song first.'}</span>
              </span>
              <input type="checkbox" className="mt-0.5 size-5 accent-ink" checked={cfg.enabled} disabled={!cfg.url} onChange={(e) => update({ enabled: e.target.checked })} />
            </label>
            <label className="flex cursor-pointer items-start justify-between gap-3 text-sm">
              <span>
                <span className="font-medium text-ink">Play automatically</span>
                <span className="block text-xs text-muted">Starts as soon as the page opens when the browser allows it. Phones and most first visits still wait for a tap.</span>
              </span>
              <input type="checkbox" className="mt-0.5 size-5 accent-ink" checked={cfg.autoplay} onChange={(e) => update({ autoplay: e.target.checked })} />
            </label>
            <label className="flex cursor-pointer items-start justify-between gap-3 text-sm">
              <span>
                <span className="font-medium text-ink">“Tap to enter” welcome screen</span>
                <span className="block text-xs text-muted">Home page opens with your names and a Tap to enter button — that tap starts the music on every phone. Once per visit.</span>
              </span>
              <input type="checkbox" className="mt-0.5 size-5 accent-ink" checked={cfg.welcome} onChange={(e) => update({ welcome: e.target.checked })} />
            </label>
            <label className="flex cursor-pointer items-start justify-between gap-3 text-sm">
              <span>
                <span className="font-medium text-ink">Repeat</span>
                <span className="block text-xs text-muted">Start the part again when it ends.</span>
              </span>
              <input type="checkbox" className="mt-0.5 size-5 accent-ink" checked={cfg.loop} onChange={(e) => update({ loop: e.target.checked })} />
            </label>
            <Slider label="Volume" value={Math.round(cfg.volume * 100)} min={5} max={100} unit="%" onChange={(v) => update({ volume: v / 100 })} />
            <Slider label="Fade in" value={cfg.fadeIn} min={0} max={10} unit=" s" onChange={(v) => update({ fadeIn: v })} />
            <Slider label="Fade out" value={cfg.fadeOut} min={0} max={10} unit=" s" onChange={(v) => update({ fadeOut: v })} />
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-ink">Plays on</legend>
              <div className="space-y-1.5">
                {MUSIC_PAGES.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-soft">
                    <input
                      type="checkbox"
                      className="size-4 accent-ink"
                      checked={cfg.pages.includes(p.id)}
                      onChange={(e) => update({ pages: e.target.checked ? [...cfg.pages, p.id] : cfg.pages.filter((x) => x !== p.id) })}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">Never on the raffle (it has its own sounds) or in the admin.</p>
            </fieldset>
          </section>
          <p className="px-1 text-xs leading-relaxed text-muted">
            Guests download only the part that plays, and only once they tap. A popular song can occasionally draw a copyright complaint — a royalty-free track or your own recording avoids that.
          </p>
        </aside>
      </div>

      <ConfirmDialog
        open={askRemove}
        title="Remove the song?"
        message="The music stops on the website and the file is deleted."
        confirmLabel="Remove"
        destructive
        onCancel={() => setAskRemove(false)}
        onConfirm={() => void removeSong()}
      />
    </>
  )
}

function Waveform({ peaks, duration, start, end, now }: { peaks: number[] | null; duration: number; start: number; end: number; now: number | null }) {
  const pct = (t: number) => (duration ? `${(t / duration) * 100}%` : '0%')
  return (
    <div className="relative h-28 overflow-hidden rounded-lg border border-line bg-cream/50" aria-hidden="true">
      {peaks === null ? (
        <div className="absolute inset-0 animate-pulse bg-linen/50" />
      ) : peaks.length === 0 ? (
        <p className="absolute inset-0 grid place-items-center text-xs text-muted">The waveform can’t be shown, but the song will still play.</p>
      ) : (
        <div className="absolute inset-0 flex items-center gap-px px-1">
          {peaks.map((v, i) => {
            const t = (i / peaks.length) * duration
            const inPart = t >= start && t <= end
            return <span key={i} className={cn('flex-1 rounded-full', inPart ? 'bg-gold' : 'bg-line')} style={{ height: `${Math.max(4, v * 92)}%` }} />
          })}
        </div>
      )}
      {duration > 0 && (
        <>
          <span className="absolute inset-y-0 left-0 bg-paper/50" style={{ width: pct(start) }} />
          <span className="absolute inset-y-0 right-0 bg-paper/50" style={{ left: pct(end) }} />
          <span className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: pct(start) }} />
          <span className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: pct(end) }} />
          {now !== null && <span className="absolute inset-y-0 w-0.5 bg-rose" style={{ left: pct(now) }} />}
        </>
      )}
    </div>
  )
}

function TimeControl({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(mmss(value))
  useEffect(() => setText(mmss(value)), [value])
  return (
    <div className="text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-ink">{label}</span>
        <input
          className="input-base w-20 py-1 text-center tabular-nums"
          value={text}
          aria-label={`${label} (minutes:seconds)`}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const v = parseMmss(text)
            if (v === null) setText(mmss(value))
            else onChange(Math.min(max, v))
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      </div>
      <input type="range" min={0} max={Math.round(max)} step={1} value={Math.round(value)} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full accent-ink" aria-label={label} />
    </div>
  )
}

function Slider({ label, value, min, max, unit, onChange }: { label: string; value: number; min: number; max: number; unit: string; onChange: (v: number) => void }) {
  return (
    <label className="block text-sm">
      <span className="flex items-center justify-between">
        <span className="font-medium text-ink">{label}</span>
        <span className="tabular-nums text-muted">
          {value}
          {unit}
        </span>
      </span>
      <input type="range" min={min} max={max} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1.5 w-full accent-ink" />
    </label>
  )
}
