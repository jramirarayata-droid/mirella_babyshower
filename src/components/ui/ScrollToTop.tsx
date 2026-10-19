import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Resets scroll position on route changes (hash routing doesn't do this itself). */
export function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}
