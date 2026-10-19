import { supabase } from '../lib/supabase'
import type { Json, Tables } from '../types/database'
import {
  DEFAULT_SEATING_CONFIG,
  type ItemKind,
  type ItemLocation,
  type SeatAssignment,
  type SeatingConfig,
  type SeatingItem,
  type SeatingNotice,
  type SeatingTable,
  type SeatingTableInput,
  type SeatSides,
  type TableShape,
} from '../types/seating'
import { FRIENDLY_ERRORS, FriendlyError, logError } from '../utils/errors'
import { normalizeSpaces } from '../utils/validation'

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d)

export const mapTable = (r: Tables<'seating_tables'>): SeatingTable => ({
  id: r.id,
  name: r.name,
  shape: (r.shape === 'rect' ? 'rect' : 'round') as TableShape,
  capacity: r.capacity,
  seatSides: (['both', 'one', 'all'].includes(r.seat_sides) ? r.seat_sides : 'both') as SeatSides,
  x: num(r.x, 0),
  y: num(r.y, 0),
  width: num(r.width, 170),
  height: num(r.height, 170),
  rotation: num(r.rotation, 0),
  placed: r.placed,
  sortOrder: r.sort_order,
})

const mapItem = (r: Tables<'seating_items'>): SeatingItem => ({
  id: r.id,
  kind: r.kind as ItemKind,
  label: r.label ?? '',
  x: num(r.x, 0),
  y: num(r.y, 0),
  width: num(r.width, 200),
  height: num(r.height, 90),
  rotation: num(r.rotation, 0),
  location: (['inside', 'outside'].includes(r.location) ? r.location : 'auto') as ItemLocation,
})

const mapSeat = (r: Tables<'seat_assignments'>): SeatAssignment => ({
  id: r.id,
  tableId: r.table_id,
  seatIndex: r.seat_index,
  invitationId: r.invitation_id,
  guestId: r.guest_id,
})

function fail(context: string, error: { message?: string; code?: string } | null, fallback: string): never {
  logError(context, error)
  const msg = error?.message ?? ''
  if (error?.code === '23505' && msg.includes('seating_tables_name')) throw new FriendlyError('A table with this name already exists.')
  if (error?.code === '23505' && msg.includes('chair')) throw new FriendlyError('That chair was just taken. Please pick another one.')
  if (error?.code === '23505') throw new FriendlyError('This guest already has a seat. Refresh the page and try again.')
  if (msg.includes('TABLE_LIMIT_REACHED')) throw new FriendlyError('You can have up to 150 tables.')
  if (msg.includes('SEAT_OUT_OF_RANGE')) throw new FriendlyError('That chair no longer exists. Please refresh.')
  throw new FriendlyError(fallback)
}

// ------------------------------------------------------------------ tables

export async function listTables(): Promise<SeatingTable[]> {
  const { data, error } = await supabase.from('seating_tables').select('*').order('sort_order').order('created_at')
  if (error) fail('listTables', error, FRIENDLY_ERRORS.generic)
  return ((data ?? []) as Tables<'seating_tables'>[]).map(mapTable)
}

export async function createTable(input: SeatingTableInput, sortOrder: number, geometry?: Partial<SeatingTable>): Promise<SeatingTable> {
  const size = suggestedSize(input.shape, input.capacity, input.seatSides)
  const { data, error } = await supabase
    .from('seating_tables')
    .insert({
      name: normalizeSpaces(input.name).slice(0, 60),
      shape: input.shape,
      capacity: input.capacity,
      seat_sides: input.seatSides,
      width: geometry?.width ?? size.width,
      height: geometry?.height ?? size.height,
      x: geometry?.x ?? 0,
      y: geometry?.y ?? 0,
      rotation: geometry?.rotation ?? 0,
      placed: geometry?.placed ?? false,
      sort_order: sortOrder,
    })
    .select('*')
    .single()
  if (error || !data) fail('createTable', error, 'The table could not be added. Please try again.')
  return mapTable(data as Tables<'seating_tables'>)
}

