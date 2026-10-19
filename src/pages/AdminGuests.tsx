import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAdminData } from '../hooks/useAdminData'
import { useToast } from '../hooks/useToast'
import { updateGuestStatus } from '../services/adminService'
import type { GuestSource, GuestStatus, GuestWithInvitation } from '../types/rsvp'
import { toFriendlyMessage } from '../utils/errors'
import { formatShortDate, formatTable } from '../utils/formatting'
import { normalizeName } from '../utils/validation'
import { ResponsiveTable, type Column } from '../components/ui/ResponsiveTable'
import { TableSkeleton } from '../components/ui/Skeleton'
import { Spinner } from '../components/ui/Spinner'
import { GuestStatusBadge } from '../components/admin/StatusBadges'
import { Badge } from '../components/ui/Badge'
import { guestSourceLabel } from '../utils/guests'
import { useWeddingSettings } from '../hooks/useWeddingSettings'
import { guestPriceEach } from '../utils/questions'
import { PageHeader, Panel } from '../components/admin/PageHeader'
import { FilterTabs, SearchInput } from '../components/admin/FilterTabs'

type Filter = 'all' | GuestStatus

export default function AdminGuests() {
  const { data, loading, error, reload } = useAdminData()
  const toast = useToast()
  const priceEach = guestPriceEach(useWeddingSettings().settings?.rsvpConfig)
  const [filter, setFilter] = useState<Filter>('all')
  const [source, setSource] = useState<'all' | GuestSource>('all')
  const location = useLocation()
  const handedQuery = (location.state as { q?: string } | null)?.q
  const [query, setQuery] = useState(handedQuery ?? '')
  // Quick search (Ctrl+K) opens this page with a name to look for.
  useEffect(() => {
    if (handedQuery) setQuery(handedQuery)
  }, [location.key, handedQuery])
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Extra guests · Wedding admin'
  }, [])

  const list = useMemo(() => data?.guests ?? [], [data])
  const count = (s: GuestStatus) => list.filter((g) => g.status === s).length

  const rows = useMemo(() => {
    const q = normalizeName(query)
    return list
      .filter((g) => filter === 'all' || g.status === filter)
      .filter((g) => source === 'all' || g.addedBy === source)
      .filter((g) => !q || normalizeName(g.guestName).includes(q) || normalizeName(g.invitedBy).includes(q))
  }, [list, filter, source, query])

  const changeStatus = async (guest: GuestWithInvitation, status: GuestStatus) => {
    if (guest.status === status) return
    setSavingId(guest.id)
    try {
      await updateGuestStatus(guest.id, status)
      toast.success(`${guest.guestName} marked as ${status}.`)
      await reload()
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setSavingId(null)
    }
  }

  const statusControl = (g: GuestWithInvitation) => (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor={`status-${g.id}`}>
        Status for {g.guestName}
      </label>
      <select
        id={`status-${g.id}`}
        value={g.status}
        disabled={savingId === g.id}
        onChange={(e) => void changeStatus(g, e.target.value as GuestStatus)}
        className="min-h-10 rounded-md border border-line bg-paper px-3 text-sm text-ink focus:border-champagne focus:outline-none focus:ring-2 focus:ring-champagne/25 disabled:opacity-60"
      >
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="declined">Declined</option>
      </select>
      {savingId === g.id && <Spinner label="Saving" className="text-xs text-muted" />}
    </div>
  )

  const columns: Column<GuestWithInvitation>[] = [
    { key: 'name', header: 'Guest Name', cell: (g) => <span className="font-medium text-ink">{g.guestName}</span>, hideOnMobile: true },
    { key: 'by', header: 'Invited By', cell: (g) => g.invitedBy },
    {
      key: 'source',
      header: 'Added By',
      cell: (g) => <Badge tone={g.addedBy === 'admin' ? 'ink' : 'gold'}>{guestSourceLabel(g.addedBy)}</Badge>,
    },
    { key: 'table', header: 'Table', cell: (g) => (g.tableNumber ? formatTable(g.tableNumber) : '—') },
    { key: 'status', header: 'Status', cell: (g) => <GuestStatusBadge status={g.status} /> },
    { key: 'created', header: 'Created', cell: (g) => formatShortDate(g.createdAt), className: 'whitespace-nowrap' },
    { key: 'actions', header: 'Actions', cell: statusControl, hideOnMobile: true },
  ]

  return (
    <>
      <PageHeader
        title="Extra guests"
        description={`Guests included by you are confirmed automatically. Guest requests${priceEach ? ` (${priceEach})` : ''} need your approval.`}
      />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterTabs
          label="Filter by status"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All', count: list.length },
            { value: 'pending', label: 'Pending', count: count('pending') },
            { value: 'approved', label: 'Approved', count: count('approved') },
            { value: 'declined', label: 'Declined', count: count('declined') },
          ]}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="sr-only" htmlFor="guest-source">
            Filter by who added the guest
          </label>
          <select
            id="guest-source"
            value={source}
            onChange={(e) => setSource(e.target.value as 'all' | GuestSource)}
            className="input-base min-h-11 py-2.5 sm:w-auto"
          >
            <option value="all">Added by anyone</option>
            <option value="admin">Included by couple</option>
            <option value="invitee">Guest requests</option>
          </select>
          <SearchInput label="Search guests" placeholder="Search guest or invitee…" value={query} onChange={setQuery} />
        </div>
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
            caption="Additional guest requests"
            rows={rows}
            columns={columns}
            rowKey={(g) => g.id}
            mobileTitle={(g) => g.guestName}
            mobileActions={statusControl}
            empty={list.length ? 'No guests match this filter.' : 'No additional guest requests yet.'}
          />
        )}
      </Panel>
    </>
  )
}
