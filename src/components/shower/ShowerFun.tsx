import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Baby, Gift, PenLine, type LucideIcon } from 'lucide-react'
import { getNameIdeasInfo, getPredictionsInfo, getRegistry } from '../../services/showerService'
import { Reveal } from '../wedding/Reveal'
import { Ornament } from '../ui/Ornament'

interface Card {
  to: string
  title: string
  text: string
  cta: string
  icon: LucideIcon
}

export interface ShowerActivities {
  registry: boolean
  predict: boolean
  predictOpen: boolean
  names: boolean
}

let activities: Promise<ShowerActivities> | null = null

/** Which shower activities are on (for the home page and the guest menu; asked once per visit). */
export function useShowerActivities(): ShowerActivities | null {
  const [on, setOn] = useState<ShowerActivities | null>(null)
  useEffect(() => {
    let alive = true
    activities ??= Promise.all([getRegistry().catch(() => null), getPredictionsInfo().catch(() => null), getNameIdeasInfo().catch(() => null)]).then(([r, p, n]) => ({
      registry: Boolean(r?.visible),
      predict: Boolean(p?.visible),
      predictOpen: Boolean(p?.open),
      names: Boolean(n?.visible),
    }))
    void activities.then((a) => alive && setOn(a))
    return () => {
      alive = false
    }
  }, [])
  return on
}

/** Home page: the wishlist, the predictions game and name ideas, as three friendly cards. */
export function ShowerFun() {
  const on = useShowerActivities()
  if (!on) return null
  const cards: Card[] = []
  if (on.registry) cards.push({ to: '/registry', title: 'Gift Wishlist', text: 'See what our little one still needs, and mark what you’ll bring so nothing is doubled.', cta: 'See the wishlist', icon: Gift })
  if (on.predict)
    cards.push({
      to: '/predict',
      title: 'Baby Predictions',
      text: on.predictOpen ? 'Guess the birthday, the weight — and boy or girl. The closest guesses win!' : 'See everyone’s guesses and who came closest.',
      cta: on.predictOpen ? 'Make your guess' : 'See the guesses',
      icon: Baby,
    })
  if (on.names) cards.push({ to: '/names', title: 'Name Ideas', text: 'We’re still choosing! Suggest a name you love for the baby.', cta: 'Suggest a name', icon: PenLine })
  if (!cards.length) return null
  return (
    <section aria-labelledby="fun-heading" className="px-5 py-24 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="section-title text-center">
          <p className="eyebrow">Join the Fun</p>
          <h2 id="fun-heading" className="mt-4 text-4xl text-ink sm:text-5xl">
            Gifts, Guesses &amp; Names
          </h2>
          <Ornament className="mt-8" />
        </Reveal>
        <div className={`mx-auto mt-14 grid gap-6 ${cards.length === 1 ? 'max-w-md' : cards.length === 2 ? 'max-w-3xl sm:grid-cols-2' : 'md:grid-cols-3'}`}>
          {cards.map((c, i) => (
            <Reveal key={c.to} delay={i * 0.1}>
              <Link
                to={c.to}
                className="lux-venue fine-frame group flex h-full flex-col items-center rounded-sm bg-paper px-7 py-10 text-center shadow-card transition hover:-translate-y-0.5"
              >
                <span className="lux-icon flex size-16 items-center justify-center rounded-full border border-champagne/50 text-champagne">
                  <c.icon aria-hidden="true" className="size-6" strokeWidth={1.4} />
                </span>
                <h3 className="mt-6 font-serif text-[1.9rem] leading-tight text-ink">{c.title}</h3>
                <p className="mt-3 max-w-xs text-[0.98rem] leading-relaxed text-ink-soft">{c.text}</p>
                <span className="lux-link relative z-10 mt-7 inline-flex min-h-11 items-center rounded-full border border-champagne/70 px-6 text-[0.72rem] font-medium uppercase tracking-[0.22em] text-ink transition group-hover:bg-champagne-light/50">
                  {c.cta}
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
