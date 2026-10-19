/*
 * Link previews for each baby shower.
 *
 * Messenger, Viber and Facebook don't run JavaScript, so they only see the
 * <meta> tags in the HTML. The built index.html carries the main page's
 * preview (Baby Shower Websites). For a shower's own address — /<slug>/ — this
 * Worker swaps in that shower's name, date, intro and preview image, read from
 * the database with the same public key the website itself uses. Its personal
 * invitation links (/<slug>/i/?c=<code>) get an invitation preview and then
 * open the invitation. Everything else is served as before.
 */

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/
const RESERVED = new Set(['assets', 'i', 'sw.js', 'favicon.svg'])
const CACHE_SECONDS = 600

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function longDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  if (!m) return ''
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

async function siteConfig(env, origin) {
  try {
    const res = await env.ASSETS.fetch(new Request(`${origin}/site-config.json`))
    if (res.ok) return await res.json()
  } catch {
    /* no config: previews stay as built */
  }
  return null
}

/** The shower's preview (title, description, image), or null if there is no such open shower. */
async function showerMeta(slug, env, origin, ctx) {
  const cacheKey = new Request(`${origin}/__meta/${slug}`)
  const cache = caches.default
  const hit = await cache.match(cacheKey)
  if (hit) return hit.json()

  const cfg = await siteConfig(env, origin)
  if (!cfg?.supabaseUrl || !cfg?.anonKey) return null
  const headers = { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}`, 'Content-Type': 'application/json', 'x-space': slug }
  let meta = null
  try {
    const space = await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/space_here`, { method: 'POST', headers, body: '{}' }).then((r) => (r.ok ? r.json() : null))
    if (space?.exists && space.open) {
      const [s] = await fetch(`${cfg.supabaseUrl}/rest/v1/wedding_settings?select=couple_names,baby_name,wedding_date,story_text,hero_image_url&limit=1`, { headers }).then((r) => (r.ok ? r.json() : []))
      const prefs = await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/public_display_prefs`, { method: 'POST', headers, body: '{}' }).then((r) => (r.ok ? r.json() : null))
      const baby = s?.baby_name?.trim() || space.title || 'Baby'
      const date = longDate(s?.wedding_date)
      meta = {
        baby,
        date,
        title: `${baby} · Baby Shower${date ? ` · ${date}` : ''}`,
        description: s?.story_text?.trim() || `Join ${s?.couple_names?.trim() || 'us'} for a baby shower${date ? ` on ${date}` : ''}. Kindly RSVP.`,
        image: prefs?.sharePreviewUrl || s?.hero_image_url || '',
      }
    }
  } catch {
    meta = null
  }
  ctx.waitUntil(cache.put(cacheKey, new Response(JSON.stringify(meta), { headers: { 'Cache-Control': `max-age=${CACHE_SECONDS}` } })))
  return meta
}

/** Replaces the built preview tags with the shower's own. */
function withMeta(res, m, url) {
  const tags = {
    'og:title': m.title,
    'og:description': m.description,
    'og:url': url,
    'og:image': m.image,
    'twitter:title': m.title,
    'twitter:description': m.description,
    'twitter:image': m.image,
  }
  const set = (el, key) => {
    if (key in tags) {
      if (tags[key]) el.setAttribute('content', tags[key])
      else el.remove()
    }
  }
  let imageSeen = false
  return new HTMLRewriter()
    .on('title', { element: (el) => el.setInnerContent(m.title) })
    .on('meta[name="description"]', { element: (el) => el.setAttribute('content', m.description) })
    .on('meta[property]', {
      element: (el) => {
        const k = el.getAttribute('property')
        if (k === 'og:image') imageSeen = true
        set(el, k)
      },
    })
    .on('meta[name^="twitter:"]', { element: (el) => set(el, el.getAttribute('name')) })
    .on('head', {
      element: (el) =>
        el.onEndTag((end) => {
          // The main page may have been built without an image: add the shower's.
          if (!imageSeen && m.image) end.before(`<meta property="og:image" content="${esc(m.image)}" />`, { html: true })
        }),
    })
    .transform(res)
}

/** Personal invitation link: an invitation preview, then on to the invitation. */
function invitePage(slug, code, m) {
  const target = code ? `/${slug}/#/i/${encodeURIComponent(code)}` : `/${slug}/`
  const title = m ? `You’re invited · ${m.baby}’s Baby Shower${m.date ? ` · ${m.date}` : ''}` : 'You’re invited to a baby shower'
  const desc = 'Tap to open your personal baby shower invitation.'
  const image = m?.image ? `<meta property="og:image" content="${esc(m.image)}" />\n<meta property="og:image:width" content="1200" />\n<meta property="og:image:height" content="630" />` : ''
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="robots" content="noindex" />
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}" />
<meta property="og:type" content="website" /><meta property="og:title" content="${esc(title)}" /><meta property="og:description" content="${esc(desc)}" />
${image}
<meta name="twitter:card" content="${m?.image ? 'summary_large_image' : 'summary'}" />
<script>location.replace(${JSON.stringify(target)})</script></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:Georgia,serif;background:#f2f7fc;color:#25344d">
<p>Opening your invitation… <a href="${esc(target)}" style="color:#8a6e45">Continue</a></p></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' } },
  )
}

export default {
  async fetch(request, env, ctx) {
    try {
      return await handle(request, env, ctx)
    } catch {
      // Never let a preview problem take the site down: serve the files as they are.
      return env.ASSETS.fetch(request)
    }
  },
}

async function handle(request, env, ctx) {
    const url = new URL(request.url)
    const parts = url.pathname.split('/').filter(Boolean)
    const slug = parts[0]?.toLowerCase() ?? ''
    const isShower = request.method === 'GET' && SLUG_RE.test(slug) && !RESERVED.has(slug) && !slug.includes('.')

    if (isShower && parts[1] === 'i') {
      const m = await showerMeta(slug, env, url.origin, ctx)
      return invitePage(slug, url.searchParams.get('c') ?? '', m)
    }

    const res = await env.ASSETS.fetch(request)
    // Only the shower's page itself (/<slug>/ — the app), not its files.
    if (!isShower || parts.length > 1 || !(res.headers.get('content-type') ?? '').includes('text/html')) return res
    const m = await showerMeta(slug, env, url.origin, ctx)
    if (!m) return res
    return withMeta(res, m, `${url.origin}/${slug}/`)
}
