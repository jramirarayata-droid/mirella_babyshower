import { supabase } from '../lib/supabase'
import { FriendlyError, logError } from '../utils/errors'
import { getAdminPreference, saveAdminPreference } from './preferencesService'

/*
 * Guest photos: guests add photos from their phones on #/photos.
 * Admin → Guest Photos sets when it's open, limits, and approval.
 */

export const GUEST_BUCKET = 'guest-photos'
export const guestPhotoUrl = (path: string) => supabase.storage.from(GUEST_BUCKET).getPublicUrl(path).data.publicUrl

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

// ---------------------------------------------------------------- settings (admin)

export interface GuestPhotoSettings {
  /** The photos page on the website: hidden, visible, or visible from a date. */
  mode: 'hidden' | 'visible' | 'scheduled' | 'reveal'
  from: string | null
  /** Optional: guests can't add more after this (the gallery stays). */
  until: string | null
  /** instant = photos show straight away; approve = they wait for you. */
  approval: 'instant' | 'approve'
  perGuest: number
  total: number
  title: string
  subtitle: string
  /** How photos look in the gallery. */
  style: PhotoStyle
}

export type PhotoStyle = 'classic' | 'polaroid'

export const DEFAULT_GUEST_PHOTOS: GuestPhotoSettings = {
  mode: 'hidden',
  from: null,
  until: null,
  approval: 'instant',
  perGuest: 25,
  total: 1500,
  title: 'Shared by our guests',
  subtitle: 'Add the moments you captured — every photo is a gift.',
  style: 'classic',
}

export async function getGuestPhotoSettings(): Promise<GuestPhotoSettings> {
  const v = obj(await getAdminPreference('guest_photos'))
  const n = (x: unknown, d: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number(x ?? d)) || d))
  return {
    mode: v.mode === 'visible' || v.mode === 'scheduled' || v.mode === 'reveal' ? v.mode : 'hidden',
    from: typeof v.from === 'string' && v.from ? v.from : null,
    until: typeof v.until === 'string' && v.until ? v.until : null,
    approval: v.approval === 'approve' ? 'approve' : 'instant',
    perGuest: n(v.perGuest, 25, 1, 200),
    total: n(v.total, 1500, 10, 5000),
    title: typeof v.title === 'string' && v.title.trim() ? v.title : DEFAULT_GUEST_PHOTOS.title,
    subtitle: typeof v.subtitle === 'string' ? v.subtitle : DEFAULT_GUEST_PHOTOS.subtitle,
    style: v.style === 'polaroid' ? 'polaroid' : 'classic',
  }
}

export async function saveGuestPhotoSettings(s: GuestPhotoSettings): Promise<void> {
  await saveAdminPreference('guest_photos', s)
}

// ---------------------------------------------------------------- public

export interface GuestPhotosInfo {
  visible: boolean
  open: boolean
  approval: 'instant' | 'approve'
  perGuest: number
  title: string
  subtitle: string
  style: PhotoStyle
  count: number
}

let infoCache: { at: number; p: Promise<GuestPhotosInfo> } | null = null

/** Cached for a minute (the menu, home section and photos page all ask). */
export function getGuestPhotosInfo(fresh = false): Promise<GuestPhotosInfo> {
  if (!fresh && infoCache && Date.now() - infoCache.at < 60_000) return infoCache.p
  const p = loadGuestPhotosInfo()
  infoCache = { at: Date.now(), p }
  p.catch(() => (infoCache = null))
  return p
}

async function loadGuestPhotosInfo(): Promise<GuestPhotosInfo> {
  const { data, error } = await supabase.rpc('guest_photos_info')
  if (error) {
    logError('getGuestPhotosInfo', error)
    throw new FriendlyError('The photos couldn’t be loaded. Please try again.')
  }
  const o = obj(data)
  return {
    visible: o.visible === true,
    open: o.open === true,
    approval: o.approval === 'approve' ? 'approve' : 'instant',
    perGuest: Number(o.perGuest ?? 25) || 25,
    title: String(o.title ?? DEFAULT_GUEST_PHOTOS.title),
    subtitle: String(o.subtitle ?? ''),
    style: o.style === 'polaroid' ? 'polaroid' : 'classic',
    count: Number(o.count ?? 0) || 0,
  }
}

