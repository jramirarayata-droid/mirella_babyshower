import { supabase } from '../lib/supabase'
import type { AttendanceStatus, RSVPSubmission } from '../types/rsvp'
import { FRIENDLY_ERRORS, FriendlyError, RsvpClosedError, logError } from '../utils/errors'

/**
 * Saves (or updates) the guest's RSVP through the `submit_rsvp` RPC.
 * The database function validates every field, upserts the single response
 * for the invitation (unique(invitation_id)) and reconciles additional guests.
 */
export async function submitRSVP(payload: RSVPSubmission): Promise<{ rsvpId: string; attendanceStatus: AttendanceStatus }> {
  const { data, error } = await supabase.rpc('submit_rsvp', {
    p_invitation_id: payload.invitationId,
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

  if (error) {
    logError('submitRSVP', error)
    const msg = error.message ?? ''
    if (msg.includes('RSVP_CLOSED')) throw new RsvpClosedError()
    if (msg.includes('RSVP_INVITATION_NOT_FOUND')) throw new FriendlyError(FRIENDLY_ERRORS.unavailable)
    if (msg.includes('RSVP_INVALID') && msg.includes('question')) {
      throw new FriendlyError('The RSVP questions were just updated. Please refresh the page, check your answers and try again.')
    }
    if (msg.includes('RSVP_INVALID')) throw new FriendlyError(FRIENDLY_ERRORS.invalid)
    throw new FriendlyError(FRIENDLY_ERRORS.generic)
  }

  const row = Array.isArray(data) ? (data[0] as { rsvp_id: string; attendance_status: string } | undefined) : undefined
  if (!row) throw new FriendlyError(FRIENDLY_ERRORS.generic)
  return { rsvpId: row.rsvp_id, attendanceStatus: row.attendance_status as AttendanceStatus }
}
