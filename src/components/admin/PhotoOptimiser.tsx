import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { makeMissingThumbs } from '../../services/galleryService'
import { toFriendlyMessage } from '../../utils/errors'

/**
 * Makes the small copies of older photos by itself when Photos & Video opens
 * (one pass; the full photos stay as they are). Shows progress, and a button
 * to run it again.
 */
export function PhotoOptimiser({ onDone }: { onDone?: () => void }) {
  const [state, setState] = useState<{ phase: 'idle' | 'running' | 'done' | 'error'; done: number; total: number; message?: string }>({ phase: 'idle', done: 0, total: 0 })
  const started = useRef(false)

  const run = async () => {
    setState({ phase: 'running', done: 0, total: 0 })
    try {
      const r = await makeMissingThumbs((done, total) => setState({ phase: 'running', done, total }))
      setState({ phase: 'done', done: r.done, total: r.total })
      if (r.done) onDone?.()
    } catch (e) {
      setState({ phase: 'error', done: 0, total: 0, message: toFriendlyMessage(e) })
    }
  }

  useEffect(() => {
    if (started.current) return
    started.current = true
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const text =
    state.phase === 'running'
      ? state.total
        ? `Optimising photos for faster loading… ${state.done} of ${state.total}`
        : 'Checking photos…'
      : state.phase === 'error'
        ? state.message
        : state.phase === 'done'
          ? state.total
            ? `Optimised ${state.done} of ${state.total} photos — the website now loads small copies in the galleries.`
            : 'All photos are optimised — the galleries load small copies, full size when opened.'
          : ''
  if (!text) return null
  return (
    <div role="status" className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink-soft shadow-soft">
      <Sparkles aria-hidden="true" className="size-4 shrink-0 text-gold" />
      <span className="min-w-0 flex-1">{text}</span>
      {(state.phase === 'error' || (state.phase === 'done' && state.done < state.total)) && (
        <button type="button" onClick={() => void run()} className="rounded-full border border-line px-3 py-1 text-sm text-ink hover:bg-cream">
          Optimise photos
        </button>
      )}
    </div>
  )
}
