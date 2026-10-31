import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useWork } from '../../context/WorkContext'
import { fmtArea, roomCalc } from '../../lib/rooms'

const inputClass = 'w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-signal-500'
const smallBtn = 'rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600'
const UNITS = ['mm', 'cm', 'm', 'm²', 'each']

// ---------- Special measurements and door / window openings ----------

function MeasurementEditor({ kind, roomId, roomUnit, initial, onSave, onCancel, saveLabel }) {
  const opening = kind === 'opening'
  const [label, setLabel] = useState(initial?.label || '')
  const [value, setValue] = useState(initial?.value ?? '')
  const [unit, setUnit] = useState(initial?.unit || '')
  const [width, setWidth] = useState(initial?.opening_width ?? '')
  const [height, setHeight] = useState(initial?.opening_height ?? '')
  const [note, setNote] = useState(initial?.note || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await onSave({ roomId, label, value, unit, note, isOpening: opening, width, height })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2 rounded-lg bg-ink-50 p-2.5">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className={inputClass}
        placeholder={opening ? 'e.g. Door, Window over sink' : 'e.g. Vanity width, Glass length'}
        aria-label="Label"
      />
      {opening ? (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            className={inputClass}
            placeholder={`Width (${roomUnit})`}
            aria-label="Opening width"
          />
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            className={inputClass}
            placeholder={`Height (${roomUnit})`}
            aria-label="Opening height"
          />
        </div>
      ) : (
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
      )}
      <datalist id="measure-units">
        {UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} placeholder="Note (optional)" aria-label="Note" />
      {opening && <p className="text-xs text-ink-400">Its area is taken off the wall area of this room.</p>}
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

function MeasurementRow({ m, roomUnit }) {
  const { user, isAdmin } = useAuth()
  const { updateMeasurement, deleteMeasurement } = useWork()
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState(null)
  const canDelete = isAdmin || m.created_by === user?.id

  if (editing) {
    return (
      <li>
        <MeasurementEditor
          kind={m.is_opening ? 'opening' : 'special'}
          roomId={m.room_id || ''}
          roomUnit={roomUnit}
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
            {m.label}{' '}
            <span className="font-normal text-ink-600">
              ·{' '}
              {m.is_opening
                ? `${fmtArea(m.opening_width)} × ${fmtArea(m.opening_height)} ${roomUnit} = ${fmtArea(m.value)} m²`
                : `${fmtArea(m.value)} ${m.unit || ''}`}
            </span>
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

// A list of rows plus add buttons. `roomId` '' means the whole project.
function MeasurementList({ project, roomId, roomUnit, rows, allowOpenings }) {
  const { addMeasurement } = useWork()
  const [adding, setAdding] = useState(null) // 'special' | 'opening' | null

  return (
    <div>
      {rows.length > 0 && (
        <ul className="space-y-1.5">
          {rows.map((m) => (
            <MeasurementRow key={m.id} m={m} roomUnit={roomUnit} />
          ))}
        </ul>
      )}
      {adding && (
        <div className="mt-2">
          <MeasurementEditor
            kind={adding}
            roomId={roomId}
            roomUnit={roomUnit}
            saveLabel="Add"
            onCancel={() => setAdding(null)}
            onSave={async (v) => {
              await addMeasurement(project.id, v)
              setAdding(null)
            }}
          />
        </div>
      )}
      {!adding && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => setAdding('special')} className={smallBtn}>
            + Special measurement
          </button>
          {allowOpenings && (
            <button type="button" onClick={() => setAdding('opening')} className={smallBtn}>
              + Door / window
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ---------- One room ----------

const numOrNull = (v) => (v === '' || v == null ? null : Number(v))

function SizeField({ label, value, onChange, unit }) {
  return (
    <label className="text-xs text-ink-600">
      {label} ({unit})
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
        aria-label={label}
      />
    </label>
  )
}

function RoomCard({ project, room, measurements }) {
  const { updateRoomSize, setRoomUnit } = useWork()
  const unit = room.dim_unit || 'mm'
  const [len, setLen] = useState(room.room_length ?? '')
  const [wid, setWid] = useState(room.room_width ?? '')
  const [hei, setHei] = useState(room.room_height ?? '')
  const [manual, setManual] = useState(!!room.manual_areas)
  const [mFloor, setMFloor] = useState(room.manual_floor_area ?? '')
  const [mWall, setMWall] = useState(room.manual_wall_area ?? '')
  const [mPerim, setMPerim] = useState(room.manual_perimeter ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const same = (a, b) => String(a ?? '') === String(b ?? '')
  const dirty =
    !same(len, room.room_length) ||
    !same(wid, room.room_width) ||
    !same(hei, room.room_height) ||
    manual !== !!room.manual_areas ||
    !same(mFloor, room.manual_floor_area) ||
    !same(mWall, room.manual_wall_area) ||
    !same(mPerim, room.manual_perimeter)

  const openings = measurements.filter((m) => m.is_opening)
  const specials = measurements.filter((m) => !m.is_opening)
  const draft = {
    ...room,
    room_length: len,
    room_width: wid,
    room_height: hei,
    manual_areas: manual,
    manual_floor_area: mFloor,
    manual_wall_area: mWall,
    manual_perimeter: mPerim
  }
  const calc = roomCalc(draft, openings)
  const anything = calc.floor != null || calc.wallsGross != null || calc.perimeter != null

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await updateRoomSize(room.id, {
        room_length: numOrNull(len),
        room_width: numOrNull(wid),
        room_height: numOrNull(hei),
        manual_areas: manual,
        manual_floor_area: numOrNull(mFloor),
        manual_wall_area: numOrNull(mWall),
        manual_perimeter: numOrNull(mPerim)
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function switchUnit(next) {
    if (next === unit) return
    setError(null)
    try {
      if (dirty) await save()
      await setRoomUnit(room.id, next) // the card is re-created with the converted sizes (see its key)
    } catch (err) {
      setError(err.message)
    }
  }

  const figures = [
    ['Floor area', calc.floor, 'm²'],
    ['Ceiling area', calc.ceiling, 'm²'],
    [calc.hasOpenings ? 'Walls before openings' : 'Walls, all four', calc.wallsGross, 'm²'],
    ['Walls after openings', calc.hasOpenings ? calc.wallsNet : null, 'm²'],
    ['Each long wall', calc.lengthWallEach, 'm²'],
    ['Each short wall', calc.widthWallEach, 'm²'],
    ['Perimeter', calc.perimeter, 'm']
  ].filter(([, v]) => v != null)

  return (
    <section className="rounded-xl border border-ink-100 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-base font-semibold text-ink-900">{room.name}</h4>
        <div className="flex overflow-hidden rounded-full border border-ink-200 text-xs" role="group" aria-label="Unit">
          {['mm', 'm'].map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => switchUnit(u)}
              aria-pressed={unit === u}
              className={`px-3 py-1 font-medium ${unit === u ? 'bg-ink-900 text-white' : 'text-ink-600'}`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      {manual ? (
        <div className="grid grid-cols-3 gap-2">
          <label className="text-xs text-ink-600">
            Floor (m²)
            <input type="number" inputMode="decimal" min="0" step="any" value={mFloor} onChange={(e) => setMFloor(e.target.value)} className={inputClass} aria-label="Floor area" />
          </label>
          <label className="text-xs text-ink-600">
            Walls (m²)
            <input type="number" inputMode="decimal" min="0" step="any" value={mWall} onChange={(e) => setMWall(e.target.value)} className={inputClass} aria-label="Wall area" />
          </label>
          <label className="text-xs text-ink-600">
            Perimeter (m)
            <input type="number" inputMode="decimal" min="0" step="any" value={mPerim} onChange={(e) => setMPerim(e.target.value)} className={inputClass} aria-label="Perimeter" />
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <SizeField label="Length" value={len} onChange={setLen} unit={unit} />
          <SizeField label="Width" value={wid} onChange={setWid} unit={unit} />
          <SizeField label="Height" value={hei} onChange={setHei} unit={unit} />
        </div>
      )}

      <label className="mt-2 flex items-center gap-2 text-xs text-ink-600">
        <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} />
        Not a simple box (L-shape, alcove): type the areas myself
      </label>

      {anything ? (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-ink-50 p-2.5 text-sm">
          {figures.map(([label, value, u]) => (
            <div key={label} className="flex justify-between gap-2">
              <dt className="text-ink-600">{label}</dt>
              <dd className="font-medium text-ink-900">
                {fmtArea(value)} {u}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-3 text-xs text-ink-400">Type the length, width and height and the areas appear here.</p>
      )}

      {dirty && (
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="mt-2 rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Save sizes'}
        </button>
      )}
      {error && <p className="mt-2 text-xs text-status-blocked">{error}</p>}

      <div className="mt-4 border-t border-ink-100 pt-3">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
          Doors, windows and special measurements
        </p>
        <MeasurementList
          project={project}
          roomId={room.id}
          roomUnit={unit}
          rows={[...openings, ...specials]}
          allowOpenings
        />
      </div>
    </section>
  )
}

// ---------- The tab ----------

// Sizes for each room (the app works out floor, wall and perimeter figures), plus special
// measurements such as a vanity width. Everything here is also offered when adding a material,
// to fill in the quantity. No money here, so everyone can see and add.
export default function MeasurementsTab({ project }) {
  const { measurementsByProject, roomsByProject, measurementsError, createRoom } = useWork()
  const [newRoom, setNewRoom] = useState('')
  const [error, setError] = useState(null)
  const all = measurementsByProject[project.id] || []
  const rooms = roomsByProject[project.id] || []
  const roomIds = new Set(rooms.map((r) => r.id))
  const projectWide = all.filter((m) => !m.room_id || !roomIds.has(m.room_id))

  async function addRoom() {
    if (!newRoom.trim()) return
    setError(null)
    try {
      await createRoom(project.id, newRoom)
      setNewRoom('')
    } catch (err) {
      setError(err.message)
    }
  }

  if (measurementsError) return <p className="text-sm text-status-blocked">{measurementsError}</p>

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-600">
        Type each room's length, width and height once. The floor, ceiling, wall and perimeter figures work themselves
        out and can fill in a material's quantity.
      </p>

      {rooms.length === 0 && (
        <p className="rounded-xl border border-dashed border-ink-200 py-8 text-center text-sm text-ink-600">
          No rooms yet. Add the first one below.
        </p>
      )}

      {rooms.map((room) => (
        <RoomCard key={`${room.id}:${room.dim_unit}`} project={project} room={room} measurements={all.filter((m) => m.room_id === room.id)} />
      ))}

      <div className="flex gap-2">
        <input
          value={newRoom}
          onChange={(e) => setNewRoom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addRoom()
            }
          }}
          placeholder="New room, e.g. Ensuite"
          className={inputClass}
          aria-label="New room name"
        />
        <button type="button" onClick={addRoom} className="flex-shrink-0 rounded-lg bg-signal-500 px-4 text-sm font-medium text-ink-950">
          Add room
        </button>
      </div>
      {error && <p className="text-xs text-status-blocked">{error}</p>}

      <section className="rounded-xl border border-ink-100 bg-white p-3">
        <h4 className="mb-2 text-base font-semibold text-ink-900">Whole project</h4>
        <MeasurementList project={project} roomId="" roomUnit="mm" rows={projectWide} allowOpenings={false} />
      </section>
    </div>
  )
}
