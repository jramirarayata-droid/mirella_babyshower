import { Trophy } from 'lucide-react'
import type { PredictionsBoard } from '../../services/showerService'
import { cn } from '../ui/cn'
import { formatWeddingDate } from '../../utils/formatting'

const PINK = '#E98AA2'
const BLUE = '#6E9FD8'

/**
 * The predictions so far — Team Girl vs Team Boy, the average weight, the
 * favourite birthday — and, once the real answers are in, the closest guesses.
 * `big` = laid out for the big screen.
 */
export function PredictionsSummary({ board, big = false }: { board: PredictionsBoard; big?: boolean }) {
  const votes = board.girl + board.boy
  const girlPct = votes ? Math.round((board.girl / votes) * 100) : 50
  const fav = [...board.dueDates].sort((a, b) => b.n - a.n)[0]
  const results = board.closestDate.length > 0 || board.closestWeight.length > 0 || board.actual.gender !== null
  const card = cn('rounded-2xl border border-line bg-paper shadow-soft', big ? 'p-8' : 'p-5')
  const label = cn('uppercase tracking-[0.24em] text-muted', big ? 'text-base' : 'text-xs')
  const value = cn('font-serif text-ink', big ? 'text-6xl' : 'text-3xl')

  return (
    <section aria-label="Predictions so far" className={cn('space-y-5', big && 'space-y-8')}>
      <div className={card}>
        <div className="flex items-baseline justify-between gap-3">
          <p className={label}>Team Girl</p>
          <p className={cn(label, 'text-right')}>Team Boy</p>
        </div>
        <div className={cn('mt-3 flex overflow-hidden rounded-full bg-cream', big ? 'h-12' : 'h-7')} role="img" aria-label={`${board.girl} guessed girl, ${board.boy} guessed boy`}>
          <div className="flex items-center justify-start px-3 text-sm font-medium text-white transition-[width] duration-700" style={{ width: `${votes ? girlPct : 50}%`, background: PINK }}>
            {votes > 0 && board.girl > 0 && `${board.girl}`}
          </div>
          <div className="flex flex-1 items-center justify-end px-3 text-sm font-medium text-white" style={{ background: BLUE }}>
            {votes > 0 && board.boy > 0 && `${board.boy}`}
          </div>
        </div>
        <p className={cn('mt-3 text-center text-ink-soft', big ? 'text-xl' : 'text-sm')}>
          {board.count === 0 ? 'No guesses yet — be the first!' : `${board.count} ${board.count === 1 ? 'guess' : 'guesses'} so far`}
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className={cn(card, 'text-center')}>
          <p className={label}>Average weight guess</p>
          <p className={cn(value, 'mt-2')}>{board.avgWeightKg !== null ? `${board.avgWeightKg.toFixed(2)} kg` : '—'}</p>
        </div>
        <div className={cn(card, 'text-center')}>
          <p className={label}>Favourite birthday guess</p>
          <p className={cn(value, 'mt-2', !big && 'text-2xl')}>{fav ? formatWeddingDate(fav.date) : '—'}</p>
        </div>
      </div>

      {results && (
        <div className={cn(card, 'border-champagne')}>
          <p className={cn('flex items-center justify-center gap-2 font-serif text-ink', big ? 'text-4xl' : 'text-2xl')}>
            <Trophy aria-hidden="true" className={cn('text-gold', big ? 'size-9' : 'size-6')} strokeWidth={1.5} /> The closest guesses
          </p>
          <div className={cn('mt-5 grid gap-6', big ? 'sm:grid-cols-3' : 'sm:grid-cols-3')}>
            <Winners
              title="Birthday"
              actual={board.actual.birthDate ? formatWeddingDate(board.actual.birthDate) : null}
              rows={board.closestDate.map((w) => ({ name: w.name, detail: w.off === 0 ? 'spot on!' : `${w.off} ${w.off === 1 ? 'day' : 'days'} off` }))}
              big={big}
            />
            <Winners
              title="Weight"
              actual={board.actual.weightKg !== null ? `${board.actual.weightKg.toFixed(2)} kg` : null}
              rows={board.closestWeight.map((w) => ({ name: w.name, detail: w.off === 0 ? 'spot on!' : `${w.off.toFixed(2)} kg off` }))}
              big={big}
            />
            <Winners
              title="Boy or girl"
              actual={board.actual.gender ? (board.actual.gender === 'girl' ? 'A girl' : 'A boy') : null}
              rows={board.genderRight.slice(0, big ? 12 : 8).map((n) => ({ name: n, detail: '' }))}
              more={Math.max(0, board.genderRight.length - (big ? 12 : 8))}
              big={big}
            />
          </div>
        </div>
      )}
    </section>
  )
}

function Winners({ title, actual, rows, more = 0, big }: { title: string; actual: string | null; rows: { name: string; detail: string }[]; more?: number; big: boolean }) {
  return (
    <div className="text-center">
      <p className={cn('uppercase tracking-[0.24em] text-muted', big ? 'text-base' : 'text-xs')}>{title}</p>
      <p className={cn('mt-1 font-serif text-ink', big ? 'text-3xl' : 'text-xl')}>{actual ?? 'Not known yet'}</p>
      {actual && (
        <ol className={cn('mt-3 space-y-1', big ? 'text-2xl' : 'text-sm')}>
          {rows.length === 0 ? (
            <li className="text-muted">No guesses</li>
          ) : (
            rows.map((r, i) => (
              <li key={`${r.name}-${i}`} className="text-ink-soft">
                {i === 0 && r.detail ? '🏆 ' : ''}
                <span className="font-medium text-ink">{r.name}</span>
                {r.detail && <span className="text-muted"> · {r.detail}</span>}
              </li>
            ))
          )}
          {more > 0 && <li className="text-muted">and {more} more</li>}
        </ol>
      )}
    </div>
  )
}
