import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { HostContext, type HostState } from '../../hooks/hostContext'
import { checkHost, saveHostToken, savedHostToken } from '../../services/hostService'
import { Modal } from '../ui/Modal'
import { HostCodeForm } from './HostCodeForm'

/** Knows whether this device is the host, and offers the host code dialog anywhere on the site. */
export function HostProvider({ children }: { children: ReactNode }) {
  const { isAdmin, loading: authLoading } = useAuth()
  const [token, setToken] = useState<string | null>(savedHostToken)
  const [tokenHost, setTokenHost] = useState(false)
  const [codeOn, setCodeOn] = useState(false)
  const [checking, setChecking] = useState(true)
  const [asking, setAsking] = useState(false)
  const [round, setRound] = useState(0)

  useEffect(() => {
    let alive = true
    setChecking(true)
    checkHost(token)
      .then((r) => {
        if (!alive) return
        setCodeOn(r.codeOn)
        setTokenHost(Boolean(token) && r.host)
        // An old or changed code: forget it on this device.
        if (token && !r.host && !isAdmin) {
          saveHostToken(null)
          setToken(null)
        }
      })
      .catch(() => undefined)
      .finally(() => alive && setChecking(false))
    return () => {
      alive = false
    }
  }, [token, isAdmin, round])

  const signIn = useCallback((t: string) => {
    saveHostToken(t)
    setTokenHost(true)
    setToken(t)
    setAsking(false)
  }, [])
  const leave = useCallback(() => {
    saveHostToken(null)
    setTokenHost(false)
    setToken(null)
  }, [])
  const recheck = useCallback(() => setRound((n) => n + 1), [])
  const askCode = useCallback(() => setAsking(true), [])

  const value = useMemo<HostState>(
    () => ({
      isHost: isAdmin || tokenHost,
      token: tokenHost ? token : null,
      codeOn,
      checking: checking || authLoading,
      signIn,
      leave,
      recheck,
      askCode,
    }),
    [isAdmin, tokenHost, token, codeOn, checking, authLoading, signIn, leave, recheck, askCode],
  )

  return (
    <HostContext.Provider value={value}>
      {children}
      <Modal open={asking} onClose={() => setAsking(false)} title="Host mode" description="Type the 4-digit host code from the parents-to-be." size="sm" tone="guest">
        <HostCodeForm
          onSignedIn={(t) => {
            signIn(t)
            // Show what the host can do now (the menu opens on its host section).
            if (!window.location.hash.startsWith('#/raffle')) window.setTimeout(() => window.dispatchEvent(new Event('wedding-host-on')), 250)
          }}
          onCancel={() => setAsking(false)}
        />
      </Modal>
    </HostContext.Provider>
  )
}
