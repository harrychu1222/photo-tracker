import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useWork } from '../../context/WorkContext'
import { fmtMoney } from '../../lib/format'
import MaterialDates from './MaterialDates'
import { fmtQty, materialCost, taskCost } from '../../lib/costs'
import { fmtArea, roomPickList } from '../../lib/rooms'
import { materialStatusMeta, materialStatusPatch, measurementQty, nextMaterialStatus } from '../../lib/materials'

const inputClass = 'w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-signal-500'
const smallBtn = 'rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600'

const UNITS = ['each', 'm', 'm²', 'sheet', 'box', 'bag', 'litre', 'kg', 'pack', 'roll', 'set', 'hr']

const KINDS = [
  { value: 'own', label: 'Own tool' },
  { value: 'hired', label: 'Hired' },
  { value: 'bought', label: 'Bought' }
]
const kindLabel = (k) => KINDS.find((x) => x.value === k)?.label || k

// ---------- Materials ----------

function MaterialEditor({ initial, isAdmin, price, onSave, onCancel, saveLabel, choices = [] }) {
  const [name, setName] = useState(initial?.name || '')
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1)
  const [unit, setUnit] = useState(initial?.unit || '')
  const [unitCost, setUnitCost] = useState(price ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [pickId, setPickId] = useState('')
  const [waste, setWaste] = useState('')
  const picked = choices.find((c) => c.id === pickId)

  function applyMeasurement() {
    if (!picked) return
    setQuantity(measurementQty(picked.value, waste))
    if (picked.unit && !unit.trim()) setUnit(picked.unit)
  }

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await onSave({ name, quantity, unit, unitCost })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2 rounded-lg bg-ink-50 p-2.5">
      <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Material, e.g. Plasterboard 10mm" />
      <div className={`grid gap-2 ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className={inputClass}
          placeholder="Qty"
          aria-label="Quantity"
        />
        <input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          list="unit-options"
          className={inputClass}
          placeholder="Unit"
          aria-label="Unit"
        />
        {isAdmin && (
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
            className={inputClass}
            placeholder="$ per unit"
            aria-label="Cost per unit, ex-GST"
          />
        )}
      </div>
      <datalist id="unit-options">
        {UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      {choices.length > 0 && (
        <div className="rounded-lg border border-ink-100 bg-white p-2">
          <p className="mb-1 text-xs font-medium text-ink-800">Fill the quantity from a measurement</p>
          <div className="grid grid-cols-[1fr_5rem] gap-2">
            <select value={pickId} onChange={(e) => setPickId(e.target.value)} className={inputClass} aria-label="Measurement">
              <option value="">Choose…</option>
              {choices.map((c) => (
                <option key={c.id} value={c.id}>
                  {`${c.label}: ${fmtArea(c.value)} ${c.unit || ''}${c.where ? ` (${c.where})` : ''}`}
                </option>
              ))}
            </select>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={waste}
              onChange={(e) => setWaste(e.target.value)}
              className={inputClass}
              placeholder="Waste %"
              aria-label="Waste percent"
            />
          </div>
          {picked && (
            <button type="button" onClick={applyMeasurement} className={`${smallBtn} mt-2`}>
              Use {fmtQty(measurementQty(picked.value, waste))} {picked.unit || ''}
            </button>
          )}
        </div>
      )}
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

function MaterialRow({ material, isAdmin, canDelete, choices }) {
  const { matPrices, updateMaterial, deleteMaterial, setMaterialStatus, confirmMaterialQty } = useWork()
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState(null)
  const unitCost = matPrices[material.id]
  const line = materialCost(material, unitCost)
  const status = materialStatusMeta(material.status)

  if (editing) {
    return (
      <li>
        <MaterialEditor
          initial={material}
          isAdmin={isAdmin}
          price={unitCost}
          saveLabel="Save"
          choices={choices}
          onCancel={() => setEditing(false)}
          onSave={async (v) => {
            await updateMaterial(material.id, v)
            setEditing(false)
          }}
        />
      </li>
    )
  }

  return (
    <li className="rounded-lg border border-ink-100 px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={() => setEditing(true)} className="min-w-0 flex-1 text-left">
          <p className="text-sm font-medium text-ink-900">{material.name}</p>
          <p className="text-xs text-ink-600">
            {fmtQty(material.quantity)} {material.unit || ''}
            {isAdmin && unitCost != null ? ` × ${fmtMoney(unitCost)}` : ''}
          </p>
        </button>
        <button
          type="button"
          aria-label={`${material.name} is ${status.label}. Tap to change`}
          onClick={async () => {
            setError(null)
            try {
              await setMaterialStatus(material.id, materialStatusPatch(material, nextMaterialStatus(material.status)))
            } catch (err) {
              setError(err.message)
            }
          }}
          className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-ink-50 px-2 py-1 text-xs font-medium text-ink-800"
        >
          <span className="status-dot" style={{ backgroundColor: status.color }} />
          {status.label}
        </button>
        <div className="flex flex-shrink-0 items-center gap-2">
          {isAdmin && (
            <span className={`text-sm ${line == null ? 'text-ink-400' : 'font-medium text-ink-900'}`}>
              {line == null ? 'No price' : fmtMoney(line)}
            </span>
          )}
          {canDelete && (
            <button
              type="button"
              aria-label={`Remove ${material.name}`}
              onClick={async () => {
                setError(null)
                try {
                  await deleteMaterial(material.id)
                } catch (err) {
                  setError(err.message)
                }
              }}
              className="text-lg leading-none text-ink-400"
            >
              ×
            </button>
          )}
        </div>
      </div>
      <MaterialDates material={material} />
      {material.check_qty && (
        <p className="mt-1 text-xs text-signal-600">
          Copied from another room. Check the quantity.{' '}
          <button
            type="button"
            className="font-medium underline"
            onClick={async () => {
              setError(null)
              try {
                await confirmMaterialQty(material.id)
              } catch (err) {
                setError(err.message)
              }
            }}
          >
            Looks right
          </button>
        </p>
      )}
      {error && <p className="mt-1 text-xs text-status-blocked">{error}</p>}
    </li>
  )
}

// ---------- Equipment ----------

function EquipmentEditor({ initial, isAdmin, price, onSave, onCancel, saveLabel }) {
  const [name, setName] = useState(initial?.name || '')
  const [kind, setKind] = useState(initial?.kind || 'own')
  const [cost, setCost] = useState(price ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await onSave({ name, kind, cost })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2 rounded-lg bg-ink-50 p-2.5">
      <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Tool or equipment, e.g. Tile saw" />
      <div className="flex flex-wrap gap-1.5">
        {KINDS.map((k) => (
          <button
            type="button"
            key={k.value}
            onClick={() => setKind(k.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              kind === k.value ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-600'
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>
      {isAdmin && kind !== 'own' && (
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          className={inputClass}
          placeholder="Cost, ex-GST"
          aria-label="Cost, ex-GST"
        />
      )}
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

function EquipmentRow({ item, isAdmin, canDelete }) {
  const { eqPrices, updateEquipment, deleteEquipment } = useWork()
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState(null)
  const cost = eqPrices[item.id]

  if (editing) {
    return (
      <li>
        <EquipmentEditor
          initial={item}
          isAdmin={isAdmin}
          price={cost}
          saveLabel="Save"
          onCancel={() => setEditing(false)}
          onSave={async (v) => {
            await updateEquipment(item.id, v)
            setEditing(false)
          }}
        />
      </li>
    )
  }

  return (
    <li className="rounded-lg border border-ink-100 px-3 py-2">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={item.ready}
          aria-label={`${item.name} is on site`}
          onChange={async (e) => {
            setError(null)
            try {
              await updateEquipment(item.id, { ready: e.target.checked })
            } catch (err) {
              setError(err.message)
            }
          }}
        />
        <button type="button" onClick={() => setEditing(true)} className="min-w-0 flex-1 text-left">
          <p className={`text-sm font-medium ${item.ready ? 'text-ink-400' : 'text-ink-900'}`}>{item.name}</p>
          <p className="text-xs text-ink-600">{kindLabel(item.kind)}</p>
        </button>
        {isAdmin && item.kind !== 'own' && (
          <span className={`text-sm ${cost == null ? 'text-ink-400' : 'font-medium text-ink-900'}`}>
            {cost == null ? 'No price' : fmtMoney(cost)}
          </span>
        )}
        {canDelete && (
          <button
            type="button"
            aria-label={`Remove ${item.name}`}
            onClick={async () => {
              setError(null)
              try {
                await deleteEquipment(item.id)
              } catch (err) {
                setError(err.message)
              }
            }}
            className="text-lg leading-none text-ink-400"
          >
            ×
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-status-blocked">{error}</p>}
    </li>
  )
}

// ---------- The section shown inside the task form ----------

export default function TaskCosts({ task }) {
  const { user, isAdmin } = useAuth()
  const {
    materialsByTask,
    equipmentByTask,
    matPrices,
    eqPrices,
    addMaterial,
    addEquipment,
    costsError,
    measurementsByProject,
    roomsByProject,
    roomsById
  } = useWork()
  const materials = materialsByTask[task.id] || []
  const equipment = equipmentByTask[task.id] || []
  // Everything a quantity can be filled from: the calculated room figures (floor, walls, perimeter...)
  // and the special measurements, this task's room first.
  const projectRooms = roomsByProject[task.project_id] || []
  const projectMeasurements = measurementsByProject[task.project_id] || []
  const choices = [
    ...[...projectRooms]
      .sort((a, b) => Number(b.id === task.room_id) - Number(a.id === task.room_id))
      .flatMap((room) =>
        roomPickList(
          room,
          projectMeasurements.filter((m) => m.room_id === room.id && m.is_opening)
        ).map((x) => ({ id: `calc:${room.id}:${x.key}`, label: x.label, value: x.value, unit: x.unit, where: room.name }))
      ),
    ...[...projectMeasurements]
      .filter((m) => !m.is_opening)
      .sort((a, b) => Number(b.room_id === task.room_id) - Number(a.room_id === task.room_id))
      .map((m) => ({
        id: m.id,
        label: m.label,
        value: m.value,
        unit: m.unit,
        where: m.room_id ? roomsById[m.room_id]?.name : 'whole project'
      }))
  ]
  const [addingMaterial, setAddingMaterial] = useState(false)
  const [addingEquipment, setAddingEquipment] = useState(false)
  const cost = taskCost(materials, equipment, matPrices, eqPrices)
  const canDelete = (row) => isAdmin || row.created_by === user?.id

  if (costsError) {
    return <p className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-status-blocked">{costsError}</p>
  }

  return (
    <div className="space-y-5">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-ink-800">Materials ({materials.length})</p>
          {!addingMaterial && (
            <button type="button" onClick={() => setAddingMaterial(true)} className={smallBtn}>
              + Add material
            </button>
          )}
        </div>
        <ul className="space-y-1.5">
          {materials.map((m) => (
            <MaterialRow key={m.id} material={m} isAdmin={isAdmin} canDelete={canDelete(m)} choices={choices} />
          ))}
        </ul>
        {materials.length === 0 && !addingMaterial && <p className="text-xs text-ink-400">None yet.</p>}
        {addingMaterial && (
          <div className="mt-2">
            <MaterialEditor
              isAdmin={isAdmin}
              saveLabel="Add"
              choices={choices}
              onCancel={() => setAddingMaterial(false)}
              onSave={async (v) => {
                await addMaterial(task.id, v)
                setAddingMaterial(false)
              }}
            />
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-ink-800">Equipment and tools ({equipment.length})</p>
          {!addingEquipment && (
            <button type="button" onClick={() => setAddingEquipment(true)} className={smallBtn}>
              + Add item
            </button>
          )}
        </div>
        <ul className="space-y-1.5">
          {equipment.map((e) => (
            <EquipmentRow key={e.id} item={e} isAdmin={isAdmin} canDelete={canDelete(e)} />
          ))}
        </ul>
        {equipment.length === 0 && !addingEquipment && (
          <p className="text-xs text-ink-400">None yet. Tick an item once it is on site.</p>
        )}
        {addingEquipment && (
          <div className="mt-2">
            <EquipmentEditor
              isAdmin={isAdmin}
              saveLabel="Add"
              onCancel={() => setAddingEquipment(false)}
              onSave={async (v) => {
                await addEquipment(task.id, v)
                setAddingEquipment(false)
              }}
            />
          </div>
        )}
      </section>

      {isAdmin && (materials.length > 0 || equipment.length > 0) && (
        <div className="rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-800">
          <p>
            Planned cost for this task (ex-GST): <span className="font-semibold">{fmtMoney(cost.total)}</span>
          </p>
          <p className="text-xs text-ink-600">
            Materials {fmtMoney(cost.materials)} · Equipment {fmtMoney(cost.equipment)}
            {cost.unpriced > 0 ? ` · ${cost.unpriced} line${cost.unpriced === 1 ? '' : 's'} without a price` : ''}
          </p>
        </div>
      )}
    </div>
  )
}
