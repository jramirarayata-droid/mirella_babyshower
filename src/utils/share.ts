/** Public address of the website (works for GitHub Pages sub-paths and custom domains). */
export function siteBaseUrl(): string {
  return `${window.location.origin}${window.location.pathname}`
}

export function siteLinks() {
  const base = siteBaseUrl()
  return { home: base, rsvp: `${base}#/rsvp`, seat: `${base}#/seat` }
}

/** Opens the phone's share sheet when available, otherwise copies the link. Returns what happened. */
export async function shareOrCopy(url: string, title: string): Promise<'shared' | 'copied' | 'failed'> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, url })
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'shared'
    }
  }
  return (await copyText(url)) ? 'copied' : 'failed'
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function shareTargets(url: string, text: string) {
  const u = encodeURIComponent(url)
  const t = encodeURIComponent(`${text} ${url}`)
  return {
    messenger: `fb-messenger://share/?link=${u}`,
    viber: `viber://forward?text=${t}`,
    whatsapp: `https://wa.me/?text=${t}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
  }
}
