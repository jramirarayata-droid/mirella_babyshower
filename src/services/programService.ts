import { supabase } from '../lib/supabase'
import type { Tables } from '../types/database'
import type { ProgramItem } from '../types/wedding'
import { FriendlyError, logError } from '../utils/errors'

/** The most moments the program can hold (Admin → Website Settings → Program flow). */
export const PROGRAM_LIMIT = 30

const fromRow = (r: Tables<'program_items'>): ProgramItem => ({
  id: r.id,
  time: r.time_label ?? '',
  title: r.title ?? '',
  description: r.description ?? '',
})

const missingTable = (e: { message?: string; code?: string } | null) => e?.code === '42P01' || e?.code === 'PGRST205' || /program_items/.test(e?.message ?? '')

/**
 * The program in order. Guests only get rows while the program is switched on
 * (the database decides); admins always get everything, e.g. for Printables.
 */
export async function listProgram(): Promise<ProgramItem[]> {
  const { data, error } = await supabase.from('program_items').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true })
  if (error) {
    logError('listProgram', error)
    throw new FriendlyError(missingTable(error) ? 'The program needs the new database update (migration 040) first.' : 'The program couldn’t be loaded. Please try again.')
  }
  return ((data ?? []) as Tables<'program_items'>[]).map(fromRow)
}

export function newProgramItemId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
      })
}

/** Cleans what the admin typed: trims, drops empty rows, keeps the limits of the table. */
export function cleanProgram(items: ProgramItem[]): ProgramItem[] {
  return items
    .map((i) => ({ id: i.id, time: i.time.trim().slice(0, 40), title: i.title.trim().slice(0, 120), description: i.description.trim().slice(0, 300) }))
    .filter((i) => i.title)
}

/**
 * Admin: saves the whole program as shown in the editor. New and changed rows
 * are written first; only then are rows the admin removed deleted, so a failed
 * save never loses anything.
 */
export async function saveProgram(items: ProgramItem[]): Promise<ProgramItem[]> {
  const clean = cleanProgram(items)
  if (clean.length > PROGRAM_LIMIT) throw new FriendlyError(`The program can hold up to ${PROGRAM_LIMIT} moments.`)
  if (clean.length) {
    const rows = clean.map((i, idx) => ({ id: i.id, time_label: i.time, title: i.title, description: i.description || null, sort_order: idx + 1 }))
    const { error } = await supabase.from('program_items').upsert(rows, { onConflict: 'id' })
    if (error) {
      logError('saveProgram', error)
      throw new FriendlyError(missingTable(error) ? 'The program needs the new database update (migration 040) first.' : 'The program couldn’t be saved. Please try again.')
    }
  }
  const keep = clean.map((i) => i.id)
  const del = supabase.from('program_items').delete()
  const { error } = await (keep.length ? del.not('id', 'in', `(${keep.join(',')})`) : del.not('id', 'is', null))
  if (error) {
    logError('saveProgram.delete', error)
    throw new FriendlyError('The program was saved, but removed moments couldn’t be deleted. Please save again.')
  }
  return clean
}
