import { supabase, WEDDING_ASSETS_BUCKET } from '../lib/supabase'
import type { Tables } from '../types/database'
import type { GalleryImage } from '../types/wedding'
import { FRIENDLY_ERRORS, FriendlyError, logError } from '../utils/errors'
import { compressImage } from '../utils/media'
import { spaceFolder } from '../lib/space'

export const GALLERY_LIMIT = 30
export const VIDEO_MAX_MB = 30

const fromRow = (r: Tables<'gallery_images'>): GalleryImage => ({
  id: r.id,
  imageUrl: r.image_url,
  thumbUrl: (r as { thumb_url?: string | null }).thumb_url ?? null,
  caption: r.caption ?? '',
  sortOrder: r.sort_order,
  isVisible: r.is_visible,
})

/** Photos of the main gallery (sectionId null) or of one extra section. */
async function list(context: string, sectionId: string | null = null): Promise<GalleryImage[]> {
  const base = supabase.from('gallery_images').select('*')
  const { data, error } = await (sectionId ? base.eq('section_id', sectionId) : base.is('section_id', null))
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) {
    logError(context, error)
    throw new FriendlyError(FRIENDLY_ERRORS.generic)
  }
  return ((data ?? []) as Tables<'gallery_images'>[]).map(fromRow)
}

export async function listVisibleGallery(): Promise<GalleryImage[]> {
  return (await list('listVisibleGallery')).filter((g) => g.isVisible)
}

export const listAllGallery = (sectionId: string | null = null) => list('listAllGallery', sectionId)

/** Every couple photo — main gallery and extra photo sections — with its section (admin: Save to Google Drive). */
export async function listEveryGalleryImage(): Promise<(GalleryImage & { sectionId: string | null })[]> {
  const { data, error } = await supabase.from('gallery_images').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true })
  if (error) {
    logError('listEveryGalleryImage', error)
    throw new FriendlyError(FRIENDLY_ERRORS.generic)
  }
  return ((data ?? []) as Tables<'gallery_images'>[]).map((r) => ({ ...fromRow(r), sectionId: (r as { section_id?: string | null }).section_id ?? null }))
}

