import { createContext, useContext } from 'react'

export interface HostState {
  /** This device is in host mode (host code, host link, or a signed-in admin). */
  isHost: boolean
  /** Signed in with the host code or link (an admin has no token, and can't "leave"). */
  token: string | null
  /** A host code is set, so "Host mode" can be offered. */
  codeOn: boolean
  /** Still checking. */
  checking: boolean
  signIn: (token: string) => void
  leave: () => void
  /** Ask the server again (e.g. after the code was changed). */
  recheck: () => void
  /** Opens the host code dialog (from anywhere). */
  askCode: () => void
}

export const HostContext = createContext<HostState | null>(null)

export function useHost(): HostState {
  const ctx = useContext(HostContext)
  if (!ctx) throw new Error('useHost must be used inside <HostProvider>')
  return ctx
}
