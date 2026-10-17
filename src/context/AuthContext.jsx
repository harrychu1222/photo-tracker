import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = loading, null = signed out
  const [role, setRole] = useState('crew')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id

  // Look up this person's role. If the database hasn't been migrated yet (or the
  // lookup fails for any reason) they're treated as crew, which hides money screens
  // rather than risking showing them to the wrong person.
  useEffect(() => {
    if (!userId) {
      setRole('crew')
      return
    }
    let cancelled = false
    supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        setRole(!error && data?.role === 'admin' ? 'admin' : 'crew')
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const value = {
    session,
    user: session?.user ?? null,
    loading: session === undefined,
    role,
    isAdmin: role === 'admin',
    signOut: () => supabase.auth.signOut()
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
