import { useEffect, useState } from 'react'
import { listProgram } from '../services/programService'
import type { ProgramItem } from '../types/wedding'
import { programCopy, saveProgramCopy } from '../utils/offlineSaved'

/**
 * Public program flow. Only loaded while the program is switched on; without a
 * connection (e.g. at the venue) the copy saved on this phone is used.
 * Failures are silent — the section simply doesn't show.
 */
export function useProgram(enabled: boolean) {
  const [items, setItems] = useState<ProgramItem[]>([])
  useEffect(() => {
    if (!enabled) return
    let active = true
    listProgram()
      .then((p) => {
        if (!active) return
        setItems(p)
        saveProgramCopy(p)
      })
      .catch(() => {
        const copy = programCopy()
        if (active && copy) setItems(copy)
      })
    return () => {
      active = false
    }
  }, [enabled])
  return enabled ? items : []
}
