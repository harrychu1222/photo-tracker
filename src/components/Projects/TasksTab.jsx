import { useMemo, useState } from 'react'
import TaskForm from './TaskForm'
import RoomsManager from './RoomsManager'
import { useWork } from '../../context/WorkContext'
import { taskStatusMeta } from '../../statusConfig'
import { fmtDateRange } from '../../lib/format'
import { durations, fmtDays, fmtHours, scheduleNote, statusPatch, taskProgress } from '../../lib/tasks'

// The to-do list for one project. `photos` are that project's photos (used for counts and the task form).
export default function TasksTab({ project, photos }) {
  const { tasksByProject, roomsByProject, roomsById, tasksById, updateTask, loading, error } = useWork()
  const tasks = tasksByProject[project.id] || []
  const rooms = roomsByProject[project.id] || []

  const [roomFilter, setRoomFilter] = useState('all') // 'all' | 'none' | a room id
  const [hideDone, setHideDone] = useState(false)
  const [editing, setEditing] = useState(null) // a task, 'new', or null
  const [showRooms, setShowRooms] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState(null)

  const photosByTask = useMemo(() => {
    const out = {}
    photos.forEach((p) => {
      if (p.task_id) (out[p.task_id] ||= []).push(p)
    })
    return out
  }, [photos])

  const progress = taskProgress(tasks)
  const totalHours = tasks.reduce((sum, t) => sum + (Number(t.planned_hours) || 0), 0)

  const visible = tasks.filter((t) => {
    if (hideDone && t.status === 'done') return false
    if (roomFilter === 'none') return !t.room_id
    if (roomFilter !== 'all') return t.room_id === roomFilter
    return true
  })

  async function toggleDone(task) {
    setBusyId(task.id)
    setActionError(null)
    try {
      await updateTask(task.id, statusPatch(task, task.status === 'done' ? 'in_progress' : 'done'))
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const editingTask = editing && editing !== 'new' ? tasksById[editing.id] || editing : null

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink-800">Tasks ({tasks.length})</h3>
          {tasks.length > 0 && (
            <p className="text-xs text-ink-400">
              {progress.done} of {progress.total} done · {progress.percent}% overall
              {totalHours > 0 ? ` · ${fmtHours(totalHours)} planned` : ''}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowRooms((v) => !v)}
            className="rounded-full border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600"
          >
            {showRooms ? 'Hide rooms' : `Rooms (${rooms.length})`}
          </button>
          <button
            onClick={() => setEditing('new')}
            className="rounded-full bg-signal-500 px-4 py-1.5 text-sm font-medium text-white"
          >
            + Add task
          </button>
        </div>
      </div>

      {showRooms && <RoomsManager project={project} photos={photos} />}

      {error && <p className="mb-3 text-sm text-status-blocked">{error}</p>}
      {actionError && <p className="mb-3 text-sm text-status-blocked">{actionError}</p>}

      {tasks.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setRoomFilter('all')}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              roomFilter === 'all' ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-600'
            }`}
          >
            All rooms
          </button>
          {rooms.map((r) => (
            <button
              key={r.id}
              onClick={() => setRoomFilter(roomFilter === r.id ? 'all' : r.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                roomFilter === r.id ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-600'
              }`}
            >
              {r.name}
            </button>
          ))}
          {tasks.some((t) => !t.room_id) && rooms.length > 0 && (
            <button
              onClick={() => setRoomFilter(roomFilter === 'none' ? 'all' : 'none')}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                roomFilter === 'none' ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-600'
              }`}
            >
              No room
            </button>
          )}
          <label className="ml-auto flex items-center gap-1.5 text-xs text-ink-600">
            <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
            Hide done
          </label>
        </div>
      )}

      {loading && <p className="py-8 text-center text-sm text-ink-400">Loading tasks…</p>}

      {!loading && !error && tasks.length === 0 && (
        <p className="rounded-xl border border-dashed border-ink-200 py-10 text-center text-sm text-ink-600">
          No tasks yet. Add the first one to start planning this project.
        </p>
      )}

      {!loading && tasks.length > 0 && visible.length === 0 && (
        <p className="py-8 text-center text-sm text-ink-600">No tasks match these filters.</p>
      )}

      <ul className="space-y-2">
        {visible.map((task) => {
          const status = taskStatusMeta(task.status)
          const room = task.room_id ? roomsById[task.room_id] : null
          const dates = fmtDateRange(task.planned_start, task.planned_end)
          const note = scheduleNote(task)
          const dur = durations(task)
          const blocker = task.blocked_by ? tasksById[task.blocked_by] : null
          const waiting = blocker && blocker.status !== 'done'
          const photoCount = (photosByTask[task.id] || []).length

          return (
            <li key={task.id} className="flex items-stretch gap-3 rounded-xl border border-ink-100 bg-white p-3 shadow-sm">
              <button
                onClick={() => toggleDone(task)}
                disabled={busyId === task.id}
                aria-label={task.status === 'done' ? 'Mark as not done' : 'Mark as done'}
                className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold disabled:opacity-50 ${
                  task.status === 'done'
                    ? 'border-status-done bg-status-done text-white'
                    : 'border-ink-200 text-transparent'
                }`}
              >
                ✓
              </button>

              <button onClick={() => setEditing(task)} className="min-w-0 flex-1 text-left">
                <div className="flex items-start justify-between gap-2">
                  <p
                    className={`text-base font-medium ${
                      task.status === 'done' ? 'text-ink-400 line-through' : 'text-ink-900'
                    }`}
                  >
                    {task.name}
                  </p>
                  <span className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-ink-50 px-2 py-0.5 text-xs font-medium text-ink-800">
                    <span className="status-dot" style={{ backgroundColor: status.color }} />
                    {status.label}
                  </span>
                </div>

                <p className="mt-0.5 text-xs text-ink-600">
                  {[room?.name, dates, task.planned_hours != null ? fmtHours(task.planned_hours) : null]
                    .filter(Boolean)
                    .join('  ·  ') || 'No room or dates yet'}
                </p>

                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${task.percent_complete}%`, backgroundColor: status.color }}
                    />
                  </div>
                  <span className="w-9 text-right text-xs text-ink-600">{task.percent_complete}%</span>
                </div>

                {(note || waiting || dur.actual != null || photoCount > 0) && (
                  <p className="mt-1.5 text-xs text-ink-600">
                    {note && (
                      <span className={note.tone === 'bad' ? 'text-status-blocked' : 'text-status-done'}>
                        {note.text}
                      </span>
                    )}
                    {note && (waiting || dur.actual != null || photoCount > 0) ? '  ·  ' : ''}
                    {waiting && <span>Waiting on {blocker.name}</span>}
                    {waiting && (dur.actual != null || photoCount > 0) ? '  ·  ' : ''}
                    {dur.actual != null && (
                      <span>
                        {fmtDays(dur.actual)}
                        {dur.open ? ' so far' : ' taken'}
                      </span>
                    )}
                    {dur.actual != null && photoCount > 0 ? '  ·  ' : ''}
                    {photoCount > 0 && (
                      <span>
                        {photoCount} photo{photoCount === 1 ? '' : 's'}
                      </span>
                    )}
                  </p>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      {editing && (
        <TaskForm
          key={editingTask?.id || 'new'}
          project={project}
          task={editingTask}
          projectTasks={tasks}
          photos={editingTask ? photosByTask[editingTask.id] || [] : []}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
