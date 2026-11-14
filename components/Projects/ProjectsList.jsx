import { useMemo, useState } from 'react'
import { PROJECT_STATUSES, projectStatusMeta } from '../../statusConfig'
import { fmtDate, fmtDateRange, fmtMoney } from '../../lib/format'
import { overviewTotals, projectSnapshot } from '../../lib/overview'
import { todayLocal } from '../../lib/tasks'
import ExportDialog from './ExportDialog'
import MoreMenu from '../ui/MoreMenu'
import GettingStarted from './GettingStarted'
import { useAuth } from '../../context/AuthContext'
import { useWork } from '../../context/WorkContext'

const chip = (on) => `flex min-h-[36px] flex-none items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium ${on ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 bg-white text-ink-600'}`
const bad = 'font-semibold text-status-blocked'

// One cell of a summary strip: the number first, then what it is. The extra line is read by
// screen readers and shown on wide screens.
function Tile({ label, value, sub, tone, testId, small }) {
  return (
    <div className="min-w-0 px-3 py-2.5" data-testid={testId}>
      <p className={`truncate font-bold tracking-tight ${small ? 'text-base' : 'text-xl'} ${tone === 'bad' ? 'text-status-blocked' : 'text-ink-900'}`}>{value}</p>
      <p className="truncate text-xs font-medium text-ink-600">{label}</p>
      {sub && <p className="sr-only md:not-sr-only md:truncate md:text-xs md:text-ink-600">{sub}</p>}
    </div>
  )
}

function Money({ label, value, tone }) {
  return (
    <div>
      <p className="text-xs text-ink-600">{label}</p>
      <p className={`text-sm font-semibold ${tone === 'bad' ? 'text-status-blocked' : 'text-ink-900'}`}>{value}</p>
    </div>
  )
}

