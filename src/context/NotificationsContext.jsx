import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from './AuthContext'

// The bell: the list of notifications for this person, their settings, and the jobs they muted.
// Until migration 29 is run the bell stays hidden and nothing else is affected.
const Ctx = createContext({ ready: false, items: [], unread: 0, prefs: null, muted: new Set() })

const DEFAULTS = { kinds: {}, email_morning: true, variation_days: 3, defect_days: 7 }

export function NotificationsProvider({ children }) {
  const { user } = useAuth()
  const userId = user?.id
  const [ready, setReady] = useState(false)
  const [items, setItems] = useState([])
  const [prefs, setPrefs] = useState(DEFAULTS)
  const [muted, setMuted] = useState(new Set())

  const load = useCallback(async () => {
    if (!userId) return
    const [n, p, m] = await Promise.all([
      supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(60),
      supabase.from('notification_prefs').select('*').eq('user_id', userId),
      supabase.from('notification_mutes').select('*').eq('user_id', userId)
    ])
    if (n.error) return // not set up yet, or offline: keep what we have
    setReady(true)
    setItems(n.data || [])
    const row = (p.data || [])[0]
    setPrefs(row ? { ...DEFAULTS, ...row } : DEFAULTS)
    setMuted(new Set((m.data || []).map((r) => r.project_id)))
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setReady(false)
      setItems([])
      return
    }
    load()
    const visible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', visible)
    const timer = setInterval(load, 60000)
    return () => {
      document.removeEventListener('visibilitychange', visible)
      clearInterval(timer)
    }
  }, [userId, load])

  const markRead = useCallback(
    async (id) => {
      const now = new Date().toISOString()
      setItems((cur) => cur.map((i) => (i.id === id && !i.read_at ? { ...i, read_at: now } : i)))
      await supabase.from('notifications').update({ read_at: now }).eq('id', id).eq('user_id', userId)
    },
    [userId]
  )
  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString()
    setItems((cur) => cur.map((i) => (i.read_at ? i : { ...i, read_at: now })))
    await supabase.from('notifications').update({ read_at: now }).eq('user_id', userId).is('read_at', null)
  }, [userId])

  const savePrefs = useCallback(
    async (patch) => {
      const next = { ...prefs, ...patch }
      setPrefs(next)
      const { error } = await supabase.from('notification_prefs').upsert(
        { user_id: userId, kinds: next.kinds, email_morning: next.email_morning, variation_days: next.variation_days, defect_days: next.defect_days, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      if (error) {
        await load()
        throw new Error(error.message)
      }
    },
    [prefs, userId, load]
  )
  const setKind = useCallback((kind, patch) => savePrefs({ kinds: { ...prefs.kinds, [kind]: { ...(prefs.kinds[kind] || {}), ...patch } } }), [prefs, savePrefs])

  const setMute = useCallback(
    async (projectId, on) => {
      setMuted((cur) => {
        const next = new Set(cur)
        if (on) next.add(projectId)
        else next.delete(projectId)
        return next
      })
      const q = on
        ? supabase.from('notification_mutes').upsert({ user_id: userId, project_id: projectId }, { onConflict: 'user_id,project_id' })
        : supabase.from('notification_mutes').delete().eq('user_id', userId).eq('project_id', projectId)
      const { error } = await q
      if (error) {
        await load()
        throw new Error(error.message)
      }
    },
    [userId, load]
  )

  const unread = items.filter((i) => !i.read_at).length
  const value = useMemo(() => ({ ready, items, unread, prefs, muted, markRead, markAllRead, setKind, savePrefs, setMute, reload: load }), [ready, items, unread, prefs, muted, markRead, markAllRead, setKind, savePrefs, setMute, load])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useNotifications = () => useContext(Ctx)
