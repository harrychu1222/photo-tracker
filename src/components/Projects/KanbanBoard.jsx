import { useState } from 'react'
import TaskForm from './TaskForm'
import { useWork } from '../../context/WorkContext'
import { useMedia } from '../../hooks/useMedia'
import { TASK_STATUSES } from '../../statusConfig'
import { fmtHours, scheduleNote, statusPatch } from '../../lib/tasks'
import { fmtDateRange } from '../../lib/format'

const chip = (on) =>
  `min-h-[44px] rounded-full border px-4 text-sm font-semibold ${on ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 bg-white text-ink-600'}`

// The next sensible move for a card, shown as its main button.
const NEXT = {
  todo: { to: 'in_progress', label: 'Start' },
  in_progress: { to: 'done', label: 'Mark done' },
  blocked: { to: 'in_progress', label: 'Resume' },
  done: { to: 'in_progress', label: 'Reopen' }
}

// All of a project's tasks as cards in status columns. Drag a card (on a computer) or tap its
// buttons to change status. Tap a card to open the task.
export default function KanbanBoard({ project, photos }) {
  const { tasksByProject, roomsByProject, roomsById, updateTask } = useWork()
  const isDesktop = useMedia('(min-width: 768px)')
  const tasks = tasksByProject[project.id] || []
  const rooms = roomsByProject[project.id] || []
  const [roomFilter, setRoomFilter] = useState('all') // 'all' | 'none' | room id
  const [column, setColumn] = useState('in_progress') // phone: the column on show
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState(null)
  const [dragOver, setDragOver] = useState(null)

  const visible = tasks.filter((t) =>
    roomFilter === 'all' ? true : roomFilter === 'none' ? !t.room_id || !roomsById[t.room_id] : t.room_id === roomFilter
  )
  const by = (status) => visible.filter((t) => (t.status || 'todo') === status).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  const editingTask = editing ? tasks.find((t) => t.id === editing) || null : null

  async function move(task, status) {
    if ((task.status || 'todo') === status) return
    setError(null)
    try {
      await updateTask(task.id, statusPatch(task, status))
    } catch (err) {
      setError(err.message)
    }
  }

  const renderCard = (task) => {
    const note = scheduleNote(task)
    const room = roomsById[task.room_id]?.name
    const dates = fmtDateRange(task.planned_start, task.planned_end)
    const status = task.status || 'todo'
    const next = NEXT[status]
    return (
      <article
        key={task.id}
        draggable={isDesktop}
        onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
        className="rounded-xl border border-ink-200 bg-white p-3 shadow-sm"
        data-testid={`card-${task.id}`}
      >
        <button onClick={() => setEditing(task.id)} className="block w-full text-left" aria-label={`Open task ${task.name}`}>
          <span className="block text-sm font-semibold text-ink-900">{task.name}</span>
          {room && <span className="mt-1 inline-block rounded-md bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-800">{room}</span>}
          <span className="mt-2 flex items-center gap-2">
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
              <span className="block h-full rounded-full bg-signal-500" style={{ width: `${task.percent_complete || 0}%` }} />
            </span>
            <span className="text-xs font-semibold text-ink-600">{task.percent_complete || 0}%</span>
          </span>
          {(dates || task.planned_hours != null) && (
            <span className="mt-2 flex justify-between gap-2 text-xs text-ink-600">
              <span>{dates}</span>
              {task.planned_hours != null && <span>{fmtHours(task.planned_hours)}</span>}
            </span>
          )}
          {note && <span className={`mt-1 block text-xs font-semibold ${note.tone === 'bad' ? 'text-[#7A2A1D]' : 'text-status-done'}`}>{note.text}</span>}
        </button>
        <div className="mt-3 flex gap-2">
          {status !== 'done' && status !== 'blocked' && (
            <button onClick={() => move(task, 'blocked')} className="min-h-[44px] flex-1 rounded-lg border border-ink-200 text-xs font-semibold text-ink-800" aria-label={`Block ${task.name}`}>
              Block
            </button>
          )}
          <button
            onClick={() => move(task, next.to)}
            className={`min-h-[44px] flex-1 rounded-lg text-xs font-semibold ${status === 'in_progress' ? 'bg-status-done text-white' : 'border border-ink-200 text-ink-800'}`}
            aria-label={`${next.label} ${task.name}`}
          >
            {next.label}
          </button>
        </div>
      </article>
    )
  }

  const columns = isDesktop ? TASK_STATUSES : TASK_STATUSES.filter((s) => s.value === column)

  return (
    <div>
      {tasks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-200 bg-white py-10 text-center text-sm text-ink-600">
          No tasks yet. Add tasks on the Tasks tab and they will appear here as cards.
        </p>
      ) : (
        <>
          {rooms.length > 0 && (
            <div className="mb-3 flex gap-1.5 overflow-x-auto" role="group" aria-label="Room filter">
              <button onClick={() => setRoomFilter('all')} className={chip(roomFilter === 'all')} aria-pressed={roomFilter === 'all'}>All rooms</button>
              {rooms.map((r) => (
                <button key={r.id} onClick={() => setRoomFilter(r.id)} className={`${chip(roomFilter === r.id)} whitespace-nowrap`} aria-pressed={roomFilter === r.id}>{r.name}</button>
              ))}
              <button onClick={() => setRoomFilter('none')} className={`${chip(roomFilter === 'none')} whitespace-nowrap`} aria-pressed={roomFilter === 'none'}>No room</button>
            </div>
          )}
          {!isDesktop && (
            <div className="mb-3 flex gap-1.5 overflow-x-auto" role="group" aria-label="Board columns">
              {TASK_STATUSES.map((s) => (
                <button key={s.value} onClick={() => setColumn(s.value)} className={`${chip(column === s.value)} flex items-center gap-2 whitespace-nowrap`} aria-pressed={column === s.value}>
                  {s.label} <span className="rounded-full bg-black/10 px-2 text-xs">{by(s.value).length}</span>
                </button>
              ))}
            </div>
          )}
          {error && <p className="mb-2 text-sm text-status-blocked">{error}</p>}
          <div className={isDesktop ? 'grid grid-cols-4 items-start gap-3' : ''} data-testid="board">
            {columns.map((s) => {
              const list = by(s.value)
              return (
                <section
                  key={s.value}
                  aria-label={s.label}
                  data-testid={`col-${s.value}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(s.value) }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOver(null)
                    const t = tasks.find((x) => x.id === e.dataTransfer.getData('text/plain'))
                    if (t) move(t, s.value)
                  }}
                  className={`min-h-[8rem] rounded-xl p-2 ${dragOver === s.value ? 'bg-signal-100 outline outline-2 outline-signal-500' : 'bg-ink-100'}`}
                >
                  {isDesktop && (
                    <h3 className="mb-2 flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-800">
                      <span className="status-dot" style={{ backgroundColor: s.color }} />
                      {s.label}
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-ink-600">{list.length}</span>
                    </h3>
                  )}
                  <div className="space-y-2">
                    {list.map(renderCard)}
                    {list.length === 0 && <p className="px-1 py-4 text-center text-xs text-ink-400">Nothing here</p>}
                  </div>
                </section>
              )
            })}
          </div>
        </>
      )}
      {editing && editingTask && (
        <TaskForm key={editingTask.id} project={project} task={editingTask} projectTasks={tasks} photos={photos.filter((p) => p.task_id === editingTask.id)} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}
