/*
 * Plan features. The database (public.plans) decides which plan has which
 * feature; this file only gives each feature a friendly name and says which
 * admin pages and guest pages belong to it.
 */

export type Feature =
  | 'looks_all'
  | 'predictions'
  | 'names'
  | 'reveal'
  | 'guest_photos'
  | 'gallery'
  | 'printables'
  | 'raffle'
  | 'big_screen'
  | 'slideshow'
  | 'music'
  | 'seating'
  | 'cohost'

export const FEATURE_LABELS: Record<Feature, string> = {
  looks_all: 'All website looks',
  predictions: 'Baby Predictions',
  names: 'Name Ideas',
  reveal: 'Gender Reveal',
  guest_photos: 'Guest photo sharing',
  gallery: 'Photos & video gallery',
  printables: 'Printables',
  raffle: 'Diaper raffle & bingo',
  big_screen: 'Big-screen views',
  slideshow: 'Live photo slideshow',
  music: 'Background music',
  seating: 'Seating & Find My Seat',
  cohost: 'Co-host login',
}

/** Included in every plan. */
export const CORE_FEATURES = [
  'Website with countdown & venue',
  'Online RSVP with plus-ones',
  'Virtual invitation',
  'Gift wishlist',
  'Program & What to Wear',
]

/** Admin pages that need a feature (others are in every plan). */
export const ADMIN_PAGE_FEATURE: Record<string, Feature> = {
  '/admin/printables': 'printables',
  '/admin/seating': 'seating',
  '/admin/reveal': 'reveal',
  '/admin/predictions': 'predictions',
  '/admin/names': 'names',
  '/admin/raffle': 'raffle',
  '/admin/media': 'gallery',
  '/admin/guest-photos': 'guest_photos',
  '/admin/music': 'music',
}

/** Guest pages that need a feature. */
export const GUEST_PAGE_FEATURE: Record<string, Feature> = {
  '/predict': 'predictions',
  '/names': 'names',
  '/raffle': 'raffle',
  '/photos': 'guest_photos',
  '/seat': 'seating',
  '/present': 'slideshow',
  '/show': 'big_screen',
}

export function pageFeature(path: string, table: Record<string, Feature>): Feature | null {
  for (const [prefix, f] of Object.entries(table)) if (path === prefix || path.startsWith(`${prefix}/`)) return f
  return null
}

export interface Plan {
  id: string
  name: string
  tagline: string
  pricePhp: number
  guestLimit: number | null
  features: Feature[]
  highlight: boolean
}

export const peso = (n: number) => `₱${n.toLocaleString('en-PH')}`
