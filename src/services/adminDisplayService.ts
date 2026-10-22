import { getAdminPreference, saveAdminPreference } from './preferencesService'
import { getDisplayPrefs } from './displayPrefsService'

/** Admin: what the virtual invitation shows (Admin → Invitations → Virtual invitation settings). */
export interface VirtualInviteSettings {
  /** 'printables' = the same "Good to know" picks as the printed card; 'custom' = its own picks. */
  backMode: 'printables' | 'custom'
  backIds: string[]
  boldIds: string[]
  /** Kept private until a guest confirms they're attending. */
  hideVenues: boolean
  hideInfo: boolean
  hideLinks: boolean
}

/** Admin: details the public website keeps for confirmed guests (Website Settings → Privacy). */
export interface WebsitePrivacy {
  hideVenues: boolean
  hideInfo: boolean
  /** Gift wishlist only for guests who RSVP'd "attending" (enforced by the database). */
  hideWishlist: boolean
  /** What to Wear only for guests who RSVP'd "attending" (enforced by the database). */
  hideAttire: boolean
  /** Gift ideas only for guests who RSVP'd "attending" (enforced by the database; until set, follows the wishlist). */
  hideIdeas: boolean
}

export const DEFAULT_VIRTUAL_INVITE: VirtualInviteSettings = { backMode: 'printables', backIds: [], boldIds: [], hideVenues: false, hideInfo: false, hideLinks: false }
export const DEFAULT_WEBSITE_PRIVACY: WebsitePrivacy = { hideVenues: false, hideInfo: false, hideWishlist: false, hideAttire: false, hideIdeas: false }

const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

export async function getVirtualInviteSettings(): Promise<VirtualInviteSettings> {
  const v = (await getAdminPreference<Record<string, unknown>>('virtual_invite')) ?? {}
  return {
    backMode: v.backMode === 'custom' ? 'custom' : 'printables',
    backIds: strings(v.backIds),
    boldIds: strings(v.boldIds),
    hideVenues: v.hideVenues === true,
    hideInfo: v.hideInfo === true,
    hideLinks: v.hideLinks === true,
  }
}

export async function saveVirtualInviteSettings(s: VirtualInviteSettings): Promise<void> {
  await saveAdminPreference('virtual_invite', s)
  void getDisplayPrefs(true)
}

export async function getWebsitePrivacy(): Promise<WebsitePrivacy> {
  const v = (await getAdminPreference<Record<string, unknown>>('website_privacy')) ?? {}
  return {
    hideVenues: v.hideVenues === true,
    hideInfo: v.hideInfo === true,
    hideWishlist: v.hideWishlist === true,
    hideAttire: v.hideAttire === true,
    hideIdeas: typeof v.hideIdeas === 'boolean' ? v.hideIdeas : v.hideWishlist === true,
  }
}

export async function saveWebsitePrivacy(s: WebsitePrivacy): Promise<void> {
  await saveAdminPreference('website_privacy', s)
  void getDisplayPrefs(true)
}

/** The "Good to know" ids ticked in Printables (null = the first three). */
export async function getPrintablesBackIds(): Promise<string[] | null> {
  const v = await getAdminPreference<Record<string, unknown>>('printables')
  return v && Array.isArray(v.backIds) ? strings(v.backIds) : null
}