export interface GuestPhoto {
  id: string
  url: string
  thumbUrl: string
  by: string
  at: string
}

/** The gallery, newest first. Pass the last photo's time to get the next page. */
export async function listGuestPhotos(before: string | null = null, limit = 60): Promise<GuestPhoto[]> {
  const { data, error } = await supabase.rpc('guest_photo_list', { p_before: before ?? undefined, p_limit: limit })
  if (error) {
    logError('listGuestPhotos', error)
    throw new FriendlyError('The photos couldn’t be loaded. Please try again.')
  }
  return (Array.isArray(data) ? data : []).map((x) => {
    const r = obj(x)
    return { id: String(r.id), url: guestPhotoUrl(String(r.path)), thumbUrl: guestPhotoUrl(String(r.thumb)), by: String(r.by ?? ''), at: String(r.at ?? '') }
  })
}

// ---------------------------------------------------------------- the guest's session

const SESSION_KEY = 'wedding-photo-guest'

export interface PhotoGuest {
  token: string
  name: string
}

export function savedGuest(): PhotoGuest | null {
  try {
    const v = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as PhotoGuest | null
    return v && typeof v.token === 'string' && typeof v.name === 'string' ? v : null
  } catch {
    return null
  }
}
export function forgetGuest() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

export type StartResult = { ok: true; guest: PhotoGuest } | { ok: false; reason: 'closed' | 'not_found' }

/** The guest types their full name, as on their invitation. */
export async function startPhotoGuest(name: string): Promise<StartResult> {
  const { data, error } = await supabase.rpc('guest_photo_start', { p_name: name })
  if (error) {
    logError('startPhotoGuest', error)
    throw new FriendlyError('We couldn’t check your name. Please try again.')
  }
  const o = obj(data)
  if (o.ok === true && typeof o.token === 'string') {
    const guest = { token: o.token, name: String(o.name ?? name) }
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(guest))
    } catch {
      /* private mode: works for this visit */
    }
    return { ok: true, guest }
  }
  return { ok: false, reason: o.reason === 'closed' ? 'closed' : 'not_found' }
}

export interface Allowance {
  ok: boolean
  open: boolean
  left: number
  mine: number
  full: boolean
}

export async function photoAllowance(token: string): Promise<Allowance> {
  const { data, error } = await supabase.rpc('guest_photo_left', { p_token: token })
  if (error) {
    logError('photoAllowance', error)
    throw new FriendlyError('We couldn’t check your photos. Please try again.')
  }
  const o = obj(data)
  return { ok: o.ok === true, open: o.open === true, left: Number(o.left ?? 0) || 0, mine: Number(o.mine ?? 0) || 0, full: o.full === true }
}

export interface MyPhoto {
  id: string
  thumbUrl: string
  url: string
  status: 'visible' | 'pending'
}

export async function myPhotos(token: string): Promise<MyPhoto[]> {
  const { data, error } = await supabase.rpc('guest_photo_mine', { p_token: token })
  if (error) {
    logError('myPhotos', error)
    return []
  }
  return (Array.isArray(data) ? data : []).map((x) => {
    const r = obj(x)
    return { id: String(r.id), thumbUrl: guestPhotoUrl(String(r.thumb)), url: guestPhotoUrl(String(r.path)), status: r.status === 'pending' ? 'pending' : 'visible' }
  })
}

export async function removeMyPhoto(token: string, id: string): Promise<void> {
  const { error } = await supabase.rpc('guest_photo_remove', { p_token: token, p_id: id })
  if (error) {
    logError('removeMyPhoto', error)
    throw new FriendlyError('The photo couldn’t be removed. Please try again.')
  }
}

export type UploadFailure = 'closed' | 'session' | 'limit' | 'full' | 'error'

/**
 * Uploads prepared photos (full + thumbnail each): asks for slots, uploads
 * into them, then confirms. Calls onProgress after each photo.
 */
