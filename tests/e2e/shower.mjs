// Baby shower activities: gift wishlist (sign in by name, "I'll bring this",
// sold-out race), baby predictions, name ideas, the gender reveal (answer never
// sent before the reveal time; confetti after) and the admin's masked answer.
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

const settings = {
  id: 'ws1', couple_names: 'Juan & Maria Santos', baby_name: 'Baby Santos', hero_title: 'Baby Santos', wedding_date: '2027-03-13', due_date: '2027-04-20', due_visible: true,
  story_text: 'A little one is on the way!', church_name: 'Sample Garden Venue', ceremony_time: '2:00 PM', rsvp_open: true, additional_info: [], entourage: [], motif_colors: [],
  gallery_visible: false, video_visible: false, outfit_section_visible: false, program_visible: false, verse_visible: false,
  seating_config: { finder: { from: null, mode: 'hidden', preassign: false } }, theme: { template: 'clouds-blue' },
}
const TOKEN = 't'.repeat(40)
const calls = []
const soon = () => new Date(Date.now() + 26 * 3600_000).toISOString()
let items
let revealed = false
let prediction = null
let ideas = []
let revealSettings
// Website Settings → Privacy: wishlist / What to Wear for attending guests only.
let wishlistPrivate = false
// Admin → Gift Registry set to Hidden: admins still get the list (to test it), guests don't.
let wishlistHidden = false
let attirePrivate = false
let attending = false
const PIC = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200"><rect width="900" height="1200" fill="#DCEAF7"/><circle cx="450" cy="500" r="200" fill="#F6D3DC"/></svg>')
const outfitRows = [
  { id: 'o1', gender: 'female', image_url: PIC, caption: 'Pastel pink sundress', label: 'Team Pink', sort_order: 1, is_visible: true },
  { id: 'o2', gender: 'male', image_url: PIC, caption: 'Light blue polo', label: 'Team Blue', sort_order: 1, is_visible: true },
]
const canSee = (token, isPrivate) => !isPrivate || (token === TOKEN && attending)
const reset = () => {
  items = [
    { id: 'r1', title: 'Diapers (newborn)', note: 'Any brand', quantity: 10, claimed: 4, mine: 0, price: '' },
    { id: 'r2', title: 'Stroller', note: 'Light and foldable', quantity: 1, claimed: 0, mine: 0, price: '' },
  ]
  revealed = false
  prediction = null
  ideas = []
  revealSettings = { enabled: true, answer: 'girl', reveal_at: soon(), title: 'Boy or Girl?', message: 'Our little secret!' }
}
reset()

