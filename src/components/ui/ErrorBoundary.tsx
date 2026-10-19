import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { peekWeddingSettings } from '../../hooks/useWeddingSettings'
import { formatWeddingDate } from '../../utils/formatting'

/**
 * Catches an unexpected error in a page so guests never see a blank white
 * screen. The fallback is deliberately plain (no data fetching, no fancy
 * components) so it can't fail itself. It resets when the page changes.
 */
interface Props {
  children: ReactNode
  variant: 'guest' | 'admin'
  /** Changing this (the page address) clears the error. */
  resetKey: string
}
interface State {
  error: Error | null
}

class Boundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[page error]', error, info.componentStack)
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }

  private retry = () => this.setState({ error: null })

  render() {
    if (!this.state.error) return this.props.children
    return this.props.variant === 'admin' ? <AdminFallback onRetry={this.retry} /> : <GuestFallback onRetry={this.retry} />
  }
}

/** Wraps pages; resets automatically when the guest moves to another page. */
export function PageErrorBoundary({ children, variant }: { children: ReactNode; variant: 'guest' | 'admin' }) {
  const { pathname } = useLocation()
  return (
    <Boundary variant={variant} resetKey={pathname}>
      {children}
    </Boundary>
  )
}

const btn = 'inline-flex min-h-11 items-center justify-center rounded-full px-6 text-sm font-medium uppercase tracking-[0.18em] transition'

function GuestFallback({ onRetry }: { onRetry: () => void }) {
  const s = peekWeddingSettings()
  const venues = s
    ? [
        { label: 'Venue', name: s.churchName, time: s.ceremonyTime, map: s.churchMapUrl },
      ].filter((v) => v.name)
    : []
  return (
    <main role="alert" data-page-error className="flex min-h-[100svh] items-center justify-center bg-ivory px-6 py-16 text-ink">
      <div className="w-full max-w-md text-center">
        {s?.babyName && <p className="font-serif text-4xl italic text-ink">{s.babyName}</p>}
        {s?.weddingDate && <p className="mt-2 text-xs uppercase tracking-[0.3em] text-muted">{formatWeddingDate(s.weddingDate)}</p>}
        <p className="mt-8 font-serif text-2xl text-ink">Something went wrong on this page.</p>
        <p className="mt-2 text-sm text-ink-soft">It’s not you — please try again. Your details are safe.</p>
        <div className="mt-7 flex flex-col items-center gap-3">
          <button type="button" onClick={onRetry} className={`${btn} bg-ink text-ivory hover:bg-ink-soft`}>
            Try again
          </button>
          <a href="#/" onClick={onRetry} className={`${btn} border border-ink/30 text-ink hover:bg-ink/5`}>
            Go to the home page
          </a>
          <a href="#/seat" onClick={onRetry} className="mt-1 text-sm text-ink-soft underline underline-offset-4">
            Find my seat
          </a>
        </div>
        {venues.length > 0 && (
          <ul className="mt-10 space-y-3 border-t border-line pt-6 text-sm">
            {venues.map((v) => (
              <li key={v.label}>
                <span className="block text-[0.7rem] uppercase tracking-[0.3em] text-muted">{v.label}</span>
                <span className="block font-serif text-lg text-ink">{v.name}</span>
                {v.time && <span className="block text-ink-soft">{v.time}</span>}
                {v.map && (
                  <a href={v.map} target="_blank" rel="noreferrer" className="text-ink-soft underline underline-offset-4">
                    Open map
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}

function AdminFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" data-page-error className="mx-auto max-w-lg rounded-xl border border-line bg-paper p-8 text-center shadow-soft">
      <p className="font-serif text-2xl text-ink">This page ran into a problem.</p>
      <p className="mt-2 text-sm text-ink-soft">Nothing you saved has been lost. Try again, or pick another page from the menu.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={onRetry} className={`${btn} bg-ink text-ivory hover:bg-ink-soft`}>
          Try again
        </button>
        <button type="button" onClick={() => window.location.reload()} className={`${btn} border border-ink/30 text-ink hover:bg-ink/5`}>
          Reload
        </button>
      </div>
    </div>
  )
}

/**
 * Test-build only: `?crashtest` on any page makes it throw, so the browser test
 * can check the friendly page. It does nothing on the real site.
 */
export function CrashTest({ flag = 'crashtest' }: { flag?: string }) {
  const { search } = useLocation()
  // Keeps failing until the test switches it off (window.__crashArmed = false), like a glitch that then clears.
  const armed = (window as { __crashArmed?: boolean }).__crashArmed !== false
  if (import.meta.env.VITE_SUPABASE_URL?.includes('mock.supabase.test') && new URLSearchParams(search).has(flag) && armed) {
    throw new Error('crash test')
  }
  return null
}
