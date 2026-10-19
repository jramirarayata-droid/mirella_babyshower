import { useCallback, useRef, useState } from 'react'
import { findIncludedGuest, findInvitationByCode, findInvitationByName } from '../services/invitationService'
import type { IncludedGuestLookup, InvitationLookup } from '../types/rsvp'
import { FRIENDLY_ERRORS, toFriendlyMessage } from '../utils/errors'

export type LookupStatus = 'idle' | 'searching' | 'found' | 'included' | 'not_found' | 'error'

/** Public invitation lookup state for the RSVP page. */
export function useInvitation() {
  const [status, setStatus] = useState<LookupStatus>('idle')
  const [invitation, setInvitation] = useState<InvitationLookup | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [included, setIncluded] = useState<IncludedGuestLookup | null>(null)
  const requestId = useRef(0)

  const run = useCallback(async (lookup: () => Promise<InvitationLookup | null>, includedName?: string) => {
    const id = ++requestId.current
    setStatus('searching')
    setError(null)
    setIncluded(null)
    try {
      const result = await lookup()
      if (id !== requestId.current) return
      const inc = !result && includedName ? await findIncludedGuest(includedName) : null
      if (id !== requestId.current) return
      if (result) {
        setInvitation(result)
        setStatus('found')
      } else if (inc) {
        setInvitation(null)
        setIncluded(inc)
        setStatus('included')
      } else {
        setInvitation(null)
        setStatus('not_found')
        setError(FRIENDLY_ERRORS.notFound)
      }
    } catch (e) {
      if (id !== requestId.current) return
      setInvitation(null)
      setStatus('error')
      setError(toFriendlyMessage(e))
    }
  }, [])

  const searchByName = useCallback((name: string) => run(() => findInvitationByName(name), name), [run])
  const searchByCode = useCallback((code: string) => run(() => findInvitationByCode(code)), [run])

  const reset = useCallback(() => {
    requestId.current++
    setStatus('idle')
    setInvitation(null)
    setIncluded(null)
    setError(null)
  }, [])

  return { status, invitation, included, error, searchByName, searchByCode, reset }
}
