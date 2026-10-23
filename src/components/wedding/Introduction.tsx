import type { WeddingSettings } from '../../types/wedding'
import { arrivalText, formatDotDate, formatWeddingDate } from '../../utils/formatting'
import { Ornament } from '../ui/Ornament'
import { RoundCountdown } from './looks/LookArt'
import { Twinkle } from './looks/BabyArt'
import { Reveal } from './Reveal'
import { useSectionText } from '../../hooks/useSectionText'

export function Introduction({ settings }: { settings: WeddingSettings }) {
  const t = useSectionText('intro')
  const arriving = arrivalText(settings)
  return (
    <section id="details" aria-labelledby="intro-heading" className="scroll-mt-6 px-6 py-24 focus:outline-none sm:py-32">
      <Reveal className="section-title mx-auto max-w-2xl text-center">
        <p className="eyebrow">{t('eyebrow', 'The Baby Shower')}</p>
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
        <RoundCountdown date={settings.weddingDate} time={settings.ceremonyTime} className="lux-countdown mt-9" labels={{ days: t('days', ''), hours: t('hours', ''), minutes: t('minutes', '') }} />
        {arriving && (
          <p className="lux-arriving mt-8 inline-flex items-center gap-2 rounded-full border border-champagne/50 bg-paper/70 px-5 py-2 text-sm text-ink-soft">
            <Twinkle className="size-3.5 text-champagne" />
            {arriving}
          </p>
        )}
      </Reveal>
    </section>
  )
}
