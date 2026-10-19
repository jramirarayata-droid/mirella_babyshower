import type { AttendanceStatus } from '../types/rsvp'
import type { BuiltinKey, CustomAnswer, CustomAnswers, RsvpConfig, RsvpQuestion } from '../types/questions'
import { BUILTIN_QUESTIONS } from '../types/questions'

export function builtinEnabled(config: RsvpConfig | undefined, key: BuiltinKey): boolean {
  return config?.builtins?.[key]?.enabled !== false
}

export const DEFAULT_GUEST_PRICE = 799

/** Price per additional guest the couple set in RSVP Questions (0 = no price shown). */
export function guestPrice(config: RsvpConfig | undefined | null): number {
  const p = config?.builtins?.additionalGuest?.price
  return typeof p === 'number' && Number.isFinite(p) && p >= 0 ? p : DEFAULT_GUEST_PRICE
}

export const formatPeso = (n: number) => `₱${n.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`

/** "₱799 each" style text, or '' when no price is set. */
export function guestPriceEach(config: RsvpConfig | undefined | null): string {
  const p = guestPrice(config)
  return p > 0 ? `${formatPeso(p)} each` : ''
}

export function additionalGuestDefaultLabel(price: number): string {
  return price > 0 ? `Would you like to bring an additional guest for ${formatPeso(price)}?` : 'Would you like to bring an additional guest?'
}

export function builtinLabel(config: RsvpConfig | undefined, key: BuiltinKey): string {
  const custom = config?.builtins?.[key]?.label?.trim()
  if (key === 'additionalGuest') {
    const price = guestPrice(config)
    return custom ? custom.replace(/\{price\}/gi, price > 0 ? formatPeso(price) : '').replace(/\s{2,}/g, ' ').trim() : additionalGuestDefaultLabel(price)
  }
  return custom || BUILTIN_QUESTIONS.find((b) => b.key === key)?.defaultLabel || ''
}

export function comingFromRequired(config: RsvpConfig | undefined): boolean {
  return config?.builtins?.comingFrom?.required !== false
}

const isEmpty = (v: CustomAnswer | undefined) => v === undefined || (Array.isArray(v) ? v.length === 0 : v.trim() === '')

const matches = (answer: CustomAnswer | undefined, values: string[]) =>
  answer !== undefined && (Array.isArray(answer) ? answer.some((a) => values.includes(a)) : values.includes(answer))

/** Same rules as public.validate_custom_answers(): audience + "show only if" (earlier questions only). */
export function visibleQuestions(questions: RsvpQuestion[], attendance: AttendanceStatus | null, answers: CustomAnswers): RsvpQuestion[] {
  if (!attendance) return []
  const shown: RsvpQuestion[] = []
  const answered = new Map<string, CustomAnswer>()
  for (const q of questions) {
    if (!q.isActive) continue
    if (q.audience === 'attending' && attendance !== 'attending') continue
    if (q.audience === 'declining' && attendance !== 'declining') continue
    if (q.showIf && !matches(answered.get(q.showIf.questionId), q.showIf.values)) continue
    shown.push(q)
    const a = answers[q.id]
    if (!isEmpty(a)) answered.set(q.id, a)
  }
  return shown
}

export function validateCustomAnswers(visible: RsvpQuestion[], answers: CustomAnswers): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const q of visible) {
    const a = answers[q.id]
    if (isEmpty(a)) {
      if (q.required) errors[q.id] = q.type === 'multiple' || q.type === 'single' || q.type === 'yes_no' ? 'Please choose an option.' : 'Please answer this question.'
      continue
    }
    if (q.type === 'multiple' && Array.isArray(a) && q.maxSelections && a.length > q.maxSelections) {
      errors[q.id] = `You can choose up to ${q.maxSelections}.`
    }
    if ((q.type === 'short_text' || q.type === 'long_text') && typeof a === 'string') {
      const max = q.maxLength ?? (q.type === 'short_text' ? 120 : 500)
      if (a.trim().length > max) errors[q.id] = `Please keep this under ${max} characters.`
    }
    if (q.type === 'number' && typeof a === 'string') {
      const n = Number(a)
      if (!Number.isFinite(n)) errors[q.id] = 'Please enter a number.'
      else if (q.minValue !== null && n < q.minValue) errors[q.id] = `Please enter ${q.minValue} or more.`
      else if (q.maxValue !== null && n > q.maxValue) errors[q.id] = `Please enter ${q.maxValue} or less.`
    }
  }
  return errors
}

/** Only answers to questions that are actually shown, cleaned for the database. */
export function cleanCustomAnswers(visible: RsvpQuestion[], answers: CustomAnswers): Record<string, string | string[] | number> {
  const out: Record<string, string | string[] | number> = {}
  for (const q of visible) {
    const a = answers[q.id]
    if (isEmpty(a)) continue
    if (q.type === 'number') out[q.id] = Number(a)
    else if (Array.isArray(a)) out[q.id] = a
    else out[q.id] = a.trim()
  }
  return out
}

/** Human-readable answer for admin views and CSV. */
export function formatCustomAnswer(q: RsvpQuestion | undefined, value: unknown): string {
  if (value === undefined || value === null || value === '') return ''
  if (Array.isArray(value)) return value.join('; ')
  if (q?.type === 'yes_no') return value === 'yes' ? 'Yes' : value === 'no' ? 'No' : String(value)
  return String(value)
}
