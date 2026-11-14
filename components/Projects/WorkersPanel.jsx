import { useState } from 'react'
import { useWork } from '../../context/WorkContext'

const inputClass = 'w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-base focus:border-signal-500'

// Managers: add, rename and remove the worker names that tasks can be assigned to.
export default function WorkersPanel() {
  const { taskWorkers, taskWorkersReady, tasksByProject, addTaskWorker, renameTaskWorker, removeTaskWorker } = useWork()
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState(null) // worker id
  const [draft, setDraft] = useState('')
  const [error, setError] = useState(null)
  const [note, setNote] = useState(null)
  const allTasks = Object.values(tasksByProject).flat()
  const openCount = (name) => allTasks.filter((t) => t.status !== 'done' && (t.assigned_name || '').trim().toLowerCase() === name.toLowerCase()).length

  const run = async (fn) => {
    setError(null)
    setNote(null)
    try {
      await fn()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!taskWorkersReady) return <p className="mt-2 text-sm text-status-blocked">Managing workers needs supabase/migration_22_workers_templates_issues.sql. Run it in Supabase, then reload.</p>

  return (
    <div className="mt-2 rounded-xl border border-ink-100 bg-ink-50 p-3" aria-label="Workers">
      <p className="mb-2 text-sm text-ink-600">Workers without a login. Removing a name unassigns their open tasks; finished tasks keep the name.</p>
      <ul className="mb-3 space-y-1">
        {taskWorkers.length === 0 && <li className="text-sm text-ink-600">No names yet.</li>}
        {taskWorkers.map((w) => (
          <li key={w.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2">
            {editing === w.id ? (
              <>
                <input value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={`New name for ${w.name}`} className={`${inputClass} max-w-[14rem]`} />
                <button onClick={() => run(async () => { await renameTaskWorker(w.id, draft); setEditing(null) })} className="min-h-[44px] rounded-lg bg-ink-900 px-4 text-sm font-semibold text-white">Save</button>
                <button onClick={() => setEditing(null)} className="min-h-[44px] px-2 text-sm text-ink-600 underline">Cancel</button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm font-medium text-ink-900">{w.name} <span className="font-normal text-ink-600">· {openCount(w.name)} open</span></span>
                <button onClick={() => { setEditing(w.id); setDraft(w.name) }} className="min-h-[44px] px-2 text-xs font-medium text-ink-600 underline" aria-label={`Rename ${w.name}`}>Rename</button>
                <button
                  onClick={() => confirm(`Remove ${w.name}? ${openCount(w.name)} open task(s) will become unassigned.`) && run(async () => { const n = await removeTaskWorker(w.id); setNote(`${w.name} removed${n ? `, ${n} task(s) unassigned` : ''}.`) })}
                  className="min-h-[44px] px-2 text-xs font-medium text-ink-400 underline"
                  aria-label={`Remove ${w.name}`}
                >Remove</button>
              </>
            )}
          </li>
        ))}
      </ul>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(async () => { await addTaskWorker(newName); setNewName('') }) }}>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Add a worker name" aria-label="Add worker name" className={inputClass} />
        <button type="submit" className="min-h-[44px] rounded-lg border border-ink-200 bg-white px-4 text-sm font-semibold text-ink-900">Add</button>
      </form>
      {note && <p className="mt-2 text-sm text-ink-800" role="status">{note}</p>}
      {error && <p className="mt-2 text-sm text-status-blocked" role="alert">{error}</p>}
    </div>
  )
}
