import { supabase } from '../lib/supabase'
import { logError } from '../utils/errors'

/** What guests and the website may show — set by the couple in the admin. */
export interface DisplayPrefs {
  card: {
    /** "Good to know" sections on the on-screen card back (null = the first three). */
    backIds: string[] | null
    boldIds: string[]
    /** Until a guest confirms they're attending: */
    hideVenues: boolean
    hideInfo: boolean
    hideLinks: boolean
  }
  website: { hideVenues: boolean; hideInfo: boolean }
  sharePreviewUrl: string | null
  raffleVisible: boolean
  /** The couple's reveal date (Schedule), if set. */
  revealAt: string | null
  /** The couple's own monogram (Look & Feel → Monogram), when switched on. */
  monogram: { url: string; aspect: number } | null
}

export const DEFAULT_DISPLAY_PREFS: DisplayPrefs = {
  card: { backIds: null, boldIds: [], hideVenues: false, hideInfo: false, hideLinks: false },
  website: { hideVenues: false, hideInfo: false },
  sharePreviewUrl: null,
  raffleVisible: false,
  revealAt: null,
  monogram: null,
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : null)
const bool = (v: unknown) => v === true

function parse(data: unknown): DisplayPrefs {
  const o = obj(data)
  const card = obj(o.card)
  const web = obj(o.website)
  return {
    card: {
      backIds: list(card.backIds),
      boldIds: list(card.boldIds) ?? [],
      hideVenues: bool(card.hideVenues),
      hideInfo: bool(card.hideInfo),
      hideLinks: bool(card.hideLinks),
    },
    website: { hideVenues: bool(web.hideVenues), hideInfo: bool(web.hideInfo) },
    sharePreviewUrl: typeof o.sharePreviewUrl === 'string' && o.sharePreviewUrl ? o.sharePreviewUrl : null,
    raffleVisible: bool(o.raffleVisible),
    revealAt: typeof o.revealAt === 'string' && o.revealAt ? o.revealAt : null,
    monogram: (() => {
      const m = obj(o.monogram)
      return typeof m.url === 'string' && m.url ? { url: m.url, aspect: Number(m.aspect) > 0 ? Number(m.aspect) : 1 } : null
    })(),
  }
}

let cache: Promise<DisplayPrefs> | null = null

/** Public: the couple's display choices (cached for the visit; `fresh` reloads). */
export function getDisplayPrefs(fresh = false): Promise<DisplayPrefs> {
  if (!cache || fresh) {
    cache = Promise.resolve(supabase.rpc('public_display_prefs')).then(({ data, error }) => {
      if (error) {
        logError('getDisplayPrefs', error)
        cache = null
        return DEFAULT_DISPLAY_PREFS
      }
      return parse(data)
    })
  }
  return cache
}
