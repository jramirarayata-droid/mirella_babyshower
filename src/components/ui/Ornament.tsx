import { useResolvedTheme } from '../../theme/themeContext'
import { cn } from './cn'
import { GreenerySprig } from '../wedding/looks/GreeneryArt'
import { GardenSprig } from '../wedding/looks/LookArt'
import { BALLOON_TONES, BalloonShape, CloudShape, MoonShape, RainbowArches, Twinkle } from '../wedding/looks/BabyArt'

/**
 * The site's recurring divider. Each design style has its own: Soft & Sweet —
 * a tiny twinkle; Twinkle Little Star — a moon and star; Hello Sunshine — a
 * rising sun; Heritage — a woven diamond chain; and one for each website look.
 */
export function Ornament({ className, light }: { className?: string; light?: boolean }) {
  const { look: style } = useResolvedTheme()
  const tone = light ? 'text-white/80' : 'text-champagne'

  if (style === 'garden') {
    return (
      <div aria-hidden="true" className={className}>
        <GardenSprig />
      </div>
    )
  }

  const line = light ? 'bg-white/50' : 'bg-champagne/60'

  // Over the Moon: a little cloud between fine lines
  if (style === 'clouds') {
    return (
      <div aria-hidden="true" className={cn('flex items-center justify-center gap-3', tone, className)}>
        <span className={cn('h-px w-12 sm:w-16', line)} />
        <CloudShape className="h-5 w-10" tone="currentColor" line="none" />
        <span className={cn('h-px w-12 sm:w-16', line)} />
      </div>
    )
  }

  // Boho Rainbow: a small rainbow on the horizon
  if (style === 'arch') {
    return (
      <div aria-hidden="true" className={cn('flex items-end justify-center gap-3', className)}>
        <span className={cn('mb-[3px] h-px w-12 sm:w-16', line)} />
        <RainbowArches className="h-5 w-10" />
        <span className={cn('mb-[3px] h-px w-12 sm:w-16', line)} />
      </div>
    )
  }

  // Oh Baby! Balloons: three little balloons
  if (style === 'balloons') {
    return (
      <div aria-hidden="true" className={cn('flex items-center justify-center gap-3', className)}>
        <span className={cn('h-px w-12 sm:w-16', line)} />
        <span className="flex items-end gap-0.5">
          {[1, 0, 2].map((t, i) => (
            <BalloonShape key={i} className={cn('w-3', i === 1 ? 'mb-1.5' : '')} color={BALLOON_TONES[t]!} />
          ))}
        </span>
        <span className={cn('h-px w-12 sm:w-16', line)} />
      </div>
    )
  }

  if (style === 'leaf') {
    return (
      <div aria-hidden="true" className={className}>
        <GreenerySprig light={light} />
      </div>
    )
  }

  // Twinkle Little Star: a crescent moon and a star between long hairlines
  if (style === 'maison') {
    return (
      <div aria-hidden="true" className={cn('flex items-center justify-center gap-3', tone, className)}>
        <span className={cn('h-px w-16 sm:w-24', line)} />
        <MoonShape className="size-4" />
        <Twinkle className="size-3 opacity-80" />
        <span className={cn('h-px w-16 sm:w-24', line)} />
      </div>
    )
  }

  // Hello Sunshine: a rising sun with rays and stepped lines
  if (style === 'deco') {
    return (
      <div aria-hidden="true" className={cn('flex justify-center', tone, className)}>
        <svg width="168" height="22" viewBox="0 0 168 22" fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M2 15h46l6-6h8M166 15h-46l-6-6h-8" />
          <path d="M10 19h40M158 19h-40" opacity="0.6" />
          {/* sun */}
          <path d="M70 19a14 14 0 0 1 28 0Z" />
          <path d="M84 19 72.5 10.5M84 19l-6-12.2M84 19V5.2M84 19l6-12.2M84 19l11.5-8.5" opacity="0.85" />
          <path d="M76 19a8 8 0 0 1 16 0" opacity="0.7" />
          <circle cx="84" cy="2.5" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      </div>
    )
  }

  if (style === 'heritage') {
    // A short woven chain: diamonds alternating filled and outlined, like banig and inabel borders.
    const d = (x: number, filled: boolean) => (
      <path key={x} d={`M${x} 3l6 6-6 6-6-6Z`} fill={filled ? 'currentColor' : 'none'} opacity={filled ? 0.85 : 1} />
    )
    return (
      <div aria-hidden="true" className={cn('flex justify-center', tone, className)}>
        <svg width="150" height="18" viewBox="0 0 150 18" fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M2 9h40M108 9h40" opacity="0.6" />
          {[51, 63, 75, 87, 99].map((x, i) => d(x, i % 2 === 0))}
        </svg>
      </div>
    )
  }

  // Soft & Sweet: fine lines and a tiny twinkle
  return (
    <div aria-hidden="true" className={cn('flex items-center justify-center gap-3', tone, className)}>
      <span className={cn('h-px w-12 sm:w-16', line)} />
      <Twinkle className="size-3" />
      <span className={cn('h-px w-12 sm:w-16', line)} />
    </div>
  )
}
