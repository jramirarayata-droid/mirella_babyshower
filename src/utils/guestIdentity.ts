/*
 * Remembers which guest is using this phone once they've found themselves
 * (RSVP search, their personal invitation link, or the photos page), so the
 * site can greet them and skip asking for their name again.
 */
const KEY = 'wedding-guest'

export interface KnownGuest {
  /** Full name as on the invitation (or the included guest's name). */
  name: string
  invitationId?: string
}

export function knownGuest(): KnownGuest | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as KnownGuest | null
    return v && typeof v.name === 'string' && v.name.trim() ? v : null
  } catch {
    return null
  }
}

const same = (a: string, b: string) => a.trim().replace(/\s+/g, ' ').toLowerCase() === b.trim().replace(/\s+/g, ' ').toLowerCase()

/**
 * The guest on this phone is now `g`. When it's a different person than
 * before (e.g. they RSVP'd for someone else), everything tied to the old name
 * — the photo-sharing session — is let go, so photos, Find My Seat and the
 * menu all follow the new name.
 */
export function rememberGuest(g: KnownGuest) {
  try {
    const before = knownGuest()
    const photo = JSON.parse(localStorage.getItem('wedding-photo-guest') ?? 'null') as { name?: unknown } | null
    if ((before && !same(before.name, g.name)) || (photo && typeof photo.name === 'string' && !same(photo.name, g.name))) {
      localStorage.removeItem('wedding-photo-guest')
    }
    localStorage.setItem(KEY, JSON.stringify({ name: g.name.trim(), invitationId: g.invitationId ?? (before && same(before.name, g.name) ? before.invitationId : undefined) }))
    window.dispatchEvent(new Event('wedding-guest'))
  } catch {
    /* private mode: just this visit */
  }
}

export function forgetKnownGuest() {
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem('wedding-photo-guest')
    window.dispatchEvent(new Event('wedding-guest'))
  } catch {
    /* ignore */
  }
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? ''
