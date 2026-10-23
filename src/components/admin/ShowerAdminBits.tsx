import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../ui/Button'
import { RevealNote } from './RevealNote'
import { fromManilaParts, toManilaParts } from '../../utils/formatting'
import { toFriendlyMessage } from '../../utils/errors'
import { useToast } from '../../hooks/useToast'
import type { Visibility } from '../../services/showerService'

/** A date and a time in Philippine time (stored as an ISO moment). */
export function DateTimeField({ label, value, onChange, clearable, hint }: { label: string; value: string | null; onChange: (v: string | null) => void; clearable?: boolean; hint?: string }) {
  const parts = value ? toManilaParts(value) : { date: '', time: '' }
  return (
    <div className="text-sm text-ink-soft">
      <span className="font-medium text-ink">{label}</span>
      <div className="mt-1.5 grid grid-cols-[1fr_1fr_auto] gap-2">
        <input type="date" className="input-base" aria-label={`${label} — date`} value={parts.date} onChange={(e) => onChange(e.target.value ? fromManilaParts(e.target.value, parts.time || '00:00') : null)} />
        <input type="time" className="input-base" aria-label={`${label} — time`} value={parts.time} onChange={(e) => parts.date && onChange(fromManilaParts(parts.date, e.target.value || '00:00'))} />
        {clearable && value ? (
          <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
            Clear
          </Button>
        ) : (
          <span />
        )}
      </div>
      <p className="mt-1 text-xs text-muted">{hint ? `${hint} ` : ''}Philippine time.</p>
    </div>
  )
}

/** "Shows on the website": hidden, visible, from a date, or on the reveal date (Schedule). */
export function VisibilityField({ label, mode, from, onChange }: { label: string; mode: Visibility; from: string | null; onChange: (patch: { mode?: Visibility; from?: string | null }) => void }) {
  return (
    <div className="space-y-3">
      <label className="block text-sm text-ink-soft">
        <span className="font-medium text-ink">{label}</span>
        <select className="input-base mt-1.5" value={mode} onChange={(e) => onChange({ mode: e.target.value as Visibility })}>
          <option value="hidden">Hidden</option>
          <option value="visible">Visible</option>
          <option value="scheduled">Visible from a date</option>
          <option value="reveal">On the reveal date</option>
        </select>
      </label>
      {mode === 'reveal' && <RevealNote />}
      {mode === 'scheduled' && <DateTimeField label="Visible from" value={from} onChange={(v) => onChange({ from: v })} />}
    </div>
  )
}

/** When a switched-on section starts showing (Who sees it handles Hidden). */
export function StartField({ mode, from, onChange }: { mode: Visibility; from: string | null; onChange: (patch: { mode?: Visibility; from?: string | null }) => void }) {
  const m = mode === 'hidden' ? 'visible' : mode
  return (
    <div className="space-y-3">
      <label className="block text-sm text-ink-soft">
        <span className="font-medium text-ink">When it starts</span>
        <select className="input-base mt-1.5" value={m} onChange={(e) => onChange({ mode: e.target.value as Visibility })}>
          <option value="visible">Right away</option>
          <option value="scheduled">From a date</option>
          <option value="reveal">On the reveal date</option>
        </select>
      </label>
      {m === 'reveal' && <RevealNote />}
      {m === 'scheduled' && <DateTimeField label="Starts on" value={from} onChange={(v) => onChange({ from: v })} />}
    </div>
  )
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Settings that save as you go: `value` is shown straight away and saved a
 * moment after the last change.
 */
export function useAutoSaved<T>(load: () => Promise<T>, save: (v: T) => Promise<void>) {
  const toast = useToast()
  const [value, setValue] = useState<T | null>(null)
  const [state, setState] = useState<SaveState>('idle')
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<number | null>(null)
  const latest = useRef<T | null>(null)
  useEffect(() => {
    let alive = true
    load()
      .then((v) => alive && setValue(v))
      .catch((e) => alive && setError(toFriendlyMessage(e)))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const update = useCallback(
    (patch: Partial<T>) => {
      setValue((v) => {
        if (!v) return v
        const next = { ...v, ...patch }
        latest.current = next
        return next
      })
      setState('saving')
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        const v = latest.current
        if (!v) return
        save(v)
          .then(() => setState('saved'))
          .catch((e) => {
            setState('error')
            toast.error(toFriendlyMessage(e))
          })
      }, 500)
    },
    [save, toast],
  )
  return { value, update, state, error }
}

export function SavedText({ state }: { state: SaveState }) {
  return (
    <span className="text-xs text-muted" aria-live="polite">
      {state === 'saving' ? 'Saving…' : state === 'saved' ? 'All changes saved' : state === 'error' ? 'Couldn’t save — please try again' : 'Changes save as you go'}
    </span>
  )
}
