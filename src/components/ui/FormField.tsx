import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { cn } from './cn'

export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null
  return (
    <p id={id} role="alert" className="mt-2 text-sm text-rose">
      {children}
    </p>
  )
}

export function CharCounter({ value, max }: { value: number; max: number }) {
  const near = value >= max * 0.9
  return (
    <span aria-live="polite" className={cn('text-xs tabular-nums', near ? 'text-gold' : 'text-muted')}>
      {value} / {max}
    </span>
  )
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label: ReactNode
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: ReactNode
  maxLength?: number
  showCounter?: boolean
  hideLabel?: boolean
}

export function TextField({ label, value, onChange, error, hint, maxLength, showCounter, hideLabel, className, id, ...rest }: TextFieldProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const errId = `${inputId}-error`
  const hintId = `${inputId}-hint`
  return (
    <div className={className}>
      <div className={cn('mb-2 flex items-end justify-between gap-3', hideLabel && !showCounter && 'sr-only')}>
        <label htmlFor={inputId} className={cn('text-[0.95rem] font-medium text-ink-soft', hideLabel && 'sr-only')}>
          {label}
        </label>
        {showCounter && maxLength ? <CharCounter value={value.length} max={maxLength} /> : null}
      </div>
      <input
        id={inputId}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={cn(error ? errId : null, hint ? hintId : null) || undefined}
        className={cn('input-base', error && 'border-rose/70 focus:border-rose focus:ring-rose/20')}
        {...rest}
      />
      {hint && (
        <p id={hintId} className="mt-2 text-sm text-muted">
          {hint}
        </p>
      )}
      <FieldError id={errId}>{error}</FieldError>
    </div>
  )
}

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  label: ReactNode
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: ReactNode
  maxLength?: number
  showCounter?: boolean
}

export function TextAreaField({ label, value, onChange, error, hint, maxLength, showCounter, className, id, rows = 4, ...rest }: TextAreaFieldProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const errId = `${inputId}-error`
  const hintId = `${inputId}-hint`
  return (
    <div className={className}>
      <div className="mb-2 flex items-end justify-between gap-3">
        <label htmlFor={inputId} className="text-[0.95rem] font-medium text-ink-soft">
          {label}
        </label>
        {showCounter && maxLength ? <CharCounter value={value.length} max={maxLength} /> : null}
      </div>
      <textarea
        id={inputId}
        value={value}
        rows={rows}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={cn(error ? errId : null, hint ? hintId : null) || undefined}
        className={cn('input-base resize-y leading-relaxed', error && 'border-rose/70')}
        {...rest}
      />
      {hint && (
        <p id={hintId} className="mt-2 text-sm text-muted">
          {hint}
        </p>
      )}
      <FieldError id={errId}>{error}</FieldError>
    </div>
  )
}
