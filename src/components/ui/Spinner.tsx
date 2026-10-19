import { cn } from './cn'
import { Monogram } from '../wedding/Monogram'

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2', className)}>
      <span
        aria-hidden="true"
        className="inline-block size-4 animate-spin rounded-full border-[1.5px] border-current border-r-transparent opacity-80"
      />
      <span className={label ? '' : 'sr-only'}>{label ?? 'Loading'}</span>
    </span>
  )
}

export function PageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-muted">
      <Monogram className="animate-pulse font-serif text-3xl italic text-champagne" height="56px" />
      <Spinner label={label} className="text-sm tracking-wide" />
    </div>
  )
}