export async function updateTable(id: string, patch: Partial<Omit<SeatingTable, 'id'>>): Promise<void> {
  const row: Record<string, unknown> = {}
  if (patch.name !== undefined) row.name = normalizeSpaces(patch.name).slice(0, 60)
  if (patch.shape !== undefined) row.shape = patch.shape
  if (patch.capacity !== undefined) row.capacity = patch.capacity
  if (patch.seatSides !== undefined) row.seat_sides = patch.seatSides
  for (const k of ['x', 'y', 'width', 'height', 'rotation'] as const) if (patch[k] !== undefined) row[k] = Math.round(patch[k]! * 10) / 10
  if (patch.placed !== undefined) row.placed = patch.placed
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder
  const { error } = await supabase.from('seating_tables').update(row).eq('id', id)
  if (error) fail('updateTable', error, 'The table could not be saved. Please try again.')
}

export async function deleteTable(id: string): Promise<void> {
  const { error } = await supabase.from('seating_tables').delete().eq('id', id)
  if (error) fail('deleteTable', error, 'The table could not be deleted. Please try again.')
}

/** A comfortable default size so chairs don't overlap. */
export function suggestedSize(shape: TableShape, capacity: number, sides: SeatSides): { width: number; height: number } {
  if (shape === 'round') {
    const d = Math.max(110, Math.min(420, Math.round((capacity * 46) / Math.PI)))
    return { width: d, height: d }
  }
  const perSide = sides === 'one' ? capacity : sides === 'both' ? Math.ceil(capacity / 2) : Math.ceil((capacity - 2) / 2)
  return { width: Math.max(140, Math.min(1400, perSide * 52 + 20)), height: sides === 'one' ? 70 : 90 }
}

// ------------------------------------------------------------------ items

export async function listItems(): Promise<SeatingItem[]> {
  const { data, error } = await supabase.from('seating_items').select('*').order('created_at')
  if (error) fail('listItems', error, FRIENDLY_ERRORS.generic)
  return ((data ?? []) as Tables<'seating_items'>[]).map(mapItem)
}

export async function createItem(item: Omit<SeatingItem, 'id'>): Promise<SeatingItem> {
  const { data, error } = await supabase
    .from('seating_items')
    .insert({ kind: item.kind, label: item.label.slice(0, 60), x: item.x, y: item.y, width: item.width, height: item.height, rotation: item.rotation, location: item.location })
    .select('*')
    .single()
  if (error || !data) fail('createItem', error, 'The item could not be added. Please try again.')
  return mapItem(data as Tables<'seating_items'>)
}

export async function updateItem(id: string, patch: Partial<Omit<SeatingItem, 'id'>>): Promise<void> {
  const row: Record<string, unknown> = { ...patch }
  for (const k of ['x', 'y', 'width', 'height', 'rotation'] as const) if (patch[k] !== undefined) row[k] = Math.round(patch[k]! * 10) / 10
  if (patch.label !== undefined) row.label = patch.label.slice(0, 60)
  const { error } = await supabase.from('seating_items').update(row).eq('id', id)
  if (error) fail('updateItem', error, 'The item could not be saved. Please try again.')
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from('seating_items').delete().eq('id', id)
  if (error) fail('deleteItem', error, 'The item could not be removed. Please try again.')
}

// ------------------------------------------------------------------ seats

export async function listSeats(): Promise<SeatAssignment[]> {
  const { data, error } = await supabase.from('seat_assignments').select('*')
  if (error) fail('listSeats', error, FRIENDLY_ERRORS.generic)
  return ((data ?? []) as Tables<'seat_assignments'>[]).map(mapSeat)
}

