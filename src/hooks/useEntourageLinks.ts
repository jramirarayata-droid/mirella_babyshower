import { useCallback, useEffect, useState } from 'react'
import { listEntourageLinks, type EntourageLink } from '../services/entourageService'

/** Admin: entourage ↔ invitation links. */
export function useEntourageLinks() {
  const [links, setLinks] = useState<EntourageLink[]>([])
  const reload = useCallback(() => listEntourageLinks().then(setLinks), [])
  useEffect(() => {
    void reload()
  }, [reload])
  return { links, reload }
}
