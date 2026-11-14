import { useMemo, useState } from 'react'
import { useWork } from '../../context/WorkContext'
import { parseBulkTasks } from '../../lib/deps'

const inputClass = 'w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-base focus:border-signal-500'

const EXAMPLE = `Strip out | 4
> Plumbing rough-in
> Electrical rough-in
Tile (after Plumbing rough-in, Electrical rough-in) | 6`

// Type or paste many tasks at once, optionally into several rooms in one go.
export default function BulkAddTasks({ project, defaultRoomId, onClose }) {
  const { roomsByProject, bulkAddTasks, createRoom } = useWork()
  const rooms = roomsByProject[project.id] || []
  const [text, setText] = useState('')
  const [picked, setPicked] = useState(() => (defaultRoomId && defaultRoomId !== 'all' && defaultRoomId !== 'none' ? [defaultRoomId] : []))
  const [newRoom, setNewRoom] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const items = useMemo(() => parseBulkTasks(text), [text])
  const roomCount = picked.length || 1
  const total = items.length * roomCount

  function toggle(id) {
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  }

  async function addRoom() {
    if (!newRoom.trim()) return
    setError(null)
    try {
      const room = await createRoom(project.id, newRoom)
      setPicked((cur) => (cur.includes(room.id) ? cur : [...cur, room.id]))
      setNewRoom('')
    } catch (err) {
      setError(err.message)
    }
  }

  async function submit() {
    if (items.length === 0) return setError('Type at least one task first.')
    setBusy(true)
    setError(null)
    try {
      await bulkAddTasks(project.id, picked, items)
      onClose()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-5 pb-8 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink-900">Add many tasks</h2>
          <button onClick={onClose} className="text-2xl leading-none text-ink-400" aria-label="Close">
            ×
          </button>
        </div>

        <p className="mb-2 text-sm text-ink-600">
          One task per line. Start a line with <b>&gt;</b> to make it wait on the task above it; <b>&gt;&gt;</b> goes one
          step further. To wait on several, name them: <b>(after Plumbing, Electrical)</b>. Add <b>| 4</b> at the end for
          planned hours.
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          className={`${inputClass} font-mono text-sm`}
          placeholder={EXAMPLE}
          autoFocus
        />
        <button type="button" onClick={() => setText(EXAMPLE)} className="mt-1 text-xs font-medium text-signal-600">
          Fill in an example
        </button>

        {items.length > 0 && (
          <div className="mt-3 rounded-lg bg-ink-50 p-3">
            <p className="mb-1.5 text-xs font-semibold text-ink-800">Preview ({items.length} per room)</p>
            <ul className="space-y-0.5 text-sm text-ink-900">
              {items.map((it, i) => (
                <li key={i} style={{ paddingLeft: `${Math.min(items[i].parent == null ? 0 : depthOf(items, i), 6) * 16}px` }}>
                  {it.parent != null && <span className="mr-1 text-ink-400">↳</span>}
                  {it.name}
                  {it.hours != null && <span className="text-ink-400"> · {it.hours} h</span>}
                  {it.parents.length > 1 && (
                    <span className="text-ink-400"> · waits on {it.parents.map((p) => items[p].name).join(' + ')}</span>
                  )}
                  {it.unknownAfter.length > 0 && (
                    <span className="text-status-blocked">
                      {' '}
                      · no line above is called {it.unknownAfter.map((n) => `"${n}"`).join(', ')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4">
          <p className="mb-1.5 text-sm font-medium text-ink-800">Which rooms? (pick several, or none)</p>
          <div className="flex flex-wrap gap-1.5">
            {rooms.map((r) => (
              <button
                type="button"
                key={r.id}
                onClick={() => toggle(r.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  picked.includes(r.id) ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-600'
                }`}
              >
                {r.name}
              </button>
            ))}
            {rooms.length === 0 && <p className="text-xs text-ink-400">No rooms yet. Add one below, or leave none.</p>}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={newRoom}
              onChange={(e) => setNewRoom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addRoom()
                }
              }}
              className={inputClass}
              placeholder="New room"
            />
            <button type="button" onClick={addRoom} className="flex-shrink-0 rounded-lg border border-ink-200 px-4 text-sm font-medium text-ink-600">
              Add room
            </button>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-status-blocked">{error}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={busy || items.length === 0}
          className="mt-4 w-full rounded-lg bg-signal-500 py-3 text-base font-medium text-ink-950 disabled:opacity-60"
        >
          {busy
            ? 'Adding…'
            : items.length === 0
              ? 'Add tasks'
              : `Add ${total} task${total === 1 ? '' : 's'}${picked.length > 1 ? ` (${items.length} in each of ${picked.length} rooms)` : ''}`}
        </button>
      </div>
    </div>
  )
}

// How many steps deep item i sits in the chain of "waits on" links.
function depthOf(items, i) {
  let d = 0
  let cur = items[i].parent
  while (cur != null && d < 50) {
    d += 1
    cur = items[cur].parent
  }
  return d
}
