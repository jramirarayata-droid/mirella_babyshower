import { sizedUrl, srcSetOf } from '../../utils/imageSizes'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import type { WeddingSettings } from '../../types/wedding'
import { arrivalText, formatWeddingDate } from '../../utils/formatting'
import { Ornament } from '../ui/Ornament'
import { cn } from '../ui/cn'
import { CoupleNames } from './CoupleNames'
import { HeroDecor } from './HeroDecor'
import { ArchFlowers } from './ArchFlowers'
import { GreeneryPhotoFrame } from './looks/GreeneryArt'
import { GardenPhotoSpray } from './looks/LookArt'
import { BalloonsAround, CloudsAround, MoonShape, RainbowArches, StarShape, SunBehind, Twinkle } from './looks/BabyArt'
import { Monogram } from './Monogram'
import { isRsvpOpen } from '../../services/settingsService'
import { useFinderOpen } from '../../hooks/useFinderOpen'
import { GuestMenu } from './GuestMenu'
import { MusicToggle } from './MusicPlayer'
import { useResolvedTheme } from '../../theme/themeContext'

type Tone = 'onPhoto' | 'onPaper'

/** The line above the baby's name, per look (others: "Join us for a baby shower"). */
const EYEBROW: Partial<Record<string, string>> = {
  clouds: 'We’re over the moon',
  balloons: 'Oh baby!',
  maison: 'Twinkle, twinkle, little star',
  deco: 'Here comes the sun',
  garden: 'A little blossom is on the way',
  arch: 'Somewhere over the rainbow',
}

