import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Armchair, CalendarClock, Camera, Music, ExternalLink, Search, Gift, Baby, ListChecks, Images, LayoutDashboard, Palette, LogOut, Mail, Menu, MessageSquareHeart, PanelLeftClose, PanelLeftOpen, Pin, PinOff, Printer, QrCode, Settings, Shirt, UserPlus, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { useWeddingSettings } from '../hooks/useWeddingSettings'
import type { AdminOutletContext } from '../hooks/useAdminData'
import { loadAdminData, type AdminData } from '../services/adminService'
import { toFriendlyMessage } from '../utils/errors'
import { cn } from '../components/ui/cn'
import { syncSharePreview } from '../utils/sharePreview'
import { prefetchAdminPages } from '../utils/prefetchAdmin'
import { Monogram } from '../components/wedding/Monogram'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { QuickSearch } from '../components/admin/QuickSearch'
import { UnsavedContext } from '../hooks/unsavedChanges'
import { CrashTest, PageErrorBoundary } from '../components/ui/ErrorBoundary'

const NAV_GROUPS: { title: string | null; items: { to: string; label: string; icon: typeof Mail; end?: boolean }[] }[] = [
  { title: null, items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
  {
    title: 'Invite & print',
    items: [
      { to: '/admin/invitations', label: 'Invitations', icon: Mail },
      { to: '/admin/printables', label: 'Printables', icon: Printer },
      { to: '/admin/share', label: 'Share & QR', icon: QrCode },
    ],
  },
  {
    title: 'Guests',
    items: [
      { to: '/admin/responses', label: 'Responses', icon: MessageSquareHeart },
      { to: '/admin/guests', label: 'Extra guests', icon: UserPlus },
      { to: '/admin/questions', label: 'RSVP Questions', icon: ListChecks },
      { to: '/admin/seating', label: 'Seating', icon: Armchair },
      { to: '/admin/raffle', label: 'Raffle', icon: Gift },
    ],
  },
  {
    title: 'Website',
    items: [
      { to: '/admin/media', label: 'Photos & Video', icon: Images },
      { to: '/admin/guest-photos', label: 'Guest Photos', icon: Camera },
      { to: '/admin/music', label: 'Music', icon: Music },
      { to: '/admin/outfits', label: 'What to Wear', icon: Shirt },
      { to: '/admin/schedule', label: 'Schedule', icon: CalendarClock },
      { to: '/admin/look', label: 'Look & Feel', icon: Palette },
      { to: '/admin/settings', label: 'Website Settings', icon: Settings },
    ],
  },
]
const ALL_PAGES = NAV_GROUPS.flatMap((g) => g.items.map((i) => ({ to: i.to, label: i.label })))

/** Pages with wide tables or previews get more room. */
const WIDE_PAGES = ['/admin/invitations', '/admin/responses', '/admin/guests', '/admin/printables', '/admin/seating']

type SidebarPrefs = { collapsed: boolean; autoExpand: boolean }
const SIDEBAR_KEY = 'wedding-admin-sidebar'
function readSidebar(): SidebarPrefs {
  try {
    const v = JSON.parse(localStorage.getItem(SIDEBAR_KEY) ?? 'null') as Partial<SidebarPrefs> | null
    return { collapsed: Boolean(v?.collapsed), autoExpand: v?.autoExpand !== false }
  } catch {
    return { collapsed: false, autoExpand: true }
  }
}

export default function AdminLayout() {
  const { signOut, session } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const { settings } = useWeddingSettings()
  const [menuOpen, setMenuOpen] = useState(false)
  // Desktop sidebar: open (default) or icons only; when icons only it can open on hover.
  const [side, setSide] = useState<SidebarPrefs>(readSidebar)
  const [peek, setPeek] = useState(false)
  const peekTimer = useRef<number | undefined>(undefined)
  const setSidebar = (patch: Partial<SidebarPrefs>) =>
    setSide((cur) => {
      const next = { ...cur, ...patch }
      try {
        localStorage.setItem(SIDEBAR_KEY, JSON.stringify(next))
      } catch {
        /* private mode: just for this visit */
      }
      return next
    })
  const narrow = side.collapsed && !peek
  // A short delay before opening / closing on hover, so passing the mouse over it doesn't flicker.
  const hoverIn = () => {
    if (!side.collapsed || !side.autoExpand) return
    window.clearTimeout(peekTimer.current)
    peekTimer.current = window.setTimeout(() => setPeek(true), 180)
  }
  const hoverOut = () => {
    window.clearTimeout(peekTimer.current)
    peekTimer.current = window.setTimeout(() => setPeek(false), 260)
  }
  useEffect(() => () => window.clearTimeout(peekTimer.current), [])
  useEffect(() => setPeek(false), [location.pathname])
  // "[" toggles the sidebar (not while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (e.key !== '[' || e.ctrlKey || e.metaKey || e.altKey || el?.closest('input, textarea, select, [contenteditable="true"]')) return
      setSidebar({ collapsed: !side.collapsed })
      setPeek(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side.collapsed])
  const [data, setData] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await loadAdminData())
    } catch (e) {
      setError(toFriendlyMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  // Keep the Messenger link-preview image in step with the website (names, date, hero, design).
  useEffect(() => {
    if (settings && session) void syncSharePreview(settings)
  }, [settings, session])

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  // While the phone menu is open, the page behind it must not scroll.
  useEffect(() => {
    if (!menuOpen) return
    const html = document.documentElement
    const body = document.body
    const prev = { html: html.style.overflow, body: body.style.overflow, touch: body.style.touchAction }
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', onKey)
    return () => {
      html.style.overflow = prev.html
      body.style.overflow = prev.body
      body.style.touchAction = prev.touch
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  // Unsaved changes on the current page: leaving through the menu asks first.
  const unsaved = useRef(new Map<string, string>())
  const [, bump] = useState(0)
  const unsavedApi = useMemo(
    () => ({
      set: (id: string, label: string | null) => {
        const had = unsaved.current.get(id)
        if (label) unsaved.current.set(id, label)
        else unsaved.current.delete(id)
        if (had !== (label ?? undefined)) bump((n) => n + 1)
      },
    }),
    [],
  )
  const [leaving, setLeaving] = useState<null | { to: string; state?: unknown } | 'logout'>(null)
  const go = (to: string, state?: unknown) => {
    if (unsaved.current.size && to !== location.pathname) setLeaving({ to, state })
    else navigate(to, state === undefined ? undefined : { state })
  }
  const guardLink = (to: string) => (e: ReactMouseEvent) => {
    if (!unsaved.current.size || to === location.pathname || e.metaKey || e.ctrlKey || e.shiftKey) return
    e.preventDefault()
    setLeaving({ to })
  }
  const doLogout = async () => {
    await signOut()
    toast.show('You have been signed out.')
    navigate('/admin/login', { replace: true })
  }
  const logout = () => (unsaved.current.size ? setLeaving('logout') : void doLogout())
  const confirmLeave = () => {
    const l = leaving
    setLeaving(null)
    unsaved.current.clear()
    if (l === 'logout') void doLogout()
    else if (l) navigate(l.to, l.state === undefined ? undefined : { state: l.state })
  }

  // Quick search: Ctrl/⌘+K from any admin page.
  const [searchOpen, setSearchOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const context: AdminOutletContext = { data, loading, error, reload }

  // Switching tabs feels instant: every admin page downloads quietly in the background.
  useEffect(() => prefetchAdminPages(), [])

  // Scrolling list of pages + a footer that always stays visible. `slim`: icons only (labels as tooltips).
  const navFor = (slim: boolean) => (
    <div className="flex min-h-0 flex-1 flex-col">
      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        title={slim ? 'Quick search (Ctrl+K)' : undefined}
        aria-label="Quick search (Ctrl+K)"
        aria-keyshortcuts="Control+K Meta+K"
        className={cn('mb-3 flex min-h-10 w-full shrink-0 items-center gap-2.5 rounded-lg border border-line bg-paper px-3 text-sm text-muted transition hover:border-champagne hover:text-ink', slim && 'justify-center px-0')}
      >
        <Search aria-hidden="true" className="size-4 shrink-0" />
        {!slim && (
          <>
            <span className="flex-1 text-left">Search guests…</span>
            <kbd className="rounded border border-line px-1.5 py-0.5 font-sans text-[0.65rem] text-muted">Ctrl K</kbd>
          </>
        )}
      </button>
      <nav aria-label="Admin" className="-mx-1 min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-1 pb-2">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className={cn(gi > 0 && 'mt-4')}>
            {group.title &&
              (slim ? (
                <div aria-hidden="true" className="mx-3 mb-2 border-t border-line" />
              ) : (
                <p className="mb-1 whitespace-nowrap px-3 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted">{group.title}</p>
              ))}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={guardLink(item.to)}
                  title={slim ? item.label : undefined}
                  aria-label={slim ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-11 items-center gap-3 whitespace-nowrap rounded-lg px-3 text-[0.95rem] transition focus-visible:ring-2 focus-visible:ring-champagne',
                      slim && 'justify-center px-0',
                      isActive ? 'bg-ink text-ivory shadow-soft' : 'text-ink-soft hover:bg-cream hover:text-ink',
                    )
                  }
                >
                  <item.icon aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={1.6} />
                  {!slim && item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="shrink-0 space-y-1 border-t border-line pt-3">
        <a
          href="#/"
          target="_blank"
          rel="noopener noreferrer"
          title={slim ? 'View website' : undefined}
          aria-label={slim ? 'View website' : undefined}
          className={cn('flex min-h-11 items-center gap-3 whitespace-nowrap rounded-lg px-3 text-[0.95rem] text-ink-soft transition hover:bg-cream hover:text-ink', slim && 'justify-center px-0')}
        >
          <ExternalLink aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={1.6} />
          {!slim && 'View website'}
        </a>
        <button
          type="button"
          onClick={logout}
          title={slim ? 'Logout' : undefined}
          aria-label={slim ? 'Logout' : undefined}
          className={cn('flex min-h-11 w-full items-center gap-3 whitespace-nowrap rounded-lg px-3 text-left text-[0.95rem] text-ink-soft transition hover:bg-rose/10 hover:text-rose', slim && 'justify-center px-0')}
        >
          <LogOut aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={1.6} />
          {!slim && 'Logout'}
        </button>
        {!slim && session?.user.email && <p className="truncate px-3 pt-1 text-xs text-muted">{session.user.email}</p>}
      </div>
    </div>
  )
  const nav = navFor(false)

  const heart = (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-champagne/60 text-champagne">
      <Baby aria-hidden="true" className="size-4" strokeWidth={1.5} />
    </span>
  )
  const brand = (
    <div className="flex items-center gap-2.5">
      {heart}
      <div className="leading-tight">
        <p className="font-serif text-xl text-ink">{settings?.babyName || 'Baby Shower'}</p>
        <p className="text-[0.65rem] uppercase tracking-[0.22em] text-muted">Baby shower admin</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-[100svh] bg-ivory print:min-h-0">
      {/* Desktop sidebar: open, or a strip of icons that can open on hover (over the page, without moving it). */}
      <aside
        aria-label="Sidebar"
        onMouseEnter={hoverIn}
        onMouseLeave={hoverOut}
        onFocus={hoverIn}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hoverOut()
        }}
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col gap-6 overflow-hidden border-r border-line bg-paper py-6 transition-[width,box-shadow] duration-200 ease-out motion-reduce:transition-none print:hidden lg:flex',
          narrow ? 'w-[72px] px-2.5' : 'w-64 px-4',
          side.collapsed && peek && 'shadow-lift',
        )}
      >
        <div className={cn('flex items-center gap-2', narrow ? 'flex-col' : 'justify-between px-2')}>
          {narrow ? heart : brand}
          <button
            type="button"
            onClick={() => {
              setSidebar({ collapsed: !side.collapsed })
              setPeek(false)
            }}
            aria-label={side.collapsed ? 'Keep the sidebar open' : 'Collapse the sidebar'}
            title={`${side.collapsed ? 'Keep the sidebar open' : 'Collapse the sidebar'} ( [ )`}
            className="rounded-lg p-2 text-muted transition hover:bg-cream hover:text-ink"
          >
            {side.collapsed ? <PanelLeftOpen aria-hidden="true" className="size-[18px]" /> : <PanelLeftClose aria-hidden="true" className="size-[18px]" />}
          </button>
        </div>
        {navFor(narrow)}
        {side.collapsed && (
          <button
            type="button"
            onClick={() => setSidebar({ autoExpand: !side.autoExpand })}
            aria-pressed={side.autoExpand}
            title={side.autoExpand ? 'Opens when you point at it — click to turn off' : 'Stays as icons — click to open it when you point at it'}
            className={cn('-mt-3 flex min-h-9 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-xs text-muted transition hover:bg-cream hover:text-ink', narrow && 'justify-center px-0')}
          >
            {side.autoExpand ? <Pin aria-hidden="true" className="size-4 shrink-0" /> : <PinOff aria-hidden="true" className="size-4 shrink-0" />}
            {!narrow && (side.autoExpand ? 'Opens on hover' : 'Hover opening off')}
          </button>
        )}
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper/95 print:hidden px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur lg:hidden">
        {brand}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-controls="admin-mobile-menu"
          className="rounded-lg p-2.5 text-ink hover:bg-cream"
        >
          <Menu className="size-6" />
        </button>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <div className="fixed inset-0 z-40 overscroll-none lg:hidden">
            <motion.div
              className="absolute inset-0 touch-none bg-ink/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
            />
            <motion.aside
              id="admin-mobile-menu"
              role="dialog"
              aria-modal="true"
              aria-label="Admin menu"
              className="absolute left-0 top-0 flex h-[100dvh] w-[min(82vw,300px)] flex-col gap-5 bg-paper px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] shadow-lift"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
            >
              <div className="flex items-center justify-between px-2">
                {brand}
                <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu" className="rounded-lg p-2 hover:bg-cream">
                  <X className="size-5" />
                </button>
              </div>
              {nav}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <main
        style={{ '--sidebar-w': side.collapsed ? '72px' : '16rem' } as CSSProperties}
        className="px-4 pb-16 pt-6 transition-[margin] duration-200 ease-out motion-reduce:transition-none sm:px-6 lg:ml-[var(--sidebar-w)] lg:px-10 lg:pt-10 print:m-0 print:p-0"
      >
        <div className={cn('mx-auto print:max-w-none', WIDE_PAGES.some((p) => location.pathname.startsWith(p)) ? 'max-w-[1500px]' : 'max-w-6xl')}>
          <UnsavedContext.Provider value={unsavedApi}>
            <PageErrorBoundary variant="admin">
              <CrashTest flag="crashadmin" />
              <Suspense fallback={<AdminPageLoader />}>
                <Outlet context={context} />
              </Suspense>
            </PageErrorBoundary>
          </UnsavedContext.Provider>
        </div>
      </main>
      <QuickSearch open={searchOpen} onClose={() => setSearchOpen(false)} data={data} pages={ALL_PAGES} go={go} />
      <ConfirmDialog
        open={leaving !== null}
        title="Leave without saving?"
        message={
          <>
            <p>
              You have unsaved changes in <strong className="text-ink">{[...new Set(unsaved.current.values())].join(', ')}</strong>.
            </p>
            <p className="mt-2">If you leave now, they’ll be lost. Stay to save them first.</p>
          </>
        }
        destructive
        confirmLabel={leaving === 'logout' ? 'Log out without saving' : 'Leave without saving'}
        cancelLabel="Stay on this page"
        onCancel={() => setLeaving(null)}
        onConfirm={confirmLeave}
      />
    </div>
  )
}

/** Shown in the content area (the menu stays put) while a page loads. */
function AdminPageLoader() {
  return (
    <div role="status" className="flex min-h-[55vh] flex-col items-center justify-center gap-3 text-champagne">
      <Monogram className="animate-pulse font-serif text-4xl italic" height="64px" />
      <span className="text-xs uppercase tracking-[0.3em] text-muted">Loading</span>
    </div>
  )
}