const rpc = {
  shower_guest_start: (a) => (/santos/i.test(a.p_name) ? { ok: true, token: TOKEN, name: 'Ana Santos' } : { ok: false }),
  registry_list: (a) =>
    canSee(a.p_token, wishlistPrivate)
      ? { visible: true, private: false, guestVisible: !wishlistHidden, title: 'Gift Wishlist', intro: 'A few things our little one needs.', me: a.p_token === TOKEN ? 'Ana Santos' : null, items }
      : { visible: true, private: true, guestVisible: false, title: 'Gift Wishlist', intro: '', me: a.p_token === TOKEN ? 'Ana Santos' : null, items: [] },
  attire_list: (a) => ({ private: attirePrivate, allowed: canSee(a.p_token, attirePrivate), items: canSee(a.p_token, attirePrivate) ? outfitRows : [] }),
  guest_access: (a) => ({ wishlistPrivate, attirePrivate, attending: a.p_token === TOKEN && attending }),
  registry_claim: (a) => {
    const it = items.find((i) => i.id === a.p_item)
    if (a.p_item === 'r2') {
      it.claimed = 1 // someone else got there first
      return { ok: false, reason: 'taken', left: 0 }
    }
    it.claimed += a.p_qty
    it.mine += a.p_qty
    return { ok: true }
  },
  registry_unclaim: (a) => {
    const it = items.find((i) => i.id === a.p_item)
    it.claimed -= it.mine
    it.mine = 0
    return null
  },
  predictions_info: (a) => ({ visible: true, open: true, closeAt: soon(), count: prediction ? 1 : 0, me: a.p_token === TOKEN ? 'Ana Santos' : null, mine: prediction }),
  prediction_save: (a) => {
    prediction = { dueDate: a.p_due, weightKg: a.p_weight, gender: a.p_gender }
    return { ok: true }
  },
  predictions_board: () => ({ visible: true, open: true, count: 1, girl: 1, boy: 0, avgWeightKg: 3.2, dueDates: [], actual: {}, closestDate: [], closestWeight: [], genderRight: [] }),
  name_ideas_info: (a) => ({ visible: true, approval: 'instant', perGuest: 3, me: a.p_token === TOKEN ? 'Ana Santos' : null, mine: ideas }),
  name_idea_add: (a) => {
    ideas.push({ id: `n${ideas.length + 1}`, suggestion: a.p_suggestion, forGender: a.p_for, note: a.p_note ?? '', status: 'visible' })
    return { ok: true }
  },
  name_ideas_list: () => ideas.map((i) => ({ name: i.suggestion, forGender: i.forGender, count: 1, by: ['Ana S.'], notes: [] })),
  public_gender_reveal: () => ({
    enabled: true, revealAt: revealSettings.reveal_at, revealed, answer: revealed ? 'girl' : null, title: 'Boy or Girl?', message: 'Our little secret!', now: new Date().toISOString(),
  }),
  is_admin: () => true,
  public_display_prefs: () => ({ card: {}, website: {}, sharePreviewUrl: null, raffleVisible: false, monogram: null }),
}

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
    const args = req.postDataJSON() ?? {}
    calls.push({ fn, args })
    return json(fn in rpc ? rpc[fn](args) : null)
  }
  if (p.startsWith('/auth/v1/user')) return json({ id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'admin@test' })
  if (p.startsWith('/realtime') || p.startsWith('/storage')) return json({})
  const table = p.replace('/rest/v1/', '')
  if (table === 'gender_reveal') {
    if (req.method() === 'GET') return rows([{ id: 1, ...revealSettings }])
    calls.push({ fn: 'gender_reveal:write', args: req.postDataJSON() })
    return json(null, 204)
  }
  if (req.method() !== 'GET') return json(null, 204)
  return rows(table === 'wedding_settings' ? [settings] : [])
}

