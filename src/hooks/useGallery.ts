import { useEffect, useState } from 'react'
import { listVisibleGallery } from '../services/galleryService'
import type { GalleryImage } from '../types/wedding'

/** Public gallery photos. Failures are silent — the section simply doesn't show. */
export function useGallery() {
  const [images, setImages] = useState<GalleryImage[]>([])
  useEffect(() => {
    let active = true
    listVisibleGallery()
      .then((g) => active && setImages(g))
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])
  return images
}
