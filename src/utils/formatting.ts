import type {
  AttendanceStatus,
  FoodOption,
  GuestStatus,
  NeedsTransportation,
  RSVPStatus,
  VehicleType,
} from '../types/rsvp'

export const FOOD_OPTIONS: { value: FoodOption; label: string }[] = [
  { value: 'vegetable', label: 'Vegetable' },
  { value: 'pasta', label: 'Pasta' },
  { value: 'fish', label: 'Fish' },
  { value: 'pork', label: 'Pork' },
  { value: 'beef', label: 'Beef' },
  { value: 'chicken', label: 'Chicken' },
]

export const VEHICLE_OPTIONS: { value: VehicleType; label: string }[] = [
  { value: 'sedan', label: 'Sedan' },
  { value: 'suv', label: 'SUV' },
  { value: 'van', label: 'Van' },
  { value: 'motorcycle', label: 'Motorcycle' },
  { value: 'other', label: 'Other' },
]

export const NEEDS_TRANSPORT_OPTIONS: { value: NeedsTransportation; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'not_sure', label: 'Not sure yet' },
]

const FOOD_LABEL = Object.fromEntries(FOOD_OPTIONS.map((o) => [o.value, o.label])) as Record<string, string>
const VEHICLE_LABEL = Object.fromEntries(VEHICLE_OPTIONS.map((o) => [o.value, o.label])) as Record<string, string>
const NEEDS_LABEL = Object.fromEntries(NEEDS_TRANSPORT_OPTIONS.map((o) => [o.value, o.label])) as Record<string, string>

export const foodLabel = (v: string) => FOOD_LABEL[v] ?? v
export const vehicleLabel = (v: string | null | undefined) => (v ? (VEHICLE_LABEL[v] ?? v) : '—')
export const needsTransportLabel = (v: string | null | undefined) => (v ? (NEEDS_LABEL[v] ?? v) : '—')

export const attendanceLabel = (s: RSVPStatus | AttendanceStatus): string =>
  s === 'attending' ? 'Attending' : s === 'declining' ? 'Declining' : 'Pending'

export const guestStatusLabel = (s: GuestStatus): string =>
  s === 'approved' ? 'Approved' : s === 'declined' ? 'Declined' : 'Pending'

/** "Saturday, December 19, 2026" style date from an ISO YYYY-MM-DD string. */
export function formatWeddingDate(isoDate: string, style: 'long' | 'full' = 'long'): string {
  const d = parseISODate(isoDate)
  if (!d) return isoDate
  return d.toLocaleDateString('en-US', {
    weekday: style === 'full' ? 'long' : undefined,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/** "12 · 19 · 2026" */
export function formatDotDate(isoDate: string): string {
  const d = parseISODate(isoDate)
  if (!d) return isoDate
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm} · ${dd} · ${d.getFullYear()}`
}

/** Parses YYYY-MM-DD as a local date (avoids the UTC off-by-one-day issue). */
export function parseISODate(isoDate: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate ?? '')
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** "Table 5" for plain numbers, otherwise the value as typed ("VIP", "Table 10"). */
export function formatTable(tableNumber: string | null | undefined): string {
  const t = (tableNumber ?? '').trim()
  if (!t) return 'To be assigned'
  return /^\d+$/.test(t) ? `Table ${t}` : t
}

export function transportationSummary(hasTransportation: boolean | null, needs: string | null, vehicle: string | null): string {
  if (hasTransportation === null) return '—'
  if (hasTransportation) return `Own vehicle${vehicle ? ` (${vehicleLabel(vehicle)})` : ''}`
  if (needs === 'yes') return 'Needs transportation'
  if (needs === 'not_sure') return 'Not sure yet'
  return 'No vehicle, no assistance needed'
}

export function daysUntil(isoDate: string): number | null {
  const d = parseISODate(isoDate)
  if (!d) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86_400_000)
}

/** "Mir & Ella" → "M & E". Returns '' when the names can't be split. */
export function monogram(names: string, separator = ' & '): string {
  const parts = names.split(/\s*&\s*|\s+and\s+/i).map((p) => p.trim()).filter(Boolean)
  if (parts.length === 2) return `${parts[0][0]}${separator}${parts[1][0]}`
  return names.trim().slice(0, 1)
}

const MANILA = 'Asia/Manila'

/** "Sunday, November 15, 2026" in Philippine time. */
export function formatDeadlineDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { timeZone: MANILA, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

/** "November 15, 2026, 11:59 PM" in Philippine time. */
/** "11:59 PM" in Manila time. */
export function formatDeadlineTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { timeZone: MANILA, hour: 'numeric', minute: '2-digit' })
}

export function formatDeadlineDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { timeZone: MANILA, month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** ISO instant → { date: 'YYYY-MM-DD', time: 'HH:MM' } as seen in Manila. */
export function toManilaParts(iso: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` }
}

/** Manila date + time → ISO instant (Philippines has no daylight saving: always +08:00). */
export function fromManilaParts(date: string, time: string): string {
  return new Date(`${date}T${time || '23:59'}:00+08:00`).toISOString()
}
