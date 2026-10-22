import { useContext, type ReactNode } from 'react'
import { ThemeContext } from '../../theme/themeContext'

/**
 * Look & Feel → Page background: a photo that stays still behind the whole home
 * page while the sections scroll over it. Off by default (then this adds nothing).
 *
 * A fixed layer is used rather than "background-attachment: fixed", which
 * iPhones ignore or zoom. The page colour washes over the photo (strength set by
 * the customer) so text always stays easy to read.
 */
export function PageBackground({ heroImageUrl, children }: { heroImageUrl: string; children: ReactNode }) {
  const bg = useContext(ThemeContext).pageBg
  const src = bg ? (bg.mode === 'hero' ? heroImageUrl : bg.image) : null
  if (!bg || !src) return <>{children}</>
  return (
    <>
      <div aria-hidden="true" data-page-background className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${src.replace(/"/g, '%22')}")` }} />
        <div className="absolute inset-0 bg-ivory" style={{ opacity: bg.wash / 100 }} />
      </div>
      <div className="relative z-[1]">{children}</div>
    </>
  )
}