// The one Projects screen: totals across the projects shown, then one big status card per project.
export default function ProjectsList({ projects, photoCounts, finance, loading, error, onOpen, onNew, onAddPhoto, onTeam }) {
  const { isAdmin } = useAuth()
  const work = useWork()
  const [statusFilter, setStatusFilter] = useState(null)
  const [search, setSearch] = useState('')
  const today = todayLocal()

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return projects.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false
      if (q && !`${p.name} ${p.client} ${p.site_address}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [projects, statusFilter, search])

  const snaps = useMemo(() => visible.map((p) => projectSnapshot(p, finance?.[p.id], work, today)), [visible, finance, work, today])
  const totals = overviewTotals(snaps)
  const [exporting, setExporting] = useState(false)

  return (
    <div className="px-4 py-4 md:px-10 md:py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight text-ink-900">Projects</h2>
        <div className="flex items-center gap-2">
          <button onClick={onNew} className="min-h-[44px] rounded-lg bg-signal-500 px-4 text-sm font-semibold text-ink-950 active:bg-signal-600">
            + New project
          </button>
          {projects.length > 0 && <MoreMenu items={[{ label: 'Export all projects', icon: 'download', onClick: () => setExporting(true) }]} />}
        </div>
      </div>
      {isAdmin && !loading && !error && (
        <GettingStarted
          projectCount={projects.length}
          photoCount={Object.values(photoCounts || {}).reduce((a, b) => a + b, 0)}
          onNew={onNew}
          onAddPhoto={onAddPhoto}
          onTeam={onTeam}
        />
      )}
      {exporting && <ExportDialog projects={visible} snaps={snaps} onClose={() => setExporting(false)} />}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search name, client or address…"
        className="mb-3 min-h-[44px] w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:border-signal-500 md:max-w-md"
      />

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        <button onClick={() => setStatusFilter(null)} className={chip(statusFilter === null)} aria-pressed={statusFilter === null}>All</button>
        {PROJECT_STATUSES.map((s) => (
          <button key={s.value} onClick={() => setStatusFilter(statusFilter === s.value ? null : s.value)} className={chip(statusFilter === s.value)} aria-pressed={statusFilter === s.value}>
            <span className="status-dot" style={{ backgroundColor: s.color }} />
            {s.label}
          </button>
        ))}
      </div>

      {loading && <p className="py-10 text-center text-sm text-ink-400">Loading projects…</p>}
      {error && <p className="py-4 text-center text-sm text-status-blocked">{error}</p>}
      {!loading && !error && projects.length === 0 && (
        <p className="rounded-xl border border-dashed border-ink-200 py-12 text-center text-sm text-ink-600">No projects yet. Tap “+ New project” to start one.</p>
      )}
      {!loading && projects.length > 0 && visible.length === 0 && <p className="py-10 text-center text-sm text-ink-400">No projects match.</p>}

      {visible.length > 0 && (
        <div data-testid="all-overview">
          <div className="mb-3 grid grid-cols-3 divide-x divide-ink-100 rounded-xl border border-ink-100 bg-white">
            <Tile testId="tile-behind" label="Behind plan" value={totals.behind} sub={totals.overdueTasks ? `${totals.overdueTasks} overdue task${totals.overdueTasks === 1 ? '' : 's'}` : 'No overdue tasks'} tone={totals.behind ? 'bad' : undefined} />
            <Tile testId="tile-late" label="Late deliveries" value={totals.lateDeliveries} tone={totals.lateDeliveries ? 'bad' : undefined} />
            <Tile testId="tile-defects" label="Open defects" value={totals.openDefects} sub={totals.urgentDefects ? `${totals.urgentDefects} urgent` : undefined} tone={totals.urgentDefects ? 'bad' : undefined} />
          </div>
          {isAdmin && (
            <div className="mb-4 grid grid-cols-2 divide-x divide-y divide-ink-100 overflow-hidden rounded-xl border border-ink-100 bg-white sm:grid-cols-4 sm:divide-y-0" data-testid="money-tiles">
              <Tile small testId="tile-received" label="Received" value={fmtMoney(totals.received)} />
              <Tile small testId="tile-spent" label="Spent" value={fmtMoney(totals.spent)} />
              <Tile small testId="tile-net" label="Net (received − spent)" value={fmtMoney(totals.net)} tone={totals.net < 0 ? 'bad' : undefined} />
              <Tile small testId="tile-toreceive" label="Still to receive" value={fmtMoney(totals.toReceive)} sub="Of the quotes shown" />
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" role="list" aria-label="Projects">
            {snaps.map((s) => {
              const p = s.project
              const st = projectStatusMeta(p.status)
              const count = photoCounts[p.id] || 0
              const overdue = s.next?.state.kind === 'overdue'
              return (
                <button key={p.id} role="listitem" onClick={() => onOpen(p.id)} aria-label={`Open ${p.name}`} data-testid={`ov-${p.id}`} className="flex flex-col rounded-2xl border border-ink-100 bg-white p-4 text-left active:bg-ink-50">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-lg font-bold leading-tight text-ink-900">{p.name}</p>
                    <span className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-ink-50 px-2.5 py-1 text-xs font-medium text-ink-800">
                      <span className="status-dot" style={{ backgroundColor: st.color }} />
                      {st.label}
                    </span>
                  </div>
                  {(p.client || p.site_address) && <p className="mt-1 text-sm text-ink-600">{[p.client, p.site_address].filter(Boolean).join(' — ')}</p>}
                  {fmtDateRange(p.start_date, p.end_date) && <p className="text-xs text-ink-400">{fmtDateRange(p.start_date, p.end_date)}</p>}

                  <div className="mt-3">
                    <div className="mb-1 flex items-baseline justify-between text-sm">
                      <span className="font-semibold text-ink-900">{s.progress.total ? `${s.progress.percent}% done` : 'No tasks yet'}</span>
                      {s.progress.total > 0 && <span className="text-xs text-ink-600">{s.progress.done} of {s.progress.total} tasks</span>}
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-ink-100" aria-hidden="true">
                      <div className="h-full rounded-full bg-status-done" style={{ width: `${s.progress.total ? s.progress.percent : 0}%` }} />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-700">
                    <span className={s.behindDays ? bad : ''}>{s.behindDays ? `${s.behindDays} day${s.behindDays === 1 ? '' : 's'} behind` : 'On track'}</span>
                    {s.lateDeliveries > 0 && <span className={bad}>{s.lateDeliveries} late deliver{s.lateDeliveries === 1 ? 'y' : 'ies'}</span>}
                    {s.openDefects > 0 && <span className={s.urgentDefects ? bad : ''}>{s.openDefects} open defect{s.openDefects === 1 ? '' : 's'}{s.urgentDefects ? ` (${s.urgentDefects} urgent)` : ''}</span>}
                    <span className="text-ink-600">{count} photo{count === 1 ? '' : 's'}</span>
                  </div>

                  {isAdmin && (
                    <div className="mt-3 border-t border-ink-100 pt-3">
                      <div className="grid grid-cols-4 gap-2">
                        <Money label="Quote" value={s.quote ? fmtMoney(s.quote) : '—'} />
                        <Money label="Received" value={fmtMoney(s.received)} />
                        <Money label="Spent" value={fmtMoney(s.spent)} />
                        <Money label="Net" value={fmtMoney(s.net)} tone={s.net < 0 ? 'bad' : undefined} />
                      </div>
                      {s.next && (
                        <p className={`mt-2 text-xs ${overdue ? bad : 'text-ink-600'}`}>
                          Next payment: {s.next.milestone.name}, {fmtMoney(s.next.milestone.amount)}
                          {s.next.milestone.due_on ? `, ${overdue ? 'was due' : 'due'} ${fmtDate(s.next.milestone.due_on)}` : ''}
                        </p>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
