import { useEffect, useState } from 'react'
import { useOffline } from '../../context/OfflineContext'
import { describeItem } from '../../lib/outboxSend'

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

function Thumb({ blob }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!blob) return
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url ? <img src={url} alt="" className="h-10 w-10 flex-none rounded-md object-cover" /> : <span className="h-10 w-10 flex-none rounded-md bg-ink-100" />
}

function Details({ onClose }) {
  const { items, retry, discard, online, syncing } = useOffline()
  return (
    <div role="dialog" aria-label="Waiting to send" className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 sm:rounded-2xl">
        <h2 className="text-lg font-semibold text-ink-900">Waiting to send</h2>
        <p className="mt-1 text-sm text-ink-600">
          {items.length === 0 ? 'Everything has been sent.' : online ? (syncing ? 'Sending now…' : 'These will send automatically.') : 'These are saved on this phone and will send when you are back online.'}
        </p>
        <ul className="mt-3 space-y-2">
          {items.map((it) => {
            const d = describeItem(it)
            return (
              <li key={it.id} className="flex items-center gap-3 rounded-xl border border-ink-100 p-2.5">
                {it.kind === 'photo' && <Thumb blob={it.payload.blob} />}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink-900">{d.label}</span>
                  {d.detail && <span className="block truncate text-xs text-ink-600">{d.detail}</span>}
                  {it.status === 'failed' && <span className="block text-xs text-status-blocked">Could not send: {it.error}</span>}
                </span>
                {it.status === 'failed' && (
                  <button
                    onClick={() => confirm('Delete this item? It has not been sent and cannot be recovered.') && discard(it.id)}
                    aria-label={`Discard ${d.label}`}
                    className="min-h-[44px] flex-none px-2 text-xs font-medium text-status-blocked"
                  >
                    Discard
                  </button>
                )}
              </li>
            )
          })}
        </ul>
        <div className="mt-4 flex gap-2">
          {items.some((i) => i.status === 'failed') && (
            <button onClick={retry} className="min-h-[44px] flex-1 rounded-lg border border-ink-200 text-sm font-semibold text-ink-900">
              Try again
            </button>
          )}
          <button onClick={onClose} className="min-h-[44px] flex-1 rounded-lg bg-ink-900 text-sm font-semibold text-white">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// A thin bar at the top: offline, sending, or something that could not be sent.
export default function OfflineBanner() {
  const { online, items, syncing } = useOffline()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!items.length) setOpen(false)
  }, [items.length])
  const pending = items.filter((i) => i.status === 'pending')
  const failed = items.filter((i) => i.status === 'failed')
  if (online && !items.length) return null

  const photos = pending.filter((i) => i.kind === 'photo').length
  const diaries = pending.filter((i) => i.kind === 'diary_add').length
  const checks = pending.filter((i) => i.kind === 'check_done').length
  const parts = [photos && plural(photos, 'photo', 'photos'), diaries && plural(diaries, 'diary entry', 'diary entries'), checks && plural(checks, 'checklist change', 'checklist changes')].filter(Boolean)

  let text
  let tone = 'bg-ink-800 text-white'
  if (!online) text = parts.length ? `Offline. Saved on this phone: ${parts.join(', ')}.` : 'Offline. You can still take photos and write diary notes; they send when you are back.'
  else if (failed.length) {
    text = `${plural(failed.length, 'item', 'items')} could not be sent.`
    tone = 'bg-status-blocked text-white'
  } else text = syncing ? `Sending ${parts.join(', ')}…` : `Waiting to send ${parts.join(', ')}.`

  return (
    <>
      <div role="status" className={`sticky top-0 z-20 flex min-h-9 items-center justify-between gap-3 px-3 py-1 text-xs font-semibold ${tone}`}>
        <span className="min-w-0">{text}</span>
        {items.length > 0 && (
          <button onClick={() => setOpen(true)} className="flex-none rounded-md bg-white/20 px-2.5 py-1 text-xs font-semibold">
            Details
          </button>
        )}
      </div>
      {open && <Details onClose={() => setOpen(false)} />}
    </>
  )
}
