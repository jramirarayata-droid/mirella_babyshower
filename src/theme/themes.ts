/**
 * Look & Feel: templates, font pairings and colour derivation.
 *
 * Every template is defined by three base colours (background, text, accent),
 * a heading/body font pair and a hero layout. All other shades used by the
 * site are derived from those three and adjusted until they pass WCAG
 * contrast, so any combination the couple picks stays readable.
 */

export type HeroLayout = 'center' | 'left' | 'split' | 'framed'

/**
 * A design style: its own section designs, ornaments, textures and type rules.
 * These four are also the printable designs (Printables, envelope, posters).
 */
export type StyleId = 'classic' | 'maison' | 'deco' | 'heritage'

/**
 * Website-only design looks. Each builds on a base print style (`print`) so
 * printables, the invitation envelope and the admin stay exactly as they are.
 */
export type LookOnlyId = 'leaf' | 'garden' | 'savedate' | 'arch' | 'story' | 'damask'
export type LookId = StyleId | LookOnlyId

export interface StyleInfo {
  id: LookId
  name: string
  description: string
  /** Dark backgrounds are designed for in this style. */
  allowsDark: boolean
  /** The printable design this look uses (website-only looks). */
  print?: StyleId
  /** Script font for the couple's names (website-only looks). */
  script?: FontOption
}

export const STYLES: StyleInfo[] = [
  { id: 'classic', name: 'Classic', description: 'Soft and timeless — fine lines, airy paper and a small diamond motif.', allowsDark: false },
  { id: 'maison', name: 'Maison Noir', description: 'Dark editorial luxury — numbered sections, gold rules, fashion-magazine type.', allowsDark: true },
  { id: 'deco', name: 'Gilded Deco', description: 'Art Deco glamour — gold fans, sunbursts, stepped frames, 1920s ballroom.', allowsDark: true },
  { id: 'heritage', name: 'Heritage', description: 'Filipino luxury — capiz-shell shimmer and woven banig borders.', allowsDark: false },
]

/** Website-only looks, drawn from favourite wedding-site designs and redrawn in our own way. */
export const LOOKS: StyleInfo[] = [
  {
    id: 'leaf',
    name: 'Eucalyptus & Gold',
    description: 'Painted watercolour greenery spilling over fine gold frames, with a graceful script for your names.',
    allowsDark: false,
    print: 'classic',
    script: { id: 'pinyon', family: 'Pinyon Script', spec: '', fallback: 'cursive' },
  },
  {
    id: 'garden',
    name: 'Watercolour Garden',
    description: 'Soft painted garden roses and greenery under your photo, flowing script names.',
    allowsDark: false,
    print: 'classic',
    script: { id: 'great-vibes', family: 'Great Vibes', spec: '', fallback: 'cursive' },
  },
  {
    id: 'savedate',
    name: 'Save the Date',
    description: 'Your photo full-screen with “Save the Date” in script and a round countdown.',
    allowsDark: false,
    print: 'classic',
    script: { id: 'alex-brush', family: 'Alex Brush', spec: '', fallback: 'cursive' },
  },
  {
    id: 'arch',
    name: 'Sunlit Arch',
    description: 'Warm and relaxed — a soft sun-circle over your photo, arched cards, airy type.',
    allowsDark: false,
    print: 'classic',
  },
  {
    id: 'story',
    name: 'Love Story',
    description: 'Romantic — a round photo with scattered rose petals, rounded blush cards.',
    allowsDark: false,
    print: 'classic',
    script: { id: 'parisienne', family: 'Parisienne', spec: '', fallback: 'cursive' },
  },
  {
    id: 'damask',
    name: 'Damask',
    description: 'Rich and formal — a fine gold damask pattern with an ivory name medallion.',
    allowsDark: false,
    print: 'classic',
    script: { id: 'pinyon', family: 'Pinyon Script', spec: '', fallback: 'cursive' },
  },
]

/** Every style shown in Look & Feel: the four print-ready styles, then the website-only looks. */
export const ALL_STYLES: StyleInfo[] = [...STYLES, ...LOOKS]

export const findStyle = (id: string | undefined) => ALL_STYLES.find((s) => s.id === id) ?? STYLES[0]
/** The printable design behind any look (website-only looks fall back to their base). */
export const printStyleOf = (id: string | undefined): StyleId => {
  const s = findStyle(id)
  return s.print ?? (s.id as StyleId)
}

