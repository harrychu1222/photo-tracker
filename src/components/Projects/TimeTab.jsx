import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useWork } from '../../context/WorkContext'
import { fmtDate, fmtMoney } from '../../lib/format'
import { fmtHours, todayLocal } from '../../lib/tasks'
import { labourCost, lumpsByTask, personKey, replacedTasks, sortTime, sumHours, usualRate } from '../../lib/labour'
import { parseAmount } from '../../lib/expenses'

const inputClass = 'w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-base focus:border-signal-500'
const NEW = '__new__'

// "Kitchen — Plaster walls": the room is part of the name so two rooms' tasks are never confused.
function useTaskLabel() {
  const { roomsById } = useWork()
  return (t) => (t && roomsById[t.room_id] ? `${roomsById[t.room_id].name} — ${t.name}` : t?.name || '')
}

function TimeForm({ project, entry, onDone }) {
  const { isAdmin, user } = useAuth()
  const { tasksByProject, people, workers, rateBook, entryRates, addTime, updateTime } = useWork()
  const taskLabel = useTaskLabel()
  const tasks = tasksByProject[project.id] || []
  const [date, setDate] = useState(entry?.work_date || todayLocal())
  const [who, setWho] = useState(entry?.worker_id ? `w:${entry.worker_id}` : `u:${entry?.user_id || user?.id}`)
  const [newName, setNewName] = useState('')
  const [taskId, setTaskId] = useState(entry?.task_id || '')
  const [hours, setHours] = useState(entry ? String(entry.hours) : '')
  const [rate, setRate] = useState(entry && entryRates[entry.id] != null ? String(entryRates[entry.id]) : '')
  const [note, setNote] = useState(entry?.note || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const accounts = Object.entries(people).map(([id, email]) => ({ id, email }))
  if (isAdmin && who.startsWith('u:') && who.slice(2) && !people[who.slice(2)]) accounts.push({ id: who.slice(2), email: 'Unknown person' })

  // The person's usual rate, shown as a hint under the rate box.
  const usual = who === NEW ? null : usualRate(who.startsWith('w:') ? { worker_id: who.slice(2) } : { user_id: who.slice(2) }, rateBook)

  async function save(e) {
    e.preventDefault()
    const h = parseAmount(hours)
    if (h == null || h <= 0 || h > 24) return setError('Enter hours between 0 and 24, for example 7.5.')
    if (who === NEW && !newName.trim()) return setError("Type the person's name.")
    let rateValue
    if (isAdmin) {
      const typed = rate.trim() === '' ? null : parseAmount(rate)
      if (rate.trim() !== '' && (typed == null || typed < 0)) return setError('Enter the hourly rate, for example 55.')
      // Only keep a one-off rate when it differs from the person's usual rate.
      rateValue = typed == null || (usual != null && Math.abs(typed - usual) < 0.005) ? '' : typed
    }
    setBusy(true)
    setError(null)
    const fields = {
      user_id: who.startsWith('u:') ? who.slice(2) : null,
      worker_id: who.startsWith('w:') ? who.slice(2) : null,
      newWorkerName: who === NEW ? newName : '',
      task_id: taskId,
      work_date: date || todayLocal(),
      hours: Math.round(h * 100) / 100,
      note,
      ...(isAdmin ? { rate: rateValue } : {})
    }
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
        <>
          <label className="block text-xs text-ink-600">
            Who worked
            <select value={who} onChange={(e) => setWho(e.target.value)} className={inputClass} aria-label="Who worked">
              {accounts.map((p) => (
                <option key={p.id} value={`u:${p.id}`}>
                  {p.email}
                  {p.id === user?.id ? ' (you)' : ''}
                </option>
              ))}
              {workers.map((w) => (
                <option key={w.id} value={`w:${w.id}`}>
                  {w.name}
                </option>
              ))}
              <option value={NEW}>+ Someone else (type a name)…</option>
            </select>
          </label>
          {who === NEW && (
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name, e.g. Sam" className={inputClass} aria-label="New person name" />
          )}
        </>
      )}
      {tasks.length > 0 && (
        <label className="block text-xs text-ink-600">
          Task (optional)
          <select value={taskId} onChange={(e) => setTaskId(e.target.value)} className={inputClass} aria-label="Task">
            <option value="">No particular task</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {taskLabel(t)}
              </option>
            ))}
          </select>
        </label>
      )}
      {isAdmin && (
        <label className="block text-xs text-ink-600">
          Hourly rate for this entry, ex-GST (optional)
          <input
            inputMode="decimal"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder={usual != null ? `Usual rate ${fmtMoney(usual)}` : 'No usual rate set'}
            className={inputClass}
            aria-label="Rate for this entry"
          />
          <span className="mt-0.5 block text-ink-400">Leave empty to use the person&apos;s usual rate. Type a different rate if it varied this time.</span>
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

function RateRow({ name, rate, onSave }) {
  const [value, setValue] = useState(rate == null ? '' : String(rate))
  const [msg, setMsg] = useState(null)
  const changed = (rate == null ? '' : String(rate)) !== value.trim()

  async function save() {
    const n = value.trim() === '' ? '' : parseAmount(value)
    if (n !== '' && (n == null || n < 0)) return setMsg('Enter a rate such as 55.')
    try {
      await onSave(n)
      setMsg('Saved')
    } catch (err) {
      setMsg(err.message)
    }
  }

  return (
    <li className="flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate text-sm text-ink-800">{name}</span>
      <span className="text-sm text-ink-600">$</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setMsg(null)
        }}
        placeholder="per hour"
        aria-label={`Hourly rate for ${name}`}
        className="w-24 rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-sm"
      />
      <button
        type="button"
        onClick={save}
        disabled={!changed}
        aria-label={`Save rate for ${name}`}
        className="rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs font-medium text-ink-800 disabled:opacity-40"
      >
        Save
      </button>
      {msg && <span className="text-xs text-ink-600">{msg}</span>}
    </li>
  )
}

