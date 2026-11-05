import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useWork } from '../../context/WorkContext'
import { fmtDate } from '../../lib/format'
import { assigneeLabel } from '../../lib/people'
import { todayLocal } from '../../lib/tasks'

const inputClass = 'w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-base focus:border-signal-500'
const labelClass = 'mb-1 block text-sm font-medium text-ink-800'
const WEATHER = ['Sunny', 'Cloudy', 'Rain', 'Hot', 'Windy', 'Cold']
const chip = (on) => `whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium ${on ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 bg-white text-ink-600'}`

function DiaryForm({ project, entry, onDone }) {
  const { addDiary, updateDiary, tasksByProject, team } = useWork()
  // New entries start with the people on jobs that are in progress.
  const suggested = [...new Set((tasksByProject[project.id] || []).filter((t) => t.status === 'in_progress').map((t) => assigneeLabel(t, team)).filter(Boolean))].join(', ')
  const [f, setF] = useState({
    date: entry?.entry_date || todayLocal(),
    weather: entry?.weather || '',
    onSite: entry ? entry.on_site || '' : suggested,
    workDone: entry?.work_done || '',
    issues: entry?.issues || ''
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }))

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (entry) await updateDiary(entry.id, f)
      else await addDiary(project.id, f)
      onDone()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="mb-4 space-y-3 rounded-xl border border-ink-100 bg-ink-50 p-3" aria-label="Diary form">
      <p className="text-sm font-semibold text-ink-900">{entry ? 'Edit diary entry' : 'New diary entry'}</p>
      <div>
        <label htmlFor="dr-date" className={labelClass}>Date</label>
        <input id="dr-date" type="date" value={f.date} onChange={set('date')} className={inputClass} />
      </div>
      <div>
        <p className={labelClass}>Weather</p>
        <div className="flex flex-wrap gap-2">
          {WEATHER.map((w) => (
            <button type="button" key={w} aria-pressed={f.weather === w} onClick={() => setF((v) => ({ ...v, weather: v.weather === w ? '' : w }))} className={chip(f.weather === w)}>{w}</button>
          ))}
        </div>
      </div>
      <div>
        <label htmlFor="dr-site" className={labelClass}>Who was on site</label>
        <input id="dr-site" value={f.onSite} onChange={set('onSite')} placeholder="e.g. Dave, Sam, plumber" className={inputClass} />
      </div>
      <div>
        <label htmlFor="dr-done" className={labelClass}>What was done</label>
        <textarea id="dr-done" rows={3} value={f.workDone} onChange={set('workDone')} placeholder="e.g. Finished waterproofing in the bathroom, first coat" className={inputClass} />
      </div>
      <div>
        <label htmlFor="dr-issues" className={labelClass}>Delays or issues (optional)</label>
        <textarea id="dr-issues" rows={2} value={f.issues} onChange={set('issues')} placeholder="e.g. Tiles delivered late, client changed the niche" className={inputClass} />
      </div>
      {error && <p className="text-sm text-status-blocked" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="min-h-[44px] rounded-lg bg-signal-500 px-5 text-sm font-semibold text-ink-950 disabled:opacity-60">{entry ? 'Save changes' : 'Add entry'}</button>
        <button type="button" onClick={onDone} className="min-h-[44px] rounded-lg border border-ink-200 bg-white px-5 text-sm font-semibold text-ink-900">Cancel</button>
      </div>
    </form>
  )
}

export default function DiaryPanel({ project }) {
  const { user, isAdmin } = useAuth()
  const { diaryByProject, deleteDiary } = useWork()
  const rows = diaryByProject[project.id] || []
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState(null)

  async function remove(e) {
    setError(null)
    try {
      await deleteDiary(e.id)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      {editing ? (
        <DiaryForm key={editing === 'new' ? 'new' : editing.id} project={project} entry={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />
      ) : (
        <button onClick={() => setEditing('new')} className="mb-4 min-h-[44px] rounded-lg bg-signal-500 px-5 text-sm font-semibold text-ink-950">+ Add diary entry</button>
      )}
      {error && <p className="mb-3 text-sm text-status-blocked" role="alert">{error}</p>}
      {rows.length === 0 && !editing && <p className="rounded-xl border border-dashed border-ink-200 py-10 text-center text-sm text-ink-600">No diary entries yet. Add one at the end of each day: who was on site, what got done, and any delays.</p>}
      <ul className="space-y-2" aria-label="Diary entries">
        {rows.map((e) => (
          <li key={e.id} className="rounded-xl border border-ink-100 bg-white p-3" data-testid={`diary-${e.id}`}>
            <p className="text-sm font-semibold text-ink-900">{fmtDate(e.entry_date)}{e.weather ? ` · ${e.weather}` : ''}</p>
            {e.on_site && <p className="mt-0.5 text-xs text-ink-600">On site: {e.on_site}</p>}
            {e.work_done && <p className="mt-2 whitespace-pre-line text-sm text-ink-800">{e.work_done}</p>}
            {e.issues && <p className="mt-2 whitespace-pre-line rounded-lg bg-[#FBEAD2] px-2.5 py-1.5 text-sm text-[#7A4B05]">Issue: {e.issues}</p>}
            {(isAdmin || e.created_by === user?.id) && (
              <div className="mt-2 flex gap-3">
                <button onClick={() => setEditing(e)} className="min-h-[40px] text-xs font-medium text-ink-600 underline" aria-label={`Edit entry ${fmtDate(e.entry_date)}`}>Edit</button>
                <button onClick={() => confirm('Delete this diary entry?') && remove(e)} className="min-h-[40px] text-xs font-medium text-ink-400 underline" aria-label={`Delete entry ${fmtDate(e.entry_date)}`}>Delete</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
