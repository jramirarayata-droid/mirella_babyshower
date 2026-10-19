import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import type { SeatingTable } from '../../types/seating'
import { createTable } from '../../services/seatingService'
import { toFriendlyMessage } from '../../utils/errors'
import { Button } from '../ui/Button'

interface Props {
  tables: SeatingTable[]
  /** People already planned at each table (excluding this invitation). */
  used: Map<string, number>
  /** People on this invitation (invitee + included guests). */
  partySize: number
  value: string | null
  onChange: (tableId: string | null) => void
  onTableCreated: (table: SeatingTable) => void
}

/** Fool-proof table choice: pick from the list (seats left shown) or create a new table. */
export function TablePicker({ tables, used, partySize, value, onChange, onTableCreated }: Props) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [capacity, setCapacity] = useState('10')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selected = tables.find((t) => t.id === value)
  const left = (t: SeatingTable) => t.capacity - (used.get(t.id) ?? 0)
  const over = selected ? partySize - left(selected) : 0

  const create = async () => {
    const n = name.trim()
    const cap = Math.trunc(Number(capacity))
    if (!n) return setError('Please enter a table name.')
    if (!(cap >= 1 && cap <= 40)) return setError('Seats must be 1 to 40.')
    if (tables.some((t) => t.name.trim().toLowerCase() === n.toLowerCase())) return setError('A table with this name already exists.')
    setBusy(true)
    setError(null)
    try {
      const t = await createTable({ name: n, shape: 'round', capacity: cap, seatSides: 'both' }, (tables.at(-1)?.sortOrder ?? 0) + 1)
      onTableCreated(t)
      onChange(t.id)
      setAdding(false)
      setName('')
    } catch (e) {
      setError(toFriendlyMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <label htmlFor="table-picker" className="mb-2 block text-[0.95rem] font-medium text-ink-soft">
        Table
      </label>
      {!adding ? (
        <>
          <select
            id="table-picker"
            className="input-base"
            value={value ?? ''}
            onChange={(e) => {
              if (e.target.value === '__new') setAdding(true)
              else onChange(e.target.value || null)
            }}
          >
            <option value="">Not assigned yet</option>
            {tables.map((t) => {
              const l = left(t)
              return (
                <option key={t.id} value={t.id}>
                  {t.name} — {l > 0 ? `${l} of ${t.capacity} seats left` : `full (${t.capacity} seats)`}
                </option>
              )
            })}
            <option value="__new">+ Create a new table…</option>
          </select>
          {selected && over > 0 && (
            <p role="alert" className="mt-2 text-sm text-rose">
              {selected.name} only has {Math.max(0, left(selected))} {left(selected) === 1 ? 'seat' : 'seats'} left for this party of {partySize}. You can still
              save, then add seats in Seating.
            </p>
          )}
          <p className="mt-1.5 text-xs text-muted">Manage tables and the floor plan in Admin → Seating.</p>
        </>
      ) : (
        <div className="rounded-lg border border-line bg-ivory/60 p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_7rem]">
            <input
              className="input-base"
              placeholder="Table name, e.g. Table 12 or Family"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              aria-label="New table name"
              autoFocus
            />
            <input
              className="input-base"
              type="number"
              min={1}
              max={40}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              aria-label="Number of seats"
            />
          </div>
          <p className="mt-1.5 text-xs text-muted">Name · number of seats. You can change the shape later in Seating.</p>
          {error && (
            <p role="alert" className="mt-2 text-sm text-rose">
              {error}
            </p>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void create()} loading={busy} loadingText="Adding…" icon={<Check aria-hidden="true" className="size-4" />}>
              Create table
            </Button>
          </div>
        </div>
      )}
      {!adding && tables.length === 0 && (
        <button type="button" onClick={() => setAdding(true)} className="mt-2 inline-flex items-center gap-1 text-sm text-gold underline-offset-4 hover:underline">
          <Plus aria-hidden="true" className="size-3.5" /> Create your first table
        </button>
      )}
    </div>
  )
}
