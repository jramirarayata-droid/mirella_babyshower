import { useEffect, useState } from 'react'
import { listVisibleOutfits } from '../services/outfitService'
import type { OutfitImage } from '../types/wedding'

/** Public outfit images. Failures are silent — the section simply doesn't show. */
export function useOutfits() {
  const [outfits, setOutfits] = useState<OutfitImage[]>([])
  useEffect(() => {
    let active = true
    listVisibleOutfits()
      .then((o) => active && setOutfits(o))
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])
  return outfits
}
