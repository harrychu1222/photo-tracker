import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = loading, null = signed out
  const [role, setRole] = useState('crew')
  // Company space: { id, name } of the company being shown, whether this person is the app
  // owner, and the read-only support session (if the owner is looking inside a company).
  const [company, setCompany] = useState(null)
  const [isOwner, setIsOwner] = useState(false)
  const [support, setSupport] = useState(null)
  const [accountVersion, setAccountVersion] = useState(0)
  const [roleReady, setRoleReady] = useState(false) // the role lookup has finished
  const [removed, setRemoved] = useState(false) // a manager took this person out of the company
  const [recovering, setRecovering] = useState(false) // arrived from a password-reset email

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
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
      setRoleReady(false)
      setRemoved(false)
      setCompany(null)
      setIsOwner(false)
      setSupport(null)
      return
    }
    let cancelled = false
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        setRoleReady(true)
        setRemoved(!error && !!data?.removed_at)
        setRole(!error && data?.role === 'admin' && !data?.removed_at ? 'admin' : 'crew')
      })
    // Company details. Each lookup is tolerant: before the companies migration is run these
    // simply come back empty and the app behaves as before.
    supabase
      .from('companies')
      .select('id, name, status')
      .maybeSingle()
      .then(({ data, error }) => !cancelled && setCompany(!error && data ? data : null))
    supabase.rpc('is_platform_owner').then(({ data, error }) => !cancelled && setIsOwner(!error && data === true))
    supabase.rpc('support_status').then(({ data, error }) => {
      if (cancelled) return
      const row = !error && Array.isArray(data) ? data[0] : null
      setSupport(row ? { companyId: row.company_id, companyName: row.company_name, reason: row.reason } : null)
    })
    return () => {
      cancelled = true
    }
  }, [userId, accountVersion])

  const value = {
    session,
    user: session?.user ?? null,
    loading: session === undefined,
    role,
    // In a support session the owner sees what a manager of that company sees (read-only).
    isAdmin: role === 'admin' || !!support,
    company,
    isOwner,
    support,
    roleReady,
    removed,
    recovering,
    finishRecovery: () => setRecovering(false),
    // Start or stop looking inside a company, then reload so every screen refetches.
    startSupport: async (companyId, reason) => {
      const { error } = await supabase.rpc('start_support', { p_company: companyId, p_reason: reason })
      if (!error) window.location.reload()
      return error
    },
    stopSupport: async () => {
      const { error } = await supabase.rpc('stop_support')
      if (!error) window.location.reload()
      return error
    },
    refreshAccount: () => setAccountVersion((v) => v + 1),
    signOut: () => supabase.auth.signOut()
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
