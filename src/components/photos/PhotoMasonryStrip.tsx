import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import type { GuestPhoto, PhotoStyle } from '../../services/guestPhotosService'
import { shortName } from '../../services/presentService'
import { cn } from '../ui/cn'

/*
 * Column shapes, as parts of the strip's height: one tall photo, or two
 * stacked photos split unevenly — so a swipe shows several photos at once in
 * a hand-laid, masonry look.
 */
type Shape = { width: number; splits: number[] }
const SHAPES: Shape[] = [
  { width: 0.8, splits: [0.58, 0.42] },
  { width: 0.64, splits: [1] },
  { width: 0.62, splits: [0.42, 0.58] },
  { width: 0.92, splits: [0.5, 0.5] },
  { width: 1.04, splits: [1] },
  { width: 0.7, splits: [0.55, 0.45] },
  { width: 0.6, splits: [1] },
  { width: 0.76, splits: [0.4, 0.6] },
]

interface Column {
  key: string
  width: number
  tiles: { photo: GuestPhoto; index: number; share: number }[]
}

function toColumns(photos: GuestPhoto[]): Column[] {
  const cols: Column[] = []
  let i = 0
  let c = 0
  while (i < photos.length) {
    const shape = SHAPES[c % SHAPES.length]
    const take = Math.min(shape.splits.length, photos.length - i)
    // The very last photo on its own fills its column.
    const splits = take === shape.splits.length ? shape.splits : [1]
    cols.push({
      key: photos[i].id,
      width: take === shape.splits.length ? shape.width : 0.7,
      tiles: photos.slice(i, i + take).map((photo, k) => ({ photo, index: i + k, share: splits[k] })),
    })
    i += take
    c++
  }
  return cols
}

interface Props {
  photos: GuestPhoto[]
  style: PhotoStyle
  onOpen: (i: number) => void
  fresh?: Set<string>
  more?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
  /** Changes when the strip should slide back to the start (newest photos). */
  resetKey?: number
  /** Strip height on phones / bigger screens, in px. */
  height?: [number, number]
}

/**
 * Guest photos as a masonry strip you swipe left and right: tall and stacked
 * photos side by side, softly fading in as they slide into view and out as
 * they leave. More photos load in batches as you near the end.
 */
