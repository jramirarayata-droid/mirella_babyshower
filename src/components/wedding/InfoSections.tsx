import type { InfoSection } from '../../types/wedding'
import { Ornament } from '../ui/Ornament'
import { cn } from '../ui/cn'
import { Reveal } from './Reveal'
import { SectionIcon } from './SectionIcon'

/** Admin-managed information sections (Dress Code, Gifts, …) loaded from Supabase. */
export function InfoSections({ sections }: { sections: InfoSection[] }) {
  const visible = sections.filter((s) => s.visible && (s.title.trim() || s.body.trim()))
  if (!visible.length) return null

  return (
    <section aria-labelledby="info-heading" className="px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal className="section-title text-center">
          <p className="eyebrow">Good to Know</p>
          <h2 id="info-heading" className="mt-4 text-4xl text-ink sm:text-5xl">
            Wedding Details
          </h2>
          <Ornament className="mt-8" />
        </Reveal>

        <div className="mt-16 grid gap-x-10 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((s, i) => (
            <Reveal
              key={s.id}
              delay={(i % 3) * 0.08}
              className={cn(visible.length % 3 === 1 && i === visible.length - 1 && 'lg:col-start-2')}
            >
              <article className="flex h-full flex-col items-center text-center">
                <span className="lux-icon flex size-16 items-center justify-center rounded-full border border-champagne/50 text-champagne">
                  <SectionIcon name={s.icon} className="size-6" />
                </span>
                <h3 className="mt-6 text-[1.9rem] leading-tight text-ink">{s.title}</h3>
                <div className="mt-4 max-w-sm space-y-3 text-[0.98rem] leading-relaxed text-ink-soft">
                  {s.body
                    .split(/\n+/)
                    .filter((p) => p.trim())
                    .map((p, j) => (
                      <p key={j}>{p}</p>
                    ))}
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
