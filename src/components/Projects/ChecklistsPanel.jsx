import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useWork } from '../../context/WorkContext'
import { fmtDate } from '../../lib/format'
import { CHECKLIST_TEMPLATES, groupLists, listProgress } from '../../lib/checklists'

const inputClass = 'w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-base focus:border-signal-500'
const labelClass = 'mb-1 block text-sm font-medium text-ink-800'

function AddList({ project, existing, onDone }) {
  const { addChecklist, checkTemplates, deleteChecklistTemplate } = useWork()
  const { isAdmin } = useAuth()
  const [pick, setPick] = useState('')
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  function choose(v) {
    setPick(v)
    const mine = v.startsWith('my:') ? checkTemplates.find((x) => x.id === v.slice(3)) : null
    const t = mine ? { name: mine.name, items: mine.items } : CHECKLIST_TEMPLATES.find((x) => x.name === v)
    setName(t ? t.name : '')
    setText(t ? t.items.join('\n') : '')
  }

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (existing.includes(name.trim())) throw new Error('This project already has a checklist with that name.')
      await addChecklist(project.id, name, text.split('\n'))
      onDone()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="mb-4 space-y-3 rounded-xl border border-ink-100 bg-ink-50 p-3" aria-label="Checklist form">
      <p className="text-sm font-semibold text-ink-900">Add a checklist</p>
      <div>
        <label htmlFor="cl-pick" className={labelClass}>Start from</label>
        <select id="cl-pick" value={pick} onChange={(e) => choose(e.target.value)} className={inputClass}>
          <option value="">My own list</option>
          {checkTemplates.length > 0 && (
            <optgroup label="My templates">
              {checkTemplates.map((t) => <option key={t.id} value={`my:${t.id}`}>{t.name}</option>)}
            </optgroup>
          )}
          <optgroup label="Built-in">
            {CHECKLIST_TEMPLATES.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
          </optgroup>
        </select>
        {isAdmin && pick.startsWith('my:') && (
          <button type="button" onClick={() => confirm('Delete this template? Checklists already on projects are kept.') && deleteChecklistTemplate(pick.slice(3)).then(() => choose('')).catch((err) => setError(err.message))} className="mt-1 min-h-[40px] text-xs font-medium text-ink-400 underline">Delete this template</button>
        )}
      </div>
      <div>
        <label htmlFor="cl-name" className={labelClass}>Checklist name</label>
        <input id="cl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bathroom waterproofing" className={inputClass} />
      </div>
      <div>
        <label htmlFor="cl-items" className={labelClass}>Items (one per line, edit freely)</label>
        <textarea id="cl-items" rows={7} value={text} onChange={(e) => setText(e.target.value)} className={inputClass} />
      </div>
      {error && <p className="text-sm text-status-blocked" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="min-h-[44px] rounded-lg bg-signal-500 px-5 text-sm font-semibold text-ink-950 disabled:opacity-60">Add checklist</button>
        <button type="button" onClick={onDone} className="min-h-[44px] rounded-lg border border-ink-200 bg-white px-5 text-sm font-semibold text-ink-900">Cancel</button>
      </div>
    </form>
  )
}

function Item({ item, onError }) {
  const { setCheckDone, saveCheckNote, deleteCheck } = useWork()
  const [note, setNote] = useState(item.note || '')
  const [open, setOpen] = useState(false)
  const run = async (fn) => {
    onError(null)
    try {
      await fn()
    } catch (err) {
      onError(err.message)
    }
  }
  return (
    <li className="border-t border-ink-100 py-2 first:border-t-0">
      <label className="flex min-h-[44px] items-start gap-3">
        <input type="checkbox" checked={!!item.done} onChange={(e) => run(() => setCheckDone(item.id, e.target.checked))} className="mt-1 h-5 w-5" aria-label={item.text} />
        <span className="min-w-0 flex-1">
          <span className={`block text-sm ${item.done ? 'text-ink-600 line-through' : 'text-ink-900'}`}>{item.text}</span>
          {item.done && item.done_on && <span className="block text-xs text-ink-600">Done {fmtDate(item.done_on)}</span>}
          {item.pending && <span className="block text-xs text-ink-400">Waiting to send</span>}
          {item.note && !open && <span className="block text-xs text-ink-600">Note: {item.note}</span>}
        </span>
      </label>
      <div className="flex gap-3 pl-8">
        <button onClick={() => setOpen((o) => !o)} className="min-h-[36px] text-xs font-medium text-ink-600 underline" aria-label={`Note for ${item.text}`}>{item.note ? 'Edit note' : 'Add note'}</button>
        <button onClick={() => run(() => deleteCheck(item.id))} className="min-h-[36px] text-xs font-medium text-ink-400 underline" aria-label={`Remove ${item.text}`}>Remove</button>
      </div>
      {open && (
        <div className="mt-1 flex gap-2 pl-8">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Certificate no. 1234" aria-label={`Note text for ${item.text}`} className={inputClass} />
          <button onClick={() => run(async () => { await saveCheckNote(item.id, note); setOpen(false) })} className="min-h-[44px] rounded-lg bg-ink-900 px-4 text-sm font-semibold text-white">Save</button>
        </div>
      )}
    </li>
  )
}

export default function ChecklistsPanel({ project }) {
  const { checksByProject, addChecklist, deleteChecklist, saveChecklistTemplate, checkTemplates } = useWork()
  const { isAdmin } = useAuth()
  const [saved, setSaved] = useState(null)
  const lists = groupLists(checksByProject[project.id] || [])
  const [adding, setAdding] = useState(false)
  const [extra, setExtra] = useState({}) // list name -> new item text
  const [error, setError] = useState(null)
  const run = async (fn) => {
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      {adding ? (
        <AddList project={project} existing={lists.map((l) => l.name)} onDone={() => setAdding(false)} />
      ) : (
        <button onClick={() => setAdding(true)} className="mb-4 min-h-[44px] rounded-lg bg-signal-500 px-5 text-sm font-semibold text-ink-950">+ Add checklist</button>
      )}
      {error && <p className="mb-3 text-sm text-status-blocked" role="alert">{error}</p>}
      {lists.length === 0 && !adding && <p className="rounded-xl border border-dashed border-ink-200 py-10 text-center text-sm text-ink-600">No checklists yet. Add one for waterproofing, site safety, plumbing, electrical or handover, then tick items off as you go.</p>}
      {lists.map((l) => {
        const p = listProgress(l.items)
        return (
          <section key={l.name} className="mb-4 rounded-xl border border-ink-100 bg-white p-3" aria-label={l.name}>
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink-900">{l.name}</h3>
              <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${p.complete ? 'bg-[#D8EFD9] text-[#1E5B26]' : 'bg-ink-50 text-ink-800'}`}>{p.complete ? 'Complete' : `${p.done} of ${p.total}`}</span>
            </div>
            <ul>{l.items.map((it) => <Item key={it.id} item={it} onError={setError} />)}</ul>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                const v = (extra[l.name] || '').trim()
                if (v) run(async () => { await addChecklist(project.id, l.name, [v]); setExtra((x) => ({ ...x, [l.name]: '' })) })
              }}
            >
              <input value={extra[l.name] || ''} onChange={(e) => setExtra((x) => ({ ...x, [l.name]: e.target.value }))} placeholder="Add an item" aria-label={`Add item to ${l.name}`} className={inputClass} />
              <button type="submit" className="min-h-[44px] rounded-lg border border-ink-200 bg-white px-4 text-sm font-semibold text-ink-900">Add</button>
            </form>
            {isAdmin && (
              <button
                onClick={() => run(async () => { await saveChecklistTemplate(l.name, l.items.map((i) => i.text)); setSaved(l.name) })}
                className="mr-4 mt-2 min-h-[36px] text-xs font-medium text-ink-600 underline"
                aria-label={`Save ${l.name} as my template`}
              >{checkTemplates.some((t) => t.name === l.name) ? 'Update my template' : 'Save as my template'}</button>
            )}
            {saved === l.name && <span className="text-xs text-ink-600" role="status">Template saved.</span>}
            <button onClick={() => confirm(`Delete the whole "${l.name}" checklist?`) && run(() => deleteChecklist(project.id, l.name))} className="mt-2 min-h-[36px] text-xs font-medium text-ink-400 underline" aria-label={`Delete checklist ${l.name}`}>Delete checklist</button>
          </section>
        )
      })}
    </div>
  )
}
