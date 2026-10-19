/*
 * After signing in, quietly download every admin page in the background so
 * switching between them is instant (each page's code otherwise downloads the
 * first time it's opened, which feels like lag).
 */
let started = false

export function prefetchAdminPages() {
  if (started) return
  started = true
  const pages = [
    () => import('../pages/AdminDashboard'),
    () => import('../pages/AdminInvitations'),
    () => import('../pages/AdminPrintables'),
    () => import('../pages/AdminResponses'),
    () => import('../pages/AdminGuests'),
    () => import('../pages/AdminQuestions'),
    () => import('../pages/AdminSeating'),
    () => import('../pages/AdminRaffle'),
    () => import('../pages/AdminMedia'),
    () => import('../pages/AdminGuestPhotos'),
    () => import('../pages/AdminMusic'),
    () => import('../pages/AdminOutfits'),
    () => import('../pages/AdminEntourage'),
    () => import('../pages/AdminLookFeel'),
    () => import('../pages/AdminSchedule'),
    () => import('../pages/AdminSettings'),
    () => import('../pages/AdminShare'),
  ]
  const idle = (fn: () => void) => {
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback
    if (ric) ric.call(window, fn)
    else window.setTimeout(fn, 300)
  }
  // A couple at a time, so the page you're on stays smooth.
  let i = 0
  const next = () => {
    const batch = pages.slice(i, i + 2)
    i += 2
    if (!batch.length) return
    Promise.allSettled(batch.map((p) => p())).then(() => idle(next))
  }
  window.setTimeout(() => idle(next), 1200)
}
