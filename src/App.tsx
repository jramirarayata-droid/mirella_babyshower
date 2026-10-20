import { lazy, Suspense, type ComponentType, type ReactElement } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
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
import { SpaceProvider, useSpace } from './hooks/useSpace'
import { FeatureGate, SpaceGate } from './components/space/Locked'
import { spaceSlug, spaceUrl } from './lib/space'
import type { Feature } from './lib/plans'
import NotFound from './pages/NotFound'

/*
 * After a new version is published, a tab that was already open may ask for a
 * page file that no longer exists. Reload once to pick up the new version
 * instead of showing a blank page.
 */
const RELOAD_KEY = 'shower-chunk-reload'
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
const Registry = page(() => import('./pages/Registry'))
const Attire = page(() => import('./pages/Attire'))
const Predictions = page(() => import('./pages/Predictions'))
const NameIdeas = page(() => import('./pages/NameIdeas'))
const ShowerScreen = page(() => import('./pages/ShowerScreen'))
const AdminRegistry = page(() => import('./pages/AdminRegistry'))
const AdminReveal = page(() => import('./pages/AdminReveal'))
const AdminPredictions = page(() => import('./pages/AdminPredictions'))
const AdminNames = page(() => import('./pages/AdminNames'))
const Landing = page(() => import('./pages/Landing'))
const Owner = page(() => import('./pages/Owner'))

/*
 * The site's root ("/") is the sign-in and plans page. Each baby shower lives
 * at "/<its address>/". Until the database has spaces (migration 046), the
 * root keeps showing the shower's home page as before.
 */
function RootOrHome() {
  const { info, loading } = useSpace()
  if (spaceSlug) return <Home />
  if (loading) return <PageLoader />
  return info?.legacy ? <Home /> : <Landing />
}

function RootOrLogin() {
  const { info, loading } = useSpace()
  if (spaceSlug) return <AdminLogin />
  if (loading) return <PageLoader />
  return info?.legacy ? <AdminLogin /> : <Navigate to="/" replace />
}

/** Admin pages opened at the site's root move to the shower's own address, so links they share are right. */
function AdminHome({ children }: { children: ReactElement }) {
  const { info, loading } = useSpace()
  const { pathname, search } = useLocation()
  if (spaceSlug) return children
  if (loading) return <PageLoader />
  if (info?.legacy || !info?.slug) return children
  window.location.replace(spaceUrl(info.slug, pathname + search))
  return <PageLoader />
}

const gated = (feature: Feature, el: ReactElement, admin = false) => (
  <FeatureGate feature={feature} admin={admin}>
    {el}
  </FeatureGate>
)

/*
 * HashRouter is used on purpose: the site is served as static files, so
 * /rsvp or /admin would 404 on refresh with BrowserRouter. With hash routes
 * (/#/rsvp) every refresh and deep link works.
 */
export default function App() {
  if (!isSupabaseConfigured) return <SetupNotice />

  return (
    <HashRouter>
      <ScrollToTop />
      <SpaceProvider>
      <ToastProvider>
        <ThemeProvider>
        <AuthProvider>
        <HostProvider>
          <MusicPlayer>
          <PageErrorBoundary variant="guest">
          <CrashTest />
          <Suspense fallback={<PageLoader />}>
            <SpaceGate>
            <Routes>
              <Route path="/" element={<RootOrHome />} />
              <Route path="/owner" element={<Owner />} />
              <Route path="/rsvp" element={<RSVP />} />
              <Route path="/seat" element={gated('seating', <FindSeat />)} />
              <Route path="/i/:code" element={<VirtualInvitation />} />
              <Route path="/i" element={<Navigate to="/" replace />} />
              <Route path="/raffle" element={gated('raffle', <Raffle />)} />
              <Route path="/photos" element={gated('guest_photos', <GuestPhotos />)} />
              <Route path="/photos/show" element={<Navigate to="/present/guests" replace />} />
              <Route path="/present/:source" element={gated('slideshow', <Present />)} />
              <Route path="/registry" element={<Registry />} />
              <Route path="/attire" element={<Attire />} />
              <Route path="/predict" element={gated('predictions', <Predictions />)} />
              <Route path="/names" element={gated('names', <NameIdeas />)} />
              <Route path="/show/:what" element={gated('big_screen', <ShowerScreen />)} />
              <Route path="/admin/login" element={<RootOrLogin />} />
              <Route
                path="/admin"
                element={
                  <AdminHome>
                    <ProtectedRoute>
                      <AdminLayout />
                    </ProtectedRoute>
                  </AdminHome>
                }
              >
                <Route index element={<AdminDashboard />} />
                <Route path="invitations" element={<AdminInvitations />} />
                <Route path="responses" element={<AdminResponses />} />
                <Route path="guests" element={<AdminGuests />} />
                <Route path="outfits" element={<AdminOutfits />} />
                <Route path="media" element={gated('gallery', <AdminMedia />, true)} />
                <Route path="look" element={<AdminLookFeel />} />
                <Route path="share" element={<AdminShare />} />
                <Route path="questions" element={<AdminQuestions />} />
                <Route path="seating" element={gated('seating', <AdminSeating />, true)} />
                <Route path="raffle" element={gated('raffle', <AdminRaffle />, true)} />
                <Route path="registry" element={<AdminRegistry />} />
                <Route path="reveal" element={gated('reveal', <AdminReveal />, true)} />
                <Route path="predictions" element={gated('predictions', <AdminPredictions />, true)} />
                <Route path="names" element={gated('names', <AdminNames />, true)} />
                <Route path="guest-photos" element={gated('guest_photos', <AdminGuestPhotos />, true)} />
                <Route path="music" element={gated('music', <AdminMusic />, true)} />
                <Route path="schedule" element={<AdminSchedule />} />
                <Route path="printables" element={gated('printables', <AdminPrintables />, true)} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="*" element={<Navigate to="/admin" replace />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
            </SpaceGate>
          </Suspense>
          </PageErrorBoundary>
          </MusicPlayer>
        </HostProvider>
        </AuthProvider>
        </ThemeProvider>
      </ToastProvider>
      </SpaceProvider>
    </HashRouter>
  )
}
