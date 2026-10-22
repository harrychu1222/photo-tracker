import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useWork } from '../../context/WorkContext'
import { fmtMoney } from '../../lib/format'
import { againstTarget, combineMaterials, fmtQty, materialCost, sumCosts, taskCost } from '../../lib/costs'

// Everything a project needs, grouped by room and task. Crew see names and quantities;
// admins also see prices, totals and how the plan compares with the target cost.
export default function MaterialsTab({ project, finance }) {
  const { isAdmin } = useAuth()
  const { tasksByProject, roomsByProject, roomsById, materialsByTask, equipmentByTask, matPrices, eqPrices, costsError } =
    useWork()
  const [showCombined, setShowCombined] = useState(false)

  const tasks = tasksByProject[project.id] || []
  const rooms = roomsByProject[project.id] || []

  const withLines = tasks.filter((t) => (materialsByTask[t.id] || []).length + (equipmentByTask[t.id] || []).length > 0)
  const allMaterials = tasks.flatMap((t) => materialsByTask[t.id] || [])
  const total = sumCosts(tasks.map((t) => taskCost(materialsByTask[t.id] || [], equipmentByTask[t.id] || [], matPrices, eqPrices)))
  const target = againstTarget(total.total, finance?.budget)

  const groups = [
    ...rooms.map((r) => ({ key: r.id, title: r.name, tasks: withLines.filter((t) => t.room_id === r.id) })),
    { key: 'none', title: rooms.length ? 'No room' : null, tasks: withLines.filter((t) => !t.room_id || !roomsById[t.room_id]) }
  ].filter((g) => g.tasks.length > 0)

  if (costsError) return <p className="text-sm text-status-blocked">{costsError}</p>

  return (
    <div>
      {isAdmin && (
        <div className="mb-4 rounded-xl border border-ink-100 bg-ink-50 p-3 text-sm">
          <p className="mb-2 text-xs font-semibold text-ink-800">Planned cost, ex-GST (admins only)</p>
          <dl className="space-y-1">
            <div className="flex justify-between">
              <dt className="text-ink-600">Materials</dt>
              <dd className="text-ink-900">{fmtMoney(total.materials)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-600">Hired and bought equipment</dt>
              <dd className="text-ink-900">{fmtMoney(total.equipment)}</dd>
            </div>
            <div className="flex justify-between border-t border-ink-100 pt-1 font-semibold">
              <dt className="text-ink-800">Planned total</dt>
              <dd className="text-ink-900">{fmtMoney(total.total)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-600">Target cost</dt>
              <dd className="text-ink-900">{finance?.budget ? fmtMoney(finance.budget) : 'Not set'}</dd>
            </div>
          </dl>
          {target && (
            <p className={`mt-2 font-medium ${target.over ? 'text-status-blocked' : 'text-status-done'}`}>
              {target.over
                ? `Over target by ${fmtMoney(target.amount)}`
                : `Under target by ${fmtMoney(target.amount)}`}
            </p>
          )}
          {total.unpriced > 0 && (
            <p className="mt-1 text-xs text-ink-600">
              {total.unpriced} line{total.unpriced === 1 ? ' has' : 's have'} no price yet, so the total is low. Labour is not
              included until a later update.
            </p>
          )}
          {total.unpriced === 0 && <p className="mt-1 text-xs text-ink-400">Labour is not included yet.</p>}
        </div>
      )}

      {allMaterials.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowCombined((v) => !v)}
            className="rounded-full border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600"
          >
            {showCombined ? 'Hide combined shopping list' : 'Combined shopping list'}
          </button>
          {showCombined && (
            <ul className="mt-2 space-y-1 rounded-xl border border-ink-100 p-3 text-sm">
              {combineMaterials(allMaterials).map((row) => (
                <li key={`${row.name}|${row.unit}`} className="flex justify-between gap-3">
                  <span className="text-ink-900">{row.name}</span>
                  <span className="flex-shrink-0 text-ink-600">
                    {fmtQty(row.quantity)} {row.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {groups.length === 0 && (
        <p className="rounded-xl border border-dashed border-ink-200 py-10 text-center text-sm text-ink-600">
          No materials or equipment yet. Open a task on the Tasks tab to add some.
        </p>
      )}

      <div className="space-y-5">
        {groups.map((g) => {
          const groupCost = sumCosts(
            g.tasks.map((t) => taskCost(materialsByTask[t.id] || [], equipmentByTask[t.id] || [], matPrices, eqPrices))
          )
          return (
            <section key={g.key}>
              {g.title && (
                <div className="mb-1.5 flex items-baseline justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-400">{g.title}</h4>
                  {isAdmin && groupCost.total > 0 && <span className="text-xs text-ink-600">{fmtMoney(groupCost.total)}</span>}
                </div>
              )}
              <ul className="space-y-2">
                {g.tasks.map((t) => {
                  const mats = materialsByTask[t.id] || []
                  const eq = equipmentByTask[t.id] || []
                  const c = taskCost(mats, eq, matPrices, eqPrices)
                  return (
                    <li key={t.id} className="rounded-xl border border-ink-100 bg-white p-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold text-ink-900">{t.name}</p>
                        {isAdmin && c.total > 0 && <span className="text-sm text-ink-800">{fmtMoney(c.total)}</span>}
                      </div>
                      <ul className="mt-1.5 space-y-1 text-sm">
                        {mats.map((m) => {
                          const line = materialCost(m, matPrices[m.id])
                          return (
                            <li key={m.id} className="flex justify-between gap-3">
                              <span className="text-ink-900">
                                {m.name} <span className="text-ink-600">· {fmtQty(m.quantity)} {m.unit || ''}</span>
                              </span>
                              {isAdmin && (
                                <span className={`flex-shrink-0 ${line == null ? 'text-ink-400' : 'text-ink-800'}`}>
                                  {line == null ? 'No price' : fmtMoney(line)}
                                </span>
                              )}
                            </li>
                          )
                        })}
                        {eq.map((e) => (
                          <li key={e.id} className="flex justify-between gap-3">
                            <span className={e.ready ? 'text-ink-400' : 'text-ink-900'}>
                              {e.ready ? '✓ ' : ''}
                              {e.name}{' '}
                              <span className="text-ink-600">
                                · {e.kind === 'own' ? 'own tool' : e.kind === 'hired' ? 'hired' : 'bought'}
                              </span>
                            </span>
                            {isAdmin && e.kind !== 'own' && (
                              <span className={`flex-shrink-0 ${eqPrices[e.id] == null ? 'text-ink-400' : 'text-ink-800'}`}>
                                {eqPrices[e.id] == null ? 'No price' : fmtMoney(eqPrices[e.id])}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
