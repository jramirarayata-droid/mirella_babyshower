import type { Plugin } from 'vite'

/**
 * Build-time link preview (Open Graph) tags.
 *
 * Messenger, Viber and Facebook don't run JavaScript when they build a link
 * preview, so the couple's names, date, intro and hero photo are fetched from
 * the public wedding_settings row at build time and written into index.html.
 * The GitHub workflow rebuilds on every push and once a day.
 */
interface Options {
  supabaseUrl?: string
  anonKey?: string
  siteUrl?: string
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function longDate(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  if (!m) return ''
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function previewImage(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname === 'images.unsplash.com') {
      u.searchParams.set('w', '1200')
      u.searchParams.set('h', '630')
      u.searchParams.set('fit', 'crop')
      u.searchParams.set('q', '80')
    }
    return u.toString()
  } catch {
    return ''
  }
}

interface Meta {
  title: string
  description: string
  image: string
  couple: string
  date: string
}

async function loadMeta(supabaseUrl?: string, anonKey?: string): Promise<Meta> {
  const meta: Meta = { title: 'Our Wedding', description: 'With joyful hearts, we invite you to celebrate with us.', image: '', couple: '', date: '' }
  if (!supabaseUrl || !anonKey) return meta
  const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' }
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/wedding_settings?select=couple_names,wedding_date,story_text,hero_image_url&limit=1`, {
      headers,
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) {
      const [s] = (await res.json()) as { couple_names?: string; wedding_date?: string; story_text?: string; hero_image_url?: string }[]
      if (s?.couple_names) {
        meta.couple = s.couple_names
        meta.date = longDate(s.wedding_date)
        meta.title = meta.date ? `${s.couple_names} · ${meta.date}` : s.couple_names
        meta.description = s.story_text?.trim() || `${s.couple_names} are getting married${meta.date ? ` on ${meta.date}` : ''}. Kindly RSVP.`
        meta.image = s.hero_image_url ? previewImage(s.hero_image_url) : ''
      }
    } else {
      console.warn(`[wedding-meta] settings request failed: ${res.status}`)
    }
  } catch (e) {
    console.warn('[wedding-meta] could not load settings, using defaults', e)
  }
  // The invitation-style preview image made in the admin (Share & QR → Link preview).
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/public_display_prefs`, { method: 'POST', headers, body: '{}', signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      const prefs = (await res.json()) as { sharePreviewUrl?: string | null }
      if (prefs?.sharePreviewUrl) meta.image = prefs.sharePreviewUrl
    }
  } catch (e) {
    console.warn('[wedding-meta] could not load the preview image', e)
  }
  return meta
}

function ogTags(m: { title: string; description: string; image: string; url?: string }): string {
  return [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${esc(m.title)}" />`,
    `<meta property="og:description" content="${esc(m.description)}" />`,
    m.url ? `<meta property="og:url" content="${esc(m.url)}" />` : '',
    m.image ? `<meta property="og:image" content="${esc(m.image)}" />` : '',
    m.image ? `<meta property="og:image:width" content="1200" />` : '',
    m.image ? `<meta property="og:image:height" content="630" />` : '',
    `<meta name="twitter:card" content="${m.image ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${esc(m.title)}" />`,
    `<meta name="twitter:description" content="${esc(m.description)}" />`,
    m.image ? `<meta name="twitter:image" content="${esc(m.image)}" />` : '',
  ]
    .filter(Boolean)
    .join('\n    ')
}

/**
 * The invitation share page (/i/?c=<code>): its own preview ("You're invited ·
 * names · date") for Messenger, which ignores everything after "#"; then it
 * forwards the guest to their invitation in the app.
 */
function sharePage(meta: Meta): string {
  const title = meta.couple ? `You’re invited · ${meta.couple}${meta.date ? ` · ${meta.date}` : ''}` : 'You’re invited'
  // No og:url here: Messenger opens whatever og:url says when the preview card is
  // tapped, so it must stay each guest's own link (…/i/?c=<code>). A visit without
  // a code (e.g. an old preview card) goes to the wedding website instead.
  const go = "(function (c) { return c ? '../#/i/' + encodeURIComponent(c) : '../' })(new URLSearchParams(location.search).get('c') || '')"
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${esc(title)}</title>
    <meta name="description" content="Tap to open your personal wedding invitation." />
    ${ogTags({ title, description: 'Tap to open your personal wedding invitation.', image: meta.image })}
    <script>location.replace(${go})</script>
  </head>
  <body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:Georgia,serif;background:#faf7f2;color:#2b2a28">
    <p>Opening your invitation… <a id="go" href="../" style="color:#8a6e45">Continue</a></p>
    <script>document.getElementById('go').href = ${go}</script>
  </body>
</html>
`
}

export function weddingMeta({ supabaseUrl, anonKey, siteUrl }: Options): Plugin {
  let meta: Meta | null = null
  const get = async () => (meta ??= await loadMeta(supabaseUrl, anonKey))
  return {
    name: 'wedding-meta',
    async transformIndexHtml(html) {
      const m = await get()
      const tags = [`<title>${esc(m.title)}</title>`, `<meta name="description" content="${esc(m.description)}" />`, ogTags({ ...m, url: siteUrl })].join('\n    ')
      return html.replace('<!-- wedding-meta -->', tags)
    },
    async generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'i/index.html', source: sharePage(await get()) })
    },
  }
}
