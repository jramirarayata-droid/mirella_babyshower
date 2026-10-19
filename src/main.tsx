import './lib/space' // first: keeps each shower's remembered settings apart
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import './styles/styles.css'
import './styles/looks.css'
import { applyCachedTheme } from './theme/applyTheme'

applyCachedTheme()

// Keeps the site's own files on guests' phones so Find My Seat opens at the venue without signal.
// (The browser tests use a mock backend; there it's only switched on by the offline test.)
const mockBackend = String(import.meta.env.VITE_SUPABASE_URL ?? '').includes('mock.supabase.test')
let swTest = false
try {
  swTest = localStorage.getItem('sw-test') === '1'
} catch {
  /* ignore */
}
if (import.meta.env.PROD && 'serviceWorker' in navigator && (!mockBackend || swTest)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
