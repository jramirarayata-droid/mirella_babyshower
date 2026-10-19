import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from './cn'

interface ChoiceCardProps {
  name: string
  value: string
  checked: boolean
  onChange: () => void
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  type?: 'radio' | 'checkbox'
  disabled?: boolean
  className?: string
}

/** Large, fully clickable card backed by a native radio/checkbox input. */
export function ChoiceCard({ name, value, checked, onChange, title, description, icon, type = 'radio', disabled, className }: ChoiceCardProps) {
  return (
    <label
      className={cn(
        'group relative flex cursor-pointer items-start gap-4 rounded-xl border bg-paper p-5 text-left transition-all duration-200 sm:p-6',
        'has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-gold has-[input:focus-visible]:ring-offset-2 has-[input:focus-visible]:ring-offset-ivory',
        checked
          ? 'border-champagne bg-champagne-light/30 shadow-card'
          : 'border-line hover:border-champagne/60 hover:shadow-soft',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <input type={type} name={name} value={value} checked={checked} onChange={onChange} disabled={disabled} className="sr-only" />
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex size-6 shrink-0 items-center justify-center border transition-colors',
          type === 'radio' ? 'rounded-full' : 'rounded-md',
          checked ? 'border-ink bg-ink text-ivory' : 'border-champagne/70 bg-paper',
        )}
      >
        {checked && (type === 'radio' ? <span className="size-2 rounded-full bg-ivory" /> : <Check className="size-4" strokeWidth={2.5} />)}
      </span>
      <span className="min-w-0 flex-1">
        {icon && <span className="mb-2 block text-champagne">{icon}</span>}
        <span className="block font-serif text-xl leading-snug text-ink sm:text-2xl">{title}</span>
        {description && <span className="mt-1 block text-sm text-muted">{description}</span>}
      </span>
    </label>
  )
}

interface OptionGroupProps<T extends string> {
  legend: ReactNode
  name: string
  options: { value: T; label: ReactNode }[]
  value: T | null
  onChange: (value: T) => void
  error?: string
  description?: ReactNode
  columns?: 2 | 3 | 5
}

/** Radio group rendered as large pill buttons (Yes / No / Not sure yet…). */
export function OptionGroup<T extends string>({ legend, name, options, value, onChange, error, description, columns = 2 }: OptionGroupProps<T>) {
  const cols = { 2: 'grid-cols-2', 3: 'grid-cols-1 min-[400px]:grid-cols-3', 5: 'grid-cols-2 sm:grid-cols-5' }
  return (
    <fieldset aria-invalid={error ? true : undefined}>
      <legend className="mb-3 text-[1.05rem] font-medium leading-snug text-ink">{legend}</legend>
      {description}
      <div className={cn('grid gap-2.5', cols[columns])}>
        {options.map((o) => {
          const checked = value === o.value
          return (
            <label
              key={o.value}
              className={cn(
                'flex min-h-13 cursor-pointer items-center justify-center gap-2.5 rounded-lg border px-4 py-3 text-center text-[0.95rem] transition-all duration-200',
                'has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-gold has-[input:focus-visible]:ring-offset-2 has-[input:focus-visible]:ring-offset-ivory',
                checked ? 'border-ink bg-ink text-ivory shadow-soft' : 'border-line bg-paper text-ink-soft hover:border-champagne/70',
              )}
            >
              <input type="radio" name={name} value={o.value} checked={checked} onChange={() => onChange(o.value)} className="sr-only" />
              <span
                aria-hidden="true"
                className={cn('flex size-4 shrink-0 items-center justify-center rounded-full border', checked ? 'border-ivory' : 'border-champagne/70')}
              >
                {checked && <span className="size-2 rounded-full bg-ivory" />}
              </span>
              {o.label}
            </label>
          )
        })}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-rose">
          {error}
        </p>
      )}
    </fieldset>
  )
}
