import { useDisplayPrefs } from './useDisplayPrefs'
import { useWeddingSettings } from './useWeddingSettings'
import { isFinderOpen } from '../services/settingsService'

/** Is "Find My Seat" open right now (including "On the reveal date")? */
export function useFinderOpen(): boolean {
  const { settings } = useWeddingSettings()
  const display = useDisplayPrefs()
  if (!settings) return false
  if (settings.seatingConfig.finder.mode === 'reveal') return isFinderOpen(settings.seatingConfig, display?.revealAt)
  return isFinderOpen(settings.seatingConfig)
}
