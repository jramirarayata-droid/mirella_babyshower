import type { InvitationInput, RSVPFormState, RSVPSubmission } from '../types/rsvp'
import type { RsvpConfig, RsvpQuestion } from '../types/questions'
import { builtinEnabled, cleanCustomAnswers, comingFromRequired, validateCustomAnswers, visibleQuestions } from './questions'

/** Limits shared with the database constraints in supabase/schema.sql. */
export const LIMITS = {
  inviteeName: 150,
  tableNumber: 50,
  comingFrom: 120,
  foodRestrictions: 120,
  accessibility: 255,
  guestName: 150,
  messageToCouple: 500,
  maxFoodSelections: 4,
  maxAdditionalGuestsPerInvitation: 10,
} as const

/** Trim + collapse internal whitespace. */
export function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

/**
 * Philippine mobile number → "+639XXXXXXXXX", or null when invalid.
 * Same rules as public.normalize_ph_mobile() in the database.
 */
export function normalizePhMobile(value: string): string | null {
  const d = value.replace(/[^0-9]/g, '')
  if (/^639\d{9}$/.test(d)) return `+${d}`
  if (/^09\d{9}$/.test(d)) return `+63${d.slice(1)}`
  if (/^9\d{9}$/.test(d)) return `+63${d}`
  return null
}

