import { supabase } from '../lib/supabase'
import type { Tables } from '../types/database'
import { FriendlyError, logError } from '../utils/errors'

export interface EntourageLink {
  memberId: string
  invitationId: string
  guestId: string | null
}

/** Admin: which entourage names are linked to an invitation (and guest). */
export async function listEntourageLinks(): Promise<EntourageLink[]> {
  const { data, error } = await supabase.from('entourage_links').select('*')
  if (error) {
    logError('listEntourageLinks', error)
    return []
  }
  return ((data ?? []) as Tables<'entourage_links'>[]).map((r) => ({ memberId: r.member_id, invitationId: r.invitation_id, guestId: r.guest_id }))
}

/** Replaces the saved links with exactly these (called after saving the entourage). */
export async function saveEntourageLinks(links: EntourageLink[]): Promise<void> {
  const keep = links.map((l) => l.memberId)
  const { data: existing, error: e0 } = await supabase.from('entourage_links').select('member_id')
  if (e0) throw fail('saveEntourageLinks:list', e0)
  const remove = ((existing ?? []) as { member_id: string }[]).map((r) => r.member_id).filter((id) => !keep.includes(id))
  if (remove.length) {
    const { error } = await supabase.from('entourage_links').delete().in('member_id', remove)
    if (error) throw fail('saveEntourageLinks:delete', error)
  }
  if (links.length) {
    const { error } = await supabase
      .from('entourage_links')
      .upsert(links.map((l) => ({ member_id: l.memberId, invitation_id: l.invitationId, guest_id: l.guestId })), { onConflict: 'member_id' })
    if (error) throw fail('saveEntourageLinks:upsert', error)
  }
}

function fail(context: string, error: unknown) {
  logError(context, error)
  return new FriendlyError('The entourage was saved, but its links to invitations could not be updated. Please try again.')
}
