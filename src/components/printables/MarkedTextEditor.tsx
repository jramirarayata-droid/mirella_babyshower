import { useId, useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import { Bold, Eraser, Highlighter, Italic } from 'lucide-react'
import { markedHtml } from '../../utils/printables'
import { clearMarks, toggleMark, type Mark } from '../../utils/printMarks'
import { cn } from '../ui/cn'

const BUTTONS: { mark: Mark; label: string; keys: string; Icon: typeof Bold }[] = [
  { mark: 'bold', label: 'Bold', keys: 'Ctrl+B', Icon: Bold },
  { mark: 'italic', label: 'Italic', keys: 'Ctrl+I', Icon: Italic },
  { mark: 'gold', label: 'Gold', keys: 'Ctrl+G', Icon: Highlighter },
]

interface Props {
  label: string
  value: string
  onChange: (v: string) => void
  /** Colour used for "Gold" in the preview (the design's accent). */
  accent: string
  rows?: number
  maxLength?: number
  hint?: string
}

/** A text box with Bold / Italic / Gold buttons for print-only wording, and a preview of how it prints. */
export function MarkedTextEditor({ label, value, onChange, accent, rows = 3, maxLength = 600, hint }: Props) {
  const id = useId()
  const box = useRef<HTMLTextAreaElement>(null)
  // Selection to restore once the new text is on screen (set right after React updates the box).
  const pending = useRef<{ start: number; end: number } | null>(null)
  useLayoutEffect(() => {
    const el = box.current
    const p = pending.current
    if (!el || !p) return
    pending.current = null
    el.focus()
    el.setSelectionRange(p.start, p.end)
  }, [value])

  const apply = (fn: (v: string, s: number, e: number) => { text: string; start: number; end: number }) => {
    const el = box.current
    if (!el) return
    const r = fn(value, el.selectionStart, el.selectionEnd)
    if (r.text.length > maxLength) return
    if (r.text === value) {
      el.focus()
      el.setSelectionRange(r.start, r.end)
      return
    }
    pending.current = { start: r.start, end: r.end }
    onChange(r.text)
  }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return
    const mark: Mark | null = e.key.toLowerCase() === 'b' ? 'bold' : e.key.toLowerCase() === 'i' ? 'italic' : e.key.toLowerCase() === 'g' ? 'gold' : null
    if (!mark) return
    e.preventDefault()
    apply((v, s, en) => toggleMark(v, s, en, mark))
  }
  const hasMarks = /\*\*|==|__/.test(value)

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <label htmlFor={id} className="text-sm text-ink-soft">
          {label}
        </label>
        <div role="toolbar" aria-label={`Formatting: ${label}`} className="flex gap-1">
          {BUTTONS.map(({ mark, label: l, keys, Icon }) => (
            <button
              key={mark}
              type="button"
              onMouseDown={(e) => e.preventDefault()} // keep the selection in the text box
              onClick={() => apply((v, s, en) => toggleMark(v, s, en, mark))}
              aria-label={l}
              title={`${l} (${keys}) — select words first`}
              className={cn(
                'grid size-8 place-items-center rounded-md border border-line text-ink-soft transition hover:border-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-gold',
                mark === 'gold' && 'text-gold',
              )}
            >
              <Icon aria-hidden="true" className="size-4" />
            </button>
          ))}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => apply(clearMarks)}
            disabled={!hasMarks}
            aria-label="Clear formatting"
            title="Clear formatting (of the selected words, or all)"
            className="grid size-8 place-items-center rounded-md border border-line text-muted transition hover:border-ink-soft hover:text-ink disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-gold"
          >
            <Eraser aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>
      <textarea
        ref={box}
        id={id}
        rows={rows}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKey}
        className="input-base mt-1.5 py-2 font-mono text-[0.9rem] leading-relaxed"
        aria-describedby={`${id}-preview`}
      />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      <div id={`${id}-preview`} className="mt-2 rounded-lg border border-line bg-paper px-3 py-2">
        <span className="block text-[0.7rem] uppercase tracking-wider text-muted">Prints as</span>
        <p
          data-print-preview
          className="mt-0.5 text-sm leading-relaxed text-ink-soft"
          // markedHtml escapes everything before adding its own tags.
          dangerouslySetInnerHTML={{ __html: value.trim() ? markedHtml(value, { ink: 'var(--color-ink)', accent }) : '<span style="opacity:.6">(empty)</span>' }}
        />
      </div>
    </div>
  )
}
