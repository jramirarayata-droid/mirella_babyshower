/*
 * The order of the sections on a shower's home page (Admin → Page Order).
 * The front page (hero) is always first and the footer always last; everything
 * between can be moved. Photo sections are separate entries ("media:<key>") so
 * each one can go anywhere. A saved order of [] means the usual order.
 */

export type FixedSectionKey = 'intro' | 'verse' | 'reveal' | 'guestPhotos' | 'venue' | 'program' | 'info' | 'attire' | 'ideas' | 'fun' | 'gift' | 'rsvp'
export type SectionKey = FixedSectionKey | `media:${string}`

/** Plain names for the admin (photo sections use their own titles). */
export const SECTION_NAMES: Record<FixedSectionKey, string> = {
  intro: 'Introduction',
  verse: 'Bible verse',
  reveal: 'Gender reveal',
  guestPhotos: 'Guest photos',
  venue: 'Venue & time',
  program: 'Program',
  info: 'Good to know',
  attire: 'What to Wear',
  ideas: 'Gift ideas',
  fun: 'Gifts, Guesses & Names',
  gift: 'Gift card',
  rsvp: 'RSVP',
}

/** The usual order. mediaKeys are the photo sections in Admin → Photos & Video order (e.g. "media:gallery"). */
export function defaultSectionKeys(mediaKeys: string[]): SectionKey[] {
  return ['intro', 'verse', 'reveal', ...(mediaKeys as SectionKey[]), 'guestPhotos', 'venue', 'program', 'info', 'attire', 'ideas', 'fun', 'gift', 'rsvp']
}

/**
 * The saved order, kept up to date with what exists now: sections that no
 * longer exist are dropped, and sections added since (e.g. a new photo
 * section) go right after the section they follow in the usual order.
 */
export function orderSections(defaults: SectionKey[], saved: string[] | null | undefined): SectionKey[] {
  const known = new Set<string>(defaults)
  const out: SectionKey[] = []
  for (const k of saved ?? []) if (known.has(k) && !out.includes(k as SectionKey)) out.push(k as SectionKey)
  if (out.length === 0) return [...defaults]
  defaults.forEach((k, i) => {
    if (out.includes(k)) return
    // After the nearest earlier section (in the usual order) that is already placed.
    let at = 0
    for (let j = i - 1; j >= 0; j--) {
      const p = out.indexOf(defaults[j]!)
      if (p >= 0) {
        at = p + 1
        break
      }
    }
    out.splice(at, 0, k)
  })
  return out
}

/** "media:gallery" → "gallery" (null for other sections). */
export const mediaKeyOf = (k: string): string | null => (k.startsWith('media:') ? k.slice(6) : null)

/**
 * The home page's final order: the saved page order, with the photo sections'
 * places filled in the order set in Photos & Video (so moving one there still
 * takes effect, within the places photo sections have on the page).
 */
export function homeOrder(mediaKeysInMediaOrder: string[], saved: string[] | null | undefined): SectionKey[] {
  const defaults = defaultSectionKeys(mediaKeysInMediaOrder.map((k) => `media:${k}`))
  const order = orderSections(defaults, saved)
  const queue = mediaKeysInMediaOrder.map((k) => `media:${k}` as SectionKey)
  return order.map((k) => (k.startsWith('media:') ? (queue.shift() ?? k) : k))
}
