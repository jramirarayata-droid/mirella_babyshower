import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Copy, ExternalLink, KeyRound, Link2, LogOut, Plus, RefreshCw, Search, Trash2, UserPlus, Pencil } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { FieldError, TextField } from '../components/ui/FormField'
import { PageLoader } from '../components/ui/Spinner'
import { peso, type Plan } from '../lib/plans'
import { spaceUrl } from '../lib/space'
import { copyText } from '../utils/share'
import { toFriendlyMessage } from '../utils/errors'
import {
  loadMyAccount, loadPlans, ownerAccounts, ownerCreateLogin, ownerDeleteLogin, ownerSaveSpace, ownerSetMember, ownerSetPassword, ownerSpaces,
  type OwnerAccount, type OwnerSpace, type SpaceInput,
} from '../services/spaceService'

const today = () => new Date().toISOString().slice(0, 10)
const fmtDate = (d: string | null) => (d ? new Date(`${d.length === 10 ? `${d}T00:00:00` : d}`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')
const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)

/** A friendly password that's easy to read out: three words-ish + digits. */
function newPassword(): string {
  const words = ['cloud', 'bunny', 'star', 'honey', 'sunny', 'petal', 'lamb', 'peach', 'moon', 'daisy', 'cozy', 'teddy']
  const r = crypto.getRandomValues(new Uint32Array(4))
  return `${words[r[0] % words.length]}-${words[r[1] % words.length]}-${1000 + (r[2] % 9000)}`
}

/** #/owner — the super admin's page: every shower, every login, plans and access. */
export default function Owner() {
  const { session, loading: authLoading, signOut } = useAuth()
  const toast = useToast()
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [spaces, setSpaces] = useState<OwnerSpace[]>([])
  const [accounts, setAccounts] = useState<OwnerAccount[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<SpaceInput | null>(null)
  const [newLoginFor, setNewLoginFor] = useState<OwnerSpace | null | 'none'>(null)
  const [linking, setLinking] = useState<OwnerAccount | null>(null)
  const [pwFor, setPwFor] = useState<OwnerAccount | null>(null)
  const [deleting, setDeleting] = useState<OwnerAccount | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [s, a, p] = await Promise.all([ownerSpaces(), ownerAccounts(), loadPlans()])
      setSpaces(s)
      setAccounts(a)
      setPlans(p)
    } catch (e) {
      toast.show(toFriendlyMessage(e), 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    document.title = 'Owner · Baby Shower Websites'
    if (!session) return
    void loadMyAccount().then((a) => {
      setAllowed(Boolean(a?.superAdmin))
      if (a?.superAdmin) void reload()
    })
  }, [session, reload])

  const planOf = useMemo(() => Object.fromEntries(plans.map((p) => [p.id, p])), [plans])
  const shown = spaces.filter((s) => !query.trim() || `${s.title} ${s.slug} ${s.admins.map((a) => a.username).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()))
  const totals = {
    showers: spaces.length,
    open: spaces.filter((s) => s.open).length,
    guests: spaces.reduce((n, s) => n + Number(s.guests ?? 0), 0),
    earned: spaces.filter((s) => !s.isDefault && s.isActive).reduce((n, s) => n + (planOf[s.planId]?.pricePhp ?? 0), 0),
  }

  if (authLoading) return <PageLoader />
  if (!session) return <Navigate to="/" replace />
  if (allowed === null) return <PageLoader label="Checking your access" />
  if (!allowed) {
    return (
      <main className="flex min-h-[100svh] items-center justify-center px-5 text-center">
        <div>
          <h1 className="font-serif text-3xl text-ink">This page is for the site owner</h1>
          <Link to="/" className="mt-6 inline-block text-sm text-muted underline">Back</Link>
        </div>
      </main>
    )
  }

  const quickToggle = async (s: OwnerSpace) => {
    try {
      await ownerSaveSpace({ id: s.id, slug: s.slug, title: s.title, planId: s.planId, isActive: !s.isActive, activeUntil: s.activeUntil, notes: s.notes })
      toast.show(s.isActive ? `${s.title} is switched off.` : `${s.title} is switched on.`)
      void reload()
    } catch (e) {
      toast.show(toFriendlyMessage(e), 'error')
    }
  }

  return (
    <div className="min-h-[100svh] bg-ivory">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.22em] text-muted">Owner</p>
            <h1 className="font-serif text-3xl text-ink">All baby showers</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => void reload()} icon={<RefreshCw aria-hidden="true" className="size-4" />}>
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => setNewLoginFor('none')} icon={<UserPlus aria-hidden="true" className="size-4" />}>
              New login
            </Button>
            <Button
              size="sm"
              onClick={() => setEditing({ id: null, slug: '', title: '', planId: plans[1]?.id ?? 'bundle', isActive: true, activeUntil: null, notes: '' })}
              icon={<Plus aria-hidden="true" className="size-4" />}
            >
              New shower
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void signOut()} icon={<LogOut aria-hidden="true" className="size-4" />}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-5 py-8 sm:px-8">
        <section aria-label="Totals" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ['Showers', totals.showers],
            ['Open now', totals.open],
            ['Guests invited', totals.guests],
            ['Active plans (₱)', peso(totals.earned)],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-line bg-paper p-5 shadow-card">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">{label}</p>
              <p className="mt-2 font-serif text-3xl text-ink">{value}</p>
            </div>
          ))}
        </section>

        <section aria-labelledby="showers-heading" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="showers-heading" className="font-serif text-2xl text-ink">
              Showers
            </h2>
            <label className="relative">
              <span className="sr-only">Search showers</span>
              <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, address or login"
                className="min-h-10 w-72 max-w-full rounded-lg border border-line bg-paper pl-9 pr-3 text-sm"
              />
            </label>
          </div>
          {loading && !spaces.length ? (
            <PageLoader />
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {shown.map((s) => {
                const plan = planOf[s.planId]
                const link = spaceUrl(s.slug, '/')
                return (
                  <li key={s.id} className="rounded-xl border border-line bg-paper p-5 shadow-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-serif text-2xl text-ink">{s.title}</h3>
                        <p className="truncate text-sm text-muted">/{s.slug}/</p>
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                        {s.isDefault && <Badge tone="ink">Yours</Badge>}
                        <Badge tone="gold">{plan?.name ?? s.planId}</Badge>
                        <Badge tone={s.open ? 'green' : 'rose'}>{s.open ? 'Open' : s.isActive ? 'Ended' : 'Off'}</Badge>
                      </div>
                    </div>
                    <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <dt className="text-xs text-muted">Guests</dt>
                        <dd className="text-ink">
                          {s.guests}
                          {plan?.guestLimit ? ` / ${plan.guestLimit}` : ''}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Replies</dt>
                        <dd className="text-ink">{s.replies}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Open until</dt>
                        <dd className="text-ink">{s.activeUntil ? fmtDate(s.activeUntil) : 'no end date'}</dd>
                      </div>
                    </dl>
                    <div className="mt-4">
                      <p className="text-xs text-muted">Logins</p>
                      {s.admins.length ? (
                        <ul className="mt-1 flex flex-wrap gap-1.5">
                          {s.admins.map((a) => (
                            <li key={a.userId}>
                              <Badge>
                                {a.username}
                                {a.lastLoginAt ? ` · seen ${fmtDate(a.lastLoginAt)}` : ' · never signed in'}
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-sm text-ink-soft">No login yet.</p>
                      )}
                    </div>
                    {s.notes && <p className="mt-3 rounded-lg bg-cream px-3 py-2 text-sm text-ink-soft">{s.notes}</p>}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button size="sm" variant={s.isActive ? 'subtle' : 'primary'} onClick={() => void quickToggle(s)}>
                        {s.isActive ? 'Switch off' : 'Switch on'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditing({ id: s.id, slug: s.slug, title: s.title, planId: s.planId, isActive: s.isActive, activeUntil: s.activeUntil, notes: s.notes })}
                        icon={<Pencil aria-hidden="true" className="size-4" />}
                      >
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setNewLoginFor(s)} icon={<UserPlus aria-hidden="true" className="size-4" />}>
                        Add login
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => toast.show((await copyText(link)) ? 'Guest link copied.' : link)}
                        icon={<Copy aria-hidden="true" className="size-4" />}
                      >
                        Copy link
                      </Button>
                      <a href={spaceUrl(s.slug, '/admin')} className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-3.5 text-sm text-ink-soft hover:bg-cream hover:text-ink">
                        <ExternalLink aria-hidden="true" className="size-4" /> Dashboard
                      </a>
                    </div>
                  </li>
                )
              })}
              {!shown.length && <p className="text-muted">No showers match.</p>}
            </ul>
          )}
        </section>

        <section aria-labelledby="logins-heading" className="space-y-4">
          <h2 id="logins-heading" className="font-serif text-2xl text-ink">
            Logins
          </h2>
          <div className="overflow-x-auto rounded-xl border border-line bg-paper shadow-card">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-[0.14em] text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Username</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Showers</th>
                  <th className="px-4 py-3 font-medium">Last sign-in</th>
                  <th className="px-4 py-3 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.userId} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-medium text-ink">
                      {a.username} {a.superAdmin && <Badge tone="ink">owner</Badge>}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{a.displayName || '—'}</td>
                    <td className="px-4 py-3 text-ink-soft">{a.spaces.length ? a.spaces.join(', ') : '—'}</td>
                    <td className="px-4 py-3 text-ink-soft">{a.lastLoginAt ? fmtDate(a.lastLoginAt) : 'never'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setLinking(a)} icon={<Link2 aria-hidden="true" className="size-4" />}>
                          Showers
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setPwFor(a)} icon={<KeyRound aria-hidden="true" className="size-4" />}>
                          Password
                        </Button>
                        {!a.superAdmin && (
                          <Button size="sm" variant="danger-quiet" onClick={() => setDeleting(a)} icon={<Trash2 aria-hidden="true" className="size-4" />}>
                            <span className="sr-only">Delete {a.username}</span>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {editing && <SpaceForm value={editing} plans={plans} onClose={() => setEditing(null)} onSaved={() => (setEditing(null), void reload())} />}
      {newLoginFor && (
        <LoginForm
          space={newLoginFor === 'none' ? null : newLoginFor}
          spaces={spaces}
          onClose={() => setNewLoginFor(null)}
          onSaved={() => (setNewLoginFor(null), void reload())}
        />
      )}
      {linking && <LinkForm account={linking} spaces={spaces} onClose={() => setLinking(null)} onSaved={() => void reload()} />}
      {pwFor && <PasswordForm account={pwFor} onClose={() => setPwFor(null)} />}
      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete the login “${deleting?.username ?? ''}”?`}
        message="They won’t be able to sign in any more. Their baby shower and its guests stay as they are."
        confirmLabel="Delete login"
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          const a = deleting
          setDeleting(null)
          if (!a) return
          try {
            await ownerDeleteLogin(a.userId)
            toast.show('Login deleted.')
            void reload()
          } catch (e) {
            toast.show(toFriendlyMessage(e), 'error')
          }
        }}
      />
    </div>
  )
}

