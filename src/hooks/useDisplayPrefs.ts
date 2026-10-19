import { useEffect, useState } from 'react'
import { getDisplayPrefs, type DisplayPrefs } from '../services/displayPrefsService'

/** The couple's display choices (privacy, raffle page) — null while loading. */
export function useDisplayPrefs(): DisplayPrefs | null {
  const [prefs, setPrefs] = useState<DisplayPrefs | null>(null)
  useEffect(() => {
    let alive = true
    getDisplayPrefs().then((p) => alive && setPrefs(p))
    return () => {
      alive = false
    }
  }, [])
  return prefs
}
