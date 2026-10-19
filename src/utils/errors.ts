export const FRIENDLY_ERRORS = {
  notFound: "We couldn't find an invitation with that name. Please check the spelling and try again.",
  generic: 'Something went wrong while processing your request. Please try again in a moment.',
  invalid: 'Some of your answers need another look. Please review the form and try again.',
  unavailable: 'This invitation is no longer available. Please contact the parents-to-be for help.',
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

/**
 * The database refuses things the shower's plan doesn't include (more guests
 * than the plan allows, a look or feature from a bigger plan). Its message is
 * written for people, so it is shown as is.
 */
export function planLimitError(error: { hint?: string; message?: string } | null | undefined): void {
  if (error?.hint && error.hint.startsWith('plan_') && error.message) throw new FriendlyError(error.message)
  if (error?.message && /row-level security policy "Plan includes it/.test(error.message)) {
    throw new FriendlyError('This is part of a bigger plan. Message us to upgrade.')
  }
}
