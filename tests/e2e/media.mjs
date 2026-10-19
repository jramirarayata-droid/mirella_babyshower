// End-to-end check of guest photos and music against a mocked Supabase.
// Run in CI (.github/workflows/e2e.yml): build against https://mock.supabase.test, serve dist,
// then `node tests/e2e/media.mjs http://localhost:4173/`.
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const BASE = process.argv[2]
const OUT = process.argv[3] ?? '/tmp'
const API = 'https://mock.supabase.test'
const results = []
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

// ------------------------------------------------------------------ test media
function wav(seconds = 24, rate = 22050) {
  const n = seconds * rate
  const buf = Buffer.alloc(44 + n * 2)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28)
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40)
  const notes = [262, 330, 392, 523]
  for (let i = 0; i < n; i++) {
    const t = i / rate
    const f = notes[Math.floor(t) % 4]
    const env = 0.3 + 0.7 * Math.abs(Math.sin(t * 0.7))
    buf.writeInt16LE(Math.round(Math.sin(2 * Math.PI * f * t) * 9000 * env), 44 + i * 2)
  }
  return buf
}
const SONG = wav()

// ------------------------------------------------------------------ mock backend
const HOST_TOKEN = 'host-tok-1234567890123456789012345'
const store = { files: new Map(), photos: [], slots: new Map(), sessions: new Set(), prefs: {}, mediaOrder: [], settingsPatches: [] }
store.prefs.music = { enabled: true, url: `${API}/storage/v1/object/public/wedding-assets/music/song.wav`, path: 'music/song.wav', title: 'Test song', duration: 24, start: 2, end: 20, fadeIn: 1, fadeOut: 2, loop: true, volume: 0.5, pages: ['home', 'invite', 'photos'] }
store.prefs.guest_photos = { mode: 'visible', approval: 'instant', perGuest: 25, total: 1500, title: 'Shared by our guests', subtitle: 'Test', style: 'polaroid' }
store.prefs.schedule = { revealAt: '2026-12-19T09:00:00.000Z' }

