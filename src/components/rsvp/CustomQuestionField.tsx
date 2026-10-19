import type { CustomAnswer, RsvpQuestion } from '../../types/questions'
import { OptionGroup } from '../ui/Choice'
import { CharCounter, FieldError, TextAreaField, TextField } from '../ui/FormField'
import { cn } from '../ui/cn'

interface Props {
  question: RsvpQuestion
  value: CustomAnswer | undefined
  onChange: (value: CustomAnswer) => void
  error?: string
}

/** Renders one admin-defined RSVP question. */
export function CustomQuestionField({ question: q, value, onChange, error }: Props) {
  const id = `q-${q.id}`
  const optional = !q.required && <span className="text-sm font-normal text-muted">(optional)</span>
  const label = (
    <span className="text-[1.05rem] text-ink">
      {q.question} {optional}
    </span>
  )
  const help = q.helpText ? <p className="-mt-1 mb-3 text-sm text-muted">{q.helpText}</p> : null

  if (q.type === 'yes_no' || q.type === 'single') {
    const options =
      q.type === 'yes_no'
        ? [
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ]
        : q.options.map((o) => ({ value: o, label: o }))
    return (
      <OptionGroup
        legend={label}
        description={help}
        name={id}
        options={options}
        value={typeof value === 'string' ? value : null}
        onChange={(v) => onChange(v)}
        error={error}
        columns={q.type === 'yes_no' || options.length <= 2 ? 2 : 3}
      />
    )
  }

  if (q.type === 'multiple') {
    const selected = Array.isArray(value) ? value : []
    const max = q.maxSelections ?? q.options.length
    return (
      <fieldset aria-invalid={error ? true : undefined}>
        <legend className="mb-1 text-[1.05rem] font-medium leading-snug text-ink">{label}</legend>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm text-muted">{q.helpText || (q.maxSelections ? `Choose up to ${q.maxSelections}.` : 'Choose all that apply.')}</p>
          {q.maxSelections ? <CharCounter value={selected.length} max={q.maxSelections} /> : null}
        </div>
        <div className="grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2 sm:grid-cols-3">
          {q.options.map((o) => {
            const checked = selected.includes(o)
            const atLimit = !checked && selected.length >= max
            return (
              <label
                key={o}
                className={cn(
                  'flex min-h-13 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-[0.95rem] transition-all duration-200',
                  'has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-gold has-[input:focus-visible]:ring-offset-2 has-[input:focus-visible]:ring-offset-paper',
                  checked ? 'border-champagne bg-champagne-light/40 text-ink' : 'border-line bg-paper text-ink-soft hover:border-champagne/60',
                  atLimit && 'opacity-60',
                )}
              >
                <input
                  type="checkbox"
                  name={id}
                  value={o}
                  checked={checked}
                  onChange={() => {
                    if (checked) onChange(selected.filter((s) => s !== o))
                    else if (!atLimit) onChange(q.options.filter((x) => x === o || selected.includes(x)))
                  }}
                  aria-disabled={atLimit || undefined}
                  className="size-5 shrink-0 cursor-pointer rounded accent-ink"
                />
                {o}
              </label>
            )
          })}
        </div>
        <FieldError>{error}</FieldError>
      </fieldset>
    )
  }

  const text = typeof value === 'string' ? value : ''

  if (q.type === 'long_text') {
    return (
      <TextAreaField
        id={id}
        label={label}
        hint={q.helpText || undefined}
        value={text}
        onChange={onChange}
        maxLength={q.maxLength ?? 500}
        showCounter
        rows={3}
        error={error}
      />
    )
  }

  if (q.type === 'number') {
    const range =
      q.minValue !== null && q.maxValue !== null
        ? `${q.minValue}–${q.maxValue}`
        : q.minValue !== null
          ? `${q.minValue} or more`
          : q.maxValue !== null
            ? `up to ${q.maxValue}`
            : ''
    return (
      <TextField
        id={id}
        type="number"
        inputMode="decimal"
        label={label}
        hint={[q.helpText, range].filter(Boolean).join(' · ') || undefined}
        value={text}
        onChange={onChange}
        min={q.minValue ?? undefined}
        max={q.maxValue ?? undefined}
        className="max-w-xs"
        error={error}
      />
    )
  }

  return (
    <TextField
      id={id}
      label={label}
      hint={q.helpText || undefined}
      value={text}
      onChange={onChange}
      maxLength={q.maxLength ?? 120}
      showCounter
      error={error}
    />
  )
}
