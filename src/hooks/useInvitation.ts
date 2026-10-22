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

  /** Open link: a guest who isn't here yet signs up under the name they typed. */
  const startNew = useCallback((name: string, maxAdditionalGuests: number) => {
    requestId.current++
    setIncluded(null)
    setError(null)
    setInvitation({
      invitationId: '',
      inviteeName: name.replace(/\s+/g, ' ').trim(),
      tableNumber: null,
      maxAdditionalGuests,
      hasExistingResponse: false,
      includedGuests: [],
      isNew: true,
    })
    setStatus('found')
  }, [])

  /** After an open sign-up is saved, the invitation exists: keep its id. */
  const settle = useCallback((invitationId: string) => {
    setInvitation((i) => (i ? { ...i, invitationId, isNew: false } : i))
  }, [])

  const reset = useCallback(() => {
    requestId.current++
    setStatus('idle')
    setInvitation(null)
    setIncluded(null)
    setError(null)
  }, [])

  return { status, invitation, included, error, searchByName, searchByCode, startNew, settle, reset }
}
