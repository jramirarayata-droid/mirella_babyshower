import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { checkIsAdmin, signInAdmin, signOutAdmin } from '../../services/adminService'
import { AuthContext, type AuthState } from '../../hooks/authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const resolve = async (next: Session | null) => {
      const admin = next ? await checkIsAdmin() : false
      if (cancelled) return
      setSession(next)
      setIsAdmin(admin)
      setLoading(false)
    }

    supabase.auth.getSession().then(({ data }) => resolve(data.session))

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'INITIAL_SESSION') return
      // Defer: calling Supabase inside this callback can dead-lock the auth client.
      setTimeout(() => void resolve(next), 0)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    await signInAdmin(email, password)
    const { data } = await supabase.auth.getSession()
    setSession(data.session)
    setIsAdmin(true)
  }, [])

  const signOut = useCallback(async () => {
    await signOutAdmin()
    setSession(null)
    setIsAdmin(false)
  }, [])

  const value = useMemo<AuthState>(
    () => ({ session, isAdmin, loading, signIn, signOut }),
    [session, isAdmin, loading, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
