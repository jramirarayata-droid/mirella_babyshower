import { adminTheme, googleFontsHref, resolveTheme, themeVars, type ResolvedTheme, type ThemeSettings } from './themes'

export const THEME_CACHE_KEY = 'wedding-theme-cache'
export const THEME_PREVIEW_KEY = 'wedding-theme-preview'

/** Writes the theme's CSS variables on <html> and loads its Google Fonts. */
export function applyTheme(settings: ThemeSettings | null | undefined, opts: { admin?: boolean } = {}): ResolvedTheme {
  const full = resolveTheme(settings)
  const t = opts.admin ? adminTheme(full) : full
  const root = document.documentElement
  for (const [k, v] of Object.entries(themeVars(t))) root.style.setProperty(k, v)
  root.dataset.template = t.templateId
  root.dataset.style = t.look
  root.dataset.dark = t.dark ? 'true' : 'false'
  root.style.colorScheme = t.dark ? 'dark' : 'light'

  const href = googleFontsHref(t.script ? [t.heading, t.body, t.script] : [t.heading, t.body])
  let link = document.getElementById('theme-fonts') as HTMLLinkElement | null
  if (!link) {
    link = document.createElement('link')
    link.id = 'theme-fonts'
    link.rel = 'stylesheet'
    document.head.appendChild(link)
  }
  if (link.href !== href) link.href = href

  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', t.palette.ivory)
  return t
}

/** Applies the last saved theme instantly on page load (before settings arrive), avoiding a colour flash. */
export function applyCachedTheme() {
  try {
    const raw = localStorage.getItem(THEME_CACHE_KEY)
    if (raw) applyTheme(JSON.parse(raw) as ThemeSettings, { admin: /^#\/admin/.test(window.location.hash) })
  } catch {
    /* storage unavailable — defaults from index.css apply */
  }
}

export function cacheTheme(settings: ThemeSettings) {
  try {
    localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(settings))
  } catch {
    /* ignore */
  }
}

/** True when this page is the admin's live-preview frame. */
export const isThemePreviewFrame = () => typeof window !== 'undefined' && /[?&]themePreview=1/.test(window.location.hash)

export function readPreviewTheme(): ThemeSettings | null {
  try {
    const raw = localStorage.getItem(THEME_PREVIEW_KEY)
    return raw ? (JSON.parse(raw) as ThemeSettings) : null
  } catch {
    return null
  }
}

export function writePreviewTheme(settings: ThemeSettings) {
  try {
    localStorage.setItem(THEME_PREVIEW_KEY, JSON.stringify(settings))
  } catch {
    /* ignore */
  }
}
