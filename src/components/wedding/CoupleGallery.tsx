import { gridImg, sizedUrl } from '../../utils/imageSizes'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { GalleryImage, GalleryLayout } from '../../types/wedding'
import { Ornament } from '../ui/Ornament'
import { cn } from '../ui/cn'
import { Reveal } from './Reveal'

// The other eight layouts are downloaded only when chosen.
const GalleryLayoutView = lazy(() => import('./GalleryLayouts'))

interface Props {
  title: string
  subtitle: string
  layout: GalleryLayout
  images: GalleryImage[]
  /** Extra sections use their own heading id and small label. */
  headingId?: string
  eyebrow?: string
  /** On a page that already has the title (e.g. #/ideas): just the photos. */
  bare?: boolean
}

/** "Our Story in Frames" — magazine-style photo grid (or carousel) with a swipeable full-screen view. */
export function CoupleGallery({ title, subtitle, layout, images, headingId = 'gallery-heading', eyebrow = 'Moments', bare = false }: Props) {
  const [open, setOpen] = useState<number | null>(null)
  if (!images.length) return null

  return (
    <section aria-labelledby={bare ? undefined : headingId} aria-label={bare ? title : undefined} className={bare ? '-mt-12' : 'px-4 py-24 sm:px-8 sm:py-28'}>
      <div className="mx-auto max-w-6xl">
        {!bare && (
          <Reveal className="section-title text-center">
            <p className="eyebrow">{eyebrow}</p>
            <h2 id={headingId} className="mt-4 text-4xl text-ink sm:text-5xl">
              {title}
            </h2>
            {subtitle && <p className="mx-auto mt-4 max-w-lg text-ink-soft">{subtitle}</p>}
            <Ornament className="mt-8" />
          </Reveal>
        )}

        {layout === 'carousel' ? (
          <Carousel title={title} images={images} onOpen={setOpen} />
        ) : layout !== 'grid' ? (
          <Suspense fallback={<div className="mt-12 h-72 animate-pulse rounded-sm bg-linen/60" />}>
            <GalleryLayoutView layout={layout} title={title} images={images} onOpen={setOpen} />
          </Suspense>
        ) : (
          <ul className="mt-12 columns-2 gap-3 sm:gap-4 lg:columns-3" aria-label={title}>
            {images.map((img, i) => (
              <li key={img.id} className="mb-3 break-inside-avoid sm:mb-4">
                <Reveal delay={(i % 3) * 0.06}>
                  <Photo img={img} index={i} total={images.length} onOpen={setOpen} />
                </Reveal>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Lightbox images={images} index={open} onChange={setOpen} />
    </section>
  )
}

/** Swipeable row with ‹ › buttons that move one photo at a time. */
function Carousel({ title, images, onOpen }: { title: string; images: GalleryImage[]; onOpen: (i: number) => void }) {
  const reduce = useReducedMotion()
  const listRef = useRef<HTMLUListElement>(null)
  const [edge, setEdge] = useState({ start: true, end: false })

  const update = useCallback(() => {
    const el = listRef.current
    if (!el) return
    setEdge({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 })
  }, [])

  useEffect(() => {
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [update, images.length])

  const go = (dir: -1 | 1) => {
    const el = listRef.current
    const item = el?.querySelector('li')
    if (!el || !item) return
    const gap = parseFloat(getComputedStyle(el).columnGap || '16') || 16
    el.scrollBy({ left: dir * (item.getBoundingClientRect().width + gap), behavior: reduce ? 'auto' : 'smooth' })
  }

  const arrow = (dir: -1 | 1) => {
    const hidden = dir < 0 ? edge.start : edge.end
    return (
      <button
        type="button"
        onClick={() => go(dir)}
        aria-label={dir < 0 ? 'Previous photos' : 'Next photos'}
        aria-hidden={hidden || undefined}
        tabIndex={hidden ? -1 : 0}
        className={cn(
          'absolute top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-champagne/60 bg-paper/90 text-ink shadow-card backdrop-blur transition duration-300 hover:bg-paper sm:size-12',
          dir < 0 ? 'left-1 sm:-left-5' : 'right-1 sm:-right-5',
          hidden ? 'pointer-events-none opacity-0' : 'opacity-100',
        )}
      >
        {dir < 0 ? <ChevronLeft aria-hidden="true" className="size-5" strokeWidth={1.6} /> : <ChevronRight aria-hidden="true" className="size-5" strokeWidth={1.6} />}
      </button>
    )
  }

  return (
    <div className="relative mt-12">
      {arrow(-1)}
      <ul
        ref={listRef}
        onScroll={update}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
        aria-label={title}
      >
        {images.map((img, i) => (
          <li key={img.id} className="w-[80%] shrink-0 snap-center sm:w-[46%] lg:w-[31%]">
            <Photo img={img} index={i} total={images.length} onOpen={onOpen} className="aspect-[4/5]" />
          </li>
        ))}
      </ul>
      {arrow(1)}
    </div>
  )
}

function Photo({ img, index, total, onOpen, className }: { img: GalleryImage; index: number; total: number; onOpen: (i: number) => void; className?: string }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <figure className="group relative overflow-hidden rounded-sm bg-linen/60 shadow-soft">
      <button type="button" onClick={() => onOpen(index)} className="block w-full" aria-label={`Open photo ${index + 1} of ${total}${img.caption ? `: ${img.caption}` : ''}`}>
        <img
          {...gridImg(img)}
          alt={img.caption || `Photo ${index + 1}`}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={cn(
            'block w-full object-cover transition duration-700 ease-out group-hover:scale-[1.03]',
            loaded ? 'opacity-100' : 'opacity-0',
            className,
          )}
        />
      </button>
      {img.caption && (
        <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 pb-3 pt-10 font-serif text-lg italic text-white opacity-0 transition duration-300 group-hover:opacity-100">
          {img.caption}
        </figcaption>
      )}
    </figure>
  )
}

export function Lightbox({ images, index, onChange }: { images: GalleryImage[]; index: number | null; onChange: (i: number | null) => void }) {
  const reduce = useReducedMotion()
  const touchX = useRef<number | null>(null)
  const [dir, setDir] = useState(0)
  const count = images.length

  const go = useCallback(
    (step: number) => {
      if (index === null) return
      setDir(step)
      onChange((index + step + count) % count)
    },
    [index, count, onChange],
  )

  useEffect(() => {
    if (index === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onChange(null)
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', onKey)
    }
  }, [index, go, onChange])

  const img = index !== null ? images[index] : null

  return (
    <AnimatePresence>
      {img && index !== null && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={`Photo ${index + 1} of ${count}`}
          className="fixed inset-0 z-50 flex flex-col bg-[#141211]/95 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX.current === null) return
            const dx = e.changedTouches[0].clientX - touchX.current
            if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
            touchX.current = null
          }}
        >
          <div className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] text-white/80">
            <span className="text-xs uppercase tracking-[0.3em]">
              {index + 1} / {count}
            </span>
            <button type="button" onClick={() => onChange(null)} autoFocus aria-label="Close" className="flex size-11 items-center justify-center rounded-full hover:bg-white/10">
              <X className="size-6" />
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16" onClick={() => onChange(null)}>
            <AnimatePresence mode="popLayout" initial={false} custom={dir}>
              <motion.figure
                key={img.id}
                className="flex max-h-full flex-col items-center"
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -60 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                onClick={(e) => e.stopPropagation()}
              >
                <img src={sizedUrl(img.imageUrl, 1800)} alt={img.caption || `Photo ${index + 1}`} decoding="async" className="max-h-[78dvh] w-auto max-w-full rounded-sm object-contain shadow-lift" />
                {img.caption && <figcaption className="mt-4 text-center font-serif text-2xl italic text-white">{img.caption}</figcaption>}
              </motion.figure>
            </AnimatePresence>

            {count > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    go(-1)
                  }}
                  aria-label="Previous photo"
                  className="absolute left-2 top-1/2 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:flex"
                >
                  <ChevronLeft className="size-6" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    go(1)
                  }}
                  aria-label="Next photo"
                  className="absolute right-2 top-1/2 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:flex"
                >
                  <ChevronRight className="size-6" />
                </button>
              </>
            )}
          </div>
          <p className="pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-center text-xs text-white/50 sm:hidden">Swipe to see more</p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
