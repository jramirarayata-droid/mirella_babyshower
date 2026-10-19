import { CalendarPlus, Church, GlassWater, MapPin } from 'lucide-react'
import type { WeddingSettings } from '../../types/wedding'
import { calendarUrl } from '../../utils/calendar'

type Venues = Pick<WeddingSettings, 'weddingDate' | 'coupleNames' | 'churchName' | 'ceremonyTime' | 'churchMapUrl' | 'receptionName' | 'receptionTime' | 'receptionMapUrl'>

/** The confirmation page's "Where to go": ceremony and reception, easy to spot, with map links. */
export function WhereToGo({ venues }: { venues: Venues }) {
  const stops = [
    { key: 'ceremony', label: 'Ceremony', name: venues.churchName, time: venues.ceremonyTime, map: venues.churchMapUrl, Icon: Church },
    { key: 'reception', label: 'Reception', name: venues.receptionName, time: venues.receptionTime, map: venues.receptionMapUrl, Icon: GlassWater },
  ].filter((s) => s.name.trim())
  if (!stops.length) return null
  return (
    <section aria-labelledby="where-heading" className="mx-auto mt-8 w-full max-w-md overflow-hidden rounded-2xl border-2 border-champagne bg-paper text-left shadow-card">
      <div className="bg-champagne-light/70 px-6 py-3 text-center">
        <h2 id="where-heading" className="flex items-center justify-center gap-2 text-sm font-medium uppercase tracking-[0.28em] text-gold">
          <MapPin aria-hidden="true" className="size-4" strokeWidth={1.8} /> Where to go
        </h2>
      </div>
      <ol className="divide-y divide-line">
        {stops.map(({ key, label, name, time, map, Icon }) => (
          <li key={key} className="flex gap-4 px-6 py-5">
            <span className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-full bg-champagne-light/60 text-gold">
              <Icon aria-hidden="true" className="size-5" strokeWidth={1.6} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted">
                {label}
                {time && <span className="ml-2 text-ink">· {time}</span>}
              </p>
              <p className="mt-1 font-serif text-2xl leading-snug text-ink">{name}</p>
              {map && (
                <a
                  href={map}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-medium text-ivory shadow-soft transition hover:bg-ink-soft"
                >
                  <MapPin aria-hidden="true" className="size-4" strokeWidth={1.8} /> Open in Maps
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>
      <div className="border-t border-line px-6 py-3 text-center">
        <a href={calendarUrl(venues)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline">
          <CalendarPlus aria-hidden="true" className="size-4" strokeWidth={1.6} /> Add to calendar
        </a>
      </div>
    </section>
  )
}
