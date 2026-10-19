import { gridImg } from '../../utils/imageSizes'
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'framer-motion'
import { ChevronLeft, ChevronRight, Expand, Pause, Play } from 'lucide-react'
import type { GalleryImage, GalleryLayout } from '../../types/wedding'
import { cn } from '../ui/cn'
import { Reveal } from './Reveal'

/**
 * The extra photo layouts (everything except the magazine grid and the
 * carousel). Loaded only when one of them is chosen, so the home page stays
 * light. Every layout opens the shared full-screen viewer through `onOpen`.
 */
interface LayoutProps {
  title: string
  images: GalleryImage[]
  onOpen: (index: number) => void
}

export default function GalleryLayoutView({ layout, ...props }: LayoutProps & { layout: GalleryLayout }) {
  switch (layout) {
    case 'polaroid':
      return <PolaroidWall {...props} />
    case 'filmstrip':
      return <FilmStrip {...props} />
    case 'mosaic':
      return <FeaturedMosaic {...props} />
    case 'story':
      return <StoryViewer {...props} />
    case 'deck':
      return <CardDeck {...props} />
    case 'coverflow':
      return <Coverflow {...props} />
    case 'arches':
      return <ArchedFrames {...props} />
    case 'timeline':
      return <Timeline {...props} />
    default:
      return null
  }
}

const altOf = (img: GalleryImage, i: number) => img.caption || `Photo ${i + 1}`
const wrap = (i: number, n: number) => ((i % n) + n) % n

function useAutoAdvance(count: number, ms: number, enabled: boolean, onTick: () => void) {
  const tick = useRef(onTick)
  tick.current = onTick
  useEffect(() => {
    if (!enabled || count < 2) return
    const t = window.setInterval(() => tick.current(), ms)
    return () => window.clearInterval(t)
  }, [count, ms, enabled])
}

/** True while the element is at least partly on screen. */
function useInView<T extends Element>() {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return { ref, inView }
}

function ArrowButton({ dir, onClick, label, className }: { dir: -1 | 1; onClick: () => void; label: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'flex size-11 items-center justify-center rounded-full border border-champagne/60 bg-paper/90 text-ink shadow-card backdrop-blur transition hover:bg-paper',
        className,
      )}
    >
      {dir < 0 ? <ChevronLeft aria-hidden="true" className="size-5" strokeWidth={1.6} /> : <ChevronRight aria-hidden="true" className="size-5" strokeWidth={1.6} />}
    </button>
  )
}

// ---------------------------------------------------------------- 3. Polaroid wall

const TILTS = [-4, 3, -2, 5, -3, 2, -5, 4]

