import { STATUSES } from '../../statusConfig'

export default function FilterBar({ filters, onChange, allTags }) {
  function update(patch) {
    onChange({ ...filters, ...patch })
  }

  function toggleTag(tag) {
    const has = filters.tags.includes(tag)
    update({ tags: has ? filters.tags.filter((t) => t !== tag) : [...filters.tags, tag] })
  }

  return (
    <div className="space-y-3 border-b border-ink-100 bg-ink-50 px-4 py-3">
      <input
        value={filters.search}
        onChange={(e) => update({ search: e.target.value })}
        placeholder="Search location or category…"
        className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-signal-500"
      />

      <div className="flex flex-wrap gap-1.5">
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

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`rounded-full border px-2.5 py-1 text-xs ${
                filters.tags.includes(tag)
                  ? 'border-signal-500 bg-signal-100 text-signal-600'
                  : 'border-ink-200 text-ink-600'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
