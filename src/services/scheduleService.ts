import { getAdminPreference, saveAdminPreference } from './preferencesService'
import { getDisplayPrefs } from './displayPrefsService'

/**
 * One "reveal date" the couple sets once. The raffle, Find My Seat and guest
 * photos can each choose "On the reveal date" instead of their own date.
 */
export interface Schedule {
  revealAt: string | null
}

export async function getSchedule(): Promise<Schedule> {
  const v = (await getAdminPreference<Record<string, unknown>>('schedule')) ?? {}
  return { revealAt: typeof v.revealAt === 'string' && v.revealAt ? v.revealAt : null }
}

export async function saveSchedule(s: Schedule): Promise<void> {
  await saveAdminPreference('schedule', { revealAt: s.revealAt })
  void getDisplayPrefs(true)
  window.dispatchEvent(new Event('wedding-schedule'))
}

/** Is a {mode, from} timing showing right now? */
export function timingOn(mode: string, from: string | null, revealAt: string | null, now = Date.now()): boolean {
  if (mode === 'visible') return true
  if (mode === 'scheduled') return Boolean(from) && now >= new Date(from!).getTime()
  if (mode === 'reveal') return Boolean(revealAt) && now >= new Date(revealAt!).getTime()
  return false
}