/** Hero in one of four layouts, chosen in Admin → Look & Feel. */
export function Hero({ settings }: { settings: WeddingSettings }) {
  const { heroLayout, look } = useResolvedTheme()
  const reduce = useReducedMotion()
  const [imageFailed, setImageFailed] = useState(false)
  const hasImage = Boolean(settings.heroImageUrl) && !imageFailed

  const fade = (delay: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.4 } }
      : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 1, delay, ease: [0.22, 1, 0.36, 1] as const } }

  const photo = (className: string) =>
    hasImage ? (
      <motion.img
        src={sizedUrl(settings.heroImageUrl, 1800)}
        srcSet={srcSetOf({ imageUrl: settings.heroImageUrl })}
        sizes="100vw"
        alt=""
        onError={() => setImageFailed(true)}
        className={className}
        initial={reduce ? false : { scale: 1.06 }}
        animate={{ scale: 1 }}
        transition={{ duration: 2.4, ease: 'easeOut' }}
        fetchPriority="high"
      />
    ) : (
      // No photo yet: a soft sky with a sleeping moon, so the hero still looks finished.
      <div aria-hidden="true" className={cn('grid place-items-center bg-[linear-gradient(180deg,var(--color-linen),var(--color-cream))]', className)}>
        <div className="relative w-[38%] max-w-40 text-champagne">
          <MoonShape className="w-full opacity-80" />
          <StarShape className="absolute -right-[30%] -top-[18%] w-[26%] opacity-70" />
          <Twinkle className="absolute -left-[34%] top-[30%] w-[18%] opacity-60" />
        </div>
      </div>
    )

  const names = settings.heroTitle || settings.babyName
  // Each look has its own opening line; the rest say what the day is.
  const eyebrow = EYEBROW[look] ?? 'Join us for a baby shower'
  const arriving = arrivalText(settings)

  // ---------------------------------------------------------------- split
  if (heroLayout === 'split') {
    return (
      <header className="hero relative flex min-h-[100svh] flex-col bg-ivory text-ink">
        <Nav settings={settings} tone="onPaper" reduce={reduce} />
        <div className="grid flex-1 md:grid-cols-2">
          <div className="relative order-first h-[52svh] overflow-hidden md:order-last md:h-auto">{photo('absolute inset-0 size-full object-cover')}</div>
          <div className="hero-paper paper-texture relative flex flex-col items-center justify-center px-6 py-16 text-center md:px-12">
            <HeroDecor onPhoto={false} />
            <motion.p {...fade(0.2)} className="hero-eyebrow eyebrow">
              {eyebrow}
            </motion.p>
            <motion.h1 {...fade(0.4)} className="hero-names mt-6 text-[clamp(3.2rem,9vw,6.5rem)] font-light leading-[0.95] tracking-tight text-ink">
              <CoupleNames names={names} />
            </motion.h1>
            {settings.heroSubtitle && (
              <motion.p {...fade(0.6)} className="mt-5 font-serif text-2xl italic text-ink-soft sm:text-3xl">
                {settings.heroSubtitle}
              </motion.p>
            )}
            <motion.div {...fade(0.8)} className="mt-9 flex flex-col items-center gap-4">
              <Ornament />
              <p className="text-sm font-medium uppercase tracking-[0.36em] text-ink sm:text-base">{formatWeddingDate(settings.weddingDate)}</p>
              {arriving && <p className="hero-arriving font-serif text-lg italic text-ink-soft">{arriving}</p>}
            </motion.div>
          </div>
        </div>
      </header>
    )
  }

  // ---------------------------------------------------------------- framed
  if (heroLayout === 'framed') {
    return (
      <header className="hero hero-paper paper-texture relative flex min-h-[100svh] flex-col text-ink">
        {/* Looks that decorate the photo itself skip the page frame (one frame too many). */}
        {!['leaf', 'garden', 'clouds', 'balloons', 'arch'].includes(look) && <HeroDecor onPhoto={false} belowNav />}
        <Nav settings={settings} tone="onPaper" reduce={reduce} />
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 pb-20 pt-6 text-center">
          <motion.p {...fade(0.1)} className="hero-eyebrow eyebrow">
            {eyebrow}
          </motion.p>
          <div className="hero-arch-wrap relative isolate mt-7">
            <motion.div
              {...fade(0.25)}
              className="hero-arch relative aspect-[3/4] w-[min(72vw,340px)] overflow-hidden rounded-t-full border border-champagne/50 p-2 shadow-card"
            >
              <div className="hero-arch-photo relative size-full overflow-hidden rounded-t-full">{photo('absolute inset-0 size-full object-cover')}</div>
            </motion.div>
            {look === 'arch' && <RainbowArches className="absolute -top-[16%] left-1/2 -z-10 w-[150%] max-w-none -translate-x-1/2" />}
            {look === 'deco' && <SunBehind />}
            {look === 'leaf' ? (
              <GreeneryPhotoFrame />
            ) : look === 'garden' ? (
              <GardenPhotoSpray />
            ) : look === 'clouds' ? (
              <CloudsAround />
            ) : look === 'maison' ? (
              <CloudsAround clouds={false} />
            ) : look === 'balloons' ? (
              <BalloonsAround />
            ) : look === 'arch' || look === 'deco' ? null : (
              <ArchFlowers />
            )}
          </div>
          <motion.h1 {...fade(0.45)} className="hero-names mt-9 text-[clamp(3rem,10vw,5.8rem)] font-light leading-[0.95] tracking-tight text-ink">
            <CoupleNames names={names} />
          </motion.h1>
          {settings.heroSubtitle && (
            <motion.p {...fade(0.6)} className="mt-4 font-serif text-2xl italic text-ink-soft sm:text-3xl">
              {settings.heroSubtitle}
            </motion.p>
          )}
          <motion.div {...fade(0.75)} className="mt-8 flex flex-col items-center gap-4">
            <Ornament />
            <p className="text-sm font-medium uppercase tracking-[0.36em] text-ink sm:text-base">{formatWeddingDate(settings.weddingDate)}</p>
            {arriving && <p className="hero-arriving font-serif text-lg italic text-ink-soft">{arriving}</p>}
          </motion.div>
        </div>
        <ScrollCue tone="onPaper" reduce={reduce} />
      </header>
    )
  }

  // ---------------------------------------------------------------- full photo (center / left)
  const left = heroLayout === 'left'
  return (
    <header className="hero hero-photo relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-[#141211] text-white">
      <HeroDecor onPhoto belowNav />
      {photo('absolute inset-0 -z-20 size-full object-cover')}
      {/* Soft veil for legibility — heavier toward the text on the "left" layout */}
      <div
        aria-hidden="true"
        className={cn(
          'absolute inset-0 -z-10',
          left
            ? 'bg-[linear-gradient(to_top,rgb(20_19_18/0.72),rgb(20_19_18/0.25)_55%,rgb(20_19_18/0.15))]'
            : 'bg-[radial-gradient(ellipse_at_center,rgb(20_19_18/0.25),rgb(20_19_18/0.6))]',
        )}
      />
      <Nav settings={settings} tone="onPhoto" reduce={reduce} />

      <div
        className={cn(
          'hero-copy mx-auto flex w-full flex-1 flex-col px-6',
          left ? 'max-w-6xl items-start justify-end pb-28 pt-10 text-left sm:px-8' : 'max-w-4xl items-center justify-center pb-24 pt-10 text-center',
        )}
      >
        <motion.p {...fade(0.2)} className="hero-eyebrow text-[0.72rem] font-medium uppercase tracking-[0.42em] text-white/80">
          {eyebrow}
        </motion.p>
        <motion.h1 {...fade(0.4)} className="hero-names mt-6 text-[clamp(3.5rem,14vw,8.5rem)] font-light leading-[0.95] tracking-tight text-white">
          <CoupleNames names={names} ampClassName="text-champagne-light" />
        </motion.h1>
        {settings.heroSubtitle && (
          <motion.p {...fade(0.65)} className="mt-5 font-serif text-2xl italic text-white/90 sm:text-3xl">
            {settings.heroSubtitle}
          </motion.p>
        )}
        <motion.div {...fade(0.85)} className={cn('mt-9 flex flex-col gap-4', left ? 'items-start' : 'items-center')}>
          {left ? <span aria-hidden="true" className="h-px w-20 bg-white/50" /> : <Ornament light />}
          <p className="text-sm font-medium uppercase tracking-[0.36em] text-white sm:text-base">{formatWeddingDate(settings.weddingDate)}</p>
          {arriving && <p className="hero-arriving font-serif text-lg italic text-white/90">{arriving}</p>}
        </motion.div>
      </div>

      <ScrollCue tone="onPhoto" reduce={reduce} />
    </header>
  )
}