/** Puts a person in a chair (moving them if they were already seated). */
export async function assignSeat(tableId: string, seatIndex: number, invitationId: string, guestId: string | null): Promise<SeatAssignment> {
  let del = supabase.from('seat_assignments').delete().eq('invitation_id', invitationId)
  del = guestId ? del.eq('guest_id', guestId) : del.is('guest_id', null)
  const { error: e1 } = await del
  if (e1) fail('assignSeat:clear', e1, 'The seat could not be saved. Please try again.')
  const { data, error } = await supabase
    .from('seat_assignments')
    .insert({ table_id: tableId, seat_index: seatIndex, invitation_id: invitationId, guest_id: guestId })
    .select('*')
    .single()
  if (error || !data) fail('assignSeat', error, 'The seat could not be saved. Please try again.')
  return mapSeat(data as Tables<'seat_assignments'>)
}

/**
 * Admin: takes one chair away from a table. The chair must be empty; the chairs
 * after it move down by one place and the table gets one chair fewer.
 * Returns the table's new number of chairs.
 */
export async function removeTableSeat(tableId: string, seatIndex: number): Promise<number> {
  const { data, error } = await supabase.rpc('remove_table_seat', { p_table_id: tableId, p_seat_index: seatIndex })
  if (error) {
    logError('removeTableSeat', error)
    if (/LAST_CHAIR/.test(error.message)) throw new FriendlyError('A table needs at least one chair.')
    if (/SEAT_TAKEN/.test(error.message)) throw new FriendlyError('Someone is still in this chair. Please try again.')
    throw new FriendlyError('The chair couldn’t be removed. Please try again.')
  }
  return typeof data === 'number' ? data : 0
}

export async function clearSeat(id: string): Promise<void> {
  const { error } = await supabase.from('seat_assignments').delete().eq('id', id)
  if (error) fail('clearSeat', error, 'The chair could not be cleared. Please try again.')
}

// ------------------------------------------------------------------ notices

export async function listNotices(): Promise<SeatingNotice[]> {
  const { data, error } = await supabase.from('seating_notices').select('*').order('created_at', { ascending: false }).limit(50)
  if (error) fail('listNotices', error, FRIENDLY_ERRORS.generic)
  return ((data ?? []) as Tables<'seating_notices'>[]).map((r) => ({
    id: r.id,
    personName: r.person_name,
    tableName: r.table_name,
    reason: r.reason,
    createdAt: r.created_at,
  }))
}

export async function dismissNotices(): Promise<void> {
  const { error } = await supabase.from('seating_notices').delete().not('id', 'is', null)
  if (error) fail('dismissNotices', error, 'Could not clear the notices.')
}

// ------------------------------------------------------------------ config

export function parseSeatingConfig(value: Json | null | undefined): SeatingConfig {
  const o = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
  const r = (o.room ?? {}) as Record<string, unknown>
  const c = (o.canvas ?? {}) as Record<string, unknown>
  const f = (o.finder ?? {}) as Record<string, unknown>
  const d = DEFAULT_SEATING_CONFIG
  const mode = f.mode === 'visible' || f.mode === 'scheduled' || f.mode === 'reveal' ? f.mode : 'hidden'
  return {
    room: { x: num(r.x, d.room.x), y: num(r.y, d.room.y), width: num(r.width, d.room.width), height: num(r.height, d.room.height) },
    canvas: { width: num(c.width, d.canvas.width), height: num(c.height, d.canvas.height) },
    finder: { mode, from: typeof f.from === 'string' && f.from ? f.from : null, preassign: f.preassign === true },
  }
}

export async function saveSeatingConfig(settingsId: string, config: SeatingConfig): Promise<void> {
  const { error } = await supabase.from('wedding_settings').update({ seating_config: config as unknown as Json }).eq('id', settingsId)
  if (error) fail('saveSeatingConfig', error, 'The seating settings could not be saved. Please try again.')
}

