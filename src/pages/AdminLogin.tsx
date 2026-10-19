import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { toFriendlyMessage } from '../utils/errors'
import { Button } from '../components/ui/Button'
import { FieldError, TextField } from '../components/ui/FormField'
import { Ornament } from '../components/ui/Ornament'
import { PageLoader } from '../components/ui/Spinner'
import { Monogram } from '../components/wedding/Monogram'

export default function AdminLogin() {
  const { session, isAdmin, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Admin login · Wedding'
  }, [])

  if (loading) return <PageLoader />
  const from = (location.state as { from?: string } | null)?.from
  if (session && isAdmin) return <Navigate to={from && from.startsWith('/admin') ? from : '/admin'} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Please enter your email and password.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await signIn(email, password)
      navigate(from && from.startsWith('/admin') ? from : '/admin', { replace: true })
    } catch (err) {
      setError(toFriendlyMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-[100svh] items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <div className="text-center">
          <p className="font-serif text-4xl italic text-champagne">
            <Monogram />
          </p>
          <Ornament className="mt-5" />
          <h1 className="mt-6 text-4xl text-ink">Admin Login</h1>
          <p className="mt-2 text-sm text-muted">Sign in to manage invitations and RSVPs.</p>
        </div>
        <form onSubmit={submit} noValidate className="mt-10 space-y-5 rounded-xl border border-line bg-paper p-6 shadow-card sm:p-8">
          <TextField label="Email" type="email" autoComplete="username" value={email} onChange={setEmail} required autoFocus />
          <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={setPassword} required />
          <FieldError>{error}</FieldError>
          <Button type="submit" fullWidth size="md" loading={submitting} loadingText="Signing in…" icon={<Lock aria-hidden="true" className="size-4" />}>
            Sign in
          </Button>
        </form>
        <p className="mt-6 text-center">
          <Link to="/" className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
            Back to the wedding website
          </Link>
        </p>
      </div>
    </main>
  )
}
