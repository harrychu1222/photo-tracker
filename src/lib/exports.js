// Builds the CSV files for one project (or all projects) from data the app already holds.
// Money files and price columns are for managers only. Amounts are plain numbers, GST included.
import { toCsv, slug } from './csv'
import { fmtDate } from './format'
import { assigneeLabel, personName } from './people'
import { materialStatusMeta } from './materials'
import { rateFor } from './labour'
import { categoryLabel } from './expenses'
import { projectStatusMeta, taskStatusMeta } from '../statusConfig'

const date = fmtDate
const num = (v) => (v == null || v === '' ? '' : Number(v))
const money = (v) => (v == null || v === '' ? '' : Math.round(Number(v) * 100) / 100)
const gstPart = (v) => (v == null || v === '' ? '' : Math.round((Number(v) / 11) * 100) / 100)

// Australian financial year (1 Jul - 30 Jun) containing `today`, shifted back by `back` years.
export function fyRange(today, back = 0) {
  const [y, m] = today.split('-').map(Number)
  const start = (m >= 7 ? y : y - 1) - back
  return { from: `${start}-07-01`, to: `${start + 1}-06-30` }
}

export const inRange = (d, range) => !range || ((!range.from || d >= range.from) && (!range.to || d <= range.to))

// What each file is, who may export it, and its header. `kind` money = managers only.
export const EXPORT_FILES = [
  { key: 'tasks', label: 'Tasks', money: false },
  { key: 'materials', label: 'Materials / shopping list', money: false },
  { key: 'measurements', label: 'Measurements', money: false },
  { key: 'defects', label: 'Defects', money: false },
  { key: 'diary', label: 'Site diary and issues', money: false },
  { key: 'checklists', label: 'Checklists', money: false },
  { key: 'labour', label: 'Labour hours', money: false, ranged: true },
  { key: 'expenses', label: 'Expenses', money: true, ranged: true },
  { key: 'payments', label: 'Payments received', money: true, ranged: true },
  { key: 'schedule', label: 'Payment schedule', money: true }
]

