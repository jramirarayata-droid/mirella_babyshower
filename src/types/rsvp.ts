import type { CustomAnswers } from './questions'

export type PositionMode = 'auto' | 'custom' | 'none'
/** Whose guest list an invitation belongs to. */
export type GuestSide = 'groom' | 'bride'

export type AttendanceStatus = 'attending' | 'declining'
export type RSVPStatus = AttendanceStatus | 'pending'
export type NeedsTransportation = 'yes' | 'no' | 'not_sure'
export type VehicleType = 'sedan' | 'suv' | 'van' | 'motorcycle' | 'other'
export type FoodOption = 'vegetable' | 'pasta' | 'fish' | 'pork' | 'beef' | 'chicken'
export type GuestStatus = 'pending' | 'approved' | 'declined'
export type YesNo = 'yes' | 'no'
/** admin = included in the invitation by the couple; invitee = requested on the RSVP form. */
export type GuestSource = 'admin' | 'invitee'

/** The only invitation information the public RSVP page ever receives. */
export interface InvitationLookup {
  invitationId: string
  inviteeName: string
  tableNumber: string | null
  maxAdditionalGuests: number
  hasExistingResponse: boolean
  /** Guests the couple included in this invitation (already confirmed). */
  includedGuests: string[]
  /** Open link: someone signing up now (no invitation yet — created when they send their reply). */
  isNew?: boolean
}

/** Client-side form state (strings/unions, before conversion for the RPC). */
export interface RSVPFormState {
  attendance: AttendanceStatus | null
  hasTransportation: YesNo | null
  needsTransportation: NeedsTransportation | null
  vehicleType: VehicleType | null
  comingFrom: string
  foodPreferences: FoodOption[]
  hasFoodRestrictions: YesNo | null
  foodRestrictions: string
  accessibilityNeeds: string
  bringingGuest: YesNo | null
  guestNames: string[]
  messageToCouple: string
  mobileNumber: string
  customAnswers: CustomAnswers
}

/** Clean payload that is sent to the submit_rsvp RPC. */
export interface RSVPSubmission {
  invitationId: string
  attendanceStatus: AttendanceStatus
  hasTransportation: boolean | null
  needsTransportation: NeedsTransportation | null
  vehicleType: VehicleType | null
  comingFrom: string | null
  foodPreferences: FoodOption[]
  hasFoodRestrictions: boolean | null
  foodRestrictions: string | null
  accessibilityNeeds: string | null
  additionalGuests: string[]
  messageToCouple: string | null
  /** Normalised +639XXXXXXXXX. */
  mobileNumber: string
  customAnswers: Record<string, string | string[] | number>
}

// ----- Admin-side shapes ------------------------------------------------------

export interface Invitation {
  id: string
  inviteeName: string
  invitationCode: string
  /** Display name of the party's table (from the seating plan). */
  tableNumber: string | null
  tableId: string | null
  printedAt: string | null
  /** Position on the printed invitation: from the entourage, typed in, or none. */
  positionMode: PositionMode
  positionLabel: string
  /** How the card and online invitation address them, e.g. "Mr. & Mrs. Juan dela Cruz" ('' = the usual name + "together with"). */
  addressedAs: string
  side: GuestSide
  maxAdditionalGuests: number
  isActive: boolean
  /** Added by the customer ('list') or signed up through the open RSVP link ('link'). */
  source?: 'list' | 'link'
  createdAt: string
  updatedAt: string
}

export interface InvitationInput {
  inviteeName: string
  tableId: string | null
  positionMode: PositionMode
  positionLabel: string
  /** null only while adding a new invitation, before a side is picked. */
  side: GuestSide | null
  maxAdditionalGuests: number
  isActive: boolean
}

export interface RSVPResponse {
  id: string
  invitationId: string
  attendanceStatus: AttendanceStatus
  hasTransportation: boolean | null
  needsTransportation: NeedsTransportation | null
  vehicleType: VehicleType | null
  comingFrom: string | null
  foodPreferences: FoodOption[]
  hasFoodRestrictions: boolean | null
  foodRestrictions: string | null
  accessibilityNeeds: string | null
  bringingAdditionalGuest: boolean
  messageToCouple: string | null
  mobileNumber: string | null
  /** Recorded by the couple on the guest's behalf. */
  recordedByAdmin: boolean
  customAnswers: Record<string, unknown>
  submittedAt: string
  updatedAt: string
}

export interface AdditionalGuest {
  id: string
  invitationId: string
  rsvpResponseId: string | null
  guestName: string
  status: GuestStatus
  addedBy: GuestSource
  createdAt: string
  updatedAt: string
  /** Set when this guest used to have their own invitation and was included in this one. */
  mergedFrom?: MergedFrom | null
}

/** What a guest's own invitation was before it was included in another one. */
export interface MergedFrom {
  inviteeName: string
  invitationCode: string
  positionLabel: string
  answer: 'attending' | 'declining' | null
  combinedAt: string
}

/** An invitation joined with its (optional) current response and guests. */
export interface InvitationWithRSVP extends Invitation {
  response: RSVPResponse | null
  guests: AdditionalGuest[]
  status: RSVPStatus
}

export interface GuestWithInvitation extends AdditionalGuest {
  invitedBy: string
  tableNumber: string | null
}

export interface ActivityLog {
  id: string
  action: string
  targetTable: string | null
  targetId: string | null
  details: Record<string, unknown>
  createdAt: string
}

/** Someone who is part of another person's invitation (included guest or approved request). */
export interface IncludedGuestLookup {
  /** The name the guest searched with (used to pre-fill Find My Seat). */
  searchedName: string
  inviteeName: string
  attendanceStatus: AttendanceStatus | null
}
