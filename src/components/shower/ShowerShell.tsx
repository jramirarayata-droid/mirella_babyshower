import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { UserRound } from 'lucide-react'
import { useWeddingSettings } from '../../hooks/useWeddingSettings'
import { PublicHeader } from '../wedding/PublicHeader'
import { Footer } from '../wedding/Footer'
import { CoupleNames } from '../wedding/CoupleNames'
import { Ornament } from '../ui/Ornament'
import { Button } from '../ui/Button'
import { TextField } from '../ui/FormField'
import { knownGuest } from '../../utils/guestIdentity'
import { startShowerGuest, type ShowerGuest } from '../../services/showerService'
import { toFriendlyMessage } from '../../utils/errors'

/** The frame of a baby shower guest page: header, the baby's name, a title, the page, the footer. */
export function ShowerShell({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  const { settings } = useWeddingSettings()
  return (
    <div className="flex min-h-[100svh] flex-col">
      <PublicHeader />
      <main className="flex flex-1 flex-col items-center px-4 pb-20 pt-10 sm:px-8">
        {settings && (
          <p className="text-center font-serif text-2xl font-light text-ink-soft">
            <CoupleNames names={settings.babyName} />
          </p>
        )}
        <h1 className="mt-4 text-center text-[2.5rem] leading-tight text-ink sm:text-5xl">{title}</h1>
        {intro && <div className="mx-auto mt-4 max-w-lg text-center leading-relaxed text-ink-soft">{intro}</div>}
        <Ornament className="mt-6" />
        <div className="mt-8 w-full max-w-3xl">{children}</div>
      </main>
      {settings && <Footer coupleNames={settings.babyName} hostNames={settings.coupleNames} weddingDate={settings.weddingDate} closingMessage={settings.closingMessage} />}
    </div>
  )
}

/** Shown while a feature is hidden on the website. */
export function NotYet({ what }: { what: string }) {
  return (
    <div className="mx-auto max-w-md text-center">
      <p className="leading-relaxed text-ink-soft">{what} opens closer to the shower. Please check back soon.</p>
      <Link to="/" className="mt-6 inline-block text-sm text-gold underline-offset-4 hover:underline">
        Back to the baby shower website
      </Link>
    </div>
  )
}

/**
 * "Who are you?" — the guest types their name as on the invitation once, and
 * every shower activity (wishlist, predictions, name ideas, photos) knows them.
 */
export function GuestGate({ why, onReady }: { why: string; onReady: (g: ShowerGuest) => void }) {
  const [name, setName] = useState(() => knownGuest()?.name ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (name.trim().length < 3) {
      setError('Please type your full name, as on your invitation.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const r = await startShowerGuest(name)
      if (r.ok) onReady(r.guest)
      else setError('We couldn’t find that name. Please type it exactly as on your invitation (first and last name).')
    } catch (err) {
      setError(toFriendlyMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="fine-frame mx-auto max-w-md rounded-2xl border border-line bg-paper p-6 text-left shadow-soft sm:p-7" noValidate>
      <p className="flex items-center gap-2 font-serif text-xl text-ink">
        <UserRound aria-hidden="true" className="size-5 text-gold" strokeWidth={1.6} /> Who are you?
      </p>
      <p className="mt-1 text-sm text-muted">{why}</p>
      <TextField className="mt-4" label="Your full name" value={name} onChange={setName} error={error ?? undefined} autoComplete="name" maxLength={150} placeholder="As on your invitation" />
      <Button type="submit" className="mt-4" fullWidth loading={busy} loadingText="Checking…">
        Continue
      </Button>
    </form>
  )
}

/** The guest's name with a small "Not you?" switch. */
export function SignedInAs({ name, onSwitch }: { name: string; onSwitch: () => void }) {
  return (
    <p className="text-center text-sm text-muted">
      Hi, <span className="font-medium text-ink">{name.split(' ')[0]}</span>!{' '}
      <button type="button" onClick={onSwitch} className="text-gold underline-offset-4 hover:underline">
        Not you?
      </button>
    </p>
  )
}
