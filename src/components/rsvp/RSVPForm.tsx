import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, Trash2 } from 'lucide-react'
import type {
  FoodOption,
  InvitationLookup,
  NeedsTransportation,
  RSVPFormState,
  VehicleType,
  YesNo,
} from '../../types/rsvp'
import { FOOD_OPTIONS, NEEDS_TRANSPORT_OPTIONS, VEHICLE_OPTIONS } from '../../utils/formatting'
import { LIMITS, hasErrors, validateRSVP, type RSVPErrors } from '../../utils/validation'
import { Button } from '../ui/Button'
import { ChoiceCard, OptionGroup } from '../ui/Choice'
import { CharCounter, FieldError, TextAreaField, TextField } from '../ui/FormField'
import { Ornament } from '../ui/Ornament'
import { cn } from '../ui/cn'
import { Collapse } from './Collapse'
import { CustomQuestionField } from './CustomQuestionField'
import type { BuiltinKey, CustomAnswer, RsvpConfig, RsvpQuestion } from '../../types/questions'
import { builtinEnabled, builtinLabel, comingFromRequired, formatPeso, guestPrice, visibleQuestions } from '../../utils/questions'

const YES_NO: { value: YesNo; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
]


interface RSVPFormProps {
  invitation: InvitationLookup
  form: RSVPFormState
  onChange: (next: RSVPFormState) => void
  /** Called when the form is valid and the guest wants to confirm. */
  onRequestConfirm: () => void
  submitting: boolean
  submitError: string | null
  config?: RsvpConfig
  questions?: RsvpQuestion[]
}

