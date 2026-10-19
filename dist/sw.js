/*
 * Keeps the website's own files on the guest's phone so pages (above all
 * Find My Seat) still open at the venue without signal.
 *
 * - Pages: network first — online you always get the newest version; offline,
 *   the last copy is used.
 * - /assets/* (fingerprinted, never change) and Google Fonts: kept once loaded.
 * - Data (Supabase), photos and everything else are NEVER stored here. The
 *   guest's own seat is kept separately by the page itself.
 */
const VERSION = 'shower-offline-v1'
const MAX_ASSETS = 80

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k)
      await self.clients.claim()
    })(),
  )
})

async function trim(cache) {
  const keys = await cache.keys()
  for (let i = 0; i < keys.length - MAX_ASSETS; i++) await cache.delete(keys[i])
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  const sameOrigin = url.origin === self.location.origin
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'

  // The page itself: newest first, saved copy when offline.
  if (req.mode === 'navigate' && sameOrigin) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(VERSION)
        try {
          const res = await fetch(req)
          if (res.ok) await cache.put('/', res.clone())
          return res
        } catch {
          return (await cache.match('/')) || Response.error()
        }
      })(),
    )
    return
  }

  // Fingerprinted files and fonts: once loaded, keep them.
  if ((sameOrigin && url.pathname.startsWith('/assets/')) || isFont) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(VERSION)
        const hit = await cache.match(req)
        if (hit) return hit
        const res = await fetch(req)
        if (res.ok || res.type === 'opaque') {
          await cache.put(req, res.clone())
          void trim(cache)
        }
        return res
      })(),
    )
  }
  // Anything else (data, photos, the admin's requests): straight to the network, never stored.
})
