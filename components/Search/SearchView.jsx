import { useMemo, useState } from 'react'
import { searchAll, words } from '../../lib/search'
import { useWork } from '../../context/WorkContext'

// One search box for everything: projects, tasks, photos, site diary, issues, defects, materials.
export default function SearchView({ projects, photos, onOpen }) {
  const work = useWork()
  const [q, setQ] = useState('')

  const diary = useMemo(() => Object.values(work.diaryByProject || {}).flat(), [work.diaryByProject])
  const groups = useMemo(
    () =>
      searchAll(q, {
        projects,
        photos,
        tasks: work.tasks,
        rooms: work.rooms,
        diary,
        issues: work.issues,
        defects: work.defects,
        materials: work.materials
      }),
    [q, projects, photos, work.tasks, work.rooms, diary, work.issues, work.defects, work.materials]
  )
  const typed = words(q).length > 0

  return (
    <div className="px-4 py-4 md:px-10 md:py-6">
      <h2 className="mb-3 text-2xl font-bold tracking-tight text-ink-900">Search</h2>
      <input
        autoFocus
        type="search"
        aria-label="Search everything"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Tiles, waterproofing, Smith, leak…"
        className="mb-4 min-h-[48px] w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-base focus:border-signal-500 md:max-w-md"
      />
      {!typed && <p className="text-sm text-ink-600">Find any project, task, photo note, diary entry, issue, defect or material.</p>}
      {typed && groups.length === 0 && <p className="py-8 text-center text-sm text-ink-400">Nothing found for “{q.trim()}”.</p>}
      {groups.map((g) => (
        <section key={g.type} className="mb-5" aria-label={g.label}>
          <h3 className="mb-1.5 text-sm font-semibold text-ink-900">
            {g.label} <span className="font-normal text-ink-400">({g.total})</span>
          </h3>
          <ul className="space-y-1.5">
            {g.items.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => onOpen(r.projectId, r.tab)}
                  className="flex min-h-[48px] w-full items-center gap-3 rounded-xl border border-ink-100 bg-white p-2.5 text-left active:bg-ink-50"
                >
                  {r.thumb && <img src={r.thumb} alt="" className="h-10 w-10 flex-none rounded-md object-cover" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink-900">{r.title}</span>
                    {r.sub && <span className="block truncate text-xs text-ink-600">{r.sub}</span>}
                    {r.snip && <span className="block truncate text-xs text-ink-400">{r.snip}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {g.total > g.items.length && <p className="mt-1 text-xs text-ink-400">+{g.total - g.items.length} more. Type more words to narrow.</p>}
        </section>
      ))}
    </div>
  )
}
