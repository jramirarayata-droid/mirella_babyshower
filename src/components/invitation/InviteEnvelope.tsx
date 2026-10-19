import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { RotateCw } from 'lucide-react'
import { esc, type PrintTheme } from '../../utils/printables'
import { monogramArtSvg, sealSvg, type MonogramArt } from '../../utils/printStyles'
import { addressLines } from '../../utils/addressing'

/*
 * The on-screen invitation: a sealed envelope addressed to the guest that opens
 * to their card, and the card itself (tap to turn it over). Used by the virtual
 * invitation link (/#/i/<code>) and the RSVP page.
 */

const MM = 96 / 25.4 // CSS px per mm
const CARD_MM = 127 // the card is designed at 5 × 7 in (127 × 177.8 mm)
export const CARD_RATIO = 177.8 / 127
const RATIO = CARD_RATIO
const EASE = [0.22, 1, 0.36, 1] as const

const viewport = () => ({ w: window.innerWidth, h: window.innerHeight })

/** On-screen card width that fits the window, leaving `reserve` px of height for everything else. */
export function useCardWidth(reserve: number): number {
  const [size, setSize] = useState(viewport)
  useEffect(() => {
    const on = () => setSize(viewport())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return Math.round(Math.max(232, Math.min(360, size.w - 48, (size.h - reserve) / RATIO)))
}

/** Shows a card designed in millimetres at a given on-screen width. */
export function CardFace({ html, width }: { html: string; width: number }) {
  return (
    <div style={{ width, height: width * RATIO, overflow: 'hidden' }}>
      <div style={{ width: `${CARD_MM}mm`, transform: `scale(${width / (CARD_MM * MM)})`, transformOrigin: 'top left' }} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}

const face: CSSProperties = { position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }

// ---------------------------------------------------------------- envelope

export interface EnvelopeProps {
  name: string
  theme: PrintTheme
  monogramText: string
  /** The couple's uploaded monogram (null = initials). */
  monogramArt?: MonogramArt | null
  cardW: number
  frontHtml: string
  opening: boolean
  onOpen: () => void
  onOpened: () => void
}

/**
 * A sealed envelope addressed to the guest. Tapping it breaks the seal, lifts
 * the flap and slides the card out; then the page moves on to the card itself.
 */
export function Envelope({ name, theme, monogramText, monogramArt, cardW, frontHtml, opening, onOpen, onOpened }: EnvelopeProps) {
  const [step, setStep] = useState(0) // 0 sealed · 1 seal breaks, flap lifts · 2 flap behind · 3 card rises
  const done = useRef(onOpened)
  useEffect(() => {
    done.current = onOpened
  }, [onOpened])

  useEffect(() => {
    if (!opening) return
    setStep(1)
    const timers = [window.setTimeout(() => setStep(2), 620), window.setTimeout(() => setStep(3), 900), window.setTimeout(() => done.current(), 2250)]
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [opening])

  const cardH = cardW * RATIO
  const ew = Math.round(cardW * 1.06)
  const eh = Math.round(cardH * 0.97)
  const inner = Math.round(cardW * 0.92)
  const flapH = Math.round(eh * 0.4)
  const seal = Math.round(cardW * 0.2)
  const style = theme.style ?? 'classic'
  const colors = { ink: theme.ink, accent: theme.accent, accentLight: theme.accentLight, paper: theme.paper, line: theme.line, serif: theme.serif }
  const paper = theme.paper
  const shade = `color-mix(in srgb, ${theme.paper} 92%, ${theme.ink})`
  const liner = `color-mix(in srgb, ${theme.accentLight} 75%, ${theme.paper})`
  const rise = cardH * 0.56

  return (
    <div className="flex flex-col items-center">
      <motion.div animate={{ y: step >= 3 ? rise * 0.5 : 0 }} transition={{ duration: 1, ease: EASE }}>
        <button
          type="button"
          onClick={() => !opening && onOpen()}
          disabled={opening}
          aria-label={`Open your invitation, ${name}`}
          className="group relative block rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-4 focus-visible:ring-offset-cream"
          style={{ width: ew, height: eh, perspective: 1200, cursor: opening ? 'default' : 'pointer' }}
        >
          {/* soft shadow on the table */}
          <span
            aria-hidden="true"
            className="absolute left-1/2 -translate-x-1/2"
            style={{ bottom: -18, width: ew * 0.9, height: 30, background: 'radial-gradient(ellipse, rgba(0,0,0,0.22), transparent 70%)', filter: 'blur(6px)' }}
          />

          {/* inside of the envelope (the lining) */}
          <span aria-hidden="true" className="absolute inset-0 rounded-[3px]" style={{ background: `linear-gradient(${liner}, ${shade} 60%)` }} />

          {/* the card, tucked inside */}
          <motion.span
            aria-hidden="true"
            className="absolute"
            style={{ left: (ew - inner) / 2, top: eh * 0.035, boxShadow: '0 2px 10px rgba(0,0,0,0.12)', zIndex: 2 }}
            animate={{ y: step >= 3 ? -rise : 0 }}
            transition={{ duration: 1.1, ease: EASE }}
          >
            <CardFace html={frontHtml} width={inner} />
          </motion.span>

          {/* front pocket: side and bottom flaps meeting in the middle */}
          <span aria-hidden="true" className="absolute inset-0" style={{ zIndex: 3, clipPath: 'polygon(0 0, 50% 36%, 100% 0, 100% 100%, 0 100%)' }}>
            <span className="absolute inset-0 rounded-[3px]" style={{ background: paper, boxShadow: `inset 0 0 0 1px ${theme.line}` }} />
            <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M0 0 L50 36 L100 0" fill="none" stroke={theme.line} strokeWidth="1" vectorEffect="non-scaling-stroke" />
            </svg>
            <span className="absolute inset-x-0 px-6 text-center" style={{ top: '62%' }}>
              <span className="block font-serif italic leading-tight" style={{ color: theme.ink, fontSize: Math.max(20, Math.min(30, cardW * 0.085)) }}>
                {addressLines(name).map((line, i) => (
                  <span key={i} className="block">
                    {i > 0 && (
                      <span className="block text-[0.75em] leading-snug" style={{ color: theme.accent }}>
                        &amp;
                      </span>
                    )}
                    {line}
                  </span>
                ))}
              </span>
            </span>
          </span>

          {/* top flap, hinged along the top edge */}
          <span
            aria-hidden="true"
            className="absolute left-0 top-0"
            style={{
              width: ew,
              height: flapH,
              transformOrigin: 'top center',
              transformStyle: 'preserve-3d',
              transform: `rotateX(${step >= 1 ? 178 : 0}deg)`,
              transition: 'transform 0.8s cubic-bezier(0.22,1,0.36,1) 0.12s',
              zIndex: step >= 2 ? 1 : 4,
            }}
          >
            <svg style={face} className="size-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M0 0 L100 0 L54 94 Q50 100 46 94 Z" fill={paper} stroke={theme.line} strokeWidth="1" vectorEffect="non-scaling-stroke" />
            </svg>
            <svg style={{ ...face, transform: 'rotateX(180deg)' }} className="size-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M0 0 L100 0 L54 94 Q50 100 46 94 Z" fill={liner} />
            </svg>
          </span>

          {/* wax seal over the flap's tip */}
          <motion.span
            aria-hidden="true"
            className="absolute left-1/2"
            style={{ top: flapH - seal * 0.55, width: seal, height: seal, marginLeft: -seal / 2, zIndex: 5, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.18))' }}
            animate={step >= 1 ? { scale: 1.25, opacity: 0 } : { scale: 1, opacity: 1 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <svg viewBox="0 0 40 40" className="size-full" dangerouslySetInnerHTML={{
                __html: monogramArt
                  ? `<circle cx="20" cy="20" r="18" fill="${colors.accentLight}" stroke="${colors.accent}" stroke-width="0.6"/>${monogramArtSvg(monogramArt, 20, 20, 27, colors.ink, esc)}`
                  : sealSvg(style, 20, 20, 12, monogramText, colors, esc),
              }} />
          </motion.span>
        </button>
      </motion.div>

      <motion.p
        className="mt-10 text-sm tracking-wide text-muted"
        animate={{ opacity: opening ? 0 : [0.55, 1, 0.55] }}
        transition={opening ? { duration: 0.3 } : { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        Tap the envelope to open
      </motion.p>
    </div>
  )
}

// ---------------------------------------------------------------- card

export function FlipCard({ frontHtml, backHtml, width }: { frontHtml: string; backHtml: string; width: number }) {
  const [back, setBack] = useState(false)
  const height = width * RATIO
  const shadow = '0 24px 48px -22px rgba(0,0,0,0.38), 0 2px 6px rgba(0,0,0,0.08)'
  return (
    <div className="mt-6 flex flex-col items-center">
      <div style={{ perspective: 1600 }}>
        <button
          type="button"
          onClick={() => setBack((b) => !b)}
          aria-label={back ? 'Show the front of the card' : 'Turn the card over'}
          className="relative block rounded-[2px] outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-4 focus-visible:ring-offset-cream"
          style={{ width, height }}
        >
          <span
            className="absolute inset-0 block"
            style={{ transformStyle: 'preserve-3d', transform: `rotateY(${back ? 180 : 0}deg)`, transition: 'transform 0.9s cubic-bezier(0.22,1,0.36,1)' }}
          >
            <span className="block" style={{ ...face, boxShadow: shadow }}>
              <CardFace html={frontHtml} width={width} />
            </span>
            <span className="block" style={{ ...face, transform: 'rotateY(180deg)', boxShadow: shadow }}>
              <CardFace html={backHtml} width={width} />
            </span>
          </span>
        </button>
      </div>
      <button
        type="button"
        onClick={() => setBack((b) => !b)}
        className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm text-muted transition hover:bg-paper/70 hover:text-ink"
      >
        <RotateCw aria-hidden="true" className="size-3.5" strokeWidth={1.6} />
        {back ? 'Show the front' : 'Turn the card over'}
      </button>
    </div>
  )
}

