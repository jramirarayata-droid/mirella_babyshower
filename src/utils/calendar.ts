import type { WeddingSettings } from '../types/wedding'
import { siteBaseUrl } from './share'

/** An all-day "Add to Google Calendar" link for the baby shower. */
export function calendarUrl(s: Pick<WeddingSettings, 'weddingDate' | 'coupleNames' | 'babyName' | 'churchName' | 'ceremonyTime'>): string {
  const start = s.weddingDate.replace(/-/g, '')
  const next = new Date(`${s.weddingDate}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  const end = next.toISOString().slice(0, 10).replace(/-/g, '')
  const details = [
    s.coupleNames && `Hosted by ${s.coupleNames}`,
    s.churchName && `Venue: ${s.churchName}${s.ceremonyTime ? `, ${s.ceremonyTime}` : ''}`,
    siteBaseUrl(),
  ]
    .filter(Boolean)
    .join('\n')
  const p = new URLSearchParams({ action: 'TEMPLATE', text: `${s.babyName} — baby shower`, dates: `${start}/${end}`, details, location: s.churchName })
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}
