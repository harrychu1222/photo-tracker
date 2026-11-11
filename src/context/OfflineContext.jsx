import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from './AuthContext'
import { useUndo } from './UndoContext'
import { isOnline, isRetryLater, keepStorage, outboxAll, outboxDelete, outboxPut } from '../lib/offline'
import { sendItem } from '../lib/outboxSend'

// Photos, diary entries and checklist ticks are sent straight away when there is signal. With no
// signal (or a failed send) they are saved on the phone in an outbox and sent, in order, when
// signal returns. Items that the server refuses stay in the outbox marked "failed" with the
// reason, so nothing is lost silently.
const OfflineContext = createContext({
  online: true,
  items: [],
  syncing: false,
  syncedAt: 0,
  submit: async () => ({ queued: false }),
  retry: () => {},
  discard: () => {}
})

export function OfflineProvider({ children }) {
  const { user } = useAuth()
  const { notify } = useUndo()
  const userId = user?.id
  const [online, setOnline] = useState(isOnline)
  const [items, setItems] = useState([])
  const [syncing, setSyncing] = useState(false)
  const [syncedAt, setSyncedAt] = useState(0)
  const busy = useRef(false)
  const itemsRef = useRef([])
  itemsRef.current = items

  // Load what is waiting for this person.
  useEffect(() => {
    let cancelled = false
    if (!userId) {
      setItems([])
      return
    }
    keepStorage()
    outboxAll().then((all) => !cancelled && setItems(all.filter((i) => i.userId === userId)))
    return () => {
      cancelled = true
    }
  }, [userId])

  const sync = useCallback(async () => {
    if (busy.current || !userId || !isOnline()) return
    busy.current = true
    setSyncing(true)
    let sent = 0
    try {
      for (const item of itemsRef.current.filter((i) => i.status === 'pending')) {
        try {
          await sendItem(supabase, item)
          await outboxDelete(item.id)
          setItems((cur) => cur.filter((i) => i.id !== item.id))
          sent += 1
        } catch (err) {
          if (err.retryLater || isRetryLater(err)) break // no signal: stop, try again later
          const failed = { ...item, status: 'failed', error: err.message }
          await outboxPut(failed).catch(() => {})
          setItems((cur) => cur.map((i) => (i.id === item.id ? failed : i)))
        }
      }
    } finally {
      busy.current = false
      setSyncing(false)
      if (sent) setSyncedAt((n) => n + 1)
    }
  }, [userId])

  // When to try: on start, when signal returns, when the app comes to the front, and every
  // 30 seconds while something is waiting.
  useEffect(() => {
    const up = () => {
      setOnline(true)
      sync()
    }
    const down = () => setOnline(false)
    const visible = () => document.visibilityState === 'visible' && sync()
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    document.addEventListener('visibilitychange', visible)
    sync()
    const timer = setInterval(() => itemsRef.current.some((i) => i.status === 'pending') && sync(), 30000)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
      document.removeEventListener('visibilitychange', visible)
      clearInterval(timer)
    }
  }, [sync])

  const pendingCount = items.filter((i) => i.status === 'pending').length
  useEffect(() => {
    if (pendingCount) sync()
  }, [pendingCount, sync])

  const enqueue = useCallback(
    async (kind, payload) => {
      const item = { id: crypto.randomUUID(), userId, kind, payload, createdAt: Date.now(), status: 'pending' }
      await outboxPut(item)
      setItems((cur) => [...cur, item])
      return item
    },
    [userId]
  )

  // Send now if there is signal; otherwise (or if the send fails for lack of signal) save it.
  // Real refusals (permissions, bad data) are thrown to the caller as before.
  const submit = useCallback(
    async (kind, payload, { quiet = false } = {}) => {
      if (isOnline()) {
        try {
          await sendItem(supabase, { kind, payload })
          return { queued: false }
        } catch (err) {
          if (!(err.retryLater || isRetryLater(err))) throw err
        }
      }
      await enqueue(kind, payload)
      if (!quiet) notify?.('Saved on this phone. It will send when you are back online.')
      return { queued: true }
    },
    [enqueue, notify]
  )

  const retry = useCallback(async () => {
    const reset = itemsRef.current.filter((i) => i.status === 'failed').map((i) => ({ ...i, status: 'pending', error: null }))
    await Promise.all(reset.map((i) => outboxPut(i).catch(() => {})))
    setItems((cur) => cur.map((i) => reset.find((r) => r.id === i.id) || i))
  }, [])

  const discard = useCallback(async (id) => {
    await outboxDelete(id)
    setItems((cur) => cur.filter((i) => i.id !== id))
  }, [])

  const value = useMemo(() => ({ online, items, syncing, syncedAt, submit, retry, discard }), [online, items, syncing, syncedAt, submit, retry, discard])
  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>
}

export const useOffline = () => useContext(OfflineContext)
