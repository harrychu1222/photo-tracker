import { useEffect, useMemo, useState } from 'react'
import Icon from '../ui/Icon'
import { useWork } from '../../context/WorkContext'
import { LEVELS, ROOM_CHOICES, buildRooms, levelById } from '../../lib/setup'
import { fmtDateRange } from '../../lib/format'
import { DEFAULT_TEMPLATES, compactItems, startItems, templateKeyFor } from '../../lib/templates'

const inputClass = 'w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-base focus:border-signal-500'
const labelClass = 'mb-1 block text-sm font-medium text-ink-800'
const primary = 'min-h-[48px] rounded-lg bg-signal-500 px-5 text-sm font-semibold text-ink-950 active:bg-signal-600 disabled:opacity-60'
const secondary = 'min-h-[48px] rounded-lg border border-ink-200 bg-white px-5 text-sm font-semibold text-ink-900'
const STEPS = ['Project', 'Levels', 'Rooms', 'Tasks', 'Review']

// A short questionnaire for a new project: details, levels, rooms. Creates the project and its
// rooms. (Task templates come next.) `onCreate(fields)` makes the project and returns it.
export default function ProjectSetup({ onCreate, onDone, onCancel, onFullForm }) {
  const { createRoom, applyTemplate, loadMyTemplates, saveTemplate } = useWork()
  const [step, setStep] = useState(0)
  const [f, setF] = useState({ name: '', client: '', site_address: '', start_date: '', end_date: '' })
  const [levels, setLevels] = useState(['ground'])
  const [plan, setPlan] = useState({})
  const [custom, setCustom] = useState({})
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [taskPlan, setTaskPlan] = useState({}) // room name -> { tpl, items }
  const [mine, setMine] = useState([])
  const [newTask, setNewTask] = useState({})
  const [saving, setSaving] = useState(null)
  const [tplName, setTplName] = useState('')
  useEffect(() => { loadMyTemplates().then(setMine).catch(() => {}) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }))
  const chosen = LEVELS.filter((l) => levels.includes(l.id))
  const rooms = useMemo(() => buildRooms(Object.fromEntries(Object.entries(plan).filter(([id]) => levels.includes(id)))), [plan, levels])

  function next() {
    setError(null)
    if (step === 0) {
      if (!f.name.trim()) return setError('Give the project a name.')
      if (f.start_date && f.end_date && f.end_date < f.start_date) return setError('The end date is before the start date.')
    }
    if (step === 1 && levels.length === 0) return setError('Pick at least one level.')
    if (step === 2) {
      setTaskPlan((tp) => {
        const out = {}
        rooms.forEach((r) => {
          if (tp[r.name]) return void (out[r.name] = tp[r.name])
          const key = templateKeyFor(r.type)
          out[r.name] = { tpl: key ? `d:${key}` : '', items: key ? startItems(DEFAULT_TEMPLATES[key]) : [] }
        })
        return out
      })
    }
    setStep(step + 1)
  }

  const tplItems = (v) => {
    if (v.startsWith('d:')) return startItems(DEFAULT_TEMPLATES[v.slice(2)])
    const m = mine.find((t) => `m:${t.id}` === v)
    return m ? startItems(m.items) : []
  }
  const setRoom = (name, fn) => setTaskPlan((tp) => ({ ...tp, [name]: fn(tp[name]) }))
  const pickTpl = (name, v) => setRoom(name, () => ({ tpl: v, items: tplItems(v) }))
  const editItem = (name, i, patch) => setRoom(name, (r) => ({ ...r, items: r.items.map((it, k) => (k === i ? { ...it, ...patch } : it)) }))
  function addTask(name) {
    const t = (newTask[name] || '').trim()
    if (!t) return
    setRoom(name, (r) => ({ ...r, items: [...r.items, { name: t, hours: '', after: r.items.length ? [r.items.length - 1] : [], materials: [], equipment: [], on: true, kit: true }] }))
    setNewTask((n) => ({ ...n, [name]: '' }))
  }
  async function saveMine(r) {
    try {
      await saveTemplate(tplName, r.type, compactItems(taskPlan[r.name].items))
      setMine(await loadMyTemplates())
      setSaving(null)
      setTplName('')
    } catch (err) {
      setError(err.message)
    }
  }
  const taskCount = (name) => compactItems(taskPlan[name]?.items || []).length

  const toggleLevel = (id) => setLevels((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]))
  const count = (lv, name) => plan[lv]?.[name] || 0
  const bump = (lv, name, d) => setPlan((p) => ({ ...p, [lv]: { ...(p[lv] || {}), [name]: Math.max(0, Math.min(20, count(lv, name) + d)) } }))
  function addCustom(lv) {
    const name = (custom[lv] || '').trim()
    if (!name) return
    setPlan((p) => ({ ...p, [lv]: { ...(p[lv] || {}), [name]: Math.max(1, count(lv, name)) } }))
    setCustom((c) => ({ ...c, [lv]: '' }))
  }

  async function create() {
    setBusy(true)
    setError(null)
    let project
    try {
      project = await onCreate({
        name: f.name.trim(),
        client: f.client.trim(),
        site_address: f.site_address.trim(),
        status: 'active',
        start_date: f.start_date || null,
        end_date: f.end_date || null
      })
    } catch (err) {
      setBusy(false)
      return setError(err.message)
    }
    try {
      for (const r of rooms) {
        const room = await createRoom(project.id, r.name, r.level)
        await applyTemplate(project.id, room.id, compactItems(taskPlan[r.name]?.items || []))
      }
    } catch (err) {
      setBusy(false)
      setError(`The project was created, but not every room or task was added: ${err.message}`)
      setStep(5)
      setF((v) => ({ ...v, createdId: project.id }))
      return
    }
    onDone(project.id)
  }

  return (
    <div className="px-4 py-4 md:px-10 md:py-6" data-testid="project-setup">
      <button onClick={onCancel} className="mb-2 flex min-h-[44px] items-center gap-1 text-sm font-medium text-ink-600">
        <Icon name="back" size={16} /> Cancel
      </button>
      <h2 className="text-2xl font-bold tracking-tight text-ink-900">New project</h2>
      {step < 5 && (
        <ol className="mb-5 mt-3 flex gap-1.5" aria-label="Steps">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i === step ? 'step' : undefined} className={`flex-1 rounded-lg px-2 py-1.5 text-center text-xs font-semibold ${i === step ? 'bg-ink-900 text-white' : i < step ? 'bg-[#D7EBDD] text-[#1F5A37]' : 'bg-ink-100 text-ink-600'}`}>
              {i + 1}. {s}
            </li>
          ))}
        </ol>
      )}

      <div className="max-w-2xl rounded-xl border border-ink-100 bg-white p-4 md:p-5">
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className={labelClass} htmlFor="setup-name">Project name</label>
              <input id="setup-name" value={f.name} onChange={set('name')} placeholder="e.g. Smith Kitchen" className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="setup-client">Client</label>
              <input id="setup-client" value={f.client} onChange={set('client')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="setup-address">Site address</label>
              <input id="setup-address" value={f.site_address} onChange={set('site_address')} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="setup-start">Planned start</label>
                <input id="setup-start" type="date" value={f.start_date} onChange={set('start_date')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="setup-end">Planned end</label>
                <input id="setup-end" type="date" value={f.end_date} onChange={set('end_date')} className={inputClass} />
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <p className="text-base font-semibold text-ink-900">Which levels does the job cover?</p>
            <p className="mb-3 text-sm text-ink-600">Pick every level that has work on it.</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Levels">
              {LEVELS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => toggleLevel(l.id)}
                  aria-pressed={levels.includes(l.id)}
                  className={`min-h-[48px] rounded-full border px-5 text-sm font-semibold ${levels.includes(l.id) ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 bg-white text-ink-600'}`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <p className="text-sm text-ink-600">Set how many of each room are in the job. Leave a room at 0 to skip it.</p>
            {chosen.map((lv) => {
              const names = [...ROOM_CHOICES[lv.kind], ...Object.keys(plan[lv.id] || {}).filter((n) => !ROOM_CHOICES[lv.kind].includes(n))]
              return (
                <section key={lv.id} aria-label={`${lv.label} rooms`}>
                  <h3 className="mb-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-600">{lv.label}</h3>
                  <ul className="divide-y divide-ink-100 rounded-lg border border-ink-100">
                    {names.map((n) => (
                      <li key={n} className="flex min-h-[48px] items-center justify-between gap-3 px-3">
                        <span className={`text-sm ${count(lv.id, n) ? 'font-semibold text-ink-900' : 'text-ink-600'}`}>{n}</span>
                        <span className="flex items-center gap-2">
                          <button onClick={() => bump(lv.id, n, -1)} aria-label={`Fewer ${n} on ${lv.label}`} className="h-11 w-11 rounded-lg border border-ink-200 text-lg font-semibold text-ink-900">−</button>
                          <span className="w-6 text-center text-sm font-semibold tabular-nums" data-testid={`count-${lv.id}-${n}`}>{count(lv.id, n)}</span>
                          <button onClick={() => bump(lv.id, n, 1)} aria-label={`More ${n} on ${lv.label}`} className="h-11 w-11 rounded-lg border border-ink-200 text-lg font-semibold text-ink-900">+</button>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={custom[lv.id] || ''}
                      onChange={(e) => setCustom((c) => ({ ...c, [lv.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom(lv.id))}
                      placeholder="Another room, e.g. Pantry"
                      aria-label={`Another room on ${lv.label}`}
                      className={inputClass}
                    />
                    <button onClick={() => addCustom(lv.id)} className={secondary} aria-label={`Add room on ${lv.label}`}>Add</button>
                  </div>
                </section>
              )
            })}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4" data-testid="setup-tasks">
            <p className="text-sm text-ink-600">Pick a task list for each room. Untick what you do not need, change the hours, or add your own.</p>
            {rooms.length === 0 && <p className="text-sm text-ink-600">No rooms were chosen, so there are no tasks to set up. Press Next.</p>}
            {rooms.map((r) => {
              const tp = taskPlan[r.name] || { tpl: '', items: [] }
              const keys = Object.keys(DEFAULT_TEMPLATES)
              return (
                <section key={r.name} className="rounded-xl border border-ink-200 bg-white p-3" aria-label={`Tasks for ${r.name}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-ink-900">{r.name}</p>
                    <select aria-label={`Template for ${r.name}`} value={tp.tpl} onChange={(e) => pickTpl(r.name, e.target.value)} className="rounded-lg border border-ink-200 bg-white px-2 py-2 text-sm">
                      <option value="">No template</option>
                      {keys.map((k) => <option key={k} value={`d:${k}`}>{k} (standard)</option>)}
                      {mine.map((t) => <option key={t.id} value={`m:${t.id}`}>{t.name} (mine)</option>)}
                    </select>
                  </div>
                  <ul className="mt-2 divide-y divide-ink-100">
                    {tp.items.map((it, i) => (
                      <li key={i} className="py-2">
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={it.on !== false} onChange={(e) => editItem(r.name, i, { on: e.target.checked })} aria-label={`Include ${it.name} in ${r.name}`} className="h-5 w-5 shrink-0" />
                          <span className={`min-w-0 flex-1 text-sm ${it.on === false ? 'text-ink-400 line-through' : 'font-medium text-ink-900'}`}>{it.name}</span>
                          <input type="number" min="0" inputMode="decimal" value={it.hours ?? ''} onChange={(e) => editItem(r.name, i, { hours: e.target.value })} aria-label={`Hours for ${it.name} in ${r.name}`} className="w-16 rounded-lg border border-ink-200 px-2 py-1.5 text-right text-sm" />
                          <span className="text-xs text-ink-600">h</span>
                        </div>
                        {it.on !== false && ((it.materials || []).length > 0 || (it.equipment || []).length > 0) && (
                          <label className="ml-7 mt-1 flex items-start gap-2 text-xs text-ink-600">
                            <input type="checkbox" checked={it.kit !== false} onChange={(e) => editItem(r.name, i, { kit: e.target.checked })} aria-label={`Include materials and tools for ${it.name} in ${r.name}`} className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>
                              {(it.materials || []).length > 0 && <>Materials: {it.materials.map((m) => m[0]).join(', ')}. </>}
                              {(it.equipment || []).length > 0 && <>Tools: {it.equipment.join(', ')}.</>}
                            </span>
                          </label>
                        )}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex gap-2">
                    <input value={newTask[r.name] || ''} onChange={(e) => setNewTask((n) => ({ ...n, [r.name]: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTask(r.name))} placeholder="Add a task" aria-label={`Add task to ${r.name}`} className={inputClass} />
                    <button onClick={() => addTask(r.name)} aria-label={`Add task button for ${r.name}`} className={secondary}>Add</button>
                  </div>
                  {taskCount(r.name) > 0 && (
                    saving === r.name ? (
                      <div className="mt-2 flex gap-2">
                        <input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="Template name" aria-label="Template name" className={inputClass} />
                        <button onClick={() => saveMine(r)} className={primary}>Save</button>
                      </div>
                    ) : (
                      <button onClick={() => { setSaving(r.name); setTplName(`${r.type} - my list`) }} className="mt-2 min-h-[44px] text-sm font-semibold text-ink-800 underline">Save as my template</button>
                    )
                  )}
                </section>
              )
            })}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4" data-testid="setup-review">
            <div>
              <p className="text-lg font-semibold text-ink-900">{f.name}</p>
              <p className="text-sm text-ink-600">{[f.client, f.site_address, fmtDateRange(f.start_date, f.end_date)].filter(Boolean).join(' · ') || 'No other details yet'}</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-600">Levels</p>
              <p className="text-sm text-ink-900">{chosen.map((l) => l.label).join(', ')}</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-600">Rooms ({rooms.length})</p>
              {rooms.length === 0 ? (
                <p className="text-sm text-ink-600">No rooms yet. You can add them later on Plan &gt; Measurements.</p>
              ) : (
                chosen.filter((l) => rooms.some((r) => r.level === l.label)).map((l) => (
                  <div key={l.id} className="mb-3" data-testid={`review-level-${l.id}`}>
                    <p className="mb-1 text-sm font-semibold text-ink-900">{l.label}</p>
                    <ul className="flex flex-wrap gap-1.5">
                      {rooms.filter((r) => r.level === l.label).map((r) => (
                        <li key={r.name} className="rounded-full bg-ink-100 px-3 py-1 text-xs font-semibold text-ink-800">{r.name}{taskCount(r.name) ? ` · ${taskCount(r.name)} tasks` : ''}</li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
            <p className="text-xs text-ink-400">Material quantities from templates are starting points: measure the rooms and adjust them on the Materials tab. Quote figures and dates can be added from the project page.</p>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-ink-900">Project created</p>
            <button onClick={() => onDone(f.createdId)} className={primary}>Open the project</button>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-status-blocked" role="alert">{error}</p>}

        {step < 5 && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {step > 0 && <button onClick={() => { setError(null); setStep(step - 1) }} className={secondary}>Back</button>}
            {step < 4 ? (
              <button onClick={next} className={primary}>Next</button>
            ) : (
              <button onClick={create} disabled={busy} className={primary}>{busy ? 'Creating…' : 'Create project'}</button>
            )}
          </div>
        )}
      </div>
      {step === 0 && (
        <button onClick={onFullForm} className="mt-3 min-h-[44px] text-sm font-medium text-signal-600">
          Skip the questions and use the full form
        </button>
      )}
    </div>
  )
}
