import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Music, Pause, Play, Volume2, VolumeX, X } from 'lucide-react'
import { useWeddingSettings } from '../hooks/useWeddingSettings'
import { useHost } from '../hooks/hostContext'
import { getGuestPhotosInfo } from '../services/guestPhotosService'
import { getPublicMusic } from '../services/musicService'
import { LoopPlayer } from '../utils/loopPlayer'
import { allGuestPhotos, guestSlide, ourSlides, watchGuestPhotos, type Slide } from '../services/presentService'
import { Monogram } from '../components/wedding/Monogram'
import { CoupleNames } from '../components/wedding/CoupleNames'
import { HostCodeForm } from '../components/host/HostCodeForm'
import { cn } from '../components/ui/cn'

/** Each photo stays on screen this long (once it has loaded). */
const SHOW_MS = 5000
const FADE_S = 1.4
/** New guest photos arrive live; this regular check is only a safety net (e.g. venue Wi-Fi dropping the live connection). */
const POLL_MS = 120_000
/** When several guests share at once, wait this long and fetch once. */
const LIVE_SETTLE_MS = 1200
/** A film whose end we can't detect (some embeds) moves on after this long. */
const FILM_CAP_MS = 20 * 60_000
const EASE = [0.4, 0, 0.2, 1] as const

type Source = 'guests' | 'ours'

const MUSIC_OFF_KEY = 'present-music-off'
const readMusicOff = () => {
  try {
    return localStorage.getItem(MUSIC_OFF_KEY) === '1'
  } catch {
    return false
  }
}

function toggleFull() {
  if (document.fullscreenElement) void document.exitFullscreen()
  else void document.documentElement.requestFullscreen?.().catch(() => undefined)
}

/**
 * #/present/guests and #/present/ours — host mode only. Fills a TV or
 * projector with the guest photos (live: new ones jump the queue) or the
 * couple's own photos and films. Photos stay 5 seconds with a slow drift and a
 * soft crossfade; films play to the end, then the show carries on.
 */
export default function Present() {
  const { source } = useParams()
  const host = useHost()
  if (source !== 'guests' && source !== 'ours') return <Navigate to="/" replace />
  if (host.checking) return <Dark />
  if (!host.isHost) return <HostGate />
  return <Show key={source} source={source} />
}

function Dark({ children }: { children?: ReactNode }) {
  return <div className="fixed inset-0 grid place-items-center overflow-y-auto bg-[#0d0c0b] px-6 text-center text-white">{children}</div>
}

/** Not a host yet: the host code, on the dark screen. */
function HostGate() {
  const host = useHost()
  return (
    <Dark>
      <div className="w-full max-w-xs">
        <Monogram className="font-serif text-5xl italic text-white/90" height="88px" />
        <p className="mt-6 text-xs uppercase tracking-[0.35em] text-champagne-light/80">Host mode</p>
        <p className="mt-3 font-serif text-2xl italic text-white/90">Type the host code to present</p>
        <div className="mt-6">
          <HostCodeForm dark onSignedIn={host.signIn} />
        </div>
        <Link to="/" className="mt-8 inline-block text-xs uppercase tracking-[0.3em] text-white/50 hover:text-white">
          Back to the website
        </Link>
      </div>
    </Dark>
  )
}

