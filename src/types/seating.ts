export type TableShape = 'round' | 'rect'
export type SeatSides = 'both' | 'one' | 'all'

export interface SeatingTable {
  id: string
  name: string
  shape: TableShape
  capacity: number
  seatSides: SeatSides
  x: number
  y: number
  width: number
  height: number
  rotation: number
  /** On the floor plan yet? Tables can exist (for invitations) before they are placed. */
  placed: boolean
  sortOrder: number
}

export type SeatingTableInput = Pick<SeatingTable, 'name' | 'shape' | 'capacity' | 'seatSides'>

export type ItemKind =
  | 'stage'
  | 'dance_floor'
  | 'entrance'
  | 'buffet'
  | 'cake'
  | 'photo_booth'
  | 'sweetheart'
  | 'bar'
  | 'dj'
  | 'gifts'
  | 'registration'
  | 'custom'

export type ItemLocation = 'auto' | 'inside' | 'outside'

export interface SeatingItem {
  id: string
  kind: ItemKind
  label: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  location: ItemLocation
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export type FinderMode = 'hidden' | 'visible' | 'scheduled' | 'reveal'

export interface SeatingConfig {
  /** The hall's walls — anything outside is "Outside". */
  room: Rect
  canvas: { width: number; height: number }
  /** preassign: guests see seats you've set before they RSVP, coloured by their answer. */
  finder: { mode: FinderMode; from: string | null; preassign: boolean }
}

export interface SeatAssignment {
  id: string
  tableId: string
  seatIndex: number
  invitationId: string
  /** null = the invitee themselves */
  guestId: string | null
}

export interface SeatingNotice {
  id: string
  personName: string
  tableName: string
  reason: string
  createdAt: string
}

export const DEFAULT_SEATING_CONFIG: SeatingConfig = {
  room: { x: 100, y: 100, width: 1400, height: 900 },
  canvas: { width: 1600, height: 1100 },
  finder: { mode: 'hidden', from: null, preassign: false },
}

export const ITEM_KINDS: { kind: ItemKind; label: string; width: number; height: number }[] = [
  { kind: 'stage', label: 'Stage', width: 420, height: 130 },
  { kind: 'sweetheart', label: 'Couple’s table', width: 220, height: 80 },
  { kind: 'dance_floor', label: 'Dance floor', width: 320, height: 240 },
  { kind: 'entrance', label: 'Entrance', width: 160, height: 50 },
  { kind: 'buffet', label: 'Buffet', width: 320, height: 80 },
  { kind: 'cake', label: 'Cake table', width: 110, height: 110 },
  { kind: 'photo_booth', label: 'Photo booth', width: 160, height: 140 },
  { kind: 'bar', label: 'Bar / Drinks', width: 220, height: 80 },
  { kind: 'dj', label: 'DJ / Band', width: 180, height: 100 },
  { kind: 'gifts', label: 'Gift table', width: 150, height: 80 },
  { kind: 'registration', label: 'Registration', width: 200, height: 70 },
  { kind: 'custom', label: 'Other', width: 160, height: 90 },
]
