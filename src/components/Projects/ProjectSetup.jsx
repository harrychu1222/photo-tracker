import { useMemo, useState } from 'react'
import Icon from '../ui/Icon'
import { useWork } from '../../context/WorkContext'
import { LEVELS, ROOM_CHOICES, buildRooms, levelById } from '../../lib/setup'
import { fmtDateRange } from '../../lib/format'

const inputClass = 'w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-base focus:border-signal-500'
const labelClass = 'mb-1 block text-sm font-medium text-ink-800'
const primary = 'min-h-[48px] rounded-lg bg-signal-500 px-5 text-sm font-semibold text-ink-950 active:bg-signal-600 disabled:opacity-60'
const secondary = 'min-h-[48px] rounded-lg border border-ink-200 bg-white px-5 text-sm font-semibold text-ink-900'
const STEPS = ['Project', 'Levels', 'Rooms', 'Review']

// A short questionnaire for a new project: details, levels, rooms. Creates the project and its
// rooms. (Task templates come next.) `onCreate(fields)` makes the project and returns it.
export default function ProjectSetup({ onCreate, onDone, onCancel, onFullForm }) {
  const { createRoom } = useWork()
  const [step, setStep] = useState(0)
  const [f, setF] = useState({ name: '', client: '', site_address: '', start_date: '', end_date: '' })
  const [levels, setLevels] = useState(['ground'])
  const [plan, setPlan] = useState({})
  const [custom, setCustom] = useState({})
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
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
    setStep(step + 1)
  }

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
      for (const r of rooms) await createRoom(project.id, r.name, r.level)
    } catch (err) {
      setBusy(false)
      setError(`The project was created, but not every room was added: ${err.message}`)
      setStep(4)
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
      {step < 4 && (
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
                <ul className="flex flex-wrap gap-1.5">
                  {rooms.map((r) => (
                    <li key={r.name} className="rounded-full bg-ink-100 px-3 py-1 text-xs font-semibold text-ink-800">{r.name}</li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-xs text-ink-400">Next you can add tasks, quote figures, materials and equipment from the project page.</p>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-ink-900">Project created</p>
            <button onClick={() => onDone(f.createdId)} className={primary}>Open the project</button>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-status-blocked" role="alert">{error}</p>}

        {step < 4 && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {step > 0 && <button onClick={() => { setError(null); setStep(step - 1) }} className={secondary}>Back</button>}
            {step < 3 ? (
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
