import { supabase } from '../lib/supabase'
import type { AttendanceStatus, RSVPSubmission } from '../types/rsvp'
import { FRIENDLY_ERRORS, FriendlyError, RsvpClosedError, logError } from '../utils/errors'

const answerParams = (payload: RSVPSubmission) => ({
  p_attendance_status: payload.attendanceStatus,
  p_has_transportation: payload.hasTransportation,
  p_needs_transportation: payload.needsTransportation,
  p_vehicle_type: payload.vehicleType,
  p_coming_from: payload.comingFrom,
  p_food_preferences: payload.foodPreferences,
  p_has_food_restrictions: payload.hasFoodRestrictions,
  p_food_restrictions: payload.foodRestrictions,
  p_accessibility_needs: payload.accessibilityNeeds,
  p_additional_guests: payload.additionalGuests,
  p_message_to_couple: payload.messageToCouple,
  p_mobile_number: payload.mobileNumber,
  p_custom_answers: payload.customAnswers,
})

function failRsvp(context: string, error: { message?: string; hint?: string | null }): never {
  logError(context, error)
  const msg = error.message ?? ''
  if (msg.includes('RSVP_CLOSED')) throw new RsvpClosedError()
  if (msg.includes('RSVP_INVITATION_NOT_FOUND')) throw new FriendlyError(FRIENDLY_ERRORS.unavailable)
  if (msg.includes('RSVP_INVALID') && msg.includes('question')) {
    throw new FriendlyError('The RSVP questions were just updated. Please refresh the page, check your answers and try again.')
  }
  if (msg.includes('RSVP_INVALID: name')) throw new FriendlyError('Please type your first and last name.')
  if (msg.includes('RSVP_INVALID: mobile_number')) throw new FriendlyError('Please enter a valid Philippine mobile number, e.g. 0917 123 4567.')
  if (msg.includes('RSVP_INVALID')) throw new FriendlyError(FRIENDLY_ERRORS.invalid)
  if (error.hint === 'plan_guest_limit') throw new FriendlyError('Sorry — our RSVP list is full. Please message the parents-to-be.')
  throw new FriendlyError(FRIENDLY_ERRORS.generic)
}

/**
 * Saves (or updates) the guest's RSVP through the `submit_rsvp` RPC.
 * The database function validates every field, upserts the single response
 * for the invitation (unique(invitation_id)) and reconciles additional guests.
 */
export async function submitRSVP(payload: RSVPSubmission): Promise<{ rsvpId: string; attendanceStatus: AttendanceStatus }> {
  const { data, error } = await supabase.rpc('submit_rsvp', { p_invitation_id: payload.invitationId, ...answerParams(payload) })
  if (error) failRsvp('submitRSVP', error)

  const row = Array.isArray(data) ? (data[0] as { rsvp_id: string; attendance_status: string } | undefined) : undefined
  if (!row) throw new FriendlyError(FRIENDLY_ERRORS.generic)
  return { rsvpId: row.rsvp_id, attendanceStatus: row.attendance_status as AttendanceStatus }
}

/**
 * Open link (Website Settings → How guests RSVP): a guest who isn't on any list
 * signs up with their name and mobile number. The database creates their
 * invitation (or finds the same name again) and saves the reply exactly like
 * submit_rsvp — companions wait for the customer's approval.
 */
export async function submitOpenRSVP(name: string, payload: RSVPSubmission): Promise<{ rsvpId: string; attendanceStatus: AttendanceStatus; invitationId: string }> {
  const { data, error } = await supabase.rpc('open_rsvp_submit', { p_name: name, ...answerParams(payload) })
  if (error) failRsvp('submitOpenRSVP', error)
  const row = Array.isArray(data) ? (data[0] as { rsvp_id: string; attendance_status: string; invitation_id: string } | undefined) : undefined
  if (!row) throw new FriendlyError(FRIENDLY_ERRORS.generic)
  return { rsvpId: row.rsvp_id, attendanceStatus: row.attendance_status as AttendanceStatus, invitationId: row.invitation_id }
}
