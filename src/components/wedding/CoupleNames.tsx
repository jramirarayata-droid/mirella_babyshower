import { cn } from '../ui/cn'

/** Renders "Mir & Ella" with a refined italic ampersand. */
export function CoupleNames({ names, className, ampClassName }: { names: string; className?: string; ampClassName?: string }) {
  const parts = names.split(/\s*&\s*|\s+and\s+/i)
  if (parts.length !== 2) return <span className={className}>{names}</span>
  return (
    <span className={className}>
      {parts[0]}
      <span className={cn('mx-[0.18em] font-light italic', ampClassName ?? 'text-champagne')} aria-label="and">
        &amp;
      </span>
      {parts[1]}
    </span>
  )
}
