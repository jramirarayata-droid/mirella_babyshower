// Program flow & Bible verse: set up in Website Settings (show/hide each), shown
// on the website (verse highlighted after the introduction, program after the
// venues), hidden when switched off, and printed from Printables → Leaflets.
// Mocked backend — nothing live is touched.
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

const T = '2026-09-01T00:00:00Z'
const settings = {
  id: 'ws1', couple_names: 'Juan & Maria Santos', baby_name: 'Baby Santos', hero_title: 'Baby Santos', wedding_date: '2027-03-13', story_text: 'A little one is on the way! Join us for an afternoon of games and treats.',
  church_name: 'Sample Garden Venue', ceremony_time: '2:00 PM', reception_name: 'The Glass Garden', reception_time: '5:00 PM', rsvp_open: true,
  additional_info: [{ id: 'g1', title: 'Dress code', body: 'Formal attire, please.', icon: 'info', visible: true }], entourage: [], motif_colors: [], gallery_visible: false, video_visible: false, outfit_section_visible: false,
  seating_config: { finder: { from: null, mode: 'visible', preassign: false } }, updated_at: T,
  program_visible: false, program_title: null, program_subtitle: null, verse_visible: false, verse_text: null, verse_reference: null,
}
let program = []
const settingsPatches = []
const programUpserts = []
const programDeletes = []
let programReads = 0

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
  if (table === 'wedding_settings' && req.method() === 'PATCH') {
    const body = JSON.parse(req.postData() || '{}')
    settingsPatches.push(body)
    Object.assign(settings, body)
    return rows([settings])
  }
  if (table === 'program_items') {
    if (req.method() === 'POST') {
      const body = JSON.parse(req.postData() || '[]')
      programUpserts.push(body)
      for (const r of body) {
        const i = program.findIndex((x) => x.id === r.id)
        const row = { created_at: T, updated_at: T, ...r }
        if (i >= 0) program[i] = { ...program[i], ...row }
        else program.push(row)
      }
      return json(null, 201)
    }
    if (req.method() === 'DELETE') {
      const f = url.searchParams.get('id') ?? ''
      programDeletes.push(f)
      const m = /^not\.in\.\((.*)\)$/.exec(f)
      const keep = m ? m[1].split(',') : []
      program = program.filter((x) => keep.includes(x.id))
      return json(null, 204)
    }
    programReads++
    return json([...program].sort((a, b) => a.sort_order - b.sort_order))
  }
  if (req.method() !== 'GET') return json(null, 204)
  const map = { wedding_settings: [settings] }
  return rows(map[table] ?? [])
}

const login = () => {
  const exp = Math.floor(Date.now() / 1000) + 86400
  const payload = btoa(JSON.stringify({ sub: 'u1', role: 'authenticated', exp })).replace(/=+$/, '')
  localStorage.setItem('sb-mock-auth-token', JSON.stringify({ access_token: `e30.${payload}.sig`, refresh_token: 'r', expires_at: exp, expires_in: 86400, token_type: 'bearer', user: { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'admin@test' } }))
}

