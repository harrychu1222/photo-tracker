import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useWork } from '../../context/WorkContext'
import { fmtDate, fmtMoney } from '../../lib/format'
import { fmtHours, todayLocal } from '../../lib/tasks'
import { labourCost, sortTime, sumHours } from '../../lib/labour'
import { parseAmount } from '../../lib/expenses'

const inputClass = 'w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-base focus:border-signal-500'

function TimeForm({ project, entry, onDone }) {
  const { isAdmin, user } = useAuth()
  const { tasksByProject, people, addTime, updateTime } = useWork()
  const tasks = tasksByProject[project.id] || []
  const [date, setDate] = useState(entry?.work_date || todayLocal())
  const [who, setWho] = useState(entry?.user_id || user?.id)
  const [taskId, setTaskId] = useState(entry?.task_id || '')
  const [hours, setHours] = useState(entry ? String(entry.hours) : '')
  const [note, setNote] = useState(entry?.note || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const personList = Object.entries(people).map(([id, email]) => ({ id, email }))
  if (isAdmin && who && !people[who]) personList.push({ id: who, email: 'Unknown person' })

  async function save(e) {
    e.preventDefault()
    const h = parseAmount(hours)
    if (h == null || h <= 0 || h > 24) return setError('Enter hours between 0 and 24, for example 7.5.')
    setBusy(true)
    setError(null)
    const fields = { user_id: who, task_id: taskId, work_date: date || todayLocal(), hours: Math.round(h * 100) / 100, note }
    try {
      if (entry) await updateTime(entry.id, fields)
      else await addTime(project.id, fields)
      onDone()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="mb-4 space-y-3 rounded-xl border border-ink-100 bg-ink-50 p-3">
      <p className="text-sm font-semibold text-ink-900">{entry ? 'Edit hours' : 'Log hours'}</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-ink-600">
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} aria-label="Work date" />
        </label>
        <label className="text-xs text-ink-600">
          Hours
          <input inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="e.g. 7.5" className={inputClass} aria-label="Hours worked" />
        </label>
      </div>
      {isAdmin && (
        <label className="block text-xs text-ink-600">
          Who worked
          <select value={who} onChange={(e) => setWho(e.target.value)} className={inputClass} aria-label="Who worked">
            {personList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.email}
                {p.id === user?.id ? ' (you)' : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      {tasks.length > 0 && (
        <label className="block text-xs text-ink-600">
          Task (optional)
          <select value={taskId} onChange={(e) => setTaskId(e.target.value)} className={inputClass} aria-label="Task">
            <option value="">No particular task</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className={inputClass} aria-label="Note" />
      {error && <p className="text-sm text-status-blocked">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {entry ? 'Save changes' : 'Save hours'}
        </button>
        <button type="button" onClick={onDone} className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-600">
          Cancel
        </button>
      </div>
    </form>
  )
}

function RateRow({ person, rate }) {
  const { saveRate } = useWork()
  const [value, setValue] = useState(rate == null ? '' : String(rate))
  const [msg, setMsg] = useState(null)
  const changed = (rate == null ? '' : String(rate)) !== value.trim()

  async function save() {
    const n = value.trim() === '' ? '' : parseAmount(value)
    if (n !== '' && (n == null || n < 0)) return setMsg('Enter a rate such as 55.')
    try {
      await saveRate(person.id, n)
      setMsg('Saved')
    } catch (err) {
      setMsg(err.message)
    }
  }

  return (
    <li className="flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate text-sm text-ink-800">{person.email}</span>
      <span className="text-sm text-ink-600">$</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setMsg(null)
        }}
        placeholder="per hour"
        aria-label={`Hourly rate for ${person.email}`}
        className="w-24 rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-sm"
      />
      <button
        type="button"
        onClick={save}
        disabled={!changed}
        aria-label={`Save rate for ${person.email}`}
        className="rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs font-medium text-ink-800 disabled:opacity-40"
      >
        Save
      </button>
      {msg && <span className="text-xs text-ink-600">{msg}</span>}
    </li>
  )
}

function LumpSum({ project, finance, onSaveLabourLump }) {
  const [sum, setSum] = useState(finance?.labour_lump_sum != null ? String(finance.labour_lump_sum) : '')
  const [on, setOn] = useState(finance?.labour_lump_on || todayLocal())
  const [msg, setMsg] = useState(null)

  async function save(clear) {
    setMsg(null)
    const n = clear ? '' : parseAmount(sum)
    if (!clear && (n == null || n < 0)) return setMsg('Enter the labour amount, for example 2500.')
    try {
      await onSaveLabourLump(project.id, n, on)
      if (clear) setSum('')
      setMsg(clear ? 'Back to hours × rates' : 'Saved')
    } catch (err) {
      setMsg(err.message)
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-ink-600">
        Charge labour as one fixed amount instead of hours × rates (for example a day-rate deal). While a lump sum is set it
        replaces the calculated cost; hours are still recorded.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <input inputMode="decimal" value={sum} onChange={(e) => setSum(e.target.value)} placeholder="Lump sum ($, ex-GST)" aria-label="Labour lump sum" className={inputClass} />
        <input type="date" value={on} onChange={(e) => setOn(e.target.value)} aria-label="Lump sum date" className={inputClass} />
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => save(false)} className="rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-medium text-white">
          Save lump sum
        </button>
        {finance?.labour_lump_sum != null && (
          <button type="button" onClick={() => save(true)} className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600">
            Use hours × rates instead
          </button>
        )}
        {msg && <span className="text-xs text-ink-600">{msg}</span>}
      </div>
    </div>
  )
}

// Hours worked. Crew log and see their own; admins see everyone's, set hourly rates and see labour cost.
export default function TimeTab({ project, finance, onSaveLabourLump }) {
  const { isAdmin, user } = useAuth()
  const { timeByProject, timeError, people, rates, tasksById, deleteTime } = useWork()
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState(null)
  const [showRates, setShowRates] = useState(false)

  const all = timeByProject[project.id] || []
  const list = sortTime(all)
  const cost = labourCost(all, rates, finance)
  const nameOf = (id) => (id === user?.id ? 'You' : people[id] || 'Unknown person')

  async function remove(e) {
    if (!confirm(`Delete ${fmtHours(e.hours)} on ${fmtDate(e.work_date)}?`)) return
    setError(null)
    try {
      await deleteTime(e.id)
    } catch (err) {
      setError(err.message)
    }
  }

  if (timeError) return <p className="text-sm text-status-blocked">{timeError}</p>

  return (
    <div>
      {editing ? (
        <TimeForm key={editing === 'new' ? 'new' : editing.id} project={project} entry={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />
      ) : (
        <button onClick={() => setEditing('new')} className="mb-4 rounded-full bg-ink-900 px-4 py-2 text-sm font-medium text-white">
          + Log hours
        </button>
      )}
      {error && <p className="mb-3 text-sm text-status-blocked">{error}</p>}

      {!isAdmin && all.length > 0 && (
        <p className="mb-3 text-sm text-ink-800">
          You have logged <span className="font-semibold">{fmtHours(sumHours(all))}</span> on this project.
        </p>
      )}

      {isAdmin && (
        <div className="mb-4 rounded-xl border border-ink-100 bg-ink-50 p-3 text-sm">
          <p className="mb-2 text-xs font-semibold text-ink-800">Labour, ex-GST (admins only)</p>
          <dl className="space-y-1">
            <div className="flex justify-between">
              <dt className="text-ink-600">Hours logged</dt>
              <dd className="text-ink-900">{fmtHours(cost.hours)}</dd>
            </div>
            {cost.people.map((p) => (
              <div key={p.user_id || 'unknown'} className="flex justify-between text-xs">
                <dt className="text-ink-600">
                  {p.user_id ? people[p.user_id] || 'Unknown person' : 'Removed person'} · {fmtHours(p.hours)}
                  {p.rate != null ? ` × ${fmtMoney(p.rate)}` : ' · no rate'}
                </dt>
                <dd className="text-ink-800">{p.cost == null ? '—' : fmtMoney(p.cost)}</dd>
              </div>
            ))}
            <div className="flex justify-between border-t border-ink-100 pt-1 font-semibold">
              <dt className="text-ink-800">{cost.usesLump ? 'Labour (lump sum)' : 'Labour cost'}</dt>
              <dd className="text-ink-900">{fmtMoney(cost.total)}</dd>
            </div>
          </dl>
          {!cost.usesLump && cost.unratedHours > 0 && (
            <p className="mt-1 text-xs text-status-blocked">
              {fmtHours(cost.unratedHours)} belong to people with no hourly rate, so the labour cost is low. Set rates below.
            </p>
          )}
          {cost.usesLump && cost.hourly > 0 && (
            <p className="mt-1 text-xs text-ink-600">Hours × rates would be {fmtMoney(cost.hourly)}; the lump sum is used instead.</p>
          )}

          <button onClick={() => setShowRates((v) => !v)} className="mt-3 text-xs font-medium text-signal-600">
            {showRates ? 'Hide rates and lump sum' : 'Hourly rates and lump sum'}
          </button>
          {showRates && (
            <div className="mt-2 space-y-4 border-t border-ink-100 pt-3">
              <div>
                <p className="mb-1.5 text-xs font-semibold text-ink-800">Hourly rates, ex-GST (all projects)</p>
                <ul className="space-y-1.5">
                  {Object.entries(people).map(([id, email]) => (
                    <RateRow key={id} person={{ id, email }} rate={rates[id]} />
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold text-ink-800">Lump sum for this project</p>
                <LumpSum key={finance?.labour_lump_sum ?? 'none'} project={project} finance={finance} onSaveLabourLump={onSaveLabourLump} />
              </div>
            </div>
          )}
        </div>
      )}

      {all.length === 0 && !editing && (
        <p className="rounded-xl border border-dashed border-ink-200 py-10 text-center text-sm text-ink-600">
          {isAdmin ? 'No hours logged yet.' : 'You have not logged any hours on this project.'}
        </p>
      )}

      <ul className="space-y-2">
        {list.map((e) => {
          const mine = e.user_id === user?.id
          return (
            <li key={e.id} className="rounded-xl border border-ink-100 bg-white p-3 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-semibold text-ink-900">{fmtHours(e.hours)}</p>
                <span className="text-xs text-ink-600">{fmtDate(e.work_date)}</span>
              </div>
              <p className="mt-0.5 text-xs text-ink-600">
                {[isAdmin ? nameOf(e.user_id) : null, e.task_id && tasksById[e.task_id] ? tasksById[e.task_id].name : null, e.note]
                  .filter(Boolean)
                  .join(' · ') || 'No task'}
              </p>
              {(isAdmin || mine) && (
                <div className="mt-2 flex gap-3 text-xs font-medium">
                  <button onClick={() => setEditing(e)} className="text-ink-600">
                    Edit
                  </button>
                  <button onClick={() => remove(e)} className="text-status-blocked">
                    Delete
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
