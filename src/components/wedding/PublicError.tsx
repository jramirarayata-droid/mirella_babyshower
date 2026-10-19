import { Link } from 'react-router-dom'
import { FRIENDLY_ERRORS } from '../../utils/errors'
import { Button } from '../ui/Button'
import { Ornament } from '../ui/Ornament'
import { Monogram } from './Monogram'

export function PublicError({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <main className="flex min-h-[100svh] items-center justify-center px-6 py-16">
      <div className="max-w-md text-center">
        <p className="font-serif text-4xl italic text-champagne">
          <Monogram />
        </p>
        <Ornament className="mt-6" />
        <p className="mt-6 text-ink-soft">{message ?? FRIENDLY_ERRORS.generic}</p>
        <div className="mt-8 flex flex-col items-center gap-3">
          {onRetry && <Button onClick={onRetry}>Try again</Button>}
          <Link to="/" className="text-sm text-muted underline-offset-4 hover:underline">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  )
}
