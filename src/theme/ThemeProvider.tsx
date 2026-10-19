import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useWeddingSettings } from '../hooks/useWeddingSettings'
import { ThemeContext } from './themeContext'
import { applyTheme, cacheTheme, isThemePreviewFrame, readPreviewTheme, THEME_PREVIEW_KEY } from './applyTheme'
import { adminTheme, resolveTheme, type ThemeSettings } from './themes'

/**
 * Applies the couple's Look & Feel to the whole site. Inside the admin's
 * preview frame it follows the unsaved choices instead (shared via
 * localStorage, updated live through the "storage" event).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { settings } = useWeddingSettings()
  const [previewFrame] = useState(isThemePreviewFrame)
  const [preview, setPreview] = useState<ThemeSettings | null>(() => (previewFrame ? readPreviewTheme() : null))

  useEffect(() => {
    if (!previewFrame) return
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_PREVIEW_KEY) setPreview(readPreviewTheme())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [previewFrame])

  const { pathname } = useLocation()
  const admin = !previewFrame && pathname.startsWith('/admin')
  const effective = previewFrame && preview ? preview : settings?.theme
  const resolved = useMemo(() => (admin ? adminTheme(resolveTheme(effective)) : resolveTheme(effective)), [effective, admin])

  useEffect(() => {
    if (!effective) return
    applyTheme(effective, { admin })
    if (!previewFrame) cacheTheme(effective)
  }, [effective, previewFrame, admin])

  return <ThemeContext.Provider value={resolved}>{children}</ThemeContext.Provider>
}
