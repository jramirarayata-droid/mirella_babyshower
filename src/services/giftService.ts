import { supabase, WEDDING_ASSETS_BUCKET } from '../lib/supabase'
import type { Tables } from '../types/database'
import type { GiftSettings, PublicGift } from '../types/wedding'
import { FriendlyError, logError } from '../utils/errors'

type GiftRow = { title: string | null; message: string | null; qr_image_url: string | null }

const toPublic = (r: GiftRow | undefined): PublicGift | null =>
  r && r.qr_image_url ? { title: r.title ?? 'Wedding Gift', message: r.message ?? '', qrImageUrl: r.qr_image_url } : null

/** Home page: only returns the gift when the couple chose "public". */
export async function getPublicGift(): Promise<PublicGift | null> {
  const { data, error } = await supabase.rpc('get_public_gift')
  if (error) {
    logError('getPublicGift', error)
    return null
  }
  return toPublic((data as GiftRow[] | null)?.[0])
}

/** Invited guests (after finding their invitation) — private or public placement. */
export async function getInvitationGift(invitationId: string): Promise<PublicGift | null> {
  const { data, error } = await supabase.rpc('get_invitation_gift', { p_invitation_id: invitationId })
  if (error) {
    logError('getInvitationGift', error)
    return null
  }
  return toPublic((data as GiftRow[] | null)?.[0])
}

const fromRow = (r: Tables<'gift_settings'>): GiftSettings => ({
  isVisible: r.is_visible,
  placement: r.placement === 'public' ? 'public' : 'private',
  title: r.title ?? '',
  message: r.message ?? '',
  qrImageUrl: r.qr_image_url ?? '',
})

/** Admin only (RLS). */
export async function getGiftSettings(): Promise<GiftSettings> {
  const { data, error } = await supabase.from('gift_settings').select('*').limit(1).maybeSingle()
  if (error || !data) {
    logError('getGiftSettings', error ?? 'gift_settings row missing — run migration 003')
    throw new FriendlyError('We couldn’t load the gift settings.')
  }
  return fromRow(data as Tables<'gift_settings'>)
}

export async function updateGiftSettings(input: GiftSettings): Promise<GiftSettings> {
  const { data, error } = await supabase
    .from('gift_settings')
    .update({
      is_visible: input.isVisible,
      placement: input.placement,
      title: input.title.trim() || null,
      message: input.message.trim() || null,
      qr_image_url: input.qrImageUrl.trim() || null,
    })
    .eq('singleton', true)
    .select('*')
    .single()
  if (error || !data) {
    logError('updateGiftSettings', error)
    throw new FriendlyError('We couldn’t save the gift settings. Please try again.')
  }
  return fromRow(data as Tables<'gift_settings'>)
}

/**
 * Uploads the QR under an unguessable file name. The bucket can't be listed by
 * visitors, so the image is only reachable through the URL the RPCs return.
 */
export async function uploadGiftQr(file: File): Promise<string> {
  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(file.type)) throw new FriendlyError('Please choose a JPG, PNG or WebP image of your QR code.')
  if (file.size > 5 * 1024 * 1024) throw new FriendlyError('Please choose an image smaller than 5 MB.')
  const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const path = `gift/${id}.${ext}`
  const { error } = await supabase.storage.from(WEDDING_ASSETS_BUCKET).upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })
  if (error) {
    logError('uploadGiftQr', error)
    throw new FriendlyError('The QR image could not be uploaded. Please try again.')
  }
  return supabase.storage.from(WEDDING_ASSETS_BUCKET).getPublicUrl(path).data.publicUrl
}

/** Best-effort removal of a previously uploaded QR file. */
export async function removeGiftQrFile(url: string): Promise<void> {
  const marker = `/object/public/${WEDDING_ASSETS_BUCKET}/`
  const i = url.indexOf(marker)
  if (i < 0) return
  const path = decodeURIComponent(url.slice(i + marker.length))
  if (!path.startsWith('gift/')) return
  const { error } = await supabase.storage.from(WEDDING_ASSETS_BUCKET).remove([path])
  if (error) logError('removeGiftQrFile', error)
}
