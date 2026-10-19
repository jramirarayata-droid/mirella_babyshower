// Raffle & Bingo Present on a TV-sized screen (host mode, mocked backend — nothing live is touched):
// true full screen, knocked-out names stacking on the left, winners on the right,
// and the lists holding still while a big reveal is showing.
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

const HOST = 'host-tok-1234567890123456789012345'
const ALL = ['Ana Santos', 'Ben Reyes', 'Carlo Cruz', 'Dina Ramos', 'Eli Garcia', 'Faye Mendoza', 'Gino Aquino', 'Hana Castillo']
const PRIZES = ['₱10,000', '₱5,000', '₱2,000']
const CONS = 2
const FINALS = 3
const game = { eliminated: [], draws: [] }
const live = () => ALL.filter((n) => !game.eliminated.includes(n))
const key = (n) => n.toLowerCase().replace(/\s+/g, '-')
const ord = (p) => `${p}${p === 1 ? 'st' : p === 2 ? 'nd' : p === 3 ? 'rd' : 'th'}`

function land(k) {
  const names = live()
  const name = names.find((n) => key(n) === k)
  const left = names.length
  const place = left >= 2 && left <= CONS + 1 ? left : null
  game.eliminated.push(name)
  if (place) game.draws.push({ name, prize: PRIZES[place - 1], place })
  let then
  if (left - 1 === 1) {
    const other = names.find((n) => n !== name)
    game.draws.push({ name: other, prize: PRIZES[0], place: 1 })
    then = { tone: 'winner', title: 'Winner — last one standing', name: other, detail: PRIZES[0] }
  }
  return { tone: place ? 'place' : 'out', title: place ? `${ord(place)} place` : 'Out', name, detail: place ? PRIZES[place - 1] : `${left - 1} left`, then }
}

async function handle(route) {
  const req = route.request()
  const url = new URL(req.url())
  const p = url.pathname
  const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) })
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
  if (p.startsWith('/rest/v1/rpc/')) {
    const fn = p.slice('/rest/v1/rpc/'.length)
    const a = JSON.parse(req.postData() || '{}')
    switch (fn) {
      case 'host_check':
        return json({ host: a.p_token === HOST, codeOn: true })
      case 'public_display_prefs':
        return json({ card: {}, website: {}, sharePreviewUrl: null, raffleVisible: true, monogram: null })
      case 'raffle_host_state':
        return json({ host: true, visible: true, masked: false, drawMode: 'last', consolations: CONS, finalsAt: FINALS, prizes: PRIZES, knockedOut: game.eliminated.length, names: live().map((n) => ({ k: key(n), n })) })
      case 'raffle_host_land':
        return json(land(a.p_key))
      case 'raffle_host_board': {
        const won = new Set(game.draws.map((d) => d.name))
        return json({ host: true, visible: true, out: game.eliminated.filter((n) => !won.has(n)), winners: game.draws })
      }
      default:
        return json(null)
    }
  }
  const accept = req.headers()['accept'] ?? ''
  if (p.startsWith('/rest/v1/wedding_settings')) {
    const row = { id: 'ws1', couple_names: 'Mir & Ella', wedding_date: '2026-12-19', entourage: [], sections: [], motif_colors: [], seating_config: { finder: { from: null, mode: 'visible', preassign: false } } }
    return accept.includes('vnd.pgrst.object') ? json(row) : json([row])
  }
  if (p.startsWith('/rest/v1/')) return accept.includes('vnd.pgrst.object') ? json({ message: 'none' }, 406) : json([])
  return json({})
}

