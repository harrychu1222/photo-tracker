import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useWork } from '../../context/WorkContext'
import LevelFilter from './LevelFilter'
import { roomsInLevel } from '../../lib/levels'
import { fmtDate } from '../../lib/format'
import { dayDiff, todayLocal } from '../../lib/tasks'

const inputClass = 'w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-base focus:border-signal-500'
const labelClass = 'mb-1 block text-sm font-medium text-ink-800'
const chip = (on) => `whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium ${on ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 bg-white text-ink-600'}`
const PRIORITIES = [
  { value: 'urgent', label: 'Urgent', cls: 'bg-[#F6DAD4] text-[#7A2A1D]' },
  { value: 'normal', label: 'Normal', cls: 'bg-ink-100 text-ink-800' },
  { value: 'low', label: 'Low', cls: 'bg-ink-50 text-ink-600' }
]
const STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'fixed', label: 'Fixed' }
]
const rank = { urgent: 0, normal: 1, low: 2 }

function DefectForm({ project, defect, rooms, tasks, onDone }) {
  const { addDefect, updateDefect } = useWork()
  const [f, setF] = useState({
    title: defect?.title || '',
    notes: defect?.notes || '',
    roomId: defect?.room_id || '',
    taskId: defect?.task_id || '',
    priority: defect?.priority || 'normal',
    status: defect?.status || 'open'
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }))
  const roomTasks = f.roomId ? tasks.filter((t) => t.room_id === f.roomId) : tasks

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (defect) await updateDefect(defect.id, f)
      else await addDefect(project.id, f)
      onDone()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="mb-4 space-y-3 rounded-xl border border-ink-100 bg-ink-50 p-3" aria-label="Defect form">
      <p className="text-sm font-semibold text-ink-900">{defect ? 'Edit defect' : 'New defect'}</p>
      <div>
        <label htmlFor="df-title" className={labelClass}>What is wrong</label>
        <input id="df-title" value={f.title} onChange={set('title')} placeholder="e.g. Chipped tile by the door" className={inputClass} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="df-room" className={labelClass}>Room</label>
          <select id="df-room" value={f.roomId} onChange={(e) => setF((v) => ({ ...v, roomId: e.target.value, taskId: '' }))} className={inputClass}>
            <option value="">No room</option>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="df-task" className={labelClass}>Related task (optional)</label>
          <select id="df-task" value={f.taskId} onChange={set('taskId')} className={inputClass}>
            <option value="">None</option>
            {roomTasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="df-priority" className={labelClass}>Priority</label>
          <select id="df-priority" value={f.priority} onChange={set('priority')} className={inputClass}>
            {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="df-status" className={labelClass}>Status</label>
          <select id="df-status" value={f.status} onChange={set('status')} className={inputClass}>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="df-notes" className={labelClass}>Notes (optional)</label>
        <textarea id="df-notes" rows={2} value={f.notes} onChange={set('notes')} className={inputClass} />
      </div>
      {error && <p className="text-sm text-status-blocked" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="min-h-[44px] rounded-lg bg-signal-500 px-5 text-sm font-semibold text-ink-950 disabled:opacity-60">{defect ? 'Save changes' : 'Add defect'}</button>
        <button type="button" onClick={onDone} className="min-h-[44px] rounded-lg border border-ink-200 bg-white px-5 text-sm font-semibold text-ink-900">Cancel</button>
      </div>
    </form>
  )
}

export default function DefectsTab({ project }) {
  const { user, isAdmin } = useAuth()
  const { defectsByProject, defectsError, roomsByProject, tasksByProject, setDefectStatus, deleteDefect } = useWork()
  const all = defectsByProject[project.id] || []
  const allRooms = roomsByProject[project.id] || []
  const tasks = tasksByProject[project.id] || []
  const [filter, setFilter] = useState('open') // 'open' | 'fixed' | 'all'
  const [level, setLevel] = useState('all')
  const [roomId, setRoomId] = useState('all')
  const [editing, setEditing] = useState(null) // 'new' | a defect | null
  const [error, setError] = useState(null)
  const today = todayLocal()

  const levelRooms = roomsInLevel(allRooms, level)
  const openCount = all.filter((d) => d.status !== 'fixed').length
  const fixedCount = all.length - openCount
  const rows = all
    .filter((d) => (filter === 'open' ? d.status !== 'fixed' : filter === 'fixed' ? d.status === 'fixed' : true))
    .filter((d) => (level === 'all' ? true : levelRooms.some((r) => r.id === d.room_id)))
    .filter((d) => roomId === 'all' || (roomId === 'none' ? !d.room_id : d.room_id === roomId))
    .sort((a, b) => (a.status === 'fixed') - (b.status === 'fixed') || rank[a.priority] - rank[b.priority] || (a.raised_on < b.raised_on ? -1 : 1))
  const roomName = (id) => allRooms.find((r) => r.id === id)?.name
  const taskName = (id) => tasks.find((t) => t.id === id)?.name

  async function act(fn) {
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err.message)
    }
  }

  if (defectsError) return <p className="text-sm text-status-blocked">{defectsError}</p>

  return (
    <div>
      {editing ? (
        <DefectForm key={editing === 'new' ? 'new' : editing.id} project={project} defect={editing === 'new' ? null : editing} rooms={allRooms} tasks={tasks} onDone={() => setEditing(null)} />
      ) : (
        <button onClick={() => setEditing('new')} className="mb-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-signal-500 px-4 text-sm font-semibold text-ink-950 active:bg-signal-600 sm:w-auto">
          + Add defect
        </button>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Defect status filter">
        <button onClick={() => setFilter('open')} className={chip(filter === 'open')} aria-pressed={filter === 'open'}>Open ({openCount})</button>
        <button onClick={() => setFilter('fixed')} className={chip(filter === 'fixed')} aria-pressed={filter === 'fixed'}>Fixed ({fixedCount})</button>
        <button onClick={() => setFilter('all')} className={chip(filter === 'all')} aria-pressed={filter === 'all'}>All ({all.length})</button>
      </div>
      <LevelFilter rooms={allRooms} level={level} onLevel={(l) => { setLevel(l); setRoomId('all') }} />
      {levelRooms.length > 0 && (
        <select value={roomId} onChange={(e) => setRoomId(e.target.value)} aria-label="Filter by room" className="mb-3 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm md:max-w-xs">
          <option value="all">All rooms</option>
          {levelRooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          <option value="none">No room</option>
        </select>
      )}
      {error && <p className="mb-3 text-sm text-status-blocked" role="alert">{error}</p>}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-200 py-10 text-center text-sm text-ink-600">
          {all.length === 0 ? 'No defects logged. Add one when you spot something to fix.' : 'No defects match this filter.'}
        </p>
      ) : (
        <ul className="space-y-2" data-testid="defect-list">
          {rows.map((d) => {
            const pr = PRIORITIES.find((p) => p.value === d.priority) || PRIORITIES[1]
            const age = d.status === 'fixed' ? null : Math.max(0, dayDiff(d.raised_on, today))
            const canDelete = isAdmin || d.created_by === user?.id
            return (
              <li key={d.id} className="rounded-xl border border-ink-100 bg-white p-3" data-testid={`defect-${d.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => setEditing(d)} className="min-w-0 flex-1 text-left" aria-label={`Edit ${d.title}`}>
                    <p className={`text-sm font-semibold ${d.status === 'fixed' ? 'text-ink-600 line-through' : 'text-ink-900'}`}>{d.title}</p>
                    <p className="mt-0.5 text-xs text-ink-600">
                      {[roomName(d.room_id), taskName(d.task_id), `Raised ${fmtDate(d.raised_on)}`, d.status === 'fixed' && d.fixed_on ? `Fixed ${fmtDate(d.fixed_on)}` : null].filter(Boolean).join(' · ')}
                    </p>
                    {d.notes && <p className="mt-1 text-xs text-ink-600">{d.notes}</p>}
                  </button>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${pr.cls}`}>{pr.label}</span>
                    {age != null && <span className="text-xs text-ink-600">{age === 0 ? 'Today' : `${age} day${age === 1 ? '' : 's'} open`}</span>}
                    {d.status === 'in_progress' && <span className="text-xs font-semibold text-[#7A4B05]">In progress</span>}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {d.status === 'fixed' ? (
                    <button onClick={() => act(() => setDefectStatus(d.id, 'open'))} className="min-h-[40px] rounded-lg border border-ink-200 bg-white px-3 text-xs font-semibold text-ink-900">Reopen</button>
                  ) : (
                    <>
                      {d.status === 'open' && <button onClick={() => act(() => setDefectStatus(d.id, 'in_progress'))} className="min-h-[40px] rounded-lg border border-ink-200 bg-white px-3 text-xs font-semibold text-ink-900">Start work</button>}
                      <button onClick={() => act(() => setDefectStatus(d.id, 'fixed'))} className="min-h-[40px] rounded-lg bg-ink-900 px-3 text-xs font-semibold text-white" aria-label={`Mark ${d.title} fixed`}>Mark fixed</button>
                    </>
                  )}
                  {canDelete && (
                    <button onClick={() => act(() => deleteDefect(d.id))} className="min-h-[40px] px-2 text-xs font-medium text-ink-400 underline" aria-label={`Delete ${d.title}`}>Delete</button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
