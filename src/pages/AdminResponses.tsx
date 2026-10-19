import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Eye, Trash2 } from 'lucide-react'
import { useAdminData } from '../hooks/useAdminData'
import { useToast } from '../hooks/useToast'
import { deleteResponse } from '../services/adminService'
import type { InvitationWithRSVP, RSVPStatus } from '../types/rsvp'
import { toFriendlyMessage } from '../utils/errors'
import { foodLabel, formatDateTime, transportationSummary } from '../utils/formatting'
import { formatPhMobile, normalizeName } from '../utils/validation'
import { includedGuests, requestedGuests } from '../utils/guests'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { ResponsiveTable, type Column } from '../components/ui/ResponsiveTable'
import { TableSkeleton } from '../components/ui/Skeleton'
import { ResponseDetailModal } from '../components/admin/ResponseDetailModal'
import { Badge } from '../components/ui/Badge'
import { AttendanceBadge } from '../components/admin/StatusBadges'
import { PageHeader, Panel } from '../components/admin/PageHeader'
import { FilterTabs, SearchInput } from '../components/admin/FilterTabs'

type Filter = 'all' | RSVPStatus

const clip = (s: string | null | undefined, n = 60) => (!s ? '—' : s.length > n ? `${s.slice(0, n)}…` : s)