/** "+639171234567" → "0917 123 4567" */
export function formatPhMobile(value: string | null | undefined): string {
  if (!value) return '—'
  const n = normalizePhMobile(value)
  if (!n) return value
  const local = `0${n.slice(3)}`
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`
}

/** Same normalisation as public.normalize_name() in the database. */
export function normalizeName(value: string): string {
  return normalizeSpaces(value).toLowerCase()
}

export type RSVPErrors = Partial<
  Record<
    | 'attendance'
    | 'hasTransportation'
    | 'needsTransportation'
    | 'vehicleType'
    | 'comingFrom'
    | 'foodPreferences'
    | 'hasFoodRestrictions'
    | 'foodRestrictions'
    | 'accessibilityNeeds'
    | 'bringingGuest'
    | 'guestNames'
    | 'messageToCouple'
    | 'mobileNumber',
    string
  >
> & { guestNameAt?: Record<number, string>; custom?: Record<string, string> }

export function validateRSVP(
  form: RSVPFormState,
  maxAdditionalGuests: number,
  config?: RsvpConfig,
  questions: RsvpQuestion[] = [],
): RSVPErrors {
  const errors: RSVPErrors = {}
  const on = (k: Parameters<typeof builtinEnabled>[1]) => builtinEnabled(config, k)

  if (!form.attendance) {
    errors.attendance = 'Please let us know if you can join us.'
    return errors
  }
  if (!form.mobileNumber.trim()) {
    if (form.attendance === 'attending') errors.mobileNumber = 'Please enter your mobile number.'
  } else if (!normalizePhMobile(form.mobileNumber)) errors.mobileNumber = 'Please enter a valid Philippine mobile number, e.g. 0917 123 4567.'
  const custom = validateCustomAnswers(visibleQuestions(questions, form.attendance, form.customAnswers), form.customAnswers)
  if (Object.keys(custom).length) errors.custom = custom
  if (form.attendance === 'declining') return errors

  if (!on('transportation')) {
    // skipped
  } else if (!form.hasTransportation) {
    errors.hasTransportation = 'Please choose an option.'
  } else if (form.hasTransportation === 'yes' && !form.vehicleType) {
    errors.vehicleType = 'Please choose your vehicle type.'
  } else if (form.hasTransportation === 'no' && !form.needsTransportation) {
    errors.needsTransportation = 'Please choose an option.'
  }

  const comingFrom = normalizeSpaces(form.comingFrom)
  if (!on('comingFrom')) {
    // skipped
  } else if (!comingFrom) {
    if (comingFromRequired(config)) errors.comingFrom = 'Please tell us where you will be coming from.'
  } else if (comingFrom.length > LIMITS.comingFrom) errors.comingFrom = `Please keep this under ${LIMITS.comingFrom} characters.`

  if (on('food') && form.foodPreferences.length > LIMITS.maxFoodSelections) {
    errors.foodPreferences = `You can select up to ${LIMITS.maxFoodSelections} dishes.`
  }

  if (!on('dietary')) {
    // skipped
  } else if (!form.hasFoodRestrictions) {
    errors.hasFoodRestrictions = 'Please choose an option.'
  } else if (form.hasFoodRestrictions === 'yes') {
    const r = form.foodRestrictions.trim()
    if (!r) errors.foodRestrictions = 'Please specify your allergies or dietary restrictions.'
    else if (r.length > LIMITS.foodRestrictions) errors.foodRestrictions = `Please keep this under ${LIMITS.foodRestrictions} characters.`
  }

  if (on('accessibility') && form.accessibilityNeeds.trim().length > LIMITS.accessibility) {
    errors.accessibilityNeeds = `Please keep this under ${LIMITS.accessibility} characters.`
  }

  if (on('message') && form.messageToCouple.trim().length > LIMITS.messageToCouple) {
    errors.messageToCouple = `Please keep your message under ${LIMITS.messageToCouple} characters.`
  }

  if (maxAdditionalGuests > 0) {
    if (!form.bringingGuest) {
      errors.bringingGuest = 'Please choose an option.'
    } else if (form.bringingGuest === 'yes') {
      const perIndex: Record<number, string> = {}
      const seen = new Set<string>()
      form.guestNames.forEach((raw, i) => {
        const name = normalizeSpaces(raw)
        if (!name) perIndex[i] = 'Please enter a name or remove this guest.'
        else if (name.length > LIMITS.guestName) perIndex[i] = `Please keep names under ${LIMITS.guestName} characters.`
        else if (seen.has(name.toLowerCase())) perIndex[i] = 'This name is already listed.'
        seen.add(name.toLowerCase())
      })
      if (form.guestNames.length === 0) errors.guestNames = 'Please add your guest’s name.'
      if (form.guestNames.length > maxAdditionalGuests) {
        errors.guestNames = `You may bring up to ${maxAdditionalGuests} additional ${maxAdditionalGuests === 1 ? 'guest' : 'guests'}.`
      }
      if (Object.keys(perIndex).length) {
        errors.guestNameAt = perIndex
        errors.guestNames ??= 'Please check your guest names.'
      }
    }
  }

  return errors
}

export function hasErrors(errors: RSVPErrors): boolean {
  return Object.keys(errors).length > 0
}

/** Converts form state into the exact payload stored in the database. */
export function toSubmission(
  invitationId: string,
  form: RSVPFormState,
  maxAdditionalGuests: number,
  config?: RsvpConfig,
  questions: RsvpQuestion[] = [],
): RSVPSubmission {
  const customAnswers = cleanCustomAnswers(visibleQuestions(questions, form.attendance, form.customAnswers), form.customAnswers)
  const on = (k: Parameters<typeof builtinEnabled>[1]) => builtinEnabled(config, k)
  if (form.attendance !== 'attending') {
    return {
      invitationId,
      attendanceStatus: 'declining',
      hasTransportation: null,
      needsTransportation: null,
      vehicleType: null,
      comingFrom: null,
      foodPreferences: [],
      hasFoodRestrictions: null,
      foodRestrictions: null,
      accessibilityNeeds: null,
      additionalGuests: [],
      messageToCouple: null,
      mobileNumber: normalizePhMobile(form.mobileNumber) ?? '',
      customAnswers,
    }
  }
  const transportOn = on('transportation')
  const ownVehicle = form.hasTransportation === 'yes'
  const dietaryOn = on('dietary')
  const hasRestrictions = form.hasFoodRestrictions === 'yes'
  const access = on('accessibility') ? form.accessibilityNeeds.trim() : ''
  const comingFrom = on('comingFrom') ? normalizeSpaces(form.comingFrom) : ''
  const message = on('message') ? form.messageToCouple.trim() : ''
  return {
    invitationId,
    attendanceStatus: 'attending',
    hasTransportation: transportOn ? ownVehicle : null,
    needsTransportation: transportOn && !ownVehicle ? form.needsTransportation : null,
    vehicleType: transportOn && ownVehicle ? form.vehicleType : null,
    comingFrom: comingFrom || null,
    foodPreferences: on('food') ? [...new Set(form.foodPreferences)].slice(0, LIMITS.maxFoodSelections) : [],
    hasFoodRestrictions: dietaryOn ? hasRestrictions : null,
    foodRestrictions: dietaryOn && hasRestrictions ? form.foodRestrictions.trim() : null,
    accessibilityNeeds: access ? access : null,
    additionalGuests:
      maxAdditionalGuests > 0 && form.bringingGuest === 'yes'
        ? form.guestNames.map(normalizeSpaces).filter(Boolean).slice(0, maxAdditionalGuests)
        : [],
    messageToCouple: message ? message : null,
    mobileNumber: normalizePhMobile(form.mobileNumber) ?? '',
    customAnswers,
  }
}

export type InvitationErrors = Partial<Record<keyof InvitationInput, string>>

export function validateInvitation(input: InvitationInput): InvitationErrors {
  const errors: InvitationErrors = {}
  const name = normalizeSpaces(input.inviteeName)
  if (!name) errors.inviteeName = 'Invitee name is required.'
  if (input.side !== 'groom' && input.side !== 'bride') errors.side = 'Choose the Groom’s side or the Bride’s side.'
  else if (name.length > LIMITS.inviteeName) errors.inviteeName = `Please keep the name under ${LIMITS.inviteeName} characters.`
  const max = input.maxAdditionalGuests
  if (!Number.isInteger(max) || max < 0 || max > LIMITS.maxAdditionalGuestsPerInvitation) {
    errors.maxAdditionalGuests = `Enter a whole number from 0 to ${LIMITS.maxAdditionalGuestsPerInvitation}.`
  }
  return errors
}

export function isValidHttpUrl(value: string): boolean {
  if (!value.trim()) return true
  try {
    const u = new URL(value.trim())
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}
