import { lazy, Suspense, type ComponentType } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { isSupabaseConfigured } from './lib/supabase'
import { AuthProvider } from './components/admin/AuthProvider'
import { HostProvider } from './components/host/HostProvider'
import { ProtectedRoute } from './components/admin/ProtectedRoute'
import { ToastProvider } from './components/ui/ToastProvider'
import { MusicPlayer } from './components/wedding/MusicPlayer'
import { PageLoader } from './components/ui/Spinner'
import { SetupNotice } from './components/ui/SetupNotice'
import { ScrollToTop } from './components/ui/ScrollToTop'
import { ThemeProvider } from './theme/ThemeProvider'
import { CrashTest, PageErrorBoundary } from './components/ui/ErrorBoundary'
import Home from './pages/Home'
import RSVP from './pages/RSVP'
import NotFound from './pages/NotFound'

/*
 * After a new version is published, a tab that was already open may ask for a
 * page file that no longer exists. Reload once to pick up the new version
 * instead of showing a blank page.
 */
const RELOAD_KEY = 'wedding-chunk-reload'
function page<T extends ComponentType>(load: () => Promise<{ default: T }>) {
  return lazy(() =>
    load()
      .then((m) => {
        try {
          sessionStorage.removeItem(RELOAD_KEY)
        } catch {
          /* ignore */
        }
        return m
      })
      .catch((e: unknown) => {
        let reloaded = false
        try {
          reloaded = sessionStorage.getItem(RELOAD_KEY) === '1'
          if (!reloaded) sessionStorage.setItem(RELOAD_KEY, '1')
        } catch {
          reloaded = true
        }
        if (!reloaded) {
          window.location.reload()
          return new Promise<{ default: T }>(() => undefined)
        }
        throw e
      }),
  )
}

// Admin code (and the charting library) is only downloaded by administrators.
const AdminLogin = page(() => import('./pages/AdminLogin'))
const AdminLayout = page(() => import('./layouts/AdminLayout'))
const AdminDashboard = page(() => import('./pages/AdminDashboard'))
const AdminInvitations = page(() => import('./pages/AdminInvitations'))
const AdminResponses = page(() => import('./pages/AdminResponses'))
const AdminGuests = page(() => import('./pages/AdminGuests'))
const AdminSettings = page(() => import('./pages/AdminSettings'))
const AdminOutfits = page(() => import('./pages/AdminOutfits'))
const AdminMedia = page(() => import('./pages/AdminMedia'))
const AdminLookFeel = page(() => import('./pages/AdminLookFeel'))
const AdminShare = page(() => import('./pages/AdminShare'))
const AdminQuestions = page(() => import('./pages/AdminQuestions'))
const AdminSeating = page(() => import('./pages/AdminSeating'))
const AdminPrintables = page(() => import('./pages/AdminPrintables'))
const FindSeat = page(() => import('./pages/FindSeat'))
const VirtualInvitation = page(() => import('./pages/VirtualInvitation'))
const Raffle = page(() => import('./pages/Raffle'))
const GuestPhotos = page(() => import('./pages/GuestPhotos'))
const Present = page(() => import('./pages/Present'))
const AdminGuestPhotos = page(() => import('./pages/AdminGuestPhotos'))
const AdminMusic = page(() => import('./pages/AdminMusic'))
const AdminRaffle = page(() => import('./pages/AdminRaffle'))
const AdminSchedule = page(() => import('./pages/AdminSchedule'))

/*
 * HashRouter is used on purpose: GitHub Pages is static hosting with no
 * server-side rewrites, so /rsvp or /admin would 404 on refresh with
 * BrowserRouter. With hash routes (/#/rsvp) every refresh and deep link works.
 */
export default function App() {
  if (!isSupabaseConfigured) return <SetupNotice />

  return (
    <HashRouter>
      <ScrollToTop />
      <ToastProvider>
        <ThemeProvider>
        <AuthProvider>
        <HostProvider>
          <MusicPlayer>
          <PageErrorBoundary variant="guest">
          <CrashTest />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/rsvp" element={<RSVP />} />
              <Route path="/seat" element={<FindSeat />} />
              <Route path="/i/:code" element={<VirtualInvitation />} />
              <Route path="/i" element={<Navigate to="/" replace />} />
              <Route path="/raffle" element={<Raffle />} />
              <Route path="/photos" element={<GuestPhotos />} />
              <Route path="/photos/show" element={<Navigate to="/present/guests" replace />} />
              <Route path="/present/:source" element={<Present />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<AdminDashboard />} />
                <Route path="invitations" element={<AdminInvitations />} />
                <Route path="responses" element={<AdminResponses />} />
                <Route path="guests" element={<AdminGuests />} />
                <Route path="outfits" element={<AdminOutfits />} />
                <Route path="media" element={<AdminMedia />} />
                <Route path="look" element={<AdminLookFeel />} />
                <Route path="share" element={<AdminShare />} />
                <Route path="questions" element={<AdminQuestions />} />
                <Route path="seating" element={<AdminSeating />} />
                <Route path="raffle" element={<AdminRaffle />} />
                <Route path="guest-photos" element={<AdminGuestPhotos />} />
                <Route path="music" element={<AdminMusic />} />
                <Route path="schedule" element={<AdminSchedule />} />
                <Route path="printables" element={<AdminPrintables />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="*" element={<Navigate to="/admin" replace />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          </PageErrorBoundary>
          </MusicPlayer>
        </HostProvider>
        </AuthProvider>
        </ThemeProvider>
      </ToastProvider>
    </HashRouter>
  )
}
