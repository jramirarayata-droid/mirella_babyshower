import { createContext, useContext } from 'react'

export interface MusicControls {
  /** Music is set up for this page. */
  here: boolean
  playing: boolean
  /** The guest turned it off (remembered). */
  off: boolean
  toggle: () => void
  /** A top-bar button is showing (so no floating one is needed). Returns an unregister function. */
  register: () => () => void
}

export const MusicContext = createContext<MusicControls | null>(null)
export const useMusic = () => useContext(MusicContext)