function LumpForm({ project, lump, onDone }) {
  const { tasksByProject, addLump, updateLump } = useWork()
  const taskLabel = useTaskLabel()
  const tasks = tasksByProject[project.id] || []
  const [description, setDescription] = useState(lump?.description || '')
  const [taskId, setTaskId] = useState(lump?.task_id || '')
  const [amount, setAmount] = useState(lump ? String(lump.amount_ex_gst) : '')
  const [paidOn, setPaidOn] = useState(lump?.paid_on || todayLocal())
  const [replaces, setReplaces] = useState(!!lump?.replaces_hours)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function save(e) {
    e.preventDefault()
    const n = parseAmount(amount)
    if (!description.trim()) return setError('Say what this is for, for example "Tiler, bathroom".')
    if (n == null) return setError('Enter the amount.')
    setBusy(true)
    setError(null)
    const fields = { description, task_id: taskId, amount_ex_gst: n, paid_on: paidOn || todayLocal(), replaces_hours: replaces }
    try {
      if (lump) await updateLump(lump.id, fields)
      else await addLump(project.id, fields)
      onDone()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="mt-2 space-y-2 rounded-lg bg-white p-2.5">
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What for, e.g. Tiler, bathroom" className={inputClass} aria-label="Lump sum description" />
      {tasks.length > 0 && (
        <select value={taskId} onChange={(e) => setTaskId(e.target.value)} className={inputClass} aria-label="Lump sum task">
          <option value="">Not tied to a task</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {taskLabel(t)}
            </option>
          ))}
        </select>
      )}
      <div className="grid grid-cols-2 gap-2">
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount ($, ex-GST)" className={inputClass} aria-label="Lump sum amount" />
        <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className={inputClass} aria-label="Lump sum date" />
      </div>
      {taskId && (
        <label className="flex items-start gap-2 text-sm text-ink-800">
          <input type="checkbox" checked={replaces} onChange={(e) => setReplaces(e.target.checked)} className="mt-1 h-4 w-4" />
          <span>Hours logged on this task are already covered by this lump sum (don&apos;t cost them again)</span>
        </label>
      )}
      {error && <p className="text-sm text-status-blocked">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">
          {lump ? 'Save changes' : 'Save lump sum'}
        </button>
        <button type="button" onClick={onDone} className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600">
          Cancel
        </button>
      </div>
    </form>
  )
}

