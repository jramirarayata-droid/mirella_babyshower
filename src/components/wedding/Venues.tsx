import { Church, ExternalLink, Wine, type LucideIcon } from 'lucide-react'
import type { WeddingSettings } from '../../types/wedding'
import { Reveal } from './Reveal'

interface Venue {
  label: string
  name: string
  time: string
  mapUrl: string
  icon: LucideIcon
}

export function Venues({ settings }: { settings: WeddingSettings }) {
  const venues: Venue[] = [
    { label: 'Ceremony', name: settings.churchName, time: settings.ceremonyTime, mapUrl: settings.churchMapUrl, icon: Church },
    { label: 'Reception', name: settings.receptionName, time: settings.receptionTime, mapUrl: settings.receptionMapUrl, icon: Wine },
  ].filter((v) => v.name)

  if (!venues.length) return null

  return (
    <section aria-labelledby="venues-heading" className="bg-cream/60 px-5 py-24 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <Reveal className="section-title text-center">
          <p className="eyebrow">Where</p>
          <h2 id="venues-heading" className="mt-4 text-4xl text-ink sm:text-5xl">
            Ceremony &amp; Reception
          </h2>
        </Reveal>
        <div className="mt-14 grid gap-6 md:grid-cols-2 md:gap-8">
          {venues.map((v, i) => (
            <Reveal key={v.label} delay={i * 0.12}>
              <article className="lux-venue fine-frame flex h-full flex-col items-center rounded-sm bg-paper px-7 py-12 text-center shadow-card sm:px-10 sm:py-14">
                <v.icon aria-hidden="true" className="size-8 text-champagne" strokeWidth={1.1} />
                <h3 className="mt-5 text-[0.75rem] font-sans font-medium uppercase tracking-[0.34em] text-gold">{v.label}</h3>
                <p className="mt-4 max-w-xs font-serif text-[1.85rem] leading-tight text-ink">{v.name}</p>
                {v.time.trim() && <p className="mt-3 text-sm font-medium uppercase tracking-[0.26em] text-ink-soft">{v.time}</p>}
                {v.mapUrl && (
                  <a
                    href={v.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="lux-link relative z-10 mt-8 inline-flex min-h-11 items-center gap-2 rounded-full border border-champagne/70 px-6 text-[0.72rem] font-medium uppercase tracking-[0.22em] text-ink transition hover:bg-champagne-light/50"
                  >
                    View Location
                    <ExternalLink aria-hidden="true" className="size-3.5" />
                    <span className="sr-only">for the {v.label.toLowerCase()} (opens Google Maps in a new tab)</span>
                  </a>
                )}
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
