import { cn } from '../ui/cn'

interface FilterTabsProps<T extends string> {
  label: string
  value: T
  options: { value: T; label: string; count?: number }[]
  onChange: (v: T) => void
}

export function FilterTabs<T extends string>({ label, value, options, onChange }: FilterTabsProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 text-sm transition',
              active ? 'border-ink bg-ink text-ivory' : 'border-line bg-paper text-ink-soft hover:border-champagne',
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={cn('rounded-full px-1.5 text-xs tabular-nums', active ? 'bg-ivory/15' : 'bg-cream text-muted')}>{o.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return (
    <input
      type="search"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="input-base min-h-11 py-2.5 sm:max-w-xs"
    />
  )
}