const browser = await chromium.launch()
const shots = []
let current = null
try {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, reducedMotion: 'reduce' })
  await ctx.route(`${API}/**`, handle)
  await ctx.addInitScript((t) => localStorage.setItem('wedding-raffle-host', t), HOST)
  const page = await ctx.newPage()
  current = page
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(`${BASE}#/raffle`)
  await page.getByRole('button', { name: 'Present' }).waitFor({ timeout: 20000 })
  await page.waitForTimeout(800)

  // ---------------------------------------------------------------- full screen
  await page.getByRole('button', { name: 'Present' }).click()
  const stage = page.getByRole('dialog', { name: 'Raffle' })
  await stage.waitFor({ timeout: 5000 })
  await page.waitForTimeout(600)
  ok('Present goes true full screen', await page.evaluate(() => Boolean(document.fullscreenElement)))
  ok('full-screen and close buttons', (await page.getByRole('button', { name: 'Exit full screen' }).count()) === 1 && (await page.getByRole('button', { name: 'Close' }).count()) === 1)
  ok('lists beside the wheel', (await stage.locator('[data-raffle-out]').isVisible()) && (await stage.locator('[data-raffle-winners]').isVisible()))
  ok('winners list starts empty', (await stage.getByText('Who will it be?').count()) === 1)
  const fit = await stage.evaluate((el) => [el.scrollHeight, el.clientHeight])
  ok('Present fits the screen (1600 × 900)', fit[0] <= fit[1] + 2, `${fit[0]} ≤ ${fit[1]}`)

  const spinBtn = stage.getByRole('button', { name: /^(Quick spin|Spin)$/ })
  const outItems = stage.locator('[data-raffle-out] li')
  const winItems = stage.locator('[data-raffle-winners] li')
  const spinOnce = async () => {
    await spinBtn.click()
    await page.waitForTimeout(900)
  }

  // ---------------------------------------------------------------- knocked out: stack on the left, newest on top
  for (let i = 0; i < 5; i++) await spinOnce()
  ok('five names knocked out on the left', (await outItems.count()) === 5, `${await outItems.count()}`)
  const newest = game.eliminated[game.eliminated.length - 1]
  ok('newest knocked-out name on top', (await outItems.first().innerText()).includes(newest), `${await outItems.first().innerText()} / ${newest}`)
  ok('wheel shows 3 left', (await stage.getByText('3 left', { exact: true }).count()) >= 1)
  shots.push(['raffle-present-outs', await page.screenshot()])

  // ---------------------------------------------------------------- 3rd place: held during the reveal, then appears on the right
  await spinOnce()
  await page.waitForTimeout(500)
  ok('reveal holds the winners list', (await winItems.count()) === 0)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(900)
  ok('3rd place joins the winners after the reveal', (await winItems.count()) === 1 && /3rd place/i.test(await winItems.first().innerText()), await winItems.first().innerText().catch(() => ''))
  ok('Escape on a reveal doesn’t close Present', await stage.isVisible())

  // ---------------------------------------------------------------- 2nd place, then the winner
  await spinOnce()
  await page.waitForTimeout(2600) // the winner follows the 2nd place reveal
  await page.keyboard.press('Escape')
  await page.waitForTimeout(1000)
  const winTexts = await winItems.allInnerTexts()
  ok('three winners, newest on top', winTexts.length === 3 && /winner/i.test(winTexts[0]) && /2nd place/i.test(winTexts[1]) && /3rd place/i.test(winTexts[2]), winTexts.map((t) => t.replace(/\s+/g, ' ')).join(' | '))
  ok('the winner gets the crown and the prize', (await winItems.first().locator('svg').count()) >= 1 && winTexts[0].includes('₱10,000'))
  ok('places aren’t in the knocked-out list', (await outItems.count()) === 5)
  ok('round complete', (await stage.getByText('We have a winner').count()) === 1)
  shots.push(['raffle-present-winners', await page.screenshot()])

  for (const [w, h] of [[1280, 720], [1920, 1080]]) {
    await page.setViewportSize({ width: w, height: h })
    await page.waitForTimeout(500)
    const f = await stage.evaluate((el) => [el.scrollHeight, el.clientHeight])
    ok(`Present fits the screen (${w} × ${h})`, f[0] <= f[1] + 2, `${f[0]} ≤ ${f[1]}`)
  }
  shots.push(['raffle-present-1080p', await page.screenshot()])
  await page.setViewportSize({ width: 1600, height: 900 })

  // ---------------------------------------------------------------- close
  await page.getByRole('button', { name: 'Close' }).click()
  await page.waitForTimeout(600)
  ok('Close leaves full screen and Present', !(await page.evaluate(() => Boolean(document.fullscreenElement))) && (await page.getByRole('dialog', { name: 'Raffle' }).count()) === 0)

  // ---------------------------------------------------------------- Bingo too
  await page.getByRole('tab', { name: /Bingo/ }).click()
  await page.getByRole('button', { name: 'Present' }).waitFor({ timeout: 10000 })
  await page.getByRole('button', { name: 'Present' }).click()
  await page.getByRole('dialog', { name: 'Bingo' }).waitFor({ timeout: 5000 })
  await page.waitForTimeout(600)
  ok('Bingo Present goes true full screen', await page.evaluate(() => Boolean(document.fullscreenElement)))
  shots.push(['bingo-present', await page.screenshot()])
  await page.getByRole('button', { name: 'Close' }).click()
  await page.waitForTimeout(500)
  ok('Bingo Close leaves full screen', !(await page.evaluate(() => Boolean(document.fullscreenElement))))
  ok('no page errors', errors.length === 0, errors.join(' | '))
  await ctx.close()
} catch (e) {
  ok('script', false, String(e).slice(0, 400))
  if (current) {
    const boxes = await current.evaluate(() => {
      const r = (el) => (el ? (({ x, y, width, height }) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(width), h: Math.round(height) }))(el.getBoundingClientRect()) : null)
      const dlg = document.querySelector('[aria-label="Raffle"]')
      const wheel = dlg?.querySelector('[role="img"]')
      const btn = [...(dlg?.querySelectorAll('button') ?? [])].find((b) => /spin/i.test(b.textContent ?? ''))
      return { viewport: [innerWidth, innerHeight], dialog: r(dlg), scroll: dlg ? [dlg.scrollTop, dlg.scrollHeight] : null, wheel: r(wheel), wheelParent: r(wheel?.parentElement), button: r(btn), grid: r(wheel?.closest('.grid')) }
    }).catch((err) => String(err))
    console.log('DEBUG', JSON.stringify(boxes))
    shots.push(['raffle-failure', await current.screenshot().catch(() => Buffer.alloc(0))])
  }
} finally {
  await browser.close()
}
for (const [name, png] of shots) writeFileSync(`${OUT}/${name}.png`, png)
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