/** Public: visible photos of one extra section. */
export async function listVisibleSectionPhotos(sectionId: string): Promise<GalleryImage[]> {
  return (await list('listVisibleSectionPhotos', sectionId)).filter((g) => g.isVisible)
}

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`

async function uploadToBucket(folder: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
  const path = `${spaceFolder()}${folder}/${newId()}.${ext}`
  const { error } = await supabase.storage
    .from(WEDDING_ASSETS_BUCKET)
    .upload(path, file, { cacheControl: '31536000', upsert: false, contentType: file.type })
  if (error) {
    logError(`upload:${folder}`, error)
    throw new FriendlyError('The file could not be uploaded. Please try again.')
  }
  return supabase.storage.from(WEDDING_ASSETS_BUCKET).getPublicUrl(path).data.publicUrl
}

/** Deletes a file from the assets bucket if the URL points there (best effort). */
export async function removeAssetByUrl(url: string): Promise<void> {
  const marker = `/object/public/${WEDDING_ASSETS_BUCKET}/`
  const i = url.indexOf(marker)
  if (i < 0) return
  const { error } = await supabase.storage.from(WEDDING_ASSETS_BUCKET).remove([decodeURIComponent(url.slice(i + marker.length))])
  if (error) logError('removeAssetByUrl', error)
}

function insertError(context: string, error: { message?: string } | null): never {
  logError(context, error)
  if ((error?.message ?? '').includes('GALLERY_LIMIT_REACHED')) {
    throw new FriendlyError(`The gallery can hold up to ${GALLERY_LIMIT} photos. Remove one to add another.`)
  }
  throw new FriendlyError('The photo could not be added. Please try again.')
}

export async function addGalleryFromUrl(imageUrl: string, caption: string, sortOrder: number, sectionId: string | null = null, thumbUrl: string | null = null): Promise<void> {
  const row: { image_url: string; caption: string | null; sort_order: number; section_id: string | null; thumb_url?: string } = {
    image_url: imageUrl.trim(),
    caption: caption.trim() || null,
    sort_order: sortOrder,
    section_id: sectionId,
  }
  const withThumb: typeof row = thumbUrl ? { ...row, thumb_url: thumbUrl } : row
  let { error } = await supabase.from('gallery_images').insert(withThumb)
  // Before migration 038 there's no thumb_url column: save the photo without its small copy.
  if (error && thumbUrl && /thumb_url/.test(error.message ?? '')) ({ error } = await supabase.from('gallery_images').insert(row))
  if (error) insertError('addGalleryFromUrl', error)
}

/** Sizes for uploaded photos: sharp on big screens, a small copy for the grids. */
export const PHOTO_MAX = 1800
export const THUMB_MAX = 800

/** Compresses (≈1800 px main + ≈800 px small copy, WebP/JPEG) then uploads and adds the photo. */
export async function addGalleryFromFile(file: File, sortOrder: number, sectionId: string | null = null): Promise<void> {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif']
  if (!allowed.includes(file.type)) throw new FriendlyError(`“${file.name}” isn’t a supported photo. Please use JPG, PNG or WebP.`)
  const main = await compressImage(file, PHOTO_MAX, 0.82)
  if (main.size > 10 * 1024 * 1024) throw new FriendlyError(`“${file.name}” is too large even after resizing.`)
  const thumb = await compressImage(file, THUMB_MAX, 0.78)
  const url = await uploadToBucket('gallery', main)
  const thumbUrl = thumb !== file && thumb.size < main.size ? await uploadToBucket('gallery/thumbs', thumb).catch(() => null) : null
  try {
    await addGalleryFromUrl(url, '', sortOrder, sectionId, thumbUrl)
  } catch (e) {
    void removeAssetByUrl(url)
    if (thumbUrl) void removeAssetByUrl(thumbUrl)
    throw e
  }
}

/** Admin → Gift Registry → Gift ideas: one photo, resized like the gallery's. Returns its link. */
export async function uploadIdeaPhoto(file: File): Promise<string> {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif']
  if (!allowed.includes(file.type)) throw new FriendlyError(`“${file.name}” isn’t a supported photo. Please use JPG, PNG or WebP.`)
  const main = await compressImage(file, PHOTO_MAX, 0.82)
  if (main.size > 10 * 1024 * 1024) throw new FriendlyError(`“${file.name}” is too large even after resizing.`)
  return uploadToBucket('ideas', main)
}

/**
 * Makes the small copy for photos that don't have one yet (photos uploaded
 * before this existed). Done in the browser, one photo at a time; the full
 * photo stays as it is. Returns how many were done. Links to other websites
 * (e.g. Unsplash) are skipped — those are resized by the site itself.
 */
export async function makeMissingThumbs(onProgress?: (done: number, total: number) => void): Promise<{ done: number; total: number }> {
  const { data, error } = await supabase.from('gallery_images').select('id, image_url, thumb_url').is('thumb_url', null)
  if (error) {
    logError('makeMissingThumbs', error)
    throw new FriendlyError(/thumb_url/.test(error.message ?? '') ? 'Run migration 038 in Supabase first — then photos can be optimised.' : FRIENDLY_ERRORS.generic)
  }
  const todo = ((data ?? []) as { id: string; image_url: string }[]).filter((r) => r.image_url.includes(`/object/public/${WEDDING_ASSETS_BUCKET}/`))
  let done = 0
  onProgress?.(0, todo.length)
  for (const r of todo) {
    try {
      const res = await fetch(r.image_url)
      if (!res.ok) continue
      const blob = await res.blob()
      const file = new File([blob], 'photo', { type: blob.type || 'image/jpeg' })
      const thumb = await compressImage(file, THUMB_MAX, 0.78)
      if (thumb === file) continue
      const thumbUrl = await uploadToBucket('gallery/thumbs', thumb)
      const { error: e2 } = await supabase.from('gallery_images').update({ thumb_url: thumbUrl }).eq('id', r.id)
      if (e2) {
        void removeAssetByUrl(thumbUrl)
        continue
      }
      done++
    } catch (e) {
      logError('makeMissingThumbs:one', e)
    }
    onProgress?.(done, todo.length)
  }
  return { done, total: todo.length }
}

export async function updateGalleryImage(id: string, patch: Partial<Pick<GalleryImage, 'caption' | 'isVisible'>>): Promise<void> {
  const row: { caption?: string | null; is_visible?: boolean } = {}
  if (patch.caption !== undefined) row.caption = patch.caption.trim() || null
  if (patch.isVisible !== undefined) row.is_visible = patch.isVisible
  const { error } = await supabase.from('gallery_images').update(row).eq('id', id)
  if (error) {
    logError('updateGalleryImage', error)
    throw new FriendlyError('The change could not be saved. Please try again.')
  }
}

export async function reorderGallery(ids: string[]): Promise<void> {
  const results = await Promise.all(ids.map((id, i) => supabase.from('gallery_images').update({ sort_order: i + 1 }).eq('id', id)))
  const failed = results.find((r) => r.error)
  if (failed) {
    logError('reorderGallery', failed.error)
    throw new FriendlyError('The new order could not be saved. Please try again.')
  }
}

export async function deleteGalleryImage(image: GalleryImage): Promise<void> {
  const { error } = await supabase.from('gallery_images').delete().eq('id', image.id)
  if (error) {
    logError('deleteGalleryImage', error)
    throw new FriendlyError('The photo could not be removed. Please try again.')
  }
  void removeAssetByUrl(image.imageUrl)
  if (image.thumbUrl) void removeAssetByUrl(image.thumbUrl)
}

/** Prenup video upload: MP4/WebM up to 30 MB. */
export async function uploadVideoFile(file: File): Promise<string> {
  if (!['video/mp4', 'video/webm'].includes(file.type)) throw new FriendlyError('Please choose an MP4 or WebM video.')
  if (file.size > VIDEO_MAX_MB * 1024 * 1024) {
    throw new FriendlyError(`That video is ${(file.size / 1024 / 1024).toFixed(0)} MB. The limit is ${VIDEO_MAX_MB} MB — please use a YouTube link for longer videos.`)
  }
  return uploadToBucket('video', file)
}

export async function uploadVideoPoster(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new FriendlyError('Please choose an image for the cover.')
  return uploadToBucket('video', await compressImage(file, 1920, 0.8))
}