/** Public: table and chair right after an "attending" RSVP (chair only when seats are pre-assigned). */
export async function getInvitationSeat(invitationId: string): Promise<{ tableName: string | null; seat: number | null; preassign: boolean } | null> {
  const { data, error } = await supabase.rpc('get_invitation_seat', { p_invitation_id: invitationId })
  if (error) {
    // Before migration 020 is applied, fall back to the table name only.
    const tableName = await getInvitationTable(invitationId)
    return tableName ? { tableName, seat: null, preassign: false } : null
  }
  const o = (data ?? null) as Record<string, unknown> | null
  if (!o) return null
  return {
    tableName: typeof o.tableName === 'string' && o.tableName ? o.tableName : null,
    seat: typeof o.seat === 'number' ? o.seat : null,
    preassign: o.preassign === true,
  }
}

/** Is the database ready for pre-assigned seats (migration 020)? */
export async function preassignReady(): Promise<boolean> {
  const { error } = await supabase.rpc('get_invitation_seat', { p_invitation_id: '00000000-0000-0000-0000-000000000000' })
  return !error
}

/** Public: the guest's table name, only after they RSVP "attending". */
export async function getInvitationTable(invitationId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_invitation_table', { p_invitation_id: invitationId })
  if (error) {
    logError('getInvitationTable', error)
    return null
  }
  return typeof data === 'string' && data ? data : null
}

// ------------------------------------------------------------------ Find My Seat (public)

export type SeatSearchStatus = 'hidden' | 'not_found' | 'pending' | 'declined' | 'unseated' | 'seated'

export interface SeatSearchResult {
  status: SeatSearchStatus
  name?: string
  tableId?: string
  tableName?: string | null
  seat?: number | null
  party?: { seat: number; name: string }[]
  layout?: { config: SeatingConfig; tables: SeatingTable[]; items: SeatingItem[] }
  /** Sent only when seats are pre-assigned: the party's RSVP, to colour the seats. */
  rsvp?: 'attending' | 'declining' | 'pending'
}

export async function findMySeat(name: string): Promise<SeatSearchResult> {
  const { data, error } = await supabase.rpc('find_my_seat', { search_name: name })
  if (error) fail('findMySeat', error, 'We couldn’t look up your seat right now. Please try again.')
  const o = (data ?? {}) as Record<string, unknown>
  const status = (o.status as SeatSearchStatus) ?? 'not_found'
  const res: SeatSearchResult = {
    status,
    name: typeof o.name === 'string' ? o.name : undefined,
    tableId: typeof o.tableId === 'string' ? o.tableId : undefined,
    tableName: typeof o.tableName === 'string' ? o.tableName : null,
    seat: typeof o.seat === 'number' ? o.seat : null,
    party: Array.isArray(o.party) ? (o.party as { seat: number; name: string }[]) : [],
    rsvp: o.rsvp === 'attending' || o.rsvp === 'declining' || o.rsvp === 'pending' ? o.rsvp : undefined,
  }
  const l = o.layout as Record<string, unknown> | undefined
  if (l) {
    const cfg = parseSeatingConfig({ room: l.room, canvas: l.canvas } as Json)
    res.layout = {
      config: cfg,
      tables: ((l.tables as Record<string, unknown>[]) ?? []).map((t) =>
        mapTable({
          id: String(t.id),
          name: String(t.name),
          shape: String(t.shape),
          capacity: Number(t.capacity),
          seat_sides: String(t.seatSides),
          x: Number(t.x),
          y: Number(t.y),
          width: Number(t.width),
          height: Number(t.height),
          rotation: Number(t.rotation),
          placed: true,
          sort_order: 0,
          created_at: '',
          updated_at: '',
        }),
      ),
      items: ((l.items as Record<string, unknown>[]) ?? []).map((i) =>
        mapItem({
          id: String(i.id),
          kind: String(i.kind),
          label: String(i.label ?? ''),
          x: Number(i.x),
          y: Number(i.y),
          width: Number(i.width),
          height: Number(i.height),
          rotation: Number(i.rotation),
          location: String(i.location),
          created_at: '',
          updated_at: '',
        }),
      ),
    }
  }
  return res
}
