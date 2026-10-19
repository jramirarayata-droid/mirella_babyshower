import { useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { useAdminData } from '../../hooks/useAdminData'
import { useWeddingSettings } from '../../hooks/useWeddingSettings'
import { useToast } from '../../hooks/useToast'
import { listSeats, listTables } from '../../services/seatingService'
import type { InvitationWithRSVP } from '../../types/rsvp'
import { partyMembers } from '../../utils/seatingPeople'
import { invitationPosition } from '../../utils/positions'
import { downloadXlsx, type Cell } from '../../utils/xlsx'
import { toFriendlyMessage } from '../../utils/errors'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { cn } from '../ui/cn'

type Who = 'all' | 'attending' | 'seated'

const RSVP_LABEL: Record<string, string> = { attending: 'Attending', declining: 'Not attending', pending: 'No reply yet' }

/**
 * "Export to Excel": every guest (invitees, included guests and approved
 * extras) with their table and chair — and, if wanted, their position.
 * Two sheets: alphabetical, and grouped by table.
 */
export function GuestExport({ className }: { className?: string }) {
  const { data } = useAdminData()
  const { settings } = useWeddingSettings()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [who, setWho] = useState<Who>('all')
  const [roles, setRoles] = useState(false)
  const [busy, setBusy] = useState(false)

  const exportNow = async () => {
    if (!data) return
    setBusy(true)
    try {
      const [seats, tables] = await Promise.all([listSeats(), listTables()])
      const tableById = new Map(tables.map((t) => [t.id, t]))
      const seatOf = new Map(seats.map((s) => [`${s.invitationId}:${s.guestId ?? ''}`, s]))
      // Positions are typed per invitation (e.g. “Ninang”).
      const auto = new Map<string, string>()
      const tableOrder = new Map(tables.map((t, i) => [t.id, t.sortOrder * 1000 + i]))

      type Row = { name: string; party: string; side: string; rsvp: string; tableId: string | null; table: string; seat: number | null; role: string }
      const rows: Row[] = []
      for (const inv of data.invitations as InvitationWithRSVP[]) {
        if (!inv.isActive) continue
        if (who === 'attending' && inv.status !== 'attending') continue
        for (const p of partyMembers(inv)) {
          const s = seatOf.get(`${p.invitationId}:${p.guestId ?? ''}`)
          if (who === 'seated' && !s) continue
          // Seated → that chair's table; otherwise the party's table if one is set.
          const tableId = s?.tableId ?? inv.tableId ?? null
          const role = !roles ? '' : p.isInvitee ? invitationPosition(inv, auto) : (auto.get(`${inv.id}:${p.guestId}`) ?? '')
          rows.push({
            name: p.name,
            party: p.isInvitee ? '' : p.partyName,
            side: p.side === 'bride' ? 'Mom' : 'Dad',
            rsvp: RSVP_LABEL[inv.status] ?? inv.status,
            tableId,
            table: tableId ? (tableById.get(tableId)?.name ?? '') : '',
            seat: s ? s.seatIndex + 1 : null,
            role,
          })
        }
      }
      if (!rows.length) {
        toast.show('There’s no one to export with these options.')
        return
      }

      const header = ['Name', 'Invited with', 'Side', 'RSVP', 'Table', 'Seat', ...(roles ? ['Position'] : [])]
      const line = (r: Row): Cell[] => [r.name, r.party, r.side, r.rsvp, r.table, r.seat, ...(roles ? [r.role] : [])]
      const byName = [...rows].sort((a, b) => a.name.localeCompare(b.name))
      const byTable = [...rows].sort((a, b) => {
        const ta = a.tableId ? (tableOrder.get(a.tableId) ?? 1e9) : 2e9
        const tb = b.tableId ? (tableOrder.get(b.tableId) ?? 1e9) : 2e9
        return ta - tb || a.table.localeCompare(b.table) || (a.seat ?? 999) - (b.seat ?? 999) || a.name.localeCompare(b.name)
      })
      const tableHeader = ['Table', 'Seat', 'Name', 'Invited with', 'Side', 'RSVP', ...(roles ? ['Position'] : [])]
      const tableLine = (r: Row): Cell[] => [r.table || 'Not seated', r.seat, r.name, r.party, r.side, r.rsvp, ...(roles ? [r.role] : [])]

      const couple = (settings?.babyName ?? 'Baby-Shower').replace(/&/g, 'and').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')
      const today = new Date().toISOString().slice(0, 10)
      downloadXlsx(`${couple}-guest-list-${today}.xlsx`, [
        { name: 'Guest list', header, rows: byName.map(line) },
        { name: 'By table', header: tableHeader, rows: byTable.map(tableLine) },
      ])
      toast.success(`Exported ${rows.length} ${rows.length === 1 ? 'guest' : 'guests'}.`)
      setOpen(false)
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button variant="outline" className={className} onClick={() => setOpen(true)} disabled={!data} icon={<FileSpreadsheet aria-hidden="true" className="size-4" />}>
        Export to Excel
      </Button>
      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        locked={busy}
        title="Export guest list"
        description="An Excel file (.xlsx) with each guest’s table and chair — one sheet by name, one grouped by table."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void exportNow()} loading={busy} loadingText="Preparing…" icon={<FileSpreadsheet aria-hidden="true" className="size-4" />}>
              Download .xlsx
            </Button>
          </>
        }
      >
        <fieldset>
          <legend className="mb-2 text-[0.95rem] font-medium text-ink-soft">Who to include</legend>
          <div className="space-y-2">
            {(
              [
                ['all', 'Everyone invited', 'All active invitations, with their RSVP answer.'],
                ['attending', 'Attending only', 'Guests whose party said they’re coming.'],
                ['seated', 'Seated only', 'Only guests who have a chair.'],
              ] as const
            ).map(([v, label, hint]) => (
              <label
                key={v}
                className={cn(
                  'relative flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition',
                  who === v ? 'border-champagne bg-champagne-light/30' : 'border-line hover:border-champagne/60',
                )}
              >
                <input type="radio" name="export-who" className="mt-0.5 size-4 accent-ink" checked={who === v} onChange={() => setWho(v)} />
                <span>
                  <span className="font-medium text-ink">{label}</span>
                  <span className="mt-0.5 block text-muted">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-ink" checked={roles} onChange={(e) => setRoles(e.target.checked)} />
          <span>
            <span className="font-medium text-ink">Include positions</span>
            <span className="mt-0.5 block text-muted">E.g. Ninang or Lola — as typed on the invitation.</span>
          </span>
        </label>
        <p className="mt-4 text-xs text-muted">The file contains guests’ names — keep it private and share it only with your coordinator or venue.</p>
      </Modal>
    </>
  )
}
