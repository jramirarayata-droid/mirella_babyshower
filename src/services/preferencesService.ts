import { supabase } from '../lib/supabase'
import type { Json } from '../types/database'
import { FriendlyError, logError } from '../utils/errors'

/** Admin: reads a saved preference (null when nothing is saved yet). */
export async function getAdminPreference<T>(key: string): Promise<T | null> {
  const { data, error } = await supabase.from('admin_preferences').select('value').eq('key', key).maybeSingle()
  if (error) {
    logError('getAdminPreference', error)
    throw new FriendlyError('We couldn’t load your saved setup.')
  }
  return (data?.value as T | undefined) ?? null
}

/** Admin: saves (or replaces) a preference. */
export async function saveAdminPreference(key: string, value: unknown): Promise<void> {
  const { error } = await supabase
    .from('admin_preferences')
    .upsert({ key, value: value as Json, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) {
    logError('saveAdminPreference', error)
    throw new FriendlyError('We couldn’t save your setup. Please try again.')
  }
}

/** Admin: forgets a preference, so the defaults are used again. */
export async function deleteAdminPreference(key: string): Promise<void> {
  const { error } = await supabase.from('admin_preferences').delete().eq('key', key)
  if (error) {
    logError('deleteAdminPreference', error)
    throw new FriendlyError('We couldn’t reset your setup. Please try again.')
  }
}
