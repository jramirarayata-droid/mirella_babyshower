import { Check, CircleDot } from 'lucide-react'
import { cn } from './cn'

/** A small "Saved" / "Unsaved changes" / "Saving…" note next to a Save button. */
export function SaveStatus({ dirty, saving, className }: { dirty: boolean; saving?: boolean; className?: string }) {
  return (
    <span role="status" aria-live="polite" data-save-status={saving ? 'saving' : dirty ? 'unsaved' : 'saved'} className={cn('inline-flex items-center gap-1.5 text-xs', dirty || saving ? 'text-gold' : 'text-muted', className)}>
      {saving ? (
        'Saving…'
      ) : dirty ? (
        <>
          <CircleDot aria-hidden="true" className="size-3.5" /> Unsaved changes
        </>
      ) : (
        <>
          <Check aria-hidden="true" className="size-3.5" /> All changes saved
        </>
      )}
    </span>
  )
}
