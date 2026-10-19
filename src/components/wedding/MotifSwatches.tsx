import type { MotifColor } from '../../types/wedding'
import { cn } from '../ui/cn'

/** Row of dress-code motif colour swatches. */
export function MotifSwatches({ title, colors, className }: { title: string; colors: MotifColor[]; className?: string }) {
  if (!colors.length) return null
  return (
    <div className={cn('text-center', className)}>
      {title && <p className="text-[0.72rem] font-medium uppercase tracking-[0.3em] text-gold">{title}</p>}
      <ul className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-5" aria-label={title || 'Motif colours'}>
        {colors.map((c) => (
          <li key={c.id} className="flex w-20 flex-col items-center gap-2">
            <span
              aria-hidden="true"
              className="size-14 rounded-full shadow-soft ring-1 ring-black/10 ring-offset-4 ring-offset-transparent"
              style={{ backgroundColor: c.hex }}
            />
            <span className="text-sm leading-tight text-ink-soft">{c.name || c.hex}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Stand-alone motif section, used when the outfit gallery is hidden. */
export function MotifSection({ title, colors }: { title: string; colors: MotifColor[] }) {
  if (!colors.length) return null
  return (
    <section aria-label={title || 'Motif colours'} className="bg-cream/60 px-5 py-20 sm:px-8">
      <MotifSwatches title={title} colors={colors} />
    </section>
  )
}