function Show({ source }: { source: Source }) {
  const { settings } = useWeddingSettings()
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const [slides, setSlides] = useState<Slide[] | null>(null)
  const [title, setTitle] = useState('')
  const [closed, setClosed] = useState(false)
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<'ready' | 'intro' | 'show'>('ready')
  const [paused, setPaused] = useState(false)
  const [shown, setShown] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)
  const [full, setFull] = useState(false)
  const [chrome, setChrome] = useState(true)
  const [dir, setDir] = useState(1)
  const queue = useRef<string[]>([])
  const known = useRef<Set<string>>(new Set())
  const loaded = useRef<Set<string>>(new Set())
  const hideTimer = useRef<number | undefined>(undefined)
  const touchX = useRef<number | null>(null)
  const fetching = useRef(false)
  const fetchAgain = useRef(false)
  const shownId = useRef<string | null>(null)
  // The website's song (Admin → Music), looping seamlessly under the photos.
  const music = useRef<LoopPlayer | null>(null)
  const [hasMusic, setHasMusic] = useState(false)
  const [musicOn, setMusicOn] = useState(() => !readMusicOff())
  const [musicLive, setMusicLive] = useState(false)

  useEffect(() => {
    document.title = settings ? `Presenting · ${settings.coupleNames}` : 'Presenting'
  }, [settings])

  // ---------------------------------------------------------------- what to show
  const pollGuests = useCallback(async () => {
    // One fetch at a time; a signal that lands mid-fetch fetches once more after.
    if (fetching.current) {
      fetchAgain.current = true
      return
    }
    fetching.current = true
    do {
      fetchAgain.current = false
      try {
        const info = await getGuestPhotosInfo(true)
        setTitle(info.title)
        if (!info.visible) {
          setClosed(true)
          setSlides([])
          continue
        }
        setClosed(false)
        const all = await allGuestPhotos()
        const first = known.current.size === 0
        const arrivals = all.filter((p) => !known.current.has(p.id))
        arrivals.forEach((p) => known.current.add(p.id))
        // Photos added while the show runs are shown next.
        if (!first) queue.current.push(...arrivals.map((p) => p.id).reverse())
        // Oldest first, so the story of the day plays in order.
        const next = [...all].reverse().map(guestSlide)
        setSlides(next)
        // Keep the photo on screen in place when others are hidden or removed.
        const at = shownId.current ? next.findIndex((s) => s.id === shownId.current) : -1
        if (at >= 0) setIndex(at)
      } catch {
        /* keep showing what we have; try again next time */
      }
    } while (fetchAgain.current)
    fetching.current = false
  }, [])

  useEffect(() => {
    if (source !== 'guests') return
    void pollGuests()
    const t = window.setInterval(() => void pollGuests(), POLL_MS)
    // Live: a guest shares a photo → it's fetched within a second or two.
    let settle: number | undefined
    const soon = () => {
      window.clearTimeout(settle)
      settle = window.setTimeout(() => void pollGuests(), LIVE_SETTLE_MS)
    }
    const stop = watchGuestPhotos(soon, () => void pollGuests())
    // Laptop woke up or the tab came back: catch up straight away.
    const onVis = () => document.visibilityState === 'visible' && void pollGuests()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(t)
      window.clearTimeout(settle)
      stop()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [source, pollGuests])

  useEffect(() => {
    if (source !== 'ours' || !settings) return
    let alive = true
    setTitle(settings.galleryTitle || 'Our story')
    ourSlides(settings)
      .then((s) => alive && setSlides(s))
      .catch(() => alive && setSlides([]))
    return () => {
      alive = false
    }
  }, [source, settings])

  const count = slides?.length ?? 0
  const current = phase === 'show' && slides && count ? slides[index % count] : null

  // The slide that comes next: a just-arrived photo, otherwise the next in line.
  const upcoming = useCallback(
    (from: number) => {
      if (!slides || !count) return 0
      while (queue.current.length) {
        const at = slides.findIndex((s) => s.id === queue.current[0])
        if (at >= 0 && at !== from) return at
        queue.current.shift()
      }
      return (from + 1) % count
    },
    [slides, count],
  )

  const go = useCallback(
    (step: 1 | -1) => {
      if (!count) return
      setDir(step)
      setShown(null)
      setIndex((i) => {
        if (step === 1) {
          const n = upcoming(i % count)
          if (queue.current[0] === slides?.[n]?.id) queue.current.shift()
          return n
        }
        return (i - 1 + count) % count
      })
    },
    [count, upcoming, slides],
  )

  // Photos: 5 seconds once fully loaded (so nothing is cut short on slow Wi-Fi).
  // (By id: the guest list refreshing doesn't restart the clock.)
  const curId = current?.id ?? null
  const curKind = current?.kind ?? null
  const goRef = useRef(go)
  useEffect(() => {
    goRef.current = go
  }, [go])
  useEffect(() => {
    shownId.current = curId
  }, [curId])

  // ---------------------------------------------------------------- music
  // Load the song while the start screen shows, so it's ready on Begin.
  useEffect(() => {
    let alive = true
    let player: LoopPlayer | null = null
    getPublicMusic()
      .then((m) => {
        if (!alive || !m) return
        player = new LoopPlayer({ url: m.url, start: m.start, end: m.end, volume: m.volume, fadeIn: Math.max(1.5, m.fadeIn) })
        music.current = player
        setHasMusic(true)
        void player.load()
      })
      .catch(() => undefined)
    return () => {
      alive = false
      player?.destroy()
      music.current = null
    }
  }, [])

  // Plays from Begin; quietly steps aside while a film plays its own sound.
  const film = curKind === 'video' || curKind === 'embed'
  const musicWanted = hasMusic && musicOn && phase !== 'ready' && !film
  useEffect(() => {
    music.current?.setOn(musicWanted, musicWanted ? 1.6 : 0.9)
  }, [musicWanted])

  // Whether sound is really coming out (shown on the button; also used by the tests).
  useEffect(() => {
    if (!hasMusic || phase === 'ready') return
    const t = window.setInterval(() => setMusicLive(Boolean(music.current?.playing)), 1000)
    return () => window.clearInterval(t)
  }, [hasMusic, phase])

  const toggleMusic = useCallback(() => {
    music.current?.unlock()
    setMusicOn((on) => {
      try {
        localStorage.setItem(MUSIC_OFF_KEY, on ? '1' : '0')
      } catch {
        /* ignore */
      }
      return !on
    })
  }, [])
  useEffect(() => {
    if (!curId || paused || curKind !== 'photo' || shown !== curId || count < 2) return
    const t = window.setTimeout(() => goRef.current(1), SHOW_MS)
    return () => window.clearTimeout(t)
  }, [curId, curKind, paused, shown, count])

  // Films we can't hear the end of still move on eventually.
  useEffect(() => {
    if (!curId || paused || !curKind || curKind === 'photo') return
    const t = window.setTimeout(() => goRef.current(1), FILM_CAP_MS)
    return () => window.clearTimeout(t)
  }, [curId, curKind, paused])

  // Load the next two photos ahead, so every crossfade is clean.
  useEffect(() => {
    if (!slides || !count || phase === 'ready') return
    const n1 = upcoming(index % count)
    const ahead = [slides[index % count], slides[n1], slides[(n1 + 1) % count]]
    for (const s of ahead) {
      if (!s || loaded.current.has(s.id)) continue
      const url = s.kind === 'photo' ? s.src : s.poster
      if (!url) continue
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => loaded.current.add(s.id)
      img.src = url
    }
  }, [slides, count, index, phase, upcoming])

  // ---------------------------------------------------------------- starting
  const begin = async () => {
    // This click is what lets the browser play sound.
    music.current?.unlock()
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.()
    } catch {
      /* not allowed here: carry on in the window */
    }
    setPhase(reduce ? 'show' : 'intro')
  }
  useEffect(() => {
    if (phase !== 'intro') return
    const t = window.setTimeout(() => setPhase('show'), 3600)
    return () => window.clearTimeout(t)
  }, [phase])

  // Keep the screen awake while presenting.
  useEffect(() => {
    if (phase === 'ready') return
    type Lock = { release: () => Promise<void> }
    let lock: Lock | null = null
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Lock> } }
    const get = () => nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => undefined)
    void get()
    const onVis = () => document.visibilityState === 'visible' && void get()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      void lock?.release().catch(() => undefined)
    }
  }, [phase])

  // ---------------------------------------------------------------- controls
  const wake = useCallback(() => {
    setChrome(true)
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setChrome(false), 2800)
  }, [])
  useEffect(() => {
    const onFs = () => setFull(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFs)
    return () => {
      window.clearTimeout(hideTimer.current)
      document.removeEventListener('fullscreenchange', onFs)
    }
  }, [])
  useEffect(() => {
    if (phase === 'show') wake()
  }, [phase, wake])

  const close = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
    navigate(source === 'guests' ? '/photos' : '/')
  }

  useEffect(() => {
    if (phase !== 'show') return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') go(1)
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(-1)
      else if (e.key === ' ' || e.key === 'k') {
        e.preventDefault()
        setPaused((p) => !p)
      } else if (e.key === 'f') toggleFull()
      else if (e.key === 'm') {
        // M: the film's sound during a film, otherwise the music.
        if (film) setMuted((m) => !m)
        else toggleMusic()
      } else return
      wake()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, go, wake, film, toggleMusic])

  // A different slow drift for each photo.
  const origin = useMemo(() => {
    const seed = curId ? [...curId].reduce((a, c) => a + c.charCodeAt(0), 0) : 0
    return ['30% 35%', '70% 30%', '50% 60%', '35% 65%', '65% 60%', '50% 40%'][seed % 6]
  }, [curId])

  const coupleNames = settings?.coupleNames ?? ''
  const films = slides?.filter((s) => s.kind !== 'photo').length ?? 0
  const photos = count - films
  const summary = [photos ? `${photos} ${photos === 1 ? 'photo' : 'photos'}` : '', films ? `${films} ${films === 1 ? 'film' : 'films'}` : ''].filter(Boolean).join(' · ')

  // ---------------------------------------------------------------- the screen
  return (
    <div
      className="fixed inset-0 select-none overflow-hidden bg-[#0d0c0b] text-white"
      onMouseMove={phase === 'show' ? wake : undefined}
      onPointerDown={(e) => {
        touchX.current = e.clientX
      }}
      onPointerUp={(e) => {
        if (phase !== 'show' || touchX.current === null) return
        const dx = e.clientX - touchX.current
        touchX.current = null
        if (Math.abs(dx) > 60 && e.pointerType !== 'mouse') go(dx < 0 ? 1 : -1)
        else wake()
      }}
      style={{ cursor: phase === 'show' && !chrome ? 'none' : 'auto' }}
      data-music={!hasMusic ? 'none' : musicWanted ? 'on' : musicOn ? 'resting' : 'off'}
      data-music-live={musicLive ? '1' : '0'}
    >
      {/* The slides */}
      <AnimatePresence initial={false} custom={dir}>
        {current && (
          <motion.div
            key={current.id}
            className="absolute inset-0"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.04, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.985, filter: 'blur(6px)' }}
            transition={{ duration: FADE_S, ease: EASE }}
          >
            {current.kind === 'photo' ? (
              <PhotoSlide slide={current} origin={origin} drift={!reduce && !paused} onShown={() => setShown(current.id)} />
            ) : current.kind === 'video' ? (
              <FilmSlide slide={current} paused={paused} muted={muted} onMuted={setMuted} onEnded={() => go(1)} />
            ) : (
              <EmbedSlide slide={current} onEnded={() => go(1)} />
            )}
            {current.caption && (
              <motion.p
                className="pointer-events-none absolute bottom-[4.5vh] left-[4vw] max-w-[60vw] font-serif text-[clamp(1.3rem,2.8vw,2.5rem)] italic leading-tight text-white/95 drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: FADE_S * 0.7, duration: 1.1, ease: EASE }}
              >
                {current.caption}
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* The monogram, always there in the corner */}
      {phase === 'show' && (
        <div className="pointer-events-none absolute bottom-[4vh] right-[4vw] text-white/85 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
          <Monogram className="font-serif text-[clamp(1.5rem,3vw,2.8rem)] italic" height="clamp(48px, 7.5vh, 100px)" />
        </div>
      )}

      {/* The photo's 5 seconds, as a fine gold line */}
      {current?.kind === 'photo' && shown === current.id && count > 1 && (
        <div className="absolute inset-x-0 top-0 h-[2px] bg-white/10">
          <div key={`${current.id}-${index}`} className="present-progress h-full origin-left bg-champagne" style={{ animationDuration: `${SHOW_MS}ms`, animationPlayState: paused ? 'paused' : 'running' }} />
        </div>
      )}

      {/* Start screen, then the opening title */}
      <AnimatePresence>
        {phase !== 'show' && (
          <motion.div
            key={phase}
            className="absolute inset-0 grid place-items-center px-8 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 1.2 } }}
            transition={{ duration: 1 }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(184,155,106,0.16),transparent_65%)]" aria-hidden="true" />
            <div className="relative">
              <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, ease: EASE }}>
                <Monogram className="font-serif text-6xl italic text-white/90" height="clamp(90px, 16vh, 170px)" />
              </motion.div>
              <motion.p
                className="mt-[4vh] text-[clamp(0.65rem,1.1vw,0.9rem)] uppercase tracking-[0.45em] text-champagne-light/80"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 1.2 }}
              >
                {coupleNames && <CoupleNames names={coupleNames} />}
              </motion.p>
              <motion.h1
                className="mt-3 font-serif text-[clamp(2.2rem,5.5vw,4.8rem)] font-light italic leading-tight text-white"
                initial={reduce ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 1.4, ease: EASE }}
              >
                {source === 'guests' ? title || 'Shared by our guests' : title || 'Our story'}
              </motion.h1>
              {phase === 'ready' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2, duration: 1 }}>
                  {slides === null ? (
                    <p className="mt-8 text-sm text-white/50">Getting everything ready…</p>
                  ) : count === 0 ? (
                    <p className="mx-auto mt-8 max-w-md text-white/70">
                      {source === 'ours'
                        ? 'There are no photos or films on the website yet. Add them in Admin → Photos & Video.'
                        : closed
                          ? 'The guest photo gallery is hidden. Turn it on in Admin → Guest Photos.'
                          : 'No guest photos yet — new ones will appear here as soon as they’re shared.'}
                    </p>
                  ) : (
                    <p className="mt-6 text-sm uppercase tracking-[0.3em] text-white/50">{summary}</p>
                  )}
                  <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                    {(count > 0 || source === 'guests') && slides !== null && (
                      <button
                        type="button"
                        onClick={() => void begin()}
                        className="inline-flex min-h-14 items-center gap-3 rounded-full bg-champagne px-10 text-sm font-medium uppercase tracking-[0.3em] text-[#1b1915] shadow-[0_10px_40px_-10px_rgba(184,155,106,0.7)] transition hover:bg-champagne-light"
                        autoFocus
                      >
                        <Play aria-hidden="true" className="size-4 fill-current" /> Begin
                      </button>
                    )}
                    <button type="button" onClick={close} className="min-h-14 rounded-full px-6 text-xs uppercase tracking-[0.3em] text-white/55 hover:text-white">
                      Back
                    </button>
                  </div>
                  {hasMusic && (
                    <button
                      type="button"
                      onClick={toggleMusic}
                      aria-pressed={musicOn}
                      className="mt-6 inline-flex min-h-11 items-center gap-2.5 rounded-full px-5 text-xs uppercase tracking-[0.3em] text-white/60 ring-1 ring-white/15 transition hover:text-white hover:ring-white/35"
                    >
                      <MusicIcon on={musicOn} small /> {musicOn ? 'With our music' : 'Music off'}
                    </button>
                  )}
                  <p className="mt-8 text-[0.7rem] text-white/35">
                    Opens full screen · ← → to move · Space to pause{hasMusic ? ' · M music on/off' : ''}
                    {source === 'guests' ? ' · new photos join automatically' : ''}
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* While presenting with no photos yet (guest wall that's still empty) */}
      {phase === 'show' && !current && (
        <div className="absolute inset-0 grid place-items-center px-8 text-center">
          <div>
            <Monogram className="font-serif text-5xl italic text-white/90" height="120px" />
            <p className="mt-6 font-serif text-3xl italic text-white/90">Share your photos — they’ll appear here!</p>
            <p className="mt-3 text-sm uppercase tracking-[0.3em] text-white/60">{window.location.host}/#/photos</p>
          </div>
        </div>
      )}

      {/* Controls fade away when the mouse is still */}
      {phase === 'show' && (
        <div className={cn('transition-opacity duration-500', chrome ? 'opacity-100' : 'pointer-events-none opacity-0')} onPointerUp={(e) => e.stopPropagation()}>
          <div className="absolute right-4 top-4 flex gap-2">
            {hasMusic && (
              <Round label={musicOn ? 'Turn the music off' : 'Turn the music on'} onClick={toggleMusic}>
                <MusicIcon on={musicOn} />
              </Round>
            )}
            <Round label={full ? 'Exit full screen' : 'Full screen'} onClick={toggleFull}>
              {full ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
            </Round>
            <Round label="End the presentation" onClick={close}>
              <X className="size-5" />
            </Round>
          </div>
          {count > 0 && (
            <p className="absolute left-5 top-6 text-xs uppercase tracking-[0.3em] text-white/60 drop-shadow">
              {(index % count) + 1} / {count}
              {paused && <span className="ml-3 text-champagne-light">Paused</span>}
            </p>
          )}
          {count > 1 && (
            <div className="absolute bottom-[3.5vh] left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/45 p-1.5 backdrop-blur-md ring-1 ring-white/10">
              <Round label="Previous" onClick={() => go(-1)} bare>
                <ChevronLeft className="size-5" />
              </Round>
              <Round label={paused ? 'Play' : 'Pause'} onClick={() => setPaused((p) => !p)} bare>
                {paused ? <Play className="size-5 fill-current" /> : <Pause className="size-5 fill-current" />}
              </Round>
              <Round label="Next" onClick={() => go(1)} bare>
                <ChevronRight className="size-5" />
              </Round>
              {current?.kind === 'video' && (
                <Round label={muted ? 'Sound on' : 'Sound off'} onClick={() => setMuted((m) => !m)} bare>
                  {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
                </Round>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Round({ label, onClick, children, bare = false }: { label: string; onClick: () => void; children: ReactNode; bare?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn('grid size-11 place-items-center rounded-full text-white transition', bare ? 'hover:bg-white/15' : 'bg-black/40 backdrop-blur hover:bg-black/60')}
    >
      {children}
    </button>
  )
}

/** ♪ — crossed out when the music is off. */
function MusicIcon({ on, small = false }: { on: boolean; small?: boolean }) {
  return (
    <span className="relative inline-grid place-items-center">
      <Music aria-hidden="true" className={cn(small ? 'size-4' : 'size-5', !on && 'opacity-60')} strokeWidth={1.8} />
      {!on && <span aria-hidden="true" className={cn('absolute h-[2px] rotate-45 rounded-full bg-current', small ? 'w-5' : 'w-6')} />}
    </span>
  )
}

// ---------------------------------------------------------------- slide kinds

/** A photo: a soft blurred fill behind it (for portrait photos on a wide screen), then a slow drift. */
function PhotoSlide({ slide, origin, drift, onShown }: { slide: Extract<Slide, { kind: 'photo' }>; origin: string; drift: boolean; onShown: () => void }) {
  const [ready, setReady] = useState(false)
  const done = useRef(onShown)
  useEffect(() => {
    done.current = onShown
  }, [onShown])
  const onLoad = () => {
    setReady(true)
    done.current()
  }
  return (
    <>
      <img src={slide.thumb} alt="" aria-hidden="true" className="absolute inset-0 size-full scale-110 object-cover opacity-45 blur-2xl" />
      <div aria-hidden="true" className="absolute inset-0 bg-black/20" />
      <motion.img
        src={slide.src}
        alt={slide.caption || 'Photo'}
        onLoad={onLoad}
        onError={onLoad}
        className="absolute inset-0 size-full object-contain transition-opacity duration-700"
        style={{ transformOrigin: origin, opacity: ready ? 1 : 0 }}
        initial={{ scale: 1 }}
        animate={drift && ready ? { scale: 1.08 } : { scale: 1 }}
        transition={{ duration: (SHOW_MS + FADE_S * 1000 * 2) / 1000, ease: 'linear' }}
      />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/60 to-transparent" />
    </>
  )
}

/** An uploaded film: plays to the end with sound (muted only if the browser insists). */
function FilmSlide({
  slide,
  paused,
  muted,
  onMuted,
  onEnded,
}: {
  slide: Extract<Slide, { kind: 'video' }>
  paused: boolean
  muted: boolean
  onMuted: (m: boolean) => void
  onEnded: () => void
}) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    if (paused) {
      v.pause()
      return
    }
    v.play().catch(() => {
      // Sound isn't allowed without a tap: play muted, the host can turn sound on.
      v.muted = true
      onMuted(true)
      void v.play().catch(() => undefined)
    })
  }, [paused, onMuted])
  return (
    <video
      ref={ref}
      src={slide.src}
      poster={slide.poster || undefined}
      muted={muted}
      playsInline
      preload="auto"
      onEnded={onEnded}
      onError={onEnded}
      className="absolute inset-0 size-full bg-black object-contain"
    />
  )
}

/** A YouTube or Vimeo film. We listen for its end so the show carries on by itself. */
function EmbedSlide({ slide, onEnded }: { slide: Extract<Slide, { kind: 'embed' }>; onEnded: () => void }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const ended = useRef(onEnded)
  useEffect(() => {
    ended.current = onEnded
  }, [onEnded])
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return
      let d: unknown = e.data
      if (typeof d === 'string') {
        try {
          d = JSON.parse(d)
        } catch {
          return
        }
      }
      const o = (d ?? {}) as { event?: string; info?: unknown }
      const info = o.info as { playerState?: number } | number | undefined
      const ytEnded = (o.event === 'onStateChange' && info === 0) || (o.event === 'infoDelivery' && typeof info === 'object' && info?.playerState === 0)
      if (ytEnded || o.event === 'ended') ended.current()
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])
  const listen = () => {
    const w = ref.current?.contentWindow
    if (!w) return
    if (slide.provider === 'youtube') {
      w.postMessage(JSON.stringify({ event: 'listening', id: slide.id, channel: 'widget' }), '*')
      w.postMessage(JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onStateChange'], id: slide.id, channel: 'widget' }), '*')
    } else w.postMessage(JSON.stringify({ method: 'addEventListener', value: 'ended' }), '*')
  }
  return (
    <iframe
      ref={ref}
      src={slide.embedUrl}
      title={slide.caption || 'Film'}
      onLoad={listen}
      className="absolute inset-0 size-full"
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  )
}
