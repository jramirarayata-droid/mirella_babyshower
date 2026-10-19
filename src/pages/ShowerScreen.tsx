import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Maximize, Sparkles, X } from 'lucide-react'
import { useHost } from '../hooks/hostContext'
import { useWeddingSettings } from '../hooks/useWeddingSettings'
import { usePresentScreen } from '../hooks/usePresentScreen'
import { getPredictionsBoard, listNameIdeas, revealNow, type NameIdea, type PredictionsBoard } from '../services/showerService'
import { RevealAnswer, useGenderReveal } from '../components/shower/GenderReveal'
import { PredictionsSummary } from '../components/shower/PredictionsSummary'
import { NameCloud } from '../components/shower/NameCloud'
import { RoundCountdown } from '../components/wedding/looks/LookArt'
import { CloudsAround, StarField } from '../components/wedding/looks/BabyArt'
import { CoupleNames } from '../components/wedding/CoupleNames'
import { Ornament } from '../components/ui/Ornament'
import { PageLoader } from '../components/ui/Spinner'
import { useToast } from '../hooks/useToast'
import { toFriendlyMessage } from '../utils/errors'

type What = 'reveal' | 'predictions' | 'names'
const TITLES: Record<What, string> = { reveal: 'Gender Reveal', predictions: 'Baby Predictions', names: 'Name Ideas' }

/**
 * #/show/reveal · #/show/predictions · #/show/names — the shower moments on
 * the big screen, for the host (host code or admin). Light and soft, in the
 * website's colours; live — new guesses and names appear by themselves.
 */
export default function ShowerScreen() {
  const { what: raw } = useParams()
  const what: What = raw === 'predictions' || raw === 'names' ? raw : 'reveal'
  const host = useHost()
  const navigate = useNavigate()
  const { settings } = useWeddingSettings()
  const screen = usePresentScreen()

  useEffect(() => {
    document.title = `${TITLES[what]} · Big screen`
  }, [what])

  if (host.checking) return <PageLoader />
  if (!host.isHost) {
    return (
      <main className="grid min-h-[100svh] place-items-center bg-ivory px-6 text-center">
        <div className="max-w-md">
          <h1 className="text-4xl text-ink">For the host</h1>
          <p className="mt-4 text-ink-soft">The big screen is for the host. Open the menu and choose Host mode, then type the host code.</p>
          <button type="button" onClick={host.askCode} className="mt-6 rounded-full bg-ink px-6 py-3 text-sm text-ivory">
            Enter the host code
          </button>
          <p className="mt-4">
            <Link to="/" className="text-sm text-gold underline-offset-4 hover:underline">
              Back to the website
            </Link>
          </p>
        </div>
      </main>
    )
  }

  return (
    <div className="hero-paper paper-texture fixed inset-0 overflow-hidden bg-ivory text-ink">
      <StarField className="opacity-60" />
      <div className="absolute right-4 top-4 z-20 flex gap-2">
        {!screen.full && (
          <button type="button" onClick={screen.toggleFull} aria-label="Full screen" className="grid size-11 place-items-center rounded-full bg-paper/80 text-ink-soft shadow-soft hover:text-ink">
            <Maximize aria-hidden="true" className="size-5" />
          </button>
        )}
        <button type="button" onClick={() => {
            screen.close()
            navigate(-1)
          }} aria-label="Close" className="grid size-11 place-items-center rounded-full bg-paper/80 text-ink-soft shadow-soft hover:text-ink">
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>
      <div className="relative z-10 flex h-full flex-col items-center overflow-y-auto px-[5vw] py-[5vh] text-center">
        {settings && (
          <p className="font-serif text-[clamp(1.4rem,2.6vw,2.4rem)] text-ink-soft">
            <CoupleNames names={settings.babyName} />
          </p>
        )}
        <h1 className="mt-2 text-[clamp(2.6rem,6vw,5.5rem)] leading-tight text-ink">{TITLES[what]}</h1>
        <Ornament className="mt-4" />
        <div className="mt-[5vh] w-full max-w-6xl flex-1">
          {what === 'reveal' ? <RevealScreen token={host.token} /> : what === 'predictions' ? <PredictionsScreen /> : <NamesScreen />}
        </div>
      </div>
    </div>
  )
}

