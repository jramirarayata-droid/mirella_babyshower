import { useWeddingSettings } from './useWeddingSettings'
import type { SectionText } from '../types/wedding'

/**
 * A section's wording from Admin → Page Order → Edit text, with the usual
 * words as fallback: `t('eyebrow', 'Good to Know')`.
 */
export function useSectionText(key: string): (field: keyof SectionText, fallback: string) => string {
  const { settings } = useWeddingSettings()
  const own = settings?.sectionText?.[key]
  return (field, fallback) => own?.[field]?.trim() || fallback
}
