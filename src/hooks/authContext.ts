import { createContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export interface AuthState {
  session: Session | null
  isAdmin: boolean
  loading: boolean
  /** requireAdmin (default true): the login must manage the shower on this page. */
  signIn: (usernameOrEmail: string, password: string, requireAdmin?: boolean) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)
