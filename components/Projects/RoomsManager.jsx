import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useWork } from '../../context/WorkContext'

const inputClass = 'w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-signal-500'

function RoomRow({ room, taskCount, photoCount, canDelete, onRename, onDelete }) {
  const [name, setName] = useState(room.name)
  const [busy, setBusy] = useState(false)
  const changed = name.trim() !== room.name

  return (
    <li className="flex items-center gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} aria-label="Room name" />
      <span className="hidden flex-shrink-0 text-xs text-ink-400 sm:inline">
        {taskCount} task{taskCount === 1 ? '' : 's'} · {photoCount} photo{photoCount === 1 ? '' : 's'}
      </span>
      {changed ? (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await onRename(room.id, name)
            } finally {
              setBusy(false)
            }
          }}
          className="flex-shrink-0 rounded-lg bg-ink-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
        >
          Save
        </button>
      ) : (
        canDelete && (
          <button
            type="button"
            onClick={() => onDelete(room, taskCount, photoCount)}
            className="flex-shrink-0 rounded-lg border border-ink-200 px-3 py-2 text-xs font-medium text-status-blocked"
          >
            Delete
          </button>
        )
      )}
    </li>
  )
}

// Add, rename and delete the rooms of one project.
export default function RoomsManager({ project, photos }) {
  const { user, isAdmin } = useAuth()
  const { roomsByProject, tasksByProject, createRoom, renameRoom, deleteRoom } = useWork()
  const rooms = roomsByProject[project.id] || []
  const tasks = tasksByProject[project.id] || []
  const [newName, setNewName] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function guard(fn) {
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAdd() {
    if (!newName.trim()) return
    setBusy(true)
    await guard(async () => {
      await createRoom(project.id, newName)
      setNewName('')
    })
    setBusy(false)
  }

  function handleDelete(room, taskCount, photoCount) {
    if (
      !confirm(
        `Delete the room "${room.name}"? Its ${taskCount} task(s) and ${photoCount} photo(s) are kept, they just won't be linked to a room any more.`
      )
    )
      return
    guard(() => deleteRoom(room.id))
  }

  return (
    <div className="mb-4 rounded-xl border border-ink-100 bg-ink-50 p-3">
      <p className="mb-2 text-sm font-semibold text-ink-800">Rooms in this project</p>

      {rooms.length === 0 && <p className="mb-2 text-sm text-ink-600">No rooms yet. Add the first one below.</p>}

      <ul className="space-y-2">
        {rooms.map((room) => (
          <RoomRow
            key={room.id}
            room={room}
            taskCount={tasks.filter((t) => t.room_id === room.id).length}
            photoCount={photos.filter((p) => p.room_id === room.id).length}
            canDelete={isAdmin || room.created_by === user?.id}
            onRename={(id, name) => guard(() => renameRoom(id, name))}
            onDelete={handleDelete}
          />
        ))}
      </ul>

      <div className="mt-3 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAdd()
            }
          }}
          placeholder="New room, e.g. Kitchen"
          className={inputClass}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={busy}
          className="flex-shrink-0 rounded-lg bg-signal-500 px-4 text-sm font-medium text-ink-950 disabled:opacity-60"
        >
          Add
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-status-blocked">{error}</p>}
    </div>
  )
}
