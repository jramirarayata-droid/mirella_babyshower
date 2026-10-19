import type { WeddingSettings } from '../../types/wedding'
import { daysUntil, formatDotDate, formatWeddingDate } from '../../utils/formatting'
import { Ornament } from '../ui/Ornament'
import { Reveal } from './Reveal'

export function Introduction({ settings }: { settings: WeddingSettings }) {
  const days = daysUntil(settings.weddingDate)
  return (
    <section id="details" aria-labelledby="intro-heading" className="scroll-mt-6 px-6 py-24 focus:outline-none sm:py-32">
      <Reveal className="section-title mx-auto max-w-2xl text-center">
        <p className="eyebrow">The Celebration</p>
        <h2 id="intro-heading" className="sr-only">
          Our invitation
        </h2>
        {settings.storyText && (
          <p className="lux-lede mt-8 font-serif text-[1.9rem] font-light leading-[1.35] text-ink sm:text-[2.4rem]">
            {settings.storyText}
          </p>
        )}
        <Ornament className="mt-10" />
        <p className="mt-8 font-serif text-xl italic text-ink-soft">{formatWeddingDate(settings.weddingDate, 'full')}</p>
        <p className="mt-2 text-xs uppercase tracking-[0.4em] text-muted">{formatDotDate(settings.weddingDate)}</p>
        {days !== null && days > 0 && (
          <p className="lux-countdown mt-6 text-sm text-muted">
            <span className="font-serif text-2xl text-gold">{days}</span> {days === 1 ? 'day' : 'days'} to go
          </p>
        )}
      </Reveal>
    </section>
  )
}
