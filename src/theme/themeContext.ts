import { createContext, useContext } from 'react'
import { resolveTheme, type ResolvedTheme } from './themes'

export const ThemeContext = createContext<ResolvedTheme>(resolveTheme(null))

/** The theme currently applied (saved theme, or the admin's unsaved preview inside the preview frame). */
export const useResolvedTheme = () => useContext(ThemeContext)
