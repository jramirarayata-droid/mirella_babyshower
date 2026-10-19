import { createContext, useContext, useEffect, useId } from 'react'

export interface UnsavedApi {
  /** label = what has unsaved changes (e.g. "Website Settings"); null = nothing unsaved any more. */
  set: (id: string, label: string | null) => void
}
export const UnsavedContext = createContext<UnsavedApi>({ set: () => undefined })

/**
 * Marks part of a page as having unsaved changes. While `dirty`, the admin menu asks
 * before leaving the page, and closing or reloading the tab asks too.
 */
export function useUnsavedChanges(dirty: boolean, label: string) {
  const id = useId()
  const { set } = useContext(UnsavedContext)
  useEffect(() => {
    set(id, dirty ? label : null)
    return () => set(id, null)
  }, [id, dirty, label, set])
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])
}
