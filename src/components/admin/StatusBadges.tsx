import type { GuestStatus, RSVPStatus } from '../../types/rsvp'
import { attendanceLabel, guestStatusLabel } from '../../utils/formatting'
import { Badge } from '../ui/Badge'

export function AttendanceBadge({ status }: { status: RSVPStatus }) {
  const tone = status === 'attending' ? 'green' : status === 'declining' ? 'rose' : 'gray'
  return <Badge tone={tone}>{attendanceLabel(status)}</Badge>
}

export function GuestStatusBadge({ status }: { status: GuestStatus }) {
  const tone = status === 'approved' ? 'green' : status === 'declined' ? 'rose' : 'gold'
  return <Badge tone={tone}>{guestStatusLabel(status)}</Badge>
}
