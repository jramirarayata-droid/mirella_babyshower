import type { WeddingSettings } from '../types/wedding'
import { listVisibleGallery, listVisibleSectionPhotos } from './galleryService'
import { listMediaSections } from './mediaSectionsService'
import { listGuestPhotos, type GuestPhoto } from './guestPhotosService'
import { parseVideoUrl } from '../utils/media'
import { supabase } from '../lib/supabase'
import { DEFAULT_SLUG, spaceSlug } from '../lib/space'

/** One thing on the big screen. */
export type Slide =
  | { id: string; kind: 'photo'; src: string; thumb: string; caption: string }
  | { id: string; kind: 'video'; src: string; poster: string; caption: string }
  | { id: string; kind: 'embed'; provider: 'youtube' | 'vimeo'; embedUrl: string; poster: string; caption: string }

/** "Rina Gaspar" → "Rina G." */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return parts[0] ?? ''
  return `${parts[0]} ${parts.at(-1)![0].toUpperCase()}.`
}

export const guestSlide = (p: GuestPhoto): Slide => ({ id: p.id, kind: 'photo', src: p.url, thumb: p.thumbUrl, caption: p.by ? `by ${shortName(p.by)}` : '' })

/** Every visible guest photo, newest first (up to 2,000). */
export async function allGuestPhotos(): Promise<GuestPhoto[]> {
  let all: GuestPhoto[] = []
  let before: string | null = null
  for (let page = 0; page < 20; page++) {
    const batch = await listGuestPhotos(before, 100)
    all = all.concat(batch)
    if (batch.length < 100) break
    before = batch.at(-1)!.at
  }
  return all
}

/**
 * Live signal from the database (migration 032): calls `onChange` the moment a
 * guest photo is shared, approved, hidden or deleted. The signal carries no
 * photo details; the caller fetches the list itself. `onReconnect` runs when
 * the live connection comes back after a drop, so nothing missed is lost.
 * Returns a function that stops listening.
 */
export function watchGuestPhotos(onChange: () => void, onReconnect: () => void): () => void {
  let joinedBefore = false
  const channel = supabase
    // Each shower has its own channel (the original keeps the old name) — see guest_photo_topic().
    .channel(spaceSlug && spaceSlug !== DEFAULT_SLUG ? `guest-photos:${spaceSlug}` : 'guest-photos')
    .on('broadcast', { event: 'changed' }, () => onChange())
    .subscribe((status) => {
      if (status !== 'SUBSCRIBED') return
      if (joinedBefore) onReconnect()
      joinedBefore = true
    })
  return () => {
    void supabase.removeChannel(channel)
  }
}

function videoSlide(id: string, url: string, poster: string, caption: string): Slide | null {
  const v = parseVideoUrl(url)
  if (v.kind === 'file') return { id, kind: 'video', src: v.src, poster, caption }
  if (v.kind === 'youtube') {
    const origin = typeof window !== 'undefined' ? `&origin=${encodeURIComponent(window.location.origin)}` : ''
    return {
      id,
      kind: 'embed',
      provider: 'youtube',
      embedUrl: `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0&modestbranding=1&playsinline=1&controls=0&iv_load_policy=3&enablejsapi=1${origin}`,
      poster: poster || v.thumbnail,
      caption,
    }
  }
  if (v.kind === 'vimeo') return { id, kind: 'embed', provider: 'vimeo', embedUrl: `${v.embedUrl}&title=0&byline=0&portrait=0&controls=0`, poster, caption }
  return null
}

/**
 * The couple's photos and films, in the same order as the home page: the main
 * gallery, the main film, then each extra section.
 */
export async function ourSlides(settings: WeddingSettings): Promise<Slide[]> {
  const slides: Slide[] = []
  const [gallery, sections] = await Promise.all([
    settings.galleryVisible ? listVisibleGallery().catch(() => []) : Promise.resolve([]),
    listMediaSections().catch(() => []),
  ])
  for (const g of gallery) slides.push({ id: `g-${g.id}`, kind: 'photo', src: g.imageUrl, thumb: g.imageUrl, caption: g.caption })
  if (settings.videoVisible && settings.videoUrl) {
    const v = videoSlide('film-main', settings.videoUrl, settings.videoPosterUrl, settings.videoTitle)
    if (v) slides.push(v)
  }
  const visible = sections.filter((s) => s.isVisible)
  const photos = await Promise.all(visible.map((s) => (s.kind === 'photos' ? listVisibleSectionPhotos(s.id).catch(() => []) : Promise.resolve([]))))
  visible.forEach((s, i) => {
    if (s.kind === 'video') {
      const v = videoSlide(`film-${s.id}`, s.videoUrl, s.posterUrl, s.title)
      if (v) slides.push(v)
    } else {
      for (const g of photos[i]) slides.push({ id: `s-${g.id}`, kind: 'photo', src: g.imageUrl, thumb: g.imageUrl, caption: g.caption })
    }
  })
  return slides
}
