import { supabase } from '../lib/supabase'
import type { IncludedGuestLookup, InvitationLookup } from '../types/rsvp'
import { FRIENDLY_ERRORS, FriendlyError, logError } from '../utils/errors'
import { normalizeSpaces } from '../utils/validation'

type LookupRow = {
  invitation_id: string
  invitee_name: string
  table_number: string | null
  max_additional_guests: number
  has_existing_response: boolean
  included_guests: string[] | null
}

function toLookup(row: LookupRow): InvitationLookup {
  return {
    invitationId: row.invitation_id,
    inviteeName: row.invitee_name,
    tableNumber: row.table_number,
    maxAdditionalGuests: Math.max(0, row.max_additional_guests ?? 0),
    hasExistingResponse: Boolean(row.has_existing_response),
    includedGuests: Array.isArray(row.included_guests) ? row.included_guests.filter(Boolean) : [],
  }
}

/**
 * Public invitation search. Calls the secure `find_invitation` RPC, which only
 * returns the one matching active invitation — the guest list is never exposed.
 * Returns null when there is no match.
 */
export async function findInvitationByName(fullName: string): Promise<InvitationLookup | null> {
  const searchName = normalizeSpaces(fullName)
  if (!searchName) return null
  const { data, error } = await supabase.rpc('find_invitation', { search_name: searchName })
  if (error) {
    logError('findInvitationByName', error)
    throw new FriendlyError(FRIENDLY_ERRORS.generic)
  }
  const row = Array.isArray(data) ? (data[0] as LookupRow | undefined) : undefined
  return row ? toLookup(row) : null
}

/**
 * Future-ready: supports personal links such as /#/rsvp?invite=abc123.
 * The name search remains the primary flow; guests never need a code.
 */
export async function findInvitationByCode(code: string): Promise<InvitationLookup | null> {
  const clean = code.trim()
  if (!clean || clean.length > 64) return null
  const { data, error } = await supabase.rpc('find_invitation_by_code', { invite_code: clean })
  if (error) {
    logError('findInvitationByCode', error)
    throw new FriendlyError(FRIENDLY_ERRORS.generic)
  }
  const row = Array.isArray(data) ? (data[0] as LookupRow | undefined) : undefined
  return row ? toLookup(row) : null
}

/**
 * When a name isn't the main name on any invitation, checks whether that person is
 * included in someone else's invitation, so the page can explain instead of "not found".
 */
export async function findIncludedGuest(fullName: string): Promise<IncludedGuestLookup | null> {
  const searchName = normalizeSpaces(fullName)
  if (!searchName) return null
  const { data, error } = await supabase.rpc('find_included_guest', { search_name: searchName })
  if (error) {
    // Never block the normal "not found" message on this extra check.
    logError('findIncludedGuest', error)
    return null
  }
  const row = Array.isArray(data) ? data[0] : undefined
  if (!row?.invitee_name) return null
  const st = row.attendance_status
  return { searchedName: searchName, inviteeName: row.invitee_name, attendanceStatus: st === 'attending' || st === 'declining' ? st : null }
}

/**
 * "Did you mean …?" — one close match for a mistyped name, or null. Only
 * answers when exactly one guest's name is that close.
 */
export async function suggestGuestName(fullName: string): Promise<string | null> {
  const searchName = normalizeSpaces(fullName)
  if (searchName.length < 4) return null
  const { data, error } = await supabase.rpc('suggest_guest_name', { search_name: searchName })
  if (error) {
    logError('suggestGuestName', error)
    return null
  }
  return typeof data === 'string' && data ? data : null
}
