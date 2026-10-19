import { useState } from 'react'
import { hostLogin, hostLoginMessage } from '../../services/hostService'
import { toFriendlyMessage } from '../../utils/errors'
import { Button } from '../ui/Button'
import { cn } from '../ui/cn'

/** The 4-digit host code. On a dark screen (the presentation) it uses light text. */
export function HostCodeForm({ onSignedIn, onCancel, dark = false }: { onSignedIn: (token: string) => void; onCancel?: () => void; dark?: boolean }) {
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const submit = async (code = pin) => {
    if (code.length !== 4 || busy) return
    setBusy(true)
    setMessage(null)
    try {
      const r = await hostLogin(code)
      if (r.ok) return onSignedIn(r.token)
      setPin('')
      setMessage(hostLoginMessage(r))
    } catch (e) {
      setMessage(toFriendlyMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="text-center"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <label htmlFor="host-code" className="sr-only">
        Host code
      </label>
      <input
        id="host-code"
        className={cn(
          'input-base text-center font-mono text-3xl tracking-[0.6em]',
          dark && 'border-white/25 bg-white/10 text-white placeholder:text-white/30 focus:border-champagne',
        )}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        maxLength={4}
        placeholder="••••"
        value={pin}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 4)
          setPin(v)
          // Four digits typed: check straight away.
          if (v.length === 4) void submit(v)
        }}
        aria-describedby={message ? 'host-code-msg' : undefined}
      />
      {message && (
        <p id="host-code-msg" role="alert" className={cn('mt-3 text-sm', dark ? 'text-[#f2c6c2]' : 'text-rose')}>
          {message}
        </p>
      )}
      <div className="mt-5 flex justify-center gap-2">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={busy} className={dark ? 'text-white/80 hover:bg-white/10 hover:text-white' : undefined}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={pin.length !== 4} loading={busy} loadingText="Checking…">
          Enter host mode
        </Button>
      </div>
    </form>
  )
}
