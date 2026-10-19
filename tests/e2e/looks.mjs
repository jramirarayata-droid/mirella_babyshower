// Website-only design looks (Admin → Look & Feel): each look renders on the guest pages, keeps every
// button and form working, never reaches the admin or Printables, and the four original styles are unchanged.
// Saves phone and desktop screenshots of every look for review. Mocked backend — nothing live is touched.
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const BASE = process.argv[2]
const OUT = process.argv[3] ?? '/tmp'
const API = 'https://mock.supabase.test'
const results = []
const ok = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

// The website-only looks to check, with the templates (colour presets) each one has.
const LOOKS = [
  { id: 'leaf', name: 'Eucalyptus & Gold', templates: ['leaf-ivory', 'leaf-sage', 'leaf-blush', 'leaf-forest'] },
  { id: 'garden', name: 'Watercolour Garden', templates: ['garden-blush', 'garden-ivory', 'garden-peach', 'garden-sage'] },
  { id: 'savedate', name: 'Save the Date', templates: ['savedate-champagne', 'savedate-rose', 'savedate-sage', 'savedate-dusk'] },
  { id: 'arch', name: 'Sunlit Arch', templates: ['arch-terracotta', 'arch-apricot', 'arch-sand', 'arch-clay'] },
  { id: 'story', name: 'Love Story', templates: ['story-rose', 'story-gold', 'story-mauve', 'story-lavender'] },
  { id: 'damask', name: 'Damask', templates: ['damask-ivory', 'damask-champagne', 'damask-sage', 'damask-burgundy'] },
]

const T = '2026-09-01T00:00:00Z'
const PHOTO = 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=2400&q=80'
const m = (name, role = '') => ({ id: Math.random().toString(36).slice(2), name, role })
const settings = {
  id: 'ws1',
  couple_names: 'Mir & Ella',
  hero_title: 'Mir & Ella',
  hero_image_url: PHOTO,
  wedding_date: '2026-12-19',
  story_text: 'Two hearts, one story — and we would love for you to be part of the next chapter.',
  church_name: 'San Agustin Church',
  ceremony_time: '2:00 PM',
  reception_name: 'The Glass Garden',
  reception_time: '5:00 PM',
  rsvp_open: true,
  entourage: [
    { id: 'e1', title: 'Parents of the Groom', layout: 'pairs', members: [m('Rogelio Ramirez'), m('Carmela Ramirez')] },
    { id: 'e2', title: 'Principal Sponsors', layout: 'pairs', members: [m('Antonio Reyes'), m('Lourdes Reyes'), m('Manuel Santos'), m('Teresita Santos')] },
  ],
  entourage_title: 'The Entourage',
  outfit_section_visible: false,
  sections: [],
  additional_info: [
    { id: 'g1', title: 'Dress code', body: 'Formal attire, please.', icon: 'info', visible: true },
    { id: 'g2', title: 'Gifts', body: 'Your presence is the greatest gift.', icon: 'gift', visible: true },
  ],
  motif_colors: [],
  seating_config: { finder: { from: null, mode: 'visible', preassign: false } },
  theme: { template: 'classic' },
}

const themeWrites = []

async function handle(route) {
  const req = route.request()
  const url = new URL(req.url())
  const p = url.pathname
  const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) })
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
  const accept = req.headers()['accept'] ?? ''
  const rows = (list) => (accept.includes('vnd.pgrst.object') ? (list[0] ? json(list[0]) : json({ message: 'none' }, 406)) : json(list))
  if (p.startsWith('/rest/v1/rpc/')) {
    const fn = p.slice('/rest/v1/rpc/'.length)
    if (fn === 'is_admin') return json(true)
    if (fn === 'public_display_prefs') return json({ card: {}, website: {}, sharePreviewUrl: null, raffleVisible: false, monogram: null })
    return json(null)
  }
  if (p.startsWith('/auth/v1/user')) return json({ id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'admin@test' })
  const table = p.replace('/rest/v1/', '')
  if (table === 'wedding_settings' && req.method() !== 'GET') themeWrites.push(req.postData())
  if (req.method() !== 'GET') return json(null, 204)
  return rows(table === 'wedding_settings' ? [settings] : [])
}

