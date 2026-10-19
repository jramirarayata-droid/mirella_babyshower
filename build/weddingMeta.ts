import type { Plugin } from 'vite'

/**
 * Build-time link preview (Open Graph) tags.
 *
 * Messenger, Viber and Facebook don't run JavaScript when they build a link
 * preview, so the baby's name, the parents' names, the date, intro and hero
 * photo are fetched from the public settings row (wedding_settings) at build
 * time and written into index.html. Cloudflare rebuilds on every push to main;
 * the daily refresh workflow asks it to rebuild once a day.
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
  const meta: Meta = { title: 'Baby Shower', description: 'A little one is on the way — join us to celebrate!', image: '', couple: '', date: '' }
  if (!supabaseUrl || !anonKey) return meta
  const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' }
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/wedding_settings?select=couple_names,baby_name,wedding_date,story_text,hero_image_url&limit=1`, {
      headers,
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) {
      const [s] = (await res.json()) as { couple_names?: string; baby_name?: string; wedding_date?: string; story_text?: string; hero_image_url?: string }[]
      if (s?.baby_name || s?.couple_names) {
        const baby = s.baby_name?.trim() || 'Baby'
        meta.couple = baby
        meta.date = longDate(s.wedding_date)
        meta.title = `${baby} · Baby Shower${meta.date ? ` · ${meta.date}` : ''}`
        meta.description =
          s.story_text?.trim() || `Join ${s.couple_names?.trim() || 'us'} for a baby shower${meta.date ? ` on ${meta.date}` : ''}. Kindly RSVP.`
        meta.image = s.hero_image_url ? previewImage(s.hero_image_url) : ''
      }
    } else {
      console.warn(`[site-meta] settings request failed: ${res.status}`)
    }
  } catch (e) {
    console.warn('[site-meta] could not load settings, using defaults', e)
  }
  // The invitation-style preview image made in the admin (Share & QR → Link preview).
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/public_display_prefs`, { method: 'POST', headers, body: '{}', signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      const prefs = (await res.json()) as { sharePreviewUrl?: string | null }
      if (prefs?.sharePreviewUrl) meta.image = prefs.sharePreviewUrl
    }
  } catch (e) {
    console.warn('[site-meta] could not load the preview image', e)
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
  const title = meta.couple ? `You’re invited · ${meta.couple}’s Baby Shower${meta.date ? ` · ${meta.date}` : ''}` : 'You’re invited to a baby shower'
  // No og:url here: Messenger opens whatever og:url says when the preview card is
  // tapped, so it must stay each guest's own link (…/i/?c=<code>). A visit without
  // a code (e.g. an old preview card) goes to the baby shower website instead.
  const go = "(function (c) { return c ? '../#/i/' + encodeURIComponent(c) : '../' })(new URLSearchParams(location.search).get('c') || '')"
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${esc(title)}</title>
    <meta name="description" content="Tap to open your personal baby shower invitation." />
    ${ogTags({ title, description: 'Tap to open your personal baby shower invitation.', image: meta.image })}
    <script>location.replace(${go})</script>
  </head>
  <body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:Georgia,serif;background:#f2f7fc;color:#25344d">
    <p>Opening your invitation… <a id="go" href="../" style="color:#8a6e45">Continue</a></p>
    <script>document.getElementById('go').href = ${go}</script>
  </body>
</html>
`
}

/** The site's root is the sign-in & plans page: its preview describes the service. */
const DEFAULT_SITE = 'https://mirella-babyshower.mirandella.workers.dev/'
function mainPageMeta(siteUrl?: string) {
  const base = (siteUrl || DEFAULT_SITE).replace(/\/?$/, '/')
  return {
    title: 'Baby Shower Websites · A soft little website for your baby shower',
    description: 'Invitations, RSVPs, a gift wishlist, guessing games and a gender reveal — all in one gentle place your guests open on their phones. Plans from ₱999.',
    image: `${base}og-main.png`,
    url: base,
  }
}

export function weddingMeta({ supabaseUrl, anonKey, siteUrl }: Options): Plugin {
  let meta: Meta | null = null
  const get = async () => (meta ??= await loadMeta(supabaseUrl, anonKey))
  return {
    name: 'site-meta',
    async transformIndexHtml(html) {
      // Each shower's own address (/<slug>/) gets its own preview from the Worker (worker/index.js).
      const m = mainPageMeta(siteUrl)
      const tags = [`<title>${esc(m.title)}</title>`, `<meta name="description" content="${esc(m.description)}" />`, ogTags(m)].join('\n    ')
      return html.replace('<!-- wedding-meta -->', tags)
    },
    async generateBundle() {
      // Old invitation links (/i/?c=…) belong to the original shower.
      this.emitFile({ type: 'asset', fileName: 'i/index.html', source: sharePage(await get()) })
      // For the Worker: where to read each shower's preview. The same public values the website's own code uses.
      if (supabaseUrl && anonKey) this.emitFile({ type: 'asset', fileName: 'site-config.json', source: JSON.stringify({ supabaseUrl, anonKey }) })
    },
  }
}