// Hours worked. Crew log and see their own; admins see everyone's, set rates, add lump sums and see labour cost.
export default function TimeTab({ project }) {
  const { isAdmin, user } = useAuth()
  const { timeByProject, timeError, people, workers, rateBook, rates, lumpsByProject, migration12Missing, saveRate, tasksById, deleteTime, deleteLump } = useWork()
  const taskLabel = useTaskLabel()
  const [editing, setEditing] = useState(null)
  const [lumpEditing, setLumpEditing] = useState(null) // null | 'new' | lump
  const [error, setError] = useState(null)
  const [showRates, setShowRates] = useState(false)

  const all = timeByProject[project.id] || []
  const list = sortTime(all)
  const lumps = lumpsByProject[project.id] || []
  const cost = labourCost(all, rateBook, lumps)
  const taskLump = lumpsByTask(lumps)
  const covered = replacedTasks(lumps)
  const workerName = (id) => workers.find((w) => w.id === id)?.name || 'Removed person'
  const nameOf = (e) => (e.worker_id ? workerName(e.worker_id) : e.user_id === user?.id ? 'You' : people[e.user_id] || 'Unknown person')
  const personName = (p) => (p.worker_id ? workerName(p.worker_id) : p.user_id ? people[p.user_id] || 'Unknown person' : 'Removed person')

  async function remove(e) {
    if (!confirm(`Delete ${fmtHours(e.hours)} on ${fmtDate(e.work_date)}?`)) return
    setError(null)
    try {
      await deleteTime(e.id)
    } catch (err) {
      setError(err.message)
    }
  }

  async function removeLump(l) {
    if (!confirm(`Delete lump sum "${l.description}"?`)) return
    setError(null)
    try {
      await deleteLump(l.id)
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
      {isAdmin && migration12Missing && (
        <p className="mb-3 text-sm text-status-blocked">
          Extra people, one-off rates and lump sums need migration 12. Run supabase/migration_12_workers_rates_lumps.sql in Supabase, then reload.
        </p>
      )}

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
              <div key={p.key} className="flex justify-between gap-3 text-xs">
                <dt className="text-ink-600">
                  {personName(p)} · {fmtHours(p.hours)}
                  {p.rates.length === 1 ? ` × ${fmtMoney(p.rates[0])}` : p.rates.length > 1 ? ' · rates vary' : ''}
                  {p.unratedHours > 0 ? ` · ${fmtHours(p.unratedHours)} no rate` : ''}
                  {p.replacedHours > 0 ? ` · ${fmtHours(p.replacedHours)} covered by lump sum` : ''}
                </dt>
                <dd className="flex-shrink-0 text-ink-800">{fmtMoney(p.cost)}</dd>
              </div>
            ))}
            <div className="flex justify-between border-t border-ink-100 pt-1">
              <dt className="text-ink-600">Hours × rates</dt>
              <dd className="text-ink-900">{fmtMoney(cost.hourly)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-600">Lump sums ({lumps.length})</dt>
              <dd className="text-ink-900">{fmtMoney(cost.lumpTotal)}</dd>
            </div>
            <div className="flex justify-between border-t border-ink-100 pt-1 font-semibold">
              <dt className="text-ink-800">Labour cost</dt>
              <dd className="text-ink-900">{fmtMoney(cost.total)}</dd>
            </div>
          </dl>
          {cost.unratedHours > 0 && (
            <p className="mt-1 text-xs text-status-blocked">
              {fmtHours(cost.unratedHours)} have no hourly rate, so the labour cost is low. Set a rate below or on the entry.
            </p>
          )}

          <div className="mt-3 border-t border-ink-100 pt-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-ink-800">Lump sums (subcontracted or fixed-price work)</p>
              {!lumpEditing && (
                <button onClick={() => setLumpEditing('new')} className="text-xs font-medium text-signal-600">
                  + Add lump sum
                </button>
              )}
            </div>
            {lumpEditing && (
              <LumpForm key={lumpEditing === 'new' ? 'new' : lumpEditing.id} project={project} lump={lumpEditing === 'new' ? null : lumpEditing} onDone={() => setLumpEditing(null)} />
            )}
            {lumps.length === 0 && !lumpEditing && <p className="mt-1 text-xs text-ink-400">None yet. Lump sums are added on top of hours × rates.</p>}
            <ul className="mt-2 space-y-1.5">
              {lumps.map((l) => (
                <li key={l.id} className="rounded-lg bg-white p-2 text-xs">
                  <div className="flex justify-between gap-3">
                    <span className="font-medium text-ink-900">{l.description}</span>
                    <span className="text-ink-900">{fmtMoney(l.amount_ex_gst)}</span>
                  </div>
                  <p className="text-ink-600">
                    {[l.task_id && tasksById[l.task_id] ? taskLabel(tasksById[l.task_id]) : 'Not tied to a task', fmtDate(l.paid_on), l.replaces_hours ? 'hours on this task not costed' : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <div className="mt-1 flex gap-3 font-medium">
                    <button onClick={() => setLumpEditing(l)} className="text-ink-600">
                      Edit
                    </button>
                    <button onClick={() => removeLump(l)} className="text-status-blocked">
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <button onClick={() => setShowRates((v) => !v)} className="mt-3 text-xs font-medium text-signal-600">
            {showRates ? 'Hide usual hourly rates' : 'Usual hourly rates'}
          </button>
          {showRates && (
            <div className="mt-2 border-t border-ink-100 pt-3">
              <p className="mb-1.5 text-xs font-semibold text-ink-800">Usual hourly rate per person, ex-GST (all projects)</p>
              <p className="mb-2 text-xs text-ink-600">A rate that varied on one day can be set on that entry instead.</p>
              <ul className="space-y-1.5">
                {Object.entries(people).map(([id, email]) => (
                  <RateRow key={id} name={email} rate={rates[id]} onSave={(n) => saveRate(id, n, 'user')} />
                ))}
                {workers.map((w) => (
                  <RateRow key={w.id} name={w.name} rate={w.hourly_rate} onSave={(n) => saveRate(w.id, n, 'worker')} />
                ))}
              </ul>
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
          const own = isAdmin ? rateBook.entry[e.id] : null
          return (
            <li key={e.id} className="rounded-xl border border-ink-100 bg-white p-3 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-semibold text-ink-900">{fmtHours(e.hours)}</p>
                <span className="text-xs text-ink-600">{fmtDate(e.work_date)}</span>
              </div>
              <p className="mt-0.5 text-xs text-ink-600">
                {[isAdmin ? nameOf(e) : null, e.task_id && tasksById[e.task_id] ? taskLabel(tasksById[e.task_id]) : null, e.note, own != null ? `rate ${fmtMoney(own)}/h` : null, isAdmin && e.task_id && covered.has(e.task_id) ? 'covered by lump sum' : null]
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