function PolaroidWall({ title, images, onOpen }: LayoutProps) {
  return (
    <ul
      aria-label={title}
      className="no-scrollbar -mx-4 mt-12 flex snap-x snap-mandatory gap-6 overflow-x-auto px-8 pb-8 pt-4 sm:mx-0 sm:flex-wrap sm:justify-center sm:gap-8 sm:overflow-visible sm:px-0"
    >
      {images.map((img, i) => (
        <li key={img.id} className="w-[68%] shrink-0 snap-center sm:w-56 lg:w-60">
          <button
            type="button"
            onClick={() => onOpen(i)}
            aria-label={`Open photo ${i + 1} of ${images.length}${img.caption ? `: ${img.caption}` : ''}`}
            style={{ rotate: `${TILTS[i % TILTS.length]}deg` }}
            className="block w-full bg-[#FFFEFB] p-3 pb-4 text-left shadow-[0_2px_4px_rgb(0_0_0/0.08),0_22px_40px_-22px_rgb(0_0_0/0.45)] transition duration-500 hover:z-10 hover:!rotate-0 hover:scale-[1.04] focus-visible:!rotate-0"
          >
            <img {...gridImg(img, '(min-width: 1024px) 240px, (min-width: 640px) 224px, 68vw')} alt={altOf(img, i)} loading="lazy" decoding="async" className="aspect-square w-full bg-[#eee8de] object-cover" />
            <span className="mt-3 block min-h-[1.6em] truncate text-center font-serif text-lg italic text-[#3A3531]">{img.caption}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------- 4. Film strip

function FilmStrip({ title, images, onOpen }: LayoutProps) {
  const reduce = useReducedMotion()
  const [paused, setPaused] = useState(false)
  const half = Math.ceil(images.length / 2)
  const rows = images.length > 5 ? [images.slice(0, half), images.slice(half)] : [images]
  const indexOf = (img: GalleryImage) => images.indexOf(img)

  const row = (list: GalleryImage[], r: number) => {
    const items = reduce ? list : [...list, ...list] // doubled for a seamless loop
    return (
      <div className="film-perf relative overflow-hidden bg-[#151312] py-4">
        <div
          className={cn('flex w-max', reduce ? 'px-3' : 'lux-marquee', r % 2 === 1 && 'lux-marquee-reverse')}
          style={{ ['--lux-marquee-duration' as string]: `${Math.max(24, list.length * 7)}s` }}
        >
          {items.map((img, k) => (
            <button
              key={`${img.id}-${k}`}
              type="button"
              tabIndex={k >= list.length ? -1 : 0}
              aria-hidden={k >= list.length || undefined}
              onClick={() => onOpen(indexOf(img))}
              aria-label={`Open photo ${indexOf(img) + 1} of ${images.length}${img.caption ? `: ${img.caption}` : ''}`}
              className="group relative mr-3 h-40 w-56 shrink-0 overflow-hidden rounded-[3px] sm:h-52 sm:w-72"
            >
              <img {...gridImg(img, '(min-width: 640px) 288px, 224px')} alt="" loading="lazy" decoding="async" className="size-full object-cover transition duration-700 group-hover:scale-105" />
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn('-mx-4 mt-12 space-y-3 sm:-mx-8', paused && 'lux-marquee-paused', reduce && 'overflow-x-auto')}
      role="group"
      aria-label={title}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {rows.map((list, r) => (
        <div key={r}>{row(list, r)}</div>
      ))}
      {!reduce && (
        <p className="pt-2 text-center">
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-xs uppercase tracking-[0.24em] text-muted transition hover:text-ink"
          >
            {paused ? <Play aria-hidden="true" className="size-3.5" /> : <Pause aria-hidden="true" className="size-3.5" />}
            {paused ? 'Play' : 'Pause'}
          </button>
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- 5. Featured mosaic

function FeaturedMosaic({ title, images, onOpen }: LayoutProps) {
  const reduce = useReducedMotion()
  const [active, setActive] = useState(0)
  const [hover, setHover] = useState(false)
  const { ref, inView } = useInView<HTMLDivElement>()
  useAutoAdvance(images.length, 5000, !reduce && !hover && inView, () => setActive((a) => wrap(a + 1, images.length)))
  const img = images[active]

  return (
    <div ref={ref} className="mt-12 grid gap-3 md:grid-cols-[1.7fr_1fr] md:gap-4" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button
        type="button"
        onClick={() => onOpen(active)}
        aria-label={`Open photo ${active + 1} of ${images.length}${img.caption ? `: ${img.caption}` : ''}`}
        className="group relative aspect-[4/5] overflow-hidden rounded-sm bg-linen shadow-soft sm:aspect-[4/3] md:aspect-auto md:min-h-[520px]"
      >
        <AnimatePresence initial={false}>
          <motion.img
            key={img.id}
            {...gridImg(img)}
            alt={altOf(img, active)}
            className="absolute inset-0 size-full object-cover"
            initial={{ opacity: 0, scale: reduce ? 1 : 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0.2 : 1.2, ease: [0.22, 1, 0.36, 1] }}
          />
        </AnimatePresence>
        {img.caption && (
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-5 pb-4 pt-14 text-left font-serif text-xl italic text-white">
            {img.caption}
          </span>
        )}
        <span className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-black/35 text-white opacity-0 transition group-hover:opacity-100">
          <Expand aria-hidden="true" className="size-4" />
        </span>
      </button>
      <ul aria-label={`${title} — choose a photo`} className="no-scrollbar flex gap-2 overflow-x-auto md:grid md:max-h-[520px] md:grid-cols-2 md:content-start md:gap-3 md:overflow-y-auto">
        {images.map((m, i) => (
          <li key={m.id} className="w-24 shrink-0 md:w-auto">
            <button
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show photo ${i + 1}${m.caption ? `: ${m.caption}` : ''}`}
              aria-pressed={i === active}
              className={cn(
                'block aspect-square w-full overflow-hidden rounded-sm transition',
                i === active ? 'ring-2 ring-champagne ring-offset-2 ring-offset-ivory' : 'opacity-70 hover:opacity-100',
              )}
            >
              <img {...gridImg(m, '160px')} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------- 6. Story

const STORY_MS = 5500

function StoryViewer({ title, images, onOpen }: LayoutProps) {
  const reduce = useReducedMotion()
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const { ref, inView } = useInView<HTMLDivElement>()
  const playing = !reduce && !paused && inView && images.length > 1
  const go = useCallback((d: number) => setI((x) => wrap(x + d, images.length)), [images.length])
  const img = images[i]

  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowRight') go(1)
    else if (e.key === 'ArrowLeft') go(-1)
  }

  return (
    <div ref={ref} className="mx-auto mt-12 max-w-[420px]">
      <div
        role="group"
        aria-roledescription="slideshow"
        aria-label={title}
        tabIndex={0}
        onKeyDown={onKey}
        className="relative aspect-[9/14] overflow-hidden rounded-2xl bg-black shadow-lift"
      >
        <AnimatePresence initial={false}>
          <motion.img
            key={`${img.id}-${i}`}
            {...gridImg(img)}
            alt={altOf(img, i)}
            className="absolute inset-0 size-full object-cover"
            initial={{ opacity: 0, scale: 1 }}
            animate={{ opacity: 1, scale: reduce ? 1 : 1.09 }}
            exit={{ opacity: 0 }}
            transition={{ opacity: { duration: 0.7 }, scale: { duration: STORY_MS / 1000 + 1, ease: 'linear' } }}
          />
        </AnimatePresence>
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/50 to-transparent px-3 pb-8 pt-3">
          <div className="flex gap-1" aria-hidden="true">
            {images.map((m, k) => (
              <span key={m.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
                <span
                  key={k === i ? `on-${i}` : 'off'}
                  className={cn('block h-full bg-white', k < i ? 'w-full' : k > i ? 'w-0' : reduce || images.length < 2 ? 'w-full' : 'lux-story-fill')}
                  style={k === i ? { ['--lux-story-ms' as string]: `${STORY_MS}ms`, animationPlayState: playing ? 'running' : 'paused' } : undefined}
                  onAnimationEnd={k === i ? () => go(1) : undefined}
                />
              </span>
            ))}
          </div>
        </div>
        {img.caption && (
          <p className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-5 pb-6 pt-16 text-center font-serif text-2xl italic text-white">
            {img.caption}
          </p>
        )}
        {/* Tap zones: left = back, right = next, middle = full screen */}
        <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="absolute inset-y-0 left-0 w-1/3" />
        <button type="button" onClick={() => onOpen(i)} aria-label={`Open photo ${i + 1} full screen`} className="absolute inset-y-0 left-1/3 w-1/3" />
        <button type="button" onClick={() => go(1)} aria-label="Next photo" className="absolute inset-y-0 right-0 w-1/3" />
      </div>
      <div className="mt-4 flex items-center justify-center gap-3 text-xs uppercase tracking-[0.24em] text-muted">
        <span className="tabular-nums">
          {i + 1} / {images.length}
        </span>
        {!reduce && images.length > 1 && (
          <button type="button" onClick={() => setPaused((p) => !p)} className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 transition hover:text-ink">
            {paused ? <Play aria-hidden="true" className="size-3.5" /> : <Pause aria-hidden="true" className="size-3.5" />}
            {paused ? 'Play' : 'Pause'}
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 7. Card deck

function CardDeck({ title, images, onOpen }: LayoutProps) {
  const reduce = useReducedMotion()
  const [top, setTop] = useState(0)
  const [dir, setDir] = useState<1 | -1>(1)
  const n = images.length
  const dragged = useRef(false)
  const next = (d: 1 | -1) => {
    setDir(d)
    setTop((t) => wrap(t + (d === 1 ? 1 : -1), n))
  }
  const stack = [0, 1, 2].slice(0, Math.min(3, n)).map((k) => ({ img: images[wrap(top + k, n)], idx: wrap(top + k, n), depth: k }))

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 90 || Math.abs(info.velocity.x) > 500) next(info.offset.x < 0 ? 1 : -1)
    window.setTimeout(() => (dragged.current = false), 0)
  }

  return (
    <div className="mt-12 flex flex-col items-center" role="group" aria-label={title}>
      <div className="relative aspect-[4/5] w-[min(78vw,360px)]">
        <AnimatePresence initial={false} custom={dir}>
          {[...stack].reverse().map(({ img, idx, depth }) => (
            <motion.div
              key={`${img.id}-${idx}`}
              custom={dir}
              className="absolute inset-0 touch-pan-y"
              style={{ zIndex: 10 - depth }}
              initial={{ opacity: 0, scale: 0.9, rotate: 0 }}
              animate={{ opacity: 1, scale: 1 - depth * 0.05, y: depth * 14, rotate: depth === 0 ? 0 : depth % 2 ? 3 : -3 }}
              variants={{ gone: (d: number) => ({ x: d * -420, rotate: d * -18, opacity: 0, transition: { duration: reduce ? 0.1 : 0.45 } }) }}
              exit="gone"
              transition={{ type: 'spring', stiffness: 260, damping: 26 }}
              drag={depth === 0 && !reduce ? 'x' : false}
              dragSnapToOrigin
              onDragStart={() => (dragged.current = true)}
              onDragEnd={onDragEnd}
            >
              <button
                type="button"
                tabIndex={depth === 0 ? 0 : -1}
                aria-hidden={depth !== 0 || undefined}
                onClick={() => !dragged.current && onOpen(idx)}
                aria-label={`Open photo ${idx + 1} of ${n}${img.caption ? `: ${img.caption}` : ''}`}
                className="block size-full rounded-xl bg-[#FFFEFB] p-2.5 pb-12 text-left shadow-[0_24px_50px_-26px_rgb(0_0_0/0.55)]"
              >
                <img {...gridImg(img, '(min-width: 462px) 360px, 78vw')} alt="" draggable={false} loading="lazy" decoding="async" className="size-full rounded-lg object-cover" />
                <span className="absolute inset-x-3 bottom-3 truncate text-center font-serif text-lg italic text-[#3A3531]">{img.caption}</span>
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="mt-10 flex items-center gap-4">
        <ArrowButton dir={-1} onClick={() => next(-1)} label="Previous photo" />
        <span className="min-w-14 text-center text-xs uppercase tabular-nums tracking-[0.2em] text-muted">
          {top + 1} / {n}
        </span>
        <ArrowButton dir={1} onClick={() => next(1)} label="Next photo" />
      </div>
      <p className="mt-3 text-xs text-muted">Swipe the top card, or tap it to see it full screen.</p>
    </div>
  )
}

// ---------------------------------------------------------------- 8. Coverflow

function Coverflow({ title, images, onOpen }: LayoutProps) {
  const reduce = useReducedMotion()
  const [active, setActive] = useState(0)
  const n = images.length
  const startX = useRef<number | null>(null)
  const swiped = useRef(false)
  const go = (d: number) => setActive((a) => wrap(a + d, n))
  const offset = (i: number) => {
    let d = i - active
    if (d > n / 2) d -= n
    if (d < -n / 2) d += n
    return d
  }
  const img = images[active]

  return (
    <div className="mt-12" role="group" aria-roledescription="carousel" aria-label={title}>
      <div
        className="relative mx-auto h-[min(110vw,460px)] max-w-5xl overflow-hidden [perspective:1400px]"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') go(1)
          else if (e.key === 'ArrowLeft') go(-1)
        }}
        onPointerDown={(e) => {
          startX.current = e.clientX
          swiped.current = false
        }}
        onPointerUp={(e) => {
          if (startX.current === null) return
          const dx = e.clientX - startX.current
          if (Math.abs(dx) > 40) {
            swiped.current = true
            go(dx < 0 ? 1 : -1)
          }
          startX.current = null
        }}
        onClickCapture={(e) => {
          if (swiped.current) {
            e.stopPropagation()
            e.preventDefault()
            swiped.current = false
          }
        }}
      >
        {images.map((m, i) => {
          const d = offset(i)
          const abs = Math.abs(d)
          if (abs > 3) return null
          return (
            <motion.button
              key={m.id}
              type="button"
              tabIndex={d === 0 ? 0 : -1}
              aria-hidden={d !== 0 || undefined}
              onClick={() => (d === 0 ? onOpen(i) : setActive(i))}
              aria-label={d === 0 ? `Open photo ${i + 1} of ${n} full screen` : `Show photo ${i + 1}`}
              className="absolute left-1/2 top-1/2 aspect-[3/4] w-[min(56vw,300px)] touch-pan-y overflow-hidden rounded-md bg-linen shadow-lift"
              style={{ zIndex: 10 - abs, marginLeft: 'calc(min(56vw, 300px) / -2)', marginTop: 'calc(min(56vw, 300px) * -0.6667)' }}
              animate={{
                x: `${d * 58}%`,
                rotateY: reduce ? 0 : d === 0 ? 0 : d < 0 ? 42 : -42,
                scale: 1 - abs * 0.12,
                opacity: abs === 3 ? 0 : 1 - abs * 0.18,
              }}
              transition={{ type: 'spring', stiffness: 220, damping: 28 }}
            >
              <img {...gridImg(m, '160px')} alt="" draggable={false} loading="lazy" decoding="async" className="size-full object-cover" />
            </motion.button>
          )
        })}
      </div>
      <div className="mt-6 flex items-center justify-center gap-4">
        <ArrowButton dir={-1} onClick={() => go(-1)} label="Previous photo" />
        <p className="min-h-[1.6em] max-w-xs text-center font-serif text-xl italic text-ink-soft" aria-live="polite">
          {img.caption || `${active + 1} / ${n}`}
        </p>
        <ArrowButton dir={1} onClick={() => go(1)} label="Next photo" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 9. Arched frames

const SHAPES = ['rounded-t-full aspect-[3/4]', 'rounded-[50%] aspect-[4/5]', 'rounded-sm aspect-square', 'rounded-t-full aspect-[2/3]', 'rounded-[50%] aspect-[3/4]', 'rounded-sm aspect-[4/5]']

function ArchedFrames({ title, images, onOpen }: LayoutProps) {
  return (
    <ul aria-label={title} className="mt-14 grid grid-cols-2 items-end gap-x-5 gap-y-10 sm:gap-x-8 md:grid-cols-3 lg:gap-x-12">
      {images.map((img, i) => {
        const shape = SHAPES[i % SHAPES.length]
        const radius = shape.split(' ')[0]
        return (
          <li key={img.id} className={cn(i % 3 === 1 && 'md:-translate-y-8')}>
            <Reveal delay={(i % 3) * 0.08}>
              <button
                type="button"
                onClick={() => onOpen(i)}
                aria-label={`Open photo ${i + 1} of ${images.length}${img.caption ? `: ${img.caption}` : ''}`}
                className={cn('group block w-full border border-champagne/60 p-1.5 transition duration-500 hover:border-champagne sm:p-2', radius)}
              >
                <span className={cn('block overflow-hidden', shape)}>
                  <img
                    {...gridImg(img, '(min-width: 768px) 30vw, 46vw')}
                    alt={altOf(img, i)}
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover transition duration-700 group-hover:scale-105"
                  />
                </span>
              </button>
              {img.caption && <p className="mt-3 text-center font-serif text-lg italic leading-snug text-ink-soft">{img.caption}</p>}
            </Reveal>
          </li>
        )
      })}
    </ul>
  )
}

// ---------------------------------------------------------------- 10. Timeline

function Timeline({ title, images, onOpen }: LayoutProps) {
  return (
    <ol aria-label={title} className="relative mx-auto mt-14 max-w-4xl">
      <span aria-hidden="true" className="absolute bottom-0 left-4 top-0 w-px bg-champagne/50 md:left-1/2" />
      {images.map((img, i) => {
        const right = i % 2 === 1
        return (
          <li key={img.id} className="relative pb-14 pl-12 last:pb-0 md:grid md:grid-cols-2 md:gap-14 md:pl-0">
            <span aria-hidden="true" className="absolute left-4 top-6 size-3 -translate-x-1/2 rotate-45 border border-champagne bg-ivory md:left-1/2" />
            <Reveal className={cn(right ? 'md:col-start-2' : 'md:col-start-1 md:text-right')}>
              <p className="eyebrow">Chapter {String(i + 1).padStart(2, '0')}</p>
              <button
                type="button"
                onClick={() => onOpen(i)}
                aria-label={`Open photo ${i + 1} of ${images.length}${img.caption ? `: ${img.caption}` : ''}`}
                className="group mt-3 block w-full overflow-hidden rounded-sm bg-linen shadow-card"
              >
                <img {...gridImg(img)} alt={altOf(img, i)} loading="lazy" decoding="async" className="aspect-[4/3] w-full object-cover transition duration-700 group-hover:scale-[1.03]" />
              </button>
              {img.caption && <p className="mt-4 font-serif text-2xl leading-snug text-ink">{img.caption}</p>}
            </Reveal>
          </li>
        )
      })}
    </ol>
  )
}
