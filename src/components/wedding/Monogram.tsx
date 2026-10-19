import type { CSSProperties } from 'react'
import { useWeddingSettings } from '../../hooks/useWeddingSettings'
import { useMonogram } from '../../hooks/useMonogram'
import { monogram } from '../../utils/formatting'

/** The couple's monogram image, tinted to the current text colour (so it follows the theme). */
export function MonogramImage({ url, aspect, height = '1.9em', className }: { url: string; aspect: number; height?: string; className?: string }) {
  const style: CSSProperties = {
    display: 'inline-block',
    verticalAlign: 'middle',
    height,
    width: `calc(${height} * ${aspect})`,
    backgroundColor: 'currentColor',
    WebkitMask: `url("${url}") center / contain no-repeat`,
    mask: `url("${url}") center / contain no-repeat`,
  }
  return <span aria-hidden="true" className={className} style={style} />
}

/** The couple's monogram: their uploaded one when switched on, otherwise the initials (a small ornament while loading). */
export function Monogram({ className, separator, height }: { className?: string; separator?: string; height?: string }) {
  const { settings } = useWeddingSettings()
  const custom = useMonogram()
  if (custom) return <MonogramImage url={custom.url} aspect={custom.aspect} height={height} className={className} />
  const text = settings ? monogram(settings.coupleNames, separator) : ''
  return (
    <span aria-hidden="true" className={className}>
      {text || '♡'}
    </span>
  )
}
