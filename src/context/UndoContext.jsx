import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

// A small "Done. Undo" bar. A screen calls offer('Task marked done', undoFn); the bar stays for a
// few seconds and, if tapped, runs undoFn. Only the latest action can be undone.
const UndoContext = createContext({ offer: () => {}, notify: () => {} })

export function UndoProvider({ children }) {
  const [toast, setToast] = useState(null) // { label, undo }
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(null)
  const timer = useRef(null)

  const clear = useCallback(() => {
    clearTimeout(timer.current)
    setToast(null)
    setFailed(null)
  }, [])

  const offer = useCallback((label, undo) => {
    clearTimeout(timer.current)
    setFailed(null)
    setToast({ label, undo })
    timer.current = setTimeout(() => setToast(null), 8000)
  }, [])

  // A plain message with no Undo button.
  const notify = useCallback((label) => {
    clearTimeout(timer.current)
    setFailed(null)
    setToast({ label, undo: null })
    timer.current = setTimeout(() => setToast(null), 6000)
  }, [])

  useEffect(() => () => clearTimeout(timer.current), [])

  async function run() {
    if (!toast) return
    setBusy(true)
    try {
      await toast.undo()
      clear()
    } catch (err) {
      setFailed(err?.message || 'Could not undo.')
      timer.current = setTimeout(() => clear(), 6000)
    }
    setBusy(false)
  }

  return (
    <UndoContext.Provider value={{ offer, notify }}>
      {children}
      {toast && (
        <div
          role="status"
          className="fixed inset-x-3 bottom-24 z-30 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl bg-ink-900 px-4 py-3 text-sm text-white shadow-lg md:bottom-6"
        >
          <span className="min-w-0 truncate">{failed || toast.label}</span>
          {!failed && toast.undo && (
            <button onClick={run} disabled={busy} className="min-h-[44px] flex-none rounded-lg px-3 .5 text-sm font-semibold text-signal-400 disabled:opacity-60">
              Undo
            </button>
          )}
        </div>
      )}
    </UndoContext.Provider>
  )
}

export const useUndo = () => useContext(UndoContext)
