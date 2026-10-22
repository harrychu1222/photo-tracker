import { useMemo, useState } from 'react'
import { useWork } from '../../context/WorkContext'
import { orderByChains } from '../../lib/deps'

const inputClass = 'w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-base focus:border-signal-500'

// Copy chosen tasks (with their waiting-on links, materials and equipment) into other rooms.
export default function CopyTasks({ project, defaultRoomId, onClose }) {
  const { tasksByProject, roomsByProject, roomsById, copyTasks, createRoom } = useWork()
  const tasks = tasksByProject[project.id] || []
  const rooms = roomsByProject[project.id] || []

  const [sourceRoom, setSourceRoom] = useState(
    defaultRoomId && defaultRoomId !== 'all' ? defaultRoomId : rooms.find((r) => tasks.some((t) => t.room_id === r.id))?.id || 'none'
  )
  const sourceTasks = useMemo(
    () => orderByChains(tasks.filter((t) => (sourceRoom === 'none' ? !t.room_id : t.room_id === sourceRoom))),
    [tasks, sourceRoom]
  )
  const [unticked, setUnticked] = useState(() => new Set()) // everything starts ticked
  const [targets, setTargets] = useState([])
  const [newRoom, setNewRoom] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const chosen = sourceTasks.filter(({ task }) => !unticked.has(task.id)).map(({ task }) => task)
  const targetRooms = rooms.filter((r) => r.id !== sourceRoom)

  function changeSource(id) {
    setSourceRoom(id)
    setUnticked(new Set())
    setTargets((cur) => cur.filter((x) => x !== id))
  }

  function toggleTask(id) {
    setUnticked((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleTarget(id) {
    setTargets((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  }

  async function addRoom() {
    if (!newRoom.trim()) return
    setError(null)
    try {
      const room = await createRoom(project.id, newRoom)
      setTargets((cur) => (cur.includes(room.id) ? cur : [...cur, room.id]))
      setNewRoom('')
    } catch (err) {
      setError(err.message)
    }
  }

  async function submit() {
    if (chosen.length === 0) return setError('Tick at least one task to copy.')
    if (targets.length === 0) return setError('Pick at least one room to copy into.')
    setBusy(true)
    setError(null)
    try {
      await copyTasks(
        chosen.map((t) => t.id),
        targets
      )
      onClose()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const waitingOutside = chosen.filter((t) => t.blocked_by && !chosen.some((c) => c.id === t.blocked_by))

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-5 pb-8 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink-900">Copy tasks to other rooms</h2>
          <button onClick={onClose} className="text-2xl leading-none text-ink-400" aria-label="Close">
            ×
          </button>
        </div>

        <label className="mb-1 block text-sm font-medium text-ink-800">Copy from</label>
        <select value={sourceRoom} onChange={(e) => changeSource(e.target.value)} className={inputClass}>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
          <option value="none">No room</option>
        </select>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-sm font-medium text-ink-800">
              Tasks ({chosen.length} of {sourceTasks.length} ticked)
            </p>
            <button
              type="button"
              className="text-xs font-medium text-signal-600"
              onClick={() => setUnticked(chosen.length === sourceTasks.length ? new Set(sourceTasks.map((s) => s.task.id)) : new Set())}
            >
              {chosen.length === sourceTasks.length ? 'Untick all' : 'Tick all'}
            </button>
          </div>
          {sourceTasks.length === 0 ? (
            <p className="rounded-lg bg-ink-50 px-3 py-3 text-sm text-ink-600">There are no tasks here to copy.</p>
          ) : (
            <ul className="space-y-1">
              {sourceTasks.map(({ task, depth }) => (
                <li key={task.id} style={{ paddingLeft: `${Math.min(depth, 5) * 16}px` }}>
                  <label className="flex items-center gap-2 rounded-lg border border-ink-100 px-3 py-2 text-sm">
                    <input type="checkbox" checked={!unticked.has(task.id)} onChange={() => toggleTask(task.id)} />
                    <span className="text-ink-900">{task.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4">
          <p className="mb-1.5 text-sm font-medium text-ink-800">Copy into (pick one or more rooms)</p>
          <div className="flex flex-wrap gap-1.5">
            {targetRooms.map((r) => (
              <button
                type="button"
                key={r.id}
                onClick={() => toggleTarget(r.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  targets.includes(r.id) ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-600'
                }`}
              >
                {r.name}
              </button>
            ))}
            {targetRooms.length === 0 && <p className="text-xs text-ink-400">No other rooms yet. Add one below.</p>}
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

        <p className="mt-4 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">
          Copies start as To do, 0%, with no actual dates. Planned dates and hours, notes, materials and equipment come
          with them, and "waiting on" links between the copied tasks are rebuilt inside each room.
          {waitingOutside.length > 0 &&
            ` ${waitingOutside.length} task${waitingOutside.length === 1 ? ' waits' : 's wait'} on something you have not ticked, so the copy will not wait on anything.`}
        </p>

        {error && <p className="mt-3 text-sm text-status-blocked">{error}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="mt-4 w-full rounded-lg bg-signal-500 py-3 text-base font-medium text-white disabled:opacity-60"
        >
          {busy
            ? 'Copying…'
            : `Copy ${chosen.length} task${chosen.length === 1 ? '' : 's'}${
                targets.length ? ` into ${targets.map((id) => roomsById[id]?.name).filter(Boolean).join(', ')}` : ''
              }`}
        </button>
      </div>
    </div>
  )
}
