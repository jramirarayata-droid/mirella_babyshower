import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { RevealNote } from '../components/admin/RevealNote'
import {
  Armchair,
  Bell,
  Circle,
  Copy,
  CircleMinus,
  Eye,
  EyeOff,
  Minus,
  Plus,
  Printer,
  RectangleHorizontal,
  Search,
  Trash2,
  Undo2,
  Redo2,
  UserPlus,
  Users,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useAdminData } from '../hooks/useAdminData'
import { useToast } from '../hooks/useToast'
import { getWeddingSettings } from '../services/settingsService'
import {
  assignSeat,
  clearSeat,
  createItem,
  createTable,
  deleteItem,
  deleteTable,
  dismissNotices,
  listItems,
  listNotices,
  preassignReady,
  listSeats,
  listTables,
  removeTableSeat,
  saveSeatingConfig,
  suggestedSize,
  updateItem,
  updateTable,
} from '../services/seatingService'
import {
  DEFAULT_SEATING_CONFIG,
  ITEM_KINDS,
  type ItemKind,
  type SeatAssignment,
  type SeatingConfig,
  type SeatingItem,
  type SeatingNotice,
  type SeatingTable,
} from '../types/seating'
import { toFriendlyMessage } from '../utils/errors'
import { fromManilaParts, toManilaParts } from '../utils/formatting'
import { itemLocation, rotatePoint, snap } from '../utils/seatingGeometry'
import { seatablePeople, type SeatPerson } from '../utils/seatingPeople'
import { STATUS_TEXT, type SeatStatus } from '../components/seating/FloorPlan'
import { normalizeName } from '../utils/validation'
import { FloorPlan, type ChairInfo, type DragAction, type ObjectKind } from '../components/seating/FloorPlan'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Modal } from '../components/ui/Modal'
import { Skeleton } from '../components/ui/Skeleton'
import { cn } from '../components/ui/cn'
import { PageHeader } from '../components/admin/PageHeader'
import { GuestExport } from '../components/admin/GuestExport'
import { SeatingImageExport } from '../components/seating/SeatingImageExport'
import { useUnsavedChanges } from '../hooks/unsavedChanges'

type Selection = { kind: ObjectKind; id: string } | null
interface Snapshot {
  tables: SeatingTable[]
  items: SeatingItem[]
  room: SeatingConfig['room']
}
/**
 * One undoable step. Layout: tables/items/room as they were. Seats: who sat
 * where before and after (and a table's chair count when a chair was removed),
 * so undo and redo change the real seat assignments, not just the screen.
 */
type Step =
  | { kind: 'layout'; snap: Snapshot }
  | { kind: 'seats'; label: string; before: SeatAssignment[]; after: SeatAssignment[]; capacity?: { tableId: string; before: number; after: number } }
interface Drag {
  kind: ObjectKind
  id: string
  action: DragAction
  start: { x: number; y: number }
  orig: { x: number; y: number; width: number; height: number; rotation: number }
  before: Snapshot
  moved: boolean
}

const REASONS: Record<string, string> = {
  declined: 'can no longer attend',
  guest_declined: 'guest request declined',
  guest_removed: 'removed from the invitation',
  invitation_deleted: 'invitation deleted',
  combined_duplicate: 'invitations combined — they already had a chair with the other party, so this one was freed',
  rsvp_removed: 'RSVP deleted',
  declined_held: 'declined — seat still held (shown in red until you free it)',
}

const personKey = (invitationId: string, guestId: string | null) => `${invitationId}:${guestId ?? ''}`

function nextTableName(tables: SeatingTable[]): string {
  const nums = tables.map((t) => /^table\s+(\d+)$/i.exec(t.name.trim())?.[1]).filter(Boolean).map(Number)
  let n = nums.length ? Math.max(...nums) + 1 : 1
  while (tables.some((t) => t.name.trim().toLowerCase() === `table ${n}`)) n++
  return `Table ${n}`
}

