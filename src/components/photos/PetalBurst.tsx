import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/** A soft shower of petals — a little "thank you" after a guest shares photos.
    Mount it with a new `key` for each shower. */
export function PetalBurst() {
  const reduce = useReducedMotion()
  const [petals] = useState(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        i,
        x: Math.random() * 100,
        drift: (Math.random() - 0.5) * 30,
        delay: Math.random() * 0.9,
        dur: 2.6 + Math.random() * 1.6,
        size: 10 + Math.random() * 12,
        spin: (Math.random() - 0.5) * 540,
        hue: ['#e9c9c1', '#f3dcd4', '#d9b48a', '#efe3d0', '#e6b8b0'][i % 5],
      })),
  )
  if (reduce) return null
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[70] overflow-hidden">
      {petals.map((p) => (
        <motion.span
          key={p.i}
          className="absolute top-0 block"
          style={{ left: `${p.x}%`, width: p.size, height: p.size * 0.8, background: p.hue, borderRadius: '80% 0 80% 0', opacity: 0.9 }}
          initial={{ y: -40, x: 0, rotate: 0, opacity: 0 }}
          animate={{ y: '105vh', x: [0, p.drift, -p.drift / 2, p.drift], rotate: p.spin, opacity: [0, 1, 1, 0] }}
          transition={{ duration: p.dur, delay: p.delay, ease: 'easeIn' }}
        />
      ))}
    </div>
  )
}
