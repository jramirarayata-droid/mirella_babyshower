import type { RSVPFormState } from '../../types/rsvp'

export const EMPTY_RSVP: RSVPFormState = {
  attendance: null,
  hasTransportation: null,
  needsTransportation: null,
  vehicleType: null,
  comingFrom: '',
  foodPreferences: [],
  hasFoodRestrictions: null,
  foodRestrictions: '',
  accessibilityNeeds: '',
  bringingGuest: null,
  guestNames: [],
  messageToCouple: '',
  mobileNumber: '',
  customAnswers: {},
}
