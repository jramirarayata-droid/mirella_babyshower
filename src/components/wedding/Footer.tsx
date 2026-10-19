import { formatWeddingDate } from '../../utils/formatting'
import { Ornament } from '../ui/Ornament'
import { CoupleNames } from './CoupleNames'

/** The page footer: the baby's name (`coupleNames`), the date and, small, who is hosting. */
export function Footer({ coupleNames, hostNames, weddingDate, closingMessage }: { coupleNames: string; hostNames?: string; weddingDate: string; closingMessage?: string }) {
  return (
    <footer className="lux-footer border-t border-line/70 bg-cream/50 px-6 pb-[max(3rem,env(safe-area-inset-bottom))] pt-16 text-center">
      <p className="font-serif text-4xl font-light text-ink">
        <CoupleNames names={coupleNames} />
      </p>
      {weddingDate && <p className="mt-3 text-xs uppercase tracking-[0.36em] text-muted">{formatWeddingDate(weddingDate)}</p>}
      {hostNames?.trim() && <p className="mt-2 text-sm italic text-ink-soft">With love, {hostNames.trim()}</p>}
      <Ornament className="mt-8" />
      {closingMessage && <p className="mx-auto mt-8 max-w-md font-serif text-lg italic text-ink-soft">{closingMessage}</p>}
    </footer>
  )
}
