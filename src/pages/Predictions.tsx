import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CalendarHeart, Scale, Sparkles } from 'lucide-react'
import { ShowerShell, GuestGate, NotYet, SignedInAs, KeptFor } from '../components/shower/ShowerShell'
import { PredictionsSummary } from '../components/shower/PredictionsSummary'
import { PageLoader } from '../components/ui/Spinner'
import { Button } from '../components/ui/Button'
import { cn } from '../components/ui/cn'
import { Confetti } from '../components/photos/PetalBurst'
import { useToast } from '../hooks/useToast'
import { currentShowerGuest, getPredictionsBoard, getPredictionsInfo, savePrediction, type PredictionsBoard, type PredictionsInfo, type ShowerGuest } from '../services/showerService'
import { forgetKnownGuest } from '../utils/guestIdentity'
import { toFriendlyMessage } from '../utils/errors'
import { formatDeadlineDateTime } from '../utils/formatting'

/** #/predict — the baby predictions game: due date, weight, boy or girl. */
export default function Predictions() {
  const toast = useToast()
  const [guest, setGuest] = useState<ShowerGuest | null>(() => currentShowerGuest())
  const [info, setInfo] = useState<PredictionsInfo | null>(null)
  const [board, setBoard] = useState<PredictionsBoard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [due, setDue] = useState('')
  const [weight, setWeight] = useState('')
  const [gender, setGender] = useState<'girl' | 'boy' | null>(null)
  const [saving, setSaving] = useState(false)
  const [cheer, setCheer] = useState(0)

  const load = useCallback(async (token?: string | null) => {
    try {
      const [i, b] = await Promise.all([getPredictionsInfo(token), getPredictionsBoard(token)])
      setInfo(i)
      setBoard(b)
      setError(null)
      if (i.mine) {
        setDue(i.mine.dueDate ?? '')
        setWeight(i.mine.weightKg !== null ? String(i.mine.weightKg) : '')
        setGender(i.mine.gender)
      }
      if (token && !i.me) setGuest(null)
    } catch (e) {
      setError(toFriendlyMessage(e))
    }
  }, [])

  useEffect(() => {
    document.title = 'Baby Predictions'
    void load(guest?.token)
  }, [load, guest])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!guest) return
    const kg = weight.trim() ? Number(weight.replace(',', '.')) : null
    if (kg !== null && (!Number.isFinite(kg) || kg < 0.5 || kg > 7)) {
      toast.error('Please give a weight between 0.5 and 7 kg (e.g. 3.2).')
      return
    }
    if (!due && kg === null && !gender) {
      toast.error('Make at least one guess.')
      return
    }
    setSaving(true)
    try {
      const r = await savePrediction(guest.token, { dueDate: due || null, weightKg: kg, gender })
      if (r.ok) {
        toast.success(info?.mine ? 'Your guess is updated. Good luck!' : 'Your guess is in. Good luck!')
        setCheer((c) => c + 1)
        await load(guest.token)
      } else if (r.reason === 'closed') toast.error('Guessing is closed now. Thank you for playing!')
      else if (r.reason === 'who') setGuest(null)
      else toast.error('Please check your guesses and try again.')
    } catch (err) {
      toast.error(toFriendlyMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ShowerShell
      title="Baby Predictions"
      intro={info?.visible ? 'When will our little one arrive, how much will they weigh — and is it a boy or a girl? The closest guesses win!' : undefined}
    >
      {!info && !error ? (
        <PageLoader label="Loading the game" />
      ) : error && !info ? (
        <p className="text-center text-ink-soft">{error}</p>
      ) : info && info.private ? (
        <KeptFor section="predictions" what="The predictions game" onReady={setGuest} />
      ) : info && !info.visible ? (
        <NotYet what="The predictions game" />
      ) : info ? (
        <div className="space-y-10">
          {info.open ? (
            guest ? (
              <form onSubmit={submit} className="fine-frame mx-auto max-w-xl space-y-6 rounded-2xl border border-line bg-paper p-6 shadow-soft sm:p-8">
                <SignedInAs
                  name={guest.name}
                  onSwitch={() => {
                    forgetKnownGuest()
                    setGuest(null)
                  }}
                />
                <label className="block">
                  <span className="flex items-center gap-2 text-[1.05rem] font-medium text-ink">
                    <CalendarHeart aria-hidden="true" className="size-5 text-gold" strokeWidth={1.6} /> Birthday guess
                  </span>
                  <input type="date" className="input-base mt-2" value={due} onChange={(e) => setDue(e.target.value)} />
                </label>
                <label className="block">
                  <span className="flex items-center gap-2 text-[1.05rem] font-medium text-ink">
                    <Scale aria-hidden="true" className="size-5 text-gold" strokeWidth={1.6} /> Weight guess (kg)
                  </span>
                  <input type="number" inputMode="decimal" step="0.01" min={0.5} max={7} placeholder="e.g. 3.2" className="input-base mt-2" value={weight} onChange={(e) => setWeight(e.target.value)} />
                </label>
                <fieldset>
                  <legend className="flex items-center gap-2 text-[1.05rem] font-medium text-ink">
                    <Sparkles aria-hidden="true" className="size-5 text-gold" strokeWidth={1.6} /> Boy or girl?
                  </legend>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(
                      [
                        ['girl', 'Girl', 'bg-[#F9D3DD] border-[#E98AA2] text-[#7A2E43]'],
                        ['boy', 'Boy', 'bg-[#D4E5F7] border-[#6E9FD8] text-[#23466F]'],
                      ] as const
                    ).map(([v, l, on]) => (
                      <button
                        key={v}
                        type="button"
                        aria-pressed={gender === v}
                        onClick={() => setGender(gender === v ? null : v)}
                        className={cn('min-h-14 rounded-xl border-2 text-lg font-medium transition', gender === v ? on : 'border-line bg-paper text-ink-soft hover:border-champagne')}
                      >
                        Team {l}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <Button type="submit" fullWidth size="lg" loading={saving} loadingText="Saving…" className="lux-cta">
                  {info.mine ? 'Update my guess' : 'Lock in my guess'}
                </Button>
                {info.closeAt && <p className="text-center text-xs text-muted">Guesses close {formatDeadlineDateTime(info.closeAt)}.</p>}
              </form>
            ) : (
              <GuestGate why="So the winners can be named — guests only see your first name and initial." onReady={setGuest} />
            )
          ) : (
            <p className="text-center text-ink-soft">Guessing is closed — thank you for playing!{info.mine ? ' Your guess is saved.' : ''}</p>
          )}
          {board && <PredictionsSummary board={board} />}
        </div>
      ) : null}
      {cheer > 0 && <Confetti key={cheer} count={22} />}
    </ShowerShell>
  )
}