export default function AdminResponses() {
  const { data, loading, error, reload } = useAdminData()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [toDelete, setToDelete] = useState<InvitationWithRSVP | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [viewingId, setViewingId] = useState<string | null>(null)

  const filter = (['all', 'attending', 'declining', 'pending'].includes(params.get('status') ?? '') ? params.get('status') : 'all') as Filter

  useEffect(() => {
    document.title = 'Responses · Wedding admin'
  }, [])

  const list = useMemo(() => data?.invitations ?? [], [data])
  const counts = useMemo(
    () => ({
      all: list.length,
      attending: list.filter((i) => i.status === 'attending').length,
      declining: list.filter((i) => i.status === 'declining').length,
      pending: list.filter((i) => i.status === 'pending').length,
    }),
    [list],
  )

  const rows = useMemo(() => {
    const q = normalizeName(query)
    return list
      .filter((i) => filter === 'all' || i.status === filter)
      .filter((i) => !q || normalizeName(i.inviteeName).includes(q))
      .sort((a, b) => (b.response?.updatedAt ?? '').localeCompare(a.response?.updatedAt ?? '') || a.inviteeName.localeCompare(b.inviteeName))
  }, [list, filter, query])

  const viewing = list.find((i) => i.id === viewingId) ?? null

  const setFilter = (f: Filter) => {
    const next = new URLSearchParams(params)
    if (f === 'all') next.delete('status')
    else next.set('status', f)
    setParams(next, { replace: true })
  }

  const confirmDelete = async () => {
    if (!toDelete?.response) return
    setDeleting(true)
    try {
      await deleteResponse(toDelete.response.id)
      toast.success(`${toDelete.inviteeName}'s response was deleted. The invitation is Pending again.`)
      setToDelete(null)
      await reload()
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setDeleting(false)
    }
  }

  const actions = (r: InvitationWithRSVP) => (
    <div className="flex flex-wrap gap-1.5">
      <Button size="sm" variant="subtle" onClick={() => setViewingId(r.id)} icon={<Eye aria-hidden="true" className="size-3.5" />} aria-label={`View response from ${r.inviteeName}`}>
        View
      </Button>
      {r.response && (
        <Button
          size="sm"
          variant="danger-quiet"
          onClick={() => setToDelete(r)}
          icon={<Trash2 aria-hidden="true" className="size-3.5" />}
          aria-label={`Delete response from ${r.inviteeName}`}
        >
          Delete
        </Button>
      )}
    </div>
  )

  const attendingOnly = (r: InvitationWithRSVP, value: string) => (r.response?.attendanceStatus === 'attending' ? value : '—')

  const columns: Column<InvitationWithRSVP>[] = [
    { key: 'name', header: 'Invitee', cell: (r) => <span className="font-medium text-ink">{r.inviteeName}</span>, hideOnMobile: true },
    {
      key: 'status',
      header: 'Attendance',
      cell: (r) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <AttendanceBadge status={r.status} />
          {r.response?.recordedByAdmin && <Badge tone="gold">Confirmed by couple</Badge>}
        </span>
      ),
    },
    { key: 'table', header: 'Table', cell: (r) => r.tableNumber || '—' },
    {
      key: 'mobile',
      header: 'Mobile',
      className: 'whitespace-nowrap',
      cell: (r) =>
        r.response?.mobileNumber ? (
          <a href={`tel:${r.response.mobileNumber}`} className="text-ink underline-offset-4 hover:underline">
            {formatPhMobile(r.response.mobileNumber)}
          </a>
        ) : (
          '—'
        ),
    },
    {
      key: 'transport',
      header: 'Transportation',
      cell: (r) => attendingOnly(r, transportationSummary(r.response?.hasTransportation ?? null, r.response?.needsTransportation ?? null, r.response?.vehicleType ?? null)),
    },
    { key: 'from', header: 'Coming From', cell: (r) => attendingOnly(r, clip(r.response?.comingFrom, 40)) },
    { key: 'food', header: 'Food Preferences', cell: (r) => attendingOnly(r, (r.response?.foodPreferences ?? []).map(foodLabel).join(', ') || 'None') },
    { key: 'diet', header: 'Dietary Restrictions', cell: (r) => attendingOnly(r, r.response?.hasFoodRestrictions ? clip(r.response.foodRestrictions, 40) : 'None') },
    { key: 'access', header: 'Accessibility', cell: (r) => attendingOnly(r, clip(r.response?.accessibilityNeeds, 40) === '—' ? 'None' : clip(r.response?.accessibilityNeeds, 40)) },
    {
      key: 'guests',
      header: 'Additional Guest',
      cell: (r) => {
        const inc = includedGuests(r)
        const req = requestedGuests(r)
        if (!inc.length && !req.length) return r.response ? 'None' : '—'
        return (
          <div className="space-y-0.5">
            {inc.length > 0 && (
              <p>
                {inc.map((g) => g.guestName).join(', ')} <span className="text-xs text-muted">(included)</span>
              </p>
            )}
            {req.length > 0 && (
              <p>
                {req.map((g) => g.guestName).join(', ')} <span className="text-xs text-muted">(requested)</span>
              </p>
            )}
          </div>
        )
      },
    },
    { key: 'message', header: 'Message', cell: (r) => attendingOnly(r, clip(r.response?.messageToCouple, 60) === '—' ? 'None' : clip(r.response?.messageToCouple, 60)) },
    { key: 'submitted', header: 'Submitted', cell: (r) => formatDateTime(r.response?.submittedAt), className: 'whitespace-nowrap' },
    { key: 'updated', header: 'Updated', cell: (r) => formatDateTime(r.response?.updatedAt), className: 'whitespace-nowrap' },
    { key: 'actions', header: 'Actions', cell: actions, hideOnMobile: true },
  ]

  return (
    <>
      <PageHeader title="Responses" description="Every invitation and its current RSVP." />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterTabs
          label="Filter by attendance"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'attending', label: 'Attending', count: counts.attending },
            { value: 'declining', label: 'Declining', count: counts.declining },
            { value: 'pending', label: 'Pending', count: counts.pending },
          ]}
        />
        <SearchInput label="Search responses by invitee name" placeholder="Search by name…" value={query} onChange={setQuery} />
      </div>
      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-rose/30 bg-rose/5 px-4 py-3 text-sm text-rose">
          {error}
        </p>
      )}
      <Panel>
        {loading && !data ? (
          <TableSkeleton />
        ) : (
          <ResponsiveTable
            caption="RSVP responses"
            rows={rows}
            columns={columns}
            rowKey={(r) => r.id}
            mobileTitle={(r) => r.inviteeName}
            mobileActions={actions}
            empty="No responses match this filter."
          />
        )}
      </Panel>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this response?"
        message={
          <>
            <p className="font-medium text-ink">{toDelete?.inviteeName}</p>
            <p className="mt-2">
              The RSVP and any additional guest requests will be removed. The invitation stays and becomes <strong>Pending</strong> again, so the guest
              can respond anew.
            </p>
          </>
        }
        destructive
        confirmLabel="Delete response"
        loading={deleting}
        loadingText="Deleting…"
        onCancel={() => !deleting && setToDelete(null)}
        onConfirm={confirmDelete}
      />

      <ResponseDetailModal invitation={viewing} onClose={() => setViewingId(null)} />
    </>
  )
}
