import type { ProgramItem, WeddingSettings } from '../types/wedding'
import type { SeatSearchResult } from '../services/seatingService'

/**
 * Small copies kept on the guest's own phone so Find My Seat still works at
 * the venue without signal. Only public wedding details and the guest's OWN
 * seat are kept — never anyone else's data, and never anything from the admin.
 */

const SEAT_KEY = 'wedding-my-seat'
const SETTINGS_KEY = 'wedding-settings-offline'

export interface SavedSeat {
  result: SeatSearchResult
  savedAt: string
}

const read = <T,>(k: string): T | null => {
  try {
    const raw = localStorage.getItem(k)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* storage full or blocked — the site still works online */
  }
}

/** Keep the guest's seat once they have a table (seated, or a table saved for them). */
export function saveMySeat(r: SeatSearchResult) {
  if ((r.status === 'seated' || r.status === 'unseated') && r.tableName) write(SEAT_KEY, { result: r, savedAt: new Date().toISOString() } satisfies SavedSeat)
}
export const savedSeat = () => read<SavedSeat>(SEAT_KEY)

export const isAdminPage = () => typeof window !== 'undefined' && /^#\/admin/.test(window.location.hash)

/** Public wedding details for the guest pages when there's no connection (never used in the admin). */
export function saveSettingsCopy(s: WeddingSettings) {
  if (!isAdminPage()) write(SETTINGS_KEY, s)
}
export const settingsCopy = () => (isAdminPage() ? null : read<WeddingSettings>(SETTINGS_KEY))

const PROGRAM_KEY = 'wedding-program-offline'

/** The public program (only what guests can already see), for the venue without signal. */
export function saveProgramCopy(items: ProgramItem[]) {
  if (!isAdminPage()) write(PROGRAM_KEY, items)
}
export const programCopy = () => (isAdminPage() ? null : read<ProgramItem[]>(PROGRAM_KEY))
