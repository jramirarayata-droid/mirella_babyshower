import type { ReactNode } from 'react'
import { cn } from './cn'

type Tone = 'green' | 'rose' | 'gold' | 'gray' | 'ink'

const tones: Record<Tone, string> = {
  green: 'bg-sage/12 text-sage ring-sage/25',
  rose: 'bg-rose/10 text-rose ring-rose/25',
  gold: 'bg-champagne-light/60 text-gold ring-champagne/40',
  gray: 'bg-cream text-muted ring-line',
  ink: 'bg-ink text-ivory ring-ink',
}

export function Badge({ tone = 'gray', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', tones[tone], className)}>
      {children}
    </span>
  )
}
