import type { ReactNode } from 'react'
import { cn } from '../ui/cn'

interface StatCardProps {
  label: string
  value: number | string
  icon: ReactNode
  hint?: ReactNode
  emphasis?: boolean
}

export function StatCard({ label, value, icon, hint, emphasis }: StatCardProps) {
  return (
    <div className={cn('rounded-xl border p-5 shadow-soft', emphasis ? 'border-ink bg-ink text-ivory' : 'border-line bg-paper')}>
      <div className="flex items-start justify-between gap-3">
        <p className={cn('text-[0.68rem] font-semibold uppercase tracking-[0.16em]', emphasis ? 'text-ivory/70' : 'text-muted')}>{label}</p>
        <span className={cn('shrink-0', emphasis ? 'text-champagne-light' : 'text-champagne')}>{icon}</span>
      </div>
      <p className="mt-3 font-serif text-[2.6rem] leading-none tabular-nums">{value}</p>
      {hint && <p className={cn('mt-2 text-xs', emphasis ? 'text-ivory/70' : 'text-muted')}>{hint}</p>}
    </div>
  )
}
