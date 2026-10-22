import { supabase } from '../lib/supabase'
import type { Tables } from '../types/database'
import type {
  ActivityLog,
  AdditionalGuest,
  AttendanceStatus,
  FoodOption,
  GuestSource,
  GuestStatus,
  GuestWithInvitation,
  Invitation,
  MergedFrom,
  InvitationInput,
  InvitationWithRSVP,
  NeedsTransportation,
  RSVPResponse,
  VehicleType,
} from '../types/rsvp'
import { FRIENDLY_ERRORS, FriendlyError, logError, planLimitError } from '../utils/errors'
import { normalizeSpaces } from '../utils/validation'
import { mapTable } from './seatingService'
import { loginEmail } from './spaceService'
import type { SeatingTable } from '../types/seating'
import { toSide } from '../utils/headcount'

// ----- Auth ---------------------------------------------------------------------

/**
 * Signs in with a username (logins the owner created) or an email.
 * `requireAdmin`: on a shower's own page the login must be able to manage that shower.
 */
export async function signInAdmin(usernameOrEmail: string, password: string, requireAdmin = true): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: loginEmail(usernameOrEmail), password })
  if (error) {
    logError('signInAdmin', error)
    throw new FriendlyError('The username or password is incorrect.')
  }
  if (!requireAdmin) return
  const admin = await checkIsAdmin()
  if (!admin) {
    await supabase.auth.signOut()
    throw new FriendlyError('This login can’t manage this baby shower. If your plan has just ended or isn’t switched on yet, please message us.')
  }
}

export async function signOutAdmin(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) logError('signOutAdmin', error)
}

/** True when the signed-in user is listed in public.admin_users. */
export async function checkIsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_admin')
  if (error) {
    logError('checkIsAdmin', error)
    return false
  }
  return data === true
}

// ----- Mapping ------------------------------------------------------------------

const mapInvitation = (r: Tables<'invitations'>): Invitation => ({
  id: r.id,
  inviteeName: r.invitee_name,
  invitationCode: r.invitation_code,
  tableNumber: r.table_number,
  tableId: r.table_id ?? null,
  printedAt: r.printed_at ?? null,
  positionMode: (['custom', 'none'].includes(r.position_mode) ? r.position_mode : 'auto') as Invitation['positionMode'],
  positionLabel: r.position_label ?? '',
  addressedAs: r.addressed_as ?? '',
  side: toSide(r.side),
  maxAdditionalGuests: r.max_additional_guests,
  isActive: r.is_active,
  source: (r as { source?: string | null }).source === 'link' ? 'link' : 'list',
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

const mapResponse = (r: Tables<'rsvp_responses'>): RSVPResponse => ({
  id: r.id,
  invitationId: r.invitation_id,
  attendanceStatus: r.attendance_status as AttendanceStatus,
  hasTransportation: r.has_transportation,
  needsTransportation: r.needs_transportation as NeedsTransportation | null,
  vehicleType: r.vehicle_type as VehicleType | null,
  comingFrom: r.coming_from,
  foodPreferences: (r.food_preferences ?? []) as FoodOption[],
  hasFoodRestrictions: r.has_food_restrictions,
  foodRestrictions: r.food_restrictions,
  accessibilityNeeds: r.accessibility_needs,
  bringingAdditionalGuest: r.bringing_additional_guest,
  messageToCouple: r.message_to_couple ?? null,
  mobileNumber: r.mobile_number ?? null,
  recordedByAdmin: r.recorded_by_admin === true,
  customAnswers: r.custom_answers && typeof r.custom_answers === 'object' && !Array.isArray(r.custom_answers) ? (r.custom_answers as Record<string, unknown>) : {},
  submittedAt: r.submitted_at,
  updatedAt: r.updated_at,
})

const mapGuest = (r: Tables<'additional_guests'>): AdditionalGuest => ({
  id: r.id,
  invitationId: r.invitation_id,
  rsvpResponseId: r.rsvp_response_id,
  guestName: r.guest_name,
  status: r.status as GuestStatus,
  addedBy: (r.added_by === 'admin' ? 'admin' : 'invitee') as GuestSource,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  mergedFrom: mapMergedFrom(r.merged_from),
})

function mapMergedFrom(v: unknown): MergedFrom | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const o = v as Record<string, unknown>
  const text = (x: unknown) => (typeof x === 'string' ? x : '')
  const rsvp = o.rsvp && typeof o.rsvp === 'object' ? (o.rsvp as Record<string, unknown>) : null
  const answer = rsvp?.attendance_status === 'attending' || rsvp?.attendance_status === 'declining' ? rsvp.attendance_status : null
  return {
    inviteeName: text(o.invitee_name),
    invitationCode: text(o.invitation_code),
    positionLabel: text(o.position_label),
    answer,
    combinedAt: text(o.combined_at),
  }
}

// ----- Loading ------------------------------------------------------------------

const PAGE = 1000

/** Reads every row of a query, page by page (PostgREST caps rows per request). */
async function fetchAll<R>(
  label: string,
  query: (from: number, to: number) => PromiseLike<{ data: R[] | null; error: unknown }>,
): Promise<R[]> {
  const rows: R[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1)
    if (error) {
      logError(`fetchAll:${label}`, error)
      throw new FriendlyError(FRIENDLY_ERRORS.generic)
    }
    const page = data ?? []
    rows.push(...page)
    if (page.length < PAGE) break
  }
  return rows
}

