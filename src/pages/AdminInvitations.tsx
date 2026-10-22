import { useEffect, useMemo, useState } from 'react'
import { Eye, Link2, Pencil, Settings2, Plus, Printer, RotateCcw, Send, Trash2, UserPlus } from 'lucide-react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAdminData } from '../hooks/useAdminData'
import { useToast } from '../hooks/useToast'
import { createInvitation, deleteInvitation, includeInvitation, recordRsvpForGuest, separateGuest, setIncludedGuests, updateInvitation } from '../services/adminService'
import type { InvitationInput, InvitationWithRSVP } from '../types/rsvp'
import { toFriendlyMessage } from '../utils/errors'
import { formatDateTime, formatShortDate, formatWeddingDate } from '../utils/formatting'
import { normalizeName } from '../utils/validation'
import { includedGuestNames } from '../utils/guests'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { ResponsiveTable, type Column } from '../components/ui/ResponsiveTable'
import { TableSkeleton } from '../components/ui/Skeleton'
import type { SeatingTable } from '../types/seating'
import { useWeddingSettings } from '../hooks/useWeddingSettings'
import { InvitationFormModal, type RecordChoice } from '../components/admin/InvitationFormModal'
import { ResponseDetailModal } from '../components/admin/ResponseDetailModal'
import { IncludeInvitationModal } from '../components/admin/IncludeInvitationModal'
import { AttendanceBadge } from '../components/admin/StatusBadges'
import { PageHeader, Panel } from '../components/admin/PageHeader'
import { GuestExport } from '../components/admin/GuestExport'
import { FilterTabs, SearchInput } from '../components/admin/FilterTabs'
import { HeadcountSummary } from '../components/admin/HeadcountSummary'
import { SIDE_LABEL, SIDE_SHORT, SIDE_TONE, bySide, type SideFilter } from '../utils/headcount'
import type { PrintablesHandoff } from './AdminPrintables'
import { VirtualInviteSettingsModal } from '../components/admin/VirtualInviteSettingsModal'
import {
  DEFAULT_VIRTUAL_INVITE,
  DEFAULT_WEBSITE_PRIVACY,
  getPrintablesBackIds,
  getVirtualInviteSettings,
  getWebsitePrivacy,
  saveVirtualInviteSettings,
  saveWebsitePrivacy,
  type VirtualInviteSettings,
  type WebsitePrivacy,
} from '../services/adminDisplayService'
import { clearInvitationOpen, getInvitationOpens, type InvitationOpen } from '../services/virtualInviteService'
import { getAdminPreference, saveAdminPreference } from '../services/preferencesService'
import { DEFAULT_INVITE_MESSAGE, buildInviteMessage, virtualInviteUrl } from '../utils/inviteMessage'
import { copyText } from '../utils/share'

const MESSAGE_KEY = 'invite_message'

