import { useCallback, useEffect, useState } from 'react'

type Lock = { release: () => Promise<void> }
type WakeNavigator = Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Lock> } }

function enterFullscreen() {
  if (document.fullscreenElement) return
  void document.documentElement.requestFullscreen?.().catch(() => undefined)
}
function exitFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined)
}

/**
 * Present on the big screen (raffle wheel, Bingo): opening it also puts the
 * browser in true full screen (no tabs or address bar on the TV) and keeps the
 * screen awake until it closes. Esc leaves full screen first (browser rule);
 * the full-screen button brings it back; Close ends both.
 * Call `open` straight from the click — browsers only allow full screen after one.
 */
export function usePresentScreen() {
  const [present, setPresent] = useState(false)
  const [full, setFull] = useState(false)

  const open = useCallback(() => {
    enterFullscreen()
    setPresent(true)
  }, [])
  const close = useCallback(() => {
    exitFullscreen()
    setPresent(false)
  }, [])
  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) exitFullscreen()
    else enterFullscreen()
  }, [])

  useEffect(() => {
    const onChange = () => setFull(Boolean(document.fullscreenElement))
    onChange()
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // Keep the screen awake while presenting (re-acquired when the tab comes back).
  useEffect(() => {
    if (!present) return
    let lock: Lock | null = null
    let alive = true
    const nav = navigator as WakeNavigator
    const get = () =>
      nav.wakeLock
        ?.request('screen')
        .then((l) => {
          if (alive) lock = l
          else void l.release().catch(() => undefined)
        })
        .catch(() => undefined)
    void get()
    const onVis = () => document.visibilityState === 'visible' && void get()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVis)
      void lock?.release().catch(() => undefined)
    }
  }, [present])

  // Leaving the page while presenting: leave full screen too.
  useEffect(() => () => exitFullscreen(), [])

  return { present, open, close, full, toggleFull }
}
