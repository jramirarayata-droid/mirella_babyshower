import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock } from 'lucide-react'
import { getSchedule } from '../../services/scheduleService'
import { formatDateTime } from '../../utils/formatting'

/** Under a visibility picker set to "On the reveal date": which date that is. */
export function RevealNote() {
  const [at, setAt] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    const load = () => void getSchedule().then((s) => alive && setAt(s.revealAt)).catch(() => alive && setAt(null))
    load()
    window.addEventListener('wedding-schedule', load)
    return () => {
      alive = false
      window.removeEventListener('wedding-schedule', load)
    }
  }, [])
  if (at === undefined) return null
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted">
      <CalendarClock aria-hidden="true" className="mt-px size-3.5 shrink-0 text-gold" />
      {at ? (
        <span>
          Shows from your reveal date, <b className="font-medium text-ink">{formatDateTime(at)}</b> (Philippine time).{' '}
          <Link to="/admin/schedule" className="text-gold underline-offset-4 hover:underline">
            Change it in Schedule
          </Link>
        </span>
      ) : (
        <span>
          No reveal date yet — this stays hidden until you{' '}
          <Link to="/admin/schedule" className="text-gold underline-offset-4 hover:underline">
            set one in Schedule
          </Link>
          .
        </span>
      )}
    </p>
  )
}