function RevealScreen({ token }: { token: string | null }) {
  const toast = useToast()
  const reduce = useReducedMotion()
  const [reveal, reload] = useGenderReveal()
  const [busy, setBusy] = useState(false)
  const [drum, setDrum] = useState(false)
  const now = async () => {
    setBusy(true)
    setDrum(true)
    try {
      // A short drumroll, then the answer.
      await new Promise((r) => window.setTimeout(r, reduce ? 300 : 3200))
      const r = await revealNow(token)
      if (!r) toast.error('Only the host can reveal it.')
      reload()
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setBusy(false)
      setDrum(false)
    }
  }
  if (!reveal) return <PageLoader label="Getting ready" />
  if (!reveal.enabled) return <p className="text-[clamp(1.2rem,2vw,1.8rem)] text-ink-soft">The gender reveal isn’t set up yet. Turn it on in Admin → Gender Reveal.</p>
  if (reveal.revealed) return <RevealAnswer reveal={reveal} big />
  return (
    <div className="relative mx-auto flex max-w-4xl flex-col items-center">
      <div className="relative w-[min(42vw,22rem)]">
        <div className="aspect-square rounded-full border-2 border-champagne/50 bg-paper/70 shadow-card" />
        <motion.span
          className="absolute inset-0 grid place-items-center font-serif text-[min(16vw,10rem)] text-champagne"
          animate={reduce ? undefined : drum ? { scale: [1, 1.15, 1], rotate: [0, -6, 6, 0] } : { scale: [1, 1.05, 1] }}
          transition={{ duration: drum ? 0.4 : 3, repeat: Infinity }}
        >
          ?
        </motion.span>
        <CloudsAround />
      </div>
      <p className="mt-[5vh] max-w-2xl text-[clamp(1.2rem,2.2vw,2rem)] leading-relaxed text-ink-soft">{drum ? 'Drumroll, please…' : reveal.message}</p>
      {reveal.revealAt && new Date(reveal.revealAt).getTime() > Date.now() && !drum && <RoundCountdown at={reveal.revealAt} big showSeconds className="mt-[4vh]" onDone={reload} />}
      <button
        type="button"
        disabled={busy}
        onClick={() => void now()}
        className="mt-[5vh] inline-flex min-h-16 items-center gap-3 rounded-full bg-ink px-12 text-sm font-medium uppercase tracking-[0.3em] text-ivory shadow-card transition hover:bg-ink-soft disabled:opacity-60"
      >
        <Sparkles aria-hidden="true" className="size-5" /> {busy ? 'Revealing…' : 'Reveal now'}
      </button>
    </div>
  )
}

function useLive<T>(load: () => Promise<T>, every = 8000): T | null {
  const [v, setV] = useState<T | null>(null)
  const run = useCallback(() => {
    load().then(setV, () => undefined)
  }, [load])
  useEffect(() => {
    run()
    const id = window.setInterval(run, every)
    return () => window.clearInterval(id)
  }, [run, every])
  return v
}

function PredictionsScreen() {
  const board = useLive<PredictionsBoard>(getPredictionsBoard)
  if (!board) return <PageLoader label="Counting the guesses" />
  if (!board.visible) return <p className="text-[clamp(1.2rem,2vw,1.8rem)] text-ink-soft">The predictions game is hidden. Turn it on in Admin → Predictions.</p>
  return <PredictionsSummary board={board} big />
}

function NamesScreen() {
  const ideas = useLive<NameIdea[]>(listNameIdeas)
  if (!ideas) return <PageLoader label="Gathering the names" />
  return <NameCloud ideas={ideas} big />
}
