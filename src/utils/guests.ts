import type { AdditionalGuest, InvitationWithRSVP } from '../types/rsvp'

/** Guests the couple added to the invitation (auto-approved). */
export const includedGuests = (inv: Pick<InvitationWithRSVP, 'guests'>): AdditionalGuest[] =>
  inv.guests.filter((g) => g.addedBy === 'admin')

/** Guests the invitee asked to bring on the RSVP form (need approval). */
export const requestedGuests = (inv: Pick<InvitationWithRSVP, 'guests'>): AdditionalGuest[] =>
  inv.guests.filter((g) => g.addedBy === 'invitee')

export const includedGuestNames = (inv: Pick<InvitationWithRSVP, 'guests'>): string[] => includedGuests(inv).map((g) => g.guestName)

export const guestSourceLabel = (addedBy: AdditionalGuest['addedBy']): string =>
  addedBy === 'admin' ? 'Included by couple' : 'Guest request'