export function PhotoMasonryStrip({ photos, style, onOpen, fresh, more = false, loadingMore = false, onLoadMore, resetKey = 0, height = [320, 460] }: Props) {
  const reduce = useReducedMotion()
  const scroller = useRef<HTMLDivElement>(null)
  const end = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)
  const [edges, setEdges] = useState({ start: true, end: false })
  const [wide, setWide] = useState(() => (typeof window !== 'undefined' ? window.matchMedia('(min-width: 640px)').matches : false))
  const columns = useMemo(() => toColumns(photos), [photos])
  const polaroid = style === 'polaroid'
  const H = wide ? height[1] : height[0]
  // Phones: narrower columns, so a single view always shows several photos.
  const narrow = wide ? 1 : 0.64

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)')
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  const onScroll = useCallback(() => {
    const el = scroller.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setProgress(max > 0 ? el.scrollLeft / max : 0)
    setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft > max - 8 })
  }, [])
  useEffect(() => {
    onScroll()
  }, [onScroll, columns.length, H])

  // Near the end of the strip: the next batch.
  const loadRef = useRef(onLoadMore)
  useEffect(() => {
    loadRef.current = onLoadMore
  }, [onLoadMore])
  useEffect(() => {
    const el = end.current
    const root = scroller.current
    if (!el || !root || !more) return
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && loadRef.current?.(), { root, rootMargin: '0px 900px 0px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [more, columns.length])

  useEffect(() => {
    if (resetKey) scroller.current?.scrollTo({ left: 0, behavior: reduce ? 'auto' : 'smooth' })
  }, [resetKey, reduce])

  const page = (dir: 1 | -1) => {
    const el = scroller.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reduce ? 'auto' : 'smooth' })
  }

  const fade = 'linear-gradient(to right, transparent 0, #000 7%, #000 93%, transparent 100%)'
  const fadeStart = 'linear-gradient(to right, #000 0, #000 93%, transparent 100%)'
  const fadeEnd = 'linear-gradient(to right, transparent 0, #000 7%, #000 100%)'
  const mask = edges.start && edges.end ? 'none' : edges.start ? fadeStart : edges.end ? fadeEnd : fade

  return (
    <div className="relative w-full">
      <div
        ref={scroller}
        onScroll={onScroll}
        tabIndex={0}
        role="region"
        aria-label="Guest photos — swipe left or right"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') page(1)
          else if (e.key === 'ArrowLeft') page(-1)
        }}
        className="no-scrollbar flex snap-x snap-proximity gap-2 overflow-x-auto overscroll-x-contain scroll-px-4 px-4 pb-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:gap-3 sm:scroll-px-6 sm:px-6"
        style={{ height: H + 4, maskImage: mask, WebkitMaskImage: mask }}
      >
        {columns.map((col) => (
          <div key={col.key} className="flex shrink-0 snap-start flex-col gap-2 sm:gap-3" style={{ width: Math.round(H * col.width * narrow), height: H }}>
            {col.tiles.map(({ photo, index, share }) => (
              <Tile
                key={photo.id}
                photo={photo}
                polaroid={polaroid}
                isNew={Boolean(fresh?.has(photo.id))}
                root={scroller}
                reduce={Boolean(reduce)}
                style={{ flex: `${share} 1 0` }}
                onOpen={() => onOpen(index)}
              />
            ))}
          </div>
        ))}
        {more && (
          <div ref={end} className="flex shrink-0 items-center justify-center gap-2" style={{ width: Math.round(H * 0.6), height: H }}>
            {loadingMore ? <Loader2 aria-label="Loading more photos" className="size-6 animate-spin text-muted" /> : <span className="size-2 rounded-full bg-champagne/60" />}
          </div>
        )}
      </div>

      {/* Arrows on bigger screens (phones swipe) */}
      <button
        type="button"
        onClick={() => page(-1)}
        aria-label="Earlier photos"
        className={cn('absolute left-2 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-paper/90 text-ink shadow-soft transition hover:bg-paper sm:grid', edges.start && 'pointer-events-none opacity-0')}
        style={{ marginTop: -6 }}
      >
        <ChevronLeft className="size-5" />
      </button>
      <button
        type="button"
        onClick={() => page(1)}
        aria-label="More photos"
        className={cn('absolute right-2 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-paper/90 text-ink shadow-soft transition hover:bg-paper sm:grid', edges.end && !more && 'pointer-events-none opacity-0')}
        style={{ marginTop: -6 }}
      >
        <ChevronRight className="size-5" />
      </button>

      {/* Where you are in the strip */}
      <div className="mx-auto mt-5 flex max-w-xs items-center gap-3 px-4">
        <div className="h-px flex-1 overflow-hidden bg-line">
          <div className="h-full origin-left bg-gold transition-transform duration-200" style={{ transform: `scaleX(${Math.max(0.06, progress)})` }} />
        </div>
        {edges.start && photos.length > 3 && <span className="shrink-0 text-[0.65rem] uppercase tracking-[0.25em] text-muted">Swipe →</span>}
      </div>
    </div>
  )
}

function Tile({
  photo,
  polaroid,
  isNew,
  root,
  reduce,
  style,
  onOpen,
}: {
  photo: GuestPhoto
  polaroid: boolean
  isNew: boolean
  root: RefObject<HTMLDivElement | null>
  reduce: boolean
  style: CSSProperties
  onOpen: () => void
}) {
  const [loaded, setLoaded] = useState(false)
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      aria-label={`Photo by ${photo.by}`}
      // Fades in as it slides into view, and softly out as it leaves.
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ root, amount: 0.25, once: false, margin: '0px -4% 0px -4%' }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'group relative min-h-0 w-full overflow-hidden text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-gold',
        polaroid ? 'bg-white p-1.5 pb-7 shadow-card' : 'rounded-sm bg-linen/60',
        isNew && 'shadow-[0_0_0_2px_var(--color-champagne),0_10px_30px_-10px_rgba(184,155,106,0.8)]',
      )}
      style={style}
    >
      <span className={cn('relative block size-full overflow-hidden', polaroid ? 'bg-linen/60' : '', !loaded && 'animate-pulse bg-linen/80')}>
        <img
          src={photo.thumbUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={cn('size-full object-cover transition duration-700 group-hover:scale-[1.04]', loaded ? 'opacity-100' : 'opacity-0')}
        />
      </span>
      {polaroid ? (
        <span className="absolute inset-x-0 bottom-1.5 truncate px-2 text-center font-serif text-base italic leading-none text-ink-soft">{shortName(photo.by)}</span>
      ) : (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/50 to-transparent px-2.5 pb-1.5 pt-6 font-serif text-sm italic text-white/90">
          {shortName(photo.by)}
        </span>
      )}
    </motion.button>
  )
}
