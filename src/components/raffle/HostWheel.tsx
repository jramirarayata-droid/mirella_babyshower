import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Maximize2, RotateCcw } from 'lucide-react'
import { useWeddingSettings } from '../../hooks/useWeddingSettings'
import { useToast } from '../../hooks/useToast'
import { getHostBoard, getHostWheel, hostLanded, hostNewRound, hostSetMode, ordinal, type HostBoard, type HostWheelState } from '../../services/raffleService'
import { usePresentScreen } from '../../hooks/usePresentScreen'
import { OutStack, PresentTopBar, WinnersStack, boardEntries } from './PresentSides'
import { toFriendlyMessage } from '../../utils/errors'
import { babyMonogram } from '../../utils/formatting'
import { Button } from '../ui/Button'
import { cn } from '../ui/cn'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { QUICK_SPIN_MS, SLOW_SPIN_MS, SoundControls, SpinStage, type Outcome } from './RaffleWheel'

/**
 * The prize wheel, run by the host on the wedding website (private host link
 * or a signed-in admin). Same wheel and Present screen as the admin page; the
 * server checks the link and saves every result.
 */
export function HostWheel({ token, initial, tabs }: { token: string | null; initial: HostWheelState; tabs: ReactNode }) {
  const { settings } = useWeddingSettings()
  const toast = useToast()
  const [state, setState] = useState<HostWheelState>(initial)
  const [prize, setPrize] = useState('')
  const { present, open: openPresent, close: closePresent, full, toggleFull } = usePresentScreen()
  const [board, setBoard] = useState<HostBoard>({ out: [], winners: [] })
  const [revealOpen, setRevealOpen] = useState(false)
  const [autoPlay, setAutoPlay] = useState(false)
  const [askNewRound, setAskNewRound] = useState(false)
  const [roundKey, setRoundKey] = useState(0)
  const autoRef = useRef(false)
  const remainingRef = useRef(initial.names.length)

  const lastMode = state.drawMode === 'last'
  const shown = useMemo(() => state.names.map((x) => x.n), [state.names])
  const keys = useMemo(() => state.names.map((x) => x.k), [state.names])
  const roundDone = lastMode && state.knockedOut > 0 && state.names.length <= 1
  const spinMs = lastMode && state.names.length > state.finalsAt ? QUICK_SPIN_MS : SLOW_SPIN_MS
  const centre = settings ? babyMonogram(settings.babyName) : ''

  useEffect(() => {
    autoRef.current = autoPlay
  }, [autoPlay])
  useEffect(() => {
    remainingRef.current = state.names.length
  }, [state.names.length])

  const loadBoard = useCallback(async () => setBoard(await getHostBoard(token)), [token])
  const refresh = useCallback(async () => {
    void loadBoard()
    try {
      const s = await getHostWheel(token)
      if (s.host && s.visible) setState(s)
    } catch {
      /* keep what we have */
    }
  }, [token, loadBoard])
  useEffect(() => {
    void loadBoard()
  }, [loadBoard])
  const sides = useMemo(() => boardEntries(board.out, board.winners), [board])

  const onLanded = useCallback(
    async (key: string): Promise<Outcome | null> => {
      const before = remainingRef.current
      try {
        const o = await hostLanded(token, key, lastMode ? '' : prize)
        if (!lastMode) setPrize('')
        remainingRef.current = before - (lastMode ? 1 : 0)
        void refresh()
        return { ...o, brief: o.tone === 'out' ? before <= state.finalsAt : undefined }
      } catch (e) {
        setAutoPlay(false)
        toast.error(toFriendlyMessage(e))
        void refresh()
        return null
      }
    },
    [token, lastMode, prize, refresh, state.finalsAt, toast],
  )
  const keepAutoPlaying = useCallback(() => autoRef.current && remainingRef.current > state.finalsAt, [state.finalsAt])

  const [spinning, setSpinning] = useState(false)
  const [switching, setSwitching] = useState(false)
  const changeMode = async (mode: 'first' | 'last') => {
    if (mode === state.drawMode || switching) return
    setSwitching(true)
    setAutoPlay(false)
    try {
      await hostSetMode(token, mode)
      setState((s) => ({ ...s, drawMode: mode }))
      await refresh()
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setSwitching(false)
    }
  }

  const startNewRound = async () => {
    setAskNewRound(false)
    setAutoPlay(false)
    try {
      await hostNewRound(token)
      await refresh()
      setRoundKey((k) => k + 1)
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    }
  }

  useEffect(() => {
    if (!present) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closePresent()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [present, closePresent])

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        {tabs}
        <Button variant="outline" onClick={openPresent} disabled={!state.names.length && !roundDone} icon={<Maximize2 aria-hidden="true" className="size-4" />}>
          Present
        </Button>
      </div>

      <section className="rounded-xl border border-line bg-paper p-5 shadow-soft sm:p-8">
        <fieldset className="mb-6" disabled={switching || spinning}>
          <legend className="mb-2 text-sm font-medium text-ink">How the raffle works</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ['first', 'First spin wins', 'The name the wheel lands on wins.'],
                ['last', 'Last one standing', 'Each spin knocks a name out; the last name left wins.'],
              ] as const
            ).map(([id, label, hint]) => (
              <label
                key={id}
                className={cn(
                  'relative flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition',
                  state.drawMode === id ? 'border-champagne bg-champagne-light/30' : 'border-line hover:border-champagne/60',
                )}
              >
                <input type="radio" name="host-draw-mode" className="mt-0.5 size-4 accent-ink" checked={state.drawMode === id} onChange={() => void changeMode(id)} />
                <span>
                  <span className="font-medium text-ink">{label}</span>
                  <span className="mt-0.5 block text-muted">{hint}</span>
                </span>
              </label>
            ))}
          </div>
          {lastMode && (
            <p className="mt-2 text-xs text-muted">
              Prizes:{' '}
              {Array.from({ length: state.consolations + 1 }, (_, i) => `${i === 0 ? 'Winner' : ordinal(i + 1)} — ${(state.prizes[i] ?? '').trim() || 'no prize set'}`).join(' · ')}
              . These are set in the admin.
            </p>
          )}
        </fieldset>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <SoundControls />
          {lastMode && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-ink-soft">
              <span>
                {roundDone ? (
                  'Round complete'
                ) : (
                  <>
                    <span className="font-medium text-ink">{state.names.length}</span> left{state.names.length > state.finalsAt ? ` · full spins from ${state.finalsAt}` : ' · finals'}
                  </>
                )}
              </span>
              <label className="inline-flex cursor-pointer items-center gap-2">
                <input type="checkbox" className="size-4 accent-ink" checked={autoPlay} onChange={(e) => setAutoPlay(e.target.checked)} />
                Auto-play to the finals
              </label>
              <Button size="sm" variant="ghost" onClick={() => setAskNewRound(true)} disabled={!state.knockedOut} icon={<RotateCcw aria-hidden="true" className="size-3.5" />}>
                New round
              </Button>
            </div>
          )}
        </div>
        {!lastMode && (
          <label className="mx-auto mb-6 block max-w-md text-left text-sm text-ink-soft">
            Prize for this spin (optional)
            <input className="input-base mt-2" value={prize} maxLength={150} onChange={(e) => setPrize(e.target.value)} placeholder="e.g. Coffee maker" />
          </label>
        )}
        {!state.names.length && !roundDone && <p className="mb-4 text-center text-sm text-muted">There are no names on the wheel right now.</p>}

        {/* The same wheel expands to full screen for Present — a spin carries on smoothly. */}
        <div
          className={present ? 'fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-y-auto bg-ivory px-6 py-6' : undefined}
          role={present ? 'dialog' : undefined}
          aria-modal={present || undefined}
          aria-label={present ? 'Raffle' : undefined}
        >
          {present && (
            <>
              <PresentTopBar full={full} onToggleFull={toggleFull} onClose={closePresent} />
              {settings && <p className="mb-4 font-serif text-3xl text-ink-soft">{settings.coupleNames}</p>}
              {!lastMode && prize.trim() && <p className="mb-4 text-lg uppercase tracking-[0.3em] text-gold">{prize.trim()}</p>}
              {lastMode && <p className="mb-4 text-lg uppercase tracking-[0.3em] text-gold">{roundDone ? 'We have a winner' : `${state.names.length} left`}</p>}
            </>
          )}
          {roundDone && !present && <p className="mb-4 text-center text-sm text-muted">This round is complete. Start a new round to spin again.</p>}
          {/* Present: knocked-out names on the left, winners on the right (the wheel element stays the same). */}
          <div className={present ? 'grid w-full max-w-[1800px] items-start gap-[3vw] lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]' : 'contents'}>
            <div className={present ? 'hidden pt-[4vh] lg:block' : 'hidden'}>{present && lastMode && <OutStack entries={sides.out} paused={revealOpen} />}</div>
            <div className={present ? 'mx-auto flex w-[min(calc(100vh-440px),92vw)] min-w-[280px] flex-col items-center lg:w-[min(calc(100vh-440px),44vw)]' : 'contents'}>
              <SpinStage
                shown={shown}
                real={keys}
                centre={centre}
                large={present}
                durationMs={spinMs}
                disabled={roundDone}
                autoPlay={keepAutoPlaying}
                spinLabel={lastMode && state.names.length > state.finalsAt ? 'Quick spin' : 'Spin'}
                reveal={present}
                roundKey={roundKey}
                onRevealChange={setRevealOpen}
                onLanded={async (key) => {
                  setSpinning(true)
                  try {
                    return await onLanded(key)
                  } finally {
                    setSpinning(false)
                  }
                }}
              />
            </div>
            <div className={present ? 'hidden pt-[4vh] lg:block' : 'hidden'}>{present && <WinnersStack entries={sides.winners} paused={revealOpen} />}</div>
          </div>
          {present && <SoundControls className="mt-2" />}
        </div>
      </section>
      <p className="mt-4 text-center text-xs text-muted">Every result is saved in the admin. Guests on their phones only see the wheel — they can’t spin it.</p>

      <ConfirmDialog
        destructive
        open={askNewRound}
        title="Start a new round?"
        message="Everyone comes back on the wheel, this round’s winners too. Winners already saved stay saved."
        confirmLabel="New round"
        onCancel={() => setAskNewRound(false)}
        onConfirm={() => void startNewRound()}
      />
    </>
  )
}
