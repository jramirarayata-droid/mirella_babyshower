/**
 * Look & Feel: templates, font pairings and colour derivation.
 *
 * Every template is defined by three base colours (background, text, accent),
 * a heading/body font pair and a hero layout. All other shades used by the
 * site are derived from those three and adjusted until they pass WCAG
 * contrast, so any combination picked stays readable.
 */

export type HeroLayout = 'center' | 'left' | 'split' | 'framed'

/**
 * A design style: its own section designs, ornaments, textures and type rules.
 * These four are also the printable designs (Printables, envelope, posters).
 * (The ids are internal; guests and the admin only see the names.)
 */
export type StyleId = 'classic' | 'maison' | 'deco' | 'heritage'

/**
 * Website-only design looks. Each builds on a base print style (`print`) so
 * printables, the invitation envelope and the admin stay exactly as they are.
 */
export type LookOnlyId = 'leaf' | 'garden' | 'clouds' | 'arch' | 'balloons'
export type LookId = StyleId | LookOnlyId

export interface StyleInfo {
  id: LookId
  name: string
  description: string
  /** Dark backgrounds are designed for in this style. */
  allowsDark: boolean
  /** The printable design this look uses (website-only looks). */
  print?: StyleId
  /** Script font for the baby's name (website-only looks). */
  script?: FontOption
}

export const STYLES: StyleInfo[] = [
  { id: 'classic', name: 'Soft & Sweet', description: 'Gentle and timeless — fine lines, airy paper and tiny stars.', allowsDark: false },
  { id: 'maison', name: 'Twinkle Little Star', description: 'A starry night — midnight blues, gold stars and a crescent moon.', allowsDark: true },
  { id: 'deco', name: 'Hello Sunshine', description: 'Bright and cheerful — sunbursts, rays and sunny stepped frames.', allowsDark: false },
  { id: 'heritage', name: 'Heritage', description: 'Filipino charm — capiz-shell shimmer and woven banig borders.', allowsDark: false },
]

/** Website-only looks, drawn for this site. */
export const LOOKS: StyleInfo[] = [
  {
    id: 'clouds',
    name: 'Over the Moon',
    description: 'Fluffy clouds, a sleepy moon and twinkling stars, with a round countdown to the shower.',
    allowsDark: false,
    print: 'classic',
    script: { id: 'sniglet', family: 'Sniglet', spec: 'wght@400;800', fallback: 'cursive' },
  },
  {
    id: 'balloons',
    name: 'Oh Baby! Balloons',
    description: 'Soft balloons floating up around a round photo, with rounded cards.',
    allowsDark: false,
    print: 'classic',
    script: { id: 'pacifico', family: 'Pacifico', spec: '', fallback: 'cursive' },
  },
  {
    id: 'arch',
    name: 'Boho Rainbow',
    description: 'Muted rainbow arches over your photo, arched cards and airy type.',
    allowsDark: false,
    print: 'classic',
  },
  {
    id: 'leaf',
    name: 'Sweet Greenery',
    description: 'Painted watercolour greenery over fine lines — lovely for a surprise or a boy or girl.',
    allowsDark: false,
    print: 'classic',
    script: { id: 'great-vibes', family: 'Great Vibes', spec: '', fallback: 'cursive' },
  },
  {
    id: 'garden',
    name: 'Little Blossom',
    description: 'Soft painted blooms under your photo, with a flowing script for the baby’s name.',
    allowsDark: false,
    print: 'classic',
    script: { id: 'great-vibes', family: 'Great Vibes', spec: '', fallback: 'cursive' },
  },
]

