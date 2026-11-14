import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useWork } from '../../context/WorkContext'
import { taskStatusMeta } from '../../statusConfig'
import { fmtDate, fmtDateRange, fmtShort } from '../../lib/format'
import WorkersPanel from './WorkersPanel'
import { useUndo } from '../../context/UndoContext'
import { assigneeLabel, isAssigned, matchWho, nameKey, personName } from '../../lib/people'
import { fmtHours, statusPatch, todayLocal } from '../../lib/tasks'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// The signed-in person's jobs: what is overdue, what is on today, and what is coming this week.
export default function MyDay({ projects, onOpenProject, onAddPhoto }) {
  const { user, isAdmin } = useAuth()
  const { tasksByProject, roomsById, updateTask, team, loading, workerNames: names } = useWork()
  const [managing, setManaging] = useState(false)
  const [who, setWho] = useState('me') // admins: 'me' | 'all' | a user id | 'name:<typed name>'
  const [busyId, setBusyId] = useState(null)
  const { offer } = useUndo()
  const [noting, setNoting] = useState(null) // task id with the note box open
  const [noteText, setNoteText] = useState('')
  const [error, setError] = useState(null)
  const today = todayLocal()
  const weekEnd = addDays(today, 7)
  const day = new Date(`${today}T00:00:00Z`).getUTCDay()

  const mine = projects.flatMap((p) =>
    (tasksByProject[p.id] || [])
      .filter((t) => t.status !== 'done' && isAssigned(t) && matchWho(t, who, user?.id))
      .map((t) => ({ t, p }))
  )
  const byDate = (a, b) => (a.t.planned_end || a.t.planned_start || '9999').localeCompare(b.t.planned_end || b.t.planned_start || '9999')
  const overdue = mine.filter(({ t }) => t.planned_end && t.planned_end < today).sort(byDate)
  const rest = mine.filter((x) => !overdue.includes(x))
  const now = rest.filter(({ t }) => t.status === 'in_progress' || (t.planned_start && t.planned_start <= today)).sort(byDate)
  const soon = rest.filter((x) => !now.includes(x) && x.t.planned_start && x.t.planned_start <= weekEnd).sort((a, b) => a.t.planned_start.localeCompare(b.t.planned_start))
  const undated = rest.filter((x) => !now.includes(x) && !soon.includes(x) && !x.t.planned_start)

  async function act(task, status) {
    setBusyId(task.id)
    setError(null)
    try {
      const before = { status: task.status, percent_complete: task.percent_complete, actual_start: task.actual_start, actual_end: task.actual_end }
      await updateTask(task.id, statusPatch(task, status))
      offer(status === 'done' ? `"${task.name}" marked done` : `"${task.name}" started`, () => updateTask(task.id, before))
    } catch (err) {
      setError(err.message)
    }
    setBusyId(null)
  }


  async function saveNote(task) {
    const text = noteText.trim()
    if (!text) return
    setBusyId(task.id)
    setError(null)
    try {
      const line = `${fmtDate(today)} ${personName(user?.email)}: ${text}`
      await updateTask(task.id, { notes: task.notes ? `${task.notes}\n${line}` : line })
      const before = task.notes || null
      offer('Note added', () => updateTask(task.id, { notes: before }))
      setNoting(null)
      setNoteText('')
    } catch (err) {
      setError(err.message)
    }
    setBusyId(null)
  }

  const card = ({ t, p }, tone) => {
    const st = taskStatusMeta(t.status)
    const room = roomsById[t.room_id]?.name
    return (
      <li key={t.id} className="rounded-xl border border-ink-100 bg-white p-3" data-testid={`myday-${t.id}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-900">{t.name}</p>
            <button onClick={() => onOpenProject(p.id)} className="min-h-[32px] text-left text-sm text-ink-600 underline decoration-ink-200 underline-offset-2" aria-label={`Open project ${p.name}`}>{[p.name, room].filter(Boolean).join(' · ')}</button>
            <p className={`mt-1 text-xs ${tone === 'bad' ? 'font-semibold text-status-blocked' : 'text-ink-600'}`}>
              {[tone === 'bad' && t.planned_end ? `Was due ${fmtShort(t.planned_end)}` : fmtDateRange(t.planned_start, t.planned_end), t.planned_hours != null ? fmtHours(t.planned_hours) : null, who !== 'me' && who !== 'all' ? assigneeLabel(t, team) : null].filter(Boolean).join(' · ') || 'No dates yet'}
            </p>
          </div>
          <span className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-ink-50 px-2.5 py-1 text-xs font-medium text-ink-800">
            <span className="status-dot" style={{ backgroundColor: st.color }} />
            {st.label}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {t.status !== 'in_progress' && <button disabled={busyId === t.id} onClick={() => act(t, 'in_progress')} className="min-h-[48px] rounded-lg border border-ink-200 bg-white px-4 text-sm font-semibold text-ink-900 disabled:opacity-60" aria-label={`Start ${t.name}`}>Start</button>}
          <button disabled={busyId === t.id} onClick={() => act(t, 'done')} className={`min-h-[48px] rounded-lg bg-ink-900 px-4 text-sm font-semibold text-white disabled:opacity-60 ${t.status === 'in_progress' ? 'col-span-2' : ''}`} aria-label={`Mark ${t.name} done`}>Done</button>
          {onAddPhoto && <button onClick={() => onAddPhoto({ projectId: p.id, roomId: t.room_id || '', taskId: t.id })} className="min-h-[48px] rounded-lg border border-ink-200 bg-white px-4 text-sm font-semibold text-ink-900" aria-label={`Add photo to ${t.name}`}>Photo</button>}
          <button onClick={() => { setNoting(noting === t.id ? null : t.id); setNoteText('') }} className={`min-h-[48px] rounded-lg border border-ink-200 bg-white px-4 text-sm font-semibold text-ink-900 ${onAddPhoto ? '' : 'col-span-2'}`} aria-label={`Add note to ${t.name}`}>Note</button>
        </div>
        {noting === t.id && (
          <div className="mt-2 flex gap-2">
            <input aria-label={`Note for ${t.name}`} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="What happened?" className="min-w-0 flex-1 rounded-lg border border-ink-200 px-3 py-2 text-base" />
            <button disabled={busyId === t.id || !noteText.trim()} onClick={() => saveNote(t)} className="min-h-[44px] rounded-lg bg-ink-900 px-4 text-sm font-semibold text-white disabled:opacity-60">Save</button>
          </div>
        )}
      </li>
    )
  }

  const byWorker = (list) => {
    const groups = []
    for (const x of list) {
      const name = assigneeLabel(x.t, team) || 'Unassigned'
      let g = groups.find((y) => y.name === name)
      if (!g) groups.push((g = { name, items: [] }))
      g.items.push(x)
    }
    return groups.sort((a, b) => a.name.localeCompare(b.name))
  }

  const section = (title, list, tone) =>
    list.length > 0 && (
      <section className="mb-5" aria-label={title}>
        <h3 className={`mb-2 text-xs font-bold uppercase tracking-[0.08em] ${tone === 'bad' ? 'text-status-blocked' : 'text-ink-600'}`}>{title} ({list.length})</h3>
        {who === 'all' ? (
          // Everyone's view: each section is split by worker.
          byWorker(list).map((g) => (
            <div key={g.name} className="mb-3" role="group" aria-label={`${title}: ${g.name}`}>
              <h4 className="mb-1.5 text-sm font-semibold text-ink-900">{g.name} ({g.items.length})</h4>
              <ul className="space-y-2">{g.items.map((x) => card(x, tone))}</ul>
            </div>
          ))
        ) : (
          <ul className="space-y-2">{list.map((x) => card(x, tone))}</ul>
        )}
      </section>
    )

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 md:px-10 md:py-6" data-testid="my-day">
      <h2 className="text-2xl font-bold tracking-tight text-ink-900">My Day</h2>
      <p className="mb-4 mt-1 text-sm text-ink-600">
        {WEEKDAYS[day]} {fmtShort(today)} · {now.length} on today{overdue.length ? ` · ${overdue.length} overdue` : ''}
      </p>
      {isAdmin && (team.length > 1 || names.length > 0) && (
        <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Show tasks for" className="mb-4 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm md:max-w-xs">
          <option value="me">My tasks</option>
          <option value="all">Everyone's tasks</option>
          {team.filter((m) => m.id !== user?.id).map((m) => <option key={m.id} value={m.id}>{personName(m.email)}</option>)}
          {names.map((n) => <option key={n} value={nameKey(n)}>{n}</option>)}
        </select>
      )}
      {isAdmin && (
        <div className="mb-4">
          <button onClick={() => setManaging((m) => !m)} aria-expanded={managing} className="min-h-[44px] text-sm font-medium text-ink-600 underline">{managing ? 'Hide workers' : 'Manage workers'}</button>
          {managing && <WorkersPanel />}
        </div>
      )}
      {error && <p className="mb-3 text-sm text-status-blocked" role="alert">{error}</p>}
      {loading && <p className="py-6 text-center text-sm text-ink-400">Loading…</p>}
      {section('Overdue', overdue, 'bad')}
      {section('Today', now)}
      {section('Coming up this week', soon)}
      {section('No dates yet', undated)}
      {!loading && mine.length === 0 && (
        <p className="rounded-xl border border-dashed border-ink-200 py-10 text-center text-sm text-ink-600">
          {who === 'me' ? 'Nothing is assigned to you. Ask for tasks to be assigned, or assign them on Plan > Tasks.' : 'No assigned tasks to show.'}
        </p>
      )}
    </div>
  )
}
