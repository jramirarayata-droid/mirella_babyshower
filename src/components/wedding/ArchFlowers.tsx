import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion'
import { cn } from '../ui/cn'

/**
 * Flowers around the arched hero photo. They grow in when the page opens,
 * sway gently, and open outwards a little as the page is scrolled up.
 * Colours come from the theme, so they suit every template.
 */
export function ArchFlowers() {
  const reduce = useReducedMotion()
  const { scrollY } = useScroll()
  const smooth = useSpring(scrollY, { stiffness: 80, damping: 20, mass: 0.4 })
  const spread = useTransform(smooth, [0, 420], [0, 18])
  const spreadNeg = useTransform(spread, (v) => -v)
  const tilt = useTransform(smooth, [0, 420], [0, 7])
  const tiltNeg = useTransform(tilt, (v) => -v)
  const rise = useTransform(smooth, [0, 420], [0, -10])

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10">
      <motion.div
        className="absolute -bottom-[14%] -left-[30%] w-[72%]"
        style={reduce ? undefined : { x: spreadNeg, rotate: tiltNeg, y: rise }}
      >
        <Cluster reduce={reduce} delay={0.5} />
      </motion.div>
      <motion.div
        className="absolute -bottom-[10%] -right-[28%] w-[64%] -scale-x-100"
        style={reduce ? undefined : { x: spread, rotate: tilt, y: rise }}
      >
        <Cluster reduce={reduce} delay={0.75} variant />
      </motion.div>
      <motion.div className="absolute -top-[9%] left-1/2 w-[42%] -translate-x-1/2" style={reduce ? undefined : { y: rise }}>
        <Sprig reduce={reduce} delay={1.05} />
      </motion.div>
    </div>
  )
}

const LEAF = 'M0 0 C 9 -11, 27 -12, 40 0 C 27 11, 9 11, 0 0 Z'
const leafStyle = { fill: 'color-mix(in srgb, var(--color-champagne) 30%, #6f8562)', opacity: 0.85 }
const petal = (fill: string) => ({ fill, stroke: 'color-mix(in srgb, var(--color-champagne) 70%, transparent)', strokeWidth: 0.5 })

function grow(reduce: boolean | null, delay: number, from = 0.2) {
  if (reduce) return {}
  return {
    initial: { scale: from, opacity: 0, rotate: -12 },
    animate: { scale: 1, opacity: 1, rotate: 0 },
    transition: { duration: 1.4, delay, ease: [0.22, 1, 0.36, 1] as const },
    style: { transformBox: 'fill-box' as const, transformOrigin: 'bottom left' },
  }
}

/** A layered, peony-like bloom centred on (cx, cy). */
function Bloom({ cx, cy, r, reduce, delay, className }: { cx: number; cy: number; r: number; reduce: boolean | null; delay: number; className?: string }) {
  // Soft teardrop petals, rooted at the centre and fanned around it.
  const ring = (n: number, _rr: number, len: number, fill: string, rot = 0) =>
    Array.from({ length: n }, (_, i) => {
      const w = len * 0.5
      const d = `M ${cx} ${cy} C ${cx - w} ${cy - len * 0.35}, ${cx - w * 0.75} ${cy - len}, ${cx} ${cy - len * 1.08} C ${cx + w * 0.75} ${cy - len}, ${cx + w} ${cy - len * 0.35}, ${cx} ${cy} Z`
      return <path key={i} d={d} transform={`rotate(${(360 / n) * i + rot} ${cx} ${cy})`} style={petal(fill)} />
    })
  return (
    <motion.g
      className={className}
      style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      {...(reduce
        ? {}
        : {
            initial: { scale: 0, rotate: -40, opacity: 0 },
            animate: { scale: 1, rotate: 0, opacity: 1 },
            transition: { duration: 1.6, delay, ease: [0.22, 1, 0.36, 1] as const },
          })}
    >
      {/* (the gentle sway lives on an inner group, so it never fights the grow-in animation) */}
      <g className={cn(!reduce && 'lux-sway')} style={{ animationDelay: `${(delay * 1.7) % 3}s` }}>
        {ring(8, 0, r, 'var(--color-paper)')}
        {ring(7, 0, r * 0.72, 'var(--color-champagne-light)', 22)}
        {ring(6, 0, r * 0.46, 'color-mix(in srgb, var(--color-champagne) 45%, var(--color-champagne-light))', 8)}
        <circle cx={cx} cy={cy} r={r * 0.11} style={{ fill: 'var(--color-champagne)' }} />
        {[0, 1, 2, 3, 4].map((i) => (
          <circle key={i} cx={cx + Math.cos(i * 1.257) * r * 0.2} cy={cy + Math.sin(i * 1.257) * r * 0.2} r={r * 0.035} style={{ fill: 'var(--color-gold)' }} />
        ))}
      </g>
    </motion.g>
  )
}

