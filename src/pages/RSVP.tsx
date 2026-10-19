import { useEffect, useMemo, useRef, useState } from 'react'
import { knownGuest, rememberGuest } from '../utils/guestIdentity'
import { useFinderOpen } from '../hooks/useFinderOpen'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useInvitation } from '../hooks/useInvitation'
import { useWeddingSettings } from '../hooks/useWeddingSettings'
import { useRsvpQuestions } from '../hooks/useRsvpQuestions'
import { submitRSVP } from '../services/rsvpService'
import type { AttendanceStatus, RSVPFormState } from '../types/rsvp'
import type { PublicGift } from '../types/wedding'
import { isRsvpOpen } from '../services/settingsService'
import { getInvitationGift } from '../services/giftService'
import { getInvitationSeat } from '../services/seatingService'
import { GiftCard } from '../components/wedding/GiftCard'
import { PageLoader } from '../components/ui/Spinner'
import { CalendarClock, MailOpen } from 'lucide-react'
import { RsvpClosedError, toFriendlyMessage } from '../utils/errors'
import { formatDeadlineDate, formatWeddingDate } from '../utils/formatting'
import { toSubmission } from '../utils/validation'
import { SearchForm } from '../components/rsvp/SearchForm'
import { RaffleTeaser } from '../components/rsvp/RaffleTeaser'
import { IncludedNotice } from '../components/rsvp/IncludedNotice'
import { Envelope, FlipCard, useCardWidth } from '../components/invitation/InviteEnvelope'
import { useInvitationCard, type CardGuest } from '../hooks/useInvitationCard'
import { getInvitationCard, recordInvitationOpen, type CardDetails } from '../services/virtualInviteService'
import { cardPosition } from '../utils/positions'
import { Button } from '../components/ui/Button'
import { RSVPForm } from '../components/rsvp/RSVPForm'
import { EMPTY_RSVP } from '../components/rsvp/rsvpDefaults'
import { SuccessState } from '../components/rsvp/SuccessState'
import { EventDetails } from '../components/rsvp/EventDetails'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Ornament } from '../components/ui/Ornament'
import { PublicHeader } from '../components/wedding/PublicHeader'
import { Footer } from '../components/wedding/Footer'
import { CoupleNames } from '../components/wedding/CoupleNames'

type Step = 'search' | 'found' | 'card' | 'form' | 'success'

const FALLBACK = { coupleNames: 'Mir & Ella', weddingDate: '2026-12-19' }

