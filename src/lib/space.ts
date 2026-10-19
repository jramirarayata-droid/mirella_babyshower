/*
 * Which baby shower ("space") this page belongs to.
 *
 * Every shower has its own web address: https://<site>/<slug>/#/…
 * The slug is the first part of the path. With no slug (the site's root) the
 * page is the login / plans page, and old links like /#/rsvp keep opening the
 * original (default) shower.
 *
 * The slug is sent to Supabase in an "x-space" header on every request
 * (see lib/supabase.ts); the database keeps each space's data apart.
 */

/** The web address of the original shower (space #1). */
export const DEFAULT_SLUG = 'mirella'

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/

function readSlug(): string | null {
  if (typeof window === 'undefined') return null
  const first = window.location.pathname.split('/').filter(Boolean)[0]?.toLowerCase() ?? ''
  return SLUG_RE.test(first) ? first : null
}

/** The shower's web address on this page, or null at the site's root. */
export const spaceSlug: string | null = readSlug()

/** Link to a shower's page: spaceUrl('baby-cruz', '/admin') → https://site/baby-cruz/#/admin */
export function spaceUrl(slug: string | null, hashPath = '/'): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  return `${origin}/${slug ? `${slug}/` : ''}#${hashPath}`
}

/** Header sent with every Supabase request. */
export function spaceHeaders(): Record<string, string> {
  return spaceSlug ? { 'x-space': spaceSlug } : {}
}

/*
 * Things a browser remembers (a guest's pass, the cached look, raffle state…)
 * are kept per shower, so two showers opened on the same phone never mix.
 * Supabase's own sign-in keys ("sb-…") stay shared: one login for every page.
 */
function scopeStorage(store: Storage | undefined, prefix: string) {
  if (!store) return
  const proto = Object.getPrototypeOf(store) as Storage
  const keep = (k: string) => k.startsWith('sb-') || k === 'sw-test'
  const scoped = (k: string) => (keep(k) ? k : `${prefix}${k}`)
  const get = proto.getItem
  const set = proto.setItem
  const remove = proto.removeItem
  proto.getItem = function (this: Storage, k: string) {
    return get.call(this, scoped(String(k)))
  }
  proto.setItem = function (this: Storage, k: string, v: string) {
    set.call(this, scoped(String(k)), v)
  }
  proto.removeItem = function (this: Storage, k: string) {
    remove.call(this, scoped(String(k)))
  }
}

if (spaceSlug && typeof window !== 'undefined') {
  try {
    scopeStorage(window.localStorage, `space:${spaceSlug}:`)
  } catch {
    /* storage blocked: nothing to scope */
  }
}

/*
 * Uploaded files (photos, music, QR codes…) go in the shower's own folder:
 * "<space id>/…". The original shower keeps using the top level.
 * Set once the space is known (hooks/useSpace.tsx).
 */
let folder = ''
export function setSpaceFolder(spaceId: string | null, isDefault: boolean) {
  folder = spaceId && !isDefault ? `${spaceId}/` : ''
}
export const spaceFolder = () => folder