/** Every style shown in Look & Feel: the website-only looks first, then the four print-ready styles. */
export const ALL_STYLES: StyleInfo[] = [...LOOKS, ...STYLES]

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
  // ---- Soft & Sweet
  { id: 'classic', name: 'Cream & Honey', description: 'Warm cream with soft honey gold — sweet for any baby.', background: '#FBF8F2', text: '#3A332B', accent: '#C29A5B', headingFont: 'cormorant', bodyFont: 'nunito-sans', heroLayout: 'framed' },
  { id: 'pink', name: 'Blush Pink', description: 'Pale blush with rosy pink — for a little girl.', background: '#FDF5F6', text: '#3D2A2E', accent: '#D58A98', headingFont: 'playfair', bodyFont: 'nunito-sans', heroLayout: 'framed' },
  { id: 'blue', name: 'Baby Blue', description: 'Soft sky blue with powder blue — for a little boy.', background: '#F4F8FC', text: '#24324A', accent: '#7FA3C9', headingFont: 'lora', bodyFont: 'nunito-sans', heroLayout: 'framed' },
  { id: 'mint', name: 'Mint Sprout', description: 'Fresh mint and soft green — lovely for a surprise.', background: '#F3FAF6', text: '#24362D', accent: '#79B394', headingFont: 'eb-garamond', bodyFont: 'nunito-sans', heroLayout: 'framed' },
  { id: 'lemon', name: 'Buttercup', description: 'Buttery yellow, happy and bright.', background: '#FFFBEE', text: '#3A3222', accent: '#D7AE3E', headingFont: 'cormorant', bodyFont: 'karla', heroLayout: 'center' },
  { id: 'lavender', name: 'Lavender Dream', description: 'Soft lilac, light and dreamy.', background: '#F9F6FC', text: '#2F2838', accent: '#A08BC4', headingFont: 'cormorant', bodyFont: 'josefin', heroLayout: 'framed' },
  { id: 'peach', name: 'Peach Fuzz', description: 'Warm peach and apricot, cosy and soft.', background: '#FFF6F1', text: '#3D2B23', accent: '#E0957A', headingFont: 'playfair', bodyFont: 'lato', heroLayout: 'split' },
  { id: 'team', name: 'Team Pink or Blue', description: 'Pink and blue together — for a gender reveal.', background: '#FBF7FA', text: '#2E2A3A', accent: '#B98BB8', headingFont: 'dm-serif', bodyFont: 'dm-sans', heroLayout: 'framed' },
  { id: 'oat', name: 'Oatmeal & Sage', description: 'Calm neutrals: oatmeal, linen and sage.', background: '#F8F5EF', text: '#2F2D27', accent: '#94A383', headingFont: 'cormorant', bodyFont: 'karla', heroLayout: 'left' },
  { id: 'minimal', name: 'Modern Minimal', description: 'Crisp white and soft grey, clean and simple.', background: '#FFFFFF', text: '#1E1E1E', accent: '#9A9A9A', headingFont: 'bodoni', bodyFont: 'inter', heroLayout: 'split' },
  // ---- Twinkle Little Star
  { style: 'maison', id: 'maison-noir', name: 'Midnight & Gold', description: 'Deep midnight blue with warm gold stars — the signature look.', background: '#121A33', text: '#F1EDE3', accent: '#D9B86C', headingFont: 'cormorant', bodyFont: 'nunito-sans', heroLayout: 'center' },
  { style: 'maison', id: 'maison-dusk', name: 'Dusky Lilac', description: 'Twilight purple with soft silver-gold.', background: '#211A33', text: '#EFE9F4', accent: '#CDB4E0', headingFont: 'playfair', bodyFont: 'nunito-sans', heroLayout: 'framed' },
  { style: 'maison', id: 'maison-ocean', name: 'Night Ocean', description: 'Ink teal night with pale moonlight.', background: '#0F2430', text: '#EAF2F2', accent: '#A9D3D6', headingFont: 'lora', bodyFont: 'lato', heroLayout: 'center' },
  { style: 'maison', id: 'maison-day', name: 'Starry Morning', description: 'The starry look on soft cloud white with navy and gold.', background: '#F6F8FC', text: '#1D2742', accent: '#B8954C', headingFont: 'cormorant', bodyFont: 'nunito-sans', heroLayout: 'framed' },
  // ---- Hello Sunshine
  { style: 'deco', id: 'deco-sunshine', name: 'Sunshine Yellow', description: 'Cheerful yellow with sunny gold rays.', background: '#FFFAEB', text: '#33291A', accent: '#E0A526', headingFont: 'poiret', bodyFont: 'nunito-sans', heroLayout: 'framed' },
  { style: 'deco', id: 'deco-citrus', name: 'Citrus Sun', description: 'Tangerine and lemon, bright and happy.', background: '#FFF7EE', text: '#38251A', accent: '#E58A3C', headingFont: 'forum', bodyFont: 'karla', heroLayout: 'center' },
  { style: 'deco', id: 'deco-sky', name: 'Sun & Sky', description: 'Sky blue paper with golden sun.', background: '#F2F8FD', text: '#22324A', accent: '#D69E2E', headingFont: 'italiana', bodyFont: 'nunito-sans', heroLayout: 'split' },
  { style: 'deco', id: 'deco-blush', name: 'Rosy Sunrise', description: 'Blush paper and a rose-gold sunrise.', background: '#FDF4F1', text: '#3A2626', accent: '#D1866E', headingFont: 'poiret', bodyFont: 'montserrat', heroLayout: 'framed' },
  // ---- Heritage
  { style: 'heritage', id: 'heritage-capiz', name: 'Capiz Pearl', description: 'Capiz-shell ivory with soft rose.', background: '#FCF8F2', text: '#33261F', accent: '#C27D7D', headingFont: 'marcellus', bodyFont: 'nunito-sans', heroLayout: 'framed' },
  { style: 'heritage', id: 'heritage-banig', name: 'Banig Natural', description: 'Woven-mat naturals: sand, rattan and honey.', background: '#F8F1E5', text: '#35281D', accent: '#B08048', headingFont: 'cormorant', bodyFont: 'karla', heroLayout: 'left' },
  { style: 'heritage', id: 'heritage-sampaguita', name: 'Sampaguita', description: 'Jasmine white with leaf green.', background: '#FCFBF6', text: '#26302A', accent: '#6E9A6A', headingFont: 'eb-garamond', bodyFont: 'lato', heroLayout: 'framed' },
  { style: 'heritage', id: 'heritage-inabel', name: 'Inabel Blue', description: 'Ilocano weave blue on cotton white.', background: '#F5F7FA', text: '#1E2737', accent: '#5577A8', headingFont: 'marcellus', bodyFont: 'nunito-sans', heroLayout: 'split' },
  // ---- Over the Moon (website only)
  { style: 'clouds', id: 'clouds-blue', name: 'Sky Blue', description: 'Pale sky, white clouds and golden stars.', background: '#F2F7FC', text: '#25344D', accent: '#86A9D1', headingFont: 'lora', bodyFont: 'nunito-sans', heroLayout: 'framed' },
  { style: 'clouds', id: 'clouds-pink', name: 'Pink Sky', description: 'Cotton-candy pink with soft gold.', background: '#FDF4F7', text: '#3D2B33', accent: '#DE93AE', headingFont: 'lora', bodyFont: 'nunito-sans', heroLayout: 'framed' },
  { style: 'clouds', id: 'clouds-lilac', name: 'Lilac Dusk', description: 'Lilac dusk sky with silver stars.', background: '#F7F4FC', text: '#2F2A40', accent: '#A595D1', headingFont: 'lora', bodyFont: 'nunito-sans', heroLayout: 'framed' },
  { style: 'clouds', id: 'clouds-neutral', name: 'Sand & Moon', description: 'Warm sand with a honey moon — neutral.', background: '#FAF6EF', text: '#36302A', accent: '#C9A46A', headingFont: 'lora', bodyFont: 'nunito-sans', heroLayout: 'framed' },
  // ---- Oh Baby! Balloons (website only)
  { style: 'balloons', id: 'balloons-pastel', name: 'Pastel Party', description: 'Mixed pastel balloons on cream.', background: '#FFFAF5', text: '#3A3030', accent: '#E79BA6', headingFont: 'dm-serif', bodyFont: 'nunito-sans', heroLayout: 'framed' },
  { style: 'balloons', id: 'balloons-blue', name: 'Blue Balloons', description: 'Powder blue balloons and cloud white.', background: '#F4F8FC', text: '#24324A', accent: '#7FA3C9', headingFont: 'dm-serif', bodyFont: 'nunito-sans', heroLayout: 'framed' },
  { style: 'balloons', id: 'balloons-pink', name: 'Pink Balloons', description: 'Rosy pink balloons on blush.', background: '#FDF4F6', text: '#3D2A2E', accent: '#D98A9C', headingFont: 'dm-serif', bodyFont: 'nunito-sans', heroLayout: 'framed' },
  { style: 'balloons', id: 'balloons-sage', name: 'Sage Balloons', description: 'Sage and sand balloons, gender-neutral.', background: '#F7F7F1', text: '#2C3129', accent: '#93A986', headingFont: 'dm-serif', bodyFont: 'nunito-sans', heroLayout: 'framed' },
  // ---- Boho Rainbow (website only)
  { style: 'arch', id: 'arch-terracotta', name: 'Terracotta Rainbow', description: 'Sun-warmed sand and terracotta.', background: '#FAF4EE', text: '#33261F', accent: '#C27A5C', headingFont: 'cormorant', bodyFont: 'karla', heroLayout: 'center' },
  { style: 'arch', id: 'arch-blush', name: 'Blush Rainbow', description: 'Blush, peach and mauve.', background: '#FCF5F1', text: '#3A2A26', accent: '#CF8F86', headingFont: 'cormorant', bodyFont: 'josefin', heroLayout: 'center' },
  { style: 'arch', id: 'arch-sage', name: 'Sage Rainbow', description: 'Sand with dusty sage and mustard.', background: '#F8F4EC', text: '#2E2B22', accent: '#8C9A6C', headingFont: 'lora', bodyFont: 'karla', heroLayout: 'center' },
  { style: 'arch', id: 'arch-blue', name: 'Dusty Blue Rainbow', description: 'Oat with dusty blue and clay.', background: '#F7F5F0', text: '#26303A', accent: '#7C98AF', headingFont: 'cormorant', bodyFont: 'raleway', heroLayout: 'left' },
  // ---- Sweet Greenery (website only)
  { style: 'leaf', id: 'leaf-ivory', name: 'Ivory & Greenery', description: 'Warm ivory paper with soft gold lines.', background: '#FAF7F1', text: '#2B2925', accent: '#A8854F', headingFont: 'cormorant', bodyFont: 'nunito-sans', heroLayout: 'framed' },
  { style: 'leaf', id: 'leaf-sage', name: 'Sage Mist', description: 'Soft sage paper with olive lines.', background: '#F5F6F0', text: '#27302A', accent: '#8C9A6A', headingFont: 'eb-garamond', bodyFont: 'lato', heroLayout: 'framed' },
  { style: 'leaf', id: 'leaf-blue', name: 'Greenery & Blue', description: 'Cool white with powder-blue lines.', background: '#F5F8FA', text: '#25303A', accent: '#7E9DB5', headingFont: 'cormorant', bodyFont: 'nunito-sans', heroLayout: 'framed' },
  { style: 'leaf', id: 'leaf-blush', name: 'Greenery & Blush', description: 'Barely-there blush with rosy lines.', background: '#FBF6F3', text: '#35292A', accent: '#C08B83', headingFont: 'cormorant', bodyFont: 'montserrat', heroLayout: 'framed' },
  // ---- Little Blossom (website only)
  { style: 'garden', id: 'garden-blush', name: 'Blush Blossom', description: 'Blush paper with rosy accents.', background: '#FBF6F2', text: '#3A2C2B', accent: '#C3877A', headingFont: 'cormorant', bodyFont: 'montserrat', heroLayout: 'framed' },
  { style: 'garden', id: 'garden-peach', name: 'Peach Blossom', description: 'Peach-washed paper with apricot.', background: '#FCF6F0', text: '#3A2B22', accent: '#C98E66', headingFont: 'playfair', bodyFont: 'lato', heroLayout: 'framed' },
  { style: 'garden', id: 'garden-lilac', name: 'Lilac Blossom', description: 'Soft lilac with mauve.', background: '#FAF6FA', text: '#352B36', accent: '#A784A4', headingFont: 'cormorant', bodyFont: 'josefin', heroLayout: 'framed' },
  { style: 'garden', id: 'garden-ivory', name: 'Ivory Blossom', description: 'Warm ivory with soft gold.', background: '#FAF7F1', text: '#2E2A25', accent: '#A8854F', headingFont: 'cormorant', bodyFont: 'nunito-sans', heroLayout: 'framed' },
]

export const HERO_LAYOUTS: { id: HeroLayout; name: string; description: string }[] = [
  { id: 'center', name: 'Full photo, centred', description: 'Names centred over a full-screen photo.' },
  { id: 'left', name: 'Full photo, left', description: 'Names at the lower left over the photo.' },
  { id: 'split', name: 'Split', description: 'Names on one side, photo on the other.' },
  { id: 'framed', name: 'Arched frame', description: 'Photo in an arched frame on a paper background.' },
]

export const DEFAULT_THEME: ThemeSettings = { template: 'clouds-blue' }

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
  /** Script font for the baby's name, when the look has one. */
  script?: FontOption
  dark: boolean
  palette: Palette
  heading: FontOption
  body: FontOption
  heroLayout: HeroLayout
}

export const findTemplate = (id: string | undefined) => TEMPLATES.find((t) => t.id === id) ?? TEMPLATES.find((t) => t.id === DEFAULT_THEME.template) ?? TEMPLATES[0]
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
    template: str('template') ?? DEFAULT_THEME.template,
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
 * The admin pages keep the site's accent and fonts but always use the
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