export default function RSVP() {
  const { settings, loading: settingsLoading } = useWeddingSettings()
  const { questions } = useRsvpQuestions()
  const { status, invitation, included, error, searchByName, searchByCode } = useInvitation()
  const [known] = useState(knownGuest)
  const finderOpen = useFinderOpen()
  const [params] = useSearchParams()
  const reduce = useReducedMotion()

  const [step, setStep] = useState<Step>('search')
  const [form, setForm] = useState<RSVPFormState>(EMPTY_RSVP)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [result, setResult] = useState<{ status: AttendanceStatus; guests: number } | null>(null)
  const [closedByServer, setClosedByServer] = useState(false)
  const [gift, setGift] = useState<PublicGift | null>(null)
  const [tableName, setTableName] = useState<string | null>(null)
  // Chair number — only when the couple pre-assigned the seat.
  const [seatNo, setSeatNo] = useState<number | null>(null)
  const submittingRef = useRef(false)
  // The envelope and card (same as the virtual invitation link).
  const [opening, setOpening] = useState(false)
  const [details, setDetails] = useState<{ id: string; d: CardDetails | null } | null>(null)
  const cardW = useCardWidth(330)

  const coupleNames = settings?.coupleNames ?? FALLBACK.coupleNames
  const weddingDate = settings?.weddingDate ?? FALLBACK.weddingDate

  useEffect(() => {
    document.title = `RSVP · ${coupleNames}`
  }, [coupleNames])

  // Future-ready personal links: /#/rsvp?invite=abc123
  const inviteCode = params.get('invite')
  useEffect(() => {
    if (!inviteCode) return
    setForm(EMPTY_RSVP)
    setSubmitError(null)
    setResult(null)
    setStep('search')
    void searchByCode(inviteCode)
  }, [inviteCode, searchByCode])

  // Move to the "found" state whenever a lookup succeeds. Guests arriving from
  // their virtual invitation (/#/i/<code>) have just opened an envelope, so they
  // go straight to the form.
  const fromCard = params.get('from') === 'card'
  // Remember who's on this phone (menu greeting, Find My Seat, photos).
  useEffect(() => {
    if (status === 'found' && invitation) rememberGuest({ name: invitation.inviteeName, invitationId: invitation.invitationId })
    else if (status === 'included' && included) rememberGuest({ name: included.searchedName })
  }, [status, invitation, included])

  useEffect(() => {
    if (status === 'found' && invitation) setStep((s) => (s === 'search' ? (fromCard ? 'form' : 'found') : s))
  }, [status, invitation, fromCard])

  // The invitee's position for the card ("Groom's Mother"), once their invitation is found.
  useEffect(() => {
    if (!invitation || details?.id === invitation.invitationId) return
    let alive = true
    const id = invitation.invitationId
    getInvitationCard(id).then((d) => alive && setDetails({ id, d }))
    return () => {
      alive = false
    }
  }, [invitation, details])

  const respondBy =
    settings && isRsvpOpen(settings) && settings.rsvpShowDeadline && settings.rsvpDeadline && !invitation?.hasExistingResponse ? formatDeadlineDate(settings.rsvpDeadline) : null
  const guest = useMemo<CardGuest | null>(() => {
    if (!invitation || !settings || details?.id !== invitation.invitationId) return null
    return {
      inviteeName: invitation.inviteeName,
      includedGuests: invitation.includedGuests,
      position: details.d ? cardPosition(details.d, settings.entourage) : '',
      respondBy,
      confirmed: details.d?.attendanceStatus === 'attending',
      addressedAs: details.d?.addressedAs ?? '',
    }
  }, [invitation, settings, details, respondBy])
  const card = useInvitationCard(step === 'found' || step === 'card' ? guest : null)

  const openEnvelope = () => {
    if (invitation) void recordInvitationOpen(invitation.invitationId)
    if (reduce) setStep('card')
    else setOpening(true)
  }

  useEffect(() => {
    if (step !== 'found') setOpening(false)
  }, [step])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }, [step, reduce])

  const handleConfirm = async () => {
    if (!invitation || submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    setSubmitError(null)
    try {
      const payload = toSubmission(invitation.invitationId, form, invitation.maxAdditionalGuests, settings?.rsvpConfig, questions)
      const saved = await submitRSVP(payload)
      // This phone now belongs to the guest who just answered (photos, seat, menu follow).
      rememberGuest({ name: invitation.inviteeName, invitationId: invitation.invitationId })
      const seat = saved.attendanceStatus === 'attending' ? await getInvitationSeat(invitation.invitationId) : null
      setTableName(seat?.tableName ?? null)
      setSeatNo(seat?.preassign ? seat.seat : null)
      setConfirmOpen(false)
      setResult({ status: saved.attendanceStatus, guests: payload.additionalGuests.length })
      setStep('success')
      getInvitationGift(invitation.invitationId).then(setGift)
    } catch (e) {
      setConfirmOpen(false)
      if (e instanceof RsvpClosedError) setClosedByServer(true)
      else setSubmitError(toFriendlyMessage(e))
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const rsvpClosed = closedByServer || (settings ? !isRsvpOpen(settings) : false)
  const deadline = settings?.rsvpOpen && settings.rsvpShowDeadline ? settings.rsvpDeadline : null

  const pageMotion = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: reduce ? { opacity: 0 } : { opacity: 0, y: -8 },
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
  }

  return (
    <div className="flex min-h-[100svh] flex-col">
      <PublicHeader />

      <main className="flex flex-1 flex-col px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
        {settingsLoading && !settings ? (
          <PageLoader />
        ) : rsvpClosed && step !== 'success' ? (
          <section aria-labelledby="closed-heading" className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="font-serif text-2xl font-light text-ink-soft">
              <CoupleNames names={coupleNames} />
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.34em] text-muted">{formatWeddingDate(weddingDate)}</p>
            <Ornament className="mt-7" />
            <h1 id="closed-heading" className="mt-7 text-[2.3rem] leading-tight text-ink sm:text-5xl">
              RSVPs are closed
            </h1>
            <p className="mx-auto mt-5 max-w-md whitespace-pre-line font-serif text-xl italic leading-relaxed text-ink-soft">
              {settings?.rsvpClosedMessage || 'Our RSVP list is now closed. Thank you so much!'}
            </p>
          </section>
        ) : (
        <AnimatePresence mode="wait">
          {step === 'search' && (
            <motion.section key="search" {...pageMotion} aria-labelledby="search-heading" className="flex flex-1 flex-col items-center justify-center">
              <div className="mb-10 text-center">
                <p className="font-serif text-2xl font-light text-ink-soft">
                  <CoupleNames names={coupleNames} />
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.34em] text-muted">{formatWeddingDate(weddingDate)}</p>
                <Ornament className="mt-7" />
                <h1 id="search-heading" className="mt-7 text-[2.5rem] leading-tight text-ink sm:text-5xl">
                  Search Your Invitation
                </h1>
                {deadline && (
                  <p className="mx-auto mt-5 inline-flex items-center gap-2 text-sm text-ink-soft">
                    <CalendarClock aria-hidden="true" className="size-4 text-gold" strokeWidth={1.5} />
                    Please respond on or before <strong className="font-medium text-ink">{formatDeadlineDate(deadline)}</strong>
                  </p>
                )}
              </div>
              {settings?.rsvpConfig.teaser && <RaffleTeaser teaser={settings.rsvpConfig.teaser} className="-mt-3 mb-9" />}
              <SearchForm onSearch={searchByName} searching={status === 'searching'} error={status === 'not_found' || status === 'error' ? error : null} initialName={known?.name ?? ''} suggest={status === 'not_found'} />
              {status === 'included' && included && (
                <IncludedNotice included={included} showSeat={finderOpen} />
              )}
            </motion.section>
          )}

          {step === 'found' && invitation && (
            <motion.section key="found" {...pageMotion} aria-label={`Your invitation, ${invitation.inviteeName}`} className="flex flex-1 flex-col items-center justify-center">
              {card.ready && card.theme ? (
                <Envelope
                  name={guest?.addressedAs || invitation.inviteeName}
                  theme={card.theme}
                  monogramText={card.monogramText}
                  monogramArt={card.monogramArt}
                  cardW={cardW}
                  frontHtml={card.frontHtml}
                  opening={opening}
                  onOpen={openEnvelope}
                  onOpened={() => setStep('card')}
                />
              ) : (
                <PageLoader label="Opening your invitation" />
              )}
            </motion.section>
          )}

          {step === 'card' && invitation && (
            <motion.section key="card" {...pageMotion} className="flex flex-1 flex-col items-center">
              <FlipCard frontHtml={card.frontHtml} backHtml={card.backHtml} width={cardW} />
              {settings && details?.id === invitation.invitationId && details.d?.attendanceStatus === 'attending' && <EventDetails venues={settings} className="mt-6" />}
              <Button size="lg" className="mt-6" onClick={() => setStep('form')} icon={<MailOpen aria-hidden="true" className="size-5" strokeWidth={1.5} />} autoFocus>
                Continue to RSVP
              </Button>
            </motion.section>
          )}

          {step === 'form' && invitation && (
            <motion.section key="form" {...pageMotion}>
              <RSVPForm
                invitation={invitation}
                form={form}
                onChange={setForm}
                onRequestConfirm={() => {
                  setSubmitError(null)
                  setConfirmOpen(true)
                }}
                submitting={submitting}
                submitError={submitError}
                config={settings?.rsvpConfig}
                questions={questions}
              />
            </motion.section>
          )}

          {step === 'success' && invitation && result && (
            <motion.section key="success" {...pageMotion} className="flex flex-1 flex-col items-center justify-center gap-10">
              <SuccessState
                status={result.status}
                guestName={invitation.inviteeName}
                tableNumber={tableName}
                seatIndex={seatNo}
                showMap={finderOpen}
                coupleNames={coupleNames}
                weddingDate={weddingDate}
                requestedGuests={result.guests}
                venues={settings ?? undefined}
              />
              {gift && <GiftCard gift={gift} />}
            </motion.section>
          )}
        </AnimatePresence>
        )}
      </main>

      {!(step === 'found' && opening) && <Footer coupleNames={coupleNames} weddingDate={weddingDate} closingMessage={settings?.closingMessage} />}

      <ConfirmDialog
        open={confirmOpen}
        tone="wedding"
        title="Are you sure?"
        message="Your RSVP will be recorded using the information you provided."
        cancelLabel="Cancel"
        confirmLabel="Confirm Response"
        loading={submitting}
        loadingText="Saving your RSVP..."
        onCancel={() => !submitting && setConfirmOpen(false)}
        onConfirm={handleConfirm}
      />
    </div>
  )
}
