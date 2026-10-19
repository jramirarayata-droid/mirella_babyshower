import { useEffect, useState } from 'react'

// Choices that should survive switching between printables (or leaving the page and
// coming back) while the admin stays signed in — e.g. which guests are ticked.
const kept = new Map<string, unknown>()

/** Like useState, but the value is kept for this browser tab under `key`. `initial` wins when given (e.g. a hand-off from Invitations). */
export function useKept<T>(key: string, fallback: T, initial?: T): [T, (v: T | ((cur: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => (initial !== undefined ? initial : kept.has(key) ? (kept.get(key) as T) : fallback))
  useEffect(() => {
    kept.set(key, value)
  }, [key, value])
  return [value, setValue]
}
