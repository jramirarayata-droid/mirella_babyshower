import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

const PASTELS = ['#f4b8c5', '#a9c8ea', '#f6dc8f', '#b9dcc6', '#d9c7ef']
const STAR = 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)'

/**
 * A soft shower of pastel confetti and little stars — a "thank you" after a
 * guest shares photos, and the burst at the gender reveal (in pink, blue or
 * both). Mount it with a new `key` for each shower.
 */
export function Confetti({ colors = PASTELS, count = 30, big = false }: { colors?: string[]; count?: number; big?: boolean }) {
  const reduce = useReducedMotion()
  const [bits] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      i,
      x: Math.random() * 100,
      drift: (Math.random() - 0.5) * 34,
      delay: Math.random() * (big ? 1.6 : 0.9),
      dur: (big ? 3.4 : 2.6) + Math.random() * 1.8,
      size: (big ? 12 : 9) + Math.random() * (big ? 16 : 11),
      spin: (Math.random() - 0.5) * 540,
      colour: colors[i % colors.length],
      shape: i % 3 === 0 ? 'star' : i % 3 === 1 ? 'dot' : 'strip',
    })),
  )
  if (reduce) return null
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[70] overflow-hidden">
      {bits.map((p) => (
        <motion.span
          key={p.i}
          className="absolute top-0 block"
          style={{
            left: `${p.x}%`,
            width: p.shape === 'strip' ? p.size * 0.45 : p.size,
            height: p.shape === 'strip' ? p.size * 1.1 : p.size,
            background: p.colour,
            borderRadius: p.shape === 'dot' ? '9999px' : p.shape === 'strip' ? '2px' : undefined,
            clipPath: p.shape === 'star' ? STAR : undefined,
            opacity: 0.95,
          }}
          initial={{ y: -40, x: 0, rotate: 0, opacity: 0 }}
          animate={{ y: '105vh', x: [0, p.drift, -p.drift / 2, p.drift], rotate: p.spin, opacity: [0, 1, 1, 0] }}
          transition={{ duration: p.dur, delay: p.delay, ease: 'easeIn' }}
        />
      ))}
    </div>
  )
}

/** The photo-sharing thank-you (kept under its old name). */
export function PetalBurst() {
  return <Confetti count={26} />
}
