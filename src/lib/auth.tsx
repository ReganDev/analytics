import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from './supabase'

interface AuthState {
  /** undefined while the stored session is still being read */
  session: Session | null | undefined
  isAdmin: boolean
}

const AuthContext = createContext<AuthState>({ session: undefined, isAdmin: false })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  useEffect(() => {
    if (!userId) {
      setIsAdmin(false)
      return
    }
    supabase.rpc('is_admin').then(({ data }) => setIsAdmin(data === true))
  }, [userId])

  return <AuthContext.Provider value={{ session, isAdmin }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)

export function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { session, isAdmin } = useAuth()
  const location = useLocation()
  if (session === undefined) return <div className="splash" aria-busy="true" />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (admin && !isAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}
