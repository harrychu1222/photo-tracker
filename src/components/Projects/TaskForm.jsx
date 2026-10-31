import { useState } from 'react'
import RoomPicker from './RoomPicker'
import TaskCosts from './TaskCosts'
import { dependentsOf } from '../../lib/deps'
import { useAuth } from '../../context/AuthContext'
import { useWork } from '../../context/WorkContext'
import { TASK_STATUSES } from '../../statusConfig'
import { durations, fmtDays, fmtHours, scheduleNote, statusPatch } from '../../lib/tasks'

const inputClass =
  'w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-base focus:border-signal-500'
const labelClass = 'mb-1 block text-sm font-medium text-ink-800'

// Create (task = null) or edit one task of a project.
export default function TaskForm({ project, task, projectTasks, photos = [], onClose }) {
  const { user, isAdmin } = useAuth()
  const { createTask, updateTask, deleteTask, roomsById, setTaskBlockers, linksReady } = useWork()

  const [name, setName] = useState(task?.name || '')
  const [roomId, setRoomId] = useState(task?.room_id || '')
  const [status, setStatus] = useState(task?.status || 'todo')
  const [percent, setPercent] = useState(task?.percent_complete ?? 0)
  const [plannedStart, setPlannedStart] = useState(task?.planned_start || '')
  const [plannedEnd, setPlannedEnd] = useState(task?.planned_end || '')
  const [actualStart, setActualStart] = useState(task?.actual_start || '')
  const [actualEnd, setActualEnd] = useState(task?.actual_end || '')
  const [hours, setHours] = useState(task?.planned_hours ?? '')
  const [blockerIds, setBlockerIds] = useState(task?.blocked_by_ids || [])
  const [notes, setNotes] = useState(task?.notes || '')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const canDelete = !!task && (isAdmin || task.created_by === user?.id)
  // Tasks that already wait on this one (directly or down a chain) can't be waited on, or it would loop.
  const loopIds = task ? dependentsOf(projectTasks, task.id) : new Set()
  const otherTasks = projectTasks.filter((t) => t.id !== task?.id && !loopIds.has(t.id))

  // Changing status (or progress) also fills in / clears the actual dates, so the plan-vs-actual
  // numbers stay honest. Everything it sets can still be edited by hand before saving.
  function applyStatus(nextStatus, nextPercent = percent) {
    const patch = statusPatch(
      { percent_complete: nextPercent, actual_start: actualStart, actual_end: actualEnd },
      nextStatus
    )
    setStatus(patch.status)
    setPercent(patch.percent_complete)
    setActualStart(patch.actual_start || '')
    setActualEnd(patch.actual_end || '')
  }

  function handlePercent(value) {
    let next = status
    if (value === 100) next = 'done'
    else if (status === 'done') next = 'in_progress'
    else if (value > 0 && status === 'todo') next = 'in_progress'
    applyStatus(next, value)
  }

  const preview = {
    status,
    planned_start: plannedStart || null,
    planned_end: plannedEnd || null,
    actual_start: actualStart || null,
    actual_end: actualEnd || null
  }
  const dur = durations(preview)
  const note = scheduleNote(preview)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return setError('Give the task a name.')
    if (plannedStart && plannedEnd && plannedEnd < plannedStart) return setError('Planned end is before planned start.')
    if (actualStart && actualEnd && actualEnd < actualStart) return setError('Actual end is before actual start.')
    if (hours !== '' && Number(hours) < 0) return setError('Planned hours cannot be negative.')
    if (blockerIds.some((id) => loopIds.has(id))) {
      return setError('A task you picked already waits on this one, so this would make a loop.')
    }

    const fields = {
      name: name.trim(),
      room_id: roomId || null,
      status,
      percent_complete: percent,
      planned_start: plannedStart || null,
      planned_end: plannedEnd || null,
      actual_start: actualStart || null,
      actual_end: actualEnd || null,
      planned_hours: hours === '' ? null : Number(hours),
      // Before migration 7 only the old single link exists.
      ...(linksReady ? {} : { blocked_by: blockerIds[0] || null }),
      notes: notes.trim() || null
    }

    setError(null)
    setSaving(true)
    try {
      let saved = task
      if (task) await updateTask(task.id, fields)
      else saved = await createTask({ ...fields, project_id: project.id })
      if (linksReady) await setTaskBlockers(saved.id, blockerIds)
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete the task "${task.name}"? Photos linked to it are kept. This cannot be undone.`)) return
    try {
      await deleteTask(task.id)
      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-5 pb-8 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink-900">{task ? 'Edit task' : 'New task'}</h2>
          <button onClick={onClose} className="text-2xl leading-none text-ink-400" aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Task</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="e.g. Install benchtop"
              autoFocus={!task}
            />
          </div>

          <div>
            <label className={labelClass}>Room</label>
            <RoomPicker projectId={project.id} value={roomId} onChange={setRoomId} />
          </div>

          <div>
            <label className={labelClass}>Status</label>
            <div className="flex flex-wrap gap-1.5">
              {TASK_STATUSES.map((s) => (
                <button
                  type="button"
                  key={s.value}
                  onClick={() => applyStatus(s.value)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
                    status === s.value ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-600'
                  }`}
                >
                  <span className="status-dot" style={{ backgroundColor: s.color }} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>Progress: {percent}%</label>
            <input
              type="range"
              min={0}
              max={100}
              step={10}
              value={percent}
              onChange={(e) => handlePercent(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <fieldset className="rounded-xl border border-ink-100 p-3">
            <legend className="px-1 text-sm font-semibold text-ink-800">Planned</legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Start</label>
                <input type="date" value={plannedStart} onChange={(e) => setPlannedStart(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>End</label>
                <input type="date" value={plannedEnd} onChange={(e) => setPlannedEnd(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="mt-3">
              <label className={labelClass}>Planned man-hours</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.25"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className={inputClass}
                placeholder="Total hours across everyone, e.g. 12"
              />
            </div>
          </fieldset>

          <fieldset className="rounded-xl border border-ink-100 p-3">
            <legend className="px-1 text-sm font-semibold text-ink-800">Actual</legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Start</label>
                <input type="date" value={actualStart} onChange={(e) => setActualStart(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>End</label>
                <input type="date" value={actualEnd} onChange={(e) => setActualEnd(e.target.value)} className={inputClass} />
              </div>
            </div>
            <p className="mt-2 text-xs text-ink-400">
              Filled in automatically when you change the status; you can still edit them. Actual man-hours will come
              from time entries in a later update.
            </p>
          </fieldset>

          {(dur.planned != null || dur.actual != null || note) && (
            <div className="rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-800">
              <p>
                Planned {fmtDays(dur.planned)} · Actual {fmtDays(dur.actual)}
                {dur.open && dur.actual != null ? ' so far' : ''} · Planned {fmtHours(hours)}
              </p>
              {note && (
                <p className={note.tone === 'bad' ? 'text-status-blocked' : 'text-status-done'}>{note.text}</p>
              )}
            </div>
          )}

          <div>
            <label className={labelClass}>
              Waiting on (optional){blockerIds.length > 0 ? `: ${blockerIds.length} picked` : ''}
            </label>
            {otherTasks.length === 0 ? (
              <p className="text-xs text-ink-400">There are no other tasks in this project yet.</p>
            ) : (
              <ul className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-ink-200 p-2">
                {otherTasks.map((t) => {
                  const checked = blockerIds.includes(t.id)
                  const room = t.room_id && roomsById[t.room_id] ? ` (${roomsById[t.room_id].name})` : ''
                  return (
                    <li key={t.id}>
                      <label className="flex items-center gap-2 rounded px-1 py-1 text-sm text-ink-900">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setBlockerIds((cur) =>
                              checked
                                ? cur.filter((id) => id !== t.id)
                                : linksReady
                                  ? [...cur, t.id]
                                  : [t.id]
                            )
                          }
                        />
                        <span className={t.status === 'done' ? 'text-ink-400' : ''}>
                          {`${t.name}${room}${t.status === 'done' ? ' ✓' : ''}`}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
            <p className="mt-1 text-xs text-ink-400">
              {linksReady
                ? 'Tick every task that must finish first. A reminder only; dates are not moved automatically.'
                : 'Run migration 7 to wait on several tasks; until then only one can be picked.'}
            </p>
          </div>

          {task ? (
            <TaskCosts task={task} />
          ) : (
            <p className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">
              Save the task first, then open it to add materials and equipment.
            </p>
          )}

          <div>
            <label className={labelClass}>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputClass} />
          </div>

          {task && (
            <div>
              <p className={labelClass}>Photos on this task ({photos.length})</p>
              {photos.length === 0 ? (
                <p className="text-xs text-ink-400">
                  None yet. When you add or edit a photo, pick this project and then this task.
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-1.5">
                  {photos.map((p) => (
                    <div key={p.id} className="aspect-square overflow-hidden rounded-lg bg-ink-100">
                      {p.url && <img src={p.url} alt="" className="h-full w-full object-cover" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-status-blocked">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-signal-500 py-3 text-base font-medium text-white disabled:opacity-60"
          >
            {saving ? 'Saving…' : task ? 'Save task' : 'Add task'}
          </button>

          {canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              className="w-full rounded-lg border border-status-blocked py-2.5 text-sm font-medium text-status-blocked"
            >
              Delete task
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
