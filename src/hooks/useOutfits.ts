import { useEffect, useState } from 'react'
import { listAttire } from '../services/outfitService'
import { currentShowerGuest } from '../services/showerService'
import type { OutfitImage } from '../types/wedding'

export interface AttireState {
  images: OutfitImage[]
  /** The hosts keep What to Wear for attending guests. */
  private: boolean
  /** This visitor may see it (public, or an attending guest). */
  allowed: boolean
  loaded: boolean
}

/** What to Wear for this visitor. Failures are silent — the section simply doesn't show. */
export function useOutfits(): AttireState {
  const [state, setState] = useState<AttireState>({ images: [], private: false, allowed: false, loaded: false })
  useEffect(() => {
    let active = true
    listAttire(currentShowerGuest()?.token)
      .then((r) => active && setState({ images: r.images, private: r.private, allowed: r.allowed, loaded: true }))
      .catch(() => active && setState((s) => ({ ...s, loaded: true })))
    return () => {
      active = false
    }
  }, [])
  return state
}
