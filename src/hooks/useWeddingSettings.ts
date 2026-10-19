import { useCallback, useEffect, useState } from 'react'
import { getWeddingSettings } from '../services/settingsService'
import type { WeddingSettings } from '../types/wedding'
import { toFriendlyMessage } from '../utils/errors'
import { saveSettingsCopy, settingsCopy } from '../utils/offlineSaved'

// Shared in-memory cache so Home → RSVP navigation doesn't refetch.
let cache: WeddingSettings | null = null
let inflight: Promise<WeddingSettings> | null = null

function load(force = false): Promise<WeddingSettings> {
  if (!force && cache) return Promise.resolve(cache)
  if (!force && inflight) return inflight
  inflight = getWeddingSettings()
    .then((s) => {
      cache = s
      saveSettingsCopy(s)
      return s
    })
    .catch((e: unknown) => {
      // No connection (e.g. at the venue): guest pages carry on with the copy saved on this phone.
      const copy = settingsCopy()
      if (copy) return copy
      throw e
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

/** The settings already loaded on this phone, if any (used by the error page, which must not fetch). */
export const peekWeddingSettings = (): WeddingSettings | null => cache

const listeners = new Set<(s: WeddingSettings) => void>()

/** Updates the shared cache and every mounted component using it (e.g. after an admin save). */
export function setCachedWeddingSettings(s: WeddingSettings) {
  cache = s
  listeners.forEach((l) => l(s))
}

export function useWeddingSettings() {
  const [settings, setSettings] = useState<WeddingSettings | null>(cache)
  const [loading, setLoading] = useState(!cache)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (force = true) => {
    setLoading(true)
    setError(null)
    try {
      setSettings(await load(force))
    } catch (e) {
      setError(toFriendlyMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    listeners.add(setSettings)
    return () => {
      listeners.delete(setSettings)
    }
  }, [])

  useEffect(() => {
    let active = true
    load()
      .then((s) => active && setSettings(s))
      .catch((e) => active && setError(toFriendlyMessage(e)))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  return { settings, loading, error, refresh }
}
