import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

/*
 * The big-screen moment for Present (made for a TV across the room): the screen
 * dims, slow rays of light turn behind the result, and the result itself fills
 * the middle. Click, tap, Space, Enter or Escape continues; it can also clear
 * itself after a few seconds.
 */

export type RevealLevel = 'full' | 'soft'

interface Props {
  /** Changes for every new reveal (restarts the animation); null = hidden. */
  revealKey: string | null
  level?: RevealLevel
  /** Hide by itself after this many ms. */
  autoHideMs?: number
  onClose: () => void
  children: ReactNode
}

const CONFETTI = ['var(--color-champagne)', 'var(--color-gold)', 'var(--color-champagne-light)', 'var(--color-rose)', 'var(--color-sage)', '#ffffff']

export function BigReveal({ revealKey, level = 'full', autoHideMs, onClose, children }: Props) {
  const reduce = useReducedMotion()
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  }, [onClose])

  // Keys close the reveal first (so Space doesn't also draw / spin underneath).
  useEffect(() => {
    if (!revealKey) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        close.current()
      }
    }
    window.addEventListener('keydown', onKey, true)
    const t = autoHideMs ? window.setTimeout(() => close.current(), autoHideMs) : undefined
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.clearTimeout(t)
    }
  }, [revealKey, autoHideMs])

  const full = level === 'full'
  return createPortal(
    <AnimatePresence>
      {revealKey && (
        <motion.div
          key={revealKey}
          role="dialog"
          aria-modal="true"
          aria-live="assertive"
          className="fixed inset-0 z-[200] flex cursor-pointer items-center justify-center overflow-hidden"
          style={{ background: 'radial-gradient(ellipse at 50% 45%, rgba(38,30,22,0.82) 0%, rgba(14,11,8,0.95) 75%)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.35 } }}
          transition={{ duration: 0.3 }}
          onClick={() => close.current()}
        >
          {/* slow rays of light */}
          {!reduce && (
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 size-[220vmax] -translate-x-1/2 -translate-y-1/2"
              style={{
                background: `repeating-conic-gradient(from 0deg, color-mix(in srgb, var(--color-champagne) ${full ? 22 : 12}%, transparent) 0deg 7deg, transparent 7deg 18deg)`,
                maskImage: 'radial-gradient(circle, #000 0%, transparent 42%)',
                WebkitMaskImage: 'radial-gradient(circle, #000 0%, transparent 42%)',
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
            />
          )}
          {/* glow behind the result */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 size-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: `radial-gradient(circle, color-mix(in srgb, var(--color-champagne) ${full ? 45 : 25}%, transparent) 0%, transparent 70%)`, filter: 'blur(10px)' }}
          />
          {full && !reduce && <Burst />}
          <motion.div
            className="relative z-10 flex w-full flex-col items-center px-[4vw] text-center"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.35 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={reduce ? { duration: 0.4 } : { type: 'spring', stiffness: 120, damping: 14, delay: 0.1 }}
          >
            {children}
          </motion.div>
          <p className="pointer-events-none absolute bottom-[3vh] left-0 right-0 text-center text-[clamp(0.8rem,1.3vw,1.2rem)] uppercase tracking-[0.35em] text-white/45">
            Click or press Space to continue
          </p>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** Two waves of confetti from the middle of the screen. */
function Burst() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {Array.from({ length: 140 }, (_, i) => {
        const angle = Math.random() * Math.PI * 2
        const dist = 30 + Math.random() * 45
        const x = Math.cos(angle) * dist
        const y = Math.sin(angle) * dist - 10
        const delay = i < 90 ? 0.15 : 0.9
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 block"
            style={{ width: '0.9vmin', height: '1.6vmin', minWidth: 6, minHeight: 10, background: CONFETTI[i % CONFETTI.length], borderRadius: 2 }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
            animate={{ x: `${x}vw`, y: [`${y}vh`, `${y + 70}vh`], opacity: [1, 1, 0], rotate: Math.random() * 900 - 450 }}
            transition={{ duration: 3.2 + Math.random() * 1.4, delay, ease: 'easeOut' }}
          />
        )
      })}
    </div>
  )
}

/** Font size that keeps a name on one or two lines across a TV screen. */
export function nameSize(name: string): string {
  const len = Math.max(name.trim().length, 4)
  return `min(19vh, ${Math.round((150 / len) * 10) / 10}vw)`
}
