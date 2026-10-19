import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { rememberGuest } from '../utils/guestIdentity'
import { useFinderOpen } from '../hooks/useFinderOpen'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Armchair, CalendarPlus, Globe, MapPin } from 'lucide-react'
import { useWeddingSettings } from '../hooks/useWeddingSettings'
import { useInvitationCard, type CardGuest } from '../hooks/useInvitationCard'
import { openInvitation, type VirtualInvitation } from '../services/virtualInviteService'
import { isRsvpOpen } from '../services/settingsService'
import { cardPosition } from '../utils/positions'
import { formatDeadlineDate } from '../utils/formatting'
import { calendarUrl } from '../utils/calendar'
import { toFriendlyMessage } from '../utils/errors'
import type { WeddingSettings } from '../types/wedding'
import { PageLoader } from '../components/ui/Spinner'
import { Footer } from '../components/wedding/Footer'
import { CoupleNames } from '../components/wedding/CoupleNames'
import { Envelope, FlipCard, useCardWidth } from '../components/invitation/InviteEnvelope'
import { EventDetails } from '../components/rsvp/EventDetails'

const EASE = [0.22, 1, 0.36, 1] as const

type Stage = 'sealed' | 'opening' | 'card'
type Load = { status: 'loading' } | { status: 'ready'; inv: VirtualInvitation } | { status: 'missing' } | { status: 'error'; message: string }

const openedKey = (code: string) => `wedding-invite-opened:${code}`
function wasOpened(code: string): boolean {
  try {
    return sessionStorage.getItem(openedKey(code)) === '1'
  } catch {
    return false
  }
}
function rememberOpened(code: string) {
  try {
    sessionStorage.setItem(openedKey(code), '1')
  } catch {
    // private mode — the envelope simply shows again next time
  }
}