export interface ThemeSettings {
  template: string
  headingFont?: string
  bodyFont?: string
  background?: string
  text?: string
  accent?: string
  heroLayout?: HeroLayout
}

export interface FontOption {
  id: string
  family: string
  /** Google Fonts css2 axis spec ('' = regular only). Must match the family's real axes. */
  spec: string
  fallback: string
}

export const HEADING_FONTS: FontOption[] = [
  { id: 'cormorant', family: 'Cormorant Garamond', spec: 'ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500', fallback: 'Georgia, serif' },
  { id: 'playfair', family: 'Playfair Display', spec: 'ital,wght@0,400;0,500;0,600;1,400;1,500', fallback: 'Georgia, serif' },
  { id: 'eb-garamond', family: 'EB Garamond', spec: 'ital,wght@0,400;0,500;0,600;1,400;1,500', fallback: 'Georgia, serif' },
  { id: 'lora', family: 'Lora', spec: 'ital,wght@0,400;0,500;0,600;1,400;1,500', fallback: 'Georgia, serif' },
  { id: 'libre-baskerville', family: 'Libre Baskerville', spec: 'ital,wght@0,400;0,700;1,400', fallback: 'Georgia, serif' },
  { id: 'bodoni', family: 'Bodoni Moda', spec: 'ital,wght@0,400;0,500;0,600;1,400;1,500', fallback: 'Didot, Georgia, serif' },
  { id: 'dm-serif', family: 'DM Serif Display', spec: 'ital@0;1', fallback: 'Georgia, serif' },
  { id: 'marcellus', family: 'Marcellus', spec: '', fallback: 'Georgia, serif' },
  { id: 'cinzel', family: 'Cinzel', spec: 'wght@400;500;600', fallback: 'Georgia, serif' },
  { id: 'italiana', family: 'Italiana', spec: '', fallback: 'Georgia, serif' },
  { id: 'poiret', family: 'Poiret One', spec: '', fallback: 'Futura, Georgia, serif' },
  { id: 'forum', family: 'Forum', spec: '', fallback: 'Georgia, serif' },
  { id: 'prata', family: 'Prata', spec: '', fallback: 'Georgia, serif' },
  { id: 'gilda', family: 'Gilda Display', spec: '', fallback: 'Georgia, serif' },
  { id: 'bellefair', family: 'Bellefair', spec: '', fallback: 'Georgia, serif' },
]

export const BODY_FONTS: FontOption[] = [
  { id: 'jost', family: 'Jost', spec: 'wght@300;400;500;600', fallback: 'Helvetica Neue, Arial, sans-serif' },
  { id: 'montserrat', family: 'Montserrat', spec: 'wght@300;400;500;600', fallback: 'Helvetica Neue, Arial, sans-serif' },
  { id: 'lato', family: 'Lato', spec: 'wght@300;400;700', fallback: 'Helvetica Neue, Arial, sans-serif' },
  { id: 'inter', family: 'Inter', spec: 'wght@300;400;500;600', fallback: 'Helvetica Neue, Arial, sans-serif' },
  { id: 'dm-sans', family: 'DM Sans', spec: 'wght@300;400;500;600', fallback: 'Helvetica Neue, Arial, sans-serif' },
  { id: 'josefin', family: 'Josefin Sans', spec: 'wght@300;400;500;600', fallback: 'Helvetica Neue, Arial, sans-serif' },
  { id: 'raleway', family: 'Raleway', spec: 'wght@300;400;500;600', fallback: 'Helvetica Neue, Arial, sans-serif' },
  { id: 'nunito-sans', family: 'Nunito Sans', spec: 'wght@300;400;600', fallback: 'Helvetica Neue, Arial, sans-serif' },
  { id: 'karla', family: 'Karla', spec: 'wght@300;400;500;600', fallback: 'Helvetica Neue, Arial, sans-serif' },
]

export interface Template {
  id: string
  name: string
  description: string
  background: string
  text: string
  accent: string
  headingFont: string
  bodyFont: string
  heroLayout: HeroLayout
  /** Design style this preset belongs to (default: classic). */
  style?: LookId
}

