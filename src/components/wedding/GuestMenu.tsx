import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Armchair, Camera, Clapperboard, Gift, Images, Info, KeyRound, LogOut, Mail, Menu, X } from 'lucide-react'
import { useHost } from '../../hooks/hostContext'
import { useWeddingSettings } from '../../hooks/useWeddingSettings'
import { useDisplayPrefs } from '../../hooks/useDisplayPrefs'
import { getGuestPhotosInfo } from '../../services/guestPhotosService'
import { isFinderOpen, isRsvpOpen } from '../../services/settingsService'
import { firstName, forgetKnownGuest, knownGuest, type KnownGuest } from '../../utils/guestIdentity'
import { CoupleNames } from './CoupleNames'
import { cn } from '../ui/cn'

/** The guest this phone remembers (updates when it changes). */
export function useKnownGuest(): KnownGuest | null {
  const [g, setG] = useState(knownGuest)
  useEffect(() => {
    const on = () => setG(knownGuest())
    window.addEventListener('wedding-guest', on)
    window.addEventListener('storage', on)
    return () => {
      window.removeEventListener('wedding-guest', on)
      window.removeEventListener('storage', on)
    }
  }, [])
  return g
}

interface Item {
  to: string
  label: string
  hint: string
  icon: typeof Mail
}

/** Everything a guest can do, by name — shows only what has been switched on in the admin. */
export function useGuestLinks(): Item[] {
  const { settings } = useWeddingSettings()
  const display = useDisplayPrefs()
  const [photos, setPhotos] = useState(false)
  useEffect(() => {
    let alive = true
    getGuestPhotosInfo()
      .then((i) => alive && setPhotos(i.visible))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])
  if (!settings) return []
  const items: Item[] = [{ to: '/#details', label: 'Shower details', hint: 'Date, venue and what to know', icon: Info }]
  if (isRsvpOpen(settings)) items.push({ to: '/rsvp', label: settings.rsvpButtonLabel.trim().toUpperCase() === 'RSVP' ? 'RSVP' : settings.rsvpButtonLabel, hint: 'Let us know if you can come', icon: Mail })
  if (isFinderOpen(settings.seatingConfig, display?.revealAt)) items.push({ to: '/seat', label: 'Find my seat', hint: 'Your table at the shower', icon: Armchair })
  if (photos) items.push({ to: '/photos', label: 'Photos', hint: 'See and share photos from the shower', icon: Camera })
  return items
}

