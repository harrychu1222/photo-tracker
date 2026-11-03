// Figures for the all-projects overview. Built from the same functions the project screen uses,
// so a project shows the same numbers in both places.
import { sumCosts, taskCost } from './costs'
import { projectMoney } from './expenses'
import { buildCashFlow, receivedSummary } from './cashflow'
import { labourCost, labourEvents } from './labour'
import { materialLateDays } from './materials'
import { scheduleSummary } from './attention'
import { dayDiff, taskProgress, todayLocal } from './tasks'

const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100

// ctx = the lists from useWork(): tasksByProject, materialsByTask, equipmentByTask, matPrices,
// eqPrices, expensesByProject, paymentsByProject, timeByProject, rateBook, lumpsByProject, defectsByProject
export function projectSnapshot(project, finance, ctx, today = todayLocal()) {
  const tasks = ctx.tasksByProject[project.id] || []
  const expenses = ctx.expensesByProject[project.id] || []
  const payments = ctx.paymentsByProject[project.id] || []
  const time = ctx.timeByProject[project.id] || []
  const lumps = ctx.lumpsByProject[project.id] || []
  const defects = (ctx.defectsByProject?.[project.id] || []).filter((d) => d.status !== 'fixed')
  const planned = sumCosts(tasks.map((t) => taskCost(ctx.materialsByTask[t.id] || [], ctx.equipmentByTask[t.id] || [], ctx.matPrices, ctx.eqPrices)))
  const labour = labourCost(time, ctx.rateBook, lumps)
  const money = projectMoney(finance, expenses, planned.total, labour.hourly, labour.lumpTotal)
  const paid = receivedSummary(payments, money.quote)
  const sched = scheduleSummary(tasks, today)
  const materials = tasks.flatMap((t) => ctx.materialsByTask[t.id] || [])
  return {
    project,
    progress: taskProgress(tasks),
    behindDays: sched.behindDays,
    overdueCount: sched.overdueCount,
    lateDeliveries: materials.filter((m) => materialLateDays(m, today) != null).length,
    openDefects: defects.length,
    urgentDefects: defects.filter((d) => d.priority === 'urgent').length,
    oldestDefect: defects.length ? Math.max(...defects.map((d) => Math.max(0, dayDiff(d.raised_on, today)))) : null,
    spent: money.actual,
    target: money.target,
    quote: money.quote,
    received: paid.received,
    toReceive: paid.toReceive,
    net: round(paid.received - money.actual)
  }
}

export function overviewTotals(snaps) {
  const sum = (k) => round(snaps.reduce((s, x) => s + (Number(x[k]) || 0), 0))
  return {
    projects: snaps.length,
    behind: snaps.filter((x) => x.behindDays > 0).length,
    overdueTasks: snaps.reduce((s, x) => s + x.overdueCount, 0),
    lateDeliveries: snaps.reduce((s, x) => s + x.lateDeliveries, 0),
    openDefects: snaps.reduce((s, x) => s + x.openDefects, 0),
    urgentDefects: snaps.reduce((s, x) => s + x.urgentDefects, 0),
    spent: sum('spent'),
    received: sum('received'),
    net: sum('net'),
    toReceive: round(snaps.reduce((s, x) => s + (x.toReceive || 0), 0))
  }
}

// One cash-flow line for several projects together.
export function combinedCashFlow(projects, ctx, today = todayLocal()) {
  const expenses = projects.flatMap((p) => ctx.expensesByProject[p.id] || [])
  const payments = projects.flatMap((p) => ctx.paymentsByProject[p.id] || [])
  const labour = projects.flatMap((p) => labourEvents(ctx.timeByProject[p.id] || [], ctx.rateBook, ctx.lumpsByProject[p.id] || [], today))
  return buildCashFlow(expenses, payments, { today, quote: null, labour })
}