const browser = await chromium.launch()
const shots = []
let page = null
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.route(`${API}/**`, handle)
  await ctx.addInitScript(() => {
    const exp = Math.floor(Date.now() / 1000) + 86400
    const payload = btoa(JSON.stringify({ sub: 'u1', role: 'authenticated', exp })).replace(/=+$/, '')
    localStorage.setItem('sb-mock-auth-token', JSON.stringify({ access_token: `e30.${payload}.sig`, refresh_token: 'r', expires_at: exp, expires_in: 86400, token_type: 'bearer', user: { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'admin@test' } }))
  })
  page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))

  const open = async (path, theme) => {
    settings.theme = theme
    await page.goto(`${BASE}#${path}`)
    await page.waitForTimeout(400)
    await page.reload()
    await page.locator('h1, main').first().waitFor({ timeout: 20000 })
    await page.evaluate(() => document.fonts.ready)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(1800)
  }
  const styleAttr = () => page.evaluate(() => document.documentElement.dataset.style)
  const shotOf = async (selector) => {
    await page.locator(selector).first().scrollIntoViewIfNeeded()
    await page.waitForTimeout(900)
    return page.screenshot()
  }

  // ---------------------------------------------------------------- the original four styles are unchanged
  for (const [template, style] of [['classic', 'classic'], ['maison-noir', 'maison'], ['deco-gatsby', 'deco'], ['heritage-capiz', 'heritage']]) {
    await open('/', { template })
    ok(`${template}: page still uses the “${style}” style`, (await styleAttr()) === style, await styleAttr())
  }

  // ---------------------------------------------------------------- each new look
  for (const look of LOOKS) {
    for (const [i, template] of look.templates.entries()) {
      await page.setViewportSize({ width: 1440, height: 900 })
      await open('/', { template })
      ok(`${template}: home page uses the ${look.name} look`, (await styleAttr()) === look.id, await styleAttr())
      ok(`${template}: couple’s names show`, (await page.locator('.hero-names').first().innerText()).includes('Mir'))
      shots.push([`looks-${template}-desktop-hero`, await page.screenshot()])
      if (look.id === 'savedate' && i === 0) ok(`${template}: the round countdown shows on the photo`, await page.getByRole('timer').first().isVisible())
      if (i === 0) {
        shots.push([`looks-${template}-desktop-details`, await shotOf('#details')])
        shots.push([`looks-${template}-desktop-venues`, await shotOf('.lux-venue')])
        shots.push([`looks-${template}-desktop-info`, await shotOf('.lux-icon')])
        shots.push([`looks-${template}-desktop-rsvp`, await shotOf('.lux-cta')])
      }
      // The other hero layouts with the same look.
      if (i === 0) {
        for (const layout of ['center', 'split', 'left']) {
          await open('/', { template, heroLayout: layout })
          shots.push([`looks-${template}-desktop-hero-${layout}`, await page.screenshot()])
        }
      }

      await page.setViewportSize({ width: 390, height: 844 })
      await open('/', { template })
      shots.push([`looks-${template}-phone-hero`, await page.screenshot()])
      if (i === 0) {
        shots.push([`looks-${template}-phone-details`, await shotOf('#details')])
        shots.push([`looks-${template}-phone-venues`, await shotOf('.lux-venue')])
        const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
        ok(`${template}: no sideways scrolling on a phone`, !wide)

        // RSVP still works: the page opens with its form.
        await open('/rsvp', { template })
        ok(`${template}: RSVP page opens with its name search`, await page.locator('main input').first().isVisible())
        shots.push([`looks-${template}-phone-rsvp`, await page.screenshot()])
        // Find My Seat still works.
        await open('/seat', { template })
        ok(`${template}: Find My Seat opens with its search`, await page.locator('main input').first().isVisible())
        shots.push([`looks-${template}-phone-seat`, await page.screenshot()])
      }
    }

    // The admin always stays Classic, and Printables keep their own (Classic) design for this look.
    await page.setViewportSize({ width: 1440, height: 900 })
    await open('/admin/printables', { template: look.templates[0] })
    ok(`${look.name}: admin pages stay in the classic style`, (await styleAttr()) === 'classic', await styleAttr())
    const designBox = page.locator('select[aria-label="Design"]')
    if (!(await designBox.count())) await page.getByRole('button', { name: /Paper & design/ }).first().click()
    await designBox.first().waitFor({ timeout: 5000 }).catch(() => {})
    const design = await designBox.first().inputValue().catch(() => '(not found)')
    ok(`${look.name}: Printables design stays “classic”`, design === 'classic', design)
  }

  // ---------------------------------------------------------------- Look & Feel: the looks are offered, previewed and not saved
  await open('/admin/look', { template: 'classic' })
  for (const look of LOOKS) {
    const tab = page.getByRole('tab', { name: look.name })
    ok(`Look & Feel offers “${look.name}”`, (await tab.count()) === 1)
    await tab.click()
    await page.waitForTimeout(400)
    const cards = page.locator('ul button[aria-pressed]')
    ok(`${look.name}: ${look.templates.length} colour choices`, (await cards.count()) === look.templates.length, String(await cards.count()))
    await cards.first().click()
    await page.waitForTimeout(2500)
    const frame = page.frameLocator('iframe').first()
    const previewStyle = await frame.locator('html').getAttribute('data-style').catch(() => null)
    ok(`${look.name}: the live preview shows the look`, previewStyle === look.id, String(previewStyle))
    shots.push([`looks-${look.id}-admin-lookfeel`, await page.screenshot()])
  }
  ok('nothing was saved while trying looks', themeWrites.length === 0, themeWrites.join(' | ').slice(0, 200))

  ok('no page errors', errors.length === 0, errors.join(' | '))
} catch (e) {
  ok('test run', false, String(e).slice(0, 400))
  if (page) shots.push(['looks-failure', await page.screenshot().catch(() => Buffer.from(''))])
} finally {
  for (const [n, b] of shots) writeFileSync(`${OUT}/${n}.png`, b)
  await browser.close()
}
const passed = results.filter((r) => r.pass).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed === results.length ? 0 : 1)
