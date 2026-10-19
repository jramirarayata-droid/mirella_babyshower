import { useEffect, useState } from 'react'
import { listMediaSections, type MediaSection } from '../../services/mediaSectionsService'
import { listVisibleSectionPhotos } from '../../services/galleryService'
import type { GalleryImage } from '../../types/wedding'
import { CoupleGallery } from './CoupleGallery'
import { VideoHighlight } from './VideoHighlight'

export interface LoadedSection {
  s: MediaSection
  photos: GalleryImage[]
}

/** The couple's visible extra photo and video sections (Admin → Photos & Video), with their photos. */
export function useMediaSections(): LoadedSection[] {
  const [sections, setSections] = useState<LoadedSection[]>([])
  useEffect(() => {
    let alive = true
    listMediaSections()
      .then(async (list) => {
        const visible = list.filter((s) => s.isVisible)
        const withPhotos = await Promise.all(
          visible.map(async (s) => ({ s, photos: s.kind === 'photos' ? await listVisibleSectionPhotos(s.id).catch(() => []) : [] })),
        )
        if (alive) setSections(withPhotos)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])
  return sections
}

/** One extra section, as on the home page. */
export function MediaSectionView({ section: { s, photos } }: { section: LoadedSection }) {
  return s.kind === 'photos' ? (
    <CoupleGallery headingId={`section-${s.id}`} eyebrow="Moments" title={s.title} subtitle={s.subtitle} layout={s.layout} images={photos} />
  ) : (
    <VideoHighlight headingId={`section-${s.id}`} eyebrow="A Film" title={s.title} caption={s.subtitle} url={s.videoUrl} posterUrl={s.posterUrl} />
  )
}

/** All extra sections, in their own order (used where the home page's saved order doesn't apply). */
export function MediaSections() {
  const sections = useMediaSections()
  return (
    <>
      {sections.map((x) => (
        <MediaSectionView key={x.s.id} section={x} />
      ))}
    </>
  )
}