export async function uploadGuestPhotos(
  token: string,
  photos: { full: Blob; thumb: Blob }[],
  onProgress: (done: number) => void,
): Promise<{ added: number; status: 'visible' | 'pending'; failed: number; stopped?: UploadFailure }> {
  let added = 0
  let failed = 0
  let status: 'visible' | 'pending' = 'visible'
  for (let i = 0; i < photos.length; i += 10) {
    const batch = photos.slice(i, i + 10)
    const { data, error } = await supabase.rpc('guest_photo_reserve', { p_token: token, p_count: batch.length })
    if (error) {
      logError('guest_photo_reserve', error)
      return { added, status, failed: failed + photos.length - i, stopped: 'error' }
    }
    const r = obj(data)
    if (r.ok !== true) {
      const reason = (['closed', 'session', 'limit', 'full'] as const).find((x) => x === r.reason) ?? 'error'
      return { added, status, failed: failed + photos.length - i, stopped: reason }
    }
    const slots = (Array.isArray(r.slots) ? r.slots : []).map(obj)
    const ids: string[] = []
    for (let j = 0; j < slots.length; j++) {
      const s = slots[j]
      const p = batch[j]
      const bucket = supabase.storage.from(GUEST_BUCKET)
      const a = await bucket.upload(String(s.path), p.full, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false })
      const b = a.error ? a : await bucket.upload(String(s.thumb), p.thumb, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false })
      if (a.error || b.error) {
        logError('guest photo upload', a.error ?? b.error)
        failed++
      } else ids.push(String(s.id))
      onProgress(i + j + 1)
    }
    // Photos the guest picked beyond their allowance weren't given slots.
    failed += batch.length - slots.length
    if (ids.length) {
      const c = await supabase.rpc('guest_photo_confirm', { p_token: token, p_ids: ids })
      if (c.error) {
        logError('guest_photo_confirm', c.error)
        failed += ids.length
      } else {
        const o = obj(c.data)
        added += Number(o.added ?? 0) || 0
        failed += ids.length - (Number(o.added ?? 0) || 0)
        if (o.status === 'pending') status = 'pending'
      }
    }
  }
  return { added, status, failed }
}

// ---------------------------------------------------------------- admin

export interface AdminGuestPhoto {
  id: string
  uploaderName: string
  path: string
  thumbPath: string
  url: string
  thumbUrl: string
  bytes: number
  status: 'visible' | 'pending' | 'hidden'
  createdAt: string
}

export async function adminListGuestPhotos(): Promise<AdminGuestPhoto[]> {
  const { data, error } = await supabase
    .from('guest_photos')
    .select('id, uploader_name, path, thumb_path, bytes, status, created_at')
    .eq('uploaded', true)
    .order('created_at', { ascending: false })
    .limit(5000)
  if (error) {
    logError('adminListGuestPhotos', error)
    throw new FriendlyError('Guest photos couldn’t be loaded.')
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    uploaderName: r.uploader_name,
    path: r.path,
    thumbPath: r.thumb_path,
    url: guestPhotoUrl(r.path),
    thumbUrl: guestPhotoUrl(r.thumb_path),
    bytes: Number(r.bytes ?? 0),
    status: r.status === 'pending' || r.status === 'hidden' ? r.status : 'visible',
    createdAt: r.created_at,
  }))
}

export async function setGuestPhotoStatus(ids: string[], status: 'visible' | 'pending' | 'hidden'): Promise<void> {
  const { error } = await supabase.from('guest_photos').update({ status }).in('id', ids)
  if (error) {
    logError('setGuestPhotoStatus', error)
    throw new FriendlyError('The photos couldn’t be updated. Please try again.')
  }
}

/** Removes photos for good: the files and the records. */
export async function removeGuestPhotos(photos: Pick<AdminGuestPhoto, 'id' | 'path' | 'thumbPath'>[]): Promise<void> {
  if (!photos.length) return
  const files = photos.flatMap((p) => [p.path, p.thumbPath])
  const { error: e1 } = await supabase.storage.from(GUEST_BUCKET).remove(files)
  if (e1) {
    logError('removeGuestPhotos files', e1)
    throw new FriendlyError('The photos couldn’t be removed. Please try again.')
  }
  const { error: e2 } = await supabase.from('guest_photos').delete().in('id', photos.map((p) => p.id))
  if (e2) {
    logError('removeGuestPhotos rows', e2)
    throw new FriendlyError('The photos couldn’t be removed. Please try again.')
  }
}