export const TEMPLATES: Template[] = [
  { id: 'classic', name: 'Classic Ivory', description: 'Ivory, charcoal and champagne — timeless.', background: '#FAF7F2', text: '#2B2A28', accent: '#B89B6A', headingFont: 'cormorant', bodyFont: 'jost', heroLayout: 'center' },
  { id: 'sage', name: 'Sage Garden', description: 'Soft greens for garden and outdoor weddings.', background: '#F6F7F2', text: '#26302A', accent: '#7F9377', headingFont: 'eb-garamond', bodyFont: 'lato', heroLayout: 'framed' },
  { id: 'rose', name: 'Dusty Rose', description: 'Blush and rose, romantic and warm.', background: '#FBF5F3', text: '#3A2A2B', accent: '#C08A86', headingFont: 'playfair', bodyFont: 'montserrat', heroLayout: 'split' },
  { id: 'filipiniana', name: 'Filipiniana', description: 'Capiz ivory with deep maroon, inspired by Filipino heritage.', background: '#FBF8F1', text: '#2E1F1C', accent: '#8C2F39', headingFont: 'marcellus', bodyFont: 'jost', heroLayout: 'framed' },
  { id: 'terracotta', name: 'Terracotta', description: 'Sun-warmed sand and clay, relaxed and boho.', background: '#FAF4EE', text: '#33261F', accent: '#C0714F', headingFont: 'cormorant', bodyFont: 'karla', heroLayout: 'left' },
  { id: 'minimal', name: 'Modern Minimal', description: 'Crisp white and black, editorial and clean.', background: '#FFFFFF', text: '#141414', accent: '#8C8C8C', headingFont: 'bodoni', bodyFont: 'inter', heroLayout: 'split' },
  { id: 'coastal', name: 'Coastal Blue', description: 'Dusty blue and sand for beach and island weddings.', background: '#F6F8F9', text: '#1F2A33', accent: '#6F8FA6', headingFont: 'lora', bodyFont: 'nunito-sans', heroLayout: 'left' },
  { id: 'lavender', name: 'Lavender Mist', description: 'Soft lilac, light and dreamy.', background: '#F9F7FB', text: '#2D2835', accent: '#9C8AB4', headingFont: 'cormorant', bodyFont: 'josefin', heroLayout: 'center' },
  { id: 'emerald', name: 'Emerald & Gold', description: 'Deep emerald with gold, formal and grand.', background: '#F7F6F1', text: '#1F3029', accent: '#B08D4C', headingFont: 'cinzel', bodyFont: 'raleway', heroLayout: 'center' },
  { id: 'burgundy', name: 'Burgundy Romance', description: 'Rich burgundy on cream, perfect for December.', background: '#FBF7F4', text: '#2B1A1D', accent: '#7E2A3A', headingFont: 'dm-serif', bodyFont: 'dm-sans', heroLayout: 'framed' },
  // ---- Maison Noir
  { style: 'maison', id: 'maison-noir', name: 'Noir & Gold', description: 'Black velvet with warm gold — the signature look.', background: '#0E0D0C', text: '#F3EDE2', accent: '#C8A96A', headingFont: 'bodoni', bodyFont: 'jost', heroLayout: 'center' },
  { style: 'maison', id: 'maison-midnight', name: 'Midnight Champagne', description: 'Deep midnight blue with soft champagne.', background: '#0F1420', text: '#EEE9DF', accent: '#D4B98C', headingFont: 'playfair', bodyFont: 'montserrat', heroLayout: 'left' },
  { style: 'maison', id: 'maison-onyx', name: 'Onyx Emerald', description: 'Near-black emerald with antique gold.', background: '#0C1512', text: '#EDEFE8', accent: '#B9975B', headingFont: 'cormorant', bodyFont: 'raleway', heroLayout: 'center' },
  { style: 'maison', id: 'maison-bordeaux', name: 'Bordeaux Nuit', description: 'Dark wine with rose-gold light.', background: '#170C0F', text: '#F2E6E4', accent: '#C79A6B', headingFont: 'dm-serif', bodyFont: 'dm-sans', heroLayout: 'split' },
  { style: 'maison', id: 'maison-espresso', name: 'Espresso Silk', description: 'Rich espresso brown with caramel gold.', background: '#1A1411', text: '#F1E9DF', accent: '#C9A27E', headingFont: 'gilda', bodyFont: 'lato', heroLayout: 'framed' },
  { style: 'maison', id: 'maison-silver', name: 'Charcoal Silver', description: 'Charcoal and moonlit silver, very modern.', background: '#141414', text: '#EFEFEF', accent: '#B8B8B8', headingFont: 'italiana', bodyFont: 'inter', heroLayout: 'left' },
  { style: 'maison', id: 'maison-navy', name: 'Navy Couture', description: 'Ink navy with brushed gold.', background: '#0D1726', text: '#ECE7DE', accent: '#C5A46D', headingFont: 'cormorant', bodyFont: 'josefin', heroLayout: 'center' },
  { style: 'maison', id: 'maison-plum', name: 'Plum Velvet', description: 'Dark plum with soft antique gold.', background: '#1A1020', text: '#EFE6F0', accent: '#C9A87C', headingFont: 'playfair', bodyFont: 'raleway', heroLayout: 'framed' },
  { style: 'maison', id: 'maison-atelier', name: 'Ivory Atelier', description: 'The Maison look on warm ivory paper.', background: '#F7F3EC', text: '#151312', accent: '#A6824B', headingFont: 'bodoni', bodyFont: 'jost', heroLayout: 'split' },
  { style: 'maison', id: 'maison-blanc', name: 'Blanc Editorial', description: 'Crisp white, black type, a touch of gold.', background: '#FFFFFF', text: '#111111', accent: '#9A7B4F', headingFont: 'prata', bodyFont: 'inter', heroLayout: 'center' },
  // ---- Gilded Deco
  { style: 'deco', id: 'deco-gatsby', name: 'Gatsby Black & Gold', description: 'Jet black and bright gold — pure 1920s glamour.', background: '#101010', text: '#F1E7D0', accent: '#D4AF37', headingFont: 'poiret', bodyFont: 'josefin', heroLayout: 'center' },
  { style: 'deco', id: 'deco-champagne', name: 'Champagne Ballroom', description: 'Champagne paper with polished gold.', background: '#F8F3E8', text: '#2A241B', accent: '#B08D4C', headingFont: 'poiret', bodyFont: 'montserrat', heroLayout: 'framed' },
  { style: 'deco', id: 'deco-emerald', name: 'Emerald Deco', description: 'Deep emerald lacquer with gold inlay.', background: '#0B2A22', text: '#F0EBDD', accent: '#CDAA5C', headingFont: 'cinzel', bodyFont: 'josefin', heroLayout: 'center' },
  { style: 'deco', id: 'deco-ivory', name: 'Ivory Sunburst', description: 'Ivory with warm brass sunbursts.', background: '#FBF7EF', text: '#23201A', accent: '#A8843F', headingFont: 'forum', bodyFont: 'raleway', heroLayout: 'split' },
  { style: 'deco', id: 'deco-sapphire', name: 'Sapphire Jazz', description: 'Midnight sapphire with gold — a jazz-age evening.', background: '#0E1A33', text: '#EDE8DC', accent: '#CFAE6B', headingFont: 'italiana', bodyFont: 'josefin', heroLayout: 'left' },
  { style: 'deco', id: 'deco-rosegold', name: 'Rose Gold Deco', description: 'Blush paper with rose-gold geometry.', background: '#FAF2EF', text: '#2F2223', accent: '#B07A6A', headingFont: 'poiret', bodyFont: 'montserrat', heroLayout: 'framed' },
  { style: 'deco', id: 'deco-onyx', name: 'Onyx & Pearl', description: 'Black onyx with pearl and platinum.', background: '#121212', text: '#F4F1EA', accent: '#CFC6B4', headingFont: 'cinzel', bodyFont: 'raleway', heroLayout: 'center' },
  { style: 'deco', id: 'deco-teal', name: 'Teal Lounge', description: 'Dark teal with antique gold.', background: '#0D2629', text: '#EAF0EE', accent: '#C9A35F', headingFont: 'forum', bodyFont: 'josefin', heroLayout: 'left' },
  { style: 'deco', id: 'deco-blush', name: 'Blush Gilded', description: 'Soft blush and gilded lines, light and elegant.', background: '#FBF5F2', text: '#2B2224', accent: '#B98E5E', headingFont: 'italiana', bodyFont: 'montserrat', heroLayout: 'split' },
  { style: 'deco', id: 'deco-ruby', name: 'Ruby Ballroom', description: 'Deep ruby with gold for a grand December night.', background: '#2A0C12', text: '#F3E7E3', accent: '#D2AE6D', headingFont: 'poiret', bodyFont: 'raleway', heroLayout: 'center' },
  // ---- Heritage
  { style: 'heritage', id: 'heritage-capiz', name: 'Capiz Ivory', description: 'Capiz-shell ivory with deep Filipiniana maroon.', background: '#FBF7EE', text: '#2B201A', accent: '#8C2F39', headingFont: 'marcellus', bodyFont: 'jost', heroLayout: 'framed' },
  { style: 'heritage', id: 'heritage-banig', name: 'Banig Natural', description: 'Woven-mat naturals: sand, rattan and brown.', background: '#F7F0E3', text: '#33261C', accent: '#9C6B3C', headingFont: 'cormorant', bodyFont: 'karla', heroLayout: 'left' },
  { style: 'heritage', id: 'heritage-sampaguita', name: 'Sampaguita', description: 'Jasmine white with leaf green.', background: '#FCFBF6', text: '#26302A', accent: '#6E8B5C', headingFont: 'eb-garamond', bodyFont: 'lato', heroLayout: 'framed' },
  { style: 'heritage', id: 'heritage-pina', name: 'Piña Cloth', description: 'Piña fibre cream with soft golden thread.', background: '#F8F5EC', text: '#2E2A24', accent: '#A28449', headingFont: 'prata', bodyFont: 'jost', heroLayout: 'center' },
  { style: 'heritage', id: 'heritage-inabel', name: 'Inabel Indigo', description: 'Ilocano weave indigo on cotton white.', background: '#F5F6F8', text: '#1C2433', accent: '#2F4E86', headingFont: 'marcellus', bodyFont: 'nunito-sans', heroLayout: 'split' },
  { style: 'heritage', id: 'heritage-narra', name: 'Narra Wood', description: 'Warm narra wood and carved brown.', background: '#F6EFE6', text: '#2E1E15', accent: '#8A5A36', headingFont: 'lora', bodyFont: 'karla', heroLayout: 'left' },
  { style: 'heritage', id: 'heritage-santan', name: 'Santan Coral', description: 'Santan-flower coral, bright and joyful.', background: '#FCF5F1', text: '#33221E', accent: '#B24E39', headingFont: 'playfair', bodyFont: 'montserrat', heroLayout: 'framed' },
  { style: 'heritage', id: 'heritage-mangrove', name: 'Mangrove Green', description: 'Island greens for garden and beach weddings.', background: '#F3F5EE', text: '#1F2B22', accent: '#47704F', headingFont: 'cormorant', bodyFont: 'raleway', heroLayout: 'center' },
  { style: 'heritage', id: 'heritage-perlas', name: 'Perlas Pearl', description: 'South Sea pearl and soft taupe.', background: '#FAF8F5', text: '#2A2826', accent: '#8F7F63', headingFont: 'gilda', bodyFont: 'lato', heroLayout: 'framed' },
  { style: 'heritage', id: 'heritage-terno', name: 'Terno Burgundy', description: 'Terno-gown burgundy on capiz cream.', background: '#FBF6F3', text: '#2B171B', accent: '#7E2A3A', headingFont: 'dm-serif', bodyFont: 'dm-sans', heroLayout: 'left' },
  // ---- Eucalyptus & Gold (website only)
  { style: 'leaf', id: 'leaf-ivory', name: 'Ivory & Eucalyptus', description: 'Warm ivory paper, antique-gold lines.', background: '#FAF7F1', text: '#2B2925', accent: '#A8854F', headingFont: 'cormorant', bodyFont: 'jost', heroLayout: 'framed' },
  { style: 'leaf', id: 'leaf-sage', name: 'Sage Mist', description: 'Soft sage paper with olive-gold lines.', background: '#F5F6F0', text: '#27302A', accent: '#8C7F4E', headingFont: 'eb-garamond', bodyFont: 'lato', heroLayout: 'framed' },
  { style: 'leaf', id: 'leaf-blush', name: 'Blush & Eucalyptus', description: 'Barely-there blush with rose-gold lines.', background: '#FBF6F3', text: '#35292A', accent: '#AF8463', headingFont: 'cormorant', bodyFont: 'montserrat', heroLayout: 'framed' },
  { style: 'leaf', id: 'leaf-forest', name: 'Forest & Gold', description: 'Linen white, deep green type and brushed gold.', background: '#F7F6F0', text: '#1F2E25', accent: '#9F7F43', headingFont: 'prata', bodyFont: 'raleway', heroLayout: 'center' },
  // ---- Watercolour Garden (website only)
  { style: 'garden', id: 'garden-blush', name: 'Blush Garden', description: 'Blush paper, rose-gold accents.', background: '#FBF6F2', text: '#3A2C2B', accent: '#B5806F', headingFont: 'cormorant', bodyFont: 'montserrat', heroLayout: 'framed' },
  { style: 'garden', id: 'garden-ivory', name: 'Ivory Garden', description: 'Warm ivory with antique gold.', background: '#FAF7F1', text: '#2E2A25', accent: '#A8854F', headingFont: 'cormorant', bodyFont: 'jost', heroLayout: 'framed' },
  { style: 'garden', id: 'garden-peach', name: 'Peach Garden', description: 'Peach-washed paper with apricot.', background: '#FCF6F0', text: '#3A2B22', accent: '#BE8660', headingFont: 'playfair', bodyFont: 'lato', heroLayout: 'framed' },
  { style: 'garden', id: 'garden-sage', name: 'Sage Garden', description: 'Fresh sage paper with olive.', background: '#F6F7F1', text: '#26302A', accent: '#7F8E62', headingFont: 'eb-garamond', bodyFont: 'lato', heroLayout: 'framed' },
  // ---- Save the Date (website only)
  { style: 'savedate', id: 'savedate-champagne', name: 'Champagne', description: 'Ivory and champagne gold.', background: '#FAF7F2', text: '#2B2A28', accent: '#AE8B55', headingFont: 'cormorant', bodyFont: 'jost', heroLayout: 'center' },
  { style: 'savedate', id: 'savedate-rose', name: 'Rose', description: 'Soft blush with dusty rose.', background: '#FBF5F3', text: '#3A2A2B', accent: '#B47A74', headingFont: 'playfair', bodyFont: 'montserrat', heroLayout: 'center' },
  { style: 'savedate', id: 'savedate-sage', name: 'Sage', description: 'Linen with garden sage.', background: '#F6F7F2', text: '#26302A', accent: '#788C6C', headingFont: 'eb-garamond', bodyFont: 'lato', heroLayout: 'center' },
  { style: 'savedate', id: 'savedate-dusk', name: 'Dusk Blue', description: 'Cool white with dusk blue.', background: '#F6F8F9', text: '#1F2A38', accent: '#5E7E9A', headingFont: 'lora', bodyFont: 'nunito-sans', heroLayout: 'center' },
  // ---- Sunlit Arch (website only)
  { style: 'arch', id: 'arch-terracotta', name: 'Terracotta Sun', description: 'Sun-warmed sand and terracotta.', background: '#FAF4EE', text: '#33261F', accent: '#B4664A', headingFont: 'cormorant', bodyFont: 'karla', heroLayout: 'center' },
  { style: 'arch', id: 'arch-apricot', name: 'Apricot', description: 'Peach paper and apricot glow.', background: '#FCF5EF', text: '#3A2A22', accent: '#C2805C', headingFont: 'cormorant', bodyFont: 'josefin', heroLayout: 'center' },
  { style: 'arch', id: 'arch-sand', name: 'Sand & Sage', description: 'Sand with dusty sage.', background: '#F8F4EC', text: '#2E2B22', accent: '#7E8A62', headingFont: 'lora', bodyFont: 'karla', heroLayout: 'center' },
  { style: 'arch', id: 'arch-clay', name: 'Clay & Gold', description: 'Clay cream with brass gold.', background: '#FAF6EF', text: '#2C241C', accent: '#A07A42', headingFont: 'cormorant', bodyFont: 'raleway', heroLayout: 'left' },
  // ---- Love Story (website only)
  { style: 'story', id: 'story-rose', name: 'Rose Petal', description: 'Blush paper and rose.', background: '#FCF6F5', text: '#3A2A2C', accent: '#B07479', headingFont: 'cormorant', bodyFont: 'montserrat', heroLayout: 'framed' },
  { style: 'story', id: 'story-gold', name: 'Blush & Gold', description: 'Blush paper with soft gold.', background: '#FBF6F2', text: '#33292A', accent: '#A9844F', headingFont: 'cormorant', bodyFont: 'jost', heroLayout: 'framed' },
  { style: 'story', id: 'story-mauve', name: 'Mauve', description: 'Pale mauve, dreamy and warm.', background: '#FAF6F8', text: '#33282F', accent: '#94708A', headingFont: 'playfair', bodyFont: 'raleway', heroLayout: 'framed' },
  { style: 'story', id: 'story-lavender', name: 'Lavender', description: 'Soft lilac and lavender.', background: '#F9F7FB', text: '#2D2835', accent: '#8676A6', headingFont: 'cormorant', bodyFont: 'josefin', heroLayout: 'framed' },
  // ---- Damask (website only)
  { style: 'damask', id: 'damask-ivory', name: 'Ivory & Gold', description: 'Ivory silk with gold damask.', background: '#FAF6EE', text: '#2A251E', accent: '#A4803C', headingFont: 'cormorant', bodyFont: 'jost', heroLayout: 'split' },
  { style: 'damask', id: 'damask-champagne', name: 'Champagne', description: 'Deeper champagne with antique gold.', background: '#F6EFE2', text: '#2E261C', accent: '#97743A', headingFont: 'prata', bodyFont: 'lato', heroLayout: 'split' },
  { style: 'damask', id: 'damask-sage', name: 'Sage Damask', description: 'Sage silk with olive damask.', background: '#F4F5EE', text: '#24302A', accent: '#6F7F55', headingFont: 'cormorant', bodyFont: 'raleway', heroLayout: 'split' },
  { style: 'damask', id: 'damask-burgundy', name: 'Burgundy & Gold', description: 'Cream with burgundy damask for December.', background: '#FBF6F2', text: '#2B171B', accent: '#7E2A3A', headingFont: 'dm-serif', bodyFont: 'dm-sans', heroLayout: 'split' },
]

