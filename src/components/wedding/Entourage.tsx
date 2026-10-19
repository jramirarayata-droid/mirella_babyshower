import type { EntourageGroup } from '../../types/wedding'
import { Ornament } from '../ui/Ornament'
import { cn } from '../ui/cn'
import { Reveal } from './Reveal'

interface Props {
  title: string
  subtitle: string
  groups: EntourageGroup[]
}

/** Traditional Filipino entourage listing, in processional order. */
export function Entourage({ title, subtitle, groups }: Props) {
  const visible = groups.filter((g) => g.members.some((m) => m.name.trim()))
  if (!visible.length) return null

  return (
    <section aria-labelledby="entourage-heading" className="px-5 py-24 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <Reveal className="section-title text-center">
          <p className="eyebrow">With Love &amp; Gratitude</p>
          <h2 id="entourage-heading" className="mt-4 text-4xl text-ink sm:text-5xl">
            {title}
          </h2>
          {subtitle && <p className="mx-auto mt-4 max-w-lg text-ink-soft">{subtitle}</p>}
          <Ornament className="mt-8" />
        </Reveal>

        <div className="mt-14 space-y-14">
          {visible.map((g) => {
            const members = g.members.filter((m) => m.name.trim())
            return (
              <Reveal key={g.id} className="text-center">
                <h3 className="lux-subhead font-sans text-[0.75rem] font-medium uppercase tracking-[0.32em] text-gold">{g.title}</h3>
                <ul
                  className={cn(
                    'mx-auto mt-5 grid gap-y-3',
                    g.layout === 'pairs' && members.length > 1 ? 'max-w-2xl grid-cols-1 gap-x-10 min-[480px]:grid-cols-2' : 'max-w-md grid-cols-1',
                  )}
                >
                  {members.map((m) => (
                    <li key={m.id} className="leading-snug">
                      <span className="font-serif text-[1.35rem] text-ink">{m.name}</span>
                      {m.role && <span className="mt-0.5 block text-xs uppercase tracking-[0.2em] text-muted">{m.role}</span>}
                    </li>
                  ))}
                </ul>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