async function handle(route) {
  const req = route.request()
  const url = new URL(req.url())
  const p = url.pathname
  const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  const body = () => {
    try { return JSON.parse(req.postData() || '{}') } catch { return {} }
  }
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
  const cors = { 'access-control-allow-origin': '*' }

  if (p.startsWith('/rest/v1/rpc/')) {
    const fn = p.slice('/rest/v1/rpc/'.length)
    const a = body()
    switch (fn) {
      case 'is_admin': return json(true)
      case 'public_display_prefs': return json({ card: {}, website: {}, sharePreviewUrl: null, raffleVisible: false, monogram: store.monogram ?? null })
      case 'public_music': return json({ ...store.prefs.music })
      case 'guest_photos_info': return json({ visible: true, open: true, approval: 'instant', perGuest: 25, title: 'Shared by our guests', subtitle: 'Test', style: store.prefs.guest_photos.style ?? 'classic', count: store.photos.length })
      case 'suggest_guest_name': return json(/^rina gasp/i.test(a.search_name ?? '') ? 'Rina Gaspar' : null)
      case 'guest_photo_start': {
        if (!/^\s*rina gaspar\s*$/i.test(a.p_name ?? '')) return json({ ok: false, reason: 'not_found' })
        store.sessions.add('tok-123456789012345678901234567890')
        return json({ ok: true, token: 'tok-123456789012345678901234567890', name: 'Rina Gaspar' })
      }
      case 'guest_photo_left': return json({ ok: true, open: true, left: 25 - store.photos.length, mine: store.photos.length, full: false, name: 'Rina Gaspar' })
      case 'guest_photo_mine': return json(store.photos.map((x) => ({ id: x.id, thumb: x.thumb, path: x.path, status: 'visible' })))
      case 'guest_photo_reserve': {
        const slots = Array.from({ length: Math.min(10, a.p_count) }, (_, i) => {
          const id = `00000000-0000-4000-8000-${String(Date.now() % 1e9).padStart(9, '0')}${String(i).padStart(3, '0')}`
          const s = { id, path: `p/${id}.jpg`, thumb: `t/${id}.jpg` }
          store.slots.set(id, s)
          return s
        })
        return json({ ok: true, slots })
      }
      case 'guest_photo_confirm': {
        let added = 0
        for (const id of a.p_ids) {
          const s = store.slots.get(id)
          if (s && store.files.has(s.path) && store.files.has(s.thumb)) {
            store.photos.unshift({ ...s, by: 'Rina G.', at: new Date(Date.now() + added).toISOString(), uploader_name: 'Rina Gaspar' })
            added++
          }
        }
        return json({ ok: true, added, status: 'visible' })
      }
      case 'guest_photo_list': {
        const list = store.photos.filter((x) => !a.p_before || x.at < a.p_before).slice(0, a.p_limit ?? 60)
        return json(list.map((x) => ({ id: x.id, path: x.path, thumb: x.thumb, by: x.by, at: x.at })))
      }
      case 'host_check': return json({ host: a.p_token === HOST_TOKEN, codeOn: true })
      case 'host_code_login': return json(a.p_pin === '1234' ? { ok: true, token: HOST_TOKEN } : { ok: false, reason: 'wrong', left: 9 })
      default: return json(null)
    }
  }
  if (p.endsWith('/wedding-assets/monogram/test.svg')) {
    return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'image/svg+xml' }, body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120"><ellipse cx="50" cy="60" rx="46" ry="56" fill="none" stroke="#000" stroke-width="5"/><text x="50" y="78" font-size="52" text-anchor="middle" font-family="serif">ME</text></svg>' })
  }
  if (p.startsWith('/storage/v1/object/public/')) {
    const key = p.replace(/^\/storage\/v1\/object\/public\/[^/]+\//, '')
    if (key === 'music/song.wav') {
      const range = req.headers()['range']
      if (range) {
        const m = /bytes=(\d+)-(\d*)/.exec(range)
        const start = Number(m[1])
        const end = m[2] ? Number(m[2]) : SONG.length - 1
        return route.fulfill({ status: 206, headers: { ...cors, 'content-type': 'audio/wav', 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${SONG.length}` }, body: SONG.subarray(start, end + 1) })
      }
      return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'audio/wav', 'accept-ranges': 'bytes' }, body: SONG })
    }
    const f = store.files.get(key)
    return f ? route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'image/jpeg' }, body: f }) : route.fulfill({ status: 404, headers: cors })
  }
  if (p.startsWith('/storage/v1/object/guest-photos/') && req.method() === 'POST') {
    const key = p.slice('/storage/v1/object/guest-photos/'.length)
    // supabase-js sends a Blob as multipart form data: keep just the JPEG inside.
    const raw = req.postDataBuffer()
    const soi = raw.indexOf(Buffer.from([0xff, 0xd8, 0xff]))
    const eoi = raw.lastIndexOf(Buffer.from([0xff, 0xd9]))
    const data = soi >= 0 && eoi > soi ? raw.subarray(soi, eoi + 2) : raw
    store.files.set(key, data)
    return json({ Key: `guest-photos/${key}`, Id: key })
  }
  if (p.startsWith('/rest/v1/admin_preferences')) {
    const k = url.searchParams.get('key')?.replace(/^eq\./, '')
    const row = k && store.prefs[k] ? { value: store.prefs[k] } : null
    if (req.method() !== 'GET') return json(null, 201)
    const accept = req.headers()['accept'] ?? ''
    return accept.includes('vnd.pgrst.object') ? (row ? json(row) : json({ message: 'none' }, 406)) : json(row ? [row] : [])
  }
  if (p.startsWith('/rest/v1/guest_photos')) {
    return json(store.photos.map((x) => ({ id: x.id, uploader_name: x.uploader_name, path: x.path, thumb_path: x.thumb, bytes: (store.files.get(x.path)?.length ?? 0) + (store.files.get(x.thumb)?.length ?? 0), status: 'visible', created_at: x.at })))
  }
  if (p.startsWith('/rest/v1/gallery_images')) {
    const rows = store.photos.slice(-3).map((x, i) => ({ id: `gal-${i}`, image_url: `${API}/storage/v1/object/public/guest-photos/${x.path}`, thumb_url: i === 0 ? `${API}/storage/v1/object/public/guest-photos/${x.thumb}` : null, caption: i === 0 ? 'Where it all began' : null, sort_order: i + 1, is_visible: true, section_id: null }))
    return json(rows)
  }
  if (p.startsWith('/auth/v1/user')) return json({ id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'admin@test' })
  if (p.startsWith('/rest/v1/wedding_settings')) {
    const row = { id: 'ws1', couple_names: 'Juan & Maria Santos', baby_name: 'Baby Santos', wedding_date: '2027-03-13', rsvp_open: true, rsvp_button_label: 'RSVP', seating_config: { finder: { from: null, mode: 'visible', preassign: false } }, entourage: [], sections: [], motif_colors: [], gallery_visible: true, gallery_title: 'Our Story', video_visible: true, video_title: 'Our Prenup Film', video_url: 'samples/video/prenup-sample.mp4', media_order: store.mediaOrder, rsvp_config: { builtins: {}, teaser: { enabled: true, title: 'Confirm your attendance for a chance to win', highlight: 'up to ₱25,000', note: 'in our wedding raffle, drawn at the reception — be there to win!' } } }
    const accept = req.headers()['accept'] ?? ''
    if (req.method() === 'PATCH') {
      const body = JSON.parse(req.postData() || '{}')
      store.settingsPatches.push(body)
      if (Array.isArray(body.media_order)) store.mediaOrder = body.media_order
    }
    if (req.method() !== 'GET') return json(null, 204)
    return accept.includes('vnd.pgrst.object') ? json(row) : json([row])
  }
  if (p.startsWith('/rest/v1/')) {
    const accept = req.headers()['accept'] ?? ''
    return accept.includes('vnd.pgrst.object') ? json({ message: 'none' }, 406) : json([])
  }
  return json({})
}

const browser = await chromium.launch({ args: ['--autoplay-policy=user-gesture-required'] })
const shots = []
try {
  // ---------------------------------------------------------------- make 3 big photos (4000×3000)
  const maker = await browser.newPage()
  const photos = await maker.evaluate(async () => {
    const out = []
    for (const [a, b] of [['#c08a7d', '#2b2a28'], ['#8fa68a', '#e9dfcc'], ['#7f93a8', '#fffdf9']]) {
      const c = document.createElement('canvas')
      c.width = 4000; c.height = 3000
      const g = c.getContext('2d')
      const gr = g.createLinearGradient(0, 0, 4000, 3000); gr.addColorStop(0, a); gr.addColorStop(1, b)
      g.fillStyle = gr; g.fillRect(0, 0, 4000, 3000)
      for (let i = 0; i < 3000; i++) { g.fillStyle = `hsl(${i % 360} 60% 60% / .3)`; g.fillRect(Math.random() * 4000, Math.random() * 3000, 40, 40) }
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.95))
      out.push(Array.from(new Uint8Array(await blob.arrayBuffer())))
    }
    return out
  })
  await maker.close()
  const files = photos.map((arr, i) => {
    const path = `/tmp/guest-${i + 1}.jpg`
    writeFileSync(path, Buffer.from(arr))
    return path
  })
  ok('fixtures', true, files.map((f, i) => `${f} ${(photos[i].length / 1048576).toFixed(1)} MB`).join(', '))

  // ---------------------------------------------------------------- guest photos page (phone size)
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  await ctx.route(`${API}/**`, handle)
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(`${BASE}#/photos`)
  await page.getByRole('heading', { name: 'Share your photos' }).waitFor({ timeout: 15000 })
  ok('photos page asks for name', true)
  shots.push(['photos-name', await page.screenshot({ fullPage: false })])

  await page.getByLabel(/your full name/i).fill('Someone Else')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByText(/couldn’t find that name/i).waitFor({ timeout: 5000 })
  ok('unknown name is refused', true)

  await page.getByLabel(/your full name/i).fill('Rina Gaspr')
  await page.getByRole('button', { name: 'Continue' }).click()
  const didYouMean = page.getByRole('button', { name: 'Rina Gaspar' })
  await didYouMean.waitFor({ timeout: 5000 })
  ok('“Did you mean …?” offers the close name', true)
  shots.push(['photos-did-you-mean', await page.screenshot({ fullPage: false })])
  await didYouMean.click()
  await page.getByText(/Hi\s+Rina/).first().waitFor({ timeout: 5000 })
  ok('known name starts a session', true)
  ok('the phone remembers the guest', await page.evaluate(() => (JSON.parse(localStorage.getItem('wedding-guest') ?? 'null') ?? {}).name === 'Rina Gaspar'))

  // the labelled Menu
  await page.getByRole('button', { name: 'Menu' }).click()
  const menu = page.getByRole('dialog', { name: 'Menu' })
  await menu.waitFor({ timeout: 5000 })
  await page.waitForTimeout(500)
  const items = await menu.locator('li').allInnerTexts()
  ok('menu lists pages by name', items.some((t) => /Shower details/.test(t)) && items.some((t) => /Photos/.test(t)), items.map((t) => t.split('\n')[0]).join(', '))
  ok('menu greets the remembered guest', await menu.getByText(/Hi\s*Rina/).isVisible())
  shots.push(['menu', await page.screenshot({ fullPage: false })])
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)

  // music button should be showing on this page (photos is in the pages list)
  const musicBtn = page.locator('[data-music-button]')
  ok('music button shows on photos page', await musicBtn.isVisible(), await musicBtn.textContent())

  await page.locator('#guest-photo-input').setInputFiles(files)
  await page.getByText(/Thank you! 3 photos added/).waitFor({ timeout: 30000 })
  ok('3 photos uploaded', true)
  // The glow on just-shared photos lasts 7 s: check it straight away (the checks below take a while).
  await page.locator('#photo-wall [class*="color-champagne"]').first().waitFor({ timeout: 6000 }).catch(() => undefined)
  const glowing = await page.locator('#photo-wall [class*="color-champagne"]').count()
  await page.waitForTimeout(700)
  const petalCount = await page.locator('div.fixed.inset-0.pointer-events-none span').count()
  ok('petals fall after sharing', petalCount > 10, `${petalCount} petals`)
  shots.push(['photos-petals', await page.screenshot({ fullPage: false })])
  const full = [...store.files.entries()].filter(([k]) => k.startsWith('p/'))
  const thumbs = [...store.files.entries()].filter(([k]) => k.startsWith('t/'))
  const dims = await page.evaluate(async (arrs) => {
    const out = []
    for (const a of arrs) {
      const bmp = await createImageBitmap(new Blob([new Uint8Array(a)], { type: 'image/jpeg' }))
      out.push(`${bmp.width}x${bmp.height}`)
    }
    return out
  }, [...full.map(([, v]) => Array.from(v)), ...thumbs.map(([, v]) => Array.from(v))])
  ok(
    'photos were shrunk',
    full.every(([, v]) => v.length < 1.5 * 1048576) && dims.slice(0, 3).every((d) => d === '2048x1536') && dims.slice(3).every((d) => d === '480x360'),
    `full ${full.map(([, v]) => Math.round(v.length / 1024) + ' KB').join(', ')}; thumbs ${thumbs.map(([, v]) => Math.round(v.length / 1024) + ' KB').join(', ')}; sizes ${dims.join(', ')}`,
  )

  // the music should have started on the first tap (Continue) — check the button
  await page.waitForTimeout(1500)
  ok('music started on first tap', /music on/i.test(await musicBtn.textContent()), await musicBtn.textContent())
  await musicBtn.click()
  await page.waitForTimeout(1000)
  ok('music button turns it off', /music off/i.test(await musicBtn.textContent()), await musicBtn.textContent())

  await page.waitForTimeout(800)
  const wallTiles = page.locator('#photo-wall').getByRole('button', { name: /^Photo by Rina/ })
  ok('gallery shows the 3 photos', (await wallTiles.count()) === 3, `count ${await wallTiles.count()}`)
  ok('polaroid style: white frames with the name', (await page.locator('#photo-wall button.bg-white').count()) === 3)
  ok('new photos are highlighted', glowing >= 3, `${glowing}`)
  ok('guests see no slideshow / present button', (await page.getByText(/Present on the big screen|Slideshow/).count()) === 0)
  shots.push(['photos-after', await page.screenshot({ fullPage: true })])
  await wallTiles.nth(1).click()
  await page.getByRole('dialog').waitFor({ timeout: 5000 })
  ok('photo opens full screen', true)
  shots.push(['photos-lightbox', await page.screenshot()])
  await page.keyboard.press('Escape')

  // lots of photos: a masonry strip you swipe; batches of 30 as you go, never all at once
  const real = store.photos.slice()
  for (let i = 0; i < 100; i++) {
    const r = real[i % real.length]
    store.photos.push({ ...r, id: `bulk-${String(i).padStart(3, '0')}`, by: ['Mara Cruz', 'Ben Santos', 'Lia Reyes'][i % 3], at: new Date(Date.now() - 86400000 - i * 60000).toISOString() })
  }
  await page.reload()
  const strip = page.locator('#photo-wall [role="region"]')
  await strip.waitFor({ timeout: 15000 })
  await page.waitForTimeout(1200)
  const first = await page.locator('#photo-wall').getByRole('button', { name: /^Photo by/ }).count()
  ok('first batch only', first === 30, `${first} photos on the page`)
  await strip.scrollIntoViewIfNeeded()
  const visibleTiles = await strip.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return [...el.querySelectorAll('button')].filter((b) => {
      const x = b.getBoundingClientRect()
      return x.right > r.left + 4 && x.left < r.right - 4
    }).length
  })
  ok('several photos in one view (masonry)', visibleTiles >= 3, `${visibleTiles} photos in view`)
  shots.push(['photos-masonry', await page.screenshot({ fullPage: false })])
  for (let k = 0; k < 6; k++) {
    await strip.evaluate((el) => el.scrollBy({ left: el.clientWidth, behavior: 'auto' }))
    await page.waitForTimeout(450)
  }
  shots.push(['photos-masonry-scrolled', await page.screenshot({ fullPage: false })])
  await strip.evaluate((el) => el.scrollTo({ left: el.scrollWidth, behavior: 'auto' }))
  await page.waitForTimeout(2500)
  const after = await page.locator('#photo-wall').getByRole('button', { name: /^Photo by/ }).count()
  ok('next batch loads near the end', after >= 60, `${after} photos after swiping to the end`)

  // the home page shows the same masonry strip
  await page.goto(`${BASE}#/`)
  const homeStrip = page.locator('section[aria-labelledby="guest-photos-heading"] [role="region"]')
  await homeStrip.waitFor({ timeout: 15000 })
  await homeStrip.scrollIntoViewIfNeeded()
  await page.waitForTimeout(1500)
  ok('home: shared photos as a swipe strip', (await homeStrip.getByRole('button', { name: /^Photo by/ }).count()) === 30)
  shots.push(['home-photos', await page.screenshot({ fullPage: false })])
  store.photos.splice(real.length)

  // RSVP'd as someone else on this phone: the photo session follows the new name
  await page.evaluate(() => {
    localStorage.setItem('wedding-photo-guest', JSON.stringify({ token: 'tok-old-000000000000000000000000000', name: 'Old Name' }))
    localStorage.setItem('wedding-guest', JSON.stringify({ name: 'Rina Gaspar' }))
  })
  await page.goto(`${BASE}#/photos`)
  await page.getByText(/Hi\s+Rina/).first().waitFor({ timeout: 10000 })
  ok('photos follow the new name after an RSVP under another name', (await page.getByText(/Hi\s+Old/).count()) === 0)

  // a second visit: the remembered guest goes straight in (no name question)
  await page.evaluate(() => localStorage.removeItem('wedding-photo-guest'))
  await page.goto(`${BASE}#/`)
  await page.goto(`${BASE}#/photos`)
  await page.getByText(/Hi\s+Rina/).first().waitFor({ timeout: 10000 })
  ok('remembered guest skips the name question', (await page.getByRole('heading', { name: 'Share your photos' }).count()) === 0)

  // guests: no Raffle in the menu; "Host mode" instead, which unlocks with the code and shows the host's tools
  await page.goto(`${BASE}#/photos`)
  await page.getByRole('button', { name: /Menu/ }).first().click()
  const gmenu = page.getByRole('dialog', { name: 'Menu' })
  await gmenu.getByText('Host mode').waitFor({ timeout: 5000 })
  ok('menu: no Raffle for guests, Host mode instead', (await gmenu.getByText('Raffle', { exact: true }).count()) === 0)
  await page.waitForTimeout(400)
  shots.push(['menu-guest', await page.screenshot({ fullPage: false })])
  await gmenu.getByText('Host mode').click()
  await page.locator('#host-code').waitFor({ timeout: 5000 })
  shots.push(['host-code', await page.screenshot({ fullPage: false })])
  await page.locator('#host-code').fill('1234')
  const unlocked = page.getByRole('dialog', { name: 'Menu' }).getByText('Present guest photos')
  await unlocked.waitFor({ timeout: 8000 })
  ok('after the code, the menu shows the host tools', true)
  await page.waitForTimeout(500)
  shots.push(['menu-host-unlocked', await page.screenshot({ fullPage: false })])
  await page.getByRole('dialog', { name: 'Menu' }).getByText('Leave').click()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)

  // the presentation is for the host only: guests are asked for the host code
  await page.goto(`${BASE}#/photos/show`)
  await page.getByText('Type the host code to present').waitFor({ timeout: 15000 })
  ok('old slideshow link asks for the host code', true)
  shots.push(['present-gate', await page.screenshot({ fullPage: false })])
  await page.locator('#host-code').fill('9999')
  await page.getByText(/isn’t right/).waitFor({ timeout: 5000 })
  ok('wrong host code is refused', true)
  await page.locator('#host-code').fill('1234')
  await page.getByRole('button', { name: /Begin/ }).waitFor({ timeout: 10000 })
  ok('host code opens the presentation', true)
  shots.push(['present-start-phone', await page.screenshot({ fullPage: false })])

  // host mode shows in the menu, with both present buttons
  await page.goto(`${BASE}#/photos`)
  await page.getByRole('button', { name: /Menu/ }).first().click()
  const hmenu = page.getByRole('dialog', { name: 'Menu' })
  await hmenu.getByText('Present guest photos').waitFor({ timeout: 5000 })
  ok('host menu: present guest photos, our photos & videos, raffle', (await hmenu.getByText('Present our photos & videos').count()) === 1 && (await hmenu.getByText('Raffle & Bingo').count()) === 1)
  await page.waitForTimeout(500)
  shots.push(['menu-host', await page.screenshot({ fullPage: false })])
  await page.keyboard.press('Escape')
  ok('host sees the present button on the photos page', await page.getByText('Present on the big screen').isVisible())
  ok('no page errors (photos)', errors.length === 0, errors.join(' | '))
  await ctx.close()

  // ---------------------------------------------------------------- the presentation on a TV-sized screen
  const tctx = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  await tctx.route(`${API}/**`, handle)
  // A stand-in for Supabase Realtime (Phoenix protocol, JSON objects or arrays).
  const live = { joined: false, send: null }
  await tctx.routeWebSocket(/\/realtime\/v1\/websocket/, (ws) => {
    ws.onMessage((raw) => {
      let m
      try { m = JSON.parse(String(raw)) } catch { return }
      const arr = Array.isArray(m)
      const [joinRef, ref, topic, event] = arr ? m : [m.join_ref, m.ref, m.topic, m.event]
      const out = (t, e, payload, r = null, jr = null) => ws.send(JSON.stringify(arr ? [jr, r, t, e, payload] : { topic: t, event: e, payload, ref: r, join_ref: jr }))
      if (event === 'phx_join' || event === 'heartbeat' || event === 'access_token') out(topic, 'phx_reply', { status: 'ok', response: {} }, ref, joinRef)
      if (event === 'phx_join' && topic === 'realtime:guest-photos') {
        live.joined = true
        live.send = (payload) => out(topic, 'broadcast', { type: 'broadcast', event: 'changed', payload }, null, joinRef)
      }
    })
  })
  await tctx.addInitScript((t) => localStorage.setItem('wedding-raffle-host', t), HOST_TOKEN)
  // Record every pass the music loop schedules: [when, offset, duration].
  await tctx.addInitScript(() => {
    window.__passes = []
    const start = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (when = 0, offset = 0, duration) {
      window.__passes.push([when, offset, duration])
      return start.call(this, when, offset, duration)
    }
  })
  const tp = await tctx.newPage()
  const terr = []
  tp.on('pageerror', (e) => terr.push(String(e)))
  await tp.goto(`${BASE}#/present/guests`)
  await tp.getByRole('button', { name: /Begin/ }).waitFor({ timeout: 15000 })
  await tp.waitForTimeout(1500)
  ok('start screen counts the photos', await tp.getByText(/3 photos/).isVisible())
  ok('start screen offers the website music', await tp.getByRole('button', { name: /With our music/ }).isVisible())
  shots.push(['present-guests-start', await tp.screenshot()])
  const root = tp.locator('[data-music]')
  ok('no music before Begin', (await root.getAttribute('data-music-live')) === '0' && (await tp.evaluate(() => window.__passes.length)) === 0)
  await tp.getByRole('button', { name: /Begin/ }).click()
  await tp.waitForTimeout(1500)
  shots.push(['present-guests-intro', await tp.screenshot()])
  await tp.waitForFunction(() => document.querySelector('[data-music]')?.getAttribute('data-music-live') === '1', null, { timeout: 8000 }).catch(() => undefined)
  ok('music starts with Begin', (await root.getAttribute('data-music')) === 'on' && (await root.getAttribute('data-music-live')) === '1')
  // Seamless: each pass of the 18 s section (2 s → 20 s) starts before the one before it ends, overlapping by the crossfade.
  const passes = await tp.evaluate(() => window.__passes)
  const overlaps = passes.slice(1).map((p, i) => passes[i][0] + passes[i][2] - p[0])
  const seamless = passes.length >= 3 && passes.every((p) => Math.abs(p[1] - 2) < 0.01 && Math.abs(p[2] - 18) < 0.01) && overlaps.every((o) => o > 2 && o < 3)
  ok('music loops seamlessly (each pass crossfades into the next)', seamless, `${passes.length} passes scheduled, overlaps ${overlaps.slice(0, 3).map((o) => o.toFixed(2)).join(', ')} s`)
  await tp.getByText(/^by Rina G\./).first().waitFor({ timeout: 15000 })
  await tp.waitForTimeout(2200)
  ok('presentation shows a photo with the name', true)
  shots.push(['present-guests-photo', await tp.screenshot()])
  const firstCount = await tp.getByText(/^\d+ \/ 3/).first().innerText().catch(() => '')
  await tp.waitForTimeout(6500)
  const laterCount = await tp.getByText(/^\d+ \/ 3/).first().innerText().catch(() => '')
  ok('moves on by itself after about 5 seconds', firstCount !== laterCount, `${firstCount} → ${laterCount}`)
  await tp.mouse.move(640, 300)
  await tp.waitForTimeout(400)
  shots.push(['present-guests-controls', await tp.screenshot()])
  ok('music button in the controls', await tp.getByRole('button', { name: 'Turn the music off' }).isVisible())
  await tp.keyboard.press('m')
  await tp.waitForTimeout(2500)
  const offState = [await root.getAttribute('data-music'), await root.getAttribute('data-music-live')]
  await tp.keyboard.press('m')
  await tp.waitForTimeout(2500)
  const onState = [await root.getAttribute('data-music'), await root.getAttribute('data-music-live')]
  ok('M turns the music off and on again', offState.join() === 'off,0' && onState.join() === 'on,1', `off: ${offState} · on: ${onState}`)

  // Live: a guest shares a 4th photo mid-show → it appears and plays next, without waiting for the 2-minute check.
  ok('presentation listens for new guest photos live', live.joined)
  const src = store.photos[0]
  const newId = '00000000-0000-4000-8000-00000000live'
  store.files.set(`p/${newId}.jpg`, store.files.get(src.path))
  store.files.set(`t/${newId}.jpg`, store.files.get(src.thumb))
  store.photos.unshift({ id: newId, path: `p/${newId}.jpg`, thumb: `t/${newId}.jpg`, by: 'Mara L.', at: new Date().toISOString(), uploader_name: 'Mara Lopez' })
  const sentAt = Date.now()
  live.send?.({ added: 1, removed: 0 })
  await tp.getByText(/^\d+ \/ 4/).first().waitFor({ timeout: 5000 }).catch(() => undefined)
  const joinedIn = Date.now() - sentAt
  ok('new photo joins the show within seconds', (await tp.getByText(/^\d+ \/ 4/).count()) > 0, `${(joinedIn / 1000).toFixed(1)} s`)
  await tp.getByText(/^by Mara L\./).first().waitFor({ timeout: 12000 }).catch(() => undefined)
  ok('new photo is shown next, with the guest’s name', await tp.getByText(/^by Mara L\./).first().isVisible().catch(() => false), `${((Date.now() - sentAt) / 1000).toFixed(1)} s after sharing`)
  await tp.waitForTimeout(1800)
  shots.push(['present-guests-live', await tp.screenshot()])

  // Hidden by the admin → it leaves the show.
  store.photos = store.photos.filter((x) => x.id !== newId)
  live.send?.({ added: 0, removed: 1 })
  await tp.getByText(/^\d+ \/ 3/).first().waitFor({ timeout: 5000 }).catch(() => undefined)
  ok('a hidden photo leaves the show', (await tp.getByText(/^\d+ \/ 3/).count()) > 0)

  await tp.goto(`${BASE}#/present/ours`)
  await tp.getByRole('button', { name: /Begin/ }).waitFor({ timeout: 15000 })
  await tp.waitForTimeout(1500)
  ok('our photos & films: start screen', await tp.getByText(/3 photos · 1 film/).isVisible(), await tp.locator('body').innerText().then((t) => t.slice(0, 200)))
  shots.push(['present-ours-start', await tp.screenshot()])
  await tp.getByRole('button', { name: /Begin/ }).click()
  await tp.getByText('Where it all began').waitFor({ timeout: 15000 })
  await tp.waitForTimeout(2200)
  ok('our photos show their captions', true)
  shots.push(['present-ours-photo', await tp.screenshot()])
  await tp.evaluate(() => {
    window.__sawFilm = false
    window.__musicDuringFilm = []
    new MutationObserver(() => {
      if (document.querySelector('video')) {
        window.__sawFilm = true
        window.__musicDuringFilm.push(document.querySelector('[data-music]')?.getAttribute('data-music'))
      }
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-music'] })
  })
  for (let i = 0; i < 3; i++) {
    await tp.keyboard.press('ArrowRight')
    await tp.waitForTimeout(500)
  }
  await tp.waitForTimeout(2000)
  // (Test Chromium can't play MP4, so the film may be skipped — which is also what should happen to a broken film.)
  ok('the film comes up in the show', await tp.evaluate(() => window.__sawFilm))
  const duringFilm = await tp.evaluate(() => window.__musicDuringFilm)
  ok('music steps aside while a film plays', duringFilm.includes('resting'), duringFilm.slice(0, 5).join(', '))
  shots.push(['present-ours-film', await tp.screenshot()])
  ok('no page errors (presentation)', terr.length === 0, terr.join(' | '))
  await tctx.close()

  // ---------------------------------------------------------------- home: menu, and no wedding-day layout
  const hctx = await browser.newContext({ viewport: { width: 375, height: 760 } })
  await hctx.route(`${API}/**`, handle)
  const hp = await hctx.newPage()
  const herr = []
  hp.on('pageerror', (e) => herr.push(String(e)))
  store.prefs.music = { ...store.prefs.music, welcome: false, autoplay: false }
  await hp.goto(`${BASE}#/?dayof`)
  await hp.getByRole('button', { name: 'Menu' }).first().waitFor({ timeout: 15000 })
  await hp.waitForTimeout(2500)
  const navBox = await hp.locator('nav[aria-label="Primary"]').boundingBox()
  ok('home top bar fits a small phone', navBox && navBox.width <= 375, JSON.stringify(navBox))
  const dayOf = await hp.getByText('Today’s the day!').count()
  ok('no wedding-day layout (removed for the shower)', dayOf === 0)
  shots.push(['home-dayof', await hp.screenshot({ fullPage: false })])
  ok('no page errors (home)', herr.length === 0, herr.join(' | '))
  await hctx.close()

  // ---------------------------------------------------------------- custom monogram in the header
  store.monogram = { url: `${API}/storage/v1/object/public/wedding-assets/monogram/test.svg`, aspect: 100 / 120 }
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await mctx.route(`${API}/**`, handle)
  const mp = await mctx.newPage()
  await mp.goto(`${BASE}#/photos`)
  await mp.waitForTimeout(2500)
  const masked = await mp.evaluate(() => [...document.querySelectorAll('header span')].some((el) => (getComputedStyle(el).maskImage || getComputedStyle(el).webkitMaskImage || '').includes('monogram/test.svg')))
  ok('uploaded monogram replaces the initials', masked)
  shots.push(['monogram-header', await mp.screenshot({ clip: { x: 0, y: 0, width: 390, height: 140 } })])
  store.monogram = null
  await mctx.close()

  // ---------------------------------------------------------------- welcome screen + autoplay (home)
  store.prefs.music = { ...store.prefs.music, welcome: true, autoplay: true }
  const wctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await wctx.route(`${API}/**`, handle)
  const wp = await wctx.newPage()
  await wp.goto(`${BASE}#/`)
  const enter = wp.getByRole('button', { name: /Enter the baby shower website/ })
  await enter.waitFor({ timeout: 15000 })
  ok('welcome screen shows (autoplay blocked without a tap)', true)
  shots.push(['welcome', await wp.screenshot()])
  await enter.click()
  await wp.waitForTimeout(1500)
  ok('tap to enter starts the music', /music on/i.test(await wp.locator('[data-music-button]').textContent()), await wp.locator('[data-music-button]').textContent())
  ok('welcome screen closes', (await enter.count()) === 0)
  await wctx.close()

  // autoplay where the browser allows it
  const actxAuto = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
  const ac = await actxAuto.newContext({ viewport: { width: 1280, height: 800 } })
  await ac.route(`${API}/**`, handle)
  store.prefs.music = { ...store.prefs.music, welcome: false, autoplay: true }
  const ap1 = await ac.newPage()
  await ap1.goto(`${BASE}#/photos`)
  await ap1.locator('[data-music-button]').waitFor({ timeout: 15000 })
  await ap1.waitForTimeout(2000)
  ok('autoplay starts without a tap when allowed', /music on/i.test(await ap1.locator('[data-music-button]').textContent()), await ap1.locator('[data-music-button]').textContent())
  await actxAuto.close()

  // ---------------------------------------------------------------- admin (fake signed-in session)
  const actx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await actx.route(`${API}/**`, handle)
  await actx.addInitScript(() => {
    const exp = Math.floor(Date.now() / 1000) + 3600 * 24
    const payload = btoa(JSON.stringify({ sub: 'u1', role: 'authenticated', exp })).replace(/=+$/, '')
    localStorage.setItem('sb-mock-auth-token', JSON.stringify({ access_token: `e30.${payload}.sig`, refresh_token: 'r', expires_at: exp, expires_in: 86400, token_type: 'bearer', user: { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'admin@test' } }))
  })
  const ap = await actx.newPage()
  const aerr = []
  ap.on('pageerror', (e) => aerr.push(String(e)))
  await ap.goto(`${BASE}#/admin/music`)
  await ap.getByRole('heading', { name: 'Music' }).first().waitFor({ timeout: 15000 })
  await ap.waitForTimeout(2500)
  const bars = await ap.locator('.bg-gold.rounded-full.flex-1').count()
  ok('music admin draws the waveform', bars > 100, `${bars} bars in the chosen part`)
  ok('music admin shows the part', await ap.getByText('0:02 → 0:20').isVisible())
  await ap.getByRole('button', { name: 'Preview' }).click()
  await ap.getByRole('button', { name: 'Stop' }).waitFor({ timeout: 5000 })
  ok('preview plays', true)
  shots.push(['admin-music', await ap.screenshot({ fullPage: true })])
  await ap.getByRole('button', { name: 'Stop' }).click()

  await ap.goto(`${BASE}#/admin/guest-photos`)
  await ap.getByRole('heading', { name: 'Guest Photos' }).first().waitFor({ timeout: 15000 })
  await ap.waitForTimeout(1500)
  const tiles = await ap.getByRole('button', { name: /Photo by Rina Gaspar/ }).count()
  ok('admin lists guest photos', tiles === 3, `tiles ${tiles}`)
  ok('admin offers the Polaroid style', await ap.getByText('Polaroid', { exact: true }).isVisible())
  ok('admin has Present slideshow', await ap.getByRole('link', { name: /Present slideshow/ }).isVisible())
  ok('admin slideshow link goes to the presentation', (await ap.getByRole('link', { name: /Present slideshow/ }).getAttribute('href')).endsWith('#/present/guests'))
  shots.push(['admin-photos', await ap.screenshot({ fullPage: true })])

  // switching pages shows the loading monogram, never a blank screen
  await ap.goto(`${BASE}#/admin/schedule`)
  await ap.getByRole('heading', { name: 'Reveal date' }).waitFor({ timeout: 15000 })
  await ap.waitForTimeout(1200)
  ok('schedule page lists what guests see', await ap.getByText('Guest photos', { exact: true }).isVisible())
  ok('no backup-copy banner on localhost', (await ap.getByText(/backup copy/).count()) === 0)
  shots.push(['admin-schedule', await ap.screenshot({ fullPage: true })])
  // Website Settings: the raffle note card, with a live preview
  await ap.goto(`${BASE}#/admin/settings`)
  await ap.getByRole('heading', { name: 'Raffle note on the RSVP page' }).waitFor({ timeout: 15000 })
  await ap.getByRole('heading', { name: 'Raffle note on the RSVP page' }).scrollIntoViewIfNeeded()
  await ap.waitForTimeout(1500)
  ok('admin: raffle note card shows its preview', (await ap.locator('#raffle-note [data-raffle-teaser]').getByText('up to ₱25,000').count()) === 1)
  shots.push(['admin-raffle-note', await ap.locator('#raffle-note').screenshot()])
  // Photos & Video: the order of the sections on the home page (main gallery and film included)
  await ap.goto(`${BASE}#/admin/media`)
  const order = ap.getByRole('list', { name: 'Photo and video sections, in order' })
  await order.waitFor({ timeout: 15000 })
  await ap.waitForTimeout(800)
  const names = await order.getByRole('listitem').allInnerTexts()
  ok('order card lists the main gallery and film', names.length >= 2 && /Our Story/.test(names[0]) && /Our Prenup Film/.test(names[1]), names.map((n) => n.replace(/\s+/g, ' ')).join(' | '))
  await ap.getByRole('button', { name: 'Move “Our Prenup Film” up' }).click()
  await ap.waitForTimeout(1200)
  ok('the new order is saved', JSON.stringify(store.mediaOrder.slice(0, 2)) === '["video","gallery"]', JSON.stringify(store.mediaOrder))
  ok('says it’s saved', (await ap.getByText(/Saved — your website shows this order/).count()) === 1)
  shots.push(['admin-media-order', await ap.locator('section', { has: ap.locator('#media-order-heading') }).screenshot()])
  ok('no page errors (admin)', aerr.length === 0, aerr.join(' | '))
  await actx.close()

  // ---------------------------------------------------------------- home: that order, and small photo copies in the gallery
  const octx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await octx.route(`${API}/**`, handle)
  const op = await octx.newPage()
  await op.goto(`${BASE}#/`)
  await op.getByRole('heading', { name: 'Our Prenup Film' }).waitFor({ timeout: 20000 })
  const pos = await op.evaluate(() => {
    const y = (re) => [...document.querySelectorAll('h2')].find((h) => re.test(h.textContent ?? ''))?.getBoundingClientRect().top ?? -1
    return { film: y(/Our Prenup Film/), gallery: y(/Our Story/) }
  })
  ok('home follows the saved order (film before gallery)', pos.film >= 0 && pos.gallery > pos.film, JSON.stringify(pos))
  const firstImg = await op.locator('section', { has: op.getByRole('heading', { name: 'Our Story' }) }).locator('img').first().getAttribute('src')
  ok('the gallery shows the small copy', store.photos.length === 0 || (firstImg ?? '').includes('/guest-photos/t/'), firstImg ?? '')
  await octx.close()
  store.mediaOrder = []

  // ---------------------------------------------------------------- RSVP page: the raffle note above the name search (phone)
  const rctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  await rctx.route(`${API}/**`, handle)
  const rp = await rctx.newPage()
  const rerr = []
  rp.on('pageerror', (e) => rerr.push(String(e)))
  await rp.goto(`${BASE}#/rsvp`)
  await rp.getByRole('heading', { name: 'Search Your Invitation' }).waitFor({ timeout: 15000 })
  await rp.waitForTimeout(3200)
  const teaser = rp.locator('[data-raffle-teaser]')
  ok('RSVP page highlights the raffle prize', (await teaser.getByText('up to ₱25,000').isVisible()) && (await teaser.getByText(/chance to win/).isVisible()))
  const teaserBox = await teaser.boundingBox()
  const formBox = await rp.getByRole('textbox').first().boundingBox()
  ok('raffle note sits above the name search', Boolean(teaserBox && formBox && teaserBox.y < formBox.y), `${teaserBox?.y} < ${formBox?.y}`)
  shots.push(['rsvp-raffle-note', await rp.screenshot({ fullPage: true })])
  ok('no page errors (RSVP)', rerr.length === 0, rerr.join(' | '))
  await rctx.close()
} catch (e) {
  ok('script', false, String(e))
} finally {
  await browser.close()
}

for (const [name, png] of shots) writeFileSync(`${OUT}/${name}.png`, png)
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
