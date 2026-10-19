import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, CalendarHeart, CheckCircle2, Clock, Download, Mail, RefreshCw, UserPlus, Users, XCircle } from 'lucide-react'
import { useAdminData } from '../hooks/useAdminData'
import { useToast } from '../hooks/useToast'
import { computeAnalytics } from '../services/analyticsService'
import { listRecentActivity } from '../services/adminService'
import type { ActivityLog } from '../types/rsvp'
import { buildRSVPCsv, downloadCsv } from '../utils/csvExport'
import { formatDateTime, formatDeadlineDateTime } from '../utils/formatting'
import { Link } from 'react-router-dom'
import { useWeddingSettings } from '../hooks/useWeddingSettings'
import { useAllQuestions } from '../hooks/useAllQuestions'
import { attendingPeople } from '../utils/seatingPeople'
import { isRsvpOpen } from '../services/settingsService'
import { cn } from '../components/ui/cn'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { StatCard } from '../components/admin/StatCard'
import { BarChartCard } from '../components/admin/BarChartCard'
import { PageHeader, Panel } from '../components/admin/PageHeader'
import { PlanSummary } from '../components/space/PlanSummary'

const ACTION_LABEL: Record<string, string> = {
  invitation_created: 'Invitation created',
  invitation_updated: 'Invitation updated',
  invitation_deleted: 'Invitation deleted',
  rsvp_deleted: 'RSVP deleted',
  guest_status_changed: 'Guest status changed',
  settings_updated: 'Website settings changed',
  gift_settings_updated: 'Gift settings changed',
  gallery_photo_added: 'Gallery photo added',
  gallery_photo_removed: 'Gallery photo removed',
  included_guests_updated: 'Included guests updated',
  invitations_combined: 'Invitations combined',
  guest_separated: 'Included guest given own invitation',
  outfit_image_added: 'Outfit image added',
  outfit_image_removed: 'Outfit image removed',
  rsvp_exported: 'RSVP data exported',
  question_added: 'RSVP question added',
  question_updated: 'RSVP question changed',
  question_deleted: 'RSVP question deleted',
}

