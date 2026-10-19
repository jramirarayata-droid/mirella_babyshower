import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Lock, MessageCircleHeart, Sparkles } from 'lucide-react'
import { useSpace } from '../../hooks/useSpace'
import { FEATURE_LABELS, type Feature } from '../../lib/plans'
import { Ornament } from '../ui/Ornament'
import { PageLoader } from '../ui/Spinner'

/** Where people message the site owner (set VITE_CONTACT_URL, e.g. https://m.me/yourpage). */
export const CONTACT_URL = (import.meta.env.VITE_CONTACT_URL as string | undefined)?.trim() || ''

export function ContactLink({ children, className }: { children: ReactNode; className?: string }) {
  if (!CONTACT_URL) return <span className={className}>{children}</span>
  return (
    <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  )
}

/** Admin: a page from a bigger plan. */
export function UpgradeCard({ feature }: { feature: Feature }) {
  const { info } = useSpace()
  return (
    <div className="mx-auto max-w-xl rounded-xl border border-line bg-paper p-8 text-center shadow-card">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full border border-champagne/60 text-champagne">
        <Lock aria-hidden="true" className="size-6" strokeWidth={1.5} />
      </span>
      <h1 className="mt-5 font-serif text-3xl text-ink">{FEATURE_LABELS[feature]}</h1>
      <p className="mt-3 text-ink-soft">
        This is part of a bigger plan{info?.plan ? <> — you’re on <strong>{info.plan.name}</strong></> : null}. Upgrade any time and it switches on
        straight away, with everything you’ve set up kept as it is.
      </p>
      <ContactLink className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-md bg-ink px-5 text-[0.95rem] font-medium text-ivory shadow-soft transition hover:bg-ink-soft">
        <MessageCircleHeart aria-hidden="true" className="size-4" />
        Message us to upgrade
      </ContactLink>
      <p className="mt-4">
        <Link to="/admin" className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
          Back to the dashboard
        </Link>
      </p>
    </div>
  )
}

/** Guests: a page this shower doesn't have. */
export function GuestUnavailable() {
  return (
    <main className="flex min-h-[70svh] items-center justify-center px-5 py-16 text-center">
      <div className="max-w-md">
        <Sparkles aria-hidden="true" className="mx-auto size-8 text-champagne" strokeWidth={1.4} />
        <h1 className="mt-5 font-serif text-4xl text-ink">Not part of this shower</h1>
        <Ornament className="mt-6" />
        <p className="mt-6 text-ink-soft">This page isn’t used for this baby shower — but there’s plenty more to see.</p>
        <Link to="/" className="mt-8 inline-flex min-h-11 items-center rounded-md border border-champagne/70 px-5 text-ink transition hover:bg-champagne-light/40">
          Back to the home page
        </Link>
      </div>
    </main>
  )
}

/** Shows the page only when the shower's plan includes it. */
export function FeatureGate({ feature, admin, children }: { feature: Feature; admin?: boolean; children: ReactNode }) {
  const { has, loading } = useSpace()
  if (loading) return <PageLoader />
  if (has(feature)) return <>{children}</>
  return admin ? <UpgradeCard feature={feature} /> : <GuestUnavailable />
}

/** A shower's own pages: a friendly message when the address is unknown or the shower is switched off. */
export function SpaceGate({ children }: { children: ReactNode }) {
  const { info, loading, slug } = useSpace()
  const onAdmin = useLocation().pathname.startsWith('/admin')
  if (!slug) return <>{children}</>
  if (loading) return <PageLoader />
  if (info && !info.legacy && !info.exists) {
    return (
      <Resting
        title="We couldn’t find this baby shower"
        text="Please check the link you were sent — the web address may have a small typo."
      />
    )
  }
  if (info && !info.legacy && !info.open && !onAdmin) {
    return <Resting title="This page is resting for now" text="The baby shower website isn’t open at the moment. Please check back soon." />
  }
  return <>{children}</>
}

function Resting({ title, text }: { title: string; text: string }) {
  return (
    <main className="flex min-h-[100svh] items-center justify-center px-5 py-16 text-center">
      <div className="max-w-md">
        <Sparkles aria-hidden="true" className="mx-auto size-8 text-champagne" strokeWidth={1.4} />
        <h1 className="mt-5 font-serif text-4xl text-ink">{title}</h1>
        <Ornament className="mt-6" />
        <p className="mt-6 text-ink-soft">{text}</p>
      </div>
    </main>
  )
}
