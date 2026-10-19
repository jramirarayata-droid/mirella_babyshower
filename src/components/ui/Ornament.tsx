import { useResolvedTheme } from '../../theme/themeContext'
import { cn } from './cn'
import { GreenerySprig } from '../wedding/looks/GreeneryArt'
import { GardenSprig } from '../wedding/looks/LookArt'

/**
 * The site's recurring divider. Each design style has its own:
 * classic — fine lines and a small diamond; maison — long hairlines and a dot;
 * deco — a gold fan with stepped lines; heritage — a woven diamond chain.
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

  // Save the Date: two fine lines and a pair of linked rings
  if (style === 'savedate') {
    const line = light ? 'bg-white/50' : 'bg-champagne/60'
    return (
      <div aria-hidden="true" className={cn('flex items-center justify-center gap-3', tone, className)}>
        <span className={cn('h-px w-14 sm:w-20', line)} />
        <svg width="34" height="18" viewBox="0 0 34 18" fill="none" stroke="currentColor" strokeWidth="1.1">
          <circle cx="12.5" cy="9" r="6.5" />
          <circle cx="21.5" cy="9" r="6.5" />
        </svg>
        <span className={cn('h-px w-14 sm:w-20', line)} />
      </div>
    )
  }

  // Sunlit Arch: a low sun on the horizon
  if (style === 'arch') {
    return (
      <div aria-hidden="true" className={cn('flex justify-center', tone, className)}>
        <svg width="150" height="24" viewBox="0 0 150 24" fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M8 20h134" opacity="0.6" />
          <path d="M61 20a14 14 0 0 1 28 0" />
          <path d="M75 2v5M62 8l3 3.5M88 8l-3 3.5M55 16h4M95 16h-4" opacity="0.75" />
        </svg>
      </div>
    )
  }

  // Love Story: a small heart between fine lines
  if (style === 'story') {
    const line = light ? 'bg-white/50' : 'bg-champagne/60'
    return (
      <div aria-hidden="true" className={cn('flex items-center justify-center gap-3', tone, className)}>
        <span className={cn('h-px w-12 sm:w-16', line)} />
        <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor" opacity="0.85">
          <path d="M8 13.2 6.9 12.2C2.9 8.6.3 6.2.3 3.8.3 1.8 1.9.3 3.8.3c1.1 0 2.2.5 2.9 1.4C7.4.8 8.5.3 9.6.3h.4c1.9 0 3.5 1.5 3.5 3.5 0 2.4-2.6 4.8-6.6 8.4Z" transform="translate(1 0)" />
        </svg>
        <span className={cn('h-px w-12 sm:w-16', line)} />
      </div>
    )
  }

  // Damask: a small fleuron between double lines
  if (style === 'damask') {
    return (
      <div aria-hidden="true" className={cn('flex justify-center', tone, className)}>
        <svg width="170" height="22" viewBox="0 0 170 22" fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M6 9h58M6 13h58M106 9h58M106 13h58" opacity="0.7" />
          <path d="M85 1c4 4 4 8 0 11-4-3-4-7 0-11ZM85 12c-5-3-10-2-13 0 3 3 8 3 13 0ZM85 12c5-3 10-2 13 0-3 3-8 3-13 0Z" fill="currentColor" stroke="none" />
          <path d="M85 12v8" />
        </svg>
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

  if (style === 'maison') {
    const line = light ? 'bg-white/45' : 'bg-champagne/55'
    return (
      <div aria-hidden="true" className={cn('flex items-center justify-center gap-4', className)}>
        <span className={cn('h-px w-20 sm:w-28', line)} />
        <span className={cn('size-1 rounded-full', light ? 'bg-white/80' : 'bg-champagne')} />
        <span className={cn('h-px w-20 sm:w-28', line)} />
      </div>
    )
  }

  if (style === 'deco') {
    return (
      <div aria-hidden="true" className={cn('flex justify-center', tone, className)}>
        <svg width="168" height="22" viewBox="0 0 168 22" fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M2 15h46l6-6h8M166 15h-46l-6-6h-8" />
          <path d="M10 19h40M158 19h-40" opacity="0.6" />
          {/* fan */}
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

  const line = light ? 'bg-white/50' : 'bg-champagne/60'
  return (
    <div aria-hidden="true" className={cn('flex items-center justify-center gap-3', className)}>
      <span className={cn('h-px w-12 sm:w-16', line)} />
      <span className={cn('size-1.5 rotate-45 border', light ? 'border-white/80' : 'border-champagne')} />
      <span className={cn('h-px w-12 sm:w-16', line)} />
    </div>
  )
}
