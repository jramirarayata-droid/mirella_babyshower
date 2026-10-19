import { Check, Copy, Lock, MessageCircleHeart } from 'lucide-react'
import { useSpace } from '../../hooks/useSpace'
import { useToast } from '../../hooks/useToast'
import { FEATURE_LABELS, type Feature } from '../../lib/plans'
import { spaceUrl } from '../../lib/space'
import { copyText } from '../../utils/share'
import { ContactLink } from './Locked'
import { cn } from '../ui/cn'

const SHOWN: Feature[] = ['looks_all', 'predictions', 'names', 'reveal', 'guest_photos', 'gallery', 'printables', 'raffle', 'big_screen', 'slideshow', 'music', 'seating', 'cohost']

const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })

/** Dashboard: the shower's plan, guest count against the limit, open-until date and what's included. */
export function PlanSummary() {
  const { info } = useSpace()
  const toast = useToast()
  if (!info || info.legacy || !info.plan) return null
  const { plan } = info
  const used = info.guests ?? 0
  const pct = plan.guestLimit ? Math.min(100, Math.round((used / plan.guestLimit) * 100)) : 0
  const link = spaceUrl(info.slug, '/')

  return (
    <section aria-labelledby="plan-heading" className="mb-6 rounded-xl border border-line bg-paper p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted">Your plan</p>
          <h2 id="plan-heading" className="mt-1 font-serif text-3xl text-ink">
            {plan.name}
          </h2>
          <p className={cn('mt-1 text-sm', info.open ? 'text-ink-soft' : 'text-rose')}>
            {!info.open ? 'Not active — message us to switch it on.' : info.activeUntil ? `Open until ${fmt(info.activeUntil)}` : 'Open'}
          </p>
        </div>
        <div className="min-w-[14rem] flex-1 sm:max-w-xs">
          <div className="flex justify-between text-sm">
            <span className="text-ink-soft">Guests</span>
            <span className="tabular-nums text-ink">
              {used}
              {plan.guestLimit ? ` of ${plan.guestLimit}` : ' · unlimited'}
            </span>
          </div>
          {plan.guestLimit ? (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-cream" role="progressbar" aria-valuenow={used} aria-valuemin={0} aria-valuemax={plan.guestLimit} aria-label="Guests used">
              <div className={cn('h-full rounded-full', pct >= 90 ? 'bg-rose' : 'bg-champagne')} style={{ width: `${pct}%` }} />
            </div>
          ) : null}
          <button
            type="button"
            onClick={async () => toast.show((await copyText(link)) ? 'Guest link copied.' : link)}
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-gold underline-offset-4 hover:underline"
          >
            <Copy aria-hidden="true" className="size-3.5" /> Copy your guest link
          </button>
        </div>
      </div>
      <ul className="mt-5 flex flex-wrap gap-2">
        {SHOWN.map((f) => {
          const on = plan.features.includes(f)
          return (
            <li
              key={f}
              className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ring-1 ring-inset', on ? 'bg-sage/10 text-sage ring-sage/25' : 'bg-cream text-muted ring-line')}
            >
              {on ? <Check aria-hidden="true" className="size-3.5" /> : <Lock aria-hidden="true" className="size-3.5" />}
              {f === 'looks_all' && !on ? 'Clouds look only' : FEATURE_LABELS[f]}
            </li>
          )
        })}
      </ul>
      {SHOWN.some((f) => !plan.features.includes(f)) && (
        <ContactLink className="mt-4 inline-flex items-center gap-1.5 text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline">
          <MessageCircleHeart aria-hidden="true" className="size-4" /> Want more? Message us to upgrade.
        </ContactLink>
      )}
    </section>
  )
}