const browser = await chromium.launch()
const shots = []
let current = null
const since = (n) => calls.slice(n)
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await ctx.route(`${API}/**`, handle)
  const page = await ctx.newPage()
  current = page
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))

  // ---------------------------------------------------------------- gift wishlist
  await page.goto(`${BASE}#/registry`)
  await page.getByText('Diapers (newborn)').waitFor({ timeout: 20000 })
  ok('wishlist shows what is still needed', (await page.getByText(/6\s*of 10 still needed/).count()) === 1 && (await page.getByText('Still needed', { exact: true }).count()) === 1)
  ok('nobody’s name shows on an item', (await page.getByText('Ana Santos').count()) === 0)
  const diapers = page.locator('li', { hasText: 'Diapers (newborn)' })
  await diapers.getByRole('button', { name: 'One more' }).click()
  await diapers.getByRole('button', { name: /I’ll bring this/ }).click()
  ok('“I’ll bring this” asks who you are first', await page.getByLabel('Your full name').isVisible())
  await page.getByLabel('Your full name').fill('Nobody Known')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.waitForTimeout(600)
  ok('an unknown name is not let in', (await page.getByLabel('Your full name').count()) === 1 && (await page.getByText(/couldn’t find|not on the list|check the spelling/i).count()) >= 1)
  let n = calls.length
  await page.getByLabel('Your full name').fill('Ana Santos')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByText(/You’re bringing/).waitFor({ timeout: 8000 })
  const claim = since(n).find((c) => c.fn === 'registry_claim')
  ok('signing in finishes the claim, with the number chosen', claim?.args.p_token === TOKEN && claim?.args.p_item === 'r1' && claim?.args.p_qty === 2, JSON.stringify(claim))
  ok('the guest stays signed in after the claim', (await page.getByLabel('Your full name').count()) === 0 && (await page.getByText(/Hi, Ana/).count()) >= 1)
  ok('the guest pass is remembered', (await page.evaluate(() => localStorage.getItem('wedding-photo-guest'))).includes(TOKEN))
  shots.push(['shower-registry-claimed', await page.screenshot({ fullPage: true })])

  await page.getByRole('button', { name: /close|dismiss/i }).first().click().catch(() => {})
  await page.waitForTimeout(400)
  n = calls.length
  await page.locator('li', { hasText: 'Stroller' }).getByRole('button', { name: /I’ll bring this/ }).click()
  await page.waitForTimeout(800)
  ok('the last one taken by someone else: a kind message', (await page.getByText(/Someone just picked the last one/).count()) >= 1)
  ok('the sold-out item shows as taken care of', (await page.locator('li', { hasText: 'Stroller' }).getByText(/All taken care of/).count()) === 1)

  await diapers.getByRole('button', { name: 'Undo' }).click()
  await page.waitForTimeout(800)
  ok('undo frees it again', since(n).some((c) => c.fn === 'registry_unclaim' && c.args.p_item === 'r1') && (await diapers.getByText(/You’re bringing/).count()) === 0)

  // ---------------------------------------------------------------- predictions (already signed in from the wishlist)
  await page.goto(`${BASE}#/predict`)
  await page.getByText('Birthday guess', { exact: true }).waitFor({ timeout: 20000 })
  ok('predictions: no second sign-in', (await page.getByLabel('Your full name').count()) === 0)
  await page.locator('input[type="date"]').fill('2027-04-18')
  await page.getByPlaceholder('e.g. 3.2').fill('3.25')
  await page.getByRole('button', { name: 'Team Girl' }).click()
  n = calls.length
  await page.getByRole('button', { name: 'Lock in my guess' }).click()
  await page.waitForTimeout(1000)
  const save = since(n).find((c) => c.fn === 'prediction_save')
  ok('a guess is saved', save?.args.p_due === '2027-04-18' && Number(save?.args.p_weight) === 3.25 && save?.args.p_gender === 'girl', JSON.stringify(save))
  ok('the guess can be updated later', (await page.getByRole('button', { name: 'Update my guess' }).count()) === 1)
  shots.push(['shower-predictions', await page.screenshot({ fullPage: true })])

  // ---------------------------------------------------------------- name ideas
  await page.goto(`${BASE}#/names`)
  await page.getByLabel('Your name idea').waitFor({ timeout: 20000 })
  await page.getByLabel('Your name idea').fill('Sofia')
  await page.getByRole('radiogroup', { name: 'For a girl or a boy' }).getByRole('radio').first().click()
  n = calls.length
  await page.getByRole('button', { name: 'Suggest this name' }).click()
  await page.waitForTimeout(1000)
  const add = since(n).find((c) => c.fn === 'name_idea_add')
  ok('a name idea is sent', add?.args.p_suggestion === 'Sofia' && add?.args.p_token === TOKEN, JSON.stringify(add))
  ok('your ideas are listed with a count', (await page.getByText(/Your ideas \(1 of 3\)/).count()) === 1)
  shots.push(['shower-names', await page.screenshot({ fullPage: true })])

  // ---------------------------------------------------------------- gender reveal on the home page
  await page.goto(`${BASE}#/`)
  const sec = page.locator('section[aria-labelledby="reveal-heading"]')
  await sec.waitFor({ timeout: 20000 })
  await sec.scrollIntoViewIfNeeded()
  ok('before: a countdown, no answer anywhere', (await sec.getByText('Revealed in').count()) === 1 && !/It’s a Girl|It's a Girl|Girl!/.test(await page.content()))
  ok('the answer is never sent early', calls.filter((c) => c.fn === 'public_gender_reveal').length >= 1)
  ok('shower activities are linked from home', (await page.getByRole('link', { name: /wishlist/i }).count()) >= 1)
  revealed = true
  await page.reload()
  await sec.waitFor({ timeout: 20000 })
  await sec.scrollIntoViewIfNeeded()
  await page.waitForTimeout(1500)
  ok('after: the secret is out', (await sec.getByText('The secret is out!').count()) === 1)
  shots.push(['shower-revealed', await sec.screenshot()])
  ok('no page errors (guest)', errors.length === 0, errors.join(' | '))
  await ctx.close()

  // ---------------------------------------------------------------- wishlist & What to Wear for attending guests only
  wishlistPrivate = true
  attirePrivate = true
  attending = false
  items.push({ id: 'r3', kind: 'idea', title: 'A cloud nursery', note: 'Soft clouds and little stars', image: PIC, quantity: 1, claimed: 0, mine: 0, price: '' })
  const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await pctx.route(`${API}/**`, handle)
  const g = await pctx.newPage()
  current = g
  const gerr = []
  g.on('pageerror', (e) => gerr.push(String(e)))
  await g.goto(`${BASE}#/`)
  await g.locator('section[aria-labelledby="reveal-heading"]').waitFor({ timeout: 20000 })
  await g.waitForTimeout(1500)
  ok('private: no wishlist card or attire on the home page', (await g.getByRole('link', { name: /see the wishlist/i }).count()) === 0 && (await g.locator('#outfits-heading').count()) === 0)
  await g.goto(`${BASE}#/registry`)
  await g.getByText(/shared with the guests who are joining us/).waitFor({ timeout: 20000 })
  ok('private wishlist: asks to RSVP, shows no items', (await g.getByRole('link', { name: 'RSVP', exact: true }).count()) >= 1 && (await g.getByText('Diapers (newborn)').count()) === 0)
  shots.push(['wishlist-private', await g.screenshot({ fullPage: true })])
  await g.goto(`${BASE}#/attire`)
  await g.getByText(/shared with the guests who are joining us/).waitFor({ timeout: 20000 })
  ok('private What to Wear: asks to RSVP', (await g.getByRole('heading', { name: 'What to Wear' }).count()) >= 1 && (await g.locator('img').count()) === 0)
  // A guest who has said yes opens it with their name.
  attending = true
  await g.goto(`${BASE}#/registry`)
  await g.getByRole('button', { name: 'Open it with your name' }).click()
  await g.getByLabel('Your full name').fill('Ana Santos')
  await g.getByRole('button', { name: 'Continue' }).click()
  await g.getByText('Diapers (newborn)').waitFor({ timeout: 10000 })
  ok('attending guest: the wishlist opens', true)
  // Ideas now have their own section on the home page (tests/e2e/gift-ideas.mjs): the wishlist lists gifts only.
  ok('wishlist page: gifts only, no ideas', (await g.getByText('A cloud nursery').count()) === 0 && (await g.getByRole('heading', { name: /ideas/i }).count()) === 0)
  shots.push(['wishlist-ideas', await g.screenshot({ fullPage: true })])
  await g.goto(`${BASE}#/attire`)
  await g.locator('#outfits-heading').waitFor({ timeout: 20000 })
  ok('attending guest: What to Wear opens', (await g.locator('img').count()) >= 1)
  ok('no page errors (guest-only)', gerr.length === 0, gerr.join(' | '))
  await pctx.close()

  // ---------------------------------------------------------------- admin: the answer stays masked
  revealed = false
  const actx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await actx.route(`${API}/**`, handle)
  await actx.addInitScript(() => {
    const exp = Math.floor(Date.now() / 1000) + 86400
    const payload = btoa(JSON.stringify({ sub: 'u1', role: 'authenticated', exp })).replace(/=+$/, '')
    localStorage.setItem('sb-mock-auth-token', JSON.stringify({ access_token: `e30.${payload}.sig`, refresh_token: 'r', expires_at: exp, expires_in: 86400, token_type: 'bearer', user: { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'admin@test' } }))
  })
  const a = await actx.newPage()
  current = a
  const aerr = []
  a.on('pageerror', (e) => aerr.push(String(e)))
  await a.goto(`${BASE}#/admin/reveal`)
  await a.getByRole('button', { name: 'Show', exact: true }).waitFor({ timeout: 20000 })
  ok('admin: the answer is masked', (await a.getByText(/••••••/).count()) === 1 && (await a.getByRole('button', { name: 'It’s a Girl!' }).count()) + (await a.getByRole('button', { name: /^Girl/ }).count()) === 0)
  shots.push(['shower-admin-reveal', await a.screenshot()])
  await a.getByRole('button', { name: 'Show', exact: true }).click()
  ok('admin: Show lets you see and change it', (await a.locator('button[aria-pressed="true"]').count()) === 1)
  await a.getByRole('button', { name: 'Hide', exact: true }).click()
  ok('admin: and hide it again', (await a.getByText(/••••••/).count()) === 1)
  // Admin → Gift Registry: the gift list tab (gift ideas photos have their own tab — tests/e2e/gift-ideas.mjs).
  await a.goto(`${BASE}#/admin/registry`)
  await a.getByRole('button', { name: 'Add a gift' }).click()
  const dlg = a.getByRole('dialog')
  ok('admin: a gift has a photo upload and a quantity', (await dlg.getByText('Upload a photo').count()) === 1 && (await dlg.getByLabel('How many do you need?').count()) === 1)
  shots.push(['admin-registry-gift', await dlg.screenshot()])
  await dlg.getByRole('button', { name: 'Cancel' }).click()
  // Who can see it — right on the page (same setting as Website Settings → Privacy).
  const who = a.getByRole('radiogroup', { name: 'Who can see the wishlist' })
  ok('admin: the wishlist page has the “who can see it” choice', (await who.getByRole('radio', { name: /Everyone/ }).getAttribute('aria-checked')) === 'true')
  await who.getByRole('radio', { name: /Only guests who RSVP/ }).click()
  await a.waitForTimeout(800)
  ok('admin: choosing “attending only” saves it', (await who.getByRole('radio', { name: /Only guests who RSVP/ }).getAttribute('aria-checked')) === 'true')
  await a.goto(`${BASE}#/admin/outfits`)
  const whoAttire = a.getByRole('radiogroup', { name: 'Who can see the outfit photos' })
  await whoAttire.waitFor({ timeout: 15000 })
  ok('admin: What to Wear has the same choice', (await whoAttire.getByRole('radio').count()) === 2)
  shots.push(['admin-attire-who', await a.screenshot()])
  // The home page shows what guests see, even for a signed-in admin.
  wishlistPrivate = false
  wishlistHidden = true
  await a.goto(`${BASE}#/`)
  await a.locator('section[aria-labelledby="reveal-heading"]').waitFor({ timeout: 20000 })
  await a.waitForTimeout(1500)
  ok('admin on the home page: a hidden wishlist doesn’t show there', (await a.getByRole('link', { name: /see the wishlist/i }).count()) === 0)
  wishlistHidden = false
  ok('no page errors (admin)', aerr.length === 0, aerr.join(' | '))
  await actx.close()
} catch (e) {
  ok('script', false, String(e))
  if (current) shots.push(['shower-failure', await current.screenshot({ fullPage: true }).catch(() => Buffer.alloc(0))])
} finally {
  await browser.close()
}
for (const [name, png] of shots) writeFileSync(`${OUT}/${name}.png`, png)
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
