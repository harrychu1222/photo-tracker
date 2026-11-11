// Small IndexedDB helper for working without signal.
//  - "cache": the last copy of what each screen loaded, so My Day, tasks, the diary and the
//    checklists can still be read offline.
//  - "outbox": photos, diary entries and checklist ticks saved on the phone until they can be sent.
// No library: raw IndexedDB wrapped in promises. Everything fails soft (if storage is blocked,
// the app simply behaves as it did before).
const DB_NAME = 'sitelog-offline'
const VERSION = 1

let dbPromise = null
function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('No IndexedDB'))
      const req = indexedDB.open(DB_NAME, VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache', { keyPath: 'key' })
        if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'id' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    }).catch((err) => {
      dbPromise = null
      throw err
    })
  }
  return dbPromise
}

async function run(store, mode, fn) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode)
    const result = fn(tx.objectStore(store))
    tx.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

// ---- cache ------------------------------------------------------------------------------
export async function cacheGet(key) {
  try {
    const row = await run('cache', 'readonly', (s) => s.get(key))
    return row ? row.value : undefined
  } catch {
    return undefined
  }
}

export async function cacheSet(key, value) {
  try {
    await run('cache', 'readwrite', (s) => s.put({ key, value, at: Date.now() }))
  } catch {
    /* storage full or blocked: skip */
  }
}

// Forget every cached screen (called on sign-out so a shared phone keeps nothing). The outbox
// is left alone: unsent work must not be lost.
export async function cacheClear() {
  try {
    await run('cache', 'readwrite', (s) => s.clear())
  } catch {
    /* ignore */
  }
}

// ---- outbox -----------------------------------------------------------------------------
export async function outboxAll() {
  try {
    const rows = await run('outbox', 'readonly', (s) => s.getAll())
    return [...(rows || [])].sort((a, b) => a.createdAt - b.createdAt)
  } catch {
    return []
  }
}

export async function outboxPut(item) {
  await run('outbox', 'readwrite', (s) => s.put(item))
}

export async function outboxDelete(id) {
  try {
    await run('outbox', 'readwrite', (s) => s.delete(id))
  } catch {
    /* ignore */
  }
}

// ---- network errors ---------------------------------------------------------------------
export const isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false

// True when a failure means "no signal / try again later" rather than "the server said no".
export function isRetryLater(err) {
  if (!err) return false
  if (!isOnline()) return true
  const msg = String(err.message || err.error_description || err)
  if (/failed to fetch|networkerror|network request failed|load failed|network connection was lost|timed? ?out|fetch failed/i.test(msg)) return true
  if (/jwt expired|invalid jwt|refresh token/i.test(msg)) return true
  const status = Number(err.status ?? err.statusCode)
  return status === 0 || status === 408 || status === 502 || status === 503 || status === 504
}

// Run a select. On success remember the result; if there is no signal, hand back the last copy.
export async function cachedSelect(key, query) {
  let res
  try {
    res = await query
  } catch (err) {
    res = { data: null, error: { message: String(err?.message || err) } }
  }
  if (!res.error) {
    cacheSet(key, res.data)
    return res
  }
  if (isRetryLater(res.error)) {
    const copy = await cacheGet(key)
    if (copy !== undefined) return { data: copy, error: null, fromCache: true }
  }
  return res
}

// Ask the browser not to throw our saved photos away when the phone is short of space.
export function keepStorage() {
  try {
    navigator.storage?.persist?.()
  } catch {
    /* ignore */
  }
}
