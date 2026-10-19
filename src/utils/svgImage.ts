/*
 * Turns an on-page <svg> (styled with the site's CSS classes) into a
 * stand-alone picture: every colour and font is written onto the elements,
 * the web fonts are embedded, and the result can be drawn onto a canvas at
 * any size — so the downloaded image stays sharp however large it is.
 */

const PROPS = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-opacity',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'letter-spacing',
] as const

/** Copies the computed styles of `src` (and its children) onto a detached clone. */
function inlineStyles(src: SVGSVGElement): { clone: SVGSVGElement; families: Set<string> } {
  const clone = src.cloneNode(true) as SVGSVGElement
  const from = [src, ...Array.from(src.querySelectorAll('*'))]
  const to = [clone, ...Array.from(clone.querySelectorAll('*'))]
  const families = new Set<string>()
  from.forEach((el, i) => {
    const out = to[i] as SVGElement
    if (!(out instanceof SVGElement)) return
    const cs = getComputedStyle(el)
    const style: string[] = []
    for (const p of PROPS) {
      const v = cs.getPropertyValue(p)
      if (v) style.push(`${p}:${v}`)
    }
    if (el.tagName === 'text' || el.tagName === 'tspan') {
      families.add(cs.fontFamily)
      // Not every renderer applies text-transform inside SVG — bake it in.
      if (cs.textTransform === 'uppercase' && !out.querySelector('*')) out.textContent = (out.textContent ?? '').toUpperCase()
    }
    out.setAttribute('style', style.join(';'))
    out.removeAttribute('class')
  })
  // Tooltips carry names; they're never shown in a picture anyway.
  clone.querySelectorAll('title').forEach((t) => t.remove())
  return { clone, families }
}

const fontCache = new Map<string, Promise<string>>()

function toDataUrl(url: string): Promise<string> {
  let p = fontCache.get(url)
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('font'))))
      .then(
        (b) =>
          new Promise<string>((resolve, reject) => {
            const fr = new FileReader()
            fr.onload = () => resolve(String(fr.result))
            fr.onerror = () => reject(fr.error)
            fr.readAsDataURL(b)
          }),
      )
    fontCache.set(url, p)
    p.catch(() => fontCache.delete(url))
  }
  return p
}

/** @font-face rules (Latin only) for the families used, with the files embedded. Best effort. */
async function embeddedFonts(families: Set<string>): Promise<string> {
  const wanted = new Set<string>()
  for (const f of families) for (const name of f.split(',')) wanted.add(name.trim().replace(/^["']|["']$/g, '').toLowerCase())
  const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href*="fonts.googleapis.com"]')).map((l) => l.href)
  const rules: string[] = []
  for (const href of new Set(links)) {
    let css = ''
    try {
      css = await (await fetch(href)).text()
    } catch {
      continue
    }
    for (const block of css.match(/@font-face\s*{[^}]*}/g) ?? []) {
      const family = /font-family:\s*['"]?([^;'"]+)/.exec(block)?.[1]?.trim().toLowerCase()
      if (!family || !wanted.has(family)) continue
      const range = /unicode-range:\s*([^;]+)/.exec(block)?.[1] ?? ''
      if (range && !/U\+0000-00FF/i.test(range)) continue // the Latin set covers Filipino and English names
      const url = /url\(([^)]+)\)/.exec(block)?.[1]?.replace(/^["']|["']$/g, '')
      if (!url) continue
      try {
        const data = await toDataUrl(url)
        rules.push(block.replace(/url\([^)]+\)/, `url(${data})`))
      } catch {
        // Skip — the picture falls back to a similar system font.
      }
    }
  }
  return rules.join('\n')
}

/** A self-contained SVG string of `svg`, sized `width` × `height` pixels. */
export async function standaloneSvg(svg: SVGSVGElement, width: number, height: number): Promise<string> {
  const { clone, families } = inlineStyles(svg)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(Math.round(width)))
  clone.setAttribute('height', String(Math.round(height)))
  clone.removeAttribute('style')
  const fonts = await embeddedFonts(families)
  if (fonts) {
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    style.textContent = fonts
    clone.insertBefore(style, clone.firstChild)
  }
  return new XMLSerializer().serializeToString(clone)
}

/** Loads an SVG string as an image ready for drawImage. */
export function svgToImage(svgText: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }))
    const img = new Image()
    img.onload = () => {
      // Give embedded fonts a moment (Safari draws text before they're ready otherwise).
      window.setTimeout(() => {
        resolve(img)
        URL.revokeObjectURL(url)
      }, 120)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('The seating plan couldn’t be turned into a picture.'))
    }
    img.src = url
  })
}

/** Saves a blob as a file. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('TOO_BIG'))), type, quality),
  )
}

/** A one-page PDF holding a JPEG, sized so the picture prints at `dpi`. */
export async function jpegPdf(jpeg: Blob, pxWidth: number, pxHeight: number, dpi = 300): Promise<Blob> {
  const bytes = new Uint8Array(await jpeg.arrayBuffer())
  const w = +((pxWidth * 72) / dpi).toFixed(2)
  const h = +((pxHeight * 72) / dpi).toFixed(2)
  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  const offsets: number[] = []
  let length = 0
  const push = (p: Uint8Array | string) => {
    const b = typeof p === 'string' ? enc.encode(p) : p
    parts.push(b)
    length += b.length
  }
  const obj = (n: number, body: string) => {
    offsets[n] = length
    push(`${n} 0 obj\n${body}\nendobj\n`)
  }
  push('%PDF-1.4\n%âãÏÓ\n')
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>')
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`)
  offsets[4] = length
  push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pxWidth} /Height ${pxHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`)
  push(bytes)
  push('\nendstream\nendobj\n')
  const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
  const xref = length
  push(`xref\n0 6\n0000000000 65535 f \n${[1, 2, 3, 4, 5].map((n) => `${String(offsets[n]).padStart(10, '0')} 00000 n \n`).join('')}`)
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  return new Blob(parts as BlobPart[], { type: 'application/pdf' })
}
