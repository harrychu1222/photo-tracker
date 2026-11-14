import { useState } from 'react'
import { useWork } from '../../context/WorkContext'
import { DEFAULT_TEMPLATES, compactItems, startItems } from '../../lib/templates'

const inputClass = 'w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-base focus:border-signal-500'
const primary = 'min-h-[48px] rounded-lg bg-signal-500 px-5 text-sm font-semibold text-ink-950 active:bg-signal-600 disabled:opacity-60'
const secondary = 'min-h-[48px] rounded-lg border border-ink-200 bg-white px-5 text-sm font-semibold text-ink-900'

// A task list taken from a template for one room: pick the template, untick tasks, change hours,
// add tasks, include or leave out each task's materials and tools, save the list as your own.
// `value` = { tpl, items }; `onChange(value)`; `mine` = the user's saved templates.
export default function TemplateChecklist({ label, type, value, onChange, mine, onSaved }) {
  const { saveTemplate } = useWork()
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [open, setOpen] = useState({})
  const count = compactItems(value.items).length

  const items = (v) => {
    if (v.startsWith('d:')) return startItems(DEFAULT_TEMPLATES[v.slice(2)])
    const m = mine.find((t) => `m:${t.id}` === v)
    return m ? startItems(m.items) : []
  }
  const edit = (i, patch) => onChange({ ...value, items: value.items.map((it, k) => (k === i ? { ...it, ...patch } : it)) })
  const setMat = (i, k, pos, v) => edit(i, { materials: value.items[i].materials.map((m, x) => (x === k ? m.map((c, y) => (y === pos ? v : c)) : m)) })
  function add() {
    const t = text.trim()
    if (!t) return
    const n = value.items.length
    onChange({ ...value, items: [...value.items, { name: t, hours: '', after: n ? [n - 1] : [], materials: [], equipment: [], on: true, kit: true }] })
    setText('')
  }
  async function save() {
    try {
      await saveTemplate(name, type, compactItems(value.items))
      await onSaved()
      setSaving(false)
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="rounded-xl border border-ink-200 bg-white p-3" aria-label={`Tasks for ${label}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-ink-900">{label}</p>
        <select aria-label={`Template for ${label}`} value={value.tpl} onChange={(e) => onChange({ tpl: e.target.value, items: items(e.target.value) })} className="rounded-lg border border-ink-200 bg-white px-2 py-2 text-sm">
          <option value="">No template</option>
          {Object.keys(DEFAULT_TEMPLATES).map((k) => <option key={k} value={`d:${k}`}>{k} (standard)</option>)}
          {mine.map((t) => <option key={t.id} value={`m:${t.id}`}>{t.name} (mine)</option>)}
        </select>
      </div>
      <ul className="mt-2 divide-y divide-ink-100">
        {value.items.map((it, i) => (
          <li key={i} className="py-2">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={it.on !== false} onChange={(e) => edit(i, { on: e.target.checked })} aria-label={`Include ${it.name} in ${label}`} className="h-5 w-5 shrink-0" />
              <span className={`min-w-0 flex-1 text-sm ${it.on === false ? 'text-ink-400 line-through' : 'font-medium text-ink-900'}`}>{it.name}{it.exists && <span className="ml-1 text-xs font-normal text-ink-400">(already in this room)</span>}</span>
              <input type="number" min="0" inputMode="decimal" value={it.hours ?? ''} onChange={(e) => edit(i, { hours: e.target.value })} aria-label={`Hours for ${it.name} in ${label}`} className="w-16 rounded-lg border border-ink-200 px-2 py-1.5 text-right text-sm" />
              <span className="text-xs text-ink-600">h</span>
            </div>
            {it.on !== false && (
              <div className="ml-7 mt-1">
                <button type="button" onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))} aria-expanded={!!open[i]} aria-label={`Materials and tools for ${it.name} in ${label}`} className="min-h-[36px] text-left text-xs font-semibold text-ink-700 underline">
                  {open[i] ? 'Hide materials & tools' : `Materials & tools (${(it.materials || []).length + (it.equipment || []).length})`}
                </button>
                {!open[i] && ((it.materials || []).length > 0 || (it.equipment || []).length > 0) && (
                  <p className="text-xs text-ink-600">
                    {(it.materials || []).length > 0 && <>Materials: {it.materials.map((m) => m[0]).join(', ')}. </>}
                    {(it.equipment || []).length > 0 && <>Tools: {it.equipment.join(', ')}.</>}
                  </p>
                )}
                {open[i] && (
                  <div className="mt-1 space-y-2">
                    <div className="space-y-1.5">
                      {(it.materials || []).map((m, k) => (
                        <div key={k} className="grid grid-cols-[minmax(0,1fr)_4rem_4.5rem_auto] items-center gap-1.5">
                          <input value={m[0]} onChange={(e) => setMat(i, k, 0, e.target.value)} placeholder="Material" aria-label={`Material ${k + 1} name for ${it.name} in ${label}`} className="rounded-lg border border-ink-200 px-2 py-1.5 text-sm" />
                          <input type="number" min="0" step="any" inputMode="decimal" value={m[1]} onChange={(e) => setMat(i, k, 1, e.target.value)} aria-label={`Material ${k + 1} quantity for ${it.name} in ${label}`} className="rounded-lg border border-ink-200 px-2 py-1.5 text-right text-sm" />
                          <input value={m[2] || ''} onChange={(e) => setMat(i, k, 2, e.target.value)} placeholder="Unit" aria-label={`Material ${k + 1} unit for ${it.name} in ${label}`} className="rounded-lg border border-ink-200 px-2 py-1.5 text-sm" />
                          <button type="button" onClick={() => edit(i, { materials: it.materials.filter((_, x) => x !== k) })} aria-label={`Remove material ${m[0] || k + 1} from ${it.name} in ${label}`} className="min-h-[36px] px-1.5 text-lg leading-none text-ink-400">×</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => edit(i, { materials: [...(it.materials || []), ['', 1, '']] })} aria-label={`Add material to ${it.name} in ${label}`} className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600">+ Material</button>
                    </div>
                    <div className="space-y-1.5">
                      {(it.equipment || []).map((e, k) => (
                        <div key={k} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5">
                          <input value={e} onChange={(ev) => edit(i, { equipment: it.equipment.map((x, y) => (y === k ? ev.target.value : x)) })} placeholder="Tool or equipment" aria-label={`Tool ${k + 1} name for ${it.name} in ${label}`} className="rounded-lg border border-ink-200 px-2 py-1.5 text-sm" />
                          <button type="button" onClick={() => edit(i, { equipment: it.equipment.filter((_, x) => x !== k) })} aria-label={`Remove tool ${e || k + 1} from ${it.name} in ${label}`} className="min-h-[36px] px-1.5 text-lg leading-none text-ink-400">×</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => edit(i, { equipment: [...(it.equipment || []), ''] })} aria-label={`Add tool to ${it.name} in ${label}`} className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600">+ Tool</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} placeholder="Add a task" aria-label={`Add task to ${label}`} className={inputClass} />
        <button onClick={add} aria-label={`Add task button for ${label}`} className={secondary}>Add</button>
      </div>
      {count > 0 && (saving ? (
        <div className="mt-2 flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name" aria-label="Template name" className={inputClass} />
          <button onClick={save} className={primary}>Save</button>
        </div>
      ) : (
        <button onClick={() => { setSaving(true); setName(`${type} - my list`) }} className="mt-2 min-h-[44px] text-sm font-semibold text-ink-800 underline">Save as my template</button>
      ))}
      {error && <p className="mt-2 text-sm text-status-blocked" role="alert">{error}</p>}
    </section>
  )
}
