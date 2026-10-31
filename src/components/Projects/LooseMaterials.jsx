import { useState } from 'react'
import MaterialDates from './MaterialDates'
import { useAuth } from '../../context/AuthContext'
import { useWork } from '../../context/WorkContext'
import { materialStatusMeta, materialStatusPatch, nextMaterialStatus } from '../../lib/materials'
import { fmtQty } from '../../lib/costs'

const inputClass = 'w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-base focus:border-signal-500'

// Add a material straight from the Materials tab (with or without a task) and link the ones
// with no task to a task later.
export default function LooseMaterials({ project }) {
  const { isAdmin } = useAuth()
  const { tasksByProject, roomsById, materials, addMaterial, linkMaterial, deleteMaterial, setMaterialStatus } = useWork()
  const tasks = tasksByProject[project.id] || []
  const loose = materials.filter((m) => !m.task_id && m.project_id === project.id)
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: '', quantity: '1', unit: '', unitCost: '', taskId: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }))
  const taskLabel = (t) => (roomsById[t.room_id] ? `${t.name} (${roomsById[t.room_id].name})` : t.name)

  async function run(fn) {
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err.message)
    }
  }

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    await run(async () => {
      await addMaterial(f.taskId || null, { name: f.name, quantity: f.quantity, unit: f.unit, unitCost: isAdmin ? f.unitCost : undefined, projectId: project.id })
      setF({ name: '', quantity: '1', unit: '', unitCost: '', taskId: '' })
      setOpen(false)
    })
    setBusy(false)
  }

  return (
    <section className="mb-4" aria-label="Add and link materials">
      {open ? (
        <form onSubmit={save} className="space-y-3 rounded-xl border border-ink-200 bg-white p-3" data-testid="material-form">
          <p className="text-sm font-semibold text-ink-900">New material</p>
          <input value={f.name} onChange={set('name')} placeholder="e.g. Floor tiles" className={inputClass} aria-label="Material name" />
          <div className="grid grid-cols-3 gap-2">
            <input inputMode="decimal" value={f.quantity} onChange={set('quantity')} className={inputClass} aria-label="Quantity" placeholder="Qty" />
            <input value={f.unit} onChange={set('unit')} className={inputClass} aria-label="Unit" placeholder="Unit" />
            {isAdmin && <input inputMode="decimal" value={f.unitCost} onChange={set('unitCost')} className={inputClass} aria-label="Cost per unit" placeholder="$ each" />}
          </div>
          <select value={f.taskId} onChange={set('taskId')} className={inputClass} aria-label="Task">
            <option value="">No task yet</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>{taskLabel(t)}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="min-h-[44px] rounded-lg bg-ink-900 px-4 text-sm font-semibold text-white disabled:opacity-60">Save material</button>
            <button type="button" onClick={() => setOpen(false)} className="min-h-[44px] rounded-lg border border-ink-200 px-4 text-sm font-semibold text-ink-600">Cancel</button>
          </div>
        </form>
      ) : (
        <button onClick={() => setOpen(true)} className="min-h-[48px] w-full rounded-xl bg-signal-500 px-4 text-sm font-semibold text-ink-950 active:bg-signal-600 sm:w-auto">
          + Add material
        </button>
      )}
      {error && <p className="mt-2 text-sm text-status-blocked">{error}</p>}

      {loose.length > 0 && (
        <div className="mt-3 rounded-xl border border-ink-200 bg-white" data-testid="loose-materials">
          <h3 className="px-3 pt-3 text-xs font-bold uppercase tracking-[0.08em] text-ink-600">No task yet ({loose.length})</h3>
          <ul className="divide-y divide-ink-100">
            {loose.map((m) => {
              const st = materialStatusMeta(m.status)
              return (
                <li key={m.id} className="p-3 text-sm" data-testid={`loose-${m.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-ink-900">
                      {m.name} <span className="font-normal text-ink-600">· {fmtQty(m.quantity)} {m.unit || ''}</span>
                    </p>
                    <button
                      onClick={() => run(() => setMaterialStatus(m.id, materialStatusPatch(m, nextMaterialStatus(m.status))))}
                      className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink-200 px-3 text-xs font-semibold"
                      aria-label={`${m.name} is ${st.label}. Tap to change`}
                    >
                      <span className="status-dot" style={{ backgroundColor: st.color }} />
                      {st.label}
                    </button>
                  </div>
                  <MaterialDates material={m} />
                  <div className="mt-2 flex items-center gap-2">
                    <select
                      value=""
                      onChange={(e) => e.target.value && run(() => linkMaterial(m.id, e.target.value))}
                      className="min-w-0 flex-1 rounded-lg border border-ink-200 bg-white px-2 py-2 text-sm"
                      aria-label={`Link ${m.name} to a task`}
                    >
                      <option value="">Link to a task…</option>
                      {tasks.map((t) => (
                        <option key={t.id} value={t.id}>{taskLabel(t)}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => confirm(`Delete "${m.name}"?`) && run(() => deleteMaterial(m.id))}
                      className="min-h-[44px] px-2 text-xs font-semibold text-status-blocked"
                      aria-label={`Delete ${m.name}`}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