export const HERO_LAYOUTS: { id: HeroLayout; name: string; description: string }[] = [
  { id: 'center', name: 'Full photo, centred', description: 'Names centred over a full-screen photo.' },
  { id: 'left', name: 'Full photo, left', description: 'Names at the lower left over the photo.' },
  { id: 'split', name: 'Split', description: 'Names on one side, photo on the other.' },
  { id: 'framed', name: 'Arched frame', description: 'Photo in an arched frame on a paper background.' },
]

export const DEFAULT_THEME: ThemeSettings = { template: 'classic' }

// ---------------------------------------------------------------- colour math

const HEX = /^#[0-9a-fA-F]{6}$/
export const isHex = (v: unknown): v is string => typeof v === 'string' && HEX.test(v)

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function hex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase()
}
/** Mix a toward b by t (0..1). */
export function mix(a: string, b: string, t: number): string {
  const A = rgb(a)
  const B = rgb(b)
  return hex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t])
}
function luminance(h: string): number {
  const [r, g, b] = rgb(h).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
/** True for page colours dark enough to need light text. */
export const isDarkColor = (hex: string) => luminance(hex) < 0.18

export function contrast(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
/** Move `color` toward `toward` until it reaches `min` contrast against `bg`. */
function ensure(color: string, bg: string, toward: string, min: number): string {
  let c = color
  for (let i = 0; i < 40 && contrast(c, bg) < min; i++) c = mix(c, toward, 0.08)
  return c
}

export interface Palette {
  ivory: string
  cream: string
  paper: string
  linen: string
  line: string
  ink: string
  inkSoft: string
  muted: string
  champagne: string
  champagneLight: string
  gold: string
}

/** Full site palette from three base colours, with contrast guaranteed. */
export function derivePalette(background: string, text: string, accent: string): Palette {
  const bg = background
  const dark = isDarkColor(bg)
  const ink = ensure(text, bg, luminance(bg) > 0.5 ? '#000000' : '#FFFFFF', 7)
  return {
    ivory: bg,
    cream: mix(bg, accent, dark ? 0.07 : 0.08),
    // On dark pages, cards sit just slightly lighter than the page.
    paper: dark ? mix(bg, '#FFFFFF', 0.045) : mix(bg, '#FFFFFF', 0.6),
    linen: mix(bg, accent, dark ? 0.16 : 0.2),
    line: mix(bg, accent, dark ? 0.32 : 0.28),
    ink,
    inkSoft: ensure(mix(ink, bg, 0.18), bg, ink, 7),
    muted: ensure(mix(ink, bg, 0.42), mix(bg, accent, 0.08), ink, 4.6),
    champagne: accent,
    champagneLight: mix(accent, bg, 0.62),
    gold: ensure(accent, mix(bg, accent, 0.08), ink, 4.6),
  }
}

export interface ContrastCheck {
  label: string
  ratio: number
  min: number
  ok: boolean
}

export function contrastReport(p: Palette): ContrastCheck[] {
  const checks: [string, string, string, number][] = [
    ['Body text on background', p.ink, p.ivory, 7],
    ['Secondary text on background', p.muted, p.ivory, 4.5],
    ['Accent labels on background', p.gold, p.ivory, 4.5],
    ['Button text (background on text colour)', p.ivory, p.ink, 4.5],
  ]
  return checks.map(([label, a, b, min]) => {
    const ratio = contrast(a, b)
    return { label, ratio, min, ok: ratio >= min }
  })
}

// ---------------------------------------------------------------- resolving

export interface ResolvedTheme {
  templateId: string
  /** The printable design (Printables, envelope, posters, share image). */
  style: StyleId
  /** The website design look (the style itself, or a website-only look). */
  look: LookId
  /** Script font for the couple's names, when the look has one. */
  script?: FontOption
  dark: boolean
  palette: Palette
  heading: FontOption
  body: FontOption
  heroLayout: HeroLayout
}

export const findTemplate = (id: string | undefined) => TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0]
export const findHeading = (id: string | undefined) => HEADING_FONTS.find((f) => f.id === id)
export const findBody = (id: string | undefined) => BODY_FONTS.find((f) => f.id === id)

export function resolveTheme(s: ThemeSettings | null | undefined): ResolvedTheme {
  const t = findTemplate(s?.template)
  const background = isHex(s?.background) ? s.background : t.background
  const text = isHex(s?.text) ? s.text : t.text
  const accent = isHex(s?.accent) ? s.accent : t.accent
  return {
    templateId: t.id,
    style: printStyleOf(t.style),
    look: findStyle(t.style).id,
    script: findStyle(t.style).script,
    dark: isDarkColor(background),
    palette: derivePalette(background, text, accent),
    heading: findHeading(s?.headingFont) ?? findHeading(t.headingFont) ?? HEADING_FONTS[0],
    body: findBody(s?.bodyFont) ?? findBody(t.bodyFont) ?? BODY_FONTS[0],
    heroLayout: (HERO_LAYOUTS.some((h) => h.id === s?.heroLayout) ? s?.heroLayout : t.heroLayout) as HeroLayout,
  }
}

export function parseThemeSettings(value: unknown): ThemeSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_THEME
  const o = value as Record<string, unknown>
  const str = (k: string) => (typeof o[k] === 'string' && o[k] ? (o[k] as string) : undefined)
  return {
    template: str('template') ?? 'classic',
    headingFont: str('headingFont'),
    bodyFont: str('bodyFont'),
    background: isHex(o.background) ? o.background : undefined,
    text: isHex(o.text) ? o.text : undefined,
    accent: isHex(o.accent) ? o.accent : undefined,
    heroLayout: (['center', 'left', 'split', 'framed'] as const).find((h) => h === o.heroLayout),
  }
}

