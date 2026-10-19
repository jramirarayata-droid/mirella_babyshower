import type { InvitationWithRSVP } from '../types/rsvp'
import {
  attendanceLabel,
  foodLabel,
  guestStatusLabel,
  needsTransportLabel,
  vehicleLabel,
} from './formatting'
import { includedGuests, requestedGuests } from './guests'
import { formatPhMobile } from './validation'
import type { RsvpQuestion } from '../types/questions'
import { formatCustomAnswer } from './questions'

const HEADERS = [
  'Invitee Name',
  'Table',
  'Attendance',
  'Recorded By',
  'Mobile Number',
  'Transportation',
  'Needs Transportation',
  'Vehicle Type',
  'Coming From',
  'Food Preferences',
  'Food Restrictions',
  'Accessibility Needs',
  'Included Guests (added by couple)',
  'Additional Guest',
  'Additional Guest Names',
  'Guest Status',
  'Message to the Couple',
  'Submitted Date',
  'Updated Date',
] as const

/** Quotes a CSV cell and neutralises spreadsheet formula injection (=, +, -, @). */
function cell(value: string | number | boolean | null | undefined): string {
  let s = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

function iso(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Builds the RSVP CSV from admin data that was loaded under RLS. */
export function buildRSVPCsv(invitations: InvitationWithRSVP[], questions: RsvpQuestion[] = []): string {
  const lines = [[...HEADERS, ...questions.map((q) => q.question)].map(cell).join(',')]
  for (const inv of invitations) {
    const r = inv.response
    const attending = r?.attendanceStatus === 'attending'
    const guests = requestedGuests(inv)
    const included = includedGuests(inv)
    lines.push(
      [
        inv.inviteeName,
        inv.tableNumber ?? '',
        attendanceLabel(inv.status),
        r ? (r.recordedByAdmin ? 'Couple (on their behalf)' : 'Guest (online)') : '',
        r?.mobileNumber ? formatPhMobile(r.mobileNumber) : '',
        attending && r?.hasTransportation !== null ? (r?.hasTransportation ? 'Own vehicle' : 'No own vehicle') : '',
        attending && r?.hasTransportation === false ? needsTransportLabel(r.needsTransportation) : '',
        attending && r?.hasTransportation ? vehicleLabel(r.vehicleType) : '',
        attending ? (r?.comingFrom ?? '') : '',
        attending ? (r?.foodPreferences ?? []).map(foodLabel).join('; ') : '',
        attending && r?.hasFoodRestrictions !== null ? (r?.hasFoodRestrictions ? (r.foodRestrictions ?? 'Yes') : 'None') : '',
        attending ? (r?.accessibilityNeeds ?? '') : '',
        included.map((g) => g.guestName).join('; '),
        r ? (guests.length > 0 ? 'Yes' : 'No') : '',
        guests.map((g) => g.guestName).join('; '),
        guests.map((g) => `${g.guestName}: ${guestStatusLabel(g.status)}`).join('; '),
        attending ? (r?.messageToCouple ?? '') : '',
        iso(r?.submittedAt),
        iso(r?.updatedAt),
        ...questions.map((q) => formatCustomAnswer(q, r?.customAnswers[q.id])),
      ]
        .map(cell)
        .join(','),
    )
  }
  // Excel-friendly: BOM + CRLF line endings.
  return '﻿' + lines.join('\r\n')
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
