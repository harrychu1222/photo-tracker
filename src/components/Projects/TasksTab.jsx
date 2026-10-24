import { useMemo, useState } from 'react'
import TaskForm from './TaskForm'
import RoomsManager from './RoomsManager'
import BulkAddTasks from './BulkAddTasks'
import CopyTasks from './CopyTasks'
import { useAuth } from '../../context/AuthContext'
import { useWork } from '../../context/WorkContext'
import { taskStatusMeta } from '../../statusConfig'
import { fmtDateRange, fmtMoney } from '../../lib/format'
import { taskCost } from '../../lib/costs'
import { dependencyInfo, orderByChains } from '../../lib/deps'
import { materialProgress, materialWarning } from '../../lib/materials'
import { durations, fmtDays, fmtHours, scheduleNote, statusPatch, taskProgress } from '../../lib/tasks'

function Badge({ tone, children }) {
  const tones = {
    wait: 'bg-status-blocked/10 text-status-blocked',
    ready: 'bg-status-done/10 text-status-done',
    hold: 'bg-signal-500/10 text-signal-600'
  }
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>
}

// The to-do list for one project. `photos` are that project's photos (used for counts and the task form).
export default function TasksTab({ project, photos }) {
  const { isAdmin } = useAuth()
  const {
    tasksByProject,
    roomsByProject,
    roomsById,
    tasksById,
    materialsByTask,
    equipmentByTask,
    matPrices,
    eqPrices,
    updateTask,
    loading,
    error
  } = useWork()
  const tasks = tasksByProject[project.id] || []
  const rooms = roomsByProject[project.id] || []

  const [roomFilter, setRoomFilter] = useState('all') // 'all' | 'none' | a room id
  const [hideDone, setHideDone] = useState(false)
  const [layout, setLayout] = useState('chains') // 'chains' | 'schedule'
  const [editing, setEditing] = useState(null) // a task, 'new', or null
  const [showRooms, setShowRooms] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [showCopy, setShowCopy] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState(null)

  const photosByTask = useMemo(() => {
    const out = {}
    photos.forEach((p) => {
      if (p.task_id) (out[p.task_id] ||= []).push(p)
    })
    return out
  }, [photos])

  const deps = useMemo(() => dependencyInfo(tasks), [tasks])

  const progress = taskProgress(tasks)
  const totalHours = tasks.reduce((sum, t) => sum + (Number(t.planned_hours) || 0), 0)

  const visible = tasks.filter((t) => {
    if (hideDone && t.status === 'done') return false
    if (roomFilter === 'none') return !t.room_id
    if (roomFilter !== 'all') return t.room_id === roomFilter
    return true
  })

  // What to draw: a flat schedule-ordered list, or chains (each task under the task it waits
  // on), grouped by room when showing all rooms.
  const sections = useMemo(() => {
    if (layout === 'schedule') return [{ key: 'all', title: null, rows: visible.map((task) => ({ task, depth: 0 })) }]
    if (roomFilter !== 'all') return [{ key: roomFilter, title: null, rows: orderByChains(visible) }]
    const out = []
    rooms.forEach((r) => {
      const inRoom = visible.filter((t) => t.room_id === r.id)
      if (inRoom.length) out.push({ key: r.id, title: r.name, rows: orderByChains(inRoom) })
    })
    const none = visible.filter((t) => !t.room_id || !roomsById[t.room_id])
    if (none.length) out.push({ key: 'none', title: rooms.length ? 'No room' : null, rows: orderByChains(none) })
    return out
  }, [layout, visible, roomFilter, rooms, roomsById])

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

  function renderTask({ task, depth }) {
    const status = taskStatusMeta(task.status)
    const room = task.room_id ? roomsById[task.room_id] : null
    const dates = fmtDateRange(task.planned_start, task.planned_end)
    const note = scheduleNote(task)
    const dur = durations(task)
    const info = deps[task.id]
    const blockers = info?.blockers || []
    const photoCount = (photosByTask[task.id] || []).length
    const mats = materialsByTask[task.id] || []
    const eq = equipmentByTask[task.id] || []
    const cost = isAdmin ? taskCost(mats, eq, matPrices, eqPrices) : null
    const matProgress = materialProgress(mats)
    const matWarning = materialWarning(task, mats)
    const blockerLabel = (b) =>
      `${b.name}${b.room_id !== task.room_id && b.room_id && roomsById[b.room_id] ? ` (${roomsById[b.room_id].name})` : ''}`
    const indent = layout === 'chains' ? Math.min(depth, 4) * 20 : 0

    const bits = [
      note && (
        <span key="note" className={note.tone === 'bad' ? 'text-status-blocked' : 'text-status-done'}>
          {note.text}
        </span>
      ),
      dur.actual != null && (
        <span key="dur">
          {fmtDays(dur.actual)}
          {dur.open ? ' so far' : ' taken'}
        </span>
      ),
      mats.length + eq.length > 0 && (
        <span key="lines">
          {mats.length > 0
            ? `${matProgress.delivered} of ${mats.length} material${mats.length === 1 ? '' : 's'} delivered`
            : ''}
          {mats.length > 0 && eq.length > 0 ? ', ' : ''}
          {eq.length > 0 ? `${eq.length} tool${eq.length === 1 ? '' : 's'}` : ''}
        </span>
      ),
      cost && cost.total > 0 && (
        <span key="cost" className="font-medium text-ink-800">
          {fmtMoney(cost.total)} planned
        </span>
      ),
      photoCount > 0 && (
        <span key="photos">
          {photoCount} photo{photoCount === 1 ? '' : 's'}
        </span>
      )
    ].filter(Boolean)

    return (
      <li key={task.id} style={{ marginLeft: indent }} className="relative">
        {layout === 'chains' && depth > 0 && (
          <span aria-hidden="true" className="absolute -left-3 top-4 text-sm text-ink-400">
            ↳
          </span>
        )}
        <div
          className={`flex items-stretch gap-3 rounded-xl border bg-white p-3 shadow-sm ${
            info?.waiting ? 'border-status-blocked/30 bg-ink-50' : 'border-ink-100'
          }`}
        >
          <button
            onClick={() => toggleDone(task)}
            disabled={busyId === task.id}
            aria-label={task.status === 'done' ? 'Mark as not done' : 'Mark as done'}
            className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold disabled:opacity-50 ${
              task.status === 'done' ? 'border-status-done bg-status-done text-white' : 'border-ink-200 text-transparent'
            }`}
          >
            ✓
          </button>

          <button onClick={() => setEditing(task)} className="min-w-0 flex-1 text-left">
            <div className="flex items-start justify-between gap-2">
              <p
                className={`text-base font-medium ${task.status === 'done' ? 'text-ink-400 line-through' : 'text-ink-900'}`}
              >
                {task.name}
              </p>
              <span className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-ink-50 px-2 py-0.5 text-xs font-medium text-ink-800">
                <span className="status-dot" style={{ backgroundColor: status.color }} />
                {status.label}
              </span>
            </div>

            {(info?.waiting || (info?.ready && blockers.length > 0) || info?.holdingUp > 0 || matWarning) && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {info.waiting && (
                  <Badge tone="wait">
                    {blockers.length > 1
                      ? `⏳ Waiting on ${info.unfinished.length} of ${blockers.length}: ${info.unfinished.map(blockerLabel).join(', ')}`
                      : `⏳ Waiting on ${blockerLabel(info.unfinished[0])}`}
                  </Badge>
                )}
                {info.ready && blockers.length > 0 && (
                  <Badge tone="ready">
                    {blockers.length > 1
                      ? `✓ Ready to start, all ${blockers.length} are done`
                      : `✓ Ready to start, ${blockers[0].name} is done`}
                  </Badge>
                )}
                {matWarning && <Badge tone="hold">⚠ {matWarning}</Badge>}
                {info.holdingUp > 0 && (
                  <Badge tone="hold">
                    Holding up {info.holdingUp} task{info.holdingUp === 1 ? '' : 's'}
                  </Badge>
                )}
              </div>
            )}

            <p className="mt-1 text-xs text-ink-600">
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

            {bits.length > 0 && (
              <p className="mt-1.5 text-xs text-ink-600">
                {bits.map((b, i) => (
                  <span key={i}>
                    {i > 0 ? '  ·  ' : ''}
                    {b}
                  </span>
                ))}
              </p>
            )}
          </button>
        </div>
      </li>
    )
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink-800">Tasks ({tasks.length})</h3>
          {tasks.length > 0 && (
            <p className="text-xs text-ink-400">
              {progress.done} of {progress.total} done · {progress.percent}% overall
              {totalHours > 0 ? ` · ${fmtHours(totalHours)} planned` : ''}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowRooms((v) => !v)}
            className="rounded-full border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600"
          >
            {showRooms ? 'Hide rooms' : `Rooms (${rooms.length})`}
          </button>
          {tasks.length > 0 && rooms.length > 0 && (
            <button
              onClick={() => setShowCopy(true)}
              className="rounded-full border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600"
            >
              Copy to rooms
            </button>
          )}
          <button
            onClick={() => setShowBulk(true)}
            className="rounded-full border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600"
          >
            Add many
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
        </div>
      )}

      {tasks.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-600">
          <div className="flex overflow-hidden rounded-full border border-ink-200">
            {[
              { id: 'chains', label: 'By dependency' },
              { id: 'schedule', label: 'By date' }
            ].map((l) => (
              <button
                key={l.id}
                onClick={() => setLayout(l.id)}
                aria-pressed={layout === l.id}
                className={`px-3 py-1 font-medium ${layout === l.id ? 'bg-ink-900 text-white' : 'text-ink-600'}`}
              >
                {l.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
            Hide done
          </label>
        </div>
      )}

      {loading && <p className="py-8 text-center text-sm text-ink-400">Loading tasks…</p>}

      {!loading && !error && tasks.length === 0 && (
        <p className="rounded-xl border border-dashed border-ink-200 py-10 text-center text-sm text-ink-600">
          No tasks yet. Add the first one, or use "Add many" to type a whole list at once.
        </p>
      )}

      {!loading && tasks.length > 0 && visible.length === 0 && (
        <p className="py-8 text-center text-sm text-ink-600">No tasks match these filters.</p>
      )}

      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.key}>
            {section.title && (
              <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">{section.title}</h4>
            )}
            <ul className="space-y-2 pl-3">{section.rows.map(renderTask)}</ul>
          </div>
        ))}
      </div>

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
      {showBulk && <BulkAddTasks project={project} defaultRoomId={roomFilter} onClose={() => setShowBulk(false)} />}
      {showCopy && <CopyTasks project={project} defaultRoomId={roomFilter} onClose={() => setShowCopy(false)} />}
    </div>
  )
}