export default function AdminDashboard() {
  const { data, loading, error, reload } = useAdminData()
  const toast = useToast()
  const [activity, setActivity] = useState<ActivityLog[] | null>(null)

  useEffect(() => {
    document.title = 'Dashboard · Baby shower admin'
  }, [])

  useEffect(() => {
    if (!data) return
    let active = true
    listRecentActivity(8).then((a) => active && setActivity(a))
    return () => {
      active = false
    }
  }, [data])

  const { settings } = useWeddingSettings()
  const questions = useAllQuestions()
  const questionStats = useMemo(() => {
    const rows = (data?.invitations ?? []).filter((i) => i.response).map((i) => ({ name: i.inviteeName, r: i.response! }))
    return questions.map((q): QuestionStat => {
      const answers = rows.map(({ name, r }) => ({ name, at: r.updatedAt, a: r.customAnswers[q.id] })).filter((x) => x.a !== undefined && x.a !== null && x.a !== '')
      const note = `${answers.length} ${answers.length === 1 ? 'answer' : 'answers'}${q.isActive ? '' : ' · question hidden'}`
      if (q.type === 'single' || q.type === 'multiple' || q.type === 'yes_no') {
        const labels = q.type === 'yes_no' ? ['yes', 'no'] : q.options
        const counts = new Map(labels.map((l) => [l, 0]))
        for (const { a } of answers) for (const v of Array.isArray(a) ? a : [a]) if (typeof v === 'string' && counts.has(v)) counts.set(v, (counts.get(v) ?? 0) + 1)
        return {
          kind: 'chart',
          id: q.id,
          title: q.question,
          note: q.type === 'multiple' ? `${note} · guests could pick more than one` : note,
          data: labels.map((l) => ({ label: q.type === 'yes_no' ? (l === 'yes' ? 'Yes' : 'No') : l, value: counts.get(l) ?? 0 })),
        }
      }
      if (q.type === 'number') {
        const nums = answers.map((x) => Number(x.a)).filter((n) => Number.isFinite(n))
        const total = nums.reduce((t, n) => t + n, 0)
        return {
          kind: 'number',
          id: q.id,
          title: q.question,
          note,
          total,
          average: nums.length ? total / nums.length : 0,
          min: nums.length ? Math.min(...nums) : 0,
          max: nums.length ? Math.max(...nums) : 0,
        }
      }
      return {
        kind: 'text',
        id: q.id,
        title: q.question,
        note,
        answers: answers.map((x) => ({ name: x.name, text: String(x.a), at: x.at })).sort((a, b) => b.at.localeCompare(a.at)),
      }
    })
  }, [data, questions])
  const rsvpOpen = settings ? isRsvpOpen(settings) : true
  const stats = useMemo(() => (data ? computeAnalytics(data.invitations, data.guests) : null), [data])
  const messages = useMemo(
    () =>
      (data?.invitations ?? [])
        .filter((i) => i.response?.attendanceStatus === 'attending' && i.response.messageToCouple)
        .map((i) => ({ id: i.id, name: i.inviteeName, message: i.response!.messageToCouple!, at: i.response!.updatedAt }))
        .sort((a, b) => b.at.localeCompare(a.at)),
    [data],
  )

  const unseatedCount = useMemo(() => {
    if (!data || !data.tables.some((t) => t.placed)) return 0
    return attendingPeople(data.invitations).filter((p) => !data.seatedKeys.has(`${p.invitationId}:${p.guestId ?? ''}`)).length
  }, [data])

  const exportCsv = () => {
    if (!data) return
    const date = new Date().toISOString().slice(0, 10)
    downloadCsv(`mir-ella-rsvp-${date}.csv`, buildRSVPCsv(data.invitations, questions))
    toast.success('RSVP data exported.')
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Live overview of invitations and RSVPs."
        actions={
          <>
            <Button variant="subtle" onClick={() => void reload()} disabled={loading} icon={<RefreshCw aria-hidden="true" className={loading ? 'size-4 animate-spin' : 'size-4'} />}>
              Refresh
            </Button>
            <Button onClick={exportCsv} disabled={!data || loading} icon={<Download aria-hidden="true" className="size-4" />}>
              Export RSVP Data
            </Button>
          </>
        }
      />

      <PlanSummary />

      {settings && (
        <Link
          to="/admin/settings"
          className={cn(
            'mb-6 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm transition hover:shadow-soft',
            rsvpOpen ? 'border-sage/30 bg-sage/5 text-ink-soft' : 'border-rose/30 bg-rose/5 text-rose',
          )}
        >
          <span className="flex items-center gap-2">
            <CalendarClock aria-hidden="true" className="size-4 shrink-0" />
            {rsvpOpen
              ? settings.rsvpDeadline
                ? `RSVPs are open until ${formatDeadlineDateTime(settings.rsvpDeadline)} (PH time).`
                : 'RSVPs are open — no deadline set.'
              : 'RSVPs are closed. Guests can no longer respond.'}
          </span>
          <span className="shrink-0 text-xs font-medium uppercase tracking-[0.14em]">{rsvpOpen ? 'Set deadline' : 'Reopen'}</span>
        </Link>
      )}

      {unseatedCount > 0 && (
        <Link
          to="/admin/seating"
          className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-gold/40 bg-champagne-light/25 px-4 py-3 text-sm text-ink-soft transition hover:shadow-soft"
        >
          <span>
            <strong className="font-medium text-ink">{unseatedCount}</strong> attending {unseatedCount === 1 ? 'guest is' : 'guests are'} not yet seated.
          </span>
          <span className="shrink-0 text-xs font-medium uppercase tracking-[0.14em]">Open seating</span>
        </Link>
      )}

      {error && (
        <p role="alert" className="mb-6 rounded-lg border border-rose/30 bg-rose/5 px-4 py-3 text-sm text-rose">
          {error}
        </p>
      )}

      {!stats ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" role="status" aria-label="Loading dashboard">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
          <Skeleton className="col-span-full h-72" />
        </div>
      ) : (
        <div className="space-y-8">
          <section aria-label="RSVP summary" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <StatCard label="Total Invitations" value={stats.totalInvitations} icon={<Mail className="size-5" />} hint={`${stats.activeInvitations} active`} />
            <StatCard label="Attending" value={stats.attending} icon={<CheckCircle2 className="size-5" />} hint={`${stats.responseRate}% responded`} />
            <StatCard label="Declining" value={stats.declining} icon={<XCircle className="size-5" />} />
            <StatCard label="Pending" value={stats.pending} icon={<Clock className="size-5" />} hint="No response yet" />
            <StatCard label="Additional Guest Requests" value={stats.pendingGuestRequests} icon={<UserPlus className="size-5" />} hint="Awaiting approval" />
          </section>

          <section aria-labelledby="headcount-heading">
            <h2 id="headcount-heading" className="mb-3 font-sans text-sm font-semibold uppercase tracking-[0.14em] text-muted">
              Headcount for catering
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                label="Invited Guests"
                value={stats.invitedGuests}
                icon={<Users className="size-5" />}
                hint={`${stats.invitedGuests - stats.includedGuests} invitees + ${stats.includedGuests} included guests`}
              />
              <StatCard
                emphasis
                label="Expected Attendees"
                value={stats.expectedAttendees}
                icon={<CalendarHeart className="size-5" />}
                hint={`${stats.attending} attending invitees + ${stats.expectedAttendees - stats.attending} of their confirmed guests`}
              />
              <StatCard label="Pending Additional Guest Requests" value={stats.pendingGuestRequests} icon={<Clock className="size-5" />} hint="Not counted until approved" />
            </div>
          </section>

          <section aria-label="Charts" className="grid gap-4 lg:grid-cols-2">
            <BarChartCard
              title="Attendance"
              description="All invitations"
              data={[
                { label: 'Attending', value: stats.attending },
                { label: 'Declining', value: stats.declining },
                { label: 'Pending', value: stats.pending },
              ]}
              emptyText="No invitations yet."
            />
            <BarChartCard
              title="Transportation"
              description="Attending guests"
              data={[
                { label: 'Own vehicle', value: stats.transportation.ownVehicle },
                { label: 'Need transport', value: stats.transportation.needTransport },
                { label: 'Not sure yet', value: stats.transportation.notSure },
              ]}
            />
            <BarChartCard
              title="Food preferences"
              description="Selections across attending RSVPs"
              data={[...stats.food].sort((a, b) => b.count - a.count).map((f) => ({ label: f.label, value: f.count }))}
            />
            <div className="grid gap-4">
              <BarChartCard
                title="Dietary restrictions"
                description="Attending guests"
                data={[
                  { label: 'No restrictions', value: stats.dietary.none },
                  { label: 'Has restrictions', value: stats.dietary.has },
                ]}
              />
              <BarChartCard
                title="Extra guest requests"
                description="By status"
                data={[
                  { label: 'Pending', value: stats.pendingGuestRequests },
                  { label: 'Approved', value: stats.approvedGuests },
                  { label: 'Declined', value: stats.declinedGuests },
                ]}
                emptyText="No additional guest requests yet."
              />
            </div>
          </section>

          {questionStats.length > 0 && (
            <section aria-labelledby="custom-q-heading">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="custom-q-heading" className="font-sans text-sm font-semibold uppercase tracking-[0.14em] text-muted">
                  Your RSVP questions
                </h2>
                <Link to="/admin/questions" className="text-xs font-medium text-ink-soft underline-offset-4 hover:underline">
                  Manage questions
                </Link>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {questionStats.map((q) =>
                  q.kind === 'chart' ? (
                    <BarChartCard key={q.id} title={q.title} description={q.note} data={q.data} />
                  ) : q.kind === 'number' ? (
                    <NumberStatCard key={q.id} stat={q} />
                  ) : (
                    <TextAnswersCard key={q.id} stat={q} />
                  ),
                )}
              </div>
            </section>
          )}

          <section aria-labelledby="messages-heading">
            <h2 id="messages-heading" className="mb-3 font-sans text-sm font-semibold uppercase tracking-[0.14em] text-muted">
              Wishes for the baby
            </h2>
            <Panel>
              {messages.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted">No wishes yet. They’ll appear here as guests RSVP.</p>
              ) : (
                <ul className="grid gap-px bg-line/60 sm:grid-cols-2">
                  {messages.map((m) => (
                    <li key={m.id} className="bg-paper px-5 py-4">
                      <p className="font-serif text-lg italic leading-snug text-ink">“{m.message}”</p>
                      <p className="mt-2 text-xs text-muted">
                        — {m.name} · {formatDateTime(m.at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </section>

          <section aria-labelledby="activity-heading">
            <h2 id="activity-heading" className="mb-3 font-sans text-sm font-semibold uppercase tracking-[0.14em] text-muted">
              Recent admin activity
            </h2>
            <Panel>
              {activity === null ? (
                <div className="space-y-2 p-4">
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                </div>
              ) : activity.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted">No admin activity recorded yet.</p>
              ) : (
                <ul className="divide-y divide-line/70">
                  {activity.map((a) => (
                    <li key={a.id} className="flex flex-col gap-0.5 px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-ink">
                        {ACTION_LABEL[a.action] ?? a.action}
                        {describe(a) && <span className="text-muted"> · {describe(a)}</span>}
                      </span>
                      <span className="text-xs text-muted">{formatDateTime(a.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </section>
        </div>
      )}
    </>
  )
}

function describe(a: ActivityLog): string {
  const d = a.details
  if (typeof d.invitee_name === 'string') return d.invitee_name
  if (typeof d.guest_name === 'string') return `${d.guest_name}: ${String(d.from)} → ${String(d.to)}`
  if (Array.isArray(d.included_guests)) return (d.included_guests as string[]).join(', ') || 'none'
  if (typeof d.caption === 'string') return d.caption
  const after = d.after as Record<string, unknown> | undefined
  if (after && typeof after.invitee_name === 'string') return after.invitee_name
  if (Array.isArray(d.changed_fields)) return (d.changed_fields as string[]).join(', ').replace(/_/g, ' ')
  return ''
}

type QuestionStat =
  | { kind: 'chart'; id: string; title: string; note: string; data: { label: string; value: number }[] }
  | { kind: 'number'; id: string; title: string; note: string; total: number; average: number; min: number; max: number }
  | { kind: 'text'; id: string; title: string; note: string; answers: { name: string; text: string; at: string }[] }

const fmtNum = (n: number) => n.toLocaleString('en-PH', { maximumFractionDigits: 1 })

function NumberStatCard({ stat }: { stat: Extract<QuestionStat, { kind: 'number' }> }) {
  const items = [
    { label: 'Total', value: stat.total },
    { label: 'Average', value: stat.average },
    { label: 'Lowest', value: stat.min },
    { label: 'Highest', value: stat.max },
  ]
  return (
    <figure className="rounded-xl border border-line bg-paper p-5 shadow-soft">
      <figcaption>
        <h3 className="font-sans text-sm font-semibold text-ink">{stat.title}</h3>
        <p className="mt-0.5 text-xs text-muted">{stat.note}</p>
      </figcaption>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((i) => (
          <div key={i.label} className="rounded-lg bg-ivory/70 px-3 py-3">
            <dt className="text-xs text-muted">{i.label}</dt>
            <dd className="mt-1 font-serif text-2xl text-ink tabular-nums">{fmtNum(i.value)}</dd>
          </div>
        ))}
      </dl>
    </figure>
  )
}

function TextAnswersCard({ stat }: { stat: Extract<QuestionStat, { kind: 'text' }> }) {
  const [all, setAll] = useState(false)
  const shown = all ? stat.answers : stat.answers.slice(0, 5)
  return (
    <figure className="rounded-xl border border-line bg-paper p-5 shadow-soft">
      <figcaption>
        <h3 className="font-sans text-sm font-semibold text-ink">{stat.title}</h3>
        <p className="mt-0.5 text-xs text-muted">{stat.note}</p>
      </figcaption>
      {stat.answers.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No answers yet.</p>
      ) : (
        <ul className="mt-4 max-h-80 space-y-2.5 overflow-y-auto">
          {shown.map((a, i) => (
            <li key={i} className="rounded-lg bg-ivory/70 px-3 py-2.5 text-sm">
              <p className="whitespace-pre-line break-words text-ink">{a.text}</p>
              <p className="mt-1 text-xs text-muted">{a.name}</p>
            </li>
          ))}
        </ul>
      )}
      {stat.answers.length > 5 && (
        <button type="button" onClick={() => setAll(!all)} className="mt-3 text-xs font-medium text-ink-soft underline-offset-4 hover:underline">
          {all ? 'Show fewer' : `Show all ${stat.answers.length}`}
        </button>
      )}
    </figure>
  )
}