function Nav({ settings, tone, reduce }: { settings: WeddingSettings; tone: Tone; reduce: boolean | null }) {
  const finderOpen = useFinderOpen()
  const onPhoto = tone === 'onPhoto'
  const text = cn('hidden rounded px-2 py-2 uppercase tracking-[0.28em] transition md:inline-block', onPhoto ? 'text-white/85 hover:text-white' : 'text-ink-soft hover:text-ink')
  return (
    <nav
      aria-label="Primary"
      className={cn(
        'z-20 w-full',
        onPhoto ? '' : 'sticky top-0 border-b border-line/60 bg-ivory/85 backdrop-blur-md supports-[backdrop-filter]:bg-ivory/70',
      )}
    >
      <div
        className={cn(
          'mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-4 min-[400px]:px-5 sm:px-8',
          onPhoto ? 'pt-[max(1.25rem,env(safe-area-inset-top))]' : 'py-3 pt-[max(0.75rem,env(safe-area-inset-top))]',
        )}
      >
        <Link
          to="/"
          className={cn('shrink-0 whitespace-nowrap font-serif text-2xl italic tracking-wide', onPhoto ? 'text-white/95' : 'text-ink')}
          aria-label={`${settings.coupleNames} — home`}
        >
          <Monogram height="2.1em" />
        </Link>
        <div className="flex min-w-0 items-center justify-end gap-1.5 text-[0.72rem] font-medium uppercase tracking-[0.28em] sm:gap-3">
          {/* Wide screens: the main pages by name. Phones: everything is in the Menu. */}
          <button type="button" onClick={() => scrollToSection('details', reduce)} className={text}>
            Details
          </button>
          {finderOpen && (
            <Link to="/seat" className={cn(text, 'whitespace-nowrap')}>
              Find My Seat
            </Link>
          )}
          {isRsvpOpen(settings) && (
            <Link
              to="/rsvp"
              className={cn(
                'lux-pill max-w-[38vw] shrink truncate rounded-full border px-4 py-2 text-center leading-tight transition min-[400px]:px-5 sm:max-w-none',
                settings.rsvpButtonLabel.length > 8 && 'tracking-[0.12em] min-[400px]:tracking-[0.16em]',
                onPhoto ? 'border-white/50 text-white hover:border-white hover:bg-white/10' : 'border-ink/40 text-ink hover:border-ink hover:bg-ink/5',
              )}
            >
              {settings.rsvpButtonLabel}
            </Link>
          )}
          <MusicToggle tone={onPhoto ? 'onPhoto' : 'light'} />
          <GuestMenu tone={onPhoto ? 'onPhoto' : 'light'} />
        </div>
      </div>
    </nav>
  )
}

function ScrollCue({ tone, reduce }: { tone: Tone; reduce: boolean | null }) {
  return (
    <button
      type="button"
      onClick={() => scrollToSection('details', reduce)}
      aria-label="Scroll to the shower details"
      className={cn(
        'absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 rounded p-2 text-[0.65rem] uppercase tracking-[0.3em] transition',
        tone === 'onPhoto' ? 'text-white/70 hover:text-white' : 'text-muted hover:text-ink',
      )}
    >
      <span>Scroll</span>
      <ChevronDown aria-hidden="true" className="size-4 motion-safe:animate-bounce" strokeWidth={1.5} />
    </button>
  )
}

/**
 * In-page scrolling. Plain "#details" links don't work with hash routing
 * (the router would treat "details" as a page), so scroll programmatically.
 */
function scrollToSection(id: string, reduceMotion: boolean | null) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  // Move focus for keyboard and screen-reader users without jumping again.
  el.setAttribute('tabindex', '-1')
  el.focus({ preventScroll: true })
}
