import { useMemo, useState } from 'react'
import { PROJECT_STATUSES, projectStatusMeta } from '../../statusConfig'
import { fmtDateRange } from '../../lib/format'

export default function ProjectsList({ projects, photoCounts, loading, error, onOpen, onNew }) {
  const [statusFilter, setStatusFilter] = useState(null)
  const [search, setSearch] = useState('')

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return projects.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false
      if (q && !`${p.name} ${p.client} ${p.site_address}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [projects, statusFilter, search])

  return (
    <div className="px-4 py-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink-900">Projects</h2>
        <button onClick={onNew} className="rounded-full bg-signal-500 px-4 py-2 text-sm font-medium text-white">
          + New project
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search name, client or address…"
        className="mb-3 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-signal-500"
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        <button
          onClick={() => setStatusFilter(null)}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            statusFilter === null ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-600'
          }`}
        >
          All
        </button>
        {PROJECT_STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(statusFilter === s.value ? null : s.value)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
              statusFilter === s.value ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-600'
            }`}
          >
            <span className="status-dot" style={{ backgroundColor: s.color }} />
            {s.label}
          </button>
        ))}
      </div>

      {loading && <p className="py-10 text-center text-sm text-ink-400">Loading projects…</p>}
      {error && <p className="py-6 text-center text-sm text-status-blocked">{error}</p>}

      {!loading && !error && projects.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-sm text-ink-600">No projects yet. Create one to start grouping photos and, soon, tasks.</p>
        </div>
      )}

      {!loading && !error && projects.length > 0 && visible.length === 0 && (
        <p className="py-10 text-center text-sm text-ink-600">No projects match these filters.</p>
      )}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {visible.map((p) => {
          const status = projectStatusMeta(p.status)
          const count = photoCounts[p.id] || 0
          const dates = fmtDateRange(p.start_date, p.end_date)
          return (
            <button
              key={p.id}
              onClick={() => onOpen(p.id)}
              className="rounded-xl border border-ink-100 bg-white p-4 text-left shadow-sm active:bg-ink-50"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-base font-semibold text-ink-900">{p.name}</p>
                <span className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-ink-50 px-2.5 py-1 text-xs font-medium text-ink-800">
                  <span className="status-dot" style={{ backgroundColor: status.color }} />
                  {status.label}
                </span>
              </div>
              {(p.client || p.site_address) && (
                <p className="mt-1 truncate text-sm text-ink-600">
                  {[p.client, p.site_address].filter(Boolean).join(' — ')}
                </p>
              )}
              <p className="mt-2 text-xs text-ink-400">
                {[dates, `${count} photo${count === 1 ? '' : 's'}`].filter(Boolean).join('  ·  ')}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
