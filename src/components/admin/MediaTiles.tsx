import { thumbOf } from '../../utils/imageSizes'
import { useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Eye, EyeOff, Trash2 } from 'lucide-react'
import type { GalleryImage } from '../../types/wedding'
import { Spinner } from '../ui/Spinner'
import { cn } from '../ui/cn'

/* Shared by the main gallery and the extra photo sections in Admin → Photos & Video. */

export function PhotoTile({
  photo,
  index,
  busy,
  first,
  last,
  sample,
  onMove,
  onToggle,
  onCaption,
  onDelete,
}: {
  photo: GalleryImage
  index: number
  busy: boolean
  first: boolean
  last: boolean
  sample: boolean
  onMove: (dir: -1 | 1) => void
  onToggle: () => void
  onCaption: (caption: string) => void
  onDelete: () => void
}) {
  const [caption, setCaption] = useState(photo.caption)
  return (
    <li className={cn('overflow-hidden rounded-lg border bg-paper', photo.isVisible ? 'border-line' : 'border-dashed border-line')}>
      <div className="relative aspect-square bg-cream">
        <img src={thumbOf(photo, 480)} alt="" loading="lazy" decoding="async" className={cn('size-full object-cover', !photo.isVisible && 'opacity-40')} />
        <span className="absolute left-2 top-2 rounded-full bg-ink/70 px-2 py-0.5 text-xs text-ivory">{index + 1}</span>
        {sample && <span className="absolute right-2 top-2 rounded-full bg-paper/90 px-2 py-0.5 text-xs text-muted">Sample</span>}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-paper/60">
            <Spinner />
          </span>
        )}
      </div>
      <div className="p-2">
        <label className="sr-only" htmlFor={`gcap-${photo.id}`}>
          Caption for photo {index + 1}
        </label>
        <input
          id={`gcap-${photo.id}`}
          value={caption}
          maxLength={120}
          placeholder="Caption (optional)"
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => caption.trim() !== photo.caption && onCaption(caption)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-sm text-ink placeholder:text-muted/70 hover:border-line focus:border-champagne focus:outline-none"
        />
        <div className="mt-1 flex items-center justify-between">
          <Icon label="Move earlier" onClick={() => onMove(-1)} disabled={first || busy}>
            <ArrowLeft className="size-4" />
          </Icon>
          <Icon label="Move later" onClick={() => onMove(1)} disabled={last || busy}>
            <ArrowRight className="size-4" />
          </Icon>
          <Icon label={photo.isVisible ? 'Hide photo' : 'Show photo'} onClick={onToggle} disabled={busy}>
            {photo.isVisible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </Icon>
          <Icon label="Remove photo" onClick={onDelete} disabled={busy} danger>
            <Trash2 className="size-4" />
          </Icon>
        </div>
      </div>
    </li>
  )
}

export function Icon({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn('flex size-9 items-center justify-center rounded-md text-muted transition disabled:opacity-30', danger ? 'hover:bg-rose/10 hover:text-rose' : 'hover:bg-cream hover:text-ink')}
    >
      {children}
    </button>
  )
}

/** Tiny sketch of each gallery layout for the picker. */
export function LayoutThumb({ id }: { id: string }) {
  const b = 'bg-champagne/45'
  const box = 'flex h-12 w-full items-center justify-center gap-1 overflow-hidden rounded bg-cream p-1.5'
  switch (id) {
    case 'grid':
      return (
        <span aria-hidden="true" className={cn(box, 'grid grid-cols-3 items-stretch')}>
          <span className={cn(b, 'row-span-2 rounded-sm')} />
          <span className={cn(b, 'rounded-sm')} />
          <span className={cn(b, 'row-span-2 rounded-sm')} />
          <span className={cn(b, 'rounded-sm')} />
        </span>
      )
    case 'carousel':
      return (
        <span aria-hidden="true" className={box}>
          {[0, 1, 2].map((k) => <span key={k} className={cn(b, 'h-full w-1/3 shrink-0 rounded-sm', k === 2 && 'opacity-50')} />)}
        </span>
      )
    case 'polaroid':
      return (
        <span aria-hidden="true" className={box}>
          {[-8, 6, -4].map((r) => <span key={r} style={{ rotate: `${r}deg` }} className="h-8 w-7 rounded-[2px] bg-white p-0.5 pb-2 shadow-sm"><span className={cn(b, 'block size-full')} /></span>)}
        </span>
      )
    case 'filmstrip':
      return (
        <span aria-hidden="true" className={cn(box, 'flex-col bg-[#1b1917]')}>
          {[0, 1].map((r) => (
            <span key={r} className={cn('flex w-full gap-1', r === 1 && 'translate-x-2')}>
              {[0, 1, 2, 3].map((k) => <span key={k} className="h-3.5 flex-1 rounded-[1px] bg-white/45" />)}
            </span>
          ))}
        </span>
      )
    case 'mosaic':
      return (
        <span aria-hidden="true" className={cn(box, 'grid grid-cols-[2fr_1fr] items-stretch')}>
          <span className={cn(b, 'rounded-sm')} />
          <span className="grid grid-rows-2 gap-1">
            <span className={cn(b, 'rounded-sm opacity-60')} />
            <span className={cn(b, 'rounded-sm opacity-60')} />
          </span>
        </span>
      )
    case 'story':
      return (
        <span aria-hidden="true" className={box}>
          <span className="relative h-full w-6 rounded bg-[#2a2522]">
            <span className="absolute inset-x-0.5 top-0.5 flex gap-px">
              <span className="h-px flex-1 bg-white" />
              <span className="h-px flex-1 bg-white/40" />
            </span>
          </span>
        </span>
      )
    case 'deck':
      return (
        <span aria-hidden="true" className={cn(box, 'relative')}>
          <span style={{ rotate: '-6deg' }} className="absolute h-8 w-6 rounded-sm bg-white shadow-sm" />
          <span style={{ rotate: '5deg' }} className="absolute h-8 w-6 rounded-sm bg-white shadow-sm" />
          <span className="absolute h-8 w-6 rounded-sm bg-white p-0.5 shadow"><span className={cn(b, 'block size-full rounded-[1px]')} /></span>
        </span>
      )
    case 'coverflow':
      return (
        <span aria-hidden="true" className={cn(box, '[perspective:80px]')}>
          <span className={cn(b, 'h-6 w-4 rounded-sm opacity-60 [transform:rotateY(40deg)]')} />
          <span className={cn(b, 'h-8 w-6 rounded-sm')} />
          <span className={cn(b, 'h-6 w-4 rounded-sm opacity-60 [transform:rotateY(-40deg)]')} />
        </span>
      )
    case 'arches':
      return (
        <span aria-hidden="true" className={cn(box, 'items-end')}>
          <span className={cn(b, 'h-8 w-5 rounded-t-full')} />
          <span className={cn(b, 'h-7 w-5 rounded-[50%]')} />
          <span className={cn(b, 'h-8 w-5 rounded-t-full')} />
        </span>
      )
    case 'timeline':
      return (
        <span aria-hidden="true" className={cn(box, 'relative')}>
          <span className="absolute inset-y-1 left-1/2 w-px bg-champagne" />
          <span className="grid w-full grid-cols-2 gap-x-3 gap-y-1">
            <span className={cn(b, 'h-3.5 rounded-sm')} />
            <span />
            <span />
            <span className={cn(b, 'h-3.5 rounded-sm')} />
          </span>
        </span>
      )
    default:
      return null
  }
}