const VERSE = 'Love is patient, love is kind.\nIt always protects, always trusts, always hopes, always perseveres.'
const browser = await chromium.launch()
const shots = []
let current = null
try {
  // ---------------------------------------------------------------- Website Settings
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } })
  await ctx.route(`${API}/**`, handle)
  await ctx.addInitScript(login)
  const page = await ctx.newPage()
  current = page
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(`${BASE}#/admin/settings`)
  const verseCard = page.locator('section#verse')
  const programCard = page.locator('section#program')
  await programCard.getByRole('heading', { name: 'Program flow' }).waitFor({ timeout: 20000 })
  await page.waitForTimeout(600)
  ok('both cards start hidden', (await verseCard.getByText('Hidden', { exact: true }).count()) === 1 && (await programCard.getByText('Hidden', { exact: true }).count()) === 1)

  // Bible verse
  await verseCard.getByLabel('Verse', { exact: true }).fill(VERSE)
  await verseCard.getByLabel('Reference').fill('1 Corinthians 13:4, 7')
  ok('verse preview updates', (await verseCard.getByText('1 Corinthians 13:4, 7').count()) === 1)
  await verseCard.getByRole('checkbox').check()
  await verseCard.getByRole('button', { name: 'Save verse' }).click()
  await page.waitForTimeout(800)
  const vp = settingsPatches.at(-1) ?? {}
  ok('verse saved to the settings', vp.verse_visible === true && vp.verse_text === VERSE && vp.verse_reference === '1 Corinthians 13:4, 7', JSON.stringify(vp))
  ok('verse now shows as Showing', (await verseCard.getByText('Showing', { exact: true }).count()) === 1)
  shots.push(['program-admin-verse', await verseCard.screenshot()])

  // Program flow
  await programCard.getByRole('button', { name: 'Start with a typical program' }).click()
  const moments = programCard.getByRole('list', { name: 'Program moments' }).locator(':scope > li')
  ok('a typical program fills in', (await moments.count()) === 9)
  ok('the first moment takes the start time', (await moments.first().getByLabel('Time', { exact: true }).inputValue()) === '2:00 PM')
  await programCard.getByRole('button', { name: 'Remove Opening of Gifts & Thank You' }).click()
  await moments.nth(1).getByLabel('Note (optional)', { exact: true }).fill('In the garden')
  await programCard.getByRole('button', { name: 'Move Gender Reveal up' }).click()
  // A moment with a time but no name is caught before saving.
  await programCard.getByRole('button', { name: 'Add a moment' }).click()
  await moments.last().getByLabel('Time', { exact: true }).fill('9:00 PM')
  await programCard.getByRole('checkbox').check()
  await programCard.getByRole('button', { name: 'Save program' }).click()
  await page.waitForTimeout(500)
  ok('an unnamed moment is caught', (await programCard.getByText('Please name this moment.').count()) === 1 && programUpserts.length === 0)
  await moments.last().getByLabel('Moment', { exact: true }).fill('Send-off')
  await programCard.getByRole('button', { name: 'Save program' }).click()
  await page.waitForTimeout(1000)
  const up = programUpserts.at(-1) ?? []
  ok('program saved in its own table, in order', up.length === 9 && up.map((r) => r.sort_order).join(',') === '1,2,3,4,5,6,7,8,9' && up[0].title === 'Welcome & Snacks' && up[1].description === 'In the garden', JSON.stringify(up.map((r) => r.title)))
  ok('moved moment keeps its new place', up[4]?.title === 'Gender Reveal' && up[5]?.title === 'Lunch / Merienda', up.map((r) => r.title).join(' | '))
  ok('removed moments are cleaned up after saving', programDeletes.length === 1 && programDeletes[0].startsWith('not.in.('))
  ok('program switched on', settingsPatches.at(-1)?.program_visible === true && (await programCard.getByText('Showing', { exact: true }).count()) === 1)
  shots.push(['program-admin-program', await programCard.screenshot()])

  // Removing a moment and saving deletes just that one.
  await programCard.getByRole('button', { name: 'Remove Send-off' }).click()
  await programCard.getByRole('button', { name: 'Save program' }).click()
  await page.waitForTimeout(1000)
  ok('a removed moment is deleted', program.length === 8 && !program.some((x) => x.title === 'Send-off'), program.map((x) => x.title).join(' | '))
  ok('no page errors (admin)', errors.length === 0, errors.join(' | '))
  await ctx.close()

  // ---------------------------------------------------------------- the website (phone)
  const gctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  await gctx.route(`${API}/**`, handle)
  const g = await gctx.newPage()
  current = g
  const gerr = []
  g.on('pageerror', (e) => gerr.push(String(e)))
  await g.goto(BASE)
  const verse = g.getByRole('region', { name: /Bible verse/ })
  await verse.waitFor({ timeout: 20000 })
  ok('verse is highlighted on the website', (await verse.getByText('Love is patient, love is kind.').count()) === 1 && (await verse.getByText('1 Corinthians 13:4, 7').count()) === 1)
  const programSection = g.locator('section[aria-labelledby="program-heading"]')
  await programSection.scrollIntoViewIfNeeded()
  await g.waitForTimeout(1200)
  ok('program shows on the website', (await programSection.getByRole('heading', { name: 'Program', exact: true }).count()) === 1 && (await programSection.getByText('Welcome & Snacks').count()) === 1 && (await programSection.getByText('In the garden').count()) === 1)
  const ys = await g.evaluate(() => {
    const y = (sel) => document.querySelector(sel)?.getBoundingClientRect().top ?? -1
    return { intro: y('#details'), verse: y('section[aria-label^="Bible verse"]'), venues: y('section[aria-labelledby="venues-heading"]'), program: y('section[aria-labelledby="program-heading"]'), info: y('section[aria-labelledby="info-heading"]') }
  })
  ok('order: introduction → verse → … → venues → program → details', ys.intro < ys.verse && ys.verse < ys.venues && ys.venues < ys.program && ys.program < ys.info, JSON.stringify(ys))
  await verse.scrollIntoViewIfNeeded()
  await g.waitForTimeout(1200)
  shots.push(['program-site-verse-phone', await verse.screenshot()])
  shots.push(['program-site-program-phone', await programSection.screenshot()])
  ok('no page errors (website)', gerr.length === 0, gerr.join(' | '))
  await gctx.close()

  // Desktop look
  const dctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await dctx.route(`${API}/**`, handle)
  const d = await dctx.newPage()
  await d.goto(BASE)
  const dv = d.getByRole('region', { name: /Bible verse/ })
  await dv.waitFor({ timeout: 20000 })
  await dv.scrollIntoViewIfNeeded()
  await d.waitForTimeout(1200)
  shots.push(['program-site-verse-desktop', await dv.screenshot()])
  const dp = d.locator('section[aria-labelledby="program-heading"]')
  await dp.scrollIntoViewIfNeeded()
  await d.waitForTimeout(1200)
  shots.push(['program-site-program-desktop', await dp.screenshot()])
  await dctx.close()

  // ---------------------------------------------------------------- hidden
  settings.program_visible = false
  settings.verse_visible = false
  const reads = programReads
  const hctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await hctx.route(`${API}/**`, handle)
  const h = await hctx.newPage()
  await h.goto(BASE)
  await h.locator('section[aria-labelledby="venues-heading"]').waitFor({ timeout: 20000 })
  await h.waitForTimeout(800)
  ok('hidden: no verse, no program', (await h.getByRole('region', { name: /Bible verse/ }).count()) === 0 && (await h.locator('section[aria-labelledby="program-heading"]').count()) === 0)
  ok('hidden: the program isn’t even fetched', programReads === reads)
  await hctx.close()
  settings.program_visible = true
  settings.verse_visible = true

  // ---------------------------------------------------------------- Printables → Leaflets
  const pctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } })
  await pctx.route(`${API}/**`, handle)
  await pctx.addInitScript(login)
  const pp = await pctx.newPage()
  current = pp
  const perr = []
  pp.on('pageerror', (e) => perr.push(String(e)))
  await pp.goto(`${BASE}#/admin/printables`)
  await pp.getByRole('tab', { name: 'Leaflets' }).click({ timeout: 20000 })
  await pp.getByRole('button', { name: 'Program', exact: true }).click()
  await pp.waitForTimeout(1500)
  const preview = pp.getByRole('region', { name: 'Print preview' })
  ok('program leaflet prints the program from Website Settings', (await preview.getByText('Welcome & Snacks').count()) >= 1 && (await preview.getByText('In the garden').count()) >= 1)
  ok('the block says where it comes from', (await pp.getByText(/8 moments from Website Settings/).count()) === 1)
  shots.push(['program-leaflet-front', await preview.screenshot()])
  await pp.getByLabel('What to print').selectOption('back')
  await pp.waitForTimeout(1500)
  ok('the back carries the Bible verse', (await preview.getByText('1 CORINTHIANS 13:4, 7').count()) >= 1)
  ok('leaflet fits', (await pp.getByText(/too full for this size/).count()) === 0)
  shots.push(['program-leaflet-back', await preview.screenshot()])
  ok('no page errors (printables)', perr.length === 0, perr.join(' | '))
  await pctx.close()
} catch (e) {
  ok('script', false, String(e))
  if (current) shots.push(['program-failure', await current.screenshot({ fullPage: true }).catch(() => Buffer.alloc(0))])
} finally {
  await browser.close()
}
for (const [name, png] of shots) writeFileSync(`${OUT}/${name}.png`, png)
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