export default function VirtualInvitationPage() {
  const { code = '' } = useParams()
  const { settings, loading: settingsLoading } = useWeddingSettings()
  const reduce = useReducedMotion()
  const cardW = useCardWidth(250)

  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [stage, setStage] = useState<Stage>(() => (wasOpened(code) ? 'card' : 'sealed'))
  const loadedFor = useRef<string | null>(null)

  // Load the invitation once per code (this also records that it was opened).
  useEffect(() => {
    if (loadedFor.current === code) return
    loadedFor.current = code
    setLoad({ status: 'loading' })
    openInvitation(code)
      .then((inv) => {
        setLoad(inv ? { status: 'ready', inv } : { status: 'missing' })
        if (inv) rememberGuest({ name: inv.inviteeName })
      })
      .catch((e) => setLoad({ status: 'error', message: toFriendlyMessage(e) }))
  }, [code])

  const inv = load.status === 'ready' ? load.inv : null
  const coupleNames = settings?.coupleNames ?? ''

  useEffect(() => {
    document.title = coupleNames ? `You’re invited · ${coupleNames}` : 'You’re invited'
  }, [coupleNames])

  const rsvpOpen = settings ? isRsvpOpen(settings) : false
  const respondBy = settings && rsvpOpen && settings.rsvpShowDeadline && settings.rsvpDeadline && !inv?.attendanceStatus ? formatDeadlineDate(settings.rsvpDeadline) : null

  const guest = useMemo<CardGuest | null>(
    () =>
      inv && settings
        ? {
            inviteeName: inv.inviteeName,
            includedGuests: inv.includedGuests,
            position: cardPosition(inv, settings.entourage),
            respondBy,
            confirmed: inv.attendanceStatus === 'attending',
            addressedAs: inv.addressedAs,
          }
        : null,
    [inv, settings, respondBy],
  )
  const card = useInvitationCard(guest)

  const open = () => {
    rememberOpened(code)
    setStage(reduce ? 'card' : 'opening')
  }

  return (
    <div
      className="flex min-h-[100svh] flex-col"
      style={{ background: 'radial-gradient(ellipse 120% 80% at 50% 34%, var(--color-paper) 0%, var(--color-cream) 58%, var(--color-linen) 100%)' }}
    >
      <main className="flex flex-1 flex-col items-center px-5 pb-16 pt-8 sm:pt-12">
        {load.status === 'missing' || load.status === 'error' ? (
          <Notice
            title={load.status === 'missing' ? 'This invitation link isn’t working' : 'Your invitation didn’t load'}
            body={
              load.status === 'missing'
                ? 'The link may be incomplete. Check that the whole link was copied, or find your invitation by name.'
                : load.message
            }
          />
        ) : !inv || !card.ready || !card.theme || (settingsLoading && !settings) ? (
          <PageLoader label="Opening your invitation" />
        ) : (
          <>
            {coupleNames && (
              <motion.p
                className="text-center font-serif text-xl font-light text-ink-soft"
                animate={{ opacity: stage === 'opening' ? 0 : 1 }}
                transition={{ duration: 0.4 }}
              >
                <CoupleNames names={coupleNames} />
              </motion.p>
            )}
            <AnimatePresence mode="wait">
              {stage !== 'card' ? (
                <motion.div key="envelope" className="flex w-full flex-1 flex-col items-center justify-center" exit={{ opacity: 0, transition: { duration: 0.45 } }}>
                  <Envelope
                    name={inv.addressedAs || inv.inviteeName}
                    theme={card.theme}
                    monogramText={card.monogramText}
                    monogramArt={card.monogramArt}
                    cardW={cardW}
                    frontHtml={card.frontHtml}
                    opening={stage === 'opening'}
                    onOpen={open}
                    onOpened={() => setStage('card')}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="card"
                  className="flex w-full flex-col items-center"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.6, ease: EASE }}
                >
                  <FlipCard frontHtml={card.frontHtml} backHtml={card.backHtml} width={cardW} />
                  {settings && <Actions inv={inv} settings={settings} code={code} rsvpOpen={rsvpOpen} respondBy={respondBy} hideLinks={card.hideLinks} />}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </main>

      {stage === 'card' && settings && card.ready && <Footer coupleNames={settings.coupleNames} weddingDate={settings.weddingDate} closingMessage={settings.closingMessage} />}
    </div>
  )
}

// ---------------------------------------------------------------- what to do next

function Actions({
  inv,
  settings,
  code,
  rsvpOpen,
  respondBy,
  hideLinks,
}: {
  inv: VirtualInvitation
  settings: WeddingSettings
  code: string
  rsvpOpen: boolean
  respondBy: string | null
  hideLinks: boolean
}) {
  const replied = inv.attendanceStatus
  const finderOpen = useFinderOpen()
  const seatOpen = replied === 'attending' && finderOpen
  const primary = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-8 text-[0.95rem] font-medium text-ivory shadow-soft transition hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2'

  let message: ReactNode = null
  let action: ReactNode = null
  if (replied === 'attending') {
    message = 'You’ve told us you’re coming. Thank you — we can’t wait to celebrate with you.'
    if (seatOpen)
      action = (
        <Link to="/seat" state={{ name: inv.inviteeName }} className={primary}>
          <Armchair aria-hidden="true" className="size-4" strokeWidth={1.6} />
          Find my seat
        </Link>
      )
  } else if (replied === 'declining') {
    message = 'Thank you for letting us know. You’ll be missed.'
  } else if (rsvpOpen) {
    action = (
      <Link to={`/rsvp?invite=${encodeURIComponent(code)}&from=card`} className={primary}>
        {settings.rsvpButtonLabel?.trim() || 'RSVP'}
      </Link>
    )
    if (respondBy) message = `Please reply by ${respondBy}.`
  } else {
    message = settings.rsvpClosedMessage || 'Our RSVP list is now closed.'
  }

  const link = 'inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm text-ink-soft underline-offset-4 transition hover:text-ink hover:underline'
  return (
    <div className="mt-6 flex w-full max-w-md flex-col items-center text-center">
      {replied === 'attending' && <EventDetails venues={settings} className="mb-5" />}
      {action}
      {message && <p className={`max-w-sm font-serif text-lg italic leading-relaxed text-ink-soft ${action ? 'mt-4' : ''}`}>{message}</p>}
      <nav aria-label="More about the wedding" className="mt-8 flex flex-wrap justify-center gap-x-1 gap-y-1">
        <Link to="/" className={link}>
          <Globe aria-hidden="true" className="size-3.5" strokeWidth={1.6} />
          Our wedding website
        </Link>
        {!hideLinks && (
        <a href={calendarUrl(settings)} target="_blank" rel="noopener noreferrer" className={link}>
          <CalendarPlus aria-hidden="true" className="size-3.5" strokeWidth={1.6} />
          Add to calendar
        </a>
        )}
        {!hideLinks && settings.churchMapUrl && (
          <a href={settings.churchMapUrl} target="_blank" rel="noopener noreferrer" className={link}>
            <MapPin aria-hidden="true" className="size-3.5" strokeWidth={1.6} />
            Ceremony map
          </a>
        )}
        {!hideLinks && settings.receptionMapUrl && (
          <a href={settings.receptionMapUrl} target="_blank" rel="noopener noreferrer" className={link}>
            <MapPin aria-hidden="true" className="size-3.5" strokeWidth={1.6} />
            Reception map
          </a>
        )}
      </nav>
    </div>
  )
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <section className="flex max-w-md flex-1 flex-col items-center justify-center text-center">
      <h1 className="text-3xl leading-tight text-ink sm:text-4xl">{title}</h1>
      <p className="mt-4 leading-relaxed text-ink-soft">{body}</p>
      <Link
        to="/rsvp"
        className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-ink px-8 text-[0.95rem] font-medium text-ivory shadow-soft transition hover:bg-ink-soft"
      >
        Find my invitation
      </Link>
    </section>
  )
}
