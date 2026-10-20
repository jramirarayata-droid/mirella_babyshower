// Printables: "addressed as" per invitation (suggestions only, saved one by one),
// the attire, thank-you, name and table cards, leaflets, and the
// online invitation showing the "addressed as". Mocked backend — nothing live is touched.
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
const inv = (id, name, code, extra = {}) => ({ id, invitee_name: name, search_name: name.toLowerCase(), invitation_code: code, table_number: null, max_additional_guests: 0, is_active: true, created_at: T, updated_at: T, table_id: null, printed_at: null, position_mode: 'auto', position_label: null, side: 'groom', addressed_as: null, ...extra })
const invitations = [
  inv('inv-1', 'Juan dela Cruz', 'JUAN1'),
  inv('inv-2', 'Elvira Arayata', 'ELVI2'),
  inv('inv-3', 'Ramon Garcia Jr.', 'RAMO3'),
  inv('inv-4', 'Joey Montes', 'JOEY4', { addressed_as: 'Tito Joey Montes & Tita Vivian Montes', position_mode: 'custom', position_label: 'Ninong' }),
]
const guest = (id, invitationId, name) => ({ id, invitation_id: invitationId, rsvp_response_id: null, guest_name: name, status: 'approved', added_by: 'admin', created_at: T, updated_at: T })
const guests = [guest('g1', 'inv-1', 'Maria dela Cruz'), guest('g2', 'inv-3', 'Tess Garcia'), guest('g3', 'inv-3', 'Paolo Garcia'), guest('g4', 'inv-3', 'Bea Garcia')]
const settings = { id: 'ws1', couple_names: 'Juan & Maria Santos', baby_name: 'Baby Santos', wedding_date: '2027-03-13', church_name: 'Sample Garden Venue', ceremony_time: '2:00 PM', rsvp_open: true, outfit_layout: 'pairs', outfit_section_visible: true, outfit_title: 'What to Wear', sections: [], additional_info: [{ id: 'g1', title: 'Dress code', body: 'Comfy pastels, please.', icon: 'info', visible: true }], motif_colors: [], seating_config: { finder: { from: null, mode: 'visible', preassign: false } } }
const outfit = (id, gender, file, caption, label, sort_order) => ({ id, gender, image_url: `attire/${file}.jpg`, caption, label, sort_order, is_visible: true, created_at: T, updated_at: T })
const outfits = [
  outfit('o1', 'male', 'sponsors-him', 'Light blue polo & khaki trousers', 'Parents-to-be', 1),
  outfit('o2', 'male', 'family-him', 'White linen shirt & chinos', 'Family', 2),
  outfit('o3', 'male', 'guests-him', 'Polo shirt & beige trousers', 'Guests', 3),
  outfit('o4', 'female', 'sponsors-her', 'Pastel pink sundress', 'Parents-to-be', 1),
  outfit('o5', 'female', 'family-her', 'Floral midi dress', 'Family', 2),
  outfit('o6', 'female', 'guests-her', 'Puff-sleeve midi dress in cream', 'Guests', 3),
  outfit('o7', 'male', 'look4-him', 'Cream turtleneck with long sleeves', null, 4),
  outfit('o8', 'female', 'look4-her', 'Beige dress with regular sleeves', null, 4),
]
const table = (id, name, sort_order) => ({ id, name, shape: 'round', capacity: 10, seat_sides: 'all', x: 0, y: 0, width: 170, height: 170, rotation: 0, placed: true, sort_order, created_at: T, updated_at: T })
const seatingTables = [table('t1', 'Godparents', 1), table('t2', 'Family', 2), table('t3', 'Table 5', 3)]
const seats = [{ id: 's1', table_id: 't1', seat_index: 0, invitation_id: 'inv-1', guest_id: null, created_at: T }]
// The program flow from Website Settings (the Program leaflet prints it).
const programItems = [
  { id: 'p1', time_label: '2:00 PM', title: 'Welcome & Snacks', description: null, sort_order: 1, created_at: T, updated_at: T },
  { id: 'p2', time_label: '8:00 PM', title: 'Gender Reveal', description: null, sort_order: 2, created_at: T, updated_at: T },
]
// The outfit photos are test stand-ins (the copied wedding photos were removed): plain 3:4 pastel pictures.
const photo = (route) => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200"><rect width="900" height="1200" fill="#DCEAF7"/><circle cx="450" cy="420" r="160" fill="#F6D3DC"/><rect x="300" y="620" width="300" height="420" rx="60" fill="#FBE9C9"/></svg>' })
const patches = []
const prefWrites = []

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
    const a = JSON.parse(req.postData() || '{}')
    if (fn === 'is_admin') return json(true)
    if (fn === 'attire_list') return json({ private: false, allowed: true, items: outfits })
    if (fn === 'public_display_prefs') return json({ card: {}, website: {}, sharePreviewUrl: null, raffleVisible: false, monogram: null })
    if (fn === 'open_invitation') {
      const i = invitations.find((x) => x.invitation_code === a.invite_code)
      if (!i) return json([])
      return json([{ invitee_name: i.invitee_name, included_guests: guests.filter((g) => g.invitation_id === i.id).map((g) => g.guest_name), attendance_status: null, position_mode: 'auto', position_label: null, position_member_id: null, addressed_as: i.addressed_as }])
    }
    return json(null)
  }
  if (p.startsWith('/auth/v1/user')) return json({ id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'admin@test' })
  const table = p.replace('/rest/v1/', '')
  if (table === 'invitations' && req.method() === 'PATCH') {
    const id = (url.searchParams.get('id') ?? '').replace(/^eq\./, '')
    const body = JSON.parse(req.postData() || '{}')
    patches.push({ id, body })
    const row = invitations.find((x) => x.id === id)
    if (row) Object.assign(row, body)
    return json(null, 204)
  }
  if (table === 'outfit_images' && req.method() === 'PATCH') {
    const id = (url.searchParams.get('id') ?? '').replace(/^eq\./, '')
    const body = JSON.parse(req.postData() || '{}')
    patches.push({ table, id, body })
    Object.assign(outfits.find((o) => o.id === id) ?? {}, body)
    return json(null, 204)
  }
  if (table === 'admin_preferences' && req.method() === 'POST') prefWrites.push(JSON.parse(req.postData() || 'null'))
  if (req.method() !== 'GET') return json(null, 204)
  const map = { invitations, additional_guests: guests, wedding_settings: [settings], rsvp_responses: [], outfit_images: outfits, seating_tables: seatingTables, seat_assignments: seats, program_items: programItems }
  return rows(map[table] ?? [])
}

