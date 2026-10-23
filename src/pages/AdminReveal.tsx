import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, Save, Sparkles, Tv } from 'lucide-react'
import { PageHeader } from '../components/admin/PageHeader'
import { DateTimeField } from '../components/admin/ShowerAdminBits'
import { Button } from '../components/ui/Button'
import { TextAreaField, TextField } from '../components/ui/FormField'
import { Skeleton } from '../components/ui/Skeleton'
import { SaveStatus } from '../components/ui/SaveStatus'
import { cn } from '../components/ui/cn'
import { useToast } from '../hooks/useToast'
import { ANSWER_LABEL, getRevealSettings, saveRevealSettings, type RevealAnswer, type RevealSettings } from '../services/showerService'
import { FriendlyError, toFriendlyMessage } from '../utils/errors'
import { SectionAccess } from '../components/admin/SectionAccess'
import { formatDateTime } from '../utils/formatting'
import { SectionWords, smallLine } from '../components/admin/SectionWords'

const ANSWERS: RevealAnswer[] = ['girl', 'boy', 'twin_girls', 'twin_boys', 'twins']

/**
 * Admin → Gender Reveal: the answer (kept masked on this screen until you
 * choose to look), when it's revealed, and the words around it. The website
 * can't see the answer before the reveal time; the host can also reveal it
 * on the spot from the big screen.
 */
export default function AdminReveal() {
  const toast = useToast()
  const [saved, setSaved] = useState<RevealSettings | null>(null)
  const [v, setV] = useState<RevealSettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [peek, setPeek] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    document.title = 'Gender Reveal · Baby shower admin'
    getRevealSettings()
      .then((s) => {
        setSaved(s)
        setV(s)
      })
      .catch((e) => setError(toFriendlyMessage(e)))
  }, [])

  const dirty = Boolean(v && saved && JSON.stringify(v) !== JSON.stringify(saved))
  const save = async () => {
    if (!v) return
    if (v.enabled && !v.answer) {
      toast.error('Choose the answer first (it stays secret).')
      return
    }
    setSaving(true)
    try {
      await saveRevealSettings(v)
      setSaved(v)
      toast.success(v.enabled ? 'Saved. The website counts down to the reveal.' : 'Saved.')
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const revealed = Boolean(saved?.enabled && saved.answer && saved.revealAt && new Date(saved.revealAt).getTime() <= Date.now())

  return (
    <>
      <PageHeader
        title="Gender Reveal"
        description="Keep it secret until the moment you choose — then it appears on the website and on the big screen, with confetti."
        actions={
          <>
            <SaveStatus dirty={dirty} saving={saving} />
            <Button onClick={() => void save()} loading={saving} loadingText="Saving…" disabled={!dirty} icon={<Save aria-hidden="true" className="size-4" />}>
              Save
            </Button>
          </>
        }
      />
      {error && <p className="mb-4 rounded-lg bg-rose/5 p-3 text-sm text-rose">{error}</p>}
      {!v ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <section className="space-y-5 rounded-xl border border-line bg-paper p-5 shadow-soft">
            <SectionAccess
              what="reveal"
              hidden={!(saved ?? v).enabled}
              onHiddenChange={async (h) => {
                const next = { ...v, enabled: !h }
                if (next.enabled && !next.answer) throw new FriendlyError('Choose the answer first (it stays secret).')
                await saveRevealSettings(next)
                setSaved(next)
                setV(next)
              }}
            />
            <p className="-mt-2 text-xs text-muted">A countdown first, then the answer at the reveal time.</p>
            <SectionWords
              sectionKey="reveal"
              fields={[
                smallLine('Gender Reveal'),
                { field: 'after', label: 'Title after the reveal', usual: 'The secret is out!' },
                { field: 'revealedIn', label: 'Above the countdown', usual: 'Revealed in' },
                { field: 'stayTuned', label: 'When there’s no countdown', usual: 'Revealed at the shower — stay tuned!' },
                { field: 'teamGirl', label: 'Team girl label', usual: 'Team Girl' },
                { field: 'teamBoy', label: 'Team boy label', usual: 'Team Boy' },
                { field: 'days', label: 'Countdown: days', usual: 'days' }, { field: 'hours', label: 'Countdown: hours', usual: 'hours' }, { field: 'minutes', label: 'Countdown: minutes', usual: 'minutes' },
              ]}
            />

            <fieldset>
              <legend className="mb-2 flex w-full items-center justify-between text-sm font-medium text-ink">
                The answer
                <button type="button" onClick={() => setPeek((p) => !p)} className="inline-flex items-center gap-1 text-xs font-normal text-muted hover:text-ink">
                  {peek ? <EyeOff aria-hidden="true" className="size-3.5" /> : <Eye aria-hidden="true" className="size-3.5" />}
                  {peek ? 'Hide' : 'Show'}
                </button>
              </legend>
              {peek ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {ANSWERS.map((a) => (
                    <button
                      key={a}
                      type="button"
                      aria-pressed={v.answer === a}
                      onClick={() => setV({ ...v, answer: a })}
                      className={cn('min-h-11 rounded-lg border px-3 text-sm transition', v.answer === a ? 'border-ink bg-ink text-ivory' : 'border-line text-ink-soft hover:border-champagne')}
                    >
                      {ANSWER_LABEL[a]}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-line bg-cream px-4 py-4 text-sm text-ink-soft">
                  {v.answer ? '•••••• (set — tap Show to see or change it)' : 'Not set yet — tap Show to choose it.'}
                </div>
              )}
              <p className="mt-2 text-xs text-muted">It stays masked here so no one sees it over your shoulder. Guests can’t see it before the reveal time.</p>
            </fieldset>

            <DateTimeField
              label="Reveal time"
              value={v.revealAt}
              onChange={(revealAt) => setV({ ...v, revealAt })}
              clearable
              hint="Leave empty to reveal it yourself at the shower, from the big screen."
            />
            {revealed && <p className="rounded-lg bg-sage/10 px-3 py-2 text-sm text-sage">Revealed {saved?.revealAt ? formatDateTime(saved.revealAt) : ''}. Guests see the answer now.</p>}
            <TextField label="Title before the reveal" value={v.title} onChange={(title) => setV({ ...v, title })} maxLength={80} placeholder="Boy or Girl?" />
            <TextAreaField label="Message before the reveal" value={v.message} onChange={(message) => setV({ ...v, message })} maxLength={300} rows={2} />
            <p className="text-xs text-muted">Baby predictions close at the reveal time (unless you set another time in Predictions).</p>
          </section>

          <section className="space-y-4 rounded-xl border border-line bg-paper p-5 shadow-soft">
            <h2 className="flex items-center gap-2 text-xl text-ink">
              <Sparkles aria-hidden="true" className="size-5 text-gold" strokeWidth={1.6} /> At the shower
            </h2>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-soft">
              <li>Connect a laptop to the TV and open the website.</li>
              <li>
                Menu → <b className="font-medium text-ink">Host mode</b> (or be signed in here), then <b className="font-medium text-ink">Present the gender reveal</b>.
              </li>
              <li>It counts down to the reveal time — or press <b className="font-medium text-ink">Reveal now</b> for a drumroll and the big moment.</li>
            </ol>
            <Link
              to="/show/reveal"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-champagne px-5 text-sm text-ink transition hover:bg-champagne-light/40"
            >
              <Tv aria-hidden="true" className="size-4 text-gold" /> Open the big screen
            </Link>
          </section>
        </div>
      )}
    </>
  )
}
