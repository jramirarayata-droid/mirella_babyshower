import type { ReactNode } from 'react'
import type { InvitationWithRSVP } from '../../types/rsvp'
import {
  attendanceLabel,
  foodLabel,
  formatDateTime,
  formatTable,
  guestStatusLabel,
  transportationSummary,
} from '../../utils/formatting'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { AttendanceBadge, GuestStatusBadge } from './StatusBadges'
import { Badge } from '../ui/Badge'
import { includedGuests, requestedGuests } from '../../utils/guests'
import { formatPhMobile } from '../../utils/validation'
import { useAllQuestions } from '../../hooks/useAllQuestions'
import { formatCustomAnswer, guestPriceEach } from '../../utils/questions'
import { useWeddingSettings } from '../../hooks/useWeddingSettings'

export function ResponseDetailModal({ invitation, onClose }: { invitation: InvitationWithRSVP | null; onClose: () => void }) {
  const priceEach = guestPriceEach(useWeddingSettings().settings?.rsvpConfig)
  const r = invitation?.response ?? null
  const questions = useAllQuestions()
  const answered = r
    ? [
        ...questions.filter((q) => r.customAnswers[q.id] !== undefined).map((q) => ({ id: q.id, label: q.question, value: formatCustomAnswer(q, r.customAnswers[q.id]) })),
        ...Object.keys(r.customAnswers)
          .filter((id) => !questions.some((q) => q.id === id))
          .map((id) => ({ id, label: 'Deleted question', value: formatCustomAnswer(undefined, r.customAnswers[id]) })),
      ]
    : []
  return (
    <Modal
      open={Boolean(invitation)}
      onClose={onClose}
      title={invitation?.inviteeName ?? ''}
      description={invitation ? `${formatTable(invitation.tableNumber)} · ${attendanceLabel(invitation.status)}` : undefined}
      size="lg"
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {invitation && (
        <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
          <Item label="RSVP">
            <span className="inline-flex flex-wrap items-center gap-1.5">
              <AttendanceBadge status={invitation.status} />
              {r?.recordedByAdmin && <Badge tone="gold">Confirmed by couple</Badge>}
            </span>
          </Item>
          <Item label="Allowed guest requests">{invitation.maxAdditionalGuests}</Item>
          <Item label="Included by the couple" wide>
            {includedGuests(invitation).length ? includedGuests(invitation).map((g) => g.guestName).join(', ') : 'None'}
          </Item>
          {!r && <Item label="Response" wide>This invitation has not responded yet.</Item>}
          {r && (
            <Item label="Mobile number">
              {r.mobileNumber ? (
                <a href={`tel:${r.mobileNumber}`} className="underline-offset-4 hover:underline">
                  {formatPhMobile(r.mobileNumber)}
                </a>
              ) : (
                'Not provided'
              )}
            </Item>
          )}
          {r && r.attendanceStatus === 'attending' && (
            <>
              <Item label="Transportation">
                {r.hasTransportation === null ? 'Not asked' : transportationSummary(r.hasTransportation, r.needsTransportation, r.vehicleType)}
              </Item>
              <Item label="Coming from">{r.comingFrom || '—'}</Item>
              <Item label="Food preferences" wide>
                {r.foodPreferences.length ? r.foodPreferences.map(foodLabel).join(', ') : 'No preference'}
              </Item>
              <Item label="Dietary restrictions" wide>
                {r.hasFoodRestrictions === null ? 'Not asked' : r.hasFoodRestrictions ? r.foodRestrictions : 'None'}
              </Item>
              <Item label="Accessibility needs" wide>
                {r.accessibilityNeeds || 'None'}
              </Item>
              <Item label={`Requested additional guests${priceEach ? ` (${priceEach})` : ''}`} wide>
                {requestedGuests(invitation).length ? (
                  <ul className="space-y-1.5">
                    {requestedGuests(invitation).map((g) => (
                      <li key={g.id} className="flex flex-wrap items-center gap-2">
                        <span>{g.guestName}</span>
                        <GuestStatusBadge status={g.status} />
                        <span className="sr-only">{guestStatusLabel(g.status)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  'None requested'
                )}
              </Item>
              <Item label="Message to the couple" wide>
                {r.messageToCouple ? <span className="font-serif text-lg italic">“{r.messageToCouple}”</span> : 'No message'}
              </Item>
            </>
          )}
          {answered.map((a) => (
            <Item key={a.id} label={a.label} wide>
              {a.value}
            </Item>
          ))}
          {r && (
            <>
              <Item label="Submitted">{formatDateTime(r.submittedAt)}</Item>
              <Item label="Last updated">{formatDateTime(r.updatedAt)}</Item>
            </>
          )}
        </dl>
      )}
    </Modal>
  )
}

function Item({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{label}</dt>
      <dd className="mt-1 whitespace-pre-line break-words text-ink">{children}</dd>
    </div>
  )
}
