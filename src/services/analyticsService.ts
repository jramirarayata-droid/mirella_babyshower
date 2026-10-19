import type { FoodOption, GuestWithInvitation, InvitationWithRSVP } from '../types/rsvp'
import { FOOD_OPTIONS } from '../utils/formatting'

export interface DashboardAnalytics {
  totalInvitations: number
  activeInvitations: number
  attending: number
  declining: number
  pending: number
  pendingGuestRequests: number
  approvedGuests: number
  declinedGuests: number
  /** Primary invitees + couple-included guests on active invitations. */
  invitedGuests: number
  includedGuests: number
  /** Attending invitees + approved additional guests. */
  expectedAttendees: number
  transportation: { ownVehicle: number; needTransport: number; notSure: number; noAssistance: number }
  food: { value: FoodOption; label: string; count: number }[]
  dietary: { none: number; has: number }
  accessibilityRequests: number
  responseRate: number
}

/** All numbers are derived from real rows loaded from Supabase. */
export function computeAnalytics(invitations: InvitationWithRSVP[], guests: GuestWithInvitation[]): DashboardAnalytics {
  const totalInvitations = invitations.length
  const active = invitations.filter((i) => i.isActive)
  const attendingInv = invitations.filter((i) => i.status === 'attending')
  const attending = attendingInv.length
  const declining = invitations.filter((i) => i.status === 'declining').length
  // Pending = invitations without a current RSVP (never stored as a fake row).
  const pending = totalInvitations - attending - declining

  const attendingIds = new Set(attendingInv.map((i) => i.id))
  // Request statistics only cover guests the invitee asked for; couple-included
  // guests are approved automatically and counted separately.
  const requests = guests.filter((g) => g.addedBy === 'invitee')
  const pendingGuestRequests = requests.filter((g) => g.status === 'pending').length
  const approvedGuests = requests.filter((g) => g.status === 'approved').length
  const declinedGuests = requests.filter((g) => g.status === 'declined').length
  const activeIds = new Set(active.map((i) => i.id))
  const includedOnActive = guests.filter((g) => g.addedBy === 'admin' && activeIds.has(g.invitationId)).length

  const transportation = { ownVehicle: 0, needTransport: 0, notSure: 0, noAssistance: 0 }
  const foodCounts = new Map<FoodOption, number>()
  const dietary = { none: 0, has: 0 }
  let accessibilityRequests = 0

  for (const inv of attendingInv) {
    const r = inv.response
    if (!r) continue
    if (r.hasTransportation === true) transportation.ownVehicle++
    else if (r.needsTransportation === 'yes') transportation.needTransport++
    else if (r.needsTransportation === 'not_sure') transportation.notSure++
    else if (r.needsTransportation === 'no') transportation.noAssistance++

    for (const f of r.foodPreferences) foodCounts.set(f, (foodCounts.get(f) ?? 0) + 1)

    if (r.hasFoodRestrictions) dietary.has++
    else if (r.hasFoodRestrictions === false) dietary.none++

    if (r.accessibilityNeeds && r.accessibilityNeeds.trim()) accessibilityRequests++
  }

  return {
    totalInvitations,
    activeInvitations: active.length,
    attending,
    declining,
    pending,
    pendingGuestRequests,
    approvedGuests,
    declinedGuests,
    invitedGuests: active.length + includedOnActive,
    includedGuests: includedOnActive,
    expectedAttendees: attending + guests.filter((g) => g.status === 'approved' && attendingIds.has(g.invitationId)).length,
    transportation,
    food: FOOD_OPTIONS.map((o) => ({ value: o.value, label: o.label, count: foodCounts.get(o.value) ?? 0 })),
    dietary,
    accessibilityRequests,
    responseRate: totalInvitations ? Math.round(((attending + declining) / totalInvitations) * 100) : 0,
  }
}
