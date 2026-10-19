import { useEffect, useState } from 'react'
import { getDisplayPrefs } from '../services/displayPrefsService'
import { monogramDataUrl } from '../services/monogramService'

export interface MonogramImage {
  /** Address of the file (for the website). */
  url: string
  /** The same file as a data: address once loaded (for printables), else the address. */
  src: string
  aspect: number
}

/**
 * The couple's own monogram when it's switched on (Look & Feel → Monogram),
 * else null — then the automatic initials (M & E) are used.
 */
export function useMonogram(): MonogramImage | null {
  const [m, setM] = useState<MonogramImage | null>(null)
  useEffect(() => {
    let alive = true
    getDisplayPrefs().then((p) => {
      if (!alive || !p.monogram) return
      const { url, aspect } = p.monogram
      setM({ url, src: url, aspect })
      monogramDataUrl(url)
        .then((src) => alive && setM({ url, src, aspect }))
        .catch(() => undefined)
    })
    return () => {
      alive = false
    }
  }, [])
  return m
}