export default function AdminInvitations() {
  const { data, loading, error, reload } = useAdminData()
  const toast = useToast()
  const location = useLocation()
  const handedQuery = (location.state as { q?: string } | null)?.q
  const [query, setQuery] = useState(handedQuery ?? '')
  // Quick search (Ctrl+K) opens this page with a name to look for.
  useEffect(() => {
    if (handedQuery) setQuery(handedQuery)
  }, [location.key, handedQuery])
  const [side, setSide] = useState<SideFilter>('all')
  const navigate = useNavigate()
  const toPrint = (state: PrintablesHandoff) => navigate('/admin/printables', { state })
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<InvitationWithRSVP | null>(null)
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState<InvitationWithRSVP | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [viewing, setViewing] = useState<InvitationWithRSVP | null>(null)
  const [toInclude, setToInclude] = useState<InvitationWithRSVP | null>(null)
  const [including, setIncluding] = useState(false)
  const [toSeparate, setToSeparate] = useState<{ invitation: InvitationWithRSVP; guestId: string; name: string; sameLink: boolean } | null>(null)
  const [separating, setSeparating] = useState(false)
  const [newTables, setNewTables] = useState<SeatingTable[]>([])
  const { settings } = useWeddingSettings()
  // Open link (Website Settings → How guests RSVP): guests sign up themselves, no names are added here.
  const openMode = settings?.rsvpMode === 'open'
  // Positions are typed per invitation (there is no entourage).
  const autoPositions = useMemo(() => new Map<string, string>(), [])
  const tables = useMemo(() => {
    const base = data?.tables ?? []
    return [...base, ...newTables.filter((t) => !base.some((b) => b.id === t.id))]
  }, [data, newTables])

  useEffect(() => {
    document.title = 'Invitations · Baby shower admin'
  }, [])

  // Virtual invitations: who has opened theirs, and the message copied with each link.
  const [opens, setOpens] = useState<Map<string, InvitationOpen>>(new Map())
  const [template, setTemplate] = useState(DEFAULT_INVITE_MESSAGE)
  const [messageOpen, setMessageOpen] = useState(false)
  const [savingMessage, setSavingMessage] = useState(false)
  const [viSettings, setViSettings] = useState<VirtualInviteSettings>(DEFAULT_VIRTUAL_INVITE)
  const [webPrivacy, setWebPrivacy] = useState<WebsitePrivacy>(DEFAULT_WEBSITE_PRIVACY)
  const [printablesIds, setPrintablesIds] = useState<string[] | null>(null)
  const [hidingOnWebsite, setHidingOnWebsite] = useState(false)
  const openSettings = () => {
    // Fresh copies each time, in case they were changed in Printables or Website Settings.
    Promise.all([getVirtualInviteSettings(), getWebsitePrivacy(), getPrintablesBackIds()])
      .then(([v, w, ids]) => {
        setViSettings(v)
        setWebPrivacy(w)
        setPrintablesIds(ids)
      })
      .catch((e) => toast.error(toFriendlyMessage(e)))
    setMessageOpen(true)
  }
  const infoSections = useMemo(() => (settings?.sections ?? []).filter((x) => x.visible && (x.title.trim() || x.body.trim())), [settings])
  const [toReset, setToReset] = useState<InvitationWithRSVP | null>(null)
  const [resetting, setResetting] = useState(false)
  const loadOpens = () =>
    getInvitationOpens()
      .then(setOpens)
      .catch((e) => toast.error(toFriendlyMessage(e)))
  useEffect(() => {
    void loadOpens()
    getAdminPreference<{ text?: unknown }>(MESSAGE_KEY)
      .then((v) => {
        const text = v && typeof v.text === 'string' ? v.text : ''
        if (text.trim()) setTemplate(text)
      })
      .catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const messageFor = (inv: Pick<InvitationWithRSVP, 'inviteeName' | 'invitationCode'>, text = template) =>
    buildInviteMessage(text, {
      name: inv.inviteeName,
      date: settings ? formatWeddingDate(settings.weddingDate) : '',
      couple: settings?.coupleNames ?? '',
      link: virtualInviteUrl(inv.invitationCode),
    })

  const copyInvite = async (inv: InvitationWithRSVP) => {
    const text = messageFor(inv)
    if (await copyText(text)) toast.success(`Invitation for ${inv.inviteeName} copied — paste it into Messenger, Viber or a text.`)
    else toast.show(text)
  }

  const saveMessage = async (text: string, vi: VirtualInviteSettings) => {
    setSavingMessage(true)
    try {
      await Promise.all([saveAdminPreference(MESSAGE_KEY, { text }), saveVirtualInviteSettings(vi)])
      setTemplate(text.trim() ? text : DEFAULT_INVITE_MESSAGE)
      setViSettings(vi)
      setMessageOpen(false)
      toast.success('Virtual invitation settings saved.')
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setSavingMessage(false)
    }
  }

  const hideOnWebsite = async (patch: Partial<WebsitePrivacy>) => {
    setHidingOnWebsite(true)
    try {
      const next = { ...webPrivacy, ...patch }
      await saveWebsitePrivacy(next)
      setWebPrivacy(next)
      toast.success('Hidden on your baby shower website. Confirmed guests still see them on their invitation.')
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setHidingOnWebsite(false)
    }
  }

  const confirmReset = async () => {
    if (!toReset) return
    setResetting(true)
    try {
      await clearInvitationOpen(toReset.id)
      toast.success(`Reset — ${toReset.inviteeName} shows as not opened.`)
      setToReset(null)
      await loadOpens()
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setResetting(false)
    }
  }

  const sideList = useMemo(() => bySide(data?.invitations ?? [], side), [data, side])
  const rows = useMemo(() => {
    const q = normalizeName(query)
    return q ? sideList.filter((i) => normalizeName(i.inviteeName).includes(q)) : sideList
  }, [sideList, query])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (inv: InvitationWithRSVP) => {
    setEditing(inv)
    setFormOpen(true)
  }

  const tryRecord = async (id: string, record: RecordChoice) => {
    try {
      await recordRsvpForGuest(id, record.status, record.mobile)
      return true
    } catch (e) {
      toast.error(toFriendlyMessage(e))
      return false
    }
  }

  const save = async (input: InvitationInput, included: string[], record: RecordChoice | null) => {
    setSaving(true)
    try {
      if (editing) {
        await updateInvitation(editing.id, input)
        const before = includedGuestNames(editing)
        const changed = before.length !== included.length || before.some((n, i) => n !== included[i])
        if (changed) await setIncludedGuests(editing.id, included)
        const ok = record ? await tryRecord(editing.id, record) : true
        if (ok) toast.success(record ? 'Invitation updated and response recorded.' : 'Invitation updated.')
      } else {
        const created = await createInvitation(input)
        if (included.length) await setIncludedGuests(created.id, included)
        const ok = record ? await tryRecord(created.id, record) : true
        if (ok) toast.success(record ? 'Invitation added and response recorded.' : 'Invitation added.')
      }
      setFormOpen(false)
      await reload()
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      await deleteInvitation(toDelete.id)
      toast.success('Invitation deleted.')
      setToDelete(null)
      await reload()
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setDeleting(false)
    }
  }

  // Include one invitation in another (and back again).
  const separate = async (guestId: string, name: string) => {
    await separateGuest(guestId)
    toast.success(`${name} has their own invitation again.`)
    await Promise.all([reload(), loadOpens()])
  }
  const confirmInclude = async (into: InvitationWithRSVP) => {
    if (!toInclude) return
    const name = toInclude.inviteeName
    setIncluding(true)
    try {
      const guestId = await includeInvitation(toInclude.id, into.id)
      setToInclude(null)
      await Promise.all([reload(), loadOpens()])
      toast.show(`${name} is now included in ${into.inviteeName}’s invitation.`, 'success', {
        label: 'Undo',
        onClick: () => void separate(guestId, name).catch((e) => toast.error(toFriendlyMessage(e))),
      })
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setIncluding(false)
    }
  }
  const confirmSeparate = async () => {
    if (!toSeparate) return
    setSeparating(true)
    try {
      await separate(toSeparate.guestId, toSeparate.name)
      setToSeparate(null)
      setFormOpen(false)
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setSeparating(false)
    }
  }
  const openCounts = useMemo(() => new Map([...opens].map(([id, o]) => [id, o.count])), [opens])

  const copyLink = (code: string) => {
    const inv = data?.invitations.find((i) => i.invitationCode === code)
    if (inv) void copyInvite(inv)
  }


  const actions = (inv: InvitationWithRSVP) => (
    <div className="grid w-max grid-cols-2 gap-1.5 [&>button]:justify-start [&>button]:whitespace-nowrap">
      <Button size="sm" variant="subtle" onClick={() => copyInvite(inv)} icon={<Send aria-hidden="true" className="size-3.5" />} aria-label={`Copy the invitation for ${inv.inviteeName}`}>
        Copy invitation
      </Button>
      <Button size="sm" variant="subtle" onClick={() => openEdit(inv)} icon={<Pencil aria-hidden="true" className="size-3.5" />} aria-label={`Edit ${inv.inviteeName}`}>
        Edit
      </Button>
      <Button
        size="sm"
        variant="subtle"
        onClick={() => setToInclude(inv)}
        icon={<UserPlus aria-hidden="true" className="size-3.5" />}
        aria-label={`Include ${inv.inviteeName} in another invitation`}
        title="Make them an included guest on someone else’s invitation"
      >
        Include in…
      </Button>
      <Button size="sm" variant="subtle" onClick={() => setViewing(inv)} icon={<Eye aria-hidden="true" className="size-3.5" />} aria-label={`View RSVP for ${inv.inviteeName}`}>
        View RSVP
      </Button>
      <Button
        size="sm"
        variant="subtle"
        onClick={() => toPrint({ select: [inv.id] })}
        icon={<Printer aria-hidden="true" className="size-3.5" />}
        aria-label={`Print the invitation for ${inv.inviteeName}`}
      >
        Print
      </Button>
      <Button
        size="sm"
        variant="danger-quiet"
        onClick={() => setToDelete(inv)}
        icon={<Trash2 aria-hidden="true" className="size-3.5" />}
        aria-label={`Delete ${inv.inviteeName}`}
      >
        Delete
      </Button>
    </div>
  )

  const columns: Column<InvitationWithRSVP>[] = [
    {
      key: 'name',
      header: 'Invitee',
      cell: (r) => (
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-ink">{r.inviteeName}</span>
          {r.source === 'link' && <Badge tone="gold">Signed up via link</Badge>}
        </span>
      ),
      hideOnMobile: true,
    },
    { key: 'side', header: 'Side', cell: (r) => <Badge tone={SIDE_TONE[r.side]}>{SIDE_SHORT[r.side]}</Badge>, className: 'whitespace-nowrap' },
    { key: 'table', header: 'Table', cell: (r) => r.tableNumber || '—' },
    {
      key: 'included',
      header: 'Included Guests',
      cell: (r) => {
        const names = includedGuestNames(r)
        return names.length ? <span className="text-ink-soft">{names.join(', ')}</span> : '—'
      },
    },
    { key: 'max', header: 'Extra guests allowed', cell: (r) => r.maxAdditionalGuests, className: 'text-center md:w-28' },
    { key: 'rsvp', header: 'RSVP', cell: (r) => <AttendanceBadge status={r.status} /> },
    {
      key: 'opened',
      header: 'Opened',
      className: 'whitespace-nowrap',
      cell: (r) => {
        const o = opens.get(r.id)
        if (!o) return <span className="text-muted">Not yet</span>
        return (
          <span className="inline-flex items-center gap-1.5">
            <span title={`First opened ${formatDateTime(o.firstOpenedAt)} · last opened ${formatDateTime(o.lastOpenedAt)} · ${o.count} ${o.count === 1 ? 'time' : 'times'}`}>
              <Badge tone="green">Opened {formatShortDate(o.firstOpenedAt)}</Badge>
              {o.count > 1 && <span className="ml-1.5 text-xs text-muted">{o.count}×</span>}
            </span>
            <button
              type="button"
              onClick={() => setToReset(r)}
              className="rounded p-1 text-muted transition hover:bg-cream hover:text-ink"
              aria-label={`Reset “opened” for ${r.inviteeName}`}
              title="Reset (e.g. after testing the link)"
            >
              <RotateCcw aria-hidden="true" className="size-3.5" />
            </button>
          </span>
        )
      },
    },
    { key: 'active', header: 'Active', cell: (r) => (r.isActive ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>) },
    { key: 'created', header: 'Created', cell: (r) => formatShortDate(r.createdAt), className: 'whitespace-nowrap' },
    { key: 'actions', header: 'Actions', cell: actions, hideOnMobile: true },
  ]

  return (
    <>
      <PageHeader
        title="Invitations"
        description={data ? `${data.invitations.length} invitations` : 'Manage who can RSVP.'}
        actions={
          <>
            <Button variant="outline" onClick={openSettings} icon={<Settings2 aria-hidden="true" className="size-4" />}>
              Virtual invitation settings
            </Button>
            <GuestExport />
            <Button variant="outline" onClick={() => toPrint({ side })} icon={<Printer aria-hidden="true" className="size-4" />}>
              Print invitations
            </Button>
            {!openMode && (
              <Button onClick={openCreate} icon={<Plus aria-hidden="true" className="size-4" />}>
                Add Invitation
              </Button>
            )}
          </>
        }
      />
      {openMode && (
        <p className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-champagne/60 bg-champagne-light/30 px-4 py-3 text-sm text-ink-soft">
          <Link2 aria-hidden="true" className="size-4 text-gold" />
          <span>
            <strong className="font-medium text-ink">Open link in use.</strong> Everyone who signs up appears here; their companions wait in Extra guests for your approval.
          </span>
          <Link to="/admin/settings" className="text-gold underline-offset-4 hover:underline">
            Change how guests RSVP
          </Link>
        </p>
      )}
      {data && <HeadcountSummary invitations={data.invitations} side={side} />}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterTabs
          label="Guest side"
          value={side}
          onChange={setSide}
          options={[
            { value: 'all', label: 'All', count: data?.invitations.length },
            { value: 'groom', label: 'Dad’s side', count: data ? bySide(data.invitations, 'groom').length : undefined },
            { value: 'bride', label: 'Mom’s side', count: data ? bySide(data.invitations, 'bride').length : undefined },
            ...(data && bySide(data.invitations, 'none').length > 0 ? [{ value: 'none' as const, label: 'No side', count: bySide(data.invitations, 'none').length }] : []),
          ]}
        />
        <SearchInput label="Search by invitee name" placeholder="Search by invitee name…" value={query} onChange={setQuery} />
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
            caption="Invitations"
            rows={rows}
            columns={columns}
            rowKey={(r) => r.id}
            mobileTitle={(r) => r.inviteeName}
            mobileActions={actions}
            empty={query ? 'No invitations match your search.' : side !== 'all' ? `No invitations on the ${SIDE_LABEL[side]} yet.` : 'No invitations yet. Add your first invitation.'}
          />
        )}
      </Panel>

      <InvitationFormModal
        open={formOpen}
        invitation={editing}
        saving={saving}
        onClose={() => !saving && setFormOpen(false)}
        onSave={save}
        onCopyLink={copyLink}
        tables={tables}
        invitations={data?.invitations ?? []}
        onTableCreated={(t) => setNewTables((l) => [...l, t])}
        onSeparate={(guest) => editing && (setFormOpen(false), setToSeparate({ invitation: editing, guestId: guest.id, name: guest.guestName, sameLink: Boolean(guest.mergedFrom?.invitationCode) }))}
      />

      <IncludeInvitationModal
        from={toInclude}
        invitations={data?.invitations ?? []}
        tables={tables}
        seatedKeys={data?.seatedKeys ?? new Set()}
        positions={autoPositions}
        openCounts={openCounts}
        saving={including}
        onClose={() => !including && setToInclude(null)}
        onConfirm={confirmInclude}
      />

      <ConfirmDialog
        open={Boolean(toSeparate)}
        title="Give them their own invitation?"
        message={
          <>
            <p className="font-medium text-ink">{toSeparate?.name}</p>
            <p className="mt-2">
              They leave {toSeparate?.invitation.inviteeName}’s invitation and get their own, keeping their chair.{' '}
              {toSeparate?.sameLink
                ? 'Their old link and its details (position, allowed guests) come back.'
                : 'They get a new link — copy it from their row afterwards.'}{' '}
              Their invitation will need its own answer.
            </p>
            <p className="mt-2 text-muted">Unsaved changes in the edit form are not kept.</p>
          </>
        }
        confirmLabel="Own invitation"
        loading={separating}
        loadingText="Separating…"
        onCancel={() => !separating && setToSeparate(null)}
        onConfirm={confirmSeparate}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this invitation?"
        message={
          <>
            <p className="font-medium text-ink">{toDelete?.inviteeName}</p>
            <p className="mt-2">This will also remove its RSVP response and additional guest records.</p>
          </>
        }
        destructive
        confirmLabel="Delete invitation"
        loading={deleting}
        loadingText="Deleting…"
        onCancel={() => !deleting && setToDelete(null)}
        onConfirm={confirmDelete}
      />

      <ResponseDetailModal invitation={viewing} onClose={() => setViewing(null)} />

      <VirtualInviteSettingsModal
        open={messageOpen}
        template={template}
        settings={viSettings}
        website={webPrivacy}
        sections={infoSections}
        printablesIds={printablesIds}
        hidingOnWebsite={hidingOnWebsite}
        onHideOnWebsite={hideOnWebsite}
        saving={savingMessage}
        sample={{
          name: rows[0]?.inviteeName ?? 'Tita Lorna',
          date: settings ? formatWeddingDate(settings.weddingDate) : '',
          couple: settings?.coupleNames ?? '',
          link: virtualInviteUrl(rows[0]?.invitationCode ?? 'abc123'),
        }}
        onClose={() => !savingMessage && setMessageOpen(false)}
        onSave={saveMessage}
      />

      <ConfirmDialog
        open={Boolean(toReset)}
        title="Reset “opened”?"
        message={`${toReset?.inviteeName ?? 'This guest'} will show as not opened until they open their link again. Use this after testing a link yourself.`}
        confirmLabel="Reset"
        loading={resetting}
        loadingText="Resetting…"
        onCancel={() => !resetting && setToReset(null)}
        onConfirm={confirmReset}
      />
    </>
  )
}
