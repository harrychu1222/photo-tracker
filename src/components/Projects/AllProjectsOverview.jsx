import { useMemo, useState } from 'react'
import CashFlowChart from './CashFlowChart'
import { useAuth } from '../../context/AuthContext'
import { useWork } from '../../context/WorkContext'
import { projectStatusMeta } from '../../statusConfig'
import { fmtMoney } from '../../lib/format'
import { combinedCashFlow, overviewTotals, projectSnapshot } from '../../lib/overview'
import { todayLocal } from '../../lib/tasks'

const chip = (on) => `rounded-full border px-3 py-1 text-xs font-medium ${on ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 bg-white text-ink-600'}`

function Tile({ label, value, sub, tone, testId }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-3" data-testid={testId}>
      <p className="text-xs font-semibold text-ink-600">{label}</p>
      <p className={`mt-1 text-xl font-bold tracking-tight ${tone === 'bad' ? 'text-status-blocked' : 'text-ink-900'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink-600">{sub}</p>}
    </div>
  )
}

// Every project on one screen: where each stands, what needs attention, and the money together.
export default function AllProjectsOverview({ projects, finance, onOpen }) {
  const { isAdmin } = useAuth()
  const work = useWork()
  const [withDone, setWithDone] = useState(false)
  const [showGoods, setShowGoods] = useState(true)
  const [showLabour, setShowLabour] = useState(true)
  const today = todayLocal()

  const shown = useMemo(() => projects.filter((p) => withDone || p.status !== 'complete'), [projects, withDone])
  const snaps = useMemo(() => shown.map((p) => projectSnapshot(p, finance?.[p.id], work, today)), [shown, finance, work, today])
  const totals = overviewTotals(snaps)
  const cash = useMemo(() => (isAdmin ? combinedCashFlow(shown, work, today) : null), [isAdmin, shown, work, today])

  return (
    <div data-testid="all-overview">
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <button onClick={() => setWithDone((v) => !v)} className={chip(withDone)} aria-pressed={withDone}>Include complete projects</button>
        <span className="text-xs text-ink-600">{totals.projects} project{totals.projects === 1 ? '' : 's'} shown</span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Tile testId="tile-behind" label="Behind plan" value={totals.behind} sub={totals.overdueTasks ? `${totals.overdueTasks} overdue task${totals.overdueTasks === 1 ? '' : 's'}` : 'No overdue tasks'} tone={totals.behind ? 'bad' : undefined} />
        <Tile testId="tile-late" label="Late deliveries" value={totals.lateDeliveries} tone={totals.lateDeliveries ? 'bad' : undefined} />
        <Tile testId="tile-defects" label="Open defects" value={totals.openDefects} sub={totals.urgentDefects ? `${totals.urgentDefects} urgent` : undefined} tone={totals.urgentDefects ? 'bad' : undefined} />
        {isAdmin && <Tile testId="tile-net" label="Net (received − spent)" value={fmtMoney(totals.net)} sub={`Received ${fmtMoney(totals.received)} · Spent ${fmtMoney(totals.spent)}`} tone={totals.net < 0 ? 'bad' : undefined} />}
      </div>

      {isAdmin && (
        <section className="mb-4 rounded-xl border border-ink-100 bg-white p-3" aria-label="Combined cash flow">
          <p className="mb-2 text-sm font-semibold text-ink-900">Cash flow, all shown projects</p>
          {cash ? (
            <>
              <div className="mb-2 flex flex-wrap gap-1.5">
                <button onClick={() => setShowGoods((v) => !v)} className={chip(showGoods)} aria-pressed={showGoods}>Materials &amp; equipment</button>
                <button onClick={() => setShowLabour((v) => !v)} className={chip(showLabour)} aria-pressed={showLabour}>Labour</button>
              </div>
              <CashFlowChart data={cash} showGoods={showGoods} showLabour={showLabour} label="Combined cash flow for all shown projects" />
              {totals.toReceive > 0 && <p className="mt-2 text-xs text-ink-600">Still to receive across quotes: {fmtMoney(totals.toReceive)}</p>}
            </>
          ) : (
            <p className="text-sm text-ink-600">No expenses or payments yet.</p>
          )}
        </section>
      )}

      {snaps.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-200 py-10 text-center text-sm text-ink-600">No projects to show.</p>
      ) : (
        <ul className="space-y-2" aria-label="Projects">
          {snaps.map((s) => {
            const st = projectStatusMeta(s.project.status)
            return (
              <li key={s.project.id}>
                <button onClick={() => onOpen(s.project.id)} className="w-full rounded-xl border border-ink-100 bg-white p-3 text-left active:bg-ink-50" data-testid={`ov-${s.project.id}`} aria-label={`Open ${s.project.name}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-2 font-semibold text-ink-900">
                      <span className="status-dot" style={{ backgroundColor: st.color }} />
                      {s.project.name}
                    </p>
                    <span className="text-xs text-ink-600">{st.label}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100" aria-hidden="true">
                    <div className="h-full rounded-full bg-status-done" style={{ width: `${s.progress.total ? s.progress.percent : 0}%` }} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-600">
                    <span>{s.progress.total ? `${s.progress.percent}% done` : 'No tasks yet'}</span>
                    <span className={s.behindDays ? 'font-semibold text-status-blocked' : ''}>{s.behindDays ? `${s.behindDays} day${s.behindDays === 1 ? '' : 's'} behind` : 'On track'}</span>
                    {s.lateDeliveries > 0 && <span className="font-semibold text-status-blocked">{s.lateDeliveries} late deliver{s.lateDeliveries === 1 ? 'y' : 'ies'}</span>}
                    {s.openDefects > 0 && <span className={s.urgentDefects ? 'font-semibold text-status-blocked' : ''}>{s.openDefects} open defect{s.openDefects === 1 ? '' : 's'}</span>}
                    {isAdmin && (
                      <>
                        <span>Spent {fmtMoney(s.spent)}{s.target ? ` of ${fmtMoney(s.target)}` : ''}</span>
                        <span>Received {fmtMoney(s.received)}</span>
                        <span className={s.net < 0 ? 'font-semibold text-status-blocked' : ''}>Net {fmtMoney(s.net)}</span>
                      </>
                    )}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