function SpaceForm({ value, plans, onClose, onSaved }: { value: SpaceInput; plans: Plan[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [v, setV] = useState<SpaceInput>(value)
  const [slugTouched, setSlugTouched] = useState(Boolean(value.id))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<SpaceInput>) => setV((cur) => ({ ...cur, ...patch }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!v.title.trim() || !v.slug.trim()) {
      setError('Please give the shower a name and a web address.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await ownerSaveSpace(v)
      toast.show(v.id ? 'Saved.' : 'Shower created. Now add a login for them.')
      onSaved()
    } catch (err) {
      setError(toFriendlyMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      locked={saving}
      title={v.id ? 'Edit shower' : 'New shower'}
      description="Switch it on once they’ve paid. Guests and the customer can only use it while it’s on."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="space-form" loading={saving} loadingText="Saving…">
            {v.id ? 'Save' : 'Create shower'}
          </Button>
        </>
      }
    >
      <form id="space-form" onSubmit={submit} className="space-y-4" noValidate>
        <TextField
          label="Name"
          hint="e.g. Baby Cruz"
          value={v.title}
          maxLength={120}
          onChange={(t) => set(slugTouched ? { title: t } : { title: t, slug: slugify(t) })}
          required
          autoFocus
        />
        <TextField
          label="Web address"
          hint={<>Guests open: {spaceUrl(v.slug || 'baby-cruz', '/')}</>}
          value={v.slug}
          maxLength={40}
          onChange={(t) => (setSlugTouched(true), set({ slug: slugify(t) }))}
          autoCapitalize="none"
          spellCheck={false}
          required
        />
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">Plan</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {plans.map((p) => (
              <label
                key={p.id}
                className={`flex cursor-pointer flex-col rounded-lg border px-3 py-2 text-sm ${v.planId === p.id ? 'border-ink bg-cream' : 'border-line bg-paper'}`}
              >
                <input type="radio" name="plan" value={p.id} checked={v.planId === p.id} onChange={() => set({ planId: p.id })} className="sr-only" />
                <span className="font-medium text-ink">{p.name}</span>
                <span className="text-muted">
                  {peso(p.pricePhp)} · {p.guestLimit ? `${p.guestLimit} guests` : 'unlimited'}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex min-h-11 items-center gap-3 rounded-lg border border-line px-3 text-sm">
            <input type="checkbox" checked={v.isActive} onChange={(e) => set({ isActive: e.target.checked })} className="size-4 accent-ink" />
            <span>
              <span className="font-medium text-ink">Switched on</span> <span className="text-muted">(paid)</span>
            </span>
          </label>
          <div>
            <label htmlFor="until" className="mb-2 block text-sm font-medium text-ink">
              Open until <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="until"
              type="date"
              min={today()}
              value={v.activeUntil ?? ''}
              onChange={(e) => set({ activeUntil: e.target.value || null })}
              className="min-h-11 w-full rounded-md border border-line bg-paper px-3 text-sm"
            />
          </div>
        </div>
        <TextField label="Notes (only you see these)" hint="e.g. Paid ₱1,999 by GCash on 20 Oct" value={v.notes} maxLength={500} onChange={(t) => set({ notes: t })} />
        <FieldError>{error}</FieldError>
      </form>
    </Modal>
  )
}

function LoginForm({ space, spaces, onClose, onSaved }: { space: OwnerSpace | null; spaces: OwnerSpace[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [username, setUsername] = useState(space ? space.slug.replace(/-/g, '').slice(0, 24) : '')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState(newPassword)
  const [spaceId, setSpaceId] = useState(space?.id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await ownerCreateLogin({ username, password, displayName, spaceId: spaceId || null })
      const sp = spaces.find((s) => s.id === spaceId)
      setDone(
        [
          'Your baby shower website is ready! 🎈',
          `Sign in: ${window.location.origin}/`,
          `Username: ${username.trim().toLowerCase()}`,
          `Password: ${password}`,
          sp ? `Your guest link: ${spaceUrl(sp.slug, '/')}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      )
      onSaved()
    } catch (err) {
      setError(toFriendlyMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      locked={saving}
      title={done ? 'Login created' : 'New login'}
      description={done ? 'Send this to your customer. The password is shown only now.' : 'The customer signs in with this username and password.'}
      footer={
        done ? (
          <>
            <Button variant="outline" onClick={async () => toast.show((await copyText(done)) ? 'Copied — paste it in Messenger.' : 'Select the text and copy it.')}>
              Copy message
            </Button>
            <Button onClick={onClose}>Done</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="login-form" loading={saving} loadingText="Creating…">
              Create login
            </Button>
          </>
        )
      }
    >
      {done ? (
        <pre className="whitespace-pre-wrap rounded-lg bg-cream p-4 font-sans text-sm text-ink">{done}</pre>
      ) : (
        <form id="login-form" onSubmit={submit} className="space-y-4" noValidate>
          <TextField label="Username" hint="Small letters, numbers, dots or dashes" value={username} onChange={(t) => setUsername(t.toLowerCase().replace(/\s+/g, ''))} autoCapitalize="none" spellCheck={false} maxLength={32} required autoFocus />
          <TextField label="Their name (optional)" value={displayName} onChange={setDisplayName} maxLength={80} />
          <div className="flex items-end gap-2">
            <TextField label="Password" hint="At least 8 characters" value={password} onChange={setPassword} className="flex-1" maxLength={72} required />
            <Button variant="ghost" onClick={() => setPassword(newPassword())}>
              New
            </Button>
          </div>
          <div>
            <label htmlFor="login-space" className="mb-2 block text-sm font-medium text-ink">
              Shower
            </label>
            <select id="login-space" value={spaceId} onChange={(e) => setSpaceId(e.target.value)} className="min-h-11 w-full rounded-md border border-line bg-paper px-3 text-sm">
              <option value="">Not linked yet</option>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} (/{s.slug}/)
                </option>
              ))}
            </select>
          </div>
          <FieldError>{error}</FieldError>
        </form>
      )}
    </Modal>
  )
}

function LinkForm({ account, spaces, onClose, onSaved }: { account: OwnerAccount; spaces: OwnerSpace[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const linked = new Set(account.spaces)
  const [state, setState] = useState(linked)
  const toggle = async (s: OwnerSpace) => {
    const on = !state.has(s.slug)
    setBusy(s.id)
    try {
      await ownerSetMember(account.userId, s.id, on)
      setState((cur) => {
        const next = new Set(cur)
        if (on) next.add(s.slug)
        else next.delete(s.slug)
        return next
      })
      onSaved()
    } catch (e) {
      toast.show(toFriendlyMessage(e), 'error')
    } finally {
      setBusy(null)
    }
  }
  return (
    <Modal open onClose={onClose} title={`Showers for ${account.username}`} description="Tick the showers this login can manage." footer={<Button onClick={onClose}>Done</Button>}>
      <ul className="space-y-2">
        {spaces.map((s) => (
          <li key={s.id}>
            <label className="flex min-h-11 items-center gap-3 rounded-lg border border-line px-3 text-sm">
              <input type="checkbox" checked={state.has(s.slug)} disabled={busy === s.id} onChange={() => void toggle(s)} className="size-4 accent-ink" />
              <span className="flex-1 text-ink">{s.title}</span>
              <span className="text-muted">/{s.slug}/</span>
            </label>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

function PasswordForm({ account, onClose }: { account: OwnerAccount; onClose: () => void }) {
  const toast = useToast()
  const [password, setPassword] = useState(newPassword)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await ownerSetPassword(account.userId, password)
      const ok = await copyText(`Username: ${account.username}\nNew password: ${password}`)
      toast.show(ok ? 'Password changed — copied for you to send.' : 'Password changed.')
      onClose()
    } catch (err) {
      setError(toFriendlyMessage(err))
    } finally {
      setSaving(false)
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      locked={saving}
      title={`New password for ${account.username}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="pw-form" loading={saving} loadingText="Saving…">
            Set password
          </Button>
        </>
      }
    >
      <form id="pw-form" onSubmit={submit} className="flex items-end gap-2" noValidate>
        <TextField label="New password" hint="At least 8 characters" value={password} onChange={setPassword} className="flex-1" maxLength={72} required autoFocus />
        <Button variant="ghost" onClick={() => setPassword(newPassword())}>
          New
        </Button>
      </form>
      <FieldError>{error}</FieldError>
    </Modal>
  )
}
