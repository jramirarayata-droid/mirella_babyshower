import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { MusicContext, useMusic, type MusicControls } from './musicContext'
import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Music, VolumeX } from 'lucide-react'
import { getPublicMusic, type MusicPage, type PublicMusic } from '../../services/musicService'
import { SegmentPlayer } from '../../utils/segmentPlayer'
import { isThemePreviewFrame } from '../../theme/applyTheme'
import { useWeddingSettings } from '../../hooks/useWeddingSettings'
import { CoupleNames } from './CoupleNames'
import { cn } from '../ui/cn'
import { useSpace } from '../../hooks/useSpace'

const MUTE_KEY = 'wedding-music-off'
const WELCOME_KEY = 'wedding-welcome-seen'

function pageOf(path: string): MusicPage | null {
  if (path === '/') return 'home'
  if (path.startsWith('/i/')) return 'invite'
  if (path === '/rsvp') return 'rsvp'
  if (path === '/photos') return 'photos'
  return null
}

const readOff = () => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}
const writeOff = (v: boolean) => {
  try {
    localStorage.setItem(MUTE_KEY, v ? '1' : '0')
  } catch {
    /* ignore */
  }
}

/**
 * Background music (Admin → Music). Browsers only allow sound after a tap, so
 * it starts on the guest's first tap — opening the envelope, for example — and
 * a small button turns it off and on. It keeps playing between pages and fades
 * out on pages without music (raffle, admin). A guest who turns it off stays off.
 */
