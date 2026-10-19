import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { setSpaceFolder, spaceSlug } from '../lib/space'
import type { Feature } from '../lib/plans'
import { loadSpaceHere, type SpaceInfo } from '../services/spaceService'

interface SpaceState {
  /** The shower's web address on this page (null at the site's root). */
  slug: string | null
  info: SpaceInfo | null
  loading: boolean
  /** Does this shower's plan include the feature? (Before the database update: always yes.) */
  has: (f: Feature) => boolean
  reload: () => Promise<void>
}

const SpaceContext = createContext<SpaceState | null>(null)

export function SpaceProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<SpaceInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const next = await loadSpaceHere()
    setSpaceFolder(next.id, next.isDefault || next.legacy)
    setInfo(next)
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const has = useCallback(
    (f: Feature) => {
      if (!info || info.legacy || !info.plan) return true
      return info.plan.features.includes(f)
    },
    [info],
  )

  const value = useMemo<SpaceState>(() => ({ slug: spaceSlug, info, loading, has, reload }), [info, loading, has, reload])
  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>
}

export function useSpace(): SpaceState {
  const ctx = useContext(SpaceContext)
  if (!ctx) throw new Error('useSpace must be used inside <SpaceProvider>')
  return ctx
}

