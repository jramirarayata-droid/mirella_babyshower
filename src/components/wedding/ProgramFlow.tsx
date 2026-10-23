import type { ProgramItem } from '../../types/wedding'
import { Ornament } from '../ui/Ornament'
import { cn } from '../ui/cn'
import { Reveal } from './Reveal'
import { useSectionText } from '../../hooks/useSectionText'

/** The moments on a fine line, time on the left (also used for the preview in Website Settings). */
export function ProgramTimeline({ items, className }: { items: ProgramItem[]; className?: string }) {
  const hasTimes = items.some((i) => i.time.trim())
  return (
    <ol className={cn('mx-auto max-w-2xl text-left', className)}>
      {items.map((it, i) => (
        <li
          key={it.id}
          className={cn('relative grid pb-9 last:pb-0', hasTimes ? 'grid-cols-[5.25rem_1fr] gap-x-7 sm:grid-cols-[9rem_1fr] sm:gap-x-10' : 'grid-cols-[0_1fr] gap-x-7')}
        >
          <p className="pt-[0.2rem] text-right text-[0.72rem] font-medium uppercase leading-snug tracking-[0.18em] text-gold">{it.time}</p>
          {i < items.length - 1 && (
            <span
              aria-hidden="true"
              className={cn('absolute top-[0.7rem] -bottom-[0.7rem] w-px -translate-x-1/2 bg-champagne/50', hasTimes ? 'left-[calc(5.25rem+0.875rem)] sm:left-[calc(9rem+1.25rem)]' : 'left-[0.875rem]')}
            />
          )}
          <span
            aria-hidden="true"
            className={cn(
              'absolute top-[0.4rem] size-[0.6rem] -translate-x-1/2 rounded-full border border-champagne bg-ivory',
              hasTimes ? 'left-[calc(5.25rem+0.875rem)] sm:left-[calc(9rem+1.25rem)]' : 'left-[0.875rem]',
            )}
          />
          <div className="min-w-0">
            <h3 className="font-serif text-[1.4rem] leading-snug text-ink sm:text-[1.55rem]">{it.title}</h3>
            {it.description.trim() && <p className="mt-1 text-[0.95rem] leading-relaxed text-ink-soft">{it.description}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}

/** Program flow on the home page (Admin → Website Settings → Program flow). */
export function ProgramFlow({ title, subtitle, items }: { title: string; subtitle: string; items: ProgramItem[] }) {
  const t = useSectionText('program')
  const visible = items.filter((i) => i.title.trim())
  if (!visible.length) return null
  return (
    <section aria-labelledby="program-heading" className="px-5 py-24 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <Reveal className="section-title text-center">
          <p className="eyebrow">{t('eyebrow', 'Order of the Day')}</p>
          <h2 id="program-heading" className="mt-4 text-4xl text-ink sm:text-5xl">
            {title.trim() || 'Program'}
          </h2>
          {subtitle.trim() && <p className="mx-auto mt-4 max-w-lg text-ink-soft">{subtitle}</p>}
          <Ornament className="mt-8" />
        </Reveal>
        <Reveal className="mt-14">
          <ProgramTimeline items={visible} />
        </Reveal>
      </div>
    </section>
  )
}
