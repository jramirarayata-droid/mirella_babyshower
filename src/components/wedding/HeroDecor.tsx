import { useResolvedTheme } from '../../theme/themeContext'
import { cn } from '../ui/cn'
import { GreeneryCorner } from './looks/GreeneryArt'

/**
 * Decoration layered over the hero for each design style (purely visual).
 * `onPhoto` = drawn over the couple's photo (light lines) instead of paper.
 */
export function HeroDecor({ onPhoto, belowNav = false }: { onPhoto: boolean; belowNav?: boolean }) {
  const { look: style } = useResolvedTheme()
  const color = onPhoto ? 'text-white/55' : 'text-champagne/80'

  // Where there is a menu above (photo heroes, arched-frame layout), the frame starts just below it;
  // over a photo the menu sits on a faint tinted band (styles.css).
  const frame = belowNav
    ? 'pointer-events-none absolute inset-x-3 bottom-3 top-[5.75rem] z-10 sm:inset-x-6 sm:bottom-6 sm:top-[6.25rem]'
    : 'pointer-events-none absolute inset-3 z-10 sm:inset-6'

  if (style === 'maison') {
    return (
      <div aria-hidden="true" className={cn(frame, color)}>
        <div className="absolute inset-0 border border-current opacity-70" />
        <p className="absolute left-0 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 -rotate-90 bg-transparent px-3 text-[0.6rem] uppercase tracking-[0.6em] lg:block">
          The wedding of
        </p>
        <p className="absolute right-0 top-1/2 hidden -translate-y-1/2 translate-x-1/2 rotate-90 px-3 text-[0.6rem] uppercase tracking-[0.6em] lg:block">
          Save the date
        </p>
      </div>
    )
  }

  if (style === 'deco') {
    const corner = (cls: string) => (
      <svg className={cn('absolute size-10 sm:size-14', cls)} viewBox="0 0 96 96" fill="none" stroke="currentColor" strokeWidth="1">
        <path d="M2 94V2h92" />
        <path d="M10 94V10h84" opacity="0.7" />
        <path d="M18 60V18h42" opacity="0.5" />
        <path d="M10 10l18 18M2 2l8 8" />
        <path d="M28 28a20 20 0 0 1 20-20M28 28a20 20 0 0 0-20 20" opacity="0.6" />
      </svg>
    )
    return (
      <div aria-hidden="true" className={cn(frame, color)}>
        {corner('left-0 top-0')}
        {corner('right-0 top-0 -scale-x-100')}
        {corner('bottom-0 left-0 -scale-y-100')}
        {corner('bottom-0 right-0 -scale-100')}
      </div>
    )
  }

  if (style === 'leaf') {
    return (
      <div aria-hidden="true" className={frame}>
        {/* a fine gold frame, with painted greenery spilling over two corners */}
        <div className={cn('absolute inset-2 border sm:inset-4', onPhoto ? 'border-white/45' : 'border-champagne/55')} />
        <GreeneryCorner at="tl" eager className="-left-3 -top-3 w-44 sm:-left-5 sm:-top-5 sm:w-64 lg:w-80" />
        <GreeneryCorner at="br" eager className="-bottom-3 -right-3 w-44 sm:-bottom-5 sm:-right-5 sm:w-64 lg:w-80" />
      </div>
    )
  }

  if (style === 'heritage') {
    return (
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
        <div className={cn('banig-band h-3 sm:h-4', onPhoto && 'opacity-80')} />
      </div>
    )
  }

  return null
}