const browser = await chromium.launch()
const shots = []
let current = null
try {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } })
  await ctx.route(`${API}/**`, handle)
  await ctx.route('**/attire/**', photo)
  await ctx.addInitScript(() => {
    const exp = Math.floor(Date.now() / 1000) + 86400
    const payload = btoa(JSON.stringify({ sub: 'u1', role: 'authenticated', exp })).replace(/=+$/, '')
    localStorage.setItem('sb-mock-auth-token', JSON.stringify({ access_token: `e30.${payload}.sig`, refresh_token: 'r', expires_at: exp, expires_in: 86400, token_type: 'bearer', user: { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'admin@test' } }))
  })
  const page = await ctx.newPage()
  current = page
  // The settings column: folding sections, one open at a time (old toolbar names → section titles).
  const SECTION = { 'Page setup': 'Paper & design', Content: 'Content', 'Our details': 'Monogram, names & date', Print: 'Printing' }
  const sectionButton = (name) => page.getByRole('group', { name: 'Printables toolbar' }).getByRole('button', { name: new RegExp(`^${(SECTION[name] ?? name).replace(/[&]/g, '\\$&')}`) })
  const pane = async (name) => {
    const b = sectionButton(name)
    if ((await b.getAttribute('aria-expanded')) !== 'true') await b.click()
    await page.waitForTimeout(150)
  }
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(`${BASE}#/admin/printables`)
  await page.getByText('Juan dela Cruz', { exact: true }).first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(800)

  // ---------------------------------------------------------------- addressed as: suggestions only, saved one by one
  ok('a sample card shows before anyone is ticked', (await page.locator('[data-sample-note]').count()) === 1 && (await page.getByRole('region', { name: 'Print preview' }).getByText('Your Guest’s Name').count()) >= 1)
  ok('the print button waits for guests', await page.getByRole('group', { name: 'Print', exact: true }).getByRole('button', { name: /^Print/ }).isDisabled())
  ok('guest rows are one line, card editing tucked away', (await page.getByText('the usual name').count()) === 0)
  await page.getByRole('button', { name: 'Edit card: Juan dela Cruz' }).click()
  ok('nothing is pre-filled', (await page.getByText('the usual name').count()) === 1)
  await page.getByRole('button', { name: /Change how Juan dela Cruz’s invitation is addressed/ }).click()
  const editor = page.getByRole('group', { name: 'Addressed as, Juan dela Cruz' })
  const box = editor.getByLabel('Addressed as')
  ok('editor opens empty', (await box.inputValue()) === '')
  const chips = await editor.locator('button.rounded-full').allInnerTexts()
  ok('suggestions for a couple', chips.includes('Juan & Maria dela Cruz') && chips.includes('Tito Juan & Tita Maria') && !chips.some((c) => /Mr\. & Mrs\./.test(c)), chips.join(' · '))
  await editor.getByRole('button', { name: 'Tito Juan & Tita Maria' }).click()
  ok('a suggestion only fills the box', (await box.inputValue()) === 'Tito Juan & Tita Maria' && patches.length === 0)
  await editor.getByRole('button', { name: 'Ninong', exact: true }).click()
  ok('a title replaces the one in front', (await box.inputValue()) === 'Ninong Juan & Tita Maria', await box.inputValue())
  await editor.getByRole('button', { name: 'Juan & Maria dela Cruz' }).click()
  shots.push(['printables-addressed-editor', await editor.screenshot()])
  await editor.getByRole('button', { name: 'Save' }).click()
  await page.waitForTimeout(800)
  ok('saved to that invitation only', patches.length === 1 && patches[0].id === 'inv-1' && patches[0].body.addressed_as === 'Juan & Maria dela Cruz', JSON.stringify(patches))

  await page.getByRole('button', { name: 'Edit card: Ramon Garcia Jr.' }).click()
  const family = page.getByRole('button', { name: /Change how Ramon Garcia Jr\.’s invitation is addressed/ })
  await family.click()
  const fEditor = page.getByRole('group', { name: 'Addressed as, Ramon Garcia Jr.' })
  const fChips = await fEditor.locator('button.rounded-full').allInnerTexts()
  ok('suggestions for a family', fChips.includes('The Garcia Family'), fChips.join(' · '))
  await fEditor.getByRole('button', { name: 'Cancel' }).click()
  ok('cancel saves nothing', patches.length === 1)

  // ---------------------------------------------------------------- the printed card uses it
  await page.locator('li', { hasText: 'Elvira Arayata' }).getByRole('checkbox').check()
  await page.locator('li', { hasText: 'Juan dela Cruz' }).getByRole('checkbox').check()
  await page.waitForTimeout(1500)
  const preview = page.getByRole('region', { name: 'Print preview' })
  ok('card says Juan & Maria dela Cruz', (await preview.getByText('Juan & Maria dela Cruz', { exact: true }).count()) >= 1)
  ok('no “together with” line when addressed', (await preview.getByText(/together with Maria/).count()) === 0)

  // Two people with their own titles: one line each, "&" on its own line between them.
  const joey = page.locator('li', { hasText: 'Joey Montes' }).getByRole('checkbox')
  await joey.check()
  await page.waitForTimeout(1500)
  const split = (await preview.getByText('Tito Joey Montes', { exact: true }).count()) >= 1 && (await preview.getByText('Tita Vivian Montes', { exact: true }).count()) >= 1 && (await preview.getByText('&', { exact: true }).count()) >= 1
  ok('Tito … & Tita … print on separate lines', split)
  ok('Juan & Maria stays on one line', (await preview.getByText('Juan & Maria dela Cruz', { exact: true }).count()) >= 1)
  shots.push(['printables-names-split', await preview.screenshot()])
  await joey.uncheck()
  await page.waitForTimeout(800)
  shots.push(['printables-card-addressed', await preview.screenshot()])

  // ---------------------------------------------------------------- attire card shows the labels
  await page.getByRole('tab', { name: 'What to wear' }).click()
  await page.waitForTimeout(2500)
  const attire = page.getByRole('region', { name: 'Print preview' })
  ok('attire card shows the labels', (await attire.getByText('PARENTS-TO-BE').count()) >= 1 && (await attire.getByText('Light blue polo & khaki trousers').count()) >= 1)
  ok('attire photos are sharp enough', (await page.getByText(/may print a little soft/).count()) === 0)
  ok('attire guide is one card', await page.getByText(/^1 card per set/).isVisible())
  ok('each label printed once', (await attire.getByText('PARENTS-TO-BE').count()) === 1 && (await attire.getByText('GUESTS', { exact: true }).count()) === 1)
  shots.push(['printables-attire-labels', await attire.screenshot()])
  // "Please refrain from wearing …": a highlighted note at the bottom, fitted inside the card.
  const avoidBox = attire.locator('[data-attire-avoid]')
  ok('attire: the gentle-request note is off at first', (await avoidBox.count()) === 0)
  await pane('Content')
  await page.getByRole('region', { name: 'Please don’t wear' }).getByRole('checkbox').check()
  await page.waitForTimeout(1200)
  ok('attire: the note is at the bottom', (await avoidBox.count()) === 1 && /A GENTLE REQUEST/i.test(await avoidBox.innerText()) && /Strong perfume.*Smoking near the mom-to-be/s.test(await avoidBox.innerText()), await avoidBox.innerText().catch(() => ''))
  const fits = async () => avoidBox.first().evaluate((el) => {
    const b = el.getBoundingClientRect()
    const p = el.parentElement.getBoundingClientRect()
    const imgs = [...el.parentElement.querySelectorAll('img')].map((i) => i.getBoundingClientRect().bottom)
    return b.bottom <= p.bottom + 0.5 && imgs.every((y) => y <= b.top + 0.5)
  })
  ok('attire: the note fits under the photos', await fits())
  shots.push(['printables-attire-avoid', await attire.locator('.print-sheet').first().screenshot()])
  await pane('Content')
  const avoidGroup = page.getByRole('region', { name: 'Please don’t wear' })
  await avoidGroup.getByLabel('What not to wear').fill('Slippers, Shorts\nRipped jeans')
  await page.waitForTimeout(1000)
  ok('attire: the list can be changed (commas or lines)', /Slippers\s*·\s*Shorts\s*·\s*Ripped jeans/.test(await avoidBox.innerText()), await avoidBox.innerText())
  await page.waitForTimeout(800)
  const av = prefWrites.flatMap((w) => (Array.isArray(w) ? w : [w])).filter((w) => w?.key === 'printables').at(-1)?.value?.attireAvoid
  ok('attire: the list is saved', av?.items === 'Slippers, Shorts\nRipped jeans' && av?.on === true, JSON.stringify(av))
  await page.getByRole('radiogroup', { name: 'Attire layout' }).getByRole('radio', { name: 'Spread over cards' }).click()
  await page.waitForTimeout(1200)
  ok('the spread layout is still there', await page.getByText(/^3 cards per set/).isVisible())
  ok('attire: spread over cards, the note is on the last card only', (await avoidBox.count()) === 1 && (await fits()))
  await avoidGroup.getByRole('checkbox').uncheck()
  await page.waitForTimeout(800)
  ok('attire: the note can be left off', (await avoidBox.count()) === 0)
  await avoidGroup.getByRole('checkbox').check()
  await page.getByRole('radiogroup', { name: 'Attire layout' }).getByRole('radio', { name: 'One card' }).click()

  // ---------------------------------------------------------------- thank-you card
  await page.getByRole('tab', { name: 'Thank-you card' }).click()
  await page.waitForTimeout(2000)
  const thanks = page.getByRole('region', { name: 'Print preview' })
  ok('thank-you card shows the message', (await thanks.getByText('Thank you', { exact: true }).count()) >= 1 && (await thanks.getByText(/Thank you for showering our little one/).count()) >= 1)
  await pane('Print')
  ok('ten copies by default', await page.getByRole('button', { name: 'Print 5 sheets' }).isVisible())
  ok('message fits', (await page.getByText(/message is a little long/).count()) === 0)
  await page.getByLabel('Copies').fill('2')
  await pane('Print')
  await page.getByRole('group', { name: 'Print', exact: true }).getByRole('combobox', { name: 'What to print' }).selectOption('both')
  await page.waitForTimeout(1500)
  ok('back is the monogram', (await thanks.getByText('BACK', { exact: false }).count()) >= 1)
  shots.push(['printables-thanks', await thanks.screenshot()])
  await pane('Content')
  await page.getByRole('radio', { name: 'With each guest’s name' }).click()
  await page.getByLabel('Show everyone').check()
  await page.locator('li', { hasText: 'Tito Joey Montes & Tita Vivian Montes' }).getByRole('checkbox').check()
  await page.waitForTimeout(1500)
  ok('personal thank-you uses the addressed-as', (await thanks.getByText('Tita Vivian Montes', { exact: true }).count()) >= 1 && (await thanks.getByText('DEAR').count()) >= 1)
  shots.push(['printables-thanks-personal', await thanks.screenshot()])

  // ---------------------------------------------------------------- the toolbar stays on screen; search; our details; Good to know for print only
  await page.getByRole('tab', { name: 'Paper invitations' }).click()
  await page.waitForTimeout(800)
  await page.mouse.wheel(0, 500)
  await page.waitForTimeout(400)
  const stuck = await page.evaluate(() => ({
    bar: Math.round(document.querySelector('[data-print-bar]').getBoundingClientRect().top),
    settings: Math.round(document.querySelector('[data-settings]').getBoundingClientRect().top),
    settingsBottom: Math.round(document.querySelector('[data-settings]').getBoundingClientRect().bottom),
    vh: innerHeight,
  }))
  // The settings column sticks too (as far as the preview beside it is tall).
  ok('the print bar and the settings stay on screen while scrolling the preview', stuck.bar >= 0 && stuck.bar <= 24 && stuck.settings <= 24 && stuck.settingsBottom >= stuck.vh * 0.6, JSON.stringify(stuck))
  await page.mouse.wheel(0, -3000)
  await page.waitForTimeout(300)
  await page.mouse.wheel(0, -3000)
  await pane('Page setup')
  shots.push(['printables-ribbon', await page.screenshot()])

  await pane('Content')
  const search = page.getByLabel('Search invitations')
  await search.fill('elv')
  await page.waitForTimeout(300)
  const listed = await page.getByRole('list', { name: 'Invitations' }).getByRole('listitem').count()
  ok('search finds part of a name', listed === 1 && (await page.getByRole('list', { name: 'Invitations' }).getByText('Elvira Arayata', { exact: true }).count()) === 1, String(listed))
  await search.fill('MARIA')
  await page.waitForTimeout(300)
  ok('search finds an included guest, any case', (await page.getByRole('list', { name: 'Invitations' }).getByText('Juan dela Cruz', { exact: true }).count()) === 1)
  await search.fill('zzz')
  ok('search says when no one matches', (await page.getByText(/No one matches/).count()) === 1)
  await search.fill('')
  await page.locator('li', { hasText: 'Elvira Arayata' }).getByRole('checkbox').check()
  await pane('Print')
  await page.getByRole('radiogroup', { name: 'What to print' }).getByRole('radio', { name: 'Both sides' }).click()
  await page.waitForTimeout(1200)
  const inv = page.getByRole('region', { name: 'Print preview' })
  ok('the back shows Good to know from the website', (await inv.getByText('Dress code', { exact: true }).count()) >= 1)

  await pane('Content')
  await page.getByRole('button', { name: 'Edit for print: Dress code' }).click()
  const dlg = page.getByRole('dialog')
  await dlg.getByLabel('Title').fill('What to wear')
  const gtkBox = dlg.getByLabel('Text', { exact: true })
  await gtkBox.fill('Pastels or your team colour, pink or blue.')
  await gtkBox.evaluate((el) => { el.focus(); el.setSelectionRange(0, 7) })
  await dlg.getByRole('button', { name: 'Gold', exact: true }).click()
  ok('Good to know: gold marks the selected word', (await gtkBox.inputValue()) === '==Pastels== or your team colour, pink or blue.', await gtkBox.inputValue())
  await dlg.getByRole('button', { name: 'Save for print' }).click()
  await page.waitForTimeout(1500)
  ok('Good to know prints the gold word', (await inv.locator('.print-sheet').nth(1).locator('span', { hasText: /^Pastels$/ }).count()) >= 1 && !(await inv.locator('.print-sheet').nth(1).innerText()).includes('=='))
  ok('Good to know edited for print', (await inv.getByText('What to wear', { exact: true }).count()) >= 1 && (await inv.getByText('Dress code', { exact: true }).count()) === 0)
  ok('the website keeps its own text', settings.additional_info[0].title === 'Dress code')
  await page.getByRole('button', { name: 'Add your own' }).click()
  await dlg.getByLabel('Title').fill('Parking')
  await dlg.getByLabel('Text', { exact: true }).fill('Free parking at the venue.')
  await dlg.getByRole('button', { name: 'Save for print' }).click()
  await page.waitForTimeout(1500)
  ok('your own Good to know is printed', (await inv.getByText('Parking', { exact: true }).count()) >= 1)
  await page.waitForTimeout(800)
  const gtk = prefWrites.flatMap((w) => (Array.isArray(w) ? w : [w])).filter((w) => w?.key === 'printables').at(-1)?.value
  ok('saved for print only', gtk?.gtkEdits?.g1?.title === 'What to wear' && gtk?.gtkExtra?.[0]?.title === 'Parking', JSON.stringify({ e: gtk?.gtkEdits, x: gtk?.gtkExtra }))
  shots.push(['printables-good-to-know', await inv.locator('.print-sheet').nth(1).screenshot()])

  await pane('Our details')
  const details = page.getByRole('group', { name: 'Our details' }).first()
  await page.locator('fieldset', { hasText: 'Our details' }).getByLabel('Shower date').uncheck()
  await page.locator('fieldset', { hasText: 'Our details' }).getByLabel('Monogram').uncheck()
  await page.waitForTimeout(1200)
  const backText = await inv.locator('.print-sheet').nth(1).innerText()
  ok('our details: date and monogram off on the back', !/MARCH 13, 2027/i.test(backText) && (await inv.locator('.print-sheet').nth(1).locator('svg[viewBox="0 0 40 40"]').count()) === 0, backText.slice(0, 120))
  ok('the front keeps names and date', /MARCH 13, 2027/i.test(await inv.locator('.print-sheet').first().innerText()))
  await page.locator('fieldset', { hasText: 'Our details' }).getByLabel('Shower date').check()
  await page.locator('fieldset', { hasText: 'Our details' }).getByLabel('Monogram').check()
  void details

  await pane('Content')
  await page.getByRole('region', { name: 'Front of the card' }).getByRole('checkbox', { name: 'Venue' }).uncheck()
  await page.waitForTimeout(1000)
  ok('the venue can be left off the front', !/Sample Garden Venue/i.test(await inv.locator('.print-sheet').first().innerText()) && /Baby Santos/i.test(await inv.locator('.print-sheet').first().innerText()))
  await page.getByRole('region', { name: 'Front of the card' }).getByRole('checkbox', { name: 'Venue' }).check()

  // The ceremony line worded for print, with the place name in bold (the website keeps its own).
  await page.getByRole('button', { name: 'Edit for print: Venue' }).click()
  const fd = page.getByRole('dialog', { name: 'Venue — wording for print' })
  const cBox = fd.getByLabel('Venue line', { exact: true })
  ok('venue editor starts from the website’s text', (await cBox.inputValue()) === 'Sample Garden Venue · 2:00 PM', await cBox.inputValue())
  await cBox.evaluate((el) => { el.focus(); el.setSelectionRange(0, 19) })
  await fd.getByRole('button', { name: 'Bold', exact: true }).click()
  ok('Bold marks the selected place name', (await cBox.inputValue()) === '**Sample Garden Venue** · 2:00 PM', await cBox.inputValue())
  ok('preview shows it in bold', (await fd.locator('[data-print-preview] b').innerText()) === 'Sample Garden Venue')
  await cBox.evaluate((el) => { el.focus(); el.setSelectionRange(26, 33) })
  await cBox.press('Control+i')
  ok('Ctrl+I makes the time italic', (await cBox.inputValue()) === '**Sample Garden Venue** · __2:00 PM__', await cBox.inputValue())
  await cBox.evaluate((el) => { el.focus(); el.setSelectionRange(2, 21) })
  await fd.getByRole('button', { name: 'Bold', exact: true }).click()
  ok('Bold again takes it off', (await cBox.inputValue()) === 'Sample Garden Venue · __2:00 PM__', await cBox.inputValue())
  await cBox.evaluate((el) => { el.focus(); el.setSelectionRange(0, 19) })
  await cBox.press('Control+b')
  shots.push(['printables-ceremony-editor', await fd.screenshot()])
  await fd.getByRole('button', { name: 'Save for print' }).click()
  await page.waitForTimeout(1500)
  const frontSheet = inv.locator('.print-sheet').first()
  ok('the card prints the place name in bold', (await frontSheet.locator('b', { hasText: 'Sample Garden Venue' }).count()) >= 1 && (await frontSheet.locator('i', { hasText: '2:00 PM' }).count()) >= 1)
  ok('no marks are printed', !/\*\*|__|==/.test(await frontSheet.innerText()))
  ok('the website keeps its venue text', settings.church_name === 'Sample Garden Venue' && !patches.some((x) => x.table === 'wedding_settings'))
  ok('venue shows “Edited”', (await page.getByRole('region', { name: 'Front of the card' }).getByText('Edited').count()) === 1)
  await page.waitForTimeout(800)
  const ft = prefWrites.flatMap((w) => (Array.isArray(w) ? w : [w])).filter((w) => w?.key === 'printables').at(-1)?.value?.frontText
  ok('saved for print only', ft?.ceremony === '**Sample Garden Venue** · __2:00 PM__' && ft?.reception === undefined, JSON.stringify(ft))
  shots.push(['printables-ceremony-bold', await frontSheet.screenshot()])

  // My paper measures 21.0 × 29.8 cm: everything is centred on it; the back can be moved; the line-up test.
  await pane('Page setup')
  const myPaper = page.getByRole('group', { name: 'My paper' })
  ok('my paper starts at exact A4', (await myPaper.getByLabel('Measured width (cm)').inputValue()) === '21.0' && (await myPaper.getByLabel('Measured height (cm)').inputValue()) === '29.7')
  await myPaper.getByLabel('Measured height (cm)').fill('29.8')
  await myPaper.getByLabel('Measured height (cm)').press('Enter')
  await page.waitForTimeout(800)
  ok('says the sheet is 1 mm longer', /1\.0 mm longer on the long side/.test(await myPaper.innerText()), await myPaper.innerText())
  const shift = await inv.locator('.print-sheet').first().locator('[data-paper-shift]').getAttribute('style')
  ok('the sheet is centred on the real paper (0.5 mm)', /translate\(0\.5mm, ?0mm\)/.test(shift ?? ''), shift)
  await myPaper.getByLabel('Measured height (cm)').fill('31.5')
  await myPaper.getByLabel('Measured height (cm)').press('Enter')
  ok('a wild measurement is refused', (await myPaper.getByRole('alert').count()) === 1)
  await myPaper.getByLabel('Measured height (cm)').fill('29.8')
  await myPaper.getByLabel('Measured height (cm)').press('Enter')
  await page.waitForTimeout(800)
  const pm = prefWrites.flatMap((w) => (Array.isArray(w) ? w : [w])).filter((w) => w?.key === 'printables').at(-1)?.value?.paperMeasured
  ok('my paper is saved', pm?.a4?.w === 210 && pm?.a4?.h === 298, JSON.stringify(pm))
  shots.push(['printables-my-paper', await page.locator('[data-settings]').screenshot()])

  await pane('Print')
  ok('the Printing section opens straight after typing the size', (await sectionButton('Print').getAttribute('aria-expanded')) === 'true')
  const lining = page.getByRole('region', { name: 'Lining up both sides', exact: true })
  ok('invitations have the back line-up', (await lining.count()) === 1 && (await lining.getByText('Back lands').count()) === 0)
  await lining.getByLabel('Move back → (mm)').fill('-1.2')
  await lining.getByLabel('Move back ↓ (mm)').fill('0.3')
  await page.waitForTimeout(1000)
  const backHtml = await inv.locator('.print-sheet').nth(1).innerHTML()
  ok('the back moves by 0.1 mm steps', backHtml.includes('translate(-1.2mm,0.3mm)'), backHtml.slice(0, 200))
  ok('the front does not move', !(await inv.locator('.print-sheet').first().innerHTML()).includes('translate(-1.2mm'))
  await page.getByRole('region', { name: 'Line-up test', exact: true }).getByRole('button', { name: 'Show the line-up test' }).click()
  await page.waitForTimeout(800)
  ok('the line-up test replaces the cards', (await inv.locator('.print-sheet').count()) === 2 && /LINE-UP TEST · FRONT/.test(await inv.locator('.print-sheet').first().innerText()))
  ok('print button prints the test', (await page.getByRole('button', { name: 'Print the line-up test' }).count()) === 1)
  ok('the test back carries the same shift', (await inv.locator('.print-sheet').nth(1).innerHTML()).includes('translate(-1.2mm,0.3mm)'))
  shots.push(['printables-lineup-test', await inv.screenshot()])
  await page.getByRole('region', { name: 'Line-up test', exact: true }).getByRole('button', { name: 'Back to the cards' }).click()
  await lining.getByLabel('Move back → (mm)').fill('0')
  await lining.getByLabel('Move back ↓ (mm)').fill('0')
  await pane('Page setup')
  await myPaper.getByRole('button', { name: 'Exact A4' }).click()
  await page.waitForTimeout(800)
  ok('exact A4 again', (await inv.locator('.print-sheet').first().locator('[data-paper-shift]').count()) === 0)

  // The line-up tools are always there — also when printing fronts first — and on screen on a laptop.
  await page.setViewportSize({ width: 1280, height: 800 })
  await pane('Print')
  await page.getByRole('radiogroup', { name: 'What to print' }).getByRole('radio', { name: 'Fronts' }).click()
  await page.waitForTimeout(800)
  for (const name of ['Lining up both sides', 'Line-up test']) {
    const r = page.getByRole('region', { name, exact: true })
    const box = await r.boundingBox()
    ok(`“${name}” shows with Fronts, inside a 1280 px window`, (await r.isVisible()) && box !== null && box.x >= 0 && box.x + box.width <= 1280, JSON.stringify(box))
  }
  shots.push(['printables-print-pane-1280', await page.screenshot()])
  await page.getByRole('radiogroup', { name: 'What to print' }).getByRole('radio', { name: 'Both sides' }).click()
  await page.setViewportSize({ width: 1500, height: 1000 })
  await page.waitForTimeout(500)
  await pane('Page setup')

  // Border: show or hide the design's frame on every printable (corner marks stay).
  const borderCount = () => inv.locator('.print-sheet').first().locator('svg[style*="pointer-events:none"]').count()
  const withBorder = await borderCount()
  const borderGroup = page.getByRole('radiogroup', { name: 'Border on the cards' })
  await borderGroup.getByRole('radio', { name: 'Hide' }).click()
  await page.waitForTimeout(1000)
  const without = await borderCount()
  ok('Hide removes the border from the cards', withBorder > without && withBorder - without >= 1, `${withBorder} → ${without}`)
  ok('corner marks for cutting stay', /<line|<path/.test(await inv.locator('.print-sheet').first().innerHTML()))
  shots.push(['printables-no-border', await inv.locator('.print-sheet').first().screenshot()])
  await page.waitForTimeout(800)
  const cb = prefWrites.flatMap((w) => (Array.isArray(w) ? w : [w])).filter((w) => w?.key === 'printables').at(-1)?.value?.cardBorder
  ok('border choice is saved', cb === false, String(cb))
  await borderGroup.getByRole('radio', { name: 'Show' }).click()
  await page.waitForTimeout(1000)
  ok('Show brings it back', (await borderCount()) === withBorder)

  // Cards that fit a 5×7 envelope with the stack inside.
  await pane('Page setup')
  await page.getByRole('combobox', { name: 'Card size' }).selectOption('fit')
  await page.waitForTimeout(1200)
  const fitText = await page.getByRole('group', { name: 'Your envelope' }).innerText()
  ok('fits my envelope: smaller than 5×7 for 3 cards', /12\.2 × 17\.1 cm/.test(fitText), fitText.replace(/\s+/g, ' '))
  const cw = await inv.locator('.print-sheet').first().evaluate((el) => {
    const card = el.querySelector(':scope > div[style*="position:absolute"] > div')
    return card ? card.getBoundingClientRect().width / el.getBoundingClientRect().width : 0
  })
  ok('the card prints at that size', Math.abs(cw * 297 - 121.95) < 1.5, String(Math.round(cw * 297 * 10) / 10))
  await page.getByLabel('Cards in each envelope').fill('6')
  await page.waitForTimeout(800)
  ok('more cards in the envelope → a smaller card', /12\.1 × 16\.9 cm/.test(await page.getByRole('group', { name: 'Your envelope' }).innerText()))
  shots.push(['printables-envelope-fit', await page.locator('[data-settings]').screenshot()])
  await page.getByRole('combobox', { name: 'Card size' }).selectOption('5x7')
  await pane('Print')
  await page.getByRole('radiogroup', { name: 'What to print' }).getByRole('radio', { name: 'Fronts' }).click()
  await pane('Page setup')

  // Money envelope: date, ceremony, reception and seal can be left off; names stay.
  await page.getByRole('tab', { name: 'Gift envelope' }).click()
  await page.waitForTimeout(1000)
  await pane('Content')
  await page.getByRole('region', { name: 'Front of the envelope' }).getByLabel('Venue').uncheck()
  await pane('Our details')
  await page.getByLabel('Shower date').uncheck()
  await page.getByLabel(/Monogram seal/).uncheck()
  await page.waitForTimeout(1000)
  const envTxt = await page.getByRole('region', { name: 'Print preview' }).locator('.print-sheet').first().innerText()
  ok('envelope: date and venue off, names stay', !/Sample Garden Venue/i.test(envTxt) && !/MARCH 13, 2027/i.test(envTxt) && /Baby Santos/i.test(envTxt), envTxt.replace(/\s+/g, ' ').slice(0, 160))
  shots.push(['printables-envelope-details', await page.getByRole('region', { name: 'Print preview' }).screenshot()])
  await page.getByLabel('Shower date').check()
  await page.getByLabel(/Monogram seal/).check()
  await pane('Content')
  await page.getByRole('region', { name: 'Front of the envelope' }).getByLabel('Venue').check()
  await pane('Page setup')
  await page.getByRole('tab', { name: 'Paper invitations' }).click()
  await page.waitForTimeout(600)

  // ---------------------------------------------------------------- coloured paper: no background printed; the colour is only for the preview
  settings.motif_colors = [
    { id: 'm1', hex: '#D8C3A0', name: 'Champagne' },
    { id: 'm4', hex: '#A8977A', name: 'Taupe' },
  ]
  await page.reload()
  await page.getByText('Juan dela Cruz', { exact: true }).first().waitFor({ timeout: 20000 })
  await page.locator('li', { hasText: 'Elvira Arayata' }).getByRole('checkbox').check()
  await page.waitForTimeout(1500)
  const pv = page.getByRole('region', { name: 'Print preview' })
  const sheet1 = pv.locator('.print-sheet').first()
  const cardBg = () => sheet1.evaluate((el) => {
    const card = el.querySelector('div[style*="box-sizing:border-box"][style*="font-family"]')
    return card ? getComputedStyle(card).backgroundColor : 'none'
  })
  await pane('Page setup')
  const printOn = page.getByRole('radiogroup', { name: 'Print on' })
  ok('prints as designed by default', (await printOn.getByRole('radio', { name: 'As designed' }).getAttribute('aria-checked')) === 'true' && (await pv.locator('.print-sheet[data-tint]').count()) === 0)
  const designedBg = await cardBg()
  ok('as designed: the card background prints', designedBg !== 'rgba(0, 0, 0, 0)' && designedBg !== 'none', designedBg)
  ok('no paper colour picker as designed', (await page.getByRole('radiogroup', { name: 'Paper colour' }).count()) === 0)

  await printOn.getByRole('radio', { name: 'Coloured paper' }).click()
  await page.waitForTimeout(900)
  const pick = page.getByRole('radiogroup', { name: 'Paper colour' })
  const names = ['Ivory', 'Champagne', 'Blush', 'Kraft', 'Champagne (your motif)', 'Taupe (your motif)']
  const offered = await Promise.all(names.map(async (n) => (await pick.getByRole('radio', { name: n, exact: true }).count()) === 1))
  ok('paper colours offered, with the motif', offered.every(Boolean), names.filter((_, i) => !offered[i]).join(', '))
  ok('champagne paper by default', (await pick.getByRole('radio', { name: 'Champagne', exact: true }).getAttribute('aria-checked')) === 'true')
  ok('coloured paper: no background printed', (await cardBg()) === 'rgba(0, 0, 0, 0)', await cardBg())
  const tint = await sheet1.evaluate((el) => {
    const a = getComputedStyle(el, '::after')
    return [el.dataset.tint, a.backgroundColor, a.mixBlendMode]
  })
  ok('the preview shows the paper colour', tint[0] === '#EADBC0' && tint[1] === 'rgb(234, 219, 192)' && tint[2] === 'multiply', tint.join(' · '))
  ok('seal and ornaments have no fill', (await sheet1.evaluate((el) => [...el.querySelectorAll('svg [fill]')].filter((n) => /^#(e|f)[0-9a-f]{5}$/i.test(n.getAttribute('fill') ?? '')).length)) === 0)
  shots.push(['printables-coloured-picker', await page.getByRole('group', { name: 'Coloured paper' }).screenshot()])
  shots.push(['printables-coloured-champagne', await pv.screenshot()])

  await page.emulateMedia({ media: 'print' })
  const printed = await sheet1.evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el, '::after').display])
  ok('the paper colour is never printed', printed[0] === 'rgb(255, 255, 255)' && printed[1] === 'none', printed.join(' · '))
  await page.emulateMedia({ media: 'screen' })

  await pick.getByRole('radio', { name: 'Kraft', exact: true }).click()
  await page.waitForTimeout(800)
  ok('kraft: the gold prints a shade deeper', (await page.getByText(/gold prints a shade deeper/).count()) === 1)
  ok('kraft: no dark-paper warning', (await page.getByRole('alert').filter({ hasText: /quite dark/ }).count()) === 0)
  shots.push(['printables-coloured-kraft', await pv.screenshot()])
  await page.getByRole('radio', { name: '3D preview' }).click()
  await page.waitForTimeout(1200)
  shots.push(['printables-coloured-3d', await pv.screenshot()])
  await page.getByRole('radio', { name: 'Print sheets' }).click()

  await page.getByLabel('Custom paper colour').fill('#1f2a44')
  await page.waitForTimeout(800)
  ok('dark paper gets a warning', (await page.getByRole('alert').filter({ hasText: /quite dark/ }).count()) === 1)
  ok('a custom colour shows on the preview', (await sheet1.getAttribute('data-tint')) === '#1F2A44')
  await pick.getByRole('radio', { name: 'Taupe (your motif)' }).click()
  await page.waitForTimeout(1500)
  const lastPrefs = prefWrites.flatMap((w) => (Array.isArray(w) ? w : [w])).filter((w) => w?.key === 'printables').at(-1)?.value
  ok('saved with your setup', lastPrefs?.printOn === 'coloured' && lastPrefs?.paperColour === '#A8977A', JSON.stringify(lastPrefs ?? null).slice(0, 160))

  // the envelope and attire guide too (Heritage: the woven band becomes a light hatch)
  await pane('Page setup')
  await page.getByRole('combobox', { name: 'Design', exact: true }).selectOption('heritage')
  await pick.getByRole('radio', { name: 'Champagne', exact: true }).click()
  await page.getByRole('tab', { name: 'Gift envelope' }).click()
  await page.waitForTimeout(1500)
  const env = page.getByRole('region', { name: 'Print preview' })
  const envInfo = await env.locator('.print-sheet').first().evaluate((el) => [el.querySelectorAll('path[fill="transparent"]').length, el.querySelectorAll('pattern rect').length, el.querySelectorAll('pattern path').length])
  ok('envelope: no paper fill, light woven band', envInfo[0] >= 1 && envInfo[1] === 0 && envInfo[2] >= 1, envInfo.join(' · '))
  shots.push(['printables-coloured-envelope', await env.screenshot()])
  await page.getByRole('tab', { name: 'What to wear' }).click()
  await page.waitForTimeout(2500)
  const att = page.getByRole('region', { name: 'Print preview' })
  const frames = await att.locator('.print-sheet').first().evaluate((el) => [...el.querySelectorAll('img')].map((img) => getComputedStyle(img.parentElement.parentElement).boxShadow))
  ok('attire: photo frames are a fine line, no white or shadow', frames.length >= 6 && frames.every((b) => b.includes('inset')), frames[0])
  shots.push(['printables-coloured-attire', await att.screenshot()])

  await pane('Page setup')
  await printOn.getByRole('radio', { name: 'As designed' }).click()
  await page.getByRole('combobox', { name: 'Design', exact: true }).selectOption('classic')
  await page.getByRole('tab', { name: 'Paper invitations' }).click()
  await page.waitForTimeout(1200)
  const anySheet = page.getByRole('region', { name: 'Print preview' }).locator('.print-sheet')
  ok('back to as designed', (await page.getByRole('radiogroup', { name: 'Paper colour' }).count()) === 0 && ((await anySheet.count()) === 0 || (await anySheet.first().getAttribute('data-tint')) === null))
  settings.motif_colors = []

  // ---------------------------------------------------------------- paper sizes: shown with their dimensions; Letter added
  await pane('Page setup')
  const paperSelect = page.getByRole('combobox', { name: 'Paper', exact: true })
  const paperOptions = await paperSelect.locator('option').allInnerTexts()
  ok('paper sizes show their dimensions', paperOptions.join(' | ') === 'A4 · 210 × 297 mm (8.3 × 11.7 in) | Letter · 8.5 × 11 in (216 × 279 mm) | Legal · 8.5 × 14 in (216 × 356 mm)', paperOptions.join(' | '))
  await paperSelect.selectOption('letter')
  await page.locator('li', { hasText: 'Elvira Arayata' }).getByRole('checkbox').check()
  await page.locator('li', { hasText: 'Juan dela Cruz' }).getByRole('checkbox').check()
  await page.waitForTimeout(1500)
  const inside = (sel) =>
    page.getByRole('region', { name: 'Print preview' }).locator('.print-sheet').first().evaluate((el, q) => {
      const r = el.getBoundingClientRect()
      const items = [...el.querySelectorAll(q)].map((n) => n.getBoundingClientRect())
      return { width: el.style.width, n: items.length, fits: items.every((b) => b.left >= r.left - 0.5 && b.right <= r.right + 0.5 && b.top >= r.top - 0.5 && b.bottom <= r.bottom + 0.5) }
    }, sel)
  const letterCards = await inside('div[style*="box-sizing:border-box"][style*="font-family"]')
  ok('Letter: landscape 11 × 8.5 in sheet, 2 cards that fit', letterCards.width === '279.4mm' && letterCards.n === 2 && letterCards.fits, JSON.stringify(letterCards))
  ok('Letter: the print dialog gets the Letter page size', (await page.evaluate(() => [...document.querySelectorAll('style')].some((st) => /size:\s*279\.4mm 215\.9mm/.test(st.textContent ?? '')))))
  shots.push(['printables-letter', await page.getByRole('region', { name: 'Print preview' }).screenshot()])
  await page.getByRole('tab', { name: 'Gift envelope' }).click()
  await page.waitForTimeout(1200)
  const letterEnv = await inside(':scope > div > svg')
  ok('Letter: the envelope fits the sheet', letterEnv.n === 1 && letterEnv.fits, JSON.stringify(letterEnv))
  await page.waitForTimeout(800)
  const savedPaper = prefWrites.flatMap((w) => (Array.isArray(w) ? w : [w])).filter((w) => w?.key === 'printables').at(-1)?.value?.paper
  ok('Letter is saved with your setup', savedPaper === 'letter', String(savedPaper))
  await paperSelect.selectOption('a4')
  await page.getByRole('tab', { name: 'Paper invitations' }).click()
  await page.waitForTimeout(800)

  // ---------------------------------------------------------------- money envelope: flaps fold inside, the back is clear
  const region = () => page.getByRole('region', { name: 'Print preview' })
  await page.getByRole('tab', { name: 'Gift envelope' }).click()
  await page.waitForTimeout(1200)
  ok('envelope: GLUE marks on the two inside flaps', (await region().getByText('GLUE · FOLDS INSIDE').count()) === 2)
  ok('envelope: no GLUE on the back', (await region().getByText('GLUE', { exact: true }).count()) === 0)
  ok('envelope: folding steps say inwards', (await page.getByText(/bottom flap inwards/).count()) === 1)
  shots.push(['printables-envelope-inside', await region().screenshot()])

  // ---------------------------------------------------------------- name cards: folded stands, 2 per sheet
  await page.getByRole('tab', { name: 'Name cards' }).click()
  await page.waitForTimeout(800)
  ok('name cards: nothing ticked yet', (await region().getByText(/Tick guests in the list/).count()) === 1)
  await page.getByLabel('Show everyone').check()
  await page.getByRole('button', { name: 'Select all' }).click()
  await page.getByLabel('More names').fill('Lola Nena | Family')
  await page.waitForTimeout(1500)
  const ncSheets = region().locator('.print-sheet')
  ok('name cards: 9 stands on 5 sheets', (await ncSheets.count()) === 5, String(await ncSheets.count()))
  ok('name cards: the name reads on both faces', (await region().locator('text', { hasText: 'Juan dela Cruz' }).count()) === 2)
  ok('name cards: one face upside down', (await ncSheets.first().locator('g[transform*="rotate(180)"]').count()) === 2)
  ok('name cards: shows the table from Seating', (await region().locator('text', { hasText: 'Table · Godparents' }).count()) >= 2)
  ok('name cards: extra names with their table', (await region().locator('text', { hasText: 'Lola Nena' }).count()) === 2 && (await region().locator('text', { hasText: 'Table · Family' }).count()) === 2)
  ok('name cards: included guests too', (await region().locator('text', { hasText: 'Maria dela Cruz' }).count()) === 2)
  shots.push(['printables-name-cards', await ncSheets.first().screenshot()])
  await pane('Content')
  await page.getByRole('radiogroup', { name: 'Stands per sheet' }).getByRole('radio', { name: /^4/ }).click()
  await page.waitForTimeout(800)
  ok('name cards: 4 per sheet', (await ncSheets.count()) === 3)
  shots.push(['printables-name-cards-4', await ncSheets.first().screenshot()])

  // ---------------------------------------------------------------- table names: flat, both sides, lined up
  await page.getByRole('tab', { name: 'Table names' }).click()
  await page.waitForTimeout(1200)
  await page.getByLabel('More table names').fill('Barkada')
  await page.waitForTimeout(1000)
  const tSheets = region().locator('.print-sheet')
  ok('table names: 4 names → 2 fronts + 2 backs', (await tSheets.count()) === 4, String(await tSheets.count()))
  const lefts = async (i) => tSheets.nth(i).evaluate((el) => [...el.querySelectorAll(':scope > div[style*="position:absolute"][style*="overflow:hidden"]')].map((d) => [d.style.left, d.querySelector('text')?.parentElement?.textContent?.includes('Godparents') ?? false]))
  const f0 = await lefts(0)
  const b0 = await lefts(1)
  ok('table names: front left card is Godparents', f0[0]?.[0] === '12mm' && f0[0]?.[1] === true, JSON.stringify(f0))
  ok('table names: its back is on the mirrored side', b0[0]?.[0] === '154.5mm' && b0[0]?.[1] === true, JSON.stringify(b0))
  await pane('Print')
  await page.getByLabel('Move back → (mm)').fill('1.5')
  await page.waitForTimeout(800)
  ok('table names: the printer offset moves the back', (await lefts(1))[0]?.[0] === '156mm', JSON.stringify(await lefts(1)))
  ok('table names: the front stays put', (await lefts(0))[0]?.[0] === '12mm')
  shots.push(['printables-table-front', await tSheets.nth(0).screenshot()])
  shots.push(['printables-table-back', await tSheets.nth(1).screenshot()])
  await page.getByRole('button', { name: 'Show the line-up test' }).click()
  await page.waitForTimeout(800)
  ok('line-up test: front and back', (await tSheets.count()) === 2 && (await region().getByText(/LINE-UP TEST · FRONT/).count()) === 1 && (await region().getByText(/LINE-UP TEST · BACK/).count()) === 1)
  shots.push(['printables-lineup-back', await tSheets.nth(1).screenshot()])
  await page.getByRole('button', { name: 'Back to the cards' }).click()
  await pane('Content')
  await page.getByRole('radiogroup', { name: 'Style' }).getByRole('radio', { name: 'Folded stand' }).click()
  await page.waitForTimeout(1000)
  ok('table names: big stand, one per sheet', (await tSheets.count()) === 4 && (await region().locator('text', { hasText: 'Barkada' }).count()) === 2)
  shots.push(['printables-table-stand', await tSheets.first().screenshot()])
  await page.getByRole('radiogroup', { name: 'Style' }).getByRole('radio', { name: 'Flat card, both sides' }).click()

  // ---------------------------------------------------------------- leaflets: build your own from blocks
  await page.getByRole('tab', { name: 'Leaflets' }).click()
  await page.waitForTimeout(800)
  ok('leaflets: start from a ready-made one', (await region().getByText(/Start a leaflet in the panel/).count()) === 1)
  await page.getByRole('button', { name: 'Guest info card' }).click()
  await page.waitForTimeout(2500)
  const lSheets = region().locator('.print-sheet')
  ok('leaflets: info card, 4 per sheet', (await lSheets.count()) === 1 && (await region().getByText('Our website', { exact: true }).count()) === 4, String(await region().getByText('Our website', { exact: true }).count()))
  ok('leaflets: three QR codes each', (await lSheets.first().locator('svg path').count()) >= 12)
  ok('leaflets: fits', (await page.getByText(/too full for this size/).count()) === 0)
  shots.push(['printables-leaflet-info', await lSheets.first().screenshot()])
  await page.getByLabel('Add a block').selectOption('heading')
  await page.waitForTimeout(500)
  const heads = page.getByRole('list', { name: 'Front blocks' }).getByLabel('Heading')
  await heads.last().fill('See you at the shower!')
  await page.waitForTimeout(1500)
  ok('leaflets: a new block shows on the card', (await region().getByText('See you at the shower!').count()) === 4)
  await page.getByRole('button', { name: 'Program' }).click()
  await page.waitForTimeout(2000)
  await pane('Print')
  await page.getByRole('group', { name: 'Print', exact: true }).getByRole('combobox', { name: 'What to print' }).selectOption('both')
  await page.waitForTimeout(1200)
  ok('leaflets: program prints both sides', (await lSheets.count()) === 4 && (await region().getByText('Thank you', { exact: true }).count()) >= 2, String(await lSheets.count()))
  ok('leaflets: program lines', (await region().getByText('GENDER REVEAL').count()) + (await region().getByText('Gender Reveal').count()) >= 2)
  shots.push(['printables-leaflet-program', await lSheets.first().screenshot()])
  shots.push(['printables-leaflet-program-back', await lSheets.nth(1).screenshot()])
  await page.waitForTimeout(900)
  const savedLeaflets = prefWrites.flatMap((w) => (Array.isArray(w) ? w : [w])).filter((w) => w?.key === 'printables').at(-1)?.value?.leaflets
  ok('leaflets are saved', Array.isArray(savedLeaflets) && savedLeaflets.length === 2, String(savedLeaflets?.length))
  ok('no page errors (table printables)', errors.length === 0, errors.join(' | '))

  // ---------------------------------------------------------------- Outfit Gallery admin: side by side, one label per pair
  await page.goto(`${BASE}#/admin/outfits`)
  await page.locator('#pair-label-0').waitFor({ timeout: 15000 })
  ok('admin shows the layout choice', (await page.getByRole('radio', { name: 'His & hers side by side' }).getAttribute('aria-checked')) === 'true')
  ok('pairs show one label each', (await page.locator('#pair-label-0').inputValue()) === 'Parents-to-be' && (await page.locator('#pair-label-3').inputValue()) === '')
  ok('no per-photo label boxes when side by side', (await page.locator('#label-o1').count()) === 0)
  const patchesBefore = patches.length
  await page.locator('[data-pair-row="3"]').getByRole('button', { name: 'Team Pink' }).click()
  await page.waitForTimeout(900)
  const saved = patches.slice(patchesBefore)
  ok('a pair label is saved to both photos', saved.length === 2 && saved.every((x) => x.body.label === 'Team Pink') && saved.map((x) => x.id).sort().join() === 'o3,o6', JSON.stringify(saved))
  shots.push(['admin-outfit-pairs', await page.locator('section', { has: page.locator('#pairs-heading') }).screenshot()])
  await page.getByRole('radio', { name: 'For Him / For Her tabs' }).click()
  await page.locator('#label-o1').waitFor({ timeout: 5000 })
  ok('tabs layout brings back per-photo labels', (await page.locator('#label-o1').inputValue()) === 'Parents-to-be')
  ok('no page errors (printables)', errors.length === 0, errors.join(' | '))
  await ctx.close()

  // ---------------------------------------------------------------- website: his & hers side by side
  const hctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await hctx.route(`${API}/**`, handle)
  await hctx.route('**/attire/**', photo)
  const h = await hctx.newPage()
  const herr = []
  h.on('pageerror', (e) => herr.push(String(e)))
  await h.goto(`${BASE}#/`)
  const heading = h.locator('#outfits-heading')
  await heading.waitFor({ timeout: 20000 })
  await heading.scrollIntoViewIfNeeded()
  await h.waitForTimeout(2000)
  const section = h.locator('section', { has: heading })
  ok('website shows four pairs', (await section.locator('[data-outfit-pair]').count()) === 4)
  ok('one label per pair', (await section.getByText('Parents-to-be', { exact: true }).count()) === 1 && (await section.getByText('Family', { exact: true }).count()) === 1)
  ok('no For Him / For Her tabs', (await section.getByRole('tab').count()) === 0)
  const imgs = await section.locator('img').evaluateAll((els) => els.map((e) => [e.getAttribute('src'), e.naturalWidth, e.naturalHeight]))
  ok('all photos load in 3:4', imgs.length === 8 && imgs.every(([, w, hh]) => w === 900 && hh === 1200), JSON.stringify(imgs.map((x) => x[0])))
  shots.push(['website-attire', await section.screenshot()])
  await section.locator('[data-outfit-pair]').nth(1).scrollIntoViewIfNeeded()
  await section.getByRole('button', { name: 'Next outfits' }).click()
  await h.waitForTimeout(1200)
  shots.push(['website-attire-next', await section.screenshot()])
  await section.locator('[data-outfit-pair]').first().getByRole('button').click()
  const dialog = h.getByRole('dialog')
  await dialog.waitFor({ timeout: 5000 })
  await h.waitForTimeout(700)
  ok('enlarged view shows the pair', (await dialog.locator('img').count()) === 2 && (await dialog.getByText('Parents-to-be').count()) === 1)
  shots.push(['website-attire-lightbox', await h.screenshot()])
  await h.keyboard.press('Escape')

  // the tabs layout still works
  settings.outfit_layout = 'tabs'
  const tctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await tctx2.route(`${API}/**`, handle)
  await tctx2.route('**/attire/**', photo)
  const t2 = await tctx2.newPage()
  t2.on('pageerror', (e) => herr.push(String(e)))
  await t2.goto(`${BASE}#/`)
  await t2.locator('#outfits-heading').waitFor({ timeout: 20000 })
  const sec2 = t2.locator('section', { has: t2.locator('#outfits-heading') })
  await sec2.scrollIntoViewIfNeeded()
  await t2.waitForTimeout(1500)
  ok('tabs layout still works', (await sec2.getByRole('tab', { name: 'For Her' }).count()) === 1 && (await sec2.locator('[data-outfit-pair]').count()) === 0)
  await tctx2.close()
  settings.outfit_layout = 'pairs'
  ok('no page errors (website)', herr.length === 0, herr.join(' | '))
  await hctx.close()

  // ---------------------------------------------------------------- online invitation shows it too
  const gctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  await gctx.route(`${API}/**`, handle)
  await gctx.route('**/attire/**', photo)
  const g = await gctx.newPage()
  const gerr = []
  g.on('pageerror', (e) => gerr.push(String(e)))
  await g.goto(`${BASE}#/i/JUAN1`)
  await g.getByRole('button', { name: /Open your invitation/ }).waitFor({ timeout: 20000 })
  await g.waitForTimeout(1500)
  ok('online envelope is addressed', (await g.getByRole('button', { name: 'Open your invitation, Juan & Maria dela Cruz' }).count()) === 1)
  shots.push(['online-envelope-addressed', await g.screenshot()])
  await g.goto(`${BASE}#/i/ELVI2`)
  await g.getByRole('button', { name: /Open your invitation/ }).waitFor({ timeout: 20000 })
  ok('others keep their usual name', (await g.getByRole('button', { name: 'Open your invitation, Elvira Arayata' }).count()) === 1)
  ok('no page errors (online)', gerr.length === 0, gerr.join(' | '))
  await gctx.close()
} catch (e) {
  ok('script', false, String(e))
  if (current) {
    shots.push(['printables-failure', await current.screenshot({ fullPage: true }).catch(() => Buffer.alloc(0))])
    console.log('DEBUG panes', await current.evaluate(() => [...document.querySelectorAll('[role=tabpanel]')].map((p) => `${p.id}:${p.hidden}:${getComputedStyle(p).display}:${p.childElementCount}`).join(' ')).catch((x) => String(x)))
  }
} finally {
  await browser.close()
}
for (const [name, png] of shots) writeFileSync(`${OUT}/${name}.png`, png)
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