export function googleFontsHref(fonts: FontOption[]): string {
  const families = fonts
    .filter((f, i, all) => all.findIndex((x) => x.family === f.family) === i)
    .map((f) => `family=${f.family.replace(/ /g, '+')}${f.spec ? `:${f.spec}` : ''}`)
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`
}

/** CSS custom properties consumed by the Tailwind theme tokens in index.css. */
export function themeVars(t: ResolvedTheme): Record<string, string> {
  const p = t.palette
  return {
    '--color-ivory': p.ivory,
    '--color-cream': p.cream,
    '--color-paper': p.paper,
    '--color-linen': p.linen,
    '--color-line': p.line,
    '--color-ink': p.ink,
    '--color-ink-soft': p.inkSoft,
    '--color-muted': p.muted,
    '--color-champagne': p.champagne,
    '--color-champagne-light': p.champagneLight,
    '--color-gold': p.gold,
    '--font-serif': `"${t.heading.family}", ${t.heading.fallback}`,
    '--font-sans': `"${t.body.family}", ${t.body.fallback}`,
    '--font-script': t.script ? `"${t.script.family}", ${t.script.fallback}` : `"${t.heading.family}", ${t.heading.fallback}`,
  }
}

/**
 * The admin pages keep the couple's accent and fonts but always use the
 * classic, light design so forms and tables stay familiar (and Printables,
 * which read these colours, always print on light paper).
 */
export function adminTheme(t: ResolvedTheme): ResolvedTheme {
  if (t.look === 'classic' && !t.dark) return t
  return {
    ...t,
    style: 'classic',
    look: 'classic',
    script: undefined,
    dark: false,
    palette: t.dark ? derivePalette('#FAF7F2', '#2B2A28', t.palette.champagne) : t.palette,
  }
}
