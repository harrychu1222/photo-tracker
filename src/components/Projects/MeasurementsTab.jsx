import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useWork } from '../../context/WorkContext'
import { fmtQty } from '../../lib/costs'

const inputClass = 'w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-signal-500'
const smallBtn = 'rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600'
const UNITS = ['mm', 'cm', 'm', 'm²', 'each']

function MeasurementEditor({ project, initial, defaultRoomId, onSave, onCancel, saveLabel }) {
  const { roomsByProject } = useWork()
  const rooms = roomsByProject[project.id] || []
  const [roomId, setRoomId] = useState(initial ? initial.room_id || '' : defaultRoomId || '')
  const [label, setLabel] = useState(initial?.label || '')
  const [value, setValue] = useState(initial?.value ?? '')
  const [unit, setUnit] = useState(initial?.unit || '')
  const [note, setNote] = useState(initial?.note || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await onSave({ roomId, label, value, unit, note })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2 rounded-lg bg-ink-50 p-2.5">
      <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} placeholder="e.g. Floor area, Vanity width, Wall A length" />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={inputClass}
          placeholder="Value"
          aria-label="Value"
        />
        <input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          list="measure-units"
          className={inputClass}
          placeholder="Unit"
          aria-label="Unit"
        />
      </div>
      <datalist id="measure-units">
        {UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className={inputClass} aria-label="Room">
        <option value="">Whole project (no room)</option>
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder="Note (optional), e.g. measured at the skirting" />
      {error && <p className="text-xs text-status-blocked">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={busy} className="rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">
          {saveLabel}
        </button>
        <button type="button" onClick={onCancel} className={smallBtn}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function Row({ project, m }) {
  const { user, isAdmin } = useAuth()
  const { updateMeasurement, deleteMeasurement } = useWork()
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState(null)
  const canDelete = isAdmin || m.created_by === user?.id

  if (editing) {
    return (
      <li>
        <MeasurementEditor
          project={project}
          initial={m}
          saveLabel="Save"
          onCancel={() => setEditing(false)}
          onSave={async (v) => {
            await updateMeasurement(m.id, v)
            setEditing(false)
          }}
        />
      </li>
    )
  }

  return (
    <li className="rounded-lg border border-ink-100 bg-white px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={() => setEditing(true)} className="min-w-0 flex-1 text-left">
          <p className="text-sm font-medium text-ink-900">
            {m.label} <span className="font-normal text-ink-600">· {fmtQty(m.value)} {m.unit || ''}</span>
          </p>
          {m.note && <p className="text-xs text-ink-600">{m.note}</p>}
        </button>
        {canDelete && (
          <button
            type="button"
            aria-label={`Remove ${m.label}`}
            className="text-lg leading-none text-ink-400"
            onClick={async () => {
              setError(null)
              try {
                await deleteMeasurement(m.id)
              } catch (err) {
                setError(err.message)
              }
            }}
          >
            ×
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-status-blocked">{error}</p>}
    </li>
  )
}

// Measurements for a project, grouped by room. They hold no money, so everyone can see and add them.
// When adding a material to a task, "Fill the quantity from a measurement" reads from this list.
export default function MeasurementsTab({ project }) {
  const { measurementsByProject, roomsByProject, measurementsError, addMeasurement } = useWork()
  const [adding, setAdding] = useState(false)
  const all = measurementsByProject[project.id] || []
  const rooms = roomsByProject[project.id] || []

  const groups = [
    ...rooms.map((r) => ({ key: r.id, title: r.name, roomId: r.id, rows: all.filter((m) => m.room_id === r.id) })),
    { key: 'none', title: 'Whole project', roomId: '', rows: all.filter((m) => !m.room_id || !rooms.some((r) => r.id === m.room_id)) }
  ].filter((g) => g.rows.length > 0)

  if (measurementsError) return <p className="text-sm text-status-blocked">{measurementsError}</p>

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-ink-600">Sizes you will need again: room dimensions, a vanity width, a benchtop length.</p>
        {!adding && (
          <button onClick={() => setAdding(true)} className="flex-shrink-0 rounded-full bg-signal-500 px-4 py-1.5 text-sm font-medium text-white">
            + Add
          </button>
        )}
      </div>

      {adding && (
        <div className="mb-4">
          <MeasurementEditor
            project={project}
            saveLabel="Add"
            onCancel={() => setAdding(false)}
            onSave={async (v) => {
              await addMeasurementFor(v)
            }}
          />
        </div>
      )}

      {groups.length === 0 && !adding && (
        <p className="rounded-xl border border-dashed border-ink-200 py-10 text-center text-sm text-ink-600">
          No measurements yet.
        </p>
      )}

      <div className="space-y-5">
        {groups.map((g) => (
          <section key={g.key}>
            <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">{g.title}</h4>
            <ul className="space-y-1.5">
              {g.rows.map((m) => (
                <Row key={m.id} project={project} m={m} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )

  async function addMeasurementFor(v) {
    await addMeasurement(project.id, v)
    setAdding(false)
  }
}
