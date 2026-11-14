import { useState } from 'react'

const fieldClass =
  'w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-base focus:border-signal-500'

// Pick an existing project or create one on the spot. `value` is a project id ('' = none).
export default function ProjectPicker({ projects, value, onChange, onCreate }) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleAdd() {
    if (!newName.trim()) {
      setError('Type a project name first.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const project = await onCreate({ name: newName })
      onChange(project.id)
      setAdding(false)
      setNewName('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <select
        value={adding ? '__new__' : value || ''}
        onChange={(e) => {
          if (e.target.value === '__new__') {
            setAdding(true)
          } else {
            setAdding(false)
            setError(null)
            onChange(e.target.value)
          }
        }}
        className={fieldClass}
      >
        <option value="">No project</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
        <option value="__new__">+ New project…</option>
      </select>

      {adding && (
        <div className="mt-2 flex gap-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAdd()
              }
            }}
            placeholder="New project name"
            className={fieldClass}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={busy}
            className="rounded-lg bg-ink-900 px-4 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy ? 'Adding…' : 'Add'}
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false)
              setError(null)
            }}
            className="rounded-lg border border-ink-200 px-3 text-sm text-ink-600"
          >
            Cancel
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-sm text-status-blocked">{error}</p>}
    </div>
  )
}
