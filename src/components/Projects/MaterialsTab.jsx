import { useState } from 'react'
import MaterialDates from './MaterialDates'
import { actualByMaterial, materialVariance, sumExpenses } from '../../lib/expenses'
import { useAuth } from '../../context/AuthContext'
import { useWork } from '../../context/WorkContext'
import { fmtMoney } from '../../lib/format'
import { againstTarget, combineMaterials, fmtQty, materialCost, sumCosts, taskCost } from '../../lib/costs'
import {
  MATERIAL_STATUSES,
  materialProgress,
  materialStatusMeta,
  materialStatusPatch,
  nextMaterialStatus
} from '../../lib/materials'

const chip = (on) =>
  `rounded-full border px-3 py-1 text-xs font-medium ${
    on ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-600'
  }`

// Everything a project needs, grouped by room and task. Crew see names, quantities and delivery
// state; admins also see prices, totals and how the plan compares with the target cost.
export default function MaterialsTab({ project, finance }) {
  const { isAdmin } = useAuth()
  const {
    tasksByProject,
    roomsByProject,
    roomsById,
    materialsByTask,
    equipmentByTask,
    matPrices,
    eqPrices,
    costsError,
    setMaterialStatus,
    expensesByProject
  } = useWork()
  const projectExpenses = expensesByProject[project.id] || []
  const actuals = actualByMaterial(projectExpenses)
  const actualMaterials = sumExpenses(projectExpenses.filter((e) => e.category === 'materials'))
  const actualEquipment = sumExpenses(projectExpenses.filter((e) => e.category === 'equipment'))
  const unlinked = sumExpenses(projectExpenses.filter((e) => e.category === 'materials' && !e.material_id))
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | a status value
  const [roomFilter, setRoomFilter] = useState('all') // 'all' | 'none' | a room id
  const [showList, setShowList] = useState(false)
  const [statusError, setStatusError] = useState(null)

  async function advance(m) {
    setStatusError(null)
    try {
      await setMaterialStatus(m.id, materialStatusPatch(m, nextMaterialStatus(m.status)))
    } catch (err) {
      setStatusError(err.message)
    }
  }

  const tasks = tasksByProject[project.id] || []
  const rooms = roomsByProject[project.id] || []

  const inRoom = (t) =>
    roomFilter === 'all' ? true : roomFilter === 'none' ? !t.room_id || !roomsById[t.room_id] : t.room_id === roomFilter
  const statusOf = (m) => m.status || 'to_order'

  // Project-wide figures (the admin totals ignore the filters on purpose).
  const everyMaterial = tasks.flatMap((t) => materialsByTask[t.id] || [])
  const total = sumCosts(tasks.map((t) => taskCost(materialsByTask[t.id] || [], equipmentByTask[t.id] || [], matPrices, eqPrices)))
  const target = againstTarget(total.total, finance?.budget)

  // What the filters let through.
  const roomTasks = tasks.filter(inRoom)
  const roomMaterials = roomTasks.flatMap((t) => materialsByTask[t.id] || [])
  const counts = { all: roomMaterials.length, ...materialProgress(roomMaterials) }
  const countFor = { all: counts.all, to_order: counts.toOrder, ordered: counts.ordered, delivered: counts.delivered }

  const rows = roomTasks
    .map((t) => ({
      task: t,
      mats: (materialsByTask[t.id] || []).filter((m) => statusFilter === 'all' || statusOf(m) === statusFilter),
      eq: statusFilter === 'all' ? equipmentByTask[t.id] || [] : []
    }))
    .filter((r) => r.mats.length + r.eq.length > 0)

  const shown = rows.flatMap((r) => r.mats)
  const groups = [
    ...rooms.map((r) => ({ key: r.id, title: r.name, rows: rows.filter((x) => x.task.room_id === r.id) })),
    {
      key: 'none',
      title: rooms.length ? 'No room' : null,
      rows: rows.filter((x) => !x.task.room_id || !roomsById[x.task.room_id])
    }
  ].filter((g) => g.rows.length > 0)

  const filterName = statusFilter === 'all' ? 'all materials' : materialStatusMeta(statusFilter).label.toLowerCase()

  if (costsError) return <p className="text-sm text-status-blocked">{costsError}</p>

  return (
    <div>
      {isAdmin && (
        <div className="mb-4 rounded-xl border border-ink-100 bg-ink-50 p-3 text-sm">
          <p className="mb-2 text-xs font-semibold text-ink-800">Planned and actual cost, GST included (admins only)</p>
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1" data-testid="materials-cost">
            <span className="text-xs text-ink-400" />
            <span className="text-right text-xs text-ink-400">Planned</span>
            <span className="text-right text-xs text-ink-400">Actual</span>
            <span className="text-right text-xs text-ink-400">Difference</span>
            {[
              { id: 'materials', label: 'Materials', planned: total.materials, actual: actualMaterials },
              { id: 'equipment', label: 'Equipment', planned: total.equipment, actual: actualEquipment }
            ].map((r) => {
              const diff = Math.round((r.actual - r.planned) * 100) / 100
              return (
                <div key={r.id} className="contents" data-testid={`cost-${r.id}`}>
                  <span className="text-ink-600">{r.label}</span>
                  <span className="text-right text-ink-900">{fmtMoney(r.planned)}</span>
                  <span className="text-right text-ink-900">{fmtMoney(r.actual)}</span>
                  <span className={`text-right text-xs font-medium ${r.actual === 0 ? 'text-ink-400' : diff > 0 ? 'text-status-blocked' : 'text-status-done'}`}>
                    {r.actual === 0 ? '—' : diff === 0 ? 'on plan' : `${fmtMoney(Math.abs(diff))} ${diff > 0 ? 'over' : 'under'}`}
                  </span>
                </div>
              )
            })}
            <span className="border-t border-ink-100 pt-1 font-semibold text-ink-800">Total</span>
            <span className="border-t border-ink-100 pt-1 text-right font-semibold text-ink-900">{fmtMoney(total.total)}</span>
            <span className="border-t border-ink-100 pt-1 text-right font-semibold text-ink-900" data-testid="cost-total-actual">{fmtMoney(Math.round((actualMaterials + actualEquipment) * 100) / 100)}</span>
            <span className="border-t border-ink-100 pt-1" />
          </div>
          {unlinked !== 0 && (
            <p className="mt-1.5 text-xs text-ink-600" data-testid="cost-unlinked">
              Of the actual materials cost, {fmtMoney(unlinked)} is not linked to a material line.
            </p>
          )}
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-ink-600">Target cost</span>
            <span className="text-ink-900">{finance?.budget ? fmtMoney(finance.budget) : 'Not set'}</span>
          </div>
          {target && (
            <p className={`mt-2 font-medium ${target.over ? 'text-status-blocked' : 'text-status-done'}`}>
              {target.over ? `Over target by ${fmtMoney(target.amount)}` : `Under target by ${fmtMoney(target.amount)}`}
            </p>
          )}
          {total.unpriced > 0 && (
            <p className="mt-1 text-xs text-ink-600">
              {total.unpriced} line{total.unpriced === 1 ? ' has' : 's have'} no price yet, so the total is low. Labour is not
              part of this planned figure.
            </p>
          )}
          {total.unpriced === 0 && <p className="mt-1 text-xs text-ink-400">Labour is not part of this planned figure.</p>}
        </div>
      )}

      {everyMaterial.length > 0 && (
        <div className="mb-3 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button onClick={() => setStatusFilter('all')} className={chip(statusFilter === 'all')} aria-pressed={statusFilter === 'all'}>
              All ({countFor.all})
            </button>
            {MATERIAL_STATUSES.map((s) => (
              <button
                key={s.value}
                onClick={() => setStatusFilter(statusFilter === s.value ? 'all' : s.value)}
                className={chip(statusFilter === s.value)}
                aria-pressed={statusFilter === s.value}
              >
                {s.label} ({countFor[s.value]})
              </button>
            ))}
          </div>
          {rooms.length > 0 && (
            <select
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              aria-label="Room"
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
            >
              <option value="all">All rooms</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
              <option value="none">No room</option>
            </select>
          )}
        </div>
      )}
      {statusError && <p className="mb-3 text-sm text-status-blocked">{statusError}</p>}

      {everyMaterial.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowList((v) => !v)}
            className="rounded-full border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600"
          >
            {showList ? 'Hide combined list' : `Combined list of what is shown (${shown.length})`}
          </button>
          {showList && shown.length === 0 && <p className="mt-2 text-sm text-ink-600">Nothing matches these filters.</p>}
          {showList && shown.length > 0 && (
            <div className="mt-2 rounded-xl border border-ink-100 p-3 text-sm">
              <p className="mb-1.5 text-xs font-semibold text-ink-800">
                Combined: {filterName}
                {roomFilter !== 'all' ? `, ${roomFilter === 'none' ? 'no room' : roomsById[roomFilter]?.name}` : ''}
              </p>
              <ul className="space-y-1">
                {combineMaterials(shown).map((row) => (
                  <li key={`${row.name}|${row.unit}`} className="flex justify-between gap-3">
                    <span className="text-ink-900">{row.name}</span>
                    <span className="flex-shrink-0 text-ink-600">
                      {fmtQty(row.quantity)} {row.unit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {tasks.length > 0 && everyMaterial.length === 0 && (
        <p className="rounded-xl border border-dashed border-ink-200 py-10 text-center text-sm text-ink-600">
          No materials or equipment yet. Open a task on the Tasks tab to add some.
        </p>
      )}
      {tasks.length === 0 && (
        <p className="rounded-xl border border-dashed border-ink-200 py-10 text-center text-sm text-ink-600">
          Add tasks first, then add their materials and equipment.
        </p>
      )}
      {everyMaterial.length > 0 && groups.length === 0 && (
        <p className="py-8 text-center text-sm text-ink-600">Nothing matches these filters.</p>
      )}

      <div className="space-y-5">
        {groups.map((g) => {
          const groupCost = sumCosts(g.rows.map((r) => taskCost(r.mats, r.eq, matPrices, eqPrices)))
          return (
            <section key={g.key}>
              {g.title && (
                <div className="mb-1.5 flex items-baseline justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-400">{g.title}</h4>
                  {isAdmin && groupCost.total > 0 && <span className="text-xs text-ink-600">{fmtMoney(groupCost.total)}</span>}
                </div>
              )}
              <ul className="space-y-2">
                {g.rows.map(({ task: t, mats, eq }) => {
                  const c = taskCost(mats, eq, matPrices, eqPrices)
                  return (
                    <li key={t.id} className="rounded-xl border border-ink-100 bg-white p-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold text-ink-900">{t.name}</p>
                        {isAdmin && c.total > 0 && <span className="text-sm text-ink-800">{fmtMoney(c.total)}</span>}
                      </div>
                      <ul className="mt-1.5 space-y-2 text-sm">
                        {mats.map((m) => {
                          const line = materialCost(m, matPrices[m.id])
                          const st = materialStatusMeta(m.status)
                          const variance = isAdmin ? materialVariance(line, actuals[m.id]) : null
                          return (
                            <li key={m.id}>
                              <div className="flex items-center justify-between gap-3">
                                <span className="min-w-0 text-ink-900">
                                  {m.name} <span className="text-ink-600">· {fmtQty(m.quantity)} {m.unit || ''}</span>
                                  {m.check_qty && <span className="text-signal-600"> · check quantity</span>}
                                </span>
                                <span className="flex flex-shrink-0 items-center gap-2">
                                  {isAdmin && (
                                    <span className={line == null ? 'text-ink-400' : 'text-ink-800'}>
                                      {line == null ? 'No price' : fmtMoney(line)}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => advance(m)}
                                    aria-label={`${m.name} is ${st.label}. Tap to change`}
                                    className="flex items-center gap-1.5 rounded-full bg-ink-50 px-2 py-0.5 text-xs font-medium text-ink-800"
                                  >
                                    <span className="status-dot" style={{ backgroundColor: st.color }} />
                                    {st.label}
                                  </button>
                                </span>
                              </div>
                              {variance && (
                                <p className="mt-0.5 text-xs text-ink-600">
                                  Paid {fmtMoney(variance.actual)}
                                  {variance.diff != null && (
                                    <span className={`font-medium ${variance.over ? 'text-status-blocked' : 'text-status-done'}`}>
                                      {variance.diff === 0
                                        ? ' · on plan'
                                        : ` · ${fmtMoney(Math.abs(variance.diff))} ${variance.over ? 'over' : 'under'} plan`}
                                    </span>
                                  )}
                                </p>
                              )}
                              <MaterialDates material={m} />
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
