import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trash2, Tv } from 'lucide-react'
import { SectionAccess } from '../components/admin/SectionAccess'
import { PageHeader } from '../components/admin/PageHeader'
import { DateTimeField, SavedText, useAutoSaved, StartField } from '../components/admin/ShowerAdminBits'
import { PredictionsSummary } from '../components/shower/PredictionsSummary'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { useToast } from '../hooks/useToast'
import {
  deletePrediction,
  getPredictionsBoard,
  getPredictionsSettings,
  listPredictionsAdmin,
  savePredictionsSettings,
  type AdminPrediction,
  type PredictionsBoard,
} from '../services/showerService'
import { toFriendlyMessage } from '../utils/errors'
import { formatShortDate, formatWeddingDate } from '../utils/formatting'

/** Admin → Predictions: when guessing is open, every guess, and — after the birth — the real answers. */
export default function AdminPredictions() {
  const toast = useToast()
  const settings = useAutoSaved(getPredictionsSettings, savePredictionsSettings)
  const [list, setList] = useState<AdminPrediction[] | null>(null)
  const [board, setBoard] = useState<PredictionsBoard | null>(null)
  const [removing, setRemoving] = useState<AdminPrediction | null>(null)

  const reload = useCallback(async () => {
    try {
      const [l, b] = await Promise.all([listPredictionsAdmin(), getPredictionsBoard()])
      setList(l)
      setBoard(b)
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    }
  }, [toast])

  useEffect(() => {
    document.title = 'Predictions · Baby shower admin'
    void reload()
  }, [reload])

  // The winners follow the real answers as soon as they're saved.
  useEffect(() => {
    if (settings.state === 'saved') void reload()
  }, [settings.state, reload])

  const s = settings.value
  return (
    <>
      <PageHeader title="Baby Predictions" description="Guests guess the birthday, the weight and boy or girl. Type in the real answers after the birth and the closest guesses are named." />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {board ? <PredictionsSummary board={board} /> : <Skeleton className="h-48" />}
          <section className="overflow-hidden rounded-xl border border-line bg-paper shadow-soft">
            <h2 className="border-b border-line px-5 py-3 font-sans text-sm font-semibold uppercase tracking-[0.14em] text-muted">Every guess ({list?.length ?? 0})</h2>
            {!list ? (
              <Skeleton className="m-4 h-24" />
            ) : list.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted">No guesses yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-cream text-xs uppercase tracking-[0.12em] text-muted">
                    <tr>
                      <th className="px-4 py-2 font-medium">Guest</th>
                      <th className="px-4 py-2 font-medium">Birthday</th>
                      <th className="px-4 py-2 font-medium">Weight</th>
                      <th className="px-4 py-2 font-medium">Boy or girl</th>
                      <th className="px-4 py-2 font-medium">When</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {list.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-2 text-ink">{p.name}</td>
                        <td className="px-4 py-2">{p.dueDate ? formatWeddingDate(p.dueDate) : '—'}</td>
                        <td className="px-4 py-2 tabular-nums">{p.weightKg !== null ? `${p.weightKg.toFixed(2)} kg` : '—'}</td>
                        <td className="px-4 py-2">{p.gender === 'girl' ? 'Girl' : p.gender === 'boy' ? 'Boy' : '—'}</td>
                        <td className="px-4 py-2 text-muted">{formatShortDate(p.at)}</td>
                        <td className="px-2 py-2 text-right">
                          <Button size="sm" variant="danger-quiet" aria-label={`Remove ${p.name}’s guess`} onClick={() => setRemoving(p)} icon={<Trash2 aria-hidden="true" className="size-4" />} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
        <aside className="space-y-5 rounded-xl border border-line bg-paper p-5 shadow-soft">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-xl text-ink">Settings</h2>
            <SavedText state={settings.state} />
          </div>
          {!s ? (
            <Skeleton className="h-60" />
          ) : (
            <>
              <SectionAccess
                what="predictions"
                hidden={s.mode === 'hidden'}
                onHiddenChange={(h) => settings.update({ mode: h ? 'hidden' : 'visible' })}
                timing={<StartField mode={s.mode} from={s.from} onChange={settings.update} />}
              />
              <DateTimeField label="Guessing closes (optional)" value={s.closeAt} onChange={(closeAt) => settings.update({ closeAt })} clearable hint="Empty = it closes at the gender reveal (if set)." />
              <div className="border-t border-line pt-4">
                <p className="font-medium text-ink">After the birth: the real answers</p>
                <p className="text-xs text-muted">The website then names the closest guesses. Boy or girl comes from the gender reveal.</p>
                <label className="mt-3 block text-sm text-ink-soft">
                  Birthday
                  <input type="date" className="input-base mt-1.5" value={s.birthDate ?? ''} onChange={(e) => settings.update({ birthDate: e.target.value || null })} />
                </label>
                <label className="mt-3 block text-sm text-ink-soft">
                  Weight (kg)
                  <input
                    type="number"
                    step="0.01"
                    min={0.5}
                    max={7}
                    className="input-base mt-1.5"
                    value={s.weightKg ?? ''}
                    onChange={(e) => settings.update({ weightKg: e.target.value ? Math.round(Number(e.target.value) * 100) / 100 : null })}
                  />
                </label>
              </div>
            </>
          )}
          <Link to="/show/predictions" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-champagne px-5 text-sm text-ink transition hover:bg-champagne-light/40">
            <Tv aria-hidden="true" className="size-4 text-gold" /> Present on the big screen
          </Link>
        </aside>
      </div>
      <ConfirmDialog
        open={Boolean(removing)}
        title="Remove this guess?"
        message={removing ? `${removing.name}’s guess will be removed. They can guess again while the game is open.` : ''}
        confirmLabel="Remove"
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const p = removing
          setRemoving(null)
          if (p)
            void deletePrediction(p.id)
              .then(reload)
              .catch((e) => toast.error(toFriendlyMessage(e)))
        }}
      />
    </>
  )
}