export function RSVPForm({ invitation, form, onChange, onRequestConfirm, submitting, submitError, config, questions = [] }: RSVPFormProps) {
  const [errors, setErrors] = useState<RSVPErrors>({})
  const [foodLimitHit, setFoodLimitHit] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const maxGuests = invitation.maxAdditionalGuests

  const update = (patch: Partial<RSVPFormState>) => {
    const next = { ...form, ...patch }
    onChange(next)
    if (attempted) setErrors(validateRSVP(next, maxGuests, config, questions))
  }

  const toggleFood = (value: FoodOption) => {
    const selected = form.foodPreferences.includes(value)
    if (!selected && form.foodPreferences.length >= LIMITS.maxFoodSelections) {
      setFoodLimitHit(true)
      return
    }
    setFoodLimitHit(false)
    update({
      foodPreferences: selected ? form.foodPreferences.filter((f) => f !== value) : [...form.foodPreferences, value],
    })
  }

  const setBringingGuest = (v: YesNo) =>
    update({ bringingGuest: v, guestNames: v === 'yes' ? (form.guestNames.length ? form.guestNames : ['']) : [] })

  const setGuestName = (i: number, value: string) => update({ guestNames: form.guestNames.map((n, j) => (j === i ? value : n)) })

  const addGuest = () => {
    if (form.guestNames.length >= maxGuests) return
    // Don't allow stacking up multiple empty inputs.
    if (form.guestNames.some((n) => !n.trim())) {
      setErrors((e) => ({ ...e, guestNames: 'Please fill in the current guest name before adding another.' }))
      return
    }
    update({ guestNames: [...form.guestNames, ''] })
    window.setTimeout(() => {
      formRef.current?.querySelector<HTMLInputElement>(`#guest-name-${form.guestNames.length}`)?.focus()
    }, 60)
  }

  const removeGuest = (i: number) => {
    const next = form.guestNames.filter((_, j) => j !== i)
    update({ guestNames: next, bringingGuest: next.length ? form.bringingGuest : 'no' })
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setAttempted(true)
    const found = validateRSVP(form, maxGuests, config, questions)
    setErrors(found)
    if (hasErrors(found)) {
      window.setTimeout(() => {
        const el = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [role="alert"]')
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        const input = el?.matches('input,textarea') ? el : el?.querySelector<HTMLElement>('input,textarea')
        input?.focus({ preventScroll: true })
      }, 50)
      return
    }
    onRequestConfirm()
  }

  const attending = form.attendance === 'attending'
  const on = (k: BuiltinKey) => builtinEnabled(config, k)
  const label = (k: BuiltinKey) => builtinLabel(config, k)
  const shown = visibleQuestions(questions, form.attendance, form.customAnswers)
  const setAnswer = (id: string, v: CustomAnswer) => update({ customAnswers: { ...form.customAnswers, [id]: v } })
  const customFields = shown.map((q) => (
    <Question key={q.id}>
      <CustomQuestionField question={q} value={form.customAnswers[q.id]} onChange={(v) => setAnswer(q.id, v)} error={errors.custom?.[q.id]} />
    </Question>
  ))
  const questionList = 'space-y-10 [&>*:last-child]:border-b-0 [&>*:last-child]:pb-0'
  const guestLabel = maxGuests === 1 ? 'guest' : 'guests'

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="mx-auto w-full max-w-2xl">
      {/* Personal header */}
      <div className="text-center">
        <p className="eyebrow">Répondez s’il vous plaît</p>
        <h1 className="mt-4 text-[2.6rem] leading-tight text-ink sm:text-5xl">{invitation.inviteeName}</h1>
        {invitation.includedGuests.length > 0 && (
          <div className="mx-auto mt-7 max-w-md rounded-xl border border-champagne/40 bg-paper px-5 py-5 shadow-soft">
            <p className="text-[0.7rem] font-medium uppercase tracking-[0.3em] text-gold">Your invitation also includes</p>
            <ul className="mt-3 space-y-1 font-serif text-[1.45rem] leading-snug text-ink">
              {invitation.includedGuests.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">Already confirmed by the couple — no need to add them below.</p>
          </div>
        )}
        <Ornament className="mt-7" />
        {invitation.hasExistingResponse && (
          <p className="mx-auto mt-6 max-w-md rounded-lg border border-champagne/40 bg-champagne-light/30 px-4 py-3 text-sm text-ink-soft">
            We already have your RSVP. Submitting again will update your previous response.
          </p>
        )}
      </div>

      {/* Attendance */}
      <fieldset className="mt-12" aria-invalid={errors.attendance ? true : undefined}>
        <legend className="mb-6 w-full text-center font-serif text-[2rem] leading-tight text-ink">Will you be joining us?</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceCard
            name="attendance"
            value="attending"
            checked={form.attendance === 'attending'}
            onChange={() => update({ attendance: 'attending' })}
            title="Joyfully, I'll be there!"
          />
          <ChoiceCard
            name="attendance"
            value="declining"
            checked={form.attendance === 'declining'}
            onChange={() => update({ attendance: 'declining' })}
            title="With love and warm wishes, I'll be celebrating from afar."
          />
        </div>
        <FieldError>{errors.attendance}</FieldError>
      </fieldset>

      <Collapse open={Boolean(form.attendance)}>
        <div className="mt-8 rounded-2xl border border-line bg-paper px-5 py-6 shadow-soft sm:px-9">
          <TextField
            id="mobile-number"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            label={
              <span className="text-[1.05rem] text-ink">
                Your mobile number {!attending && <span className="text-sm font-normal text-muted">(optional)</span>}
              </span>
            }
            value={form.mobileNumber}
            onChange={(v) => update({ mobileNumber: v })}
            maxLength={20}
            placeholder="0917 123 4567"
            hint="Used only for wedding updates. Never shared."
            error={errors.mobileNumber}
            required={attending}
          />
        </div>
      </Collapse>

      {/* Questions for guests who can't attend (admin-defined) */}
      <Collapse open={form.attendance === 'declining' && shown.length > 0}>
        <div className={cn('mt-8 rounded-2xl border border-line bg-paper px-5 py-8 shadow-soft sm:px-9', questionList)}>
          {form.attendance === 'declining' && customFields}
        </div>
      </Collapse>

      {/* Attending-only questions */}
      <Collapse open={attending}>
        <div className="mt-12 [&>*:last-child]:border-b-0 [&>*:last-child]:pb-0 space-y-10 rounded-2xl border border-line bg-paper px-5 py-8 shadow-soft sm:px-9 sm:py-10">
          {on('transportation') && (
          <Question>
            <OptionGroup
              legend={label('transportation')}
              name="has-transportation"
              options={YES_NO}
              value={form.hasTransportation}
              onChange={(v) =>
                update({
                  hasTransportation: v,
                  vehicleType: v === 'yes' ? form.vehicleType : null,
                  needsTransportation: v === 'no' ? form.needsTransportation : null,
                })
              }
              error={errors.hasTransportation}
            />
            <Collapse open={form.hasTransportation === 'no'}>
              <div className="pt-7">
                <OptionGroup<NeedsTransportation>
                  legend="Will you need transportation assistance?"
                  name="needs-transportation"
                  options={NEEDS_TRANSPORT_OPTIONS}
                  value={form.needsTransportation}
                  onChange={(v) => update({ needsTransportation: v })}
                  error={errors.needsTransportation}
                  columns={3}
                />
              </div>
            </Collapse>
            <Collapse open={form.hasTransportation === 'yes'}>
              <div className="pt-7">
                <OptionGroup<VehicleType>
                  legend="What type of vehicle will you be using?"
                  name="vehicle-type"
                  options={VEHICLE_OPTIONS}
                  value={form.vehicleType}
                  onChange={(v) => update({ vehicleType: v })}
                  error={errors.vehicleType}
                  columns={5}
                />
              </div>
            </Collapse>
          </Question>
          )}

          {on('comingFrom') && (
          <Question>
            <TextField
              id="coming-from"
              label={
                <span className="text-[1.05rem] text-ink">
                  {label('comingFrom')} {!comingFromRequired(config) && <span className="text-sm font-normal text-muted">(optional)</span>}
                </span>
              }
              value={form.comingFrom}
              onChange={(v) => update({ comingFrom: v })}
              maxLength={LIMITS.comingFrom}
              showCounter
              placeholder="e.g. Imus, Cavite"
              autoComplete="address-level2"
              error={errors.comingFrom}
            />
          </Question>
          )}

          {on('food') && (
          <Question>
            <fieldset aria-invalid={errors.foodPreferences ? true : undefined} aria-describedby="food-help">
              <legend className="mb-1 text-[1.05rem] font-medium text-ink">{label('food')}</legend>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p id="food-help" className="text-sm text-muted">
                  Choose up to {LIMITS.maxFoodSelections}.
                </p>
                <CharCounter value={form.foodPreferences.length} max={LIMITS.maxFoodSelections} />
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {FOOD_OPTIONS.map((o) => {
                  const checked = form.foodPreferences.includes(o.value)
                  const atLimit = !checked && form.foodPreferences.length >= LIMITS.maxFoodSelections
                  return (
                    <label
                      key={o.value}
                      className={cn(
                        'flex min-h-13 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-[0.95rem] transition-all duration-200',
                        'has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-gold has-[input:focus-visible]:ring-offset-2 has-[input:focus-visible]:ring-offset-paper',
                        checked ? 'border-champagne bg-champagne-light/40 text-ink' : 'border-line bg-paper text-ink-soft hover:border-champagne/60',
                        atLimit && 'opacity-60',
                      )}
                    >
                      <input
                        type="checkbox"
                        name="food"
                        value={o.value}
                        checked={checked}
                        onChange={() => toggleFood(o.value)}
                        aria-disabled={atLimit || undefined}
                        className="size-5 shrink-0 cursor-pointer rounded accent-ink"
                      />
                      {o.label}
                    </label>
                  )
                })}
              </div>
              <div aria-live="polite">
                {(foodLimitHit || errors.foodPreferences) && (
                  <p role="alert" className="mt-3 text-sm text-rose">
                    You can select up to {LIMITS.maxFoodSelections} dishes.
                  </p>
                )}
              </div>
            </fieldset>
          </Question>
          )}

          {on('dietary') && (
          <Question>
            <OptionGroup
              legend={label('dietary')}
              name="food-restrictions"
              options={YES_NO}
              value={form.hasFoodRestrictions}
              onChange={(v) => update({ hasFoodRestrictions: v, foodRestrictions: v === 'yes' ? form.foodRestrictions : '' })}
              error={errors.hasFoodRestrictions}
            />
            <Collapse open={form.hasFoodRestrictions === 'yes'}>
              <div className="pt-6">
                <TextField
                  id="food-restrictions-detail"
                  label="Please specify."
                  value={form.foodRestrictions}
                  onChange={(v) => update({ foodRestrictions: v })}
                  maxLength={LIMITS.foodRestrictions}
                  showCounter
                  placeholder="e.g. Shellfish allergy, vegetarian"
                  error={errors.foodRestrictions}
                />
              </div>
            </Collapse>
          </Question>
          )}

          {on('accessibility') && (
          <Question>
            <TextAreaField
              id="accessibility"
              label={
                <span className="text-[1.05rem] text-ink">
                  {label('accessibility')}{' '}
                  <span className="text-sm font-normal text-muted">(optional)</span>
                </span>
              }
              value={form.accessibilityNeeds}
              onChange={(v) => update({ accessibilityNeeds: v })}
              maxLength={LIMITS.accessibility}
              showCounter
              rows={3}
              placeholder="Let us know how we can make the day comfortable for you."
              error={errors.accessibilityNeeds}
            />
          </Question>
          )}

          {maxGuests > 0 && (
            <Question>
              <OptionGroup
                legend={
                  config?.builtins.additionalGuest?.label?.trim() ? (
                    label('additionalGuest')
                  ) : (
                    <>
                      Would you like to{' '}
                      <strong className="font-semibold">
                        bring an additional guest{guestPrice(config) > 0 ? ` for ${formatPeso(guestPrice(config))}` : ''}
                      </strong>
                      ?
                    </>
                  )
                }
                description={
                  <p className="-mt-1 mb-4 text-sm italic leading-relaxed text-muted">
                    If you would like to bring someone with you, please let us know below. We’ll review your request and get in touch
                    with you soon to confirm availability and arrange the payment details. ❤️
                  </p>
                }
                name="bringing-guest"
                options={YES_NO}
                value={form.bringingGuest}
                onChange={setBringingGuest}
                error={errors.bringingGuest}
              />
              <Collapse open={form.bringingGuest === 'yes'}>
                <div className="space-y-5 pt-7">
                  <AnimatePresence initial={false}>
                    {form.guestNames.map((name, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="flex items-start gap-2"
                      >
                        <TextField
                          id={`guest-name-${i}`}
                          className="flex-1"
                          label={maxGuests === 1 ? 'Additional Guest' : `Additional Guest ${i + 1}`}
                          value={name}
                          onChange={(v) => setGuestName(i, v)}
                          maxLength={LIMITS.guestName}
                          placeholder="Guest name"
                          autoComplete="off"
                          autoCapitalize="words"
                          error={errors.guestNameAt?.[i]}
                        />
                        {(form.guestNames.length > 1 || i > 0) && (
                          <button
                            type="button"
                            onClick={() => removeGuest(i)}
                            className="mt-[2.1rem] flex size-12 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-cream hover:text-rose"
                            aria-label={`Remove additional guest ${i + 1}`}
                          >
                            <Trash2 className="size-5" strokeWidth={1.5} />
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {maxGuests > 1 && form.guestNames.length < maxGuests && (
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        onClick={addGuest}
                        icon={<Plus aria-hidden="true" className="size-4" />}
                        aria-label="Add another additional guest"
                      >
                        Add guest
                      </Button>
                    </div>
                  )}
                  <p className="text-sm text-muted">
                    You may request up to {maxGuests} additional {guestLabel}.
                  </p>
                  {errors.guestNames && !errors.guestNameAt && <FieldError>{errors.guestNames}</FieldError>}
                </div>
              </Collapse>
            </Question>
          )}

          {attending && customFields}

          {on('message') && (
          <Question>
            <TextAreaField
              id="message-to-couple"
              label={
                <span className="text-[1.05rem] text-ink">
                  {label('message')}{' '}
                  <span className="text-sm font-normal text-muted">(optional)</span>
                </span>
              }
              value={form.messageToCouple}
              onChange={(v) => update({ messageToCouple: v })}
              maxLength={LIMITS.messageToCouple}
              showCounter
              rows={4}
              placeholder="Share your wishes, a favourite memory, or a word of advice…"
              error={errors.messageToCouple}
            />
          </Question>
          )}
        </div>
      </Collapse>

      {/* Confirm */}
      <div className="mt-12 text-center">
        {submitError && (
          <p role="alert" className="mx-auto mb-5 max-w-md rounded-lg border border-rose/30 bg-rose/5 px-4 py-3 text-sm text-rose">
            {submitError}
          </p>
        )}
        <Button type="submit" size="lg" fullWidth loading={submitting} loadingText="Saving your RSVP..." className="sm:w-auto sm:min-w-80">
          Confirm My Response
        </Button>
      </div>
    </form>
  )
}

function Question({ children }: { children: ReactNode }) {
  return <div className="border-b border-line/70 pb-10">{children}</div>
}
