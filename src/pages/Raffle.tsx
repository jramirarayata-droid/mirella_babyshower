import { useEffect, useState } from 'react'
import { KeyRound, LogOut } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useWeddingSettings } from '../hooks/useWeddingSettings'
import { getHostWheel, getPublicWheel, type HostWheelState } from '../services/raffleService'
import { useHost } from '../hooks/hostContext'
import { toFriendlyMessage } from '../utils/errors'
import { babyMonogram } from '../utils/formatting'
import { PublicHeader } from '../components/wedding/PublicHeader'
import { Footer } from '../components/wedding/Footer'
import { CoupleNames } from '../components/wedding/CoupleNames'
import { PageLoader } from '../components/ui/Spinner'
import { Ornament } from '../components/ui/Ornament'
import { cn } from '../components/ui/cn'
import { RaffleWheel } from '../components/raffle/RaffleWheel'
import { HostWheel } from '../components/raffle/HostWheel'
import { BingoGame } from '../components/raffle/BingoGame'

type State =
  | { status: 'loading' }
  | { status: 'closed'; hostHidden?: boolean }
  | { status: 'error'; message: string }
  | { status: 'open'; masked: boolean; names: string[]; hostCode: boolean }
  | { status: 'host'; wheel: HostWheelState }

type Game = 'wheel' | 'bingo'
const GAME_KEY = 'wedding-raffle-game'

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* private mode */
    }
  },
}

/**
 * The raffle page. Guests see the wheel (they can't spin it). In host mode
 * (host code, host link, or signed in as admin) the host runs the prize wheel
 * and Bingo here and presents them on the big screen.
 */
export default function Raffle() {
  const { settings } = useWeddingSettings()
  const host = useHost()
  const [params, setParams] = useSearchParams()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [game, setGame] = useState<Game>(() => (store.get(GAME_KEY) === 'bingo' ? 'bingo' : 'wheel'))
  const token = host.token

  useEffect(() => {
    document.title = settings ? `Raffle · ${settings.coupleNames}` : 'Raffle'
  }, [settings])

  // The private host link (#/raffle?host=…) signs this device in to host mode.
  const fromLink = params.get('host')
  const { signIn } = host
  useEffect(() => {
    if (!fromLink) return
    signIn(fromLink)
    setParams({}, { replace: true })
  }, [fromLink, signIn, setParams])

  useEffect(() => {
    if (host.checking || fromLink) return
    let cancelled = false
    const load = async () => {
      try {
        if (host.isHost) {
          const w = await getHostWheel(token).catch(() => null)
          if (w?.host) {
            if (!cancelled) setState(w.visible ? { status: 'host', wheel: w } : { status: 'closed', hostHidden: true })
            return
          }
        }
        const w = await getPublicWheel()
        if (!cancelled) setState(w.visible ? { status: 'open', masked: w.masked, names: w.names, hostCode: w.hostCode } : { status: 'closed' })
      } catch (e) {
        if (!cancelled) setState({ status: 'error', message: toFriendlyMessage(e) })
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [token, host.isHost, host.checking, fromLink])

  const pick = (g: Game) => {
    setGame(g)
    store.set(GAME_KEY, g)
  }
  const tabs = (
    <div role="tablist" aria-label="Game" className="inline-flex gap-1 rounded-lg bg-cream p-1">
      {(
        [
          ['wheel', 'Prize wheel'],
          ['bingo', 'Bingo'],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          role="tab"
          type="button"
          aria-selected={game === id}
          onClick={() => pick(id)}
          className={cn('rounded-md px-4 py-2 text-sm transition', game === id ? 'bg-paper text-ink shadow-soft' : 'text-muted hover:text-ink')}
        >
          {label}
        </button>
      ))}
    </div>
  )

  const isHost = state.status === 'host'
  const leave = () => {
    setState({ status: 'loading' })
    host.leave()
  }

  return (
    <div className="flex min-h-[100svh] flex-col">
      <PublicHeader />
      <main className="flex flex-1 flex-col items-center px-5 pb-20 pt-10 text-center sm:px-8">
        {settings && (
          <p className="font-serif text-2xl font-light text-ink-soft">
            <CoupleNames names={settings.babyName} />
          </p>
        )}
        <h1 className="mt-4 text-[2.5rem] leading-tight text-ink sm:text-5xl">{isHost ? 'Raffle & Bingo' : 'Raffle'}</h1>
        <Ornament className="mt-6" />
        {state.status === 'loading' ? (
          <PageLoader label="Loading the raffle" />
        ) : state.status === 'host' ? (
          <div className="mt-8 w-full max-w-6xl text-left">
            <p className="mb-6 text-center text-sm text-muted">
              <span className="mr-2 rounded-full bg-champagne-light/60 px-2.5 py-1 text-xs font-medium uppercase tracking-[0.2em] text-gold">Host</span>
              Press <span className="font-medium text-ink-soft">Present</span> to fill the TV or projector screen.
              {token && (
                <button type="button" onClick={leave} className="ml-3 inline-flex items-center gap-1 text-xs text-gold underline-offset-4 hover:underline">
                  <LogOut aria-hidden="true" className="size-3.5" /> Leave host mode
                </button>
              )}
            </p>
            {game === 'bingo' ? <BingoGame tabs={tabs} host /> : <HostWheel token={token} initial={state.wheel} tabs={tabs} />}
          </div>
        ) : state.status === 'closed' || state.status === 'error' ? (
          <div className="mt-10 max-w-md">
            <p className="leading-relaxed text-ink-soft">
              {state.status === 'error'
                ? state.message
                : state.hostHidden
                  ? 'The raffle is hidden on the website right now. Once it is set to Visible (Admin → Raffle), this page lets you run the prize wheel and Bingo.'
                  : 'The raffle isn’t open yet. Please check back closer to the celebration.'}
            </p>
            <Link to="/" className="mt-6 inline-block text-sm text-gold underline-offset-4 hover:underline">
              Back to the baby shower website
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-6 max-w-md leading-relaxed text-ink-soft">
              Our host will spin the wheel at the shower. {state.names.length} {state.names.length === 1 ? 'name is' : 'names are'} on it
              {state.masked ? ' — partly hidden until the day of the shower.' : '.'} There’s Bingo too — the numbers are called on the big screen.
            </p>
            <div className="mt-10 w-full max-w-md">
              <RaffleWheel names={state.names} rotation={0} spinning={false} idle centre={settings ? babyMonogram(settings.babyName) : ''} />
            </div>
            {state.hostCode && (
              <button type="button" onClick={host.askCode} className="mt-16 inline-flex items-center gap-1 text-[0.7rem] text-muted/70 underline-offset-4 transition hover:text-ink hover:underline">
                <KeyRound aria-hidden="true" className="size-3" strokeWidth={1.6} /> Host mode
              </button>
            )}
          </>
        )}
      </main>
      {settings && <Footer coupleNames={settings.babyName} hostNames={settings.coupleNames} weddingDate={settings.weddingDate} closingMessage={settings.closingMessage} />}
    </div>
  )
}