export default function AdminSeating() {
  const toast = useToast()
  const { data, reload } = useAdminData()
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const [config, setConfig] = useState<SeatingConfig>(DEFAULT_SEATING_CONFIG)
  const [tables, setTables] = useState<SeatingTable[] | null>(null)
  const [items, setItems] = useState<SeatingItem[]>([])
  const [seats, setSeats] = useState<SeatAssignment[]>([])
  const [notices, setNotices] = useState<SeatingNotice[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Selection>(null)
  const [zoom, setZoom] = useState(0.6)
  const [showNames, setShowNames] = useState(false)
  const [history, setHistory] = useState<Step[]>([])
  const [future, setFuture] = useState<Step[]>([])
  const [picker, setPicker] = useState<{ tableId: string; seatIndex: number } | null>(null)
  const [chairToRemove, setChairToRemove] = useState<{ tableId: string; seatIndex: number } | null>(null)
  const [removingChair, setRemovingChair] = useState(false)
  const [toDelete, setToDelete] = useState<{ kind: 'table' | 'item'; id: string; name: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const live = useRef<{ tables: SeatingTable[]; items: SeatingItem[]; config: SeatingConfig; seats: SeatAssignment[] }>({ tables: [], items: [], config, seats: [] })
  live.current = { tables: tables ?? [], items, config, seats }

  useEffect(() => {
    document.title = 'Seating · Baby shower admin'
    Promise.all([getWeddingSettings(), listTables(), listItems(), listSeats(), listNotices()])
      .then(([s, t, it, se, n]) => {
        setSettingsId(s.id)
        setConfig(s.seatingConfig)
        setTables(t)
        setItems(it)
        setSeats(se)
        setNotices(n)
      })
      .catch((e) => setError(toFriendlyMessage(e)))
  }, [])

  // Fit the plan to the available width on first load.
  useEffect(() => {
    if (!tables || !wrapRef.current) return
    const w = wrapRef.current.clientWidth - 8
    setZoom(Math.max(0.3, Math.min(1, w / config.canvas.width)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables === null])

  // ------------------------------------------------------------------ people
  const preassign = config.finder.preassign
  const people = useMemo(() => seatablePeople(data?.invitations ?? [], preassign), [data, preassign])
  // Each seat's colour when seats are pre-assigned: confirmed, declined or waiting for an RSVP.
  const statusByInvitation = useMemo(() => new Map((data?.invitations ?? []).map((i) => [i.id, i.status])), [data])
  const seatStatus = useCallback(
    (s: SeatAssignment): SeatStatus => {
      const st = statusByInvitation.get(s.invitationId)
      return st === 'attending' ? 'confirmed' : st === 'declining' ? 'declined' : 'pending'
    },
    [statusByInvitation],
  )
  const declinedSeats = useMemo(() => (preassign ? seats.filter((s) => seatStatus(s) === 'declined') : []), [preassign, seats, seatStatus])
  const personByKey = useMemo(() => new Map(people.map((p) => [personKey(p.invitationId, p.guestId), p])), [people])
  const seatByChair = useMemo(() => new Map(seats.map((s) => [`${s.tableId}:${s.seatIndex}`, s])), [seats])
  const seatByPerson = useMemo(() => new Map(seats.map((s) => [personKey(s.invitationId, s.guestId), s])), [seats])
  const unseated = useMemo(() => people.filter((p) => !seatByPerson.has(personKey(p.invitationId, p.guestId))), [people, seatByPerson])
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of seats) m.set(s.tableId, (m.get(s.tableId) ?? 0) + 1)
    return m
  }, [seats])
  const tableById = useMemo(() => new Map((tables ?? []).map((t) => [t.id, t])), [tables])
  const nameOfSeat = useCallback(
    (s: SeatAssignment) => {
      const p = personByKey.get(personKey(s.invitationId, s.guestId))
      if (p) return p.name
      const inv = data?.invitations.find((i) => i.id === s.invitationId)
      const g = s.guestId ? inv?.guests.find((x) => x.id === s.guestId) : null
      return g?.guestName ?? inv?.inviteeName ?? 'Guest'
    },
    [personByKey, data],
  )

  // ------------------------------------------------------------------ history
  const snapshot = (): Snapshot => ({
    tables: live.current.tables.map((t) => ({ ...t })),
    items: live.current.items.map((i) => ({ ...i })),
    room: { ...live.current.config.room },
  })
  const pushStep = (st: Step) => {
    setHistory((h) => [...h.slice(-39), st])
    setFuture([])
  }
  const pushHistory = (s: Snapshot = snapshot()) => pushStep({ kind: 'layout', snap: s })

  const persistTable = (t: SeatingTable) =>
    updateTable(t.id, { name: t.name, shape: t.shape, capacity: t.capacity, seatSides: t.seatSides, x: t.x, y: t.y, width: t.width, height: t.height, rotation: t.rotation, placed: t.placed })
  const persistItem = (i: SeatingItem) => updateItem(i.id, { label: i.label, x: i.x, y: i.y, width: i.width, height: i.height, rotation: i.rotation, location: i.location })
  const persistConfig = (c: SeatingConfig) => (settingsId ? saveSeatingConfig(settingsId, c) : Promise.resolve())

  const safe = async (p: Promise<unknown>) => {
    try {
      await p
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    }
  }

  /** Puts tables, items and the room back as in `prev` (saving only what differs). */
  const restoreLayout = async (prev: Snapshot) => {
    const curT = new Map(live.current.tables.map((t) => [t.id, JSON.stringify(t)]))
    const curI = new Map(live.current.items.map((i) => [i.id, JSON.stringify(i)]))
    const nextTables = live.current.tables.map((t) => prev.tables.find((p) => p.id === t.id) ?? t)
    const nextItems = live.current.items.map((i) => prev.items.find((p) => p.id === i.id) ?? i)
    setTables(nextTables)
    setItems(nextItems)
    const roomChanged = JSON.stringify(prev.room) !== JSON.stringify(live.current.config.room)
    const nextConfig = { ...live.current.config, room: prev.room }
    if (roomChanged) setConfig(nextConfig)
    const jobs: Promise<unknown>[] = []
    for (const t of nextTables) if (curT.get(t.id) !== JSON.stringify(t)) jobs.push(persistTable(t))
    for (const i of nextItems) if (curI.get(i.id) !== JSON.stringify(i)) jobs.push(persistItem(i))
    if (roomChanged) jobs.push(persistConfig(nextConfig))
    await safe(Promise.all(jobs))
  }

  /**
   * Moves the real seat assignments from `from` to `to` — only for the people
   * and chairs that step touched. Refuses (and says so) if someone else has
   * changed those seats in the meantime, so nothing unrelated is overwritten.
   */
  const applySeats = async (from: SeatAssignment[], to: SeatAssignment[], cap?: { tableId: string; value: number }): Promise<boolean> => {
    const sig = (x: SeatAssignment) => `${x.tableId}:${x.seatIndex}`
    const fromBy = new Map(from.map((x) => [personKey(x.invitationId, x.guestId), x]))
    const toBy = new Map(to.map((x) => [personKey(x.invitationId, x.guestId), x]))
    const touched = [...new Set([...fromBy.keys(), ...toBy.keys()])].filter((k) => (fromBy.get(k) && sig(fromBy.get(k)!)) !== (toBy.get(k) && sig(toBy.get(k)!)))
    if (!touched.length && !cap) return true
    const server = await listSeats()
    const serverBy = new Map(server.map((x) => [personKey(x.invitationId, x.guestId), x]))
    const stale = touched.some((k) => (serverBy.get(k) && sig(serverBy.get(k)!)) !== (fromBy.get(k) && sig(fromBy.get(k)!)))
    const touchedSet = new Set(touched)
    const blocked = touched.some((k) => {
      const want = toBy.get(k)
      if (!want) return false
      const sitter = server.find((x) => sig(x) === sig(want))
      return sitter && !touchedSet.has(personKey(sitter.invitationId, sitter.guestId))
    })
    if (stale || blocked) {
      toast.error('Those seats were changed since — nothing was undone, so no one else’s seat is overwritten.')
      setSeats(server)
      return false
    }
    try {
      if (cap) {
        const t = live.current.tables.find((x) => x.id === cap.tableId)
        if (t && t.capacity !== cap.value) {
          await updateTable(t.id, { capacity: cap.value })
          setTables((l) => l?.map((x) => (x.id === t.id ? { ...x, capacity: cap.value } : x)) ?? null)
        }
      }
      for (const k of touched) {
        const cur = serverBy.get(k)
        if (cur) await clearSeat(cur.id)
      }
      for (const k of touched) {
        const want = toBy.get(k)
        if (want) await assignSeat(want.tableId, want.seatIndex, want.invitationId, want.guestId)
      }
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    }
    setSeats(await listSeats())
    void reload()
    return true
  }

  const undo = async () => {
    const step = history.at(-1)
    if (!step) return
    setHistory((h) => h.slice(0, -1))
    if (step.kind === 'layout') {
      setFuture((f) => [...f, { kind: 'layout', snap: snapshot() }])
      await restoreLayout(step.snap)
      return
    }
    // A removed chair comes back first, so the seats after it have their places again.
    const ok = await applySeats(step.after, step.before, step.capacity && { tableId: step.capacity.tableId, value: step.capacity.before })
    if (ok) {
      setFuture((f) => [...f, step])
      toast.show(`Undone: ${step.label}`, 'info', { label: 'Redo', onClick: () => void redoRef.current() })
    }
  }
  const redo = async () => {
    const step = future.at(-1)
    if (!step) return
    setFuture((f) => f.slice(0, -1))
    if (step.kind === 'layout') {
      setHistory((h) => [...h, { kind: 'layout', snap: snapshot() }])
      await restoreLayout(step.snap)
      return
    }
    const ok = await applySeats(step.before, step.after, step.capacity && { tableId: step.capacity.tableId, value: step.capacity.after })
    if (ok) setHistory((h) => [...h, step])
  }
  const undoRef = useRef(undo)
  const redoRef = useRef(redo)
  undoRef.current = undo
  redoRef.current = redo
  /** Records a seat change and offers Undo right away. */
  const recordSeats = (label: string, before: SeatAssignment[], after: SeatAssignment[], capacity?: { tableId: string; before: number; after: number }) => {
    pushStep({ kind: 'seats', label, before, after, capacity })
    toast.show(label, 'success', { label: 'Undo', onClick: () => void undoRef.current() })
  }

  // Ctrl/⌘+Z undoes, Ctrl/⌘+Shift+Z or Ctrl+Y redoes (not while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (!(e.ctrlKey || e.metaKey) || el?.closest('input, textarea, select, [contenteditable="true"]')) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault()
        void undoRef.current()
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault()
        void redoRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ------------------------------------------------------------------ dragging
  const toSvg = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    return { x: p.x, y: p.y }
  }

  const onObjectPointerDown = (e: ReactPointerEvent, kind: ObjectKind, id: string, action: DragAction) => {
    setSelected({ kind, id })
    const target = e.target as Element
    target.setPointerCapture?.(e.pointerId)
    const o =
      kind === 'room'
        ? { ...config.room, rotation: 0 }
        : kind === 'table'
          ? tableById.get(id)!
          : items.find((i) => i.id === id)!
    drag.current = {
      kind,
      id,
      action,
      start: toSvg(e),
      orig: { x: o.x, y: o.y, width: o.width, height: o.height, rotation: o.rotation },
      before: snapshot(),
      moved: false,
    }
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d) return
    const p = toSvg(e)
    const dx = p.x - d.start.x
    const dy = p.y - d.start.y
    if (!d.moved && Math.hypot(dx, dy) < 3) return
    d.moved = true
    const o = d.orig
    let patch: Partial<typeof o> = {}
    if (d.action === 'move') {
      patch = { x: snap(o.x + dx), y: snap(o.y + dy) }
    } else if (d.action === 'rotate') {
      let a = (Math.atan2(p.y - o.y, p.x - o.x) * 180) / Math.PI + 90
      if (!e.shiftKey) a = Math.round(a / 15) * 15
      patch = { rotation: ((a % 360) + 360) % 360 }
    } else if (d.kind === 'room') {
      if (d.action === 'resize') patch = { width: Math.max(300, snap(p.x - o.x)), height: Math.max(200, snap(p.y - o.y)) }
      else {
        const nx = Math.min(snap(p.x), o.x + o.width - 300)
        const ny = Math.min(snap(p.y), o.y + o.height - 200)
        patch = { x: Math.max(0, nx), y: Math.max(0, ny), width: o.x + o.width - Math.max(0, nx), height: o.y + o.height - Math.max(0, ny) }
      }
    } else {
      const local = rotatePoint(p.x - o.x, p.y - o.y, -o.rotation)
      const w = Math.max(d.kind === 'table' ? 60 : 30, snap(Math.abs(local.x) * 2 - 12))
      const h = Math.max(d.kind === 'table' ? 50 : 24, snap(Math.abs(local.y) * 2 - 12))
      const t = d.kind === 'table' ? tableById.get(d.id) : null
      patch = t?.shape === 'round' ? { width: Math.max(w, h), height: Math.max(w, h) } : { width: w, height: h }
    }
    if (d.kind === 'room') setConfig((c) => ({ ...c, room: { ...c.room, ...patch } }))
    else if (d.kind === 'table') setTables((l) => l?.map((t) => (t.id === d.id ? { ...t, ...patch } : t)) ?? null)
    else setItems((l) => l.map((i) => (i.id === d.id ? { ...i, ...patch } : i)))
  }

  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    if (!d?.moved) return
    pushHistory(d.before)
    const { tables: ts, items: its, config: c } = live.current
    if (d.kind === 'room') void safe(persistConfig(c))
    else if (d.kind === 'table') {
      const t = ts.find((x) => x.id === d.id)
      if (t) void safe(persistTable(t))
    } else {
      const i = its.find((x) => x.id === d.id)
      if (i) void safe(persistItem(i))
    }
  }

  // ------------------------------------------------------------------ add / edit
  const spot = (n: number) => ({
    x: snap(config.room.x + config.room.width / 2 + ((n % 5) - 2) * 40),
    y: snap(config.room.y + config.room.height / 2 + (Math.floor(n / 5) % 4) * 40),
  })

  const addTable = async (shape: 'round' | 'rect') => {
    if (!tables) return
    setBusy(true)
    try {
      const cap = shape === 'round' ? 10 : 8
      const t = await createTable({ name: nextTableName(tables), shape, capacity: cap, seatSides: 'both' }, (tables.at(-1)?.sortOrder ?? 0) + 1, {
        ...spot(tables.filter((x) => x.placed).length),
        placed: true,
      })
      setTables([...tables, t])
      setSelected({ kind: 'table', id: t.id })
      void reload()
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const addItem = async (kind: ItemKind) => {
    const def = ITEM_KINDS.find((k) => k.kind === kind)!
    try {
      const it = await createItem({ kind, label: '', ...spot(items.length + 3), width: def.width, height: def.height, rotation: 0, location: 'auto' })
      setItems([...items, it])
      setSelected({ kind: 'item', id: it.id })
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    }
  }

  const patchTable = (id: string, patch: Partial<SeatingTable>, record = true) => {
    if (record) pushHistory()
    const next = (tables ?? []).map((t) => (t.id === id ? { ...t, ...patch } : t))
    setTables(next)
    const t = next.find((x) => x.id === id)
    if (t) void safe(updateTable(id, patch).then(() => ('capacity' in patch || 'name' in patch ? reload() : undefined)))
  }

  const patchItem = (id: string, patch: Partial<SeatingItem>) => {
    pushHistory()
    setItems((l) => l.map((i) => (i.id === id ? { ...i, ...patch } : i)))
    void safe(updateItem(id, patch))
  }

  const setCapacity = (t: SeatingTable, capacity: number) => {
    const cap = Math.max(1, Math.min(40, capacity))
    const lost = seats.filter((s) => s.tableId === t.id && s.seatIndex >= cap)
    if (lost.length && !window.confirm(`${lost.map(nameOfSeat).join(', ')} will lose their chair. Continue?`)) return
    const size = suggestedSize(t.shape, cap, t.seatSides)
    const grow = t.shape === 'round' ? size.width > t.width : size.width > t.width
    patchTable(t.id, { capacity: cap, ...(grow ? { width: size.width, height: t.shape === 'round' ? size.height : t.height } : {}) })
    if (lost.length) setSeats((l) => l.filter((s) => !(s.tableId === t.id && s.seatIndex >= cap)))
  }

  const duplicateTable = async (t: SeatingTable) => {
    if (!tables) return
    try {
      const copy = await createTable({ name: nextTableName(tables), shape: t.shape, capacity: t.capacity, seatSides: t.seatSides }, (tables.at(-1)?.sortOrder ?? 0) + 1, {
        x: snap(t.x + t.width + 60),
        y: t.y,
        width: t.width,
        height: t.height,
        rotation: t.rotation,
        placed: true,
      })
      setTables([...tables, copy])
      setSelected({ kind: 'table', id: copy.id })
      void reload()
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    }
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    setBusy(true)
    try {
      if (toDelete.kind === 'table') {
        await deleteTable(toDelete.id)
        setTables((l) => l?.filter((t) => t.id !== toDelete.id) ?? null)
        setSeats((l) => l.filter((s) => s.tableId !== toDelete.id))
        void reload()
      } else {
        await deleteItem(toDelete.id)
        setItems((l) => l.filter((i) => i.id !== toDelete.id))
      }
      setSelected(null)
      setToDelete(null)
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setBusy(false)
    }
  }

  // ------------------------------------------------------------------ seats
  const seatPerson = async (tableId: string, seatIndex: number, p: SeatPerson) => {
    const occupant = seatByChair.get(`${tableId}:${seatIndex}`)
    try {
      if (occupant) await clearSeat(occupant.id)
      const before = live.current.seats
      const s = await assignSeat(tableId, seatIndex, p.invitationId, p.guestId)
      const after = [...before.filter((x) => x.id !== occupant?.id && personKey(x.invitationId, x.guestId) !== personKey(p.invitationId, p.guestId)), s]
      setSeats(after)
      setPicker(null)
      const tName = tableById.get(tableId)?.name ?? 'the table'
      recordSeats(occupant ? `${p.name} seated at ${tName} (in place of ${nameOfSeat(occupant)})` : `${p.name} seated at ${tName}`, before, after)
      void reload()
    } catch (e) {
      toast.error(toFriendlyMessage(e))
      setSeats(await listSeats())
    }
  }

  /** Takes a chair away: whoever sits there is unassigned, the chairs after it move down one place. */
  const removeChair = async (tableId: string, seatIndex: number) => {
    const t = tableById.get(tableId)
    if (!t || t.capacity <= 1) return
    setRemovingChair(true)
    const occupant = seatByChair.get(`${tableId}:${seatIndex}`)
    try {
      const before = live.current.seats
      if (occupant) await clearSeat(occupant.id)
      const capacity = await removeTableSeat(tableId, seatIndex)
      setTables((l) => l?.map((x) => (x.id === tableId ? { ...x, capacity } : x)) ?? null)
      const after = before.filter((x) => x.id !== occupant?.id).map((x) => (x.tableId === tableId && x.seatIndex > seatIndex ? { ...x, seatIndex: x.seatIndex - 1 } : x))
      setSeats(after)
      setChairToRemove(null)
      setPicker(null)
      recordSeats(occupant ? `Chair removed — ${nameOfSeat(occupant)} is unassigned` : `Chair removed from ${t.name}`, before, after, { tableId, before: t.capacity, after: capacity })
      if (occupant) void reload()
    } catch (e) {
      toast.error(toFriendlyMessage(e))
      setSeats(await listSeats())
      setTables(await listTables())
    } finally {
      setRemovingChair(false)
    }
  }

  const emptyChair = async (s: SeatAssignment) => {
    try {
      const before = live.current.seats
      await clearSeat(s.id)
      const after = before.filter((x) => x.id !== s.id)
      setSeats(after)
      setPicker(null)
      recordSeats(`${nameOfSeat(s)} taken off ${tableById.get(s.tableId)?.name ?? 'the table'}`, before, after)
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    }
  }

  const seatParty = async (t: SeatingTable, invitationId: string) => {
    const members = unseated.filter((p) => p.invitationId === invitationId)
    const free = Array.from({ length: t.capacity }, (_, i) => i).filter((i) => !seatByChair.has(`${t.id}:${i}`))
    if (!members.length) return
    if (free.length < members.length) toast.error(`Only ${free.length} free ${free.length === 1 ? 'chair' : 'chairs'} at ${t.name}. Seating as many as fit.`)
    setBusy(true)
    const added: SeatAssignment[] = []
    const before = live.current.seats
    try {
      for (let k = 0; k < Math.min(free.length, members.length); k++) {
        added.push(await assignSeat(t.id, free[k], members[k].invitationId, members[k].guestId))
      }
      if (added.length) recordSeats(`Seated ${added.length} at ${t.name}`, before, [...before, ...added])
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setSeats((l) => [...l, ...added])
      setBusy(false)
      void reload()
    }
  }

  // Pre-assigned seats of guests who declined stay (in red) until freed here.
  const freeDeclined = async () => {
    setBusy(true)
    const freed: string[] = []
    const before = live.current.seats
    try {
      for (const st of declinedSeats) {
        await clearSeat(st.id)
        freed.push(st.id)
      }
      recordSeats(`Freed ${freed.length} ${freed.length === 1 ? 'seat' : 'seats'}`, before, before.filter((x) => !freed.includes(x.id)))
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setSeats((l) => l.filter((x) => !freed.includes(x.id)))
      setBusy(false)
    }
  }

  // ------------------------------------------------------------------ render
  if (error) {
    return (
      <>
        <PageHeader title="Seating" />
        <p role="alert" className="rounded-lg border border-rose/30 bg-rose/5 px-4 py-3 text-sm text-rose">
          {error}
        </p>
      </>
    )
  }
  if (!tables) {
    return (
      <>
        <PageHeader title="Seating" />
        <Skeleton className="h-[60vh]" />
      </>
    )
  }

  const placed = tables.filter((t) => t.placed)
  const unplaced = tables.filter((t) => !t.placed)
  const selTable = selected?.kind === 'table' ? tableById.get(selected.id) : undefined
  const selItem = selected?.kind === 'item' ? items.find((i) => i.id === selected.id) : undefined
  const totalSeats = placed.reduce((n, t) => n + t.capacity, 0)
  const chairInfo = (tid: string, i: number): ChairInfo | null => {
    const s = seatByChair.get(`${tid}:${i}`)
    return s ? { name: nameOfSeat(s), state: 'filled', status: preassign ? seatStatus(s) : undefined } : null
  }

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Seating"
          description="Arrange your tables, mark the stage and other areas, then seat your confirmed guests."
          actions={
            <>
              <GuestExport />
              <SeatingImageExport config={config} tables={placed} items={items} counts={counts} chair={chairInfo} statusColours={preassign} />
              <Button variant="outline" onClick={() => window.print()} icon={<Printer aria-hidden="true" className="size-4" />}>
                Print / PDF
              </Button>
            </>
          }
        />
      </div>

      {notices.length > 0 && (
        <div role="status" className="mb-4 rounded-xl border border-gold/40 bg-champagne-light/30 px-4 py-3 text-sm print:hidden">
          <div className="flex items-start justify-between gap-3">
            <p className="flex items-center gap-2 font-medium text-ink">
              <Bell aria-hidden="true" className="size-4 text-gold" />
              {notices.some((n) => n.reason === 'declined_held')
                ? `Seating updates (${notices.length})`
                : `${notices.length} ${notices.length === 1 ? 'seat was' : 'seats were'} freed automatically`}
            </p>
            <button
              type="button"
              className="shrink-0 rounded px-2 py-1 text-xs font-medium uppercase tracking-[0.14em] text-ink-soft hover:bg-paper"
              onClick={() => void dismissNotices().then(() => setNotices([]), () => undefined)}
            >
              Got it
            </button>
          </div>
          <ul className="mt-2 space-y-0.5 text-ink-soft">
            {notices.slice(0, 8).map((n) => (
              <li key={n.id}>
                <strong className="font-medium text-ink">{n.personName}</strong> · {n.tableName} — {REASONS[n.reason] ?? n.reason}
              </li>
            ))}
            {notices.length > 8 && <li className="text-muted">…and {notices.length - 8} more</li>}
          </ul>
        </div>
      )}

      <FinderCard config={config} onSave={(c) => { setConfig(c); void safe(persistConfig(c).then(() => toast.success('Find My Seat settings saved.'))) }} />

      {preassign && (
        <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink-soft shadow-soft print:hidden">
          {(['confirmed', 'pending', 'declined'] as const).map((st) => (
            <span key={st} className="inline-flex items-center gap-2">
              <span aria-hidden="true" className={cn('size-3 rounded-full', st === 'confirmed' ? 'bg-sage' : st === 'declined' ? 'bg-rose' : 'bg-gold/60 ring-1 ring-gold')} />
              {STATUS_TEXT[st][0].toUpperCase() + STATUS_TEXT[st].slice(1)}
              <span className="text-muted">({seats.filter((s) => seatStatus(s) === st).length})</span>
            </span>
          ))}
          {declinedSeats.length > 0 && (
            <Button size="sm" variant="outline" className="sm:ml-auto" disabled={busy} onClick={() => void freeDeclined()}>
              Free {declinedSeats.length === 1 ? 'the declined seat' : `all ${declinedSeats.length} declined seats`}
            </Button>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="mb-4 grid grid-cols-3 gap-2 text-center print:hidden sm:max-w-xl">
        <Stat label="Tables on plan" value={placed.length} />
        <Stat label="Seats" value={totalSeats} />
        <Stat label="Not yet seated" value={unseated.length} tone={unseated.length ? 'gold' : undefined} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        {/* Canvas */}
        <section aria-label="Floor plan" className="min-w-0 rounded-xl border border-line bg-paper shadow-soft print:border-0 print:shadow-none">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-line p-2 print:hidden">
            <Button size="sm" variant="subtle" disabled={busy} onClick={() => void addTable('round')} icon={<Circle aria-hidden="true" className="size-4" />}>
              Round table
            </Button>
            <Button size="sm" variant="subtle" disabled={busy} onClick={() => void addTable('rect')} icon={<RectangleHorizontal aria-hidden="true" className="size-4" />}>
              Long table
            </Button>
            <select
              aria-label="Add a stage, entrance or other area"
              className="input-base min-h-9 w-auto py-1 text-sm"
              value=""
              onChange={(e) => e.target.value && void addItem(e.target.value as ItemKind)}
            >
              <option value="">+ Stage, entrance…</option>
              {ITEM_KINDS.map((k) => (
                <option key={k.kind} value={k.kind}>
                  {k.label}
                </option>
              ))}
            </select>
            <span className="mx-1 h-6 w-px bg-line" aria-hidden="true" />
            <ToolButton label="Zoom out" onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.1).toFixed(2)))}>
              <ZoomOut className="size-4" />
            </ToolButton>
            <span className="w-11 text-center text-xs tabular-nums text-muted">{Math.round(zoom * 100)}%</span>
            <ToolButton label="Zoom in" onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}>
              <ZoomIn className="size-4" />
            </ToolButton>
            <ToolButton label={history.length ? `Undo${history.at(-1)?.kind === 'seats' ? `: ${(history.at(-1) as { label: string }).label}` : ''} (Ctrl+Z)` : 'Undo'} onClick={() => void undo()} disabled={!history.length}>
              <Undo2 className="size-4" />
            </ToolButton>
            <ToolButton label="Redo (Ctrl+Shift+Z)" onClick={() => void redo()} disabled={!future.length}>
              <Redo2 className="size-4" />
            </ToolButton>
            <ToolButton label={showNames ? 'Hide names' : 'Show names'} onClick={() => setShowNames((v) => !v)} active={showNames}>
              {showNames ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            </ToolButton>
          </div>
          <div
            ref={wrapRef}
            className="max-h-[72vh] overflow-auto bg-cream/40 print:max-h-none print:overflow-visible"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div style={{ width: config.canvas.width * zoom }} className="print:!w-full">
              <FloorPlan
                svgRef={svgRef}
                config={config}
                tables={placed}
                items={items}
                counts={counts}
                editable
                zoom={zoom}
                selected={selected}
                showNames={showNames}
                className="h-auto w-full"
                chair={chairInfo}
                onObjectPointerDown={onObjectPointerDown}
                onChairClick={(tableId, seatIndex) => {
                  setSelected({ kind: 'table', id: tableId })
                  setPicker({ tableId, seatIndex })
                }}
                onBackgroundPointerDown={() => setSelected(null)}
              />
            </div>
          </div>
          <p className="border-t border-line px-3 py-2 text-xs text-muted print:hidden">
            Drag to move · round handle to resize · gold handle to rotate (hold Shift for free rotation) · tap a chair to seat someone · tap the hall’s wall to
            resize the hall.
          </p>
        </section>

        {/* Side panel */}
        <aside className="space-y-4 print:hidden" aria-label="Details">
          {selTable ? (
            <TablePanel
              key={selTable.id}
              table={selTable}
              seats={seats.filter((s) => s.tableId === selTable.id)}
              nameOfSeat={nameOfSeat}
              unseated={unseated}
              busy={busy}
              onClose={() => setSelected(null)}
              onPatch={(p) => patchTable(selTable.id, p)}
              onCapacity={(n) => setCapacity(selTable, n)}
              onChair={(i) => setPicker({ tableId: selTable.id, seatIndex: i })}
              onRemoveChair={(i) => setChairToRemove({ tableId: selTable.id, seatIndex: i })}
              onSeatParty={(inv) => void seatParty(selTable, inv)}
              onDuplicate={() => void duplicateTable(selTable)}
              onRemove={() => patchTable(selTable.id, { placed: false })}
              onDelete={() => setToDelete({ kind: 'table', id: selTable.id, name: selTable.name })}
            />
          ) : selItem ? (
            <ItemPanel
              key={selItem.id}
              item={selItem}
              inside={itemLocation({ ...selItem, location: 'auto' }, config.room) === 'inside'}
              onClose={() => setSelected(null)}
              onPatch={(p) => patchItem(selItem.id, p)}
              onDelete={() => setToDelete({ kind: 'item', id: selItem.id, name: selItem.label || ITEM_KINDS.find((k) => k.kind === selItem.kind)?.label || 'item' })}
            />
          ) : selected?.kind === 'room' ? (
            <Card title="The hall">
              <p className="text-sm text-ink-soft">
                Drag the round handles at the corners to match your venue’s shape. Anything placed outside the walls is marked <strong>Outside</strong>.
              </p>
            </Card>
          ) : (
            <>
              {unplaced.length > 0 && (
                <Card title={`Tables not on the plan (${unplaced.length})`}>
                  <ul className="space-y-1.5">
                    {unplaced.map((t, n) => (
                      <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate">
                          {t.name} <span className="text-muted">· {t.capacity} seats</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          <Button size="sm" variant="subtle" onClick={() => patchTable(t.id, { placed: true, ...spot(placed.length + n) })}>
                            Place
                          </Button>
                          <Button
                            size="sm"
                            variant="danger-quiet"
                            onClick={() => setToDelete({ kind: 'table', id: t.id, name: t.name })}
                            aria-label={`Delete ${t.name}`}
                            title={`Delete ${t.name}`}
                            icon={<Trash2 aria-hidden="true" className="size-4" />}
                          />
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
              <UnseatedCard people={unseated} invitations={data?.invitations ?? []} tableName={(id) => (id ? tableById.get(id)?.name : undefined)} />
              <Card title="Tips">
                <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
                  <li>Select a table to change its name, shape and number of seats.</li>
                  <li>To delete a table, select it and press Delete, or use the bin next to a table that isn’t on the plan.</li>
                  <li>Use “Seat a whole party” to fill a table in one go.</li>
                  <li>{preassign ? 'Guests who are attending or haven’t answered yet can be seated (pre-assign is on).' : 'Only guests who RSVP’d “attending” can be seated.'}</li>
                </ul>
              </Card>
            </>
          )}
        </aside>
      </div>

      <PrintList tables={placed} seats={seats} nameOfSeat={nameOfSeat} />

      {picker && (
        <SeatPicker
          table={tableById.get(picker.tableId)!}
          seatIndex={picker.seatIndex}
          occupant={seatByChair.get(`${picker.tableId}:${picker.seatIndex}`) ?? null}
          nameOfSeat={nameOfSeat}
          people={people}
          seatOf={(p) => seatByPerson.get(personKey(p.invitationId, p.guestId)) ?? null}
          tableName={(id) => tableById.get(id)?.name ?? ''}
          onPick={(p) => void seatPerson(picker.tableId, picker.seatIndex, p)}
          onEmpty={(s) => void emptyChair(s)}
          onRemoveChair={() => setChairToRemove({ tableId: picker.tableId, seatIndex: picker.seatIndex })}
          onClose={() => setPicker(null)}
        />
      )}

{chairToRemove &&
        (() => {
          const t = tableById.get(chairToRemove.tableId)
          const occ = seatByChair.get(`${chairToRemove.tableId}:${chairToRemove.seatIndex}`)
          const after = t ? t.capacity - chairToRemove.seatIndex - 1 : 0
          return (
            <ConfirmDialog
              open
              title={`Remove chair ${chairToRemove.seatIndex + 1} from ${t?.name ?? 'this table'}?`}
              message={
                <>
                  {occ ? (
                    <span className="block">
                      <strong className="font-medium text-ink">{nameOfSeat(occ)}</strong> is in this chair and will be unassigned (not removed from the guest list).
                    </span>
                  ) : (
                    <span className="block">This chair is empty.</span>
                  )}
                  <span className="mt-2 block">
                    The table will have {t ? t.capacity - 1 : ''} chairs.
                    {after > 0 ? ` The ${after === 1 ? 'chair' : `${after} chairs`} after it ${after === 1 ? 'is' : 'are'} renumbered one lower (e.g. chair ${chairToRemove.seatIndex + 2} becomes chair ${chairToRemove.seatIndex + 1}) — everyone stays at this table.` : ''}
                  </span>
                </>
              }
              confirmLabel={occ ? 'Unassign and remove' : 'Remove chair'}
              destructive
              loading={removingChair}
              loadingText="Removing…"
              onCancel={() => !removingChair && setChairToRemove(null)}
              onConfirm={() => void removeChair(chairToRemove.tableId, chairToRemove.seatIndex)}
            />
          )
        })()}

            <ConfirmDialog
        open={Boolean(toDelete)}
        tone="admin"
        title={toDelete?.kind === 'table' ? `Delete ${toDelete.name}?` : `Remove ${toDelete?.name}?`}
        message={
          toDelete?.kind === 'table'
            ? 'Guests seated here go back to “Not yet seated”, and invitations using this table become “Not assigned”. To keep the table for later, use “Remove from plan” instead.'
            : 'This removes it from the floor plan.'
        }
        confirmLabel="Delete"
        destructive
        loading={busy}
        loadingText="Deleting…"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      />
    </>
  )
}

// ====================================================================== pieces

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'gold' }) {
  return (
    <div className="rounded-lg border border-line bg-paper px-2 py-2.5">
      <p className={cn('font-serif text-2xl leading-none tabular-nums', tone === 'gold' ? 'text-gold' : 'text-ink')}>{value}</p>
      <p className="mt-1 text-[0.68rem] uppercase tracking-[0.12em] text-muted">{label}</p>
    </div>
  )
}

function ToolButton({ label, onClick, disabled, active, children }: { label: string; onClick: () => void; disabled?: boolean; active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn('flex size-9 items-center justify-center rounded-md text-ink-soft transition hover:bg-cream disabled:opacity-30', active && 'bg-cream text-ink')}
    >
      {children}
    </button>
  )
}

function Card({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-paper p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-sans text-sm font-semibold text-ink">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  )
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-cream p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('rounded-md px-2 py-1.5 text-xs font-medium transition', value === o.value ? 'bg-paper text-ink shadow-soft' : 'text-muted hover:text-ink')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function TablePanel({
  table: t,
  seats,
  nameOfSeat,
  unseated,
  busy,
  onClose,
  onPatch,
  onCapacity,
  onChair,
  onRemoveChair,
  onSeatParty,
  onDuplicate,
  onRemove,
  onDelete,
}: {
  table: SeatingTable
  seats: SeatAssignment[]
  nameOfSeat: (s: SeatAssignment) => string
  unseated: SeatPerson[]
  busy: boolean
  onClose: () => void
  onPatch: (p: Partial<SeatingTable>) => void
  onCapacity: (n: number) => void
  onChair: (i: number) => void
  onRemoveChair: (i: number) => void
  onSeatParty: (invitationId: string) => void
  onDuplicate: () => void
  onRemove: () => void
  onDelete: () => void
}) {
  const [name, setName] = useState(t.name)
  const [party, setParty] = useState('')
  const byIndex = new Map(seats.map((s) => [s.seatIndex, s]))
  const parties = useMemo(() => {
    const m = new Map<string, { name: string; count: number }>()
    for (const p of unseated) {
      const e = m.get(p.invitationId) ?? { name: p.partyName, count: 0 }
      e.count++
      m.set(p.invitationId, e)
    }
    return [...m.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name))
  }, [unseated])
  const free = t.capacity - seats.length

  const commitName = () => {
    const n = name.trim()
    if (!n) return setName(t.name)
    if (n !== t.name) onPatch({ name: n })
  }

  return (
    <Card
      title="Table"
      actions={
        <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-muted hover:bg-cream hover:text-ink">
          <X className="size-4" />
        </button>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="table-name" className="mb-1.5 block text-xs font-medium uppercase tracking-[0.12em] text-muted">
            Name
          </label>
          <input
            id="table-name"
            className="input-base"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.12em] text-muted">Shape</p>
          <Segmented
            label="Table shape"
            value={t.shape}
            options={[
              { value: 'round', label: 'Round' },
              { value: 'rect', label: 'Long' },
            ]}
            onChange={(shape) => onPatch({ shape, ...suggestedSize(shape, t.capacity, t.seatSides) })}
          />
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.12em] text-muted">Number of seats</p>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="One seat fewer" onClick={() => onCapacity(t.capacity - 1)} className="flex size-10 items-center justify-center rounded-lg border border-line hover:bg-cream">
              <Minus className="size-4" />
            </button>
            <span className="w-12 text-center font-serif text-2xl tabular-nums">{t.capacity}</span>
            <button type="button" aria-label="One more seat" onClick={() => onCapacity(t.capacity + 1)} className="flex size-10 items-center justify-center rounded-lg border border-line hover:bg-cream">
              <Plus className="size-4" />
            </button>
            <span className="ml-1 text-sm text-muted">{free > 0 ? `${free} free` : 'full'}</span>
          </div>
        </div>
        {t.shape === 'rect' && (
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.12em] text-muted">Chairs on</p>
            <Segmented
              label="Chairs on"
              value={t.seatSides}
              options={[
                { value: 'both', label: 'Both sides' },
                { value: 'one', label: 'One side' },
                { value: 'all', label: 'All sides' },
              ]}
              onChange={(seatSides) => onPatch({ seatSides, ...suggestedSize('rect', t.capacity, seatSides) })}
            />
            <p className="mt-1 text-xs text-muted">“One side” suits a head table facing your guests — rotate it to face the room.</p>
          </div>
        )}
        <button type="button" className="text-xs text-gold underline-offset-4 hover:underline" onClick={() => onPatch(suggestedSize(t.shape, t.capacity, t.seatSides))}>
          Resize to fit the chairs
        </button>

        {parties.length > 0 && free > 0 && (
          <div className="rounded-lg border border-line bg-ivory/60 p-3">
            <label htmlFor="seat-party" className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.12em] text-muted">
              <Users aria-hidden="true" className="size-3.5" /> Seat a whole party
            </label>
            <div className="flex gap-2">
              <select id="seat-party" className="input-base min-h-10 flex-1 py-1.5 text-sm" value={party} onChange={(e) => setParty(e.target.value)}>
                <option value="">Choose…</option>
                {parties.map(([id, p]) => (
                  <option key={id} value={id}>
                    {p.name} ({p.count})
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                disabled={!party || busy}
                onClick={() => {
                  onSeatParty(party)
                  setParty('')
                }}
              >
                Seat
              </Button>
            </div>
          </div>
        )}

        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.12em] text-muted">Chairs</p>
          <ol className="max-h-72 space-y-1 overflow-y-auto pr-1">
            {Array.from({ length: t.capacity }, (_, i) => {
              const s = byIndex.get(i)
              return (
                <li key={i} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onChair(i)}
                    className={cn(
                      'flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-cream',
                      !s && 'text-muted',
                    )}
                  >
                    <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted">{i + 1}</span>
                    <Armchair aria-hidden="true" className={cn('size-4 shrink-0', s ? 'text-ink-soft' : 'text-champagne')} />
                    <span className="truncate">{s ? nameOfSeat(s) : 'Empty — assign'}</span>
                  </button>
                  {t.capacity > 1 && (
                    <button
                      type="button"
                      onClick={() => onRemoveChair(i)}
                      aria-label={`Remove chair ${i + 1}${s ? ` (${nameOfSeat(s)} will be unassigned)` : ''}`}
                      title="Remove this chair"
                      className="shrink-0 rounded-md p-1.5 text-muted opacity-60 transition hover:bg-rose/10 hover:text-rose hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <CircleMinus aria-hidden="true" className="size-4" />
                    </button>
                  )}
                </li>
              )
            })}
          </ol>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-line pt-3">
          <Button size="sm" variant="subtle" onClick={onDuplicate} icon={<Copy aria-hidden="true" className="size-4" />}>
            Duplicate
          </Button>
          <Button size="sm" variant="ghost" onClick={onRemove}>
            Remove from plan
          </Button>
          <Button size="sm" variant="danger-quiet" onClick={onDelete} icon={<Trash2 aria-hidden="true" className="size-4" />}>
            Delete
          </Button>
        </div>
      </div>
    </Card>
  )
}

function ItemPanel({
  item,
  inside,
  onClose,
  onPatch,
  onDelete,
}: {
  item: SeatingItem
  inside: boolean
  onClose: () => void
  onPatch: (p: Partial<SeatingItem>) => void
  onDelete: () => void
}) {
  const [label, setLabel] = useState(item.label)
  const kind = ITEM_KINDS.find((k) => k.kind === item.kind)
  return (
    <Card
      title={kind?.label ?? 'Item'}
      actions={
        <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-muted hover:bg-cream hover:text-ink">
          <X className="size-4" />
        </button>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="item-label" className="mb-1.5 block text-xs font-medium uppercase tracking-[0.12em] text-muted">
            Label
          </label>
          <input
            id="item-label"
            className="input-base"
            value={label}
            maxLength={60}
            placeholder={kind?.label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => label !== item.label && onPatch({ label: label.trim() })}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.12em] text-muted">Inside or outside?</p>
          <Segmented
            label="Inside or outside"
            value={item.location}
            options={[
              { value: 'auto', label: `Auto (${inside ? 'inside' : 'outside'})` },
              { value: 'inside', label: 'Inside' },
              { value: 'outside', label: 'Outside' },
            ]}
            onChange={(location) => onPatch({ location })}
          />
          <p className="mt-1 text-xs text-muted">Auto follows where it sits on the plan. Override it for e.g. a covered veranda.</p>
        </div>
        <Button size="sm" variant="danger-quiet" onClick={onDelete} icon={<Trash2 aria-hidden="true" className="size-4" />}>
          Remove
        </Button>
      </div>
    </Card>
  )
}

function UnseatedCard({
  people,
  invitations,
  tableName,
}: {
  people: SeatPerson[]
  invitations: { id: string; tableId: string | null }[]
  tableName: (id: string | null) => string | undefined
}) {
  const [q, setQ] = useState('')
  const [side, setSide] = useState<'all' | 'groom' | 'bride'>('all')
  const planned = new Map(invitations.map((i) => [i.id, i.tableId]))
  const list = people
    .filter((p) => side === 'all' || p.side === side)
    .filter((p) => !q || normalizeName(p.name).includes(normalizeName(q)) || normalizeName(p.partyName).includes(normalizeName(q)))
  const count = (s: 'groom' | 'bride') => people.filter((p) => p.side === s).length
  return (
    <Card title={`Not yet seated (${people.length})`}>
      {people.length === 0 ? (
        <p className="text-sm text-muted">Everyone who’s attending has a seat. 🎉</p>
      ) : (
        <>
          <div role="group" aria-label="Guest side" className="mb-2 grid grid-cols-3 gap-1 rounded-lg bg-cream p-1 text-xs">
            {(
              [
                { v: 'all', l: `All ${people.length}` },
                { v: 'groom', l: `Dad ${count('groom')}` },
                { v: 'bride', l: `Mom ${count('bride')}` },
              ] as const
            ).map((o) => (
              <button
                key={o.v}
                type="button"
                aria-pressed={side === o.v}
                onClick={() => setSide(o.v)}
                className={cn('rounded-md px-2 py-1.5 transition', side === o.v ? 'bg-paper text-ink shadow-soft' : 'text-muted hover:text-ink')}
              >
                {o.l}
              </button>
            ))}
          </div>
          <div className="relative mb-2">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input className="input-base min-h-10 py-1.5 pl-9 text-sm" placeholder="Search names" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search unseated guests" />
          </div>
          <ul className="max-h-80 space-y-1 overflow-y-auto text-sm">
            {list.map((p) => {
              const plan = tableName(planned.get(p.invitationId) ?? null)
              return (
                <li key={`${p.invitationId}:${p.guestId ?? ''}`} className="rounded-md px-2 py-1.5 hover:bg-cream">
                  <span className="text-ink">{p.name}</span>
                  {!p.isInvitee && <span className="text-muted"> · with {p.partyName}</span>}
                  <span className="text-muted"> · {p.side === 'bride' ? 'Mom' : 'Dad'}</span>
                  {plan && <span className="ml-1 rounded bg-champagne-light/50 px-1.5 py-0.5 text-[0.7rem] text-ink-soft">{plan}</span>}
                </li>
              )
            })}
          </ul>
          <p className="mt-2 text-xs text-muted">Tap a chair on the plan to seat someone.</p>
        </>
      )}
    </Card>
  )
}

function SeatPicker({
  table,
  seatIndex,
  occupant,
  nameOfSeat,
  people,
  seatOf,
  tableName,
  onPick,
  onEmpty,
  onRemoveChair,
  onClose,
}: {
  table: SeatingTable
  seatIndex: number
  occupant: SeatAssignment | null
  nameOfSeat: (s: SeatAssignment) => string
  people: SeatPerson[]
  seatOf: (p: SeatPerson) => SeatAssignment | null
  tableName: (id: string) => string
  onPick: (p: SeatPerson) => void
  onEmpty: (s: SeatAssignment) => void
  onRemoveChair: () => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const rows = people
    .filter((p) => !q || normalizeName(p.name).includes(normalizeName(q)) || normalizeName(p.partyName).includes(normalizeName(q)))
    .map((p) => ({ p, seat: seatOf(p) }))
    .filter(({ seat }) => !(seat && seat.tableId === table.id && seat.seatIndex === seatIndex))
    .sort((a, b) => Number(Boolean(a.seat)) - Number(Boolean(b.seat)) || a.p.partyName.localeCompare(b.p.partyName))

  return (
    <Modal open onClose={onClose} tone="admin" title={`${table.name} · chair ${seatIndex + 1}`} description={occupant ? `Now: ${nameOfSeat(occupant)}` : 'Empty chair'}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {occupant && (
            <Button variant="outline" size="sm" onClick={() => onEmpty(occupant)} icon={<X aria-hidden="true" className="size-4" />}>
              Empty this chair
            </Button>
          )}
          {table.capacity > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-rose hover:bg-rose/10 hover:text-rose"
              onClick={onRemoveChair}
              icon={<CircleMinus aria-hidden="true" className="size-4" />}
            >
              Remove this chair
            </Button>
          )}
        </div>
        <div className="relative">
          <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input className="input-base pl-9" placeholder="Search guests" value={q} onChange={(e) => setQ(e.target.value)} autoFocus aria-label="Search guests" />
        </div>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">{people.length ? 'No matching guests.' : 'No guests to seat yet.'}</p>
        ) : (
          <ul className="max-h-[50vh] divide-y divide-line overflow-y-auto">
            {rows.map(({ p, seat }) => (
              <li key={`${p.invitationId}:${p.guestId ?? ''}`}>
                <button type="button" onClick={() => onPick(p)} className="flex w-full items-center gap-3 px-2 py-2.5 text-left transition hover:bg-cream">
                  <UserPlus aria-hidden="true" className="size-4 shrink-0 text-gold" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ink">{p.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {p.side === 'bride' ? 'Mom’s side' : 'Dad’s side'} · {p.isInvitee ? 'Invitee' : `With ${p.partyName}`}
                      {p.pending ? ' · no RSVP yet' : ''}
                      {seat ? ` · now at ${tableName(seat.tableId)}, chair ${seat.seatIndex + 1} (will move)` : ' · not seated'}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}

function FinderCard({ config, onSave }: { config: SeatingConfig; onSave: (c: SeatingConfig) => void }) {
  const [mode, setMode] = useState(config.finder.mode)
  // Pre-assigning needs a one-time database update; until then the switch stays off.
  const [ready, setReady] = useState<boolean | null>(null)
  useEffect(() => {
    let alive = true
    void preassignReady().then((ok) => alive && setReady(ok))
    return () => {
      alive = false
    }
  }, [])
  const parts = config.finder.from ? toManilaParts(config.finder.from) : null
  const [date, setDate] = useState(parts?.date ?? '')
  const [time, setTime] = useState(parts?.time ?? '09:00')
  useEffect(() => {
    setMode(config.finder.mode)
    const p = config.finder.from ? toManilaParts(config.finder.from) : null
    setDate(p?.date ?? '')
    setTime(p?.time ?? '09:00')
  }, [config.finder.mode, config.finder.from])
  const dirty = mode !== config.finder.mode || (mode === 'scheduled' && (date ? fromManilaParts(date, time) : null) !== config.finder.from)
  useUnsavedChanges(dirty, 'Find My Seat')

  return (
    <section className="mb-4 flex flex-col gap-3 rounded-xl border border-line bg-paper p-4 shadow-soft print:hidden md:flex-row md:items-end">
      <div className="flex-1">
        <h2 className="font-sans text-sm font-semibold text-ink">“Find My Seat” for guests</h2>
        <p className="mt-0.5 text-sm text-muted">A read-only map where guests type their name to see their table. It only shows their own seat and party.</p>
        <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 accent-ink"
            checked={config.finder.preassign}
            disabled={ready === false && !config.finder.preassign}
            onChange={(e) => onSave({ ...config, finder: { ...config.finder, preassign: e.target.checked } })}
          />
          <span>
            <span className="font-medium text-ink">Pre-assign seats before guests RSVP</span>
            <span className="mt-0.5 block text-muted">
              {ready === false
                ? 'Needs a one-time database update (migration 020) before it can be switched on.'
                : config.finder.preassign
                ? 'On: you can seat guests who haven’t answered yet, and they see their seat in Find My Seat and after they RSVP. Seats show green (confirmed), gold (waiting for RSVP) or red (declined — kept until you free it).'
                : 'Off: only guests who RSVP’d “attending” can be seated, and a seat is freed automatically when someone declines.'}
            </span>
          </span>
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <select className="input-base w-auto" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} aria-label="Find My Seat visibility">
          <option value="hidden">Hidden</option>
          <option value="visible">Visible now</option>
          <option value="scheduled">Visible from a date</option>
          <option value="reveal">On the reveal date</option>
        </select>
        {mode === 'reveal' && (
          <div className="basis-full">
            <RevealNote />
          </div>
        )}
        {mode === 'scheduled' && (
          <>
            <input type="date" className="input-base w-auto" value={date} onChange={(e) => setDate(e.target.value)} aria-label="From date" />
            <input type="time" className="input-base w-auto" value={time} onChange={(e) => setTime(e.target.value)} aria-label="From time (Philippine time)" />
          </>
        )}
        <Button
          disabled={!dirty || (mode === 'scheduled' && !date)}
          onClick={() => onSave({ ...config, finder: { ...config.finder, mode, from: mode === 'scheduled' && date ? fromManilaParts(date, time) : null } })}
        >
          Save
        </Button>
      </div>
    </section>
  )
}

function PrintList({ tables, seats, nameOfSeat }: { tables: SeatingTable[]; seats: SeatAssignment[]; nameOfSeat: (s: SeatAssignment) => string }) {
  return (
    <section className="hidden print:mt-6 print:block">
      <h2 className="mb-3 text-2xl">Guest list by table</h2>
      <div className="columns-2 gap-8 text-sm">
        {[...tables]
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
          .map((t) => {
            const list = seats.filter((s) => s.tableId === t.id).sort((a, b) => a.seatIndex - b.seatIndex)
            return (
              <div key={t.id} className="mb-4 break-inside-avoid">
                <p className="font-semibold">
                  {t.name} <span className="font-normal text-muted">({list.length}/{t.capacity})</span>
                </p>
                <ol className="mt-1 space-y-0.5">
                  {list.map((s) => (
                    <li key={s.id}>
                      {s.seatIndex + 1}. {nameOfSeat(s)}
                    </li>
                  ))}
                  {list.length === 0 && <li className="text-muted">—</li>}
                </ol>
              </div>
            )
          })}
      </div>
    </section>
  )
}
