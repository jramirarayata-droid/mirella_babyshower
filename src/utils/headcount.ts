import type { GuestSide, InvitationWithRSVP } from '../types/rsvp'
import { includedGuests, requestedGuests } from './guests'

export type SideFilter = 'all' | GuestSide

export const SIDE_LABEL: Record<GuestSide, string> = { groom: 'Groom’s side', bride: 'Bride’s side' }

export const bySide = <T extends { side: GuestSide }>(list: T[], side: SideFilter): T[] => (side === 'all' ? list : list.filter((i) => i.side === side))

export interface Headcount {
  /** Active invitations (one invitee each). */
  invitations: number
  /** People the couple included on those invitations. */
  included: number
  /** Extra guests the invitee asked for and the couple approved. */
  approvedExtras: number
  /** Everyone above, minus parties that said they can't come. */
  expected: number
  /** People in parties that declined (not in `expected`). */
  declinedPeople: number
  /** Extra guests still allowed but not (yet) approved, on parties that haven't declined. */
  possibleMore: number
  /** RSVPs the couple recorded on a guest's behalf. */
  recordedByCouple: number
}

/** Expected headcount for a list of invitations (inactive ones are ignored). */
export function headcount(list: InvitationWithRSVP[]): Headcount {
  const h: Headcount = { invitations: 0, included: 0, approvedExtras: 0, expected: 0, declinedPeople: 0, possibleMore: 0, recordedByCouple: 0 }
  for (const inv of list) {
    if (!inv.isActive) continue
    const included = includedGuests(inv).filter((g) => g.status !== 'declined').length
    const approved = requestedGuests(inv).filter((g) => g.status === 'approved').length
    const party = 1 + included + approved
    h.invitations += 1
    h.included += included
    h.approvedExtras += approved
    if (inv.response?.recordedByAdmin) h.recordedByCouple += 1
    if (inv.response?.attendanceStatus === 'declining') {
      h.declinedPeople += party
      continue
    }
    h.expected += party
    h.possibleMore += Math.max(0, inv.maxAdditionalGuests - approved)
  }
  return h
}