export function MusicPlayer({ children }: { children?: ReactNode }) {
  const { pathname } = useLocation()
  const page = pageOf(pathname)
  const [music, setMusic] = useState<PublicMusic | null>(null)
  const [playing, setPlaying] = useState(false)
  const [off, setOff] = useState(readOff)
  const player = useRef<SegmentPlayer | null>(null)
  const started = useRef(false)
  const preview = isThemePreviewFrame()

  // Load the settings once a guest is on a public page (and the shower's plan has music).
  const { has } = useSpace()
  const wanted = page !== null && !preview && has('music')
  useEffect(() => {
    if (!wanted || music) return
    let alive = true
    getPublicMusic().then((m) => alive && setMusic(m))
    return () => {
      alive = false
    }
  }, [wanted, music])

  useEffect(() => {
    if (!music) return
    const p = new SegmentPlayer({ url: music.url, start: music.start, end: music.end, fadeIn: music.fadeIn, fadeOut: music.fadeOut, loop: music.loop, volume: music.volume })
    p.onChange = setPlaying
    player.current = p
    return () => {
      p.destroy()
      player.current = null
    }
  }, [music])

  const here = Boolean(music && page && music.pages.includes(page))

  // First tap anywhere on a music page starts it (unless the guest turned it off).
  useEffect(() => {
    if (!here || off || started.current) return
    const go = (e: Event) => {
      // The music button handles its own taps.
      if (e.target instanceof Element && e.target.closest('[data-music-button]')) return
      if (started.current || !player.current) return
      started.current = true
      void player.current.play(true).then((ok) => {
        if (!ok) started.current = false
      })
    }
    const opts = { capture: true, passive: true } as const
    window.addEventListener('pointerdown', go, opts)
    window.addEventListener('keydown', go, opts)
    return () => {
      window.removeEventListener('pointerdown', go, opts)
      window.removeEventListener('keydown', go, opts)
    }
  }, [here, off])

  // Autoplay: try to start straight away. Browsers allow this only sometimes
  // (e.g. a returning visitor on a computer); otherwise the first tap starts it.
  useEffect(() => {
    if (!here || off || started.current || !music?.autoplay || !player.current) return
    const p = player.current
    started.current = true
    void p.play(true).then((ok) => {
      if (!ok) started.current = false
    })
  }, [here, off, music])

  // Leaving music pages fades it out; coming back resumes it.
  useEffect(() => {
    const p = player.current
    if (!p || !started.current) return
    if (!here) p.stop(1)
    else if (!off && !p.playing) void p.play()
  }, [here, off])

  // Pause while the tab is in the background.
  useEffect(() => {
    const onVis = () => {
      const p = player.current
      if (!p || !started.current || off || !here) return
      if (document.hidden) p.stop(0.3)
      else void p.play()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [here, off])

  const [welcomeSeen, setWelcomeSeen] = useState(() => {
    try {
      return sessionStorage.getItem(WELCOME_KEY) === '1'
    } catch {
      return false
    }
  })
  const showWelcome = Boolean(here && page === 'home' && music?.welcome && !off && !welcomeSeen && !playing)

  const [toggles, setToggles] = useState(0)
  const register = useCallback(() => {
    setToggles((n) => n + 1)
    return () => setToggles((n) => n - 1)
  }, [])

  const toggle = () => {
    const p = player.current
    if (!p) return
    if (playing) {
      setOff(true)
      writeOff(true)
      p.stop(0.6)
    } else {
      setOff(false)
      writeOff(false)
      started.current = true
      void p.play()
    }
  }

  const controls: MusicControls = { here, playing, off, toggle, register }

  return (
    <MusicContext.Provider value={controls}>
      {children}
      <AnimatePresence>
        {showWelcome && (
          <Welcome
            onEnter={() => {
              setWelcomeSeen(true)
              try {
                sessionStorage.setItem(WELCOME_KEY, '1')
              } catch {
                /* ignore */
              }
            }}
          />
        )}
      </AnimatePresence>
      {/* Pages without a top bar (e.g. the invitation) get a small floating button instead. */}
      {here && page === 'invite' && toggles === 0 && (
        <div className="fixed bottom-4 left-4 z-40 print:hidden" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
          <MusicButton playing={playing} off={off} onToggle={toggle} tone="light" floating />
        </div>
      )}
    </MusicContext.Provider>
  )
}

/** The round ♪ button for the top bar. Shows only when music is set up for this page. */
export function MusicToggle({ tone = 'light' }: { tone?: 'light' | 'onPhoto' }) {
  const m = useMusic()
  const register = m?.register
  useEffect(() => (register ? register() : undefined), [register])
  if (!m?.here) return null
  return <MusicButton playing={m.playing} off={m.off} onToggle={m.toggle} tone={tone} />
}

function MusicButton({ playing, off, onToggle, tone, floating }: { playing: boolean; off: boolean; onToggle: () => void; tone: 'light' | 'onPhoto'; floating?: boolean }) {
  // A one-time hint so guests know what the ♪ is.
  const [hint, setHint] = useState(() => {
    try {
      return !off && sessionStorage.getItem('wedding-music-hint') !== '1'
    } catch {
      return false
    }
  })
  useEffect(() => {
    if (!hint) return
    const t = window.setTimeout(() => setHint(false), 5000)
    try {
      sessionStorage.setItem('wedding-music-hint', '1')
    } catch {
      /* ignore */
    }
    return () => window.clearTimeout(t)
  }, [hint])
  const showHint = hint && !playing
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={onToggle}
        data-music-button
        aria-pressed={playing}
        aria-label={playing ? 'Turn the music off' : 'Play music'}
        title={playing ? 'Music on — tap to turn off' : 'Play music'}
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full border transition',
          tone === 'onPhoto' ? 'border-white/40 text-white/90 hover:border-white hover:bg-white/10' : 'border-line bg-paper/80 text-ink-soft hover:border-champagne hover:text-ink',
          playing && (tone === 'onPhoto' ? 'text-white' : 'text-gold'),
          floating && 'size-11 shadow-soft backdrop-blur',
        )}
      >
        {playing ? <Bars /> : off ? <VolumeX aria-hidden="true" className="size-4" strokeWidth={1.6} /> : <Music aria-hidden="true" className="size-4" strokeWidth={1.6} />}
        <span className="sr-only">{playing ? 'Music on' : off ? 'Music off' : 'Tap for music'}</span>
      </button>
      <AnimatePresence>
        {showHint && (
          <motion.span
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute top-full z-50 mt-2 whitespace-nowrap rounded-full bg-ink/85 px-2.5 py-1 text-[0.65rem] normal-case tracking-normal text-white shadow-soft',
              floating ? 'bottom-full left-0 top-auto mb-2 mt-0' : 'right-0',
            )}
          >
            Tap for music
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}

/** Home page "Tap to enter": the tap that lets the music start. */
function Welcome({ onEnter }: { onEnter: () => void }) {
  const { settings } = useWeddingSettings()
  return (
    <motion.button
      type="button"
      onClick={onEnter}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.9 } }}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-ivory px-6 text-center"
      aria-label="Enter the baby shower website (music will play)"
    >
      {settings && (
        <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }} className="font-serif text-4xl font-light text-ink sm:text-6xl">
          <CoupleNames names={settings.babyName} />
        </motion.p>
      )}
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 1 }}
        className="mt-10 inline-flex min-h-12 items-center gap-2.5 rounded-full border border-champagne/70 px-7 text-sm font-medium uppercase tracking-[0.3em] text-ink-soft"
      >
        <Music aria-hidden="true" className="size-4 text-gold" strokeWidth={1.6} /> Tap to enter
      </motion.span>
    </motion.button>
  )
}

/** Three little bars dancing while music plays. */
function Bars() {
  return (
    <span aria-hidden="true" className="flex h-4 items-end gap-[3px]">
      {[0, 0.2, 0.4].map((d) => (
        <motion.span
          key={d}
          className="w-[3px] rounded-full bg-current"
          animate={{ height: ['30%', '100%', '45%', '80%', '30%'] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: d, ease: 'easeInOut' }}
        />
      ))}
    </span>
  )
}
