import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { ANSWER_COLOURS, ANSWER_LABEL, currentShowerGuest, getPublicReveal, type PublicReveal } from '../../services/showerService'
import { HostContext } from '../../hooks/hostContext'
import { RoundCountdown } from '../wedding/looks/LookArt'
import { Reveal } from '../wedding/Reveal'
import { Confetti } from '../photos/PetalBurst'
import { BalloonShape } from '../wedding/looks/BabyArt'
import { cn } from '../ui/cn'
import { useSectionText } from '../../hooks/useSectionText'

/**
 * The gender reveal as the website and the big screen see it. The answer is
 * only sent by the database once the reveal time has passed, so it can't be
 * found early in the page. Checks again when the countdown ends, and every
 * 20 seconds near the moment (a host may reveal it early from the big screen).
 */
export function useGenderReveal(): [PublicReveal | null, () => void] {
  const [reveal, setReveal] = useState<PublicReveal | null>(null)
  const host = useContext(HostContext)
  const load = useCallback(() => {
    // A guest's pass (invited/attending-only reveals), or the host's code on the big screen.
    void getPublicReveal(currentShowerGuest()?.token ?? host?.token ?? null).then(setReveal)
  }, [host?.token])
  useEffect(() => {
    load()
  }, [load])
  useEffect(() => {
    if (!reveal?.enabled || reveal.revealed) return
    const left = reveal.revealAt ? new Date(reveal.revealAt).getTime() - Date.now() : Infinity
    const every = left < 2 * 3600_000 ? 20_000 : 5 * 60_000
    const id = window.setInterval(load, every)
    return () => window.clearInterval(id)
  }, [reveal, load])
  return [reveal, load]
}

/** The big moment: the answer in its colours, with balloons and confetti. */
export function RevealAnswer({ reveal, big = false, celebrate = true }: { reveal: PublicReveal; big?: boolean; celebrate?: boolean }) {
  const reduce = useReducedMotion()
  if (!reveal.answer) return null
  const colours = ANSWER_COLOURS[reveal.answer]
  const main = reveal.answer === 'twins' ? '#B07AB8' : (colours[2] ?? colours[0]!)
  return (
    <div className="relative">
      {celebrate && <Confetti colors={colours} count={big ? 90 : 46} big={big} />}
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 120, damping: 12 }}
        className="flex flex-col items-center"
      >
        <div className="flex items-end gap-2" aria-hidden="true">
          {colours.slice(0, 3).map((c, i) => (
            <motion.div key={i} initial={reduce ? false : { y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 + i * 0.12, duration: 0.8 }}>
              <BalloonShape color={c} className={cn(big ? 'w-[7vw] max-w-28' : 'w-12', i === 1 && (big ? '-mb-[3vw]' : '-mb-5'))} />
            </motion.div>
          ))}
        </div>
        <p className={cn('mt-4 font-script leading-none', big ? 'text-[min(12vw,10rem)]' : 'text-6xl sm:text-7xl')} style={{ color: main }}>
          {ANSWER_LABEL[reveal.answer]}
        </p>
      </motion.div>
    </div>
  )
}

/** Home page section: the countdown to the reveal, then the answer. Nothing when it's off. */
export function GenderRevealSection() {
  const [reveal, reload] = useGenderReveal()
  const t = useSectionText('reveal')
  const shownRef = useRef(false)
  const [celebrate, setCelebrate] = useState(false)
  useEffect(() => {
    // Confetti only when the reveal happens while the page is open (not on every visit).
    if (reveal?.revealed && shownRef.current) setCelebrate(true)
    if (reveal) shownRef.current = true
  }, [reveal])
  if (!reveal?.enabled) return null
  return (
    <section aria-labelledby="reveal-heading" className="px-5 py-20 sm:px-8 sm:py-24">
      <Reveal className="section-title mx-auto max-w-2xl text-center">
        <p className="eyebrow">{t('eyebrow', 'Gender Reveal')}</p>
        <h2 id="reveal-heading" className="mt-4 text-4xl text-ink sm:text-5xl">
          {reveal.revealed ? t('after', 'The secret is out!') : reveal.title}
        </h2>
        {reveal.revealed ? (
          <div className="mt-10">
            <RevealAnswer reveal={reveal} celebrate={celebrate} />
          </div>
        ) : (
          <>
            {reveal.message && <p className="mx-auto mt-5 max-w-md leading-relaxed text-ink-soft">{reveal.message}</p>}
            {reveal.revealAt ? (
              <>
                <p className="mt-8 text-xs uppercase tracking-[0.3em] text-muted">{t('revealedIn', 'Revealed in')}</p>
                <RoundCountdown at={reveal.revealAt} className="mt-4" onDone={reload} labels={{ days: t('days', ''), hours: t('hours', ''), minutes: t('minutes', '') }} />
              </>
            ) : (
              <p className="mt-8 text-sm text-muted">{t('stayTuned', 'Revealed at the shower — stay tuned!')}</p>
            )}
            <div className="mt-8 flex justify-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium" style={{ background: '#F9D3DD', color: '#7A2E43' }}>
                {t('teamGirl', 'Team Girl')}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium" style={{ background: '#D4E5F7', color: '#23466F' }}>
                {t('teamBoy', 'Team Boy')}
              </span>
            </div>
            <Link to="/predict" className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm text-gold underline-offset-4 hover:underline">
              <Sparkles aria-hidden="true" className="size-4" /> Make your guess
            </Link>
          </>
        )}
      </Reveal>
    </section>
  )
}