/** "Menu" button + a panel listing every page by name. */
export function GuestMenu({ tone = 'light' }: { tone?: 'light' | 'onPhoto' }) {
  const [open, setOpen] = useState(false)
  const items = useGuestLinks()
  const host = useHost()
  const guest = useKnownGuest()
  const { settings } = useWeddingSettings()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const reduce = useReducedMotion()

  // Just unlocked host mode: open the menu to show the host's tools.
  useEffect(() => {
    const on = () => setOpen(true)
    window.addEventListener('wedding-host-on', on)
    return () => window.removeEventListener('wedding-host-on', on)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const go = (to: string) => {
    setOpen(false)
    if (to === '/#details') {
      if (pathname !== '/') navigate('/')
      window.setTimeout(() => document.getElementById('details')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }), pathname === '/' ? 50 : 400)
    } else navigate(to)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[0.7rem] font-medium uppercase tracking-[0.2em] transition',
          tone === 'onPhoto' ? 'border-white/40 text-white/90 hover:border-white hover:bg-white/10' : 'border-line bg-paper/80 text-ink-soft hover:border-champagne hover:text-ink',
        )}
      >
        <Menu aria-hidden="true" className="size-4" strokeWidth={1.6} />
        <span>Menu</span>
        {host.isHost && <span className="-mr-1 ml-0.5 rounded-full bg-champagne px-1.5 py-0.5 text-[0.55rem] leading-none tracking-[0.15em] text-white">Host</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[60]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" aria-label="Close the menu" className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
            <motion.nav
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              initial={reduce ? { opacity: 0 } : { x: '100%' }}
              animate={reduce ? { opacity: 1 } : { x: 0 }}
              exit={reduce ? { opacity: 0 } : { x: '100%' }}
              transition={{ type: 'tween', duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-y-0 right-0 flex w-[min(22rem,88vw)] flex-col overflow-y-auto bg-ivory px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] text-left shadow-lift"
            >
              <div className="flex items-center justify-between">
                <p className="font-serif text-2xl text-ink">{settings && <CoupleNames names={settings.babyName} />}</p>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close" autoFocus className="grid size-10 place-items-center rounded-full text-ink-soft hover:bg-cream">
                  <X className="size-5" />
                </button>
              </div>
              {guest && (
                <p className="mt-3 text-sm text-ink-soft">
                  Hi <span className="font-medium text-ink">{firstName(guest.name)}</span> 👋{' '}
                  <button type="button" onClick={forgetKnownGuest} className="ml-1 text-xs text-muted underline-offset-4 hover:text-ink hover:underline">
                    Not you?
                  </button>
                </p>
              )}
              <ul className="mt-6 space-y-1">
                {items.map((it) => {
                  const Icon = it.icon
                  const here = it.to === pathname
                  return (
                    <li key={it.to}>
                      <button
                        type="button"
                        onClick={() => go(it.to)}
                        className={cn('flex w-full items-center gap-4 rounded-xl px-3 py-3 text-left transition hover:bg-cream', here && 'bg-cream')}
                        aria-current={here ? 'page' : undefined}
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-champagne-light/60 text-gold">
                          <Icon aria-hidden="true" className="size-5" strokeWidth={1.5} />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-serif text-xl text-ink">{it.label}</span>
                          <span className="block truncate text-xs text-muted">{it.hint}</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
                {!host.isHost && host.codeOn && (
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false)
                        host.askCode()
                      }}
                      className="flex w-full items-center gap-4 rounded-xl px-3 py-3 text-left transition hover:bg-cream"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-champagne-light">
                        <KeyRound aria-hidden="true" className="size-[18px]" strokeWidth={1.6} />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-serif text-xl text-ink">Host mode</span>
                        <span className="block truncate text-xs text-muted">Raffle, Bingo & the big screen</span>
                      </span>
                    </button>
                  </li>
                )}
              </ul>
              {host.isHost && (
                <div className="mt-6 rounded-2xl border border-champagne/50 bg-paper p-2">
                  <p className="flex items-center justify-between px-3 pb-1 pt-2 text-[0.65rem] font-medium uppercase tracking-[0.3em] text-gold">
                    Host mode
                    {host.token && (
                      <button type="button" onClick={host.leave} className="inline-flex items-center gap-1 text-[0.65rem] normal-case tracking-normal text-muted underline-offset-4 hover:text-ink hover:underline">
                        <LogOut aria-hidden="true" className="size-3" /> Leave
                      </button>
                    )}
                  </p>
                  <ul>
                    {(
                      [
                        { to: '/raffle', label: 'Raffle & Bingo', hint: 'Spin, draw and present', icon: Gift },
                        { to: '/present/guests', label: 'Present guest photos', hint: 'Photos shared by guests, live', icon: Images },
                        { to: '/present/ours', label: 'Present our photos & videos', hint: 'From the shower website', icon: Clapperboard },
                      ] as const
                    ).map((it) => {
                      const Icon = it.icon
                      return (
                        <li key={it.to}>
                          <button type="button" onClick={() => go(it.to)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-cream">
                            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-champagne-light">
                              <Icon aria-hidden="true" className="size-4" strokeWidth={1.6} />
                            </span>
                            <span className="min-w-0">
                              <span className="block font-serif text-lg leading-tight text-ink">{it.label}</span>
                              <span className="block truncate text-xs text-muted">{it.hint}</span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
              <Link to="/" onClick={() => setOpen(false)} className="mt-auto pt-6 text-center text-xs uppercase tracking-[0.3em] text-muted hover:text-ink">
                Home
              </Link>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