export interface AdminData {
  invitations: InvitationWithRSVP[]
  guests: GuestWithInvitation[]
  tables: SeatingTable[]
  /** "invitationId:guestId" of everyone with a chair */
  seatedKeys: Set<string>
}

/** Loads invitations, responses and additional guests (admin only — enforced by RLS). */
export async function loadAdminData(): Promise<AdminData> {
  const [invRows, respRows, guestRows, tableRows, seatRows] = await Promise.all([
    fetchAll<Tables<'invitations'>>('invitations', (a, b) =>
      supabase.from('invitations').select('*').order('created_at', { ascending: true }).range(a, b),
    ),
    fetchAll<Tables<'rsvp_responses'>>('rsvp_responses', (a, b) =>
      supabase.from('rsvp_responses').select('*').order('submitted_at', { ascending: true }).range(a, b),
    ),
    fetchAll<Tables<'additional_guests'>>('additional_guests', (a, b) =>
      supabase.from('additional_guests').select('*').order('created_at', { ascending: true }).range(a, b),
    ),
    fetchAll<Tables<'seating_tables'>>('seating_tables', (a, b) =>
      supabase.from('seating_tables').select('*').order('sort_order').order('created_at').range(a, b),
    ),
    fetchAll<Tables<'seat_assignments'>>('seat_assignments', (a, b) =>
      supabase.from('seat_assignments').select('table_id,invitation_id,guest_id').range(a, b) as never,
    ),
  ])
  const tables = tableRows.map(mapTable)
  const tableName = new Map(tables.map((t) => [t.id, t.name]))
  const inviteeSeatTable = new Map(seatRows.filter((s) => !s.guest_id).map((s) => [s.invitation_id, s.table_id]))
  const seatedKeys = new Set(seatRows.map((s) => `${s.invitation_id}:${s.guest_id ?? ''}`))

  const responses = new Map(respRows.map((r) => [r.invitation_id, mapResponse(r)]))
  const guestsByInvitation = new Map<string, AdditionalGuest[]>()
  for (const g of guestRows.map(mapGuest)) {
    const list = guestsByInvitation.get(g.invitationId) ?? []
    list.push(g)
    guestsByInvitation.set(g.invitationId, list)
  }

  const invitations: InvitationWithRSVP[] = invRows
    .map(mapInvitation)
    .map((inv): InvitationWithRSVP => {
      const response = responses.get(inv.id) ?? null
      const tid = inviteeSeatTable.get(inv.id) ?? inv.tableId
      const legacy = inv.tableNumber?.trim() ? (/^\d+$/.test(inv.tableNumber.trim()) ? `Table ${inv.tableNumber.trim()}` : inv.tableNumber.trim()) : null
      return {
        ...inv,
        tableId: inv.tableId,
        tableNumber: (tid && tableName.get(tid)) || legacy,
        response,
        guests: guestsByInvitation.get(inv.id) ?? [],
        status: response ? response.attendanceStatus : 'pending',
      }
    })
    .sort((a, b) => a.inviteeName.localeCompare(b.inviteeName))

  const byId = new Map(invitations.map((i) => [i.id, i]))
  const guests: GuestWithInvitation[] = guestRows
    .map(mapGuest)
    .map((g) => ({
      ...g,
      invitedBy: byId.get(g.invitationId)?.inviteeName ?? '—',
      tableNumber: byId.get(g.invitationId)?.tableNumber ?? null,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return { invitations, guests, tables, seatedKeys }
}

// ----- Invitations --------------------------------------------------------------

function invitationError(context: string, error: { code?: string; hint?: string; message?: string } | null): never {
  logError(context, error)
  planLimitError(error)
  if (error?.code === '23505') {
    throw new FriendlyError('An active invitation with this name already exists. Add a detail to make it unique, e.g. "Maria Santos (Tita)".')
  }
  if (error?.code === '23514') throw new FriendlyError('Please check the invitation details and try again.')
  throw new FriendlyError('We couldn’t save the invitation. Please try again.')
}

function toInvitationRow(input: InvitationInput) {
  return {
    invitee_name: normalizeSpaces(input.inviteeName),
    table_id: input.tableId,
    position_mode: input.positionMode,
    position_label: input.positionMode === 'custom' && input.positionLabel.trim() ? input.positionLabel.trim().slice(0, 80) : null,
    side: input.side ?? 'groom',
    max_additional_guests: input.maxAdditionalGuests,
    is_active: input.isActive,
  }
}

export async function createInvitation(input: InvitationInput): Promise<Invitation> {
  const { data, error } = await supabase.from('invitations').insert(toInvitationRow(input)).select('*').single()
  if (error || !data) invitationError('createInvitation', error)
  return mapInvitation(data as Tables<'invitations'>)
}

export async function updateInvitation(id: string, input: InvitationInput): Promise<Invitation> {
  const { data, error } = await supabase.from('invitations').update(toInvitationRow(input)).eq('id', id).select('*').single()
  if (error || !data) invitationError('updateInvitation', error)
  return mapInvitation(data as Tables<'invitations'>)
}

/** Changes only the position printed under the name (used from Printables). */
export async function updateInvitationPosition(id: string, mode: Invitation['positionMode'], label: string): Promise<void> {
  const clean = label.trim().slice(0, 80)
  const { error } = await supabase
    .from('invitations')
    .update({ position_mode: mode, position_label: mode === 'custom' && clean ? clean : null })
    .eq('id', id)
  if (error) invitationError('updateInvitationPosition', error)
}

/** Changes only how the invitation is addressed (used from Printables); '' goes back to the usual name. */
export async function updateInvitationAddressedAs(id: string, text: string): Promise<void> {
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, 120)
  const { error } = await supabase.from('invitations').update({ addressed_as: clean || null }).eq('id', id)
  if (error) invitationError('updateInvitationAddressedAs', error)
}

/**
 * Replaces the list of guests the couple included in an invitation.
 * Included guests are approved automatically and are shown to the invitee
 * after the invitation animation. A matching guest request is converted.
 */
export async function setIncludedGuests(invitationId: string, names: string[]): Promise<void> {
  const { error } = await supabase.rpc('admin_set_included_guests', {
    p_invitation_id: invitationId,
    p_names: names.map(normalizeSpaces).filter(Boolean),
  })
  if (error) {
    logError('setIncludedGuests', error)
    if ((error.message ?? '').includes('GUEST_NAME_TOO_LONG')) throw new FriendlyError('Guest names must be 150 characters or fewer.')
    if ((error.message ?? '').includes('TOO_MANY_INCLUDED_GUESTS')) throw new FriendlyError('An invitation can include at most 20 guests.')
    throw new FriendlyError('The invitation was saved, but its included guests could not be updated. Please try again.')
  }
}

const NEEDS_039 = 'Combining invitations needs a quick database update first (migration 039).'

/**
 * Includes one invitation in another: its invitee becomes an included guest there,
 * keeping their chair, entourage place, photos and old link. Returns the new guest's id.
 */
export async function includeInvitation(fromId: string, intoId: string): Promise<string> {
  const { data, error } = await supabase.rpc('admin_include_invitation', { p_from: fromId, p_into: intoId })
  if (error) {
    logError('includeInvitation', error)
    const m = `${error.message ?? ''} ${error.code ?? ''}`
    if (m.includes('PGRST202') || m.includes('admin_include_invitation')) throw new FriendlyError(NEEDS_039)
    if (m.includes('COMBINE_SAME_NAME')) throw new FriendlyError('Both invitations have the same name — pick a different invitation.')
    if (m.includes('COMBINE_SAME_INVITATION')) throw new FriendlyError('Pick a different invitation to include them in.')
    if (m.includes('TOO_MANY_INCLUDED_GUESTS')) throw new FriendlyError('That would make more than 20 included guests on one invitation.')
    if (m.includes('INVITATION_NOT_FOUND')) throw new FriendlyError('One of the invitations was deleted in the meantime. Please refresh.')
    throw new FriendlyError('Could not combine the invitations. Nothing was changed — please try again.')
  }
  return String(data)
}

/** Gives an included guest their own invitation again (their old link comes back if they had one). */
export async function separateGuest(guestId: string): Promise<string> {
  const { data, error } = await supabase.rpc('admin_separate_guest', { p_guest: guestId })
  if (error) {
    logError('separateGuest', error)
    const m = `${error.message ?? ''} ${error.code ?? ''}`
    if (m.includes('PGRST202') || m.includes('admin_separate_guest')) throw new FriendlyError(NEEDS_039)
    if (m.includes('SEPARATE_NAME_TAKEN')) throw new FriendlyError('There is already an invitation with that name.')
    if (m.includes('GUEST_NOT_FOUND')) throw new FriendlyError('That guest was removed in the meantime. Please refresh.')
    throw new FriendlyError('Could not give them their own invitation. Nothing was changed — please try again.')
  }
  return String(data)
}

/** Records attending / not attending on a guest's behalf (e.g. elderly guests). */
export async function recordRsvpForGuest(invitationId: string, status: 'attending' | 'declining', mobile: string): Promise<void> {
  const { error } = await supabase.rpc('admin_record_rsvp', {
    p_invitation_id: invitationId,
    p_status: status,
    p_mobile_number: mobile.trim() || null,
  })
  if (error) {
    logError('recordRsvpForGuest', error)
    if ((error.message ?? '').includes('mobile_number')) throw new FriendlyError('The invitation was saved, but the contact number looks wrong. Use a PH mobile number like 0917 123 4567.')
    throw new FriendlyError('The invitation was saved, but the response could not be recorded. Please try again.')
  }
}

/** Remembers when paper invitations were printed. */
export async function markInvitationsPrinted(ids: string[]): Promise<void> {
  if (!ids.length) return
  const { error } = await supabase.from('invitations').update({ printed_at: new Date().toISOString() }).in('id', ids)
  if (error) {
    logError('markInvitationsPrinted', error)
    throw new FriendlyError('Could not mark the invitations as printed. Please try again.')
  }
}

/** Deletes the invitation; its RSVP and additional guests are removed by ON DELETE CASCADE. */
export async function deleteInvitation(id: string): Promise<void> {
  const { error } = await supabase.from('invitations').delete().eq('id', id)
  if (error) {
    logError('deleteInvitation', error)
    throw new FriendlyError('We couldn’t delete the invitation. Please try again.')
  }
}

// ----- Responses & guests -------------------------------------------------------

/** Deletes an RSVP response only. The invitation stays and becomes Pending again. */
export async function deleteResponse(responseId: string): Promise<void> {
  const { error } = await supabase.from('rsvp_responses').delete().eq('id', responseId)
  if (error) {
    logError('deleteResponse', error)
    throw new FriendlyError('We couldn’t delete the response. Please try again.')
  }
}

export async function updateGuestStatus(guestId: string, status: GuestStatus): Promise<void> {
  const { error } = await supabase.from('additional_guests').update({ status }).eq('id', guestId)
  if (error) {
    logError('updateGuestStatus', error)
    throw new FriendlyError('We couldn’t update the guest status. Please try again.')
  }
}

// ----- Activity -----------------------------------------------------------------

export async function listRecentActivity(limit = 8): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from('admin_activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    logError('listRecentActivity', error)
    return []
  }
  return ((data ?? []) as Tables<'admin_activity_logs'>[]).map((r) => ({
    id: r.id,
    action: r.action,
    targetTable: r.target_table,
    targetId: r.target_id,
    details: r.details && typeof r.details === 'object' && !Array.isArray(r.details) ? (r.details as Record<string, unknown>) : {},
    createdAt: r.created_at,
  }))
}

/** Manual log entry (most admin actions are logged automatically by database triggers). */
export async function logActivity(action: string, targetTable: string | null, targetId: string | null, details: Record<string, string | number | boolean | null> = {}): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return
  const { error } = await supabase.from('admin_activity_logs').insert({
    admin_user_id: userId,
    action,
    target_table: targetTable,
    target_id: targetId,
    details,
  })
  if (error) logError('logActivity', error)
}
