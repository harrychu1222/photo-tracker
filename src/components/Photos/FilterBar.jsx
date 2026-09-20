import { STATUSES, QUOTING_STATUSES } from '../../statusConfig'

const selectClass =
  'w-full rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm text-ink-800 focus:border-signal-500'

export default function FilterBar({ filters, onChange, options }) {
  function update(patch) {
    onChange({ ...filters, ...patch })
  }

  return (
    <div className="space-y-3 border-b border-ink-100 bg-ink-50 px-4 py-3">
      <input
        value={filters.search}
        onChange={(e) => update({ search: e.target.value })}
        placeholder="Search location, room, or category…"
        className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-signal-500"
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select
          value={filters.location}
          onChange={(e) => update({ location: e.target.value })}
          className={selectClass}
        >
          <option value="">All locations</option>
          {options.locations.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        <select value={filters.room} onChange={(e) => update({ room: e.target.value })} className={selectClass}>
          <option value="">All rooms</option>
          {options.rooms.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        <select
          value={filters.category}
          onChange={(e) => update({ category: e.target.value })}
          className={selectClass}
        >
          <option value="">All categories</option>
          {options.categories.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        <select value={filters.tag} onChange={(e) => update({ tag: e.target.value })} className={selectClass}>
          <option value="">All tags</option>
          {options.tags.map((v) => (
            <option key={v} value={v}>
              #{v}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="self-center pr-1 text-[11px] font-medium uppercase tracking-wide text-ink-400">
          Progress
        </span>
        <button
          onClick={() => update({ status: null })}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            filters.status === null ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-600'
          }`}
        >
          All
        </button>
        {STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => update({ status: filters.status === s.value ? null : s.value })}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
              filters.status === s.value ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-600'
            }`}
          >
            <span className="status-dot" style={{ backgroundColor: s.color }} />
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="self-center pr-1 text-[11px] font-medium uppercase tracking-wide text-ink-400">
          Quoting
        </span>
        <button
          onClick={() => update({ quotingStatus: null })}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            filters.quotingStatus === null ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-600'
          }`}
        >
          All
        </button>
        {QUOTING_STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => update({ quotingStatus: filters.quotingStatus === s.value ? null : s.value })}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
              filters.quotingStatus === s.value ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-600'
            }`}
          >
            <span className="status-dot" style={{ backgroundColor: s.color }} />
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
