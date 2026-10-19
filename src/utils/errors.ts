export const FRIENDLY_ERRORS = {
  notFound: "We couldn't find an invitation with that name. Please check the spelling and try again.",
  generic: 'Something went wrong while processing your request. Please try again in a moment.',
  invalid: 'Some of your answers need another look. Please review the form and try again.',
  unavailable: 'This invitation is no longer available. Please contact the couple for help.',
} as const

/** Error whose message is always safe to show to a user. */
export class FriendlyError extends Error {
  constructor(message: string = FRIENDLY_ERRORS.generic) {
    super(message)
    this.name = 'FriendlyError'
  }
}

/** Thrown when the RSVP deadline has passed or the couple closed RSVPs. */
export class RsvpClosedError extends FriendlyError {
  constructor() {
    super('RSVPs are now closed.')
    this.name = 'RsvpClosedError'
  }
}

/** Returns a message that is safe to display. Raw database errors are never shown. */
export function toFriendlyMessage(error: unknown, fallback: string = FRIENDLY_ERRORS.generic): string {
  if (error instanceof FriendlyError) return error.message
  return fallback
}

/** Logs the technical error for developers (browser console) without showing it in the UI. */
export function logError(context: string, error: unknown): void {
  if (import.meta.env.DEV) {
    console.error(`[${context}]`, error)
  }
}
