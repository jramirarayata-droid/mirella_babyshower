import { useId, useState } from 'react'
import { ChevronDown, MapPin } from 'lucide-react'
import type { WeddingSettings } from '../../types/wedding'
import { Collapse } from './Collapse'
import { WhereToGo } from './WhereToGo'
import { cn } from '../ui/cn'

type Venues = Pick<WeddingSettings, 'weddingDate' | 'coupleNames' | 'babyName' | 'churchName' | 'ceremonyTime' | 'churchMapUrl'>

/**
 * For guests who have already confirmed: the venue (time, place, map) one
 * tap away when they open their invitation again.
 */
export function EventDetails({ venues, className }: { venues: Venues; className?: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  if (!venues.churchName.trim()) return null
  return (
    <div className={cn('flex w-full max-w-md flex-col items-center', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-champagne bg-paper px-5 text-sm font-medium text-ink shadow-soft transition hover:bg-champagne-light/40"
      >
        <MapPin aria-hidden="true" className="size-4 text-gold" strokeWidth={1.7} />
        {open ? 'Hide the shower details' : 'See where and when'}
        <ChevronDown aria-hidden="true" className={cn('size-4 text-muted transition-transform duration-300', open && 'rotate-180')} />
      </button>
      <div id={id} className="w-full">
        <Collapse open={open}>
          <div className="px-0.5 pb-2">
            <WhereToGo venues={venues} />
          </div>
        </Collapse>
      </div>
    </div>
  )
}
