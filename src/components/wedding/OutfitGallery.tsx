import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { MotifColor, OutfitGender, OutfitImage, OutfitLayout } from '../../types/wedding'
import { outfitPairs, type OutfitPair } from '../../utils/outfitPairs'
import { MotifSwatches } from './MotifSwatches'
import { cn } from '../ui/cn'
import { Ornament } from '../ui/Ornament'
import { Reveal } from './Reveal'
import { useSectionText } from '../../hooks/useSectionText'

interface Props {
  title: string
  subtitle: string
  images: OutfitImage[]
  /** tabs = For Him / For Her; pairs = his & hers side by side under one label. */
  layout?: OutfitLayout
  motifTitle?: string
  motifColors?: MotifColor[]
}

const TABS: { value: OutfitGender; label: string }[] = [
  { value: 'male', label: 'For Him' },
  { value: 'female', label: 'For Her' },
]

/** What the enlarged view shows: one photo, or a pair side by side. */
interface View {
  label: string
  images: OutfitImage[]
}

/** "Attire inspiration" — admin-managed outfit images in a swipeable carousel. */
export function OutfitGallery({ title, subtitle, images, layout = 'tabs', motifTitle = '', motifColors = [] }: Props) {
  const t = useSectionText('attire')
  const reduce = useReducedMotion()
  const groups = useMemo(
    () => ({
      male: images.filter((i) => i.gender === 'male'),
      female: images.filter((i) => i.gender === 'female'),
    }),
    [images],
  )
  const pairs = useMemo(() => outfitPairs(groups.male, groups.female), [groups])
  const available = TABS.filter((t) => groups[t.value].length > 0)
  const [tab, setTab] = useState<OutfitGender>(available[0]?.value ?? 'male')
  const [view, setView] = useState<View | null>(null)
  const active = groups[tab].length ? tab : (available[0]?.value ?? 'male')

  if (!available.length) return null
  const sideBySide = layout === 'pairs'

  return (
    <section aria-labelledby="outfits-heading" className="overflow-hidden bg-cream/60 px-5 py-24 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="section-title text-center">
          <p className="eyebrow">{t('eyebrow', 'Dress Code')}</p>
          <h2 id="outfits-heading" className="mt-4 text-4xl text-ink sm:text-5xl">
            {title}
          </h2>
          {subtitle && <p className="mx-auto mt-4 max-w-lg text-ink-soft">{subtitle}</p>}
          <Ornament className="mt-8" />
        </Reveal>

        {motifColors.length > 0 && (
          <Reveal>
            <MotifSwatches title={motifTitle} colors={motifColors} className="mt-10" />
          </Reveal>
        )}

        {sideBySide ? (
          <div className="mt-12" data-outfit-layout="pairs">
            <Carousel
              count={pairs.length}
              label="Outfit ideas"
              itemClassName="w-[88%] shrink-0 snap-center sm:w-[calc((100%-1.25rem)/2)] sm:snap-start"
              ariaFor={(i) => `${i + 1} of ${pairs.length}${pairs[i].label ? `: ${pairs[i].label}` : ''}`}
              render={(i) => <PairCard pair={pairs[i]} onOpen={() => setView({ label: pairs[i].label, images: pairs[i].images })} />}
            />
          </div>
        ) : (
          <>
            {available.length > 1 && (
              <div role="tablist" aria-label="Outfit ideas" className="mx-auto mt-10 flex w-fit rounded-full border border-line bg-paper p-1 shadow-soft">
                {available.map((t) => {
                  const selected = t.value === active
                  return (
                    <button
                      key={t.value}
                      type="button"
                      role="tab"
                      id={`outfit-tab-${t.value}`}
                      aria-selected={selected}
                      aria-controls="outfit-panel"
                      onClick={() => setTab(t.value)}
                      className={cn(
                        'relative min-h-11 rounded-full px-6 text-[0.72rem] font-medium uppercase tracking-[0.28em] transition-colors sm:px-8',
                        selected ? 'text-ivory' : 'text-ink-soft hover:text-ink',
                      )}
                    >
                      {selected && (
                        <motion.span
                          layoutId={reduce ? undefined : 'outfit-tab-pill'}
                          className="absolute inset-0 rounded-full bg-ink"
                          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                        />
                      )}
                      <span className="relative">{t.label}</span>
                    </button>
                  )
                })}
              </div>
            )}

            <div id="outfit-panel" role="tabpanel" aria-labelledby={`outfit-tab-${active}`} className="mt-10" data-outfit-layout="tabs">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={active}
                  initial={{ opacity: 0, y: reduce ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Carousel
                    count={groups[active].length}
                    label={`${TABS.find((t) => t.value === active)?.label ?? ''} outfit ideas`}
                    itemClassName="w-[78%] shrink-0 snap-center sm:w-[calc((100%-1.25rem)/2)] sm:snap-start lg:w-[calc((100%-2.5rem)/3)]"
                    ariaFor={(i) => {
                      const img = groups[active][i]
                      return `${i + 1} of ${groups[active].length}${img.label ? `, ${img.label}` : ''}${img.caption ? `: ${img.caption}` : ''}`
                    }}
                    render={(i) => {
                      const img = groups[active][i]
                      return <SingleCard image={img} alt={img.caption || `Outfit idea ${i + 1}`} onOpen={() => setView({ label: img.label, images: [img] })} />
                    }}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </>
        )}
      </div>

      <Lightbox view={view} onClose={() => setView(null)} />
    </section>
  )
}

/** One look: the photo, then its label and caption. */
function SingleCard({ image, alt, onOpen }: { image: OutfitImage; alt: string; onOpen: () => void }) {
  return (
    <figure>
      <button
        type="button"
        onClick={onOpen}
        className="group fine-frame block w-full overflow-hidden rounded-sm bg-paper shadow-card"
        aria-label={`View larger${image.caption ? `: ${image.caption}` : ''}`}
      >
        <img
          src={image.imageUrl}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="aspect-[3/4] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
        />
      </button>
      {(image.label || image.caption) && (
        <figcaption className="mt-4 text-center">
          {image.label && <span className="block text-[0.68rem] font-medium uppercase tracking-[0.3em] text-gold">{image.label}</span>}
          {image.caption && <span className={cn('block font-serif text-xl text-ink', image.label && 'mt-1.5')}>{image.caption}</span>}
        </figcaption>
      )}
    </figure>
  )
}

/** His & hers side by side in one frame, with one label above and each caption under its photo. */
function PairCard({ pair, onOpen }: { pair: OutfitPair; onOpen: () => void }) {
  const both = pair.images.length === 2
  return (
    <figure data-outfit-pair>
      {pair.label ? (
        <p className="mb-4 text-center text-[0.7rem] font-medium uppercase tracking-[0.3em] text-gold">{pair.label}</p>
      ) : (
        <p aria-hidden="true" className="mb-4 h-[1.05rem]" />
      )}
      <button
        type="button"
        onClick={onOpen}
        className="group fine-frame block w-full overflow-hidden rounded-sm bg-paper shadow-card"
        aria-label={`View larger${pair.label ? `: ${pair.label}` : ''}`}
      >
        <span className={cn('grid', both ? 'grid-cols-2' : 'mx-auto w-1/2 grid-cols-1')}>
          {pair.images.map((img, k) => (
            <span key={img.id} className={cn('relative block overflow-hidden', both && k === 0 && 'border-r border-line/60')}>
              <img
                src={img.imageUrl}
                alt={img.caption || (img.gender === 'male' ? 'His outfit' : 'Her outfit')}
                loading="lazy"
                decoding="async"
                draggable={false}
                className="aspect-[3/4] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
              />
            </span>
          ))}
        </span>
      </button>
      <figcaption className={cn('mt-4 grid gap-4 text-center', both ? 'grid-cols-2' : 'grid-cols-1')}>
        {pair.images.map((img) => (
          <span key={img.id} className="block">
            <span className="block text-[0.62rem] uppercase tracking-[0.28em] text-muted">{img.gender === 'male' ? 'For him' : 'For her'}</span>
            {img.caption && <span className="mt-1 block font-serif text-lg leading-snug text-ink">{img.caption}</span>}
          </span>
        ))}
      </figcaption>
    </figure>
  )
}

function Carousel({
  count,
  label,
  itemClassName,
  ariaFor,
  render,
}: {
  count: number
  label: string
  itemClassName: string
  ariaFor: (i: number) => string
  render: (i: number) => ReactNode
}) {
  const trackRef = useRef<HTMLUListElement>(null)
  const [index, setIndex] = useState(0)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(count > 1)

  const update = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const first = el.firstElementChild as HTMLElement | null
    const step = first ? first.offsetWidth + parseFloat(getComputedStyle(el).columnGap || '0') : el.clientWidth
    setIndex(Math.min(count - 1, Math.max(0, Math.round(el.scrollLeft / Math.max(step, 1)))))
    setCanPrev(el.scrollLeft > 4)
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [count])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    update()
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [update])

  const scrollToIndex = (i: number) => {
    const item = trackRef.current?.children[i] as HTMLElement | undefined
    item?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }

  const go = (dir: -1 | 1) => {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' })
  }

  return (
    <div className="relative">
      <ul
        ref={trackRef}
        aria-label={label}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') {
            e.preventDefault()
            go(1)
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault()
            go(-1)
          }
        }}
        className={cn(
          'no-scrollbar -mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth px-5 pb-2 sm:mx-0 sm:px-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60',
          count < 3 && 'sm:justify-center',
        )}
      >
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className={itemClassName} aria-label={ariaFor(i)}>
            {render(i)}
          </li>
        ))}
      </ul>

      {count > 1 && (
        <>
          <ArrowButton side="left" disabled={!canPrev} onClick={() => go(-1)} />
          <ArrowButton side="right" disabled={!canNext} onClick={() => go(1)} />
          <div className={cn('mt-6 flex justify-center gap-2', !canPrev && !canNext && 'invisible')} aria-hidden="true">
            {Array.from({ length: count }, (_, i) => (
              <button
                key={i}
                type="button"
                tabIndex={-1}
                onClick={() => scrollToIndex(i)}
                className={cn('h-1.5 rounded-full transition-all duration-300', i === index ? 'w-6 bg-gold' : 'w-1.5 bg-champagne/40 hover:bg-champagne')}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ArrowButton({ side, disabled, onClick }: { side: 'left' | 'right'; disabled: boolean; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === 'left' ? 'Previous outfits' : 'Next outfits'}
      className={cn(
        'absolute top-[calc(50%-1.5rem)] hidden size-12 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-paper/95 text-ink shadow-card backdrop-blur transition hover:border-champagne disabled:pointer-events-none disabled:opacity-0 sm:flex',
        side === 'left' ? '-left-3 lg:-left-6' : '-right-3 lg:-right-6',
      )}
    >
      <Icon className="size-5" strokeWidth={1.5} />
    </button>
  )
}

function Lightbox({ view, onClose }: { view: View | null; onClose: () => void }) {
  const reduce = useReducedMotion()
  useEffect(() => {
    if (!view) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [view, onClose])

  const pair = (view?.images.length ?? 0) > 1
  const single = view && !pair ? view.images[0] : null

  return (
    <AnimatePresence>
      {view && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={[view.label, ...view.images.map((i) => i.caption)].filter(Boolean).join(': ') || 'Outfit idea'}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.figure
            className={cn('relative max-h-full w-full', pair ? 'max-w-3xl' : 'max-w-md')}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {pair && view.label && <p className="mb-3 text-center text-xs font-medium uppercase tracking-[0.3em] text-champagne-light">{view.label}</p>}
            {pair ? (
              <div className="grid grid-cols-2 overflow-hidden rounded-sm bg-paper shadow-lift">
                {view.images.map((img, k) => (
                  <img
                    key={img.id}
                    src={img.imageUrl}
                    alt={img.caption || (img.gender === 'male' ? 'His outfit' : 'Her outfit')}
                    className={cn('max-h-[72dvh] w-full object-contain', k === 0 && 'border-r border-line/60')}
                  />
                ))}
              </div>
            ) : (
              single && <img src={single.imageUrl} alt={single.caption || 'Outfit idea'} className="max-h-[80dvh] w-full rounded-sm bg-paper object-contain shadow-lift" />
            )}
            {pair ? (
              <figcaption className="mt-4 grid grid-cols-2 gap-4 text-center">
                {view.images.map((img) => (
                  <span key={img.id} className="block">
                    <span className="block text-[0.62rem] uppercase tracking-[0.28em] text-white/60">{img.gender === 'male' ? 'For him' : 'For her'}</span>
                    {img.caption && <span className="mt-1 block font-serif text-xl text-white">{img.caption}</span>}
                  </span>
                ))}
              </figcaption>
            ) : (
              single &&
              (view.label || single.caption) && (
                <figcaption className="mt-4 text-center">
                  {view.label && <span className="block text-xs font-medium uppercase tracking-[0.3em] text-champagne-light">{view.label}</span>}
                  {single.caption && <span className={cn('block font-serif text-2xl text-white', view.label && 'mt-1.5')}>{single.caption}</span>}
                </figcaption>
              )
            )}
            <button
              type="button"
              onClick={onClose}
              autoFocus
              aria-label="Close"
              className="absolute -top-3 -right-3 flex size-11 items-center justify-center rounded-full bg-paper text-ink shadow-card"
            >
              <X className="size-5" />
            </button>
          </motion.figure>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
