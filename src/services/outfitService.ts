import { supabase } from '../lib/supabase'
import type { Tables } from '../types/database'
import type { OutfitGender, OutfitImage } from '../types/wedding'
import { FRIENDLY_ERRORS, FriendlyError, logError } from '../utils/errors'
import { uploadWeddingAsset } from './settingsService'

const fromRow = (r: Tables<'outfit_images'>): OutfitImage => ({
  id: r.id,
  gender: r.gender === 'female' ? 'female' : 'male',
  imageUrl: r.image_url,
  caption: r.caption ?? '',
  label: (r.label ?? '').trim(),
  sortOrder: r.sort_order,
  isVisible: r.is_visible,
})

async function list(context: string): Promise<OutfitImage[]> {
  const { data, error } = await supabase
    .from('outfit_images')
    .select('*')
    .order('gender', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) {
    logError(context, error)
    throw new FriendlyError(FRIENDLY_ERRORS.generic)
  }
  return ((data ?? []) as Tables<'outfit_images'>[]).map(fromRow)
}

/**
 * What to Wear for the website. When the hosts keep it for attending guests
 * (Website Settings → Privacy), the database only sends the photos to a guest
 * pass whose invitation said "attending".
 */
export async function listAttire(token?: string | null): Promise<{ private: boolean; allowed: boolean; images: OutfitImage[] }> {
  const { data, error } = await supabase.rpc('attire_list', { p_token: token ?? null })
  if (error) {
    logError('listAttire', error)
    throw new FriendlyError(FRIENDLY_ERRORS.generic)
  }
  const o = (data ?? {}) as { private?: unknown; allowed?: unknown; items?: unknown }
  const rows = Array.isArray(o.items) ? (o.items as Tables<'outfit_images'>[]) : []
  return { private: o.private === true, allowed: o.allowed !== false, images: rows.map(fromRow).filter((x) => x.isVisible) }
}

/** Admin: visible outfit images only. */
export async function listVisibleOutfits(): Promise<OutfitImage[]> {
  const all = await list('listVisibleOutfits')
  return all.filter((o) => o.isVisible)
}

/** Admin: every outfit image, including hidden ones. */
export function listAllOutfits(): Promise<OutfitImage[]> {
  return list('listAllOutfits')
}

export async function addOutfitFromUrl(gender: OutfitGender, imageUrl: string, caption: string, sortOrder: number, label = ''): Promise<OutfitImage> {
  const { data, error } = await supabase
    .from('outfit_images')
    .insert({ gender, image_url: imageUrl.trim(), caption: caption.trim() || null, sort_order: sortOrder, ...(label.trim() ? { label: label.trim().slice(0, 60) } : {}) })
    .select('*')
    .single()
  if (error || !data) {
    logError('addOutfitFromUrl', error)
    throw new FriendlyError('The image could not be added. Please check the link and try again.')
  }
  return fromRow(data as Tables<'outfit_images'>)
}

export async function addOutfitFromFile(gender: OutfitGender, file: File, caption: string, sortOrder: number, label = ''): Promise<OutfitImage> {
  const url = await uploadWeddingAsset(file, gender === 'male' ? 'outfits/male' : 'outfits/female')
  return addOutfitFromUrl(gender, url, caption, sortOrder, label)
}

export async function updateOutfit(id: string, patch: Partial<Pick<OutfitImage, 'caption' | 'label' | 'isVisible' | 'sortOrder'>>): Promise<void> {
  const row: { caption?: string | null; label?: string | null; is_visible?: boolean; sort_order?: number } = {}
  if (patch.caption !== undefined) row.caption = patch.caption.trim() || null
  if (patch.label !== undefined) row.label = patch.label.trim().slice(0, 60) || null
  if (patch.isVisible !== undefined) row.is_visible = patch.isVisible
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder
  const { error } = await supabase.from('outfit_images').update(row).eq('id', id)
  if (error) {
    logError('updateOutfit', error)
    throw new FriendlyError('The change could not be saved. Please try again.')
  }
}

/** Saves a new order for one group (index = position). */
export async function reorderOutfits(ids: string[]): Promise<void> {
  const results = await Promise.all(ids.map((id, i) => supabase.from('outfit_images').update({ sort_order: i + 1 }).eq('id', id)))
  const failed = results.find((r) => r.error)
  if (failed) {
    logError('reorderOutfits', failed.error)
    throw new FriendlyError('The new order could not be saved. Please try again.')
  }
}

export async function deleteOutfit(id: string): Promise<void> {
  const { error } = await supabase.from('outfit_images').delete().eq('id', id)
  if (error) {
    logError('deleteOutfit', error)
    throw new FriendlyError('The image could not be removed. Please try again.')
  }
}
