import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Monogram } from './Monogram'
import { GuestMenu } from './GuestMenu'
import { MusicToggle } from './MusicPlayer'

export function PublicHeader() {
  return (
    <header className="mx-auto grid w-full max-w-5xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8">
      <Link to="/" className="inline-flex min-h-11 items-center gap-2 justify-self-start rounded px-1 text-sm text-muted transition hover:text-ink">
        <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.5} />
        <span className="hidden min-[400px]:inline">Wedding details</span>
        <span className="min-[400px]:hidden">Home</span>
      </Link>
      <Link to="/" aria-label="Home" className="font-serif text-2xl italic text-champagne">
        <Monogram />
      </Link>
      <div className="flex items-center gap-1.5 justify-self-end">
        <MusicToggle tone="light" />
        <GuestMenu />
      </div>
    </header>
  )
}
