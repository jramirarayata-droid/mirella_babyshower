import type { OutfitImage } from '../types/wedding'

/** His and her looks shown together under one label. */
export interface OutfitPair {
  /** Position in Outfit Gallery (0 = first his with first hers). */
  index: number
  him: OutfitImage | null
  her: OutfitImage | null
  /** The pair's single label: his, or hers when he has none. */
  label: string
  /** The photos that exist, his first. */
  images: OutfitImage[]
}

/** Pairs looks by their order in Outfit Gallery: 1st for him with 1st for her, and so on. */
export function outfitPairs(male: OutfitImage[], female: OutfitImage[]): OutfitPair[] {
  const n = Math.max(male.length, female.length)
  return Array.from({ length: n }, (_, index) => {
    const him = male[index] ?? null
    const her = female[index] ?? null
    return {
      index,
      him,
      her,
      label: (him?.label || her?.label || '').trim(),
      images: [him, her].filter((x): x is OutfitImage => Boolean(x)),
    }
  })
}
