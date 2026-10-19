import type { WeddingSettings } from '../types/wedding'
import { siteBaseUrl } from './share'

/** An all-day "Add to Google Calendar" link for the wedding. */
export function calendarUrl(s: Pick<WeddingSettings, 'weddingDate' | 'coupleNames' | 'churchName' | 'ceremonyTime' | 'receptionName' | 'receptionTime'>): string {
  const start = s.weddingDate.replace(/-/g, '')
  const next = new Date(`${s.weddingDate}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  const end = next.toISOString().slice(0, 10).replace(/-/g, '')
  const details = [
    s.churchName && `Ceremony: ${s.churchName}${s.ceremonyTime ? `, ${s.ceremonyTime}` : ''}`,
    s.receptionName && `Reception: ${s.receptionName}${s.receptionTime ? `, ${s.receptionTime}` : ''}`,
    siteBaseUrl(),
  ]
    .filter(Boolean)
    .join('\n')
  const p = new URLSearchParams({ action: 'TEMPLATE', text: `${s.coupleNames} — wedding`, dates: `${start}/${end}`, details, location: s.churchName })
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}
