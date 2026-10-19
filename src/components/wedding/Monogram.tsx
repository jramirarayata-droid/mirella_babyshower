import type { CSSProperties } from 'react'
import { useWeddingSettings } from '../../hooks/useWeddingSettings'
import { useMonogram } from '../../hooks/useMonogram'
import { babyMonogram } from '../../utils/formatting'

/** The uploaded monogram image, tinted to the current text colour (so it follows the theme). */
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

/** The site's monogram: the uploaded one when switched on, otherwise the baby's initials (a small heart while loading). */
export function Monogram({ className, height }: { className?: string; height?: string }) {
  const { settings } = useWeddingSettings()
  const custom = useMonogram()
  if (custom) return <MonogramImage url={custom.url} aspect={custom.aspect} height={height} className={className} />
  const text = settings ? babyMonogram(settings.babyName) : ''
  return (
    <span aria-hidden="true" className={className}>
      {text || '♡'}
    </span>
  )
}
