import type { GuestSide, InvitationWithRSVP } from '../types/rsvp'

export interface SeatPerson {
  key: string
  invitationId: string
  guestId: string | null
  name: string
  /** The invitee's name, for "party of …" grouping. */
  partyName: string
  isInvitee: boolean
  /** Groom's or bride's side (from the invitation). */
  side: GuestSide
  /** Hasn't RSVP'd yet (only listed when seats can be pre-assigned). */
  pending?: boolean
}

/** Everyone who can be seated on an invitation (invitee + included + approved requests). */
export function partyMembers(inv: InvitationWithRSVP): SeatPerson[] {
  return [
    { key: `${inv.id}:`, invitationId: inv.id, guestId: null, name: inv.inviteeName, partyName: inv.inviteeName, isInvitee: true, side: inv.side },
    ...inv.guests
      .filter((g) => g.addedBy === 'admin' || g.status === 'approved')
      .map((g) => ({ key: `${inv.id}:${g.id}`, invitationId: inv.id, guestId: g.id, name: g.guestName, partyName: inv.inviteeName, isInvitee: false, side: inv.side })),
  ]
}

/** People confirmed to attend: parties whose RSVP is "attending". */
export function attendingPeople(invitations: InvitationWithRSVP[]): SeatPerson[] {
  return invitations.filter((i) => i.isActive && i.status === 'attending').flatMap(partyMembers)
}

/**
 * People who can be given a chair: those attending — and, when seats can be
 * pre-assigned, those who haven't answered yet too (never those who declined).
 */
export function seatablePeople(invitations: InvitationWithRSVP[], preassign: boolean): SeatPerson[] {
  if (!preassign) return attendingPeople(invitations)
  return invitations
    .filter((i) => i.isActive && (i.status === 'attending' || i.status === 'pending'))
    .flatMap((inv) => partyMembers(inv).map((p) => (inv.status === 'pending' ? { ...p, pending: true } : p)))
}

/** People planned per table (for "seats left"): declined parties don't count. */
export function plannedPerTable(invitations: InvitationWithRSVP[], excludeInvitationId?: string): Map<string, number> {
  const m = new Map<string, number>()
  for (const inv of invitations) {
    if (!inv.tableId || inv.id === excludeInvitationId || inv.status === 'declining' || !inv.isActive) continue
    m.set(inv.tableId, (m.get(inv.tableId) ?? 0) + partyMembers(inv).length)
  }
  return m
}
