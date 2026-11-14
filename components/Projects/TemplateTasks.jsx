import { useEffect, useState } from 'react'
import { useWork } from '../../context/WorkContext'
import TemplateChecklist from './TemplateChecklist'
import { DEFAULT_TEMPLATES, compactItems, roomTypeOf, startItems, templateKeyFor, todayISO } from '../../lib/templates'

const inputClass = 'w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-base focus:border-signal-500'
const labelClass = 'mb-1 block text-sm font-medium text-ink-800'

// Plan > Tasks > From template: choose a room and a template, tidy the list, set the start date,
// and add all its tasks (with waiting-on links, planned dates, materials and tools) in one go.
export default function TemplateTasks({ project, defaultRoomId, onClose }) {
  const { roomsByProject, tasksByProject, applyTemplate, loadMyTemplates } = useWork()
  const rooms = roomsByProject[project.id] || []
  const [roomId, setRoomId] = useState(defaultRoomId && !['all', 'none'].includes(defaultRoomId) ? defaultRoomId : rooms[0]?.id || '')
  // The room's own standard list to start with; tasks already in the room are unticked and tagged.
  const initFor = (id) => {
    const rm = rooms.find((r) => r.id === id)
    const key = templateKeyFor(roomTypeOf(rm?.name))
    return mark(id, { tpl: key ? `d:${key}` : '', items: key ? startItems(DEFAULT_TEMPLATES[key]) : [] }, true)
  }
  const mark = (id, v, force) => {
    if (!force && v.tpl === value.tpl) return v
    const have = new Set((tasksByProject[project.id] || []).filter((t) => t.room_id === id).map((t) => t.name.trim().toLowerCase()))
    return { ...v, items: v.items.map((it) => (have.has(it.name.toLowerCase()) ? { ...it, on: false, exists: true } : it)) }
  }
  const [value, setValue] = useState(() => initFor(roomId))
  const [mine, setMine] = useState([])
  const [start, setStart] = useState(project.start_date || todayISO())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  useEffect(() => { loadMyTemplates().then(setMine).catch(() => {}) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const room = rooms.find((r) => r.id === roomId)
  const items = compactItems(value.items)

  async function add() {
    setBusy(true)
    setError(null)
    try {
      await applyTemplate(project.id, roomId, items, start || todayISO())
      onClose()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-5 pb-8 sm:rounded-2xl" role="dialog" aria-label="Add tasks from a template">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink-900">Add tasks from a template</h2>
          <button onClick={onClose} className="text-2xl leading-none text-ink-400" aria-label="Close">×</button>
        </div>
        {rooms.length === 0 ? (
          <p className="text-sm text-ink-600">Add a room first (Plan &gt; Measurements), then its tasks can come from a template.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="tt-room" className={labelClass}>Room</label>
                <select id="tt-room" value={roomId} onChange={(e) => { setRoomId(e.target.value); setValue(initFor(e.target.value)) }} className={inputClass}>
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="tt-start" className={labelClass}>First task starts</label>
                <input id="tt-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} />
              </div>
            </div>
            <TemplateChecklist key={roomId} label={room?.name || 'Room'} type={roomTypeOf(room?.name)} value={value} onChange={(v) => setValue(mark(roomId, v))} mine={mine} onSaved={async () => setMine(await loadMyTemplates())} />
            <p className="text-xs text-ink-400">Tasks get planned dates on working days (8 hours a day) so they show on the Gantt. Material quantities are starting points.</p>
            {error && <p className="text-sm text-status-blocked" role="alert">{error}</p>}
            <button onClick={add} disabled={busy || items.length === 0} className="min-h-[48px] w-full rounded-lg bg-signal-500 px-5 text-sm font-semibold text-ink-950 disabled:opacity-60">
              {busy ? 'Adding…' : items.length === 0 ? (value.items.length ? 'Nothing ticked to add' : 'Choose a template') : `Add ${items.length} task${items.length === 1 ? '' : 's'} to ${room?.name}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
