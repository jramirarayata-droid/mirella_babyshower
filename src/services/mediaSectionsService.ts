import { supabase } from '../lib/supabase'
import type { Tables } from '../types/database'
import { GALLERY_LAYOUTS, type GalleryLayout } from '../types/wedding'
import { FRIENDLY_ERRORS, FriendlyError, logError } from '../utils/errors'
import { removeAssetByUrl } from './galleryService'

/** An extra photo or video section on the home page (Admin → Photos & Video → More sections). */
export interface MediaSection {
  id: string
  kind: 'photos' | 'video'
  title: string
  subtitle: string
  layout: GalleryLayout
  videoUrl: string
  posterUrl: string
  isVisible: boolean
  sortOrder: number
}

export const MEDIA_SECTION_LIMIT = 12

const fromRow = (r: Tables<'media_sections'>): MediaSection => ({
  id: r.id,
  kind: r.kind === 'video' ? 'video' : 'photos',
  title: r.title ?? '',
  subtitle: r.subtitle ?? '',
  layout: (GALLERY_LAYOUTS.some((g) => g.id === r.layout) ? r.layout : 'grid') as GalleryLayout,
  videoUrl: r.video_url ?? '',
  posterUrl: r.poster_url ?? '',
  isVisible: r.is_visible,
  sortOrder: r.sort_order,
})

/** Public: visible sections (the database only returns visible ones to guests). Admins get all. */
export async function listMediaSections(): Promise<MediaSection[]> {
  const { data, error } = await supabase.from('media_sections').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true })
  if (error) {
    logError('listMediaSections', error)
    throw new FriendlyError(FRIENDLY_ERRORS.generic)
  }
  return ((data ?? []) as Tables<'media_sections'>[]).map(fromRow)
}

export async function createMediaSection(kind: MediaSection['kind'], sortOrder: number): Promise<MediaSection> {
  const { data, error } = await supabase
    .from('media_sections')
    .insert({ kind, title: kind === 'video' ? 'Another Film' : 'More Moments', sort_order: sortOrder, layout: 'grid' })
    .select('*')
    .single()
  if (error || !data) {
    logError('createMediaSection', error)
    if ((error?.message ?? '').includes('MEDIA_SECTION_LIMIT')) throw new FriendlyError(`You can add up to ${MEDIA_SECTION_LIMIT} extra sections.`)
    throw new FriendlyError('The section couldn’t be added. Please try again.')
  }
  return fromRow(data as Tables<'media_sections'>)
}

export async function updateMediaSection(id: string, patch: Partial<Omit<MediaSection, 'id' | 'kind'>>): Promise<void> {
  const row: Record<string, unknown> = {}
  if (patch.title !== undefined) row.title = patch.title.trim().slice(0, 120)
  if (patch.subtitle !== undefined) row.subtitle = patch.subtitle.trim().slice(0, 300) || null
  if (patch.layout !== undefined) row.layout = patch.layout
  if (patch.videoUrl !== undefined) row.video_url = patch.videoUrl.trim() || null
  if (patch.posterUrl !== undefined) row.poster_url = patch.posterUrl.trim() || null
  if (patch.isVisible !== undefined) row.is_visible = patch.isVisible
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder
  const { error } = await supabase.from('media_sections').update(row).eq('id', id)
  if (error) {
    logError('updateMediaSection', error)
    throw new FriendlyError('The change couldn’t be saved. Please check the link and try again.')
  }
}

export async function reorderMediaSections(ids: string[]): Promise<void> {
  const results = await Promise.all(ids.map((id, i) => supabase.from('media_sections').update({ sort_order: i + 1 }).eq('id', id)))
  const failed = results.find((r) => r.error)
  if (failed) {
    logError('reorderMediaSections', failed.error)
    throw new FriendlyError('The new order couldn’t be saved. Please try again.')
  }
}

/** Removes a section and its photos (the files are cleaned up from storage too). */
export async function deleteMediaSection(section: MediaSection, photoUrls: string[]): Promise<void> {
  const { error } = await supabase.from('media_sections').delete().eq('id', section.id)
  if (error) {
    logError('deleteMediaSection', error)
    throw new FriendlyError('The section couldn’t be removed. Please try again.')
  }
  for (const url of [...photoUrls, section.videoUrl, section.posterUrl]) if (url) void removeAssetByUrl(url)
}