function Bud({ x, y, rot }: { x: number; y: number; rot: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <path d="M0 0 C -4 -6, -3 -13, 0 -16 C 3 -13, 4 -6, 0 0 Z" style={petal('var(--color-champagne-light)')} />
      <path d="M0 0 C -3 -3, -5 -6, -5 -9 M0 0 C 3 -3, 5 -6, 5 -9" style={{ fill: 'none', stroke: leafStyle.fill, strokeWidth: 1.2 }} />
    </g>
  )
}

function Cluster({ reduce, delay, variant = false }: { reduce: boolean | null; delay: number; variant?: boolean }) {
  return (
    <svg viewBox="0 0 220 200" className="block w-full overflow-visible">
      {/* stems */}
      <motion.path
        d="M10 196 C 60 170, 90 140, 118 92 M10 196 C 70 182, 130 160, 176 130 M10 196 C 40 160, 46 120, 60 70"
        style={{ fill: 'none', stroke: leafStyle.fill, strokeWidth: 1.4, strokeLinecap: 'round' }}
        {...(reduce ? {} : { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration: 1.6, delay: delay - 0.3, ease: 'easeOut' } })}
      />
      {/* leaves */}
      <motion.g {...grow(reduce, delay)}>
        <path d={LEAF} transform="translate(40 172) rotate(-38)" style={leafStyle} />
        <path d={LEAF} transform="translate(78 150) rotate(-62) scale(0.9)" style={leafStyle} />
        <path d={LEAF} transform="translate(98 166) rotate(-8) scale(0.85)" style={leafStyle} />
        <path d={LEAF} transform="translate(140 150) rotate(-24) scale(0.75)" style={leafStyle} />
        <path d={LEAF} transform="translate(46 118) rotate(-100) scale(0.7)" style={leafStyle} />
      </motion.g>
      {/* blooms */}
      <Bloom cx={variant ? 112 : 118} cy={variant ? 98 : 92} r={variant ? 32 : 37} reduce={reduce} delay={delay + 0.25} />
      <Bloom cx={variant ? 166 : 176} cy={variant ? 136 : 130} r={variant ? 22 : 26} reduce={reduce} delay={delay + 0.45} />
      {/* buds and baby's breath */}
      <motion.g {...grow(reduce, delay + 0.6, 0.5)}>
        <Bud x={60} y={72} rot={-14} />
        {!variant && <Bud x={196} y={112} rot={38} />}
        {[
          [70, 56],
          [52, 64],
          [150, 94],
          [160, 82],
          [84, 66],
          [204, 140],
          [190, 156],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.2} style={{ fill: 'var(--color-paper)', stroke: 'var(--color-champagne)', strokeWidth: 0.6 }} />
        ))}
      </motion.g>
    </svg>
  )
}

function Sprig({ reduce, delay }: { reduce: boolean | null; delay: number }) {
  return (
    <svg viewBox="0 0 160 60" className="block w-full overflow-visible">
      <motion.path
        d="M10 40 C 50 30, 110 30, 150 40"
        style={{ fill: 'none', stroke: leafStyle.fill, strokeWidth: 1.2, strokeLinecap: 'round' }}
        {...(reduce ? {} : { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration: 1.4, delay: delay - 0.2 } })}
      />
      <motion.g {...grow(reduce, delay)}>
        <path d={LEAF} transform="translate(24 38) rotate(-30) scale(0.55)" style={leafStyle} />
        <path d={LEAF} transform="translate(48 34) rotate(20) scale(0.5)" style={leafStyle} />
        <path d={LEAF} transform="translate(136 38) rotate(-150) scale(0.55)" style={leafStyle} />
        <path d={LEAF} transform="translate(112 34) rotate(160) scale(0.5)" style={leafStyle} />
      </motion.g>
      <Bloom cx={80} cy={32} r={18} reduce={reduce} delay={delay + 0.2} />
    </svg>
  )
}