// w = everything from useWork(); returns { header, rows } for one file key and one project.
export function fileRows(key, project, w, { isAdmin, range }) {
  const pid = project.id
  const rooms = w.roomsById
  const room = (id) => rooms[id]?.name || ''
  const level = (id) => rooms[id]?.level || ''
  const tasks = w.tasksByProject[pid] || []
  const taskName = (id) => tasks.find((t) => t.id === id)?.name || ''
  const P = project.name
  switch (key) {
    case 'tasks':
      return {
        header: ['Project', 'Level', 'Room', 'Task', 'Status', '% complete', 'Planned start', 'Planned end', 'Actual start', 'Actual end', 'Planned hours', 'Assigned to', 'Notes'],
        rows: tasks.map((t) => [P, level(t.room_id), room(t.room_id), t.name, taskStatusMeta(t.status).label, num(t.percent_complete), date(t.planned_start), date(t.planned_end), date(t.actual_start), date(t.actual_end), num(t.planned_hours), assigneeLabel(t, w.team), t.notes || ''])
      }
    case 'materials': {
      const mats = [...tasks.flatMap((t) => (w.materialsByTask[t.id] || []).map((m) => ({ m, t }))), ...w.materials.filter((m) => !m.task_id && m.project_id === pid).map((m) => ({ m, t: null }))]
      return {
        header: ['Project', 'Room', 'Task', 'Item', 'Quantity', 'Unit', 'Shop', 'Status', 'Ordered on', 'Delivered on', ...(isAdmin ? ['Unit cost', 'Planned cost'] : [])],
        rows: mats.map(({ m, t }) => [P, t ? room(t.room_id) : '', t ? t.name : 'No task yet', m.name, num(m.quantity), m.unit || '', m.supplier || '', materialStatusMeta(m.status).label, date(m.ordered_on), date(m.delivered_on), ...(isAdmin ? [money(w.matPrices[m.id]), w.matPrices[m.id] == null ? '' : money(Number(w.matPrices[m.id]) * Number(m.quantity || 0))] : [])])
      }
    }
    case 'measurements':
      return {
        header: ['Project', 'Room', 'Group', 'Measurement', 'Value', 'Unit', 'Note'],
        rows: (w.measurementsByProject[pid] || []).map((m) => [P, room(m.room_id), m.group_name || '', m.label, num(m.value), m.unit || '', m.note || ''])
      }
    case 'defects':
      return {
        header: ['Project', 'Room', 'Task', 'Defect', 'Priority', 'Status', 'Raised', 'Fixed', 'Notes'],
        rows: (w.defectsByProject[pid] || []).map((d) => [P, room(d.room_id), taskName(d.task_id), d.title, d.priority, d.status === 'fixed' ? 'Fixed' : d.status === 'in_progress' ? 'In progress' : 'Open', date(d.raised_on), date(d.fixed_on), d.notes || ''])
      }
    case 'diary': {
      const rows = []
      for (const e of [...(w.diaryByProject[pid] || [])].sort((a, b) => (a.entry_date < b.entry_date ? -1 : 1))) {
        const base = [P, date(e.entry_date), e.weather || '', e.on_site || '', e.work_done || '']
        const list = w.issuesByEntry[e.id] || []
        if (list.length) list.forEach((i) => rows.push([...base, i.text, i.resolved ? 'Resolved' : 'Open', date(i.resolved_on), i.comment || '']))
        else if ((e.issues || '').trim()) rows.push([...base, e.issues.trim(), 'Open', '', ''])
        else rows.push([...base, '', '', '', ''])
      }
      return { header: ['Project', 'Date', 'Weather', 'On site', 'Work done', 'Issue', 'Issue status', 'Resolved on', 'Issue comment'], rows }
    }
    case 'checklists':
      return {
        header: ['Project', 'Checklist', 'Item', 'Done', 'Done on', 'Note'],
        rows: (w.checksByProject[pid] || []).map((c) => [P, c.list_name, c.text, c.done ? 'Yes' : 'No', date(c.done_on), c.note || ''])
      }
    case 'labour': {
      const person = (e) => (e.worker_id ? w.workers.find((x) => x.id === e.worker_id)?.name || 'Removed person' : personName(w.team.find((m) => m.id === e.user_id)?.email))
      return {
        header: ['Project', 'Date', 'Person', 'Task', 'Hours', ...(isAdmin ? ['Rate per hour', 'Cost'] : []), 'Note'],
        rows: (w.timeByProject[pid] || [])
          .filter((e) => inRange(e.work_date, range))
          .sort((a, b) => (a.work_date < b.work_date ? -1 : 1))
          .map((e) => {
            const r = isAdmin ? rateFor(e, w.rateBook) : null
            return [P, date(e.work_date), person(e), taskName(e.task_id), num(e.hours), ...(isAdmin ? [money(r), r == null ? '' : money(r * Number(e.hours))] : []), e.note || '']
          })
      }
    }
    case 'expenses': {
      const matName = (id) => w.materials.find((m) => m.id === id)?.name || ''
      return {
        header: ['Project', 'Date', 'Supplier', 'Description', 'Category', 'Amount', 'GST part (amount / 11)', 'Material'],
        rows: (w.expensesByProject[pid] || []).filter((e) => inRange(e.expense_date, range)).sort((a, b) => (a.expense_date < b.expense_date ? -1 : 1)).map((e) => [P, date(e.expense_date), e.supplier || '', e.description, categoryLabel(e.category), money(e.amount_ex_gst), gstPart(e.amount_ex_gst), matName(e.material_id)])
      }
    }
    case 'payments':
      return {
        header: ['Project', 'Date', 'Description', 'Amount', 'GST part (amount / 11)'],
        rows: (w.paymentsByProject[pid] || []).filter((p) => inRange(p.received_on, range)).sort((a, b) => (a.received_on < b.received_on ? -1 : 1)).map((p) => [P, date(p.received_on), p.description, money(p.amount_ex_gst), gstPart(p.amount_ex_gst)])
      }
    case 'schedule': {
      const pays = w.paymentsByProject[pid] || []
      return {
        header: ['Project', 'Milestone', 'Due', 'Amount', 'Received', 'Received on'],
        rows: [...(w.milestonesByProject[pid] || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map((m) => {
          const p = m.payment_id ? pays.find((x) => x.id === m.payment_id) : null
          return [P, m.name, date(m.due_on), money(m.amount), m.payment_id ? 'Yes' : 'No', p ? date(p.received_on) : '']
        })
      }
    }
    default:
      return { header: [], rows: [] }
  }
}

// One CSV per ticked file for one project: [{ name, text, count }]
export function projectCsvFiles(project, w, keys, opts) {
  const day = new Date().toISOString().slice(0, 10)
  return keys.map((key) => {
    const { header, rows } = fileRows(key, project, w, opts)
    return { name: `${slug(project.name)}-${key}-${day}.csv`, text: toCsv(header, rows), count: rows.length }
  })
}

// All projects: the same files joined (Project column tells them apart), plus a summary.
export function allProjectsCsvFiles(projects, w, keys, opts, snaps) {
  const day = new Date().toISOString().slice(0, 10)
  const out = []
  if (opts.isAdmin && snaps) {
    const rows = snaps.map((s) => [s.project.name, projectStatusMeta(s.project.status).label, s.progress?.percent ?? '', money(s.quote), money(s.spent), money(s.received), money(s.net), money(s.toReceive), s.next ? `${s.next.milestone.name} ${date(s.next.milestone.due_on)}`.trim() : ''])
    out.push({ name: `all-projects-summary-${day}.csv`, text: toCsv(['Project', 'Status', '% complete', 'Quote', 'Spent', 'Received', 'Net (received - spent)', 'Still to receive', 'Next payment'], rows), count: rows.length })
  }
  for (const key of keys) {
    let header = []
    const rows = []
    for (const p of projects) {
      const r = fileRows(key, p, w, opts)
      header = r.header
      rows.push(...r.rows)
    }
    out.push({ name: `all-projects-${key}-${day}.csv`, text: toCsv(header, rows), count: rows.length })
  }
  return out
}
