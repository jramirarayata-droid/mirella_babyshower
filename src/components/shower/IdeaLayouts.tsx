import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import type { GiftIdea, IdeaDesign } from '../../services/showerService'
import { sizedUrl } from '../../utils/imageSizes'
import { cn } from '../ui/cn'
import { Reveal } from '../wedding/Reveal'

/*
 * Gallery designs made for gift ideas (Admin → Gift Registry → Gift ideas →
 * Design). Every design opens the shared full-screen viewer through `onOpen`.
 * Colours come from the shower's Look & Feel, so they suit every template.
 */

interface Props {
  title: string
  items: GiftIdea[]
  onOpen: (index: number) => void
}

export default function IdeaLayoutView({ design, ...props }: Props & { design: IdeaDesign }) {
  switch (design) {
    case 'tags':
      return <GiftTags {...props} />
    case 'shelf':
      return <NurseryShelf {...props} />
    case 'ribbon':
      return <RibbonShowcase {...props} />
    default:
      return <WishBoard {...props} />
  }
}

const TILTS = [-3, 2, -1.5, 3, -2.5, 1.5]
const label = (i: GiftIdea, n: number, total: number) => `Open idea ${n + 1} of ${total}${i.title ? `: ${i.title}` : ''}`

function Caption({ item, className }: { item: GiftIdea; className?: string }) {
  if (!item.title && !item.note && !item.link) return null
  return (
    <div className={cn('text-center', className)}>
      {item.title && <p className="font-serif text-xl leading-tight text-ink">{item.title}</p>}
      {item.note && <p className="mt-1 text-sm leading-snug text-ink-soft">{item.note}</p>}
      {item.link && (
        <a href={item.link} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs text-gold underline-offset-4 hover:underline">
          Where to find it <ExternalLink aria-hidden="true" className="size-3" />
        </a>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- 1. Wish board
/** Photos pinned to a soft board with washi tape, slightly tilted. */
function WishBoard({ title, items, onOpen }: Props) {
  return (
    <div
      data-design="wishboard"
      className="mt-12 rounded-[1.75rem] border border-champagne/30 p-4 shadow-soft sm:p-8"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--color-champagne) 10%, var(--color-paper))',
        backgroundImage: 'radial-gradient(color-mix(in srgb, var(--color-champagne) 22%, transparent) 1px, transparent 1.4px)',
        backgroundSize: '18px 18px',
      }}
    >
      <ul aria-label={title} className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-7 sm:gap-y-10 lg:grid-cols-4">
        {items.map((item, i) => (
          <li key={item.id} className="relative pt-3">
            <Reveal delay={(i % 4) * 0.05}>
              <div style={{ rotate: `${TILTS[i % TILTS.length]}deg` }} className="relative bg-[#FFFEFB] p-2 pb-3 shadow-[0_2px_4px_rgb(0_0_0/0.07),0_16px_30px_-18px_rgb(0_0_0/0.4)] transition duration-500 hover:!rotate-0">
                {/* washi tape */}
                <span
                  aria-hidden="true"
                  className="absolute -top-3 left-1/2 z-10 h-6 w-16 -translate-x-1/2 opacity-80 sm:w-20"
                  style={{
                    rotate: `${i % 2 ? 4 : -5}deg`,
                    background: 'repeating-linear-gradient(45deg, color-mix(in srgb, var(--color-champagne) 55%, white) 0 6px, color-mix(in srgb, var(--color-champagne) 35%, white) 6px 12px)',
                  }}
                />
                <button type="button" onClick={() => onOpen(i)} aria-label={label(item, i, items.length)} className="block w-full">
                  <img src={sizedUrl(item.image, 800)} alt={item.title || `Gift idea ${i + 1}`} loading="lazy" decoding="async" className="aspect-[4/5] w-full bg-cream object-cover" />
                </button>
                {item.title && <p className="mt-2 truncate px-1 text-center font-serif text-lg italic text-[#3A3531]">{item.title}</p>}
              </div>
              {(item.note || item.link) && <Caption item={{ ...item, title: '' }} className="mt-3 px-1" />}
            </Reveal>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------- 2. Gift tags
/** Each photo on a gift tag, hanging from a ribbon. Swipe on phones. */
function GiftTags({ title, items, onOpen }: Props) {
  return (
    <div data-design="tags" className="relative mt-12">
      {/* the ribbon */}
      <span aria-hidden="true" className="absolute inset-x-0 top-3 h-[3px] rounded-full bg-champagne/70 shadow-[0_1px_0_rgb(255_255_255/0.6)]" />
      <ul
        aria-label={title}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 pb-6 sm:mx-0 sm:flex-wrap sm:justify-center sm:gap-7 sm:overflow-visible sm:px-0"
      >
        {items.map((item, i) => (
          <li key={item.id} className="w-[62%] shrink-0 snap-center sm:w-52 lg:w-56">
            <div className="flex flex-col items-center" style={{ rotate: `${i % 2 ? 2 : -2}deg`, transformOrigin: 'top center' }}>
              {/* string */}
              <span aria-hidden="true" className="h-9 w-px bg-champagne" />
              <div
                className="relative w-full bg-paper px-3 pb-4 pt-8 shadow-[0_2px_4px_rgb(0_0_0/0.06),0_18px_30px_-20px_rgb(0_0_0/0.45)]"
                style={{ clipPath: 'polygon(16% 0, 84% 0, 100% 9%, 100% 100%, 0 100%, 0 9%)', border: '1px solid color-mix(in srgb, var(--color-champagne) 45%, transparent)' }}
              >
                {/* the tag's hole */}
                <span aria-hidden="true" className="absolute left-1/2 top-3 size-3 -translate-x-1/2 rounded-full border border-champagne bg-ivory" />
                <button type="button" onClick={() => onOpen(i)} aria-label={label(item, i, items.length)} className="block w-full">
                  <img src={sizedUrl(item.image, 800)} alt={item.title || `Gift idea ${i + 1}`} loading="lazy" decoding="async" className="aspect-square w-full rounded-sm bg-cream object-cover" />
                </button>
                <Caption item={item} className="mt-3" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------- 3. Nursery shelf
/** Photos standing on little wooden shelves, three to a shelf. */
function NurseryShelf({ title, items, onOpen }: Props) {
  const rows: { item: GiftIdea; i: number }[][] = []
  items.forEach((item, i) => {
    if (i % 3 === 0) rows.push([])
    rows[rows.length - 1]!.push({ item, i })
  })
  const wood = 'linear-gradient(180deg, color-mix(in srgb, var(--color-champagne) 70%, #8a6a4a) 0%, color-mix(in srgb, var(--color-champagne) 55%, #5e4530) 100%)'
  return (
    <div data-design="shelf" className="mx-auto mt-12 max-w-4xl space-y-12" aria-label={title} role="list">
      {rows.map((row, r) => (
        <Reveal key={r}>
          <div className="relative px-2 sm:px-6">
            <div className="grid grid-cols-3 items-end gap-3 sm:gap-6">
              {row.map(({ item, i }) => (
                <div role="listitem" key={item.id} className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => onOpen(i)}
                    aria-label={label(item, i, items.length)}
                    className={cn('block w-full border-[5px] border-[#FFFEFB] bg-[#FFFEFB] shadow-[0_10px_18px_-10px_rgb(0_0_0/0.45)] transition hover:-translate-y-1', i % 3 === 1 ? 'sm:w-[92%]' : 'sm:w-[84%]')}
                  >
                    <img src={sizedUrl(item.image, 700)} alt={item.title || `Gift idea ${i + 1}`} loading="lazy" decoding="async" className={cn('w-full bg-cream object-cover', i % 3 === 1 ? 'aspect-[3/4]' : 'aspect-square')} />
                  </button>
                </div>
              ))}
            </div>
            {/* the shelf */}
            <div aria-hidden="true" className="relative mt-0 h-3.5 rounded-sm shadow-[0_8px_14px_-6px_rgb(0_0_0/0.35)]" style={{ background: wood }} />
            <div aria-hidden="true" className="flex justify-between px-8">
              <span className="h-5 w-2.5 rounded-b-sm opacity-80" style={{ background: wood }} />
              <span className="h-5 w-2.5 rounded-b-sm opacity-80" style={{ background: wood }} />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-3 sm:gap-6">
              {row.map(({ item }) => (
                <Caption key={item.id} item={item} className="[&_p:first-child]:text-base sm:[&_p:first-child]:text-lg" />
              ))}
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- 4. Ribbon showcase
/** One big photo at a time with a bow on its corner; swipe or tap the arrows. */
function RibbonShowcase({ title, items, onOpen }: Props) {
  const reduce = useReducedMotion()
  const [at, setAt] = useState(0)
  const [dir, setDir] = useState(1)
  const start = useRef<number | null>(null)
  const n = items.length
  const go = (d: number) => {
    setDir(d)
    setAt((x) => (x + d + n) % n)
  }
  const item = items[at]!
  const down = (e: ReactPointerEvent) => {
    start.current = e.clientX
  }
  const up = (e: ReactPointerEvent) => {
    if (start.current === null) return
    const dx = e.clientX - start.current
    start.current = null
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
  }
  return (
    <div data-design="ribbon" className="mx-auto mt-12 max-w-2xl" role="group" aria-roledescription="carousel" aria-label={title}>
      <div className="relative" onPointerDown={down} onPointerUp={up}>
        <div className="relative overflow-hidden rounded-sm border-[6px] border-[#FFFEFB] bg-[#FFFEFB] shadow-[0_24px_50px_-28px_rgb(0_0_0/0.55)]">
          <AnimatePresence initial={false} mode="popLayout" custom={dir}>
            <motion.button
              key={item.id}
              type="button"
              onClick={() => onOpen(at)}
              aria-label={label(item, at, n)}
              className="block w-full"
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -60 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <img src={sizedUrl(item.image, 1400)} alt={item.title || `Gift idea ${at + 1}`} decoding="async" draggable={false} className="aspect-[4/5] w-full bg-cream object-cover sm:aspect-[4/3]" />
            </motion.button>
          </AnimatePresence>
        </div>
        <Bow className="pointer-events-none absolute -left-5 -top-6 w-24 sm:-left-7 sm:-top-8 sm:w-32" />
        {n > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous idea" className="absolute left-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-paper/90 text-ink shadow-card backdrop-blur transition hover:bg-paper">
              <ChevronLeft aria-hidden="true" className="size-5" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next idea" className="absolute right-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-paper/90 text-ink shadow-card backdrop-blur transition hover:bg-paper">
              <ChevronRight aria-hidden="true" className="size-5" />
            </button>
          </>
        )}
      </div>
      <div aria-live="polite" className="mt-5 min-h-[3rem]">
        <Caption item={item} />
      </div>
      {n > 1 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {items.map((x, i) => (
            <button
              key={x.id}
              type="button"
              aria-label={`Show idea ${i + 1}`}
              aria-current={i === at}
              onClick={() => {
                setDir(i > at ? 1 : -1)
                setAt(i)
              }}
              className={cn('h-2 rounded-full transition-all', i === at ? 'w-6 bg-gold' : 'w-2 bg-champagne/50 hover:bg-champagne')}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** A soft satin bow in the accent colour. */
function Bow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 90" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="bow-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="color-mix(in srgb, var(--color-champagne) 70%, white)" />
          <stop offset="1" stopColor="var(--color-champagne)" />
        </linearGradient>
      </defs>
      <g fill="url(#bow-shade)" stroke="color-mix(in srgb, var(--color-champagne) 70%, black)" strokeOpacity="0.25" strokeWidth="1">
        <path d="M58 40 C40 14 10 10 8 30 C6 48 34 52 58 44 Z" />
        <path d="M62 40 C80 14 110 10 112 30 C114 48 86 52 62 44 Z" />
        <path d="M56 46 L38 86 L48 80 L54 88 L60 50 Z" />
        <path d="M64 46 L82 86 L72 80 L66 88 L60 50 Z" />
        <rect x="52" y="34" width="16" height="16" rx="6" />
      </g>
    </svg>
  )
}
