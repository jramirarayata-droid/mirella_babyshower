// Loads public pages of the live site like a guest's phone on mobile data
// (slow 4G, slower CPU) and reports what was downloaded and how long it took.
// Read-only: it only visits pages, the same as any guest.
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const SITE = process.argv[2]
const OUT = process.argv[3] ?? '/tmp'
const pages = [['home', '#/'], ['rsvp', '#/rsvp'], ['photos', '#/photos'], ['raffle', '#/raffle']]
const lines = []
const log = (s) => { console.log(s); lines.push(s) }

const browser = await chromium.launch()
for (const [name, hash] of pages) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36' })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e)))
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('favicon')) errs.push(`${r.status()} ${r.url().slice(0, 100)}`) })
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  const reqs = new Map()
  cdp.on('Network.responseReceived', (e) => reqs.set(e.requestId, { url: e.response.url, type: e.type, status: e.response.status, bytes: 0 }))
  cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) r.bytes = e.encodedDataLength })
  await page.addInitScript(() => {
    window.__lcp = 0
    window.__cls = 0
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true })
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true })
  })
  const t0 = Date.now()
  await page.goto(SITE + hash, { waitUntil: 'load', timeout: 120000 })
  const loadMs = Date.now() - t0
  await page.waitForTimeout(6000)
  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0
    return { fcp: Math.round(fcp), lcp: Math.round(window.__lcp), dcl: Math.round(nav.domContentLoadedEventEnd) }
  })
  const all = [...reqs.values()]
  const by = {}
  for (const r of all) {
    const host = new URL(r.url).host
    const kind = r.type === 'Script' ? 'js' : r.type === 'Stylesheet' ? 'css' : r.type === 'Image' ? 'img' : r.type === 'Font' ? 'font' : r.type === 'Media' ? 'media' : r.type === 'Fetch' || r.type === 'XHR' ? 'api' : r.type.toLowerCase()
    by[kind] = by[kind] ?? { n: 0, kb: 0 }
    by[kind].n++
    by[kind].kb += r.bytes / 1024
  }
  const total = all.reduce((s, r) => s + r.bytes, 0) / 1024
  log(`\n== ${name}: load ${loadMs} ms · first paint ${m.fcp} ms · largest paint ${m.lcp} ms · ${all.length} requests · ${Math.round(total)} KB`)
  for (const [k, v] of Object.entries(by).sort((a, b) => b[1].kb - a[1].kb)) log(`   ${k.padEnd(6)} ${String(v.n).padStart(3)} req ${String(Math.round(v.kb)).padStart(6)} KB`)
  for (const r of all.sort((a, b) => b.bytes - a.bytes).slice(0, 12)) log(`   ${String(Math.round(r.bytes / 1024)).padStart(6)} KB  ${r.type.padEnd(10)} ${r.url.replace(/\?.*$/, '').slice(0, 110)}`)
  log(`   problems: ${errs.length ? errs.join(' | ') : 'none'}`)
  log(`   title: ${await page.title()}`)
  writeFileSync(`${OUT}/${new URL(SITE).host.split('.')[0]}-${name}.png`, await page.screenshot())
  if (name === 'home') {
    // Scroll through the whole page like a guest: what the photos cost, and how much the page jumps.
    const imgBefore = all.filter((r) => r.type === 'Image').reduce((s2, r) => s2 + r.bytes, 0)
    const ts = Date.now()
    for (let y = 0; y < 40; y++) {
      const done = await page.evaluate(() => {
        window.scrollBy(0, Math.round(innerHeight * 0.8))
        return innerHeight + scrollY >= document.documentElement.scrollHeight - 4
      })
      await page.waitForTimeout(350)
      if (done) break
    }
    await page.waitForTimeout(5000)
    const after = [...reqs.values()]
    const imgs = after.filter((r) => r.type === 'Image')
    const imgKb = imgs.reduce((s2, r) => s2 + r.bytes, 0) / 1024
    const cls = await page.evaluate(() => Math.round(window.__cls * 1000) / 1000)
    log(`   scrolled to the end in ${Date.now() - ts} ms: ${imgs.length} images · ${Math.round(imgKb)} KB of images (${Math.round((imgKb * 1024 - imgBefore) / 1024)} KB while scrolling) · layout shift ${cls}`)
    for (const r of imgs.sort((a, b) => b.bytes - a.bytes).slice(0, 8)) log(`     ${String(Math.round(r.bytes / 1024)).padStart(6)} KB  ${r.url.replace(/\?.*$/, '').slice(0, 100)}`)
  }
  await ctx.close()
}
await browser.close()
writeFileSync(`${OUT}/perf-${new URL(SITE).host.split('.')[0]}.txt`, lines.join('\n'))
